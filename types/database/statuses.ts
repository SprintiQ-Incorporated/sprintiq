/**
 * Statuses Database Types
 *
 * Exact match to statuses table in Supabase.
 */

/** Status type values */
export type StatusTypeName = 'todo' | 'in_progress' | 'done' | 'blocked' | 'review';

/** Exact match to statuses table */
export interface StatusRow {
  id: string;
  status_id: string; // Unique text identifier
  name: string;
  color: string | null; // Default 'blue'
  position: number | null; // Default 0
  workspace_id: string | null;
  created_at: string | null;
  updated_at: string | null;
  type: string | null; // Default 'workspace'
  project_id: string | null;
  space_id: string | null;
  sprint_id: string | null;
  status_type_id: string | null; // FK to status_types.id
  is_default: boolean | null;
  deleted_at: string | null;
}

/** Insert type */
export type StatusInsert = Omit<StatusRow, 'id' | 'created_at' | 'updated_at' | 'status_id'> & {
  id?: string;
  status_id?: string;
  created_at?: string;
  updated_at?: string;
};

/** Update type */
export type StatusUpdate = Partial<Omit<StatusRow, 'id'>> & { id: string };

/** With joined status type */
export interface StatusWithType extends StatusRow {
  status_type?: StatusTypeRow | null;
}

/** Exact match to status_types table */
export interface StatusTypeRow {
  id: string;
  name: StatusTypeName;
  created_at: string | null;
  updated_at: string | null;
}

/** Insert type */
export type StatusTypeInsert = Omit<StatusTypeRow, 'id' | 'created_at' | 'updated_at'> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
};
