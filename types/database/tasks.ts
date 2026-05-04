/**
 * Tasks Database Types
 *
 * Exact match to tasks table in Supabase.
 * Tasks are also used as "stories" in the agile context.
 */

import type { StatusRow } from './statuses';
import type { ProfileRow } from './profiles';
import type { PersonaRow } from './personas';
import type { ProjectRow } from './projects';
import type { SprintRow } from './sprints';

/** Exact match to tasks table */
export interface TaskRow {
  id: string;
  task_id: string; // Unique text identifier
  name: string;
  description: string | null;
  priority: string | null; // 'low' | 'medium' | 'high' | 'critical'
  assignee_id: string | null;      // FK to profiles.id (user assignment)
  project_id: string | null;
  space_id: string | null;
  workspace_id: string | null;
  due_date: string | null;
  created_at: string | null;
  updated_at: string | null;
  status_id: string;               // NOT NULL - FK to statuses.id
  start_date: string | null;
  parent_task_id: string | null;   // Self-reference for subtasks
  created_by: string | null;       // FK to profiles.id
  sprint_id: string | null;
  type: string | null;             // 'default' | 'story' | 'bug' | 'task'
  external_id: string | null;
  external_data: Record<string, unknown> | null;

  // Scoring and estimation fields
  story_points: number | null;
  estimated_time: number | null;   // numeric
  business_value: number | null;
  velocity: number | null;         // numeric
  user_impact: number | null;
  complexity: number | null;
  risk: number | null;
  dependency_score: number | null;

  // AI flag (detailed metadata in task_ai_metadata table)
  deleted_at: string | null;
  persona_id: string | null;
  generated_by_ai: boolean;

  backlog_position: number;

  updated_by?: string | null;

  // Analytics fields
  completion_rate?: number | null;
  anti_pattern_warnings?: string[] | null;
  success_pattern?: string | null;

  // Position for ordering
  position?: number;
}

/** Exact match to task_ai_metadata table */
export interface TaskAIMetadataRow {
  task_id: string;
  ai_generation_metadata: Record<string, unknown>;
  generation_session_id: string | null;
  ai_priority_applied: boolean;
  ai_priority_applied_at: string | null;
  ai_priority_confidence: number | null;
  ai_priority_reasoning: string | null;
  ai_assigned: boolean;
  ai_assignment_confidence: number | null;
  ai_assignment_reasoning: string | null;
  ai_assignment_date: string | null;
  embedding: number[] | null;
  created_at: string | null;
  updated_at: string | null;
}

/** Insert type */
export type TaskInsert = Omit<TaskRow, 'id' | 'created_at' | 'updated_at' | 'task_id'> & {
  id?: string;
  task_id?: string;
  created_at?: string;
  updated_at?: string;
};

/** Update type */
export type TaskUpdate = Partial<Omit<TaskRow, 'id'>> & { id: string };

/** With joined relations */
export interface TaskWithRelations extends TaskRow {
  status: StatusRow | null;
  project?: ProjectRow | null;
  sprint?: SprintRow | null;
  assignee?: ProfileRow | null;
  persona?: PersonaRow | null;
  created_by_profile?: Pick<ProfileRow, 'id' | 'full_name' | 'avatar_url' | 'email'> | null;
  task_tags?: Array<{ tag: { id: string; name: string; color: string | null } }>;
  task_ai_metadata?: TaskAIMetadataRow | null;
}

/** Alias for Story (tasks used as stories) */
export type StoryRow = TaskRow;
export type StoryInsert = TaskInsert;
export type StoryUpdate = TaskUpdate;
export type StoryWithRelations = TaskWithRelations;
