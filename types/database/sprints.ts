/**
 * Sprints Database Types
 *
 * Exact match to sprints table in Supabase.
 */

import type { TaskWithRelations } from './tasks';

/** Sprint status values */
export type SprintStatus = 'planned' | 'active' | 'completed';

/** Exact match to sprints table */
export interface SprintRow {
  id: string;
  sprint_id: string; // Unique text identifier
  name: string;
  goal: string | null;
  task_id: string | null; // FK to tasks.id (deprecated?)
  start_date: string | null; // date type
  end_date: string | null;   // date type
  sprint_folder_id: string;  // NOT NULL - FK to sprint_folders.id
  space_id: string;          // NOT NULL
  created_at: string | null;
  updated_at: string | null;
  duration: number | null;   // Default 0
  deleted_at: string | null;
  workspace_id: string | null;
  status: SprintStatus | null; // 'planned' | 'active' | 'completed'
}

/** Insert type */
export type SprintInsert = Omit<SprintRow, 'id' | 'created_at' | 'updated_at' | 'sprint_id'> & {
  id?: string;
  sprint_id?: string;
  created_at?: string;
  updated_at?: string;
};

/** Update type */
export type SprintUpdate = Partial<Omit<SprintRow, 'id'>> & { id: string };

/** With joined relations */
export interface SprintWithRelations extends SprintRow {
  tasks?: TaskWithRelations[];
  sprint_folder?: {
    id: string;
    name: string;
    sprint_folder_id: string;
    duration_week: number;
  } | null;
}

/** Exact match to sprint_folders table */
export interface SprintFolderRow {
  id: string;
  sprint_folder_id: string;
  name: string;
  sprint_start_day_id: string | null;
  duration_week: number;
  space_id: string;
  project_id: string | null;
  created_at: string | null;
  updated_at: string | null;
  deleted_at: string | null;
}

/** Insert type */
export type SprintFolderInsert = Omit<SprintFolderRow, 'id' | 'created_at' | 'updated_at' | 'sprint_folder_id'> & {
  id?: string;
  sprint_folder_id?: string;
  created_at?: string;
  updated_at?: string;
};

/** Update type */
export type SprintFolderUpdate = Partial<Omit<SprintFolderRow, 'id'>> & { id: string };

/** With joined sprints */
export interface SprintFolderWithSprints extends SprintFolderRow {
  sprints?: SprintWithRelations[];
  sprint_start_day?: { id: string; name: string } | null;
}
