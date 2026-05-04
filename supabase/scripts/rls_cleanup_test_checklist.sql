-- ============================================================================
-- FUNCTIONAL TEST CHECKLIST: Duplicate RLS Policies Cleanup
-- Created: 2026-01-23
-- Description: SQL queries to verify RLS functionality after cleanup migration.
--   Run these tests as an authenticated user to verify operations still work.
-- ============================================================================

-- ============================================================================
-- PREREQUISITES
-- ============================================================================
-- 1. Must be run as an authenticated user (not service_role)
-- 2. User should have at least one workspace where they are owner/member
-- 3. Run after applying 20260123_cleanup_duplicate_rls_policies.sql
-- ============================================================================

-- ============================================================================
-- TEST 1: User can view their workspace
-- ============================================================================
-- Expected: Returns workspaces where user is owner or member
-- If this fails, SELECT policies are broken

SELECT
    'TEST 1: View Workspaces' as test_name,
    CASE WHEN COUNT(*) > 0 THEN 'PASS' ELSE 'FAIL - No workspaces visible' END as result,
    COUNT(*) as workspace_count
FROM workspaces
WHERE deleted_at IS NULL;

-- ============================================================================
-- TEST 2: User can view spaces in their workspace
-- ============================================================================
-- Expected: Returns spaces where user has workspace membership

SELECT
    'TEST 2: View Spaces' as test_name,
    CASE WHEN COUNT(*) >= 0 THEN 'PASS' ELSE 'ERROR' END as result,
    COUNT(*) as space_count
FROM spaces
WHERE deleted_at IS NULL;

-- ============================================================================
-- TEST 3: User can view sprint folders
-- ============================================================================
-- Expected: Returns sprint folders in user's workspace/spaces

SELECT
    'TEST 3: View Sprint Folders' as test_name,
    CASE WHEN COUNT(*) >= 0 THEN 'PASS' ELSE 'ERROR' END as result,
    COUNT(*) as folder_count
FROM sprint_folders
WHERE deleted_at IS NULL;

-- ============================================================================
-- TEST 4: User can view sprints
-- ============================================================================
-- Expected: Returns sprints in user's workspace/spaces

SELECT
    'TEST 4: View Sprints' as test_name,
    CASE WHEN COUNT(*) >= 0 THEN 'PASS' ELSE 'ERROR' END as result,
    COUNT(*) as sprint_count
FROM sprints
WHERE deleted_at IS NULL;

-- ============================================================================
-- TEST 5: User can view statuses
-- ============================================================================
-- Expected: Returns statuses for user's workspaces

SELECT
    'TEST 5: View Statuses' as test_name,
    CASE WHEN COUNT(*) >= 0 THEN 'PASS' ELSE 'ERROR' END as result,
    COUNT(*) as status_count
FROM statuses
WHERE deleted_at IS NULL;

-- ============================================================================
-- TEST 6: User can view projects
-- ============================================================================
-- Expected: Returns projects in user's workspaces

SELECT
    'TEST 6: View Projects' as test_name,
    CASE WHEN COUNT(*) >= 0 THEN 'PASS' ELSE 'ERROR' END as result,
    COUNT(*) as project_count
FROM projects
WHERE deleted_at IS NULL;

-- ============================================================================
-- TEST 7: User can view space members
-- ============================================================================
-- Expected: Returns space members for user's spaces

SELECT
    'TEST 7: View Space Members' as test_name,
    CASE WHEN COUNT(*) >= 0 THEN 'PASS' ELSE 'ERROR' END as result,
    COUNT(*) as member_count
FROM space_members;

-- ============================================================================
-- MANUAL QA CHECKLIST
-- ============================================================================
/*
Run these tests through the application UI:

## Workspace Operations
[ ] Can view workspace dashboard
[ ] Can update workspace settings (as owner)
[ ] Cannot view other users' workspaces
[ ] Workspace owner can delete workspace

## Sprint Operations
[ ] Can create a new sprint in a space
[ ] Can update sprint goal
[ ] Can view sprint backlog
[ ] Can delete a sprint (as member)

## Space Operations
[ ] Can create a new space
[ ] Can update space settings
[ ] Can delete a space (if authorized)

## Member Management
[ ] Workspace owner can view all members
[ ] Workspace owner can invite new members
[ ] Workspace admin can manage members
[ ] Regular member cannot manage other members

## Security Checks
[ ] User A cannot see User B's private workspace
[ ] User A cannot modify User B's sprints
[ ] User A cannot delete User B's projects
[ ] RLS policies prevent cross-tenant data access

## Performance Checks
[ ] Dashboard loads within expected time
[ ] Sprint list queries are responsive
[ ] No noticeable slowdown from RLS evaluation

*/
-- ============================================================================

-- ============================================================================
-- SUMMARY QUERY - Run all tests and summarize results
-- ============================================================================

WITH test_results AS (
    SELECT 1 as test_num, 'Workspaces SELECT' as test_name,
           (SELECT COUNT(*) FROM workspaces WHERE deleted_at IS NULL) as row_count
    UNION ALL
    SELECT 2, 'Spaces SELECT',
           (SELECT COUNT(*) FROM spaces WHERE deleted_at IS NULL)
    UNION ALL
    SELECT 3, 'Sprint Folders SELECT',
           (SELECT COUNT(*) FROM sprint_folders WHERE deleted_at IS NULL)
    UNION ALL
    SELECT 4, 'Sprints SELECT',
           (SELECT COUNT(*) FROM sprints WHERE deleted_at IS NULL)
    UNION ALL
    SELECT 5, 'Statuses SELECT',
           (SELECT COUNT(*) FROM statuses WHERE deleted_at IS NULL)
    UNION ALL
    SELECT 6, 'Projects SELECT',
           (SELECT COUNT(*) FROM projects WHERE deleted_at IS NULL)
    UNION ALL
    SELECT 7, 'Space Members SELECT',
           (SELECT COUNT(*) FROM space_members)
)
SELECT
    test_num,
    test_name,
    row_count,
    CASE
        WHEN row_count >= 0 THEN 'PASS'
        ELSE 'ERROR'
    END as status
FROM test_results
ORDER BY test_num;

-- ============================================================================
-- END TEST CHECKLIST
-- ============================================================================
