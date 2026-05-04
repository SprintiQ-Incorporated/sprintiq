-- Verification Script: display-types.ts vs Database Schema
-- This script verifies that the TypeScript base types match the actual database columns
-- Run this in your Supabase SQL Editor to validate type definitions

-- ============================================================================
-- 1. SPACES TABLE - Verifies SpaceBase type
-- ============================================================================
SELECT
    'spaces' as table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'spaces'
ORDER BY ordinal_position;

-- ============================================================================
-- 2. PROJECTS TABLE - Verifies ProjectBase type
-- ============================================================================
SELECT
    'projects' as table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'projects'
ORDER BY ordinal_position;

-- ============================================================================
-- 3. SPRINTS TABLE - Verifies SprintBase type
-- ============================================================================
SELECT
    'sprints' as table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'sprints'
ORDER BY ordinal_position;

-- ============================================================================
-- 4. SPRINT_FOLDERS TABLE - Verifies SprintFolderBase type
-- ============================================================================
SELECT
    'sprint_folders' as table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'sprint_folders'
ORDER BY ordinal_position;

-- ============================================================================
-- 5. WORKSPACES TABLE - Verifies WorkspaceBase type
-- ============================================================================
SELECT
    'workspaces' as table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'workspaces'
ORDER BY ordinal_position;

-- ============================================================================
-- 6. DAYS TABLE - Verifies DayBase/DayDisplay type
-- ============================================================================
SELECT
    'days' as table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'days'
ORDER BY ordinal_position;

-- ============================================================================
-- 7. JIRA_INTEGRATIONS TABLE - Verifies JiraIntegrationBase/Display type
-- ============================================================================
SELECT
    'jira_integrations' as table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'jira_integrations'
ORDER BY ordinal_position;

-- ============================================================================
-- 8. SLACK_INTEGRATIONS TABLE - Verifies SlackIntegrationBase/Display type
-- ============================================================================
SELECT
    'slack_integrations' as table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'slack_integrations'
ORDER BY ordinal_position;

-- ============================================================================
-- 9. SAMPLE DATA VERIFICATION - Test actual query shapes
-- ============================================================================

-- Test SpaceBase query shape (what integrations page returns)
SELECT * FROM spaces WHERE deleted_at IS NULL LIMIT 1;

-- Test DayDisplay query shape (what create-sprint-folder-modal returns)
SELECT id, name FROM days ORDER BY name LIMIT 5;

-- Test ProjectBase query shape
SELECT * FROM projects WHERE deleted_at IS NULL LIMIT 1;

-- Test SprintBase query shape
SELECT * FROM sprints WHERE deleted_at IS NULL LIMIT 1;

-- Test SprintFolderBase query shape
SELECT * FROM sprint_folders WHERE deleted_at IS NULL LIMIT 1;

-- Test WorkspaceBase query shape
SELECT * FROM workspaces WHERE deleted_at IS NULL LIMIT 1;

-- ============================================================================
-- 10. VERIFY SENSITIVE FIELDS ARE PRESENT (to confirm Display types omit them)
-- ============================================================================

-- JiraIntegration sensitive fields that JiraIntegrationDisplay should OMIT
SELECT
    column_name,
    CASE
        WHEN column_name IN ('jira_api_token', 'encrypted_api_token')
        THEN 'SENSITIVE - Omitted in JiraIntegrationDisplay'
        ELSE 'OK - Included in display type'
    END as status
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'jira_integrations'
ORDER BY ordinal_position;

-- SlackIntegration sensitive fields that SlackIntegrationDisplay should OMIT
SELECT
    column_name,
    CASE
        WHEN column_name IN ('access_token', 'encrypted_access_token', 'refresh_token')
        THEN 'SENSITIVE - Omitted in SlackIntegrationDisplay'
        ELSE 'OK - Included in display type'
    END as status
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'slack_integrations'
ORDER BY ordinal_position;

-- ============================================================================
-- 11. VERIFY RELATION QUERIES (SpaceWithRelations pattern)
-- ============================================================================

-- This simulates what the layout.tsx query returns
-- SpaceWithLayoutRelations = SpaceBase & { projects: ProjectBase[]; sprint_folders: (SprintFolderBase & { sprints: SprintBase[] })[] }
SELECT
    s.*,
    COALESCE(
        (SELECT json_agg(p.*)
         FROM projects p
         WHERE p.space_id = s.id AND p.deleted_at IS NULL),
        '[]'::json
    ) as projects,
    COALESCE(
        (SELECT json_agg(
            jsonb_build_object(
                'id', sf.id,
                'sprint_folder_id', sf.sprint_folder_id,
                'name', sf.name,
                'sprint_start_day_id', sf.sprint_start_day_id,
                'duration_week', sf.duration_week,
                'space_id', sf.space_id,
                'created_at', sf.created_at,
                'updated_at', sf.updated_at,
                'deleted_at', sf.deleted_at,
                'project_id', sf.project_id,
                'sprints', COALESCE(
                    (SELECT json_agg(sp.*)
                     FROM sprints sp
                     WHERE sp.sprint_folder_id = sf.id AND sp.deleted_at IS NULL),
                    '[]'::json
                )
            )
        ) FROM sprint_folders sf
          WHERE sf.space_id = s.id AND sf.deleted_at IS NULL),
        '[]'::json
    ) as sprint_folders
FROM spaces s
WHERE s.deleted_at IS NULL
LIMIT 1;

-- ============================================================================
-- 12. COLUMN COUNT SUMMARY
-- ============================================================================
SELECT
    t.table_name,
    COUNT(*) as column_count
FROM information_schema.tables t
JOIN information_schema.columns c ON t.table_name = c.table_name AND t.table_schema = c.table_schema
WHERE t.table_schema = 'public'
AND t.table_name IN (
    'spaces', 'projects', 'sprints', 'sprint_folders',
    'workspaces', 'days', 'jira_integrations', 'slack_integrations'
)
GROUP BY t.table_name
ORDER BY t.table_name;

-- ============================================================================
-- TYPE MAPPING REFERENCE
-- ============================================================================
--
-- TypeScript Type          | SQL Table           | Query Pattern
-- ------------------------ | ------------------- | -----------------------------
-- SpaceBase                | spaces              | SELECT * FROM spaces
-- ProjectBase              | projects            | SELECT * FROM projects
-- SprintBase               | sprints             | SELECT * FROM sprints
-- SprintFolderBase         | sprint_folders      | SELECT * FROM sprint_folders
-- WorkspaceBase            | workspaces          | SELECT * FROM workspaces
-- DayBase                  | days                | SELECT * FROM days
-- DayDisplay               | days                | SELECT id, name FROM days
-- JiraIntegrationBase      | jira_integrations   | SELECT * FROM jira_integrations
-- JiraIntegrationDisplay   | jira_integrations   | SELECT (without jira_api_token, encrypted_api_token)
-- SlackIntegrationBase     | slack_integrations  | SELECT * FROM slack_integrations
-- SlackIntegrationDisplay  | slack_integrations  | SELECT (without access_token, encrypted_access_token, refresh_token)
-- SpaceWithRelations       | spaces + joins      | SELECT *, projects(*), sprint_folders(*)
--
-- The display-types.ts ensures TypeScript types EXACTLY match what Supabase returns.
