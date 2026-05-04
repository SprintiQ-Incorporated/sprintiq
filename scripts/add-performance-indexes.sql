-- ============================================================================
-- Performance Optimization Indexes
-- ============================================================================
-- These indexes are recommended based on query pattern analysis of the codebase.
-- Run this script in your Supabase SQL Editor to add missing indexes.
--
-- IMPORTANT: Review each index before applying to production.
-- Some indexes may already exist or may not be needed based on your data volume.
-- ============================================================================

-- ============================================================================
-- TASKS TABLE INDEXES
-- The tasks table is heavily queried and benefits from composite indexes
-- ============================================================================

-- Index for workspace + created_at queries (analytics, reporting)
-- Supports: analytics/quality/route.ts, analytics/patterns/route.ts
CREATE INDEX IF NOT EXISTS idx_tasks_workspace_created
ON public.tasks (workspace_id, created_at DESC)
WHERE deleted_at IS NULL;

-- Index for sprint-based queries (sprint views, velocity calculations)
-- Supports: useSprintData.ts, analytics/velocity/route.ts
CREATE INDEX IF NOT EXISTS idx_tasks_sprint_status
ON public.tasks (sprint_id, status_id)
WHERE deleted_at IS NULL;

-- Index for project-based queries (project views)
-- Supports: useProjectData.ts
CREATE INDEX IF NOT EXISTS idx_tasks_project_parent
ON public.tasks (project_id, parent_task_id)
WHERE deleted_at IS NULL;

-- Index for assignee lookups
-- Supports: Team member workload queries
CREATE INDEX IF NOT EXISTS idx_tasks_assignee
ON public.tasks (assignee_id)
WHERE deleted_at IS NULL AND assignee_id IS NOT NULL;

-- Index for assigned_member lookups (team member tasks)
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_member
ON public.tasks (assigned_member_id)
WHERE deleted_at IS NULL AND assigned_member_id IS NOT NULL;

-- Composite index for backlog queries (workspace + no sprint + no parent)
CREATE INDEX IF NOT EXISTS idx_tasks_backlog
ON public.tasks (workspace_id, backlog_position)
WHERE deleted_at IS NULL AND sprint_id IS NULL AND parent_task_id IS NULL;

-- ============================================================================
-- EVENTS TABLE INDEXES
-- Events table can grow large and needs efficient filtering
-- ============================================================================

-- Index for workspace + user events (inbox, notifications)
-- Supports: inbox-view.tsx, header.tsx
CREATE INDEX IF NOT EXISTS idx_events_workspace_user_created
ON public.events (workspace_id, user_id, created_at DESC)
WHERE deleted_at IS NULL;

-- Index for unread events
CREATE INDEX IF NOT EXISTS idx_events_unread
ON public.events (workspace_id, user_id)
WHERE deleted_at IS NULL AND is_read = false;

-- ============================================================================
-- SPRINTS TABLE INDEXES
-- ============================================================================

-- Index for space + date range queries (sprint views, analytics)
CREATE INDEX IF NOT EXISTS idx_sprints_space_dates
ON public.sprints (space_id, start_date, end_date)
WHERE deleted_at IS NULL;

-- Index for workspace + status (active sprint queries)
CREATE INDEX IF NOT EXISTS idx_sprints_workspace_status
ON public.sprints (workspace_id, status)
WHERE deleted_at IS NULL;

-- ============================================================================
-- STATUSES TABLE INDEXES
-- ============================================================================

-- Index for workspace statuses with type
CREATE INDEX IF NOT EXISTS idx_statuses_workspace_type
ON public.statuses (workspace_id, status_type_id)
WHERE deleted_at IS NULL;

-- ============================================================================
-- TASK_STATUS_HISTORY TABLE INDEXES
-- Used for cycle time and lead time analytics
-- ============================================================================

-- Index for task history lookups
CREATE INDEX IF NOT EXISTS idx_task_status_history_task
ON public.task_status_history (task_id, changed_at DESC);

-- Index for workspace analytics
CREATE INDEX IF NOT EXISTS idx_task_status_history_workspace
ON public.task_status_history (workspace_id, changed_at DESC);

-- ============================================================================
-- TASK_TAGS TABLE INDEXES
-- ============================================================================

-- Index for task_id lookups (tag retrieval)
CREATE INDEX IF NOT EXISTS idx_task_tags_task
ON public.task_tags (task_id)
WHERE deleted_at IS NULL;

-- ============================================================================
-- TEAM_MEMBERS TABLE INDEXES
-- ============================================================================

-- Index for team lookups
CREATE INDEX IF NOT EXISTS idx_team_members_team
ON public.team_members (team_id)
WHERE deleted_at IS NULL;

-- Index for workspace lookups
CREATE INDEX IF NOT EXISTS idx_team_members_workspace
ON public.team_members (workspace_id)
WHERE deleted_at IS NULL;

-- ============================================================================
-- WORKSPACE_MEMBERS TABLE INDEXES
-- ============================================================================

-- Index for workspace member lookups
CREATE INDEX IF NOT EXISTS idx_workspace_members_workspace
ON public.workspace_members (workspace_id, status);

-- Index for user's workspaces
CREATE INDEX IF NOT EXISTS idx_workspace_members_user
ON public.workspace_members (user_id)
WHERE user_id IS NOT NULL;

-- ============================================================================
-- TAWOS_RETRIEVAL_LOGS TABLE INDEXES
-- Used for TAWOS analytics dashboard
-- ============================================================================

-- Index for date-based analytics
CREATE INDEX IF NOT EXISTS idx_tawos_retrieval_logs_created
ON public.tawos_retrieval_logs (created_at DESC);

-- Index for workspace + date analytics
CREATE INDEX IF NOT EXISTS idx_tawos_retrieval_logs_workspace
ON public.tawos_retrieval_logs (workspace_id, created_at DESC);

-- ============================================================================
-- SPRINT_METRICS TABLE INDEXES
-- ============================================================================

-- Index for sprint metrics lookups
CREATE INDEX IF NOT EXISTS idx_sprint_metrics_workspace
ON public.sprint_metrics (workspace_id, calculated_at DESC);

-- ============================================================================
-- EPICS TABLE INDEXES
-- ============================================================================

-- Index for project epics
CREATE INDEX IF NOT EXISTS idx_epics_project
ON public.epics (project_id)
WHERE deleted_at IS NULL;

-- Index for workspace epics
CREATE INDEX IF NOT EXISTS idx_epics_workspace
ON public.epics (workspace_id, status)
WHERE deleted_at IS NULL;

-- ============================================================================
-- PROFILES TABLE INDEXES
-- ============================================================================

-- Index for email lookups (already likely exists, but ensure it)
CREATE INDEX IF NOT EXISTS idx_profiles_email
ON public.profiles (email)
WHERE email IS NOT NULL;

-- ============================================================================
-- ANALYZE TABLES
-- Update table statistics for query planner after adding indexes
-- ============================================================================

ANALYZE public.tasks;
ANALYZE public.events;
ANALYZE public.sprints;
ANALYZE public.statuses;
ANALYZE public.task_status_history;
ANALYZE public.task_tags;
ANALYZE public.team_members;
ANALYZE public.workspace_members;
ANALYZE public.tawos_retrieval_logs;
ANALYZE public.sprint_metrics;
ANALYZE public.epics;
ANALYZE public.profiles;

-- ============================================================================
-- VERIFICATION QUERY
-- Run this to verify indexes were created
-- ============================================================================

-- SELECT
--     schemaname,
--     tablename,
--     indexname,
--     indexdef
-- FROM pg_indexes
-- WHERE schemaname = 'public'
--     AND indexname LIKE 'idx_%'
-- ORDER BY tablename, indexname;
