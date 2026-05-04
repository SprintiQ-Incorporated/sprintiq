/**
 * Friendly type aliases for Supabase generated types.
 * Import from here, never from lib/database.types.ts directly.
 * DO NOT hand-edit database.types.ts — it is auto-generated.
 */
import type { Database, Json } from './database.types';

type Row<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row'];

// Core entities
export type Profile = Row<'profiles'> & {
  // Add any specific joined fields if needed
};

export type Workspace = Row<'workspaces'> & {
  spaces?: Space[];
};

export type Role = Row<'roles'>;
export type Level = Row<'levels'>;

export type Space = Row<'spaces'> & {
  projects?: Project[];
  sprint_folders?: SprintFolder[];
};

export type SprintFolder = Row<'sprint_folders'> & {
  sprints: Sprint[];
  sprint_start_day?: Day;
  days?: Day;
};

export type Sprint = Row<'sprints'> & {
  tasks?: Task[];
  sprint_folder?: SprintFolder;
};

export type Project = Row<'projects'> & {
  tasks?: Task[];
};

export type Task = Row<'tasks'> & {
  assignee: Profile | null;
  status: Database["public"]["Tables"]["statuses"]["Row"] | null;
  task_tags: { tag: Database["public"]["Tables"]["tags"]["Row"] }[];
  created_by_profile: Pick<
    Profile,
    "id" | "full_name" | "avatar_url" | "email"
  > | null;
  persona?: Database["public"]["Tables"]["personas"]["Row"] | null;
  task_ai_metadata?: Database["public"]["Tables"]["task_ai_metadata"]["Row"] | null;
  // Dropped from DB schema but still referenced in UI — will be undefined at runtime
  anti_pattern_warnings?: string[] | null;
  success_pattern?: string | null;
};

export type Tag = Row<'tags'>;

export type Status = Row<'statuses'> & {
  status_type?: StatusType;
};

export type StatusType = Row<'status_types'>;
export type TaskAIMetadata = Row<'task_ai_metadata'>;
export type TaskTag = Row<'task_tags'>;

export type Day = Row<'days'>;

export type ClaudeCodeSession = Row<'claude_code_sessions'>;
export type ClaudeCodeIssue = Row<'claude_code_issues'>;

// Hand-maintained compound types
export interface ConflictFieldData {
  sessionStartValue: Json;
  currentValue: Json;
  aiProposedValue: Json;
  autoResolved: boolean;
}

export interface ConflictData {
  fields: Record<string, ConflictFieldData>;
  taskUpdatedAt: string;
  sessionStartedAt: string;
  detectedAt: string;
}

export interface TaskSnapshot {
  status_id: string;
  assignee_id: string | null;
  description: string | null;
  story_points: number | null;
  estimated_time: number | null;
  updated_at: string;
}

export type Persona = Row<'personas'> & {
  created_by_profile?: Pick<
    Profile,
    "id" | "full_name" | "avatar_url" | "email"
  >;
  techSavviness?: number;
  usageFrequency?: "daily" | "weekly" | "monthly";
  priorityLevel?: "high" | "medium" | "low";
  role?: string;
  domain?: string;
  tawosPatterns?: Record<string, unknown> | null;
  autoDetected?: boolean;
  project_personas?: ProjectPersona[];
  projects?: Project[];
};

export type ProjectPersona = Row<'project_personas'> & {
  project?: Project;
  persona?: Persona;
};

export type Insight = Row<'insights'>;

// Surviving auxiliary tables
export type StoryGenerationSession = Row<'story_generation_sessions'>;
export type TaskStatusHistory = Row<'task_status_history'>;
export type SprintMetrics = Row<'sprint_metrics'>;
export type TaskBlock = Row<'task_blocks'>;

// Additional table types
export type RateLimit = Row<'rate_limits'>;
export type SecurityAuditLog = Row<'security_audit_log'>;
export type TawosUserStory = Row<'tawos_user_stories'>;
export type Timezone = Row<'timezones'>;

// Re-export Database type and Json for consumers that need it
export type { Database, Json } from './database.types';
export type SupabaseDatabase = Database;
