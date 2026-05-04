/**
 * Enhanced Rate Limiting Utility with Redis Support
 * 
 * Supports both IP-based and user-based rate limiting
 * Uses Upstash Redis for distributed rate limiting across multiple instances
 * 
 * Setup:
 * 1. Install dependencies: npm install @upstash/ratelimit @upstash/redis
 * 2. Add environment variables:
 *    UPSTASH_REDIS_REST_URL=https://...
 *    UPSTASH_REDIS_REST_TOKEN=...
 * 
 * Usage:
 * import { rateLimiters, withRateLimit } from '@/lib/rate-limit-v2';
 * 
 * export async function POST(request: NextRequest) {
 *   const rateLimitResponse = await withRateLimit(request, 'ai', 'user');
 *   if (rateLimitResponse) return rateLimitResponse;
 *   
 *   // Continue with request
 * }
 */

import { NextRequest, NextResponse } from 'next/server';

// ============================================================================
// TYPES
// ============================================================================

export interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Max requests per window
  keyPrefix: string; // Prefix for Redis key
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
}

// ============================================================================
// RATE LIMIT PRESETS
// ============================================================================

export const RATE_LIMIT_PRESETS = {
  // Critical AI operations - very restrictive
  ai_expensive: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 10, // 10 per hour per user
    keyPrefix: 'ratelimit:ai:expensive',
  } as RateLimitConfig,

  // Standard AI operations
  ai_standard: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 5, // 5 per minute per user
    keyPrefix: 'ratelimit:ai:standard',
  } as RateLimitConfig,

  // General API endpoints
  api: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 60, // 60 per minute per user
    keyPrefix: 'ratelimit:api',
  } as RateLimitConfig,

  // Auth endpoints - strict limits
  auth: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 10, // 10 per minute per IP
    keyPrefix: 'ratelimit:auth',
  } as RateLimitConfig,

  // OAuth endpoints
  oauth: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 5, // 5 per minute per IP
    keyPrefix: 'ratelimit:oauth',
  } as RateLimitConfig,

  // Webhook endpoints - more lenient
  webhook: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 100, // 100 per minute
    keyPrefix: 'ratelimit:webhook',
  } as RateLimitConfig,

  // Data export - moderate
  export: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 10, // 10 per hour per user
    keyPrefix: 'ratelimit:export',
  } as RateLimitConfig,

  // File upload - strict on size/frequency
  upload: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 50, // 50 per hour per user
    keyPrefix: 'ratelimit:upload',
  } as RateLimitConfig,

  // ---------------------------------------------------------------------------
  // Per-provider AI rate limits (US-007)
  // Defined but NOT enforced yet — enforcement wires in during Sprint 2 US-011
  // ---------------------------------------------------------------------------

  // Anthropic global — protects single ANTHROPIC_API_KEY (Tier 1: 40K input tokens/min)
  claude_global: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 40, // 40 RPM
    keyPrefix: 'ratelimit:claude:global',
  } as RateLimitConfig,

  // Anthropic per-user — prevents one user from starving others
  claude_per_user: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 5, // 5 RPM per user
    keyPrefix: 'ratelimit:claude:user',
  } as RateLimitConfig,

  // Anthropic heavy tasks — story generation, TAWOS training (Tier 1 budget)
  claude_heavy: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 10, // 10 RPM global — prevents starving lighter tasks
    keyPrefix: 'ratelimit:claude:heavy',
  } as RateLimitConfig,

  // DeepSeek global — protects single DEEPSEEK_API_KEY
  deepseek_global: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 50, // 50 RPM
    keyPrefix: 'ratelimit:deepseek:global',
  } as RateLimitConfig,

  // Voyage AI global — protects single VOYAGE_API_KEY
  voyage_global: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 200, // 200 RPM
    keyPrefix: 'ratelimit:voyage:global',
  } as RateLimitConfig,

  // Voyage AI batch — TAWOS training batch embedding jobs only
  voyage_batch: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 20, // 20 RPM
    keyPrefix: 'ratelimit:voyage:batch',
  } as RateLimitConfig,
} as const;

// ============================================================================
// IN-MEMORY FALLBACK (for development without Redis)
// ============================================================================

interface InMemoryEntry {
  count: number;
  resetTime: number;
}

const inMemoryStore = new Map<string, InMemoryEntry>();

// Cleanup expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of inMemoryStore.entries()) {
    if (entry.resetTime < now) {
      inMemoryStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

/**
 * In-memory rate limiting (for development/fallback)
 */
function checkRateLimitInMemory(
  identifier: string,
  config: RateLimitConfig
): RateLimitResult {
  const now = Date.now();
  const key = `${config.keyPrefix}:${identifier}`;
  const entry = inMemoryStore.get(key);

  // No existing entry - create new one
  if (!entry || entry.resetTime < now) {
    inMemoryStore.set(key, {
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
      retryAfter: Math.ceil((entry.resetTime - now) / 1000),
    };
  }

  // Increment and allow
  entry.count++;
  return {
    allowed: true,
    remaining: config.maxRequests - entry.count,
    resetTime: entry.resetTime,
  };
}

// ============================================================================
// REDIS RATE LIMITING (for production)
// ============================================================================

let redisClient: any = null;
let useRedis = false;

/**
 * Initialize Redis rate limiting
 * Called automatically if environment variables are present
 */
async function initializeRedis() {
  if (useRedis || redisClient) return;

  const hasRedisConfig =
    process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!hasRedisConfig) {
    const isProduction = process.env.NODE_ENV === 'production' ||
                        process.env.VERCEL_ENV === 'production';

    if (isProduction) {
      console.error(
        '[RATE LIMIT CRITICAL] Redis not configured in production!\n' +
        '  - Rate limiting is using in-memory fallback\n' +
        '  - Each serverless instance has separate rate limit counters\n' +
        '  - Users can bypass rate limits by hitting different instances\n' +
        '  - SECURITY RISK: Abuse protection is significantly weakened\n' +
        '  - FIX: Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in Vercel env vars'
      );
    } else {
    }
    return;
  }

  try {
    // Lazy import to avoid issues in non-Node environments
    const { Ratelimit } = await import('@upstash/ratelimit');
    const { Redis } = await import('@upstash/redis');

    const redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });

    redisClient = redis;
    useRedis = true;
  } catch (error) {
  }
}

/**
 * Check rate limit using Redis or in-memory fallback
 */
async function checkRateLimitWithRedis(
  identifier: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  if (!useRedis || !redisClient) {
    return checkRateLimitInMemory(identifier, config);
  }

  const now = Date.now();
  const key = `${config.keyPrefix}:${identifier}`;
  const windowStart = now - config.windowMs;

  try {
    // Get current count within window
    const count = await redisClient.get(key);
    const currentCount = count ? parseInt(count as string, 10) : 0;

    if (currentCount >= config.maxRequests) {
      const ttl = await redisClient.ttl(key);
      return {
        allowed: false,
        remaining: 0,
        resetTime: now + (ttl > 0 ? ttl * 1000 : config.windowMs),
        retryAfter: ttl > 0 ? ttl : Math.ceil(config.windowMs / 1000),
      };
    }

    // Increment counter and set expiry
    const newCount = currentCount + 1;
    await redisClient.setex(key, Math.ceil(config.windowMs / 1000), newCount);

    return {
      allowed: true,
      remaining: config.maxRequests - newCount,
      resetTime: now + config.windowMs,
    };
  } catch (error) {
    console.error('[Rate Limit] Redis error, using in-memory fallback:', error);
    // Fallback to in-memory
    return checkRateLimitInMemory(identifier, config);
  }
}

// ============================================================================
// MULTI-BUCKET RATE LIMITING (US-011 — worker-level checks)
// ============================================================================

export type PresetKey = keyof typeof RATE_LIMIT_PRESETS;

export interface RateLimitCheck {
  identifier: string;
  preset: PresetKey;
}

export interface MultiRateLimitResult {
  allowed: boolean;
  deniedPreset?: PresetKey;
  retryAfter?: number;
  results: Array<{ preset: PresetKey; result: RateLimitResult }>;
}

/**
 * Check multiple rate limit buckets sequentially.
 * Stops at first denial — does NOT consume tokens from subsequent buckets.
 */
export async function checkMultipleLimits(
  checks: RateLimitCheck[]
): Promise<MultiRateLimitResult> {
  await initializeRedis();

  const results: MultiRateLimitResult['results'] = [];

  for (const check of checks) {
    const config = RATE_LIMIT_PRESETS[check.preset];
    const result = await checkRateLimitWithRedis(check.identifier, config);
    results.push({ preset: check.preset, result });

    if (!result.allowed) {
      return {
        allowed: false,
        deniedPreset: check.preset,
        retryAfter: result.retryAfter,
        results,
      };
    }
  }

  return { allowed: true, results };
}

// ============================================================================
// RATE LIMIT UTILIZATION (US-011 — health endpoint)
// ============================================================================

export interface RateLimitBucketUtilization {
  preset: string;
  current: number;
  limit: number;
  percentUsed: number;
  windowMs: number;
}

const GLOBAL_PRESETS: PresetKey[] = [
  'claude_global',
  'claude_heavy',
  'deepseek_global',
  'voyage_global',
  'voyage_batch',
];

/**
 * Read Redis counters for global AI rate limit presets.
 * Returns utilization info for each bucket. Returns [] if Redis unavailable.
 */
export async function getRateLimitUtilization(): Promise<RateLimitBucketUtilization[]> {
  await initializeRedis();

  if (!useRedis || !redisClient) {
    return [];
  }

  const results: RateLimitBucketUtilization[] = [];

  for (const preset of GLOBAL_PRESETS) {
    const config = RATE_LIMIT_PRESETS[preset];
    const key = `${config.keyPrefix}:global`;

    try {
      const count = await redisClient.get(key);
      const current = count ? parseInt(count as string, 10) : 0;
      results.push({
        preset,
        current,
        limit: config.maxRequests,
        percentUsed: Math.round((current / config.maxRequests) * 100),
        windowMs: config.windowMs,
      });
    } catch {
      results.push({
        preset,
        current: 0,
        limit: config.maxRequests,
        percentUsed: 0,
        windowMs: config.windowMs,
      });
    }
  }

  return results;
}

// ============================================================================
// MAIN RATE LIMIT FUNCTIONS
// ============================================================================

/**
 * Get IP address from request
 */
export function getRequestIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    request.headers.get('x-real-ip') ||
    (request as any).ip ||  // NextRequest doesn't officially have .ip but some environments provide it
    'unknown'
  );
}

/**
 * Check rate limit by IP address
 */
export async function checkRateLimitByIp(
  request: NextRequest,
  preset: keyof typeof RATE_LIMIT_PRESETS
): Promise<RateLimitResult> {
  await initializeRedis();

  const config = RATE_LIMIT_PRESETS[preset];
  const ip = getRequestIp(request);

  return checkRateLimitWithRedis(ip, config);
}

/**
 * Check rate limit by user ID
 */
export async function checkRateLimitByUser(
  userId: string | undefined,
  preset: keyof typeof RATE_LIMIT_PRESETS
): Promise<RateLimitResult> {
  await initializeRedis();

  if (!userId) {
    // Fall back to IP-based if no user
    return { allowed: false, remaining: 0, resetTime: Date.now() };
  }

  const config = RATE_LIMIT_PRESETS[preset];
  return checkRateLimitWithRedis(`user:${userId}`, config);
}

/**
 * Middleware function to apply rate limiting with IP fallback
 * Returns response if rate limited, null otherwise
 * 
 * ENHANCED: Now supports dual-layer rate limiting
 * - Primary: User-based (if authenticated)
 * - Fallback: IP-based (always applied)
 * - Both must pass for request to proceed
 */
export async function withRateLimit(
  request: NextRequest,
  preset: keyof typeof RATE_LIMIT_PRESETS,
  limitBy: 'ip' | 'user' = 'ip',
  userId?: string
): Promise<NextResponse | null> {
  let result: RateLimitResult;

  // Check user-based rate limit if authenticated
  if (limitBy === 'user' && userId) {
    result = await checkRateLimitByUser(userId, preset);
    
    // If user rate limit exceeded, return error
    if (!result.allowed) {
      return NextResponse.json(
        {
          error: 'Rate limit exceeded',
          retryAfter: result.retryAfter,
          limitType: 'user',
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': RATE_LIMIT_PRESETS[preset].maxRequests.toString(),
            'X-RateLimit-Remaining': result.remaining.toString(),
            'X-RateLimit-Reset': new Date(result.resetTime).toISOString(),
            'Retry-After': result.retryAfter?.toString() || '',
            'X-RateLimit-Type': 'user',
          },
        }
      );
    }
    
    // ALSO check IP-based rate limit as additional protection
    const ipResult = await checkRateLimitByIp(request, preset);
    if (!ipResult.allowed) {
      return NextResponse.json(
        {
          error: 'Rate limit exceeded',
          retryAfter: ipResult.retryAfter,
          limitType: 'ip',
          message: 'IP-based rate limit exceeded. This protects against distributed attacks.',
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': RATE_LIMIT_PRESETS[preset].maxRequests.toString(),
            'X-RateLimit-Remaining': ipResult.remaining.toString(),
            'X-RateLimit-Reset': new Date(ipResult.resetTime).toISOString(),
            'Retry-After': ipResult.retryAfter?.toString() || '',
            'X-RateLimit-Type': 'ip',
          },
        }
      );
    }
  } else {
    // If not authenticated or IP-only mode, use IP-based rate limiting
    result = await checkRateLimitByIp(request, preset);
    
    if (!result.allowed) {
      return NextResponse.json(
        {
          error: 'Rate limit exceeded',
          retryAfter: result.retryAfter,
          limitType: 'ip',
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': RATE_LIMIT_PRESETS[preset].maxRequests.toString(),
            'X-RateLimit-Remaining': result.remaining.toString(),
            'X-RateLimit-Reset': new Date(result.resetTime).toISOString(),
            'Retry-After': result.retryAfter?.toString() || '',
            'X-RateLimit-Type': 'ip',
          },
        }
      );
    }
  }

  return null;
}

/**
 * Decorator for rate-limited endpoints
 * Usage:
 * export const POST = rateLimitDecorator('ai_expensive', 'user')(handler);
 */
export function rateLimitDecorator(
  preset: keyof typeof RATE_LIMIT_PRESETS,
  limitBy: 'ip' | 'user' = 'ip'
) {
  return (handler: (request: NextRequest) => Promise<NextResponse>) => {
    return async (request: NextRequest) => {
      // Get user ID from auth if available
      let userId: string | undefined;
      if (limitBy === 'user') {
        // Extract from Supabase auth header or cookie
        const authHeader = request.headers.get('authorization');
        // userId would be extracted from JWT token
        // For now, simplified
      }

      const rateLimitResponse = await withRateLimit(request, preset, limitBy, userId);
      if (rateLimitResponse) return rateLimitResponse;

      return handler(request);
    };
  };
}

/**
 * Initialize rate limiting on startup
 * Call this in a top-level module
 */
export async function initializeRateLimiting() {
  await initializeRedis();
}
