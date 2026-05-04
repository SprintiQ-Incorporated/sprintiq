/**
 * Optimized column selections for Supabase queries
 *
 * This file defines the minimum columns needed for each table to avoid SELECT *
 * which can fetch unnecessary data (especially large columns like embeddings).
 *
 * Usage:
 *   import { COLUMNS } from '@/lib/query-columns';
 *   const { data } = await supabase.from('tasks').select(COLUMNS.TASKS_CORE);
 *
 * @see https://supabase.com/docs/guides/database/performance
 */

// ============================================================================
// WORKSPACES
// ============================================================================
export const WORKSPACE_COLUMNS = {
  /** Core workspace fields for display. */
  CORE: 'id, workspace_id, name, owner_id, purpose, type, category, created_at, updated_at, deleted_at',
  /** Minimal workspace identification */
  MINIMAL: 'id, workspace_id, name',
} as const;

// ============================================================================
// PROFILES
// ============================================================================
export const PROFILE_COLUMNS = {
  /** Display fields (name, avatar) */
  DISPLAY: 'id, username, full_name, avatar_url, email',
  /** Core profile fields */
  CORE: 'id, username, full_name, avatar_url, email, company, role, timezone, created_at, updated_at',
  /** Full profile with preferences */
  WITH_PREFERENCES: 'id, username, full_name, avatar_url, email, company, role, language, timezone, start_of_week, time_format, date_format, created_at, updated_at',
} as const;

// ============================================================================
// TASKS / STORIES
// ============================================================================
export const TASK_COLUMNS = {
  /** Core task fields for list views (excludes embedding, external_data, ai_metadata) */
  CORE: 'id, task_id, name, description, priority, assignee_id, project_id, sprint_id, space_id, workspace_id, start_date, due_date, created_at, updated_at, status_id, parent_task_id, created_by, updated_by, type, story_points, estimated_time, backlog_position, position, deleted_at',
  /** Task fields with priority scores (AI priority data now in task_ai_metadata) */
  WITH_PRIORITY: 'id, task_id, name, description, priority, assignee_id, project_id, sprint_id, space_id, workspace_id, start_date, due_date, created_at, updated_at, status_id, parent_task_id, created_by, updated_by, type, story_points, estimated_time, business_value, user_impact, complexity, risk, dependency_score, dependencies, backlog_position, position, deleted_at',
  /** Task with fields for AI assignment context (AI assignment data now in task_ai_metadata) */
  WITH_AI_ASSIGNMENT: 'id, task_id, name, description, priority, assignee_id, project_id, sprint_id, space_id, workspace_id, start_date, due_date, created_at, updated_at, status_id, parent_task_id, created_by, updated_by, type, story_points, estimated_time, position, deleted_at',
  /** Minimal task for counts and references */
  MINIMAL: 'id, task_id, name, status_id, sprint_id, project_id, space_id, workspace_id',
  /** Task fields needed for export */
  EXPORT: 'id, task_id, name, description, priority, assignee_id, project_id, sprint_id, space_id, workspace_id, start_date, due_date, created_at, updated_at, status_id, parent_task_id, created_by, type, story_points, estimated_time, business_value, user_impact, complexity, risk, persona_id',
} as const;

// ============================================================================
// TASK AI METADATA
// ============================================================================
export const TASK_AI_METADATA_COLUMNS = {
  /** All metadata fields (excludes embedding) */
  CORE: 'task_id, ai_generation_metadata, generation_session_id, ai_priority_applied, ai_priority_applied_at, ai_priority_confidence, ai_priority_reasoning, ai_assigned, ai_assignment_confidence, ai_assignment_reasoning, ai_assignment_date, created_at, updated_at',
  /** Priority scoring fields only */
  PRIORITY: 'task_id, ai_priority_applied, ai_priority_applied_at, ai_priority_confidence, ai_priority_reasoning',
  /** Assignment fields only */
  ASSIGNMENT: 'task_id, ai_assigned, ai_assignment_confidence, ai_assignment_reasoning, ai_assignment_date',
  /** Generation fields only */
  GENERATION: 'task_id, ai_generation_metadata, generation_session_id',
} as const;

// ============================================================================
// SPRINTS
// ============================================================================
export const SPRINT_COLUMNS = {
  /** Core sprint fields */
  CORE: 'id, sprint_id, name, goal, start_date, end_date, sprint_folder_id, space_id, workspace_id, status, task_id, project_id, duration, created_at, updated_at, deleted_at',
  /** Minimal sprint identification */
  MINIMAL: 'id, sprint_id, name, start_date, end_date, status',
  /** Sprint for list displays */
  LIST: 'id, sprint_id, name, goal, start_date, end_date, status, sprint_folder_id, space_id',
} as const;

// ============================================================================
// SPRINT FOLDERS
// ============================================================================
export const SPRINT_FOLDER_COLUMNS = {
  /** Core sprint folder fields */
  CORE: 'id, sprint_folder_id, name, sprint_start_day_id, duration_week, space_id, project_id, created_at, updated_at, deleted_at',
  /** Minimal sprint folder */
  MINIMAL: 'id, sprint_folder_id, name, space_id',
} as const;

// ============================================================================
// SPACES
// ============================================================================
export const SPACE_COLUMNS = {
  /** Core space fields */
  CORE: 'id, space_id, name, description, icon, is_private, workspace_id, created_at, updated_at, deleted_at, risk_level, portfolio_status, color, progress, due_date, portfolio_metadata',
  /** Space with portfolio data */
  WITH_PORTFOLIO: 'id, space_id, name, description, icon, is_private, workspace_id, created_at, updated_at, deleted_at, risk_level, portfolio_status, color, progress, due_date, portfolio_metadata',
  /** Minimal space */
  MINIMAL: 'id, space_id, name, workspace_id',
} as const;

// ============================================================================
// STATUSES
// ============================================================================
export const STATUS_COLUMNS = {
  /** Core status fields */
  CORE: 'id, status_id, name, color, position, workspace_id, type, status_type_id, project_id, space_id, sprint_id, is_default, created_at, updated_at, deleted_at',
  /** Status for display (includes all fields for type compatibility) */
  DISPLAY: 'id, status_id, name, color, position, workspace_id, type, status_type_id, project_id, space_id, sprint_id, is_default, created_at, updated_at, deleted_at',
  /** Status with sync info (integration columns to be added via migration when needed) */
  WITH_SYNC: 'id, status_id, name, color, position, workspace_id, type, status_type_id, project_id, space_id, sprint_id, is_default, created_at, updated_at, deleted_at',
} as const;

// ============================================================================
// WORKSPACE MEMBERS
// ============================================================================
export const WORKSPACE_MEMBER_COLUMNS = {
  /** Core workspace member fields */
  CORE: 'id, workspace_id, user_id, email, role, status, invited_at, joined_at',
  /** For access checks */
  ACCESS_CHECK: 'id, workspace_id, user_id, role, status',
  /** With invite info */
  WITH_INVITE: 'id, workspace_id, user_id, email, role, status, invited_at, joined_at, invite_token, invited_by',
} as const;

// ============================================================================
// TEAM MEMBERS
// ============================================================================
export const TEAM_MEMBER_COLUMNS = {
  /** Core team member fields */
  CORE: 'id, team_id, user_id, email, name, role_id, level_id, weekly_hours, workspace_id, is_registered, skills, experience_level, created_at, deleted_at',
  /** Team member for display */
  DISPLAY: 'id, team_id, user_id, email, name, role_id, level_id, is_registered',
  /** Team member with account info */
  WITH_ACCOUNT: 'id, team_id, user_id, email, name, role_id, level_id, weekly_hours, workspace_id, is_registered, skills, experience_level',
} as const;

// ============================================================================
// TEAMS
// ============================================================================
export const TEAM_COLUMNS = {
  /** Core team fields */
  CORE: 'id, name, description, workspace_id, created_at, updated_at, deleted_at',
  /** Minimal team */
  MINIMAL: 'id, name, workspace_id',
} as const;

// ============================================================================
// ROLES
// ============================================================================
export const ROLE_COLUMNS = {
  /** Core role fields */
  CORE: 'id, name, description, category, experience, core_competencies, created_at, updated_at, deleted_at, workspace_id',
  /** Role for display */
  DISPLAY: 'id, name, description, category',
  /** Role with template info */
  WITH_TEMPLATE: 'id, name, description, category, experience, core_competencies, is_template, template_data, created_by, workspace_id',
} as const;

// ============================================================================
// LEVELS
// ============================================================================
export const LEVEL_COLUMNS = {
  /** All level fields (small table) */
  ALL: 'id, name, description, created_at, updated_at',
  /** Level for display */
  DISPLAY: 'id, name, description',
} as const;

// ============================================================================
// PROJECTS
// ============================================================================
export const PROJECT_COLUMNS = {
  /** Core project fields */
  CORE: 'id, project_id, name, space_id, workspace_id, type, external_id, external_data, created_at, updated_at, deleted_at',
  /** Project with sync info */
  WITH_SYNC: 'id, project_id, name, space_id, workspace_id, type, external_id, external_data, created_at, updated_at, deleted_at',
} as const;

// ============================================================================
// TAGS
// ============================================================================
export const TAG_COLUMNS = {
  /** All tag fields (small table) */
  ALL: 'id, tag_id, name, color, workspace_id, created_at, updated_at, canonical_tag_id, aliases, deleted_at',
  /** Tag for display */
  DISPLAY: 'id, tag_id, name, color',
} as const;

// ============================================================================
// PERSONAS
// ============================================================================
export const PERSONA_COLUMNS = {
  /** Core persona fields */
  CORE: 'id, persona_id, name, description, workspace_id, created_by, tech_savviness, usage_frequency, priority_level, role, domain, created_at, updated_at, deleted_at',
  /** Persona with TAWOS patterns */
  WITH_PATTERNS: 'id, persona_id, name, description, workspace_id, created_by, tech_savviness, usage_frequency, priority_level, role, domain, tawos_patterns, auto_detected, created_at, updated_at, deleted_at',
} as const;

// ============================================================================
// CLAUDE CODE SESSIONS
// ============================================================================
export const CLAUDE_CODE_SESSION_COLUMNS = {
  /** All fields — UI consumes the full row via ClaudeCodeSession type */
  CORE: 'id, task_id, workspace_id, user_id, status, session_token, task_context, error_message, last_heartbeat_at, started_at, completed_at, expires_at, created_at, updated_at, heartbeat_sequence, session_metrics, conflict_detected, conflict_data, conflict_resolved_at, conflict_resolution, is_late_arrival, task_snapshot_at_start, completion_report, developer_notes, proposed_status, ac_met, ac_total, bugs_detected, tech_debt_detected, subtasks_created, status_accepted, late_arrival_reported_status, source',
} as const;

// ============================================================================
// COMBINED EXPORTS (for convenience)
// ============================================================================
export const COLUMNS = {
  WORKSPACES: WORKSPACE_COLUMNS,
  PROFILES: PROFILE_COLUMNS,
  TASKS: TASK_COLUMNS,
  TASK_AI_METADATA: TASK_AI_METADATA_COLUMNS,
  SPRINTS: SPRINT_COLUMNS,
  SPRINT_FOLDERS: SPRINT_FOLDER_COLUMNS,
  SPACES: SPACE_COLUMNS,
  STATUSES: STATUS_COLUMNS,
  WORKSPACE_MEMBERS: WORKSPACE_MEMBER_COLUMNS,
  TEAM_MEMBERS: TEAM_MEMBER_COLUMNS,
  TEAMS: TEAM_COLUMNS,
  ROLES: ROLE_COLUMNS,
  LEVELS: LEVEL_COLUMNS,
  PROJECTS: PROJECT_COLUMNS,
  TAGS: TAG_COLUMNS,
  PERSONAS: PERSONA_COLUMNS,
  CLAUDE_CODE_SESSIONS: CLAUDE_CODE_SESSION_COLUMNS,
} as const;

export default COLUMNS;
