"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/database-aliases";

/**
 * Navigator lock wrapper for deduplicating token refresh across tabs.
 * Equivalent to @supabase/auth-js navigatorLock but avoids importing
 * the transitive dependency directly (not hoisted by pnpm).
 */
async function navigatorLock<R>(
  name: string,
  acquireTimeout: number,
  fn: () => Promise<R>
): Promise<R> {
  if (
    typeof globalThis !== "undefined" &&
    globalThis.navigator?.locks
  ) {
    return await globalThis.navigator.locks.request(
      name,
      { mode: "exclusive" },
      async () => fn()
    );
  }
  // Fallback: no lock API available (SSR, older browsers)
  return await fn();
}

// ---------------------------------------------------------------------------
// Circuit breaker + exponential backoff for Supabase auth 429 responses
// ---------------------------------------------------------------------------

const BACKOFF_INITIAL_MS = 1000;
const BACKOFF_MAX_MS = 30_000;
const CIRCUIT_OPEN_DURATION_MS = 60_000;
const CIRCUIT_OPEN_THRESHOLD = 5; // consecutive 429s before opening

let consecutive429Count = 0;
let circuitOpenUntil = 0; // timestamp when circuit closes again
let currentBackoffMs = BACKOFF_INITIAL_MS;

/** Dispatch a custom event so the UI can show "reconnecting…" state */
function dispatchCircuitEvent(open: boolean) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("supabase-auth-circuit", { detail: { open } })
    );
  }
}

/**
 * Wraps the global fetch for the Supabase client.
 * Intercepts 429 responses on the auth token endpoint and applies
 * exponential backoff with jitter + a circuit breaker.
 */
async function fetchWithBackoff(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  const isTokenRefresh = url.includes("/auth/v1/token");

  // If this is a token refresh and the circuit is open, reject immediately
  if (isTokenRefresh && Date.now() < circuitOpenUntil) {
    return new Response(
      JSON.stringify({ error: "auth_circuit_open", message: "Auth refresh paused — retrying shortly" }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    );
  }

  const response = await fetch(input, init);

  if (isTokenRefresh && response.status === 429) {
    consecutive429Count++;

    if (consecutive429Count >= CIRCUIT_OPEN_THRESHOLD) {
      // Open the circuit breaker
      circuitOpenUntil = Date.now() + CIRCUIT_OPEN_DURATION_MS;
      dispatchCircuitEvent(true);

      // Schedule circuit close + reset
      setTimeout(() => {
        circuitOpenUntil = 0;
        consecutive429Count = 0;
        currentBackoffMs = BACKOFF_INITIAL_MS;
        dispatchCircuitEvent(false);
      }, CIRCUIT_OPEN_DURATION_MS);
    }

    // Apply exponential backoff with jitter before letting the caller retry
    const jitter = Math.random() * currentBackoffMs * 0.5;
    const delay = currentBackoffMs + jitter;
    currentBackoffMs = Math.min(currentBackoffMs * 2, BACKOFF_MAX_MS);

    await new Promise((resolve) => setTimeout(resolve, delay));

    return response;
  }

  // Successful auth response — reset backoff state
  if (isTokenRefresh && response.ok) {
    consecutive429Count = 0;
    currentBackoffMs = BACKOFF_INITIAL_MS;
    if (circuitOpenUntil > 0) {
      circuitOpenUntil = 0;
      dispatchCircuitEvent(false);
    }
  }

  return response;
}

// Create a singleton to prevent multiple instances
let supabase: ReturnType<typeof createBrowserClient<Database>> | undefined;

export function createClientSupabaseClient() {
  if (supabase) return supabase;

  supabase = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        // Use navigator.locks API to deduplicate token refresh across tabs/components.
        // This prevents multiple concurrent refresh requests that trigger 429 rate limits.
        lock: navigatorLock,
        // Use PKCE flow for more robust token handling
        flowType: "pkce",
      },
      global: {
        fetch: fetchWithBackoff,
      },
    }
  );

  return supabase;
}
