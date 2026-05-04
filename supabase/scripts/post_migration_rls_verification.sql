-- ============================================================================
-- POST-MIGRATION VERIFICATION: Duplicate RLS Policies Cleanup
-- Created: 2026-01-23
-- Description: Run this script AFTER applying the cleanup migration to
--   verify the correct policies were removed and the system still works.
-- ============================================================================

-- ============================================================================
-- 1. VERIFY POLICY COUNT BY TABLE
-- ============================================================================
-- Expected after migration: exactly 4 policies per table

SELECT
    tablename,
    COUNT(*) as policy_count,
    4 as expected,
    CASE
        WHEN COUNT(*) = 4 THEN 'PASS'
        WHEN COUNT(*) > 4 THEN 'FAIL: Extra policies remain'
        ELSE 'FAIL: Missing policies'
    END as status
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
-- 2. VERIFY DUPLICATE POLICIES WERE REMOVED
-- ============================================================================
-- All of these should return 0 rows

SELECT
    tablename,
    policyname,
    'SHOULD NOT EXIST' as status
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
);
-- Expected: 0 rows returned

-- ============================================================================
-- 3. VERIFY KEPT POLICIES EXIST
-- ============================================================================
-- All 28 of these should exist

SELECT
    tablename,
    policyname,
    cmd,
    CASE WHEN policyname IS NOT NULL THEN 'EXISTS' ELSE 'MISSING' END as status
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
-- Expected: 28 rows returned

-- ============================================================================
-- 4. VERIFY HELPER FUNCTIONS STILL WORK
-- ============================================================================
-- Test with a NULL UUID (should return false, not error)

SELECT
    'is_workspace_member' as function_name,
    CASE
        WHEN public.is_workspace_member('00000000-0000-0000-0000-000000000000'::uuid) IS NOT NULL
        THEN 'WORKS'
        ELSE 'ERROR'
    END as status;

-- ============================================================================
-- 5. TOTAL POLICY COUNT SUMMARY
-- ============================================================================

SELECT
    COUNT(*) as total_policies,
    28 as expected,
    CASE
        WHEN COUNT(*) = 28 THEN 'PASS: Migration successful'
        WHEN COUNT(*) > 28 THEN 'WARNING: Extra policies remain'
        ELSE 'FAIL: Policies missing'
    END as status
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
-- 6. LIST ALL REMAINING POLICIES
-- ============================================================================
-- Full inventory for review

SELECT
    tablename,
    policyname,
    permissive,
    cmd,
    roles
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
ORDER BY tablename, policyname;

-- ============================================================================
-- END POST-MIGRATION VERIFICATION
-- ============================================================================
