/**
 * Server-side Supabase Admin Client
 * 
 * Uses service_role key to bypass RLS policies.
 * ONLY use this for trusted server-side operations.
 * NEVER expose service_role key to client.
 */

import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database-aliases';

/**
 * Create admin Supabase client with service role key
 * Bypasses ALL RLS policies - use with extreme caution
 */
export const createAdminClient = () => {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL environment variable');
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable');
  }

  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
};

/**
 * Verify user authentication server-side
 * Use this before any admin operations to ensure user is authenticated
 */
export async function verifyServerAuth(authHeader?: string): Promise<string | null> {
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);
  const supabase = createAdminClient();

  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error || !user) {
    return null;
  }

  return user.id;
}
