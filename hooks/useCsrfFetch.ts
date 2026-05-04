"use client";

/**
 * CSRF-Protected Fetch Hook
 *
 * Provides a fetch wrapper that automatically includes CSRF tokens
 * for all state-changing requests (POST, PUT, DELETE, PATCH).
 */

import { useCallback } from "react";

const CSRF_CLIENT_TOKEN_NAME = 'csrf_client';
const CSRF_HEADER_NAME = 'x-csrf-token';

/**
 * Get CSRF token from the client-readable cookie
 */
function getClientCsrfToken(): string | null {
  if (typeof document === 'undefined') return null;

  const cookies = document.cookie.split(';');
  const csrfCookie = cookies.find(c => c.trim().startsWith(`${CSRF_CLIENT_TOKEN_NAME}=`));

  if (!csrfCookie) return null;

  return csrfCookie.split('=')[1]?.trim() || null;
}

/**
 * Fetch with automatic CSRF token inclusion
 *
 * @param url - The URL to fetch
 * @param options - Fetch options (method, headers, body, etc.)
 * @returns Promise<Response>
 */
export async function csrfFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const csrfToken = getClientCsrfToken();
  const method = options.method?.toUpperCase() || 'GET';

  // Only add CSRF token for state-changing methods
  const needsCsrf = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method);

  if (needsCsrf && !csrfToken) {
    console.error('[csrfFetch] CRITICAL: CSRF token missing for', method, 'request to', url);
  }

  // Build headers explicitly - ensure Content-Type is set for POST/PUT/PATCH
  const headers: Record<string, string> = {
    'Accept': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (needsCsrf && csrfToken) {
    headers[CSRF_HEADER_NAME] = csrfToken;
  }

  // Build absolute URL to ensure correct routing
  const absoluteUrl = url.startsWith('/') && typeof window !== 'undefined'
    ? `${window.location.origin}${url}`
    : url;


  // 60s in production; longer in dev so cold-compile of a Next.js route
  // (which can run minutes on the first hit) doesn't get aborted mid-flight.
  const timeoutMs = process.env.NODE_ENV === 'production' ? 60_000 : 300_000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    console.error(`[csrfFetch] TIMEOUT after ${timeoutMs / 1000} seconds - aborting`);
    controller.abort();
  }, timeoutMs);

  try {
    const startTime = Date.now();

    const response = await fetch(absoluteUrl, {
      method: options.method || 'GET',
      headers,
      body: options.body,
      credentials: 'include',
      // Note: Don't use mode: 'same-origin' - it can cause silent failures in
      // production environments with CDNs/proxies where origin detection is tricky.
      // The default mode ('cors') works for same-origin requests without issues.
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const duration = Date.now() - startTime;
    return response;
  } catch (fetchError) {
    clearTimeout(timeoutId);

    if (fetchError instanceof Error) {
      if (fetchError.name === 'AbortError') {
        console.error('[csrfFetch] Request was aborted (timeout or manual abort)');
        throw new Error('Request timed out. Please check your connection and try again.');
      }
      console.error('[csrfFetch] FETCH ERROR:', fetchError.name, fetchError.message);
    } else {
      console.error('[csrfFetch] FETCH ERROR (unknown):', fetchError);
    }
    throw fetchError;
  }
}

/**
 * Hook that provides CSRF-protected fetch functions
 * 
 * @example
 * const { post, put, del, patch } = useCsrfFetch();
 * 
 * // POST request
 * const response = await post('/api/workspace/create', { name: 'My Workspace' });
 * 
 * // DELETE request
 * await del(`/api/workspace/${id}/teams/${teamId}/members/${memberId}`);
 */
export function useCsrfFetch() {
  /**
   * Make a POST request with CSRF token
   */
  const post = useCallback(async <T = unknown>(
    url: string,
    data?: T,
    options: Omit<RequestInit, 'method' | 'body'> = {}
  ): Promise<Response> => {
    return csrfFetch(url, {
      ...options,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers as Record<string, string>),
      },
      body: data ? JSON.stringify(data) : undefined,
    });
  }, []);

  /**
   * Make a PUT request with CSRF token
   */
  const put = useCallback(async <T = unknown>(
    url: string,
    data?: T,
    options: Omit<RequestInit, 'method' | 'body'> = {}
  ): Promise<Response> => {
    return csrfFetch(url, {
      ...options,
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers as Record<string, string>),
      },
      body: data ? JSON.stringify(data) : undefined,
    });
  }, []);

  /**
   * Make a PATCH request with CSRF token
   */
  const patch = useCallback(async <T = unknown>(
    url: string,
    data?: T,
    options: Omit<RequestInit, 'method' | 'body'> = {}
  ): Promise<Response> => {
    return csrfFetch(url, {
      ...options,
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers as Record<string, string>),
      },
      body: data ? JSON.stringify(data) : undefined,
    });
  }, []);

  /**
   * Make a DELETE request with CSRF token
   */
  const del = useCallback(async (
    url: string,
    options: Omit<RequestInit, 'method'> = {}
  ): Promise<Response> => {
    return csrfFetch(url, {
      ...options,
      method: 'DELETE',
    });
  }, []);

  /**
   * Make a GET request (no CSRF needed, but included for completeness)
   */
  const get = useCallback(async (
    url: string,
    options: Omit<RequestInit, 'method'> = {}
  ): Promise<Response> => {
    return fetch(url, {
      ...options,
      method: 'GET',
      credentials: 'include', // Include cookies for authentication
    });
  }, []);

  return {
    post,
    put,
    patch,
    del,
    get,
    csrfFetch,
  };
}

export default useCsrfFetch;
