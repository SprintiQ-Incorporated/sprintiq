/**
 * Rate Limiting Utility
 *
 * Simple in-memory rate limiting for API endpoints.
 * For production at scale, consider Redis-based rate limiting.
 */

import { NextRequest } from "next/server";

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// In-memory store (use Redis for multi-instance deployments)
const rateLimitStore = new Map<string, RateLimitEntry>();

// Clean up expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetTime < now) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

interface RateLimitConfig {
  windowMs: number;      // Time window in milliseconds
  maxRequests: number;   // Max requests per window
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
}

// Preset configurations for different endpoint types
export const RATE_LIMIT_PRESETS = {
  // Auth endpoints - stricter limits
  auth: {
    windowMs: 60 * 1000,      // 1 minute
    maxRequests: 10,          // 10 attempts per minute
  },
  // OAuth initiation - prevent abuse
  oauth: {
    windowMs: 60 * 1000,      // 1 minute
    maxRequests: 5,           // 5 OAuth flows per minute
  },
  // Webhooks - more lenient (providers can send bursts)
  webhook: {
    windowMs: 60 * 1000,      // 1 minute
    maxRequests: 100,         // 100 webhooks per minute
  },
  // API endpoints - moderate limits
  api: {
    windowMs: 60 * 1000,      // 1 minute
    maxRequests: 60,          // 60 requests per minute
  },
  // Sensitive operations
  sensitive: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 10,          // 10 attempts per hour
  },
  // Email sending - prevent flooding and spam abuse
  email: {
    windowMs: 60 * 1000,      // 1 minute
    maxRequests: 10,          // 10 emails per minute per IP
  },
} as const;

/**
 * Check if a request is within rate limits
 *
 * @param identifier - Unique identifier (e.g., IP address, user ID)
 * @param config - Rate limit configuration
 * @returns Whether the request is allowed and remaining quota
 */
export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): RateLimitResult {
  const now = Date.now();
  const key = identifier;
  const entry = rateLimitStore.get(key);

  // No existing entry - create new one
  if (!entry || entry.resetTime < now) {
    rateLimitStore.set(key, {
      count: 1,
      resetTime: now + config.windowMs,
    });
    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetTime: now + config.windowMs,
    };
  }

  // Check if over limit
  if (entry.count >= config.maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetTime: entry.resetTime,
    };
  }

  // Increment counter
  entry.count++;
  return {
    allowed: true,
    remaining: config.maxRequests - entry.count,
    resetTime: entry.resetTime,
  };
}

/**
 * Get client identifier from request
 * Uses X-Forwarded-For for proxied requests, falls back to a hash of headers
 */
export function getClientIdentifier(request: Request): string {
  // Try X-Forwarded-For first (set by proxies/load balancers)
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }

  // Try X-Real-IP
  const realIp = request.headers.get("x-real-ip");
  if (realIp) {
    return realIp;
  }

  // Fallback: create identifier from user agent + accept headers
  const userAgent = request.headers.get("user-agent") || "";
  const accept = request.headers.get("accept") || "";
  return `anon-${simpleHash(userAgent + accept)}`;
}

/**
 * Simple hash function for creating identifiers
 */
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Create rate limit response headers
 */
export function createRateLimitHeaders(result: RateLimitResult): Headers {
  const headers = new Headers();
  headers.set("X-RateLimit-Remaining", result.remaining.toString());
  headers.set("X-RateLimit-Reset", Math.ceil(result.resetTime / 1000).toString());

  if (!result.allowed) {
    headers.set("Retry-After", Math.ceil((result.resetTime - Date.now()) / 1000).toString());
  }

  return headers;
}

/**
 * Middleware-style rate limit check that returns a Response if rate limited
 *
 * @example
 * const rateLimitResponse = await withRateLimit(request, "auth");
 * if (rateLimitResponse) return rateLimitResponse;
 */
export function withRateLimit(
  request: Request,
  preset: keyof typeof RATE_LIMIT_PRESETS,
  customIdentifier?: string
): Response | null {
  const identifier = customIdentifier || getClientIdentifier(request);
  const config = RATE_LIMIT_PRESETS[preset];
  const key = `${preset}:${identifier}`;

  const result = checkRateLimit(key, config);

  if (!result.allowed) {
    const headers = createRateLimitHeaders(result);
    headers.set("Content-Type", "application/json");

    return new Response(
      JSON.stringify({
        error: "Too many requests",
        message: `Rate limit exceeded. Please try again in ${Math.ceil(
          (result.resetTime - Date.now()) / 1000
        )} seconds.`,
        retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000),
      }),
      {
        status: 429,
        headers,
      }
    );
  }

  return null;
}

type RouteHandler = (request: NextRequest) => Promise<Response>;

interface WrapperConfig {
  preset: keyof typeof RATE_LIMIT_PRESETS;
}

/**
 * Higher-order function that wraps a route handler with rate limiting
 *
 * @example
 * export const POST = withRateLimitWrapper(async (request: NextRequest) => {
 *   // handler logic
 *   return NextResponse.json({ success: true });
 * }, { preset: 'email' });
 */
export function withRateLimitWrapper(
  handler: RouteHandler,
  config: WrapperConfig
): RouteHandler {
  return async (request: NextRequest): Promise<Response> => {
    const rateLimitResponse = withRateLimit(request, config.preset);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }
    return handler(request);
  };
}
