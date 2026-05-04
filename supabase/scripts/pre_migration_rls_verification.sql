-- ============================================================================
-- PRE-MIGRATION VERIFICATION: Duplicate RLS Policies Cleanup
-- Created: 2026-01-23
-- Description: Run this script BEFORE applying the cleanup migration to
--   save the current state for comparison and verify expected duplicates exist.
-- ============================================================================

-- ============================================================================
-- 1. SAVE CURRENT STATE FOR COMPARISON
-- ============================================================================
-- Creates a temporary backup of all RLS policies for the affected tables
-- This allows post-migration comparison to verify only intended policies removed

DROP TABLE IF EXISTS rls_backup_temp;

SELECT
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
INTO TEMP TABLE rls_backup_temp
FROM pg_policies
WHERE tablename IN (
    'workspaces',
    'projects',
    'spaces',
    'sprint_folders',
    'sprints',
    'statuses',
    'space_members'
);

-- ============================================================================
-- 2. CURRENT POLICY COUNT BY TABLE
-- ============================================================================
-- Expected before migration:
--   workspaces: 8 policies
--   projects: 8 policies
--   spaces: 8 policies
--   sprint_folders: 8 policies
--   sprints: 8 policies
--   statuses: 6 policies
--   space_members: 6 policies
--   TOTAL: 52 policies

SELECT
    tablename,
    COUNT(*) as policy_count,
    CASE
        WHEN tablename IN ('statuses', 'space_members') THEN 6
        ELSE 8
    END as expected_before,
    4 as expected_after,
    CASE
        WHEN tablename IN ('statuses', 'space_members') THEN COUNT(*) - 6
        ELSE COUNT(*) - 8
    END as variance_from_expected
FROM pg_policies
WHERE tablename IN (
    'workspaces',
    'projects',
    'spaces',
    'sprint_folders',
    'sprints',
    'statuses',
    'space_members'
)
GROUP BY tablename
ORDER BY tablename;

-- ============================================================================
-- 3. LIST ALL POLICIES TO BE REMOVED
-- ============================================================================
-- Verify these duplicate policies exist before removal

SELECT
    tablename,
    policyname,
    cmd,
    'TO BE REMOVED' as action
FROM pg_policies
WHERE (tablename, policyname) IN (
    -- workspaces (4)
    ('workspaces', 'workspaces_delete_policy'),
    ('workspaces', 'workspaces_insert_policy'),
    ('workspaces', 'workspaces_select_policy'),
    ('workspaces', 'workspaces_update_policy'),
    -- projects (4)
    ('projects', 'projects_delete_policy'),
    ('projects', 'projects_insert_policy'),
    ('projects', 'projects_select_policy'),
    ('projects', 'projects_update_policy'),
    -- spaces (4)
    ('spaces', 'spaces_delete_policy'),
    ('spaces', 'spaces_insert_policy'),
    ('spaces', 'spaces_select_policy'),
    ('spaces', 'spaces_update_policy'),
    -- sprint_folders (4)
    ('sprint_folders', 'Users can create sprint_folders in their workspace'),
    ('sprint_folders', 'Users can delete sprint_folders in their workspace'),
    ('sprint_folders', 'Users can update sprint_folders in their workspace'),
    ('sprint_folders', 'Users can view sprint_folders in their workspace'),
    -- sprints (4)
    ('sprints', 'Users can create sprints in their workspace'),
    ('sprints', 'Users can delete sprints in their workspace'),
    ('sprints', 'Users can update sprints in their workspace'),
    ('sprints', 'Users can view sprints in their workspace'),
    -- statuses (2)
    ('statuses', 'Workspace members can update status colors'),
    ('statuses', 'Workspace members can view statuses'),
    -- space_members (2)
    ('space_members', 'space_members_insert_policy'),
    ('space_members', 'space_members_select_policy')
)
ORDER BY tablename, policyname;

-- ============================================================================
-- 4. LIST ALL POLICIES TO BE KEPT
-- ============================================================================
-- Verify these optimized policies exist and will remain after cleanup

SELECT
    tablename,
    policyname,
    cmd,
    'TO BE KEPT' as action
FROM pg_policies
WHERE (tablename, policyname) IN (
    -- workspaces (4)
    ('workspaces', 'workspaces_delete'),
    ('workspaces', 'workspaces_insert'),
    ('workspaces', 'workspaces_select'),
    ('workspaces', 'workspaces_update'),
    -- projects (4)
    ('projects', 'projects_delete'),
    ('projects', 'projects_insert'),
    ('projects', 'projects_select'),
    ('projects', 'projects_update'),
    -- spaces (4)
    ('spaces', 'spaces_delete'),
    ('spaces', 'spaces_insert'),
    ('spaces', 'spaces_select'),
    ('spaces', 'spaces_update'),
    -- sprint_folders (4)
    ('sprint_folders', 'sprint_folders_delete'),
    ('sprint_folders', 'sprint_folders_insert'),
    ('sprint_folders', 'sprint_folders_select'),
    ('sprint_folders', 'sprint_folders_update'),
    -- sprints (4)
    ('sprints', 'sprints_delete'),
    ('sprints', 'sprints_insert'),
    ('sprints', 'sprints_select'),
    ('sprints', 'sprints_update'),
    -- statuses (4)
    ('statuses', 'statuses_delete'),
    ('statuses', 'statuses_insert'),
    ('statuses', 'statuses_select'),
    ('statuses', 'statuses_update'),
    -- space_members (4)
    ('space_members', 'space_members_delete'),
    ('space_members', 'space_members_insert'),
    ('space_members', 'space_members_select'),
    ('space_members', 'space_members_update')
)
ORDER BY tablename, policyname;

-- ============================================================================
-- 5. VERIFY HELPER FUNCTIONS EXIST
-- ============================================================================
-- These functions are used by the kept policies and must exist

SELECT
    proname as function_name,
    pg_get_function_arguments(oid) as arguments,
    CASE WHEN proname IS NOT NULL THEN 'EXISTS' ELSE 'MISSING' END as status
FROM pg_proc
WHERE proname IN (
    'is_workspace_member',
    'can_manage_workspace_members',
    'is_project_member',
    'is_workspace_member_no_rls'
)
ORDER BY proname;

-- ============================================================================
-- 6. TOTAL POLICY COUNT
-- ============================================================================
SELECT
    COUNT(*) as total_policies,
    52 as expected_before,
    28 as expected_after,
    24 as policies_to_remove
FROM pg_policies
WHERE tablename IN (
    'workspaces',
    'projects',
    'spaces',
    'sprint_folders',
    'sprints',
    'statuses',
    'space_members'
);

-- ============================================================================
-- END PRE-MIGRATION VERIFICATION
-- ============================================================================
