/**
 * Profiles Database Types
 *
 * Exact match to profiles table in Supabase.
 */

/** User role in the system */
export type UserRole = 'user' | 'admin';

/** Exact match to profiles table */
export interface ProfileRow {
  id: string; // FK to auth.users.id
  updated_at: string | null;
  created_at: string | null;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  email: string | null;
  company: string | null;
  language: string | null; // Default 'English'
  timezone: string | null; // FK to timezones.id (uuid)
  role: UserRole | null;   // System role, default 'user'

  // Locale / formatting preferences (kept after OSS reduction)
  start_of_week: string | null;
  time_format: string | null;
  date_format: string | null;
}

/** Insert type */
export type ProfileInsert = Omit<ProfileRow, 'created_at' | 'updated_at'> & {
  created_at?: string;
  updated_at?: string;
};

/** Update type */
export type ProfileUpdate = Partial<Omit<ProfileRow, 'id'>> & { id: string };

/** Minimal profile for display */
export type ProfileMinimal = Pick<ProfileRow, 'id' | 'full_name' | 'avatar_url' | 'email'>;
