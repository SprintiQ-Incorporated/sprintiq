/**
 * Workspaces Database Types
 *
 * Exact match to workspaces table in Supabase.
 */

import type { SpaceRow } from './spaces';

/** Exact match to workspaces table */
export interface WorkspaceRow {
  id: string;
  name: string;
  created_at: string | null;
  updated_at: string | null;
  owner_id: string; // FK to auth.users.id
  purpose: string;
  type: string;
  category: string;
  workspace_id: string; // Unique text identifier
  deleted_at: string | null;
}

/** Insert type */
export type WorkspaceInsert = Omit<WorkspaceRow, 'id' | 'created_at' | 'updated_at' | 'workspace_id'> & {
  id?: string;
  workspace_id?: string;
  created_at?: string;
  updated_at?: string;
};

/** Update type */
export type WorkspaceUpdate = Partial<Omit<WorkspaceRow, 'id'>> & { id: string };

/** With joined relations */
export interface WorkspaceWithRelations extends WorkspaceRow {
  spaces?: SpaceRow[];
}
