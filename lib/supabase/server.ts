import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createClient as createSupabaseClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import type { Database } from "@/lib/database-aliases";
import { COOKIE_DOMAIN } from "@/lib/cookie-domain";

// Alias for backward compatibility - prefer using createServerSupabaseClient
export const createClient = createServerSupabaseClient;

/**
 * Create a Supabase admin client with service role key
 * This bypasses RLS and should only be used in server-side code
 * for operations that need to access data without user authentication
 */
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing Supabase URL or service role key");
  }

  return createSupabaseClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export async function createServerSupabaseClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name) {
          return cookieStore.get(name)?.value;
        },
        set(name, value, options) {
          try {
            cookieStore.set({ name, value, domain: COOKIE_DOMAIN, ...options });
          } catch {
            // Only log in development
            if (process.env.NODE_ENV === "development") {
            }
          }
        },
        remove(name, options) {
          try {
            cookieStore.set({ name, value: "", domain: COOKIE_DOMAIN, ...options });
          } catch {
            // Only log in development
            if (process.env.NODE_ENV === "development") {
            }
          }
        },
      },
    }
  );
}

/**
 * Secure auth check for API routes.
 *
 * Uses getUser() which verifies the JWT against the Supabase Auth server,
 * ensuring the user is authentic and not banned/deleted.
 */
export async function getAuthUser(
  supabase: SupabaseClient<Database>
): Promise<{ user: User | null; error: Error | null }> {
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) {
      return { user: null, error };
    }
    return { user: user ?? null, error: null };
  } catch (err) {
    return { user: null, error: err instanceof Error ? err : new Error("Auth check failed") };
  }
}

export function createMiddlewareSupabaseClient(
  request: NextRequest,
  response: NextResponse
) {
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name) {
          return request.cookies.get(name)?.value;
        },
        set(name, value, options) {
          try {
            request.cookies.set({ name, value, domain: COOKIE_DOMAIN, ...options });
            response.cookies.set({ name, value, domain: COOKIE_DOMAIN, ...options });
          } catch {
            // Only log in development
            if (process.env.NODE_ENV === "development") {
            }
          }
        },
        remove(name, options) {
          try {
            request.cookies.set({ name, value: "", domain: COOKIE_DOMAIN, ...options });
            response.cookies.set({ name, value: "", domain: COOKIE_DOMAIN, ...options });
          } catch {
            // Only log in development
            if (process.env.NODE_ENV === "development") {
            }
          }
        },
      },
    }
  );
}
