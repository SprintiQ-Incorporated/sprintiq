/**
 * Roles Database Types
 *
 * Exact match to roles table in Supabase.
 * Roles are job roles like "Developer", "Designer", etc.
 */

/** Exact match to roles table */
export interface RoleRow {
  id: string;
  name: string;
  description: string | null;
  created_at: string | null;
  updated_at: string | null;
  experience: string | null;
  core_competencies: Record<string, string[]> | null; // jsonb
  category: string | null;
  is_template: boolean | null;
  template_data: Record<string, unknown> | null; // jsonb
  created_by: string | null; // FK to profiles.id
  workspace_id: string | null;
  deleted_at: string | null; // Soft delete timestamp
}

/** Insert type */
export type RoleInsert = Omit<RoleRow, 'id' | 'created_at' | 'updated_at' | 'deleted_at'> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
  deleted_at?: string | null;
};

/** Update type */
export type RoleUpdate = Partial<Omit<RoleRow, 'id'>> & { id: string };

/** Exact match to levels table */
export interface LevelRow {
  id: string;
  name: string; // 'Junior' | 'Mid-Level' | 'Senior' | 'Lead' | 'Principal' | etc.
  description: string | null;
  created_at: string | null;
  updated_at: string | null;
}

/** Insert type */
export type LevelInsert = Omit<LevelRow, 'id' | 'created_at' | 'updated_at'> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
};

/** Update type */
export type LevelUpdate = Partial<Omit<LevelRow, 'id'>> & { id: string };

/** Standard level names in the database */
export type StandardLevelName =
  | 'Junior'
  | 'Mid-Level'
  | 'Senior'
  | 'Lead'
  | 'Principal'
  | 'Architect'
  | 'Manager'
  | 'Director'
  | 'VP'
  | 'C-Level';
