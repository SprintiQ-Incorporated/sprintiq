/**
 * CSRF Protection - Client-side utilities
 * 
 * This file contains client-safe CSRF functions that don't use next/headers.
 * Use these in client components ("use client").
 */

const CSRF_CLIENT_TOKEN_NAME = 'csrf_client';
const CSRF_HEADER_NAME = 'x-csrf-token';

/**
 * Client-side: Get CSRF token for requests
 * Reads from the non-httpOnly csrf_client cookie
 */
export function getClientCsrfToken(): string | null {
  if (typeof document === 'undefined') return null;
  
  const cookies = document.cookie.split(';');
  // Look for the client-readable CSRF token
  const csrfCookie = cookies.find(c => c.trim().startsWith(`${CSRF_CLIENT_TOKEN_NAME}=`));
  
  if (!csrfCookie) return null;
  
  return csrfCookie.split('=')[1]?.trim() || null;
}

/**
 * Fetch wrapper with CSRF token
 * Automatically includes x-csrf-token header for state-changing requests
 */
export async function fetchWithCsrf(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const csrfToken = getClientCsrfToken();
  
  const headers = new Headers(options.headers);
  
  if (csrfToken && ['POST', 'PUT', 'DELETE', 'PATCH'].includes(options.method?.toUpperCase() || '')) {
    headers.set(CSRF_HEADER_NAME, csrfToken);
  }

  return fetch(url, {
    ...options,
    headers,
  });
}
