/**
 * CSRF Protection Implementation - Server-side
 * Prevents Cross-Site Request Forgery attacks using Double-Submit Cookie Pattern
 * 
 * Pattern: Store token in httpOnly cookie (for server verification) AND
 * a non-httpOnly cookie (for client to read and send in header)
 * 
 * NOTE: This file uses next/headers and can ONLY be imported in:
 * - Server Components
 * - API Routes
 * - Middleware
 * 
 * For client components, import from '@/lib/csrf-client' instead.
 */

import 'server-only';
import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';
import { debugLog } from './debug-logger';

// Re-export client functions for convenience in server contexts
export { getClientCsrfToken, fetchWithCsrf } from './csrf-client';

import { COOKIE_DOMAIN } from './cookie-domain';

const CSRF_TOKEN_NAME = 'csrf_token';          // httpOnly - server verification
const CSRF_CLIENT_TOKEN_NAME = 'csrf_client';  // non-httpOnly - client readable
const CSRF_HEADER_NAME = 'x-csrf-token';

/**
 * Generate a cryptographically secure CSRF token
 */
export function generateCsrfToken(): string {
  if (typeof window !== 'undefined') {
    // Client-side: use crypto.randomUUID
    return crypto.randomUUID();
  } else {
    // Server-side: use Node.js crypto
    const crypto = require('crypto');
    return crypto.randomBytes(32).toString('hex');
  }
}

/**
 * Set CSRF token in cookies (server-side)
 * Sets both httpOnly (for verification) and non-httpOnly (for client to read) cookies
 */
export async function setCsrfToken(): Promise<string> {
  const token = generateCsrfToken();
  const cookieStore = await cookies();

  // httpOnly cookie for server-side verification
  cookieStore.set(CSRF_TOKEN_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24, // 24 hours
    path: '/',
    domain: COOKIE_DOMAIN,
  });

  // Non-httpOnly cookie for client-side reading
  cookieStore.set(CSRF_CLIENT_TOKEN_NAME, token, {
    httpOnly: false,  // Client can read this
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24, // 24 hours
    path: '/',
    domain: COOKIE_DOMAIN,
  });

  return token;
}

/**
 * Get CSRF token from cookies (server-side)
 */
export async function getCsrfToken(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get(CSRF_TOKEN_NAME)?.value;
}

/**
 * Verify CSRF token from request
 */
export async function verifyCsrfToken(request: NextRequest): Promise<boolean> {
  // Only verify for state-changing methods
  if (!['POST', 'PUT', 'DELETE', 'PATCH'].includes(request.method)) {
    return true;
  }

  const tokenFromHeader = request.headers.get(CSRF_HEADER_NAME);
  const cookieStore = await cookies();
  const tokenFromCookie = cookieStore.get(CSRF_TOKEN_NAME)?.value;

  debugLog('[verifyCsrfToken] Checking CSRF:', {
    method: request.method,
    headerToken: tokenFromHeader ? `${tokenFromHeader.substring(0, 8)}...` : 'MISSING',
    cookieToken: tokenFromCookie ? `${tokenFromCookie.substring(0, 8)}...` : 'MISSING',
    match: tokenFromHeader && tokenFromCookie ? tokenFromHeader === tokenFromCookie : false,
  });

  if (!tokenFromHeader || !tokenFromCookie) {
    debugLog('[verifyCsrfToken] FAILED: Missing token(s)');
    return false;
  }

  const valid = tokenFromHeader === tokenFromCookie;
  if (!valid) {
    debugLog('[verifyCsrfToken] FAILED: Token mismatch');
  }
  return valid;
}
