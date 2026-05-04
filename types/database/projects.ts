/**
 * Projects Database Types
 *
 * Exact match to projects table in Supabase.
 */

import type { TaskWithRelations } from './tasks';

/** Exact match to projects table */
export interface ProjectRow {
  id: string;
  project_id: string; // Unique text identifier
  name: string;
  space_id: string | null;
  workspace_id: string | null;
  created_at: string | null;
  updated_at: string | null;
  type: string | null; // 'default' | other types
  external_id: string | null;
  external_data: Record<string, unknown> | null;
  deleted_at: string | null;
}

/** Insert type */
export type ProjectInsert = Omit<ProjectRow, 'id' | 'created_at' | 'updated_at' | 'project_id'> & {
  id?: string;
  project_id?: string;
  created_at?: string;
  updated_at?: string;
};

/** Update type */
export type ProjectUpdate = Partial<Omit<ProjectRow, 'id'>> & { id: string };

/** With joined relations */
export interface ProjectWithRelations extends ProjectRow {
  tasks?: TaskWithRelations[];
}
