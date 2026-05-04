-- ============================================================================
-- Sprints RLS Policy Audit Script
-- Created: 2026-01-26
-- Description: Diagnose RLS policy violations when creating sprints
--
-- ERROR BEING INVESTIGATED:
--   "Failed to create sprints: new row violates row-level security policy for table"
-- ============================================================================

-- ============================================================================
-- 1. CHECK SPRINTS TABLE SCHEMA (verify project_id constraint)
-- ============================================================================
SELECT '=== SPRINTS TABLE SCHEMA ===' AS section;

SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'sprints'
ORDER BY ordinal_position;

-- ============================================================================
-- 2. CHECK IF project_id HAS NOT NULL CONSTRAINT
-- ============================================================================
SELECT '=== PROJECT_ID CONSTRAINT CHECK ===' AS section;

SELECT
    column_name,
    is_nullable,
    CASE
        WHEN is_nullable = 'NO' THEN 'REQUIRED (NOT NULL) - This may cause RLS-like errors if NULL is passed'
        ELSE 'OPTIONAL (nullable)'
    END AS status
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'sprints'
AND column_name = 'project_id';

-- ============================================================================
-- 3. LIST ALL RLS POLICIES ON SPRINTS TABLE
-- ============================================================================
SELECT '=== RLS POLICIES ON SPRINTS TABLE ===' AS section;

SELECT
    policyname AS policy_name,
    cmd AS operation,
    permissive,
    roles::text,
    CASE WHEN qual IS NOT NULL THEN qual ELSE 'N/A' END AS using_clause,
    CASE WHEN with_check IS NOT NULL THEN with_check ELSE 'N/A' END AS with_check_clause
FROM pg_policies
WHERE schemaname = 'public'
AND tablename = 'sprints'
ORDER BY cmd, policyname;

-- ============================================================================
-- 4. CHECK INSERT POLICY SPECIFICALLY
-- ============================================================================
SELECT '=== SPRINT INSERT POLICY ANALYSIS ===' AS section;

SELECT
    policyname,
    cmd,
    with_check AS insert_check_condition
FROM pg_policies
WHERE schemaname = 'public'
AND tablename = 'sprints'
AND cmd = 'INSERT';

-- ============================================================================
-- 5. VERIFY RLS IS ENABLED ON SPRINTS
-- ============================================================================
SELECT '=== RLS ENABLED STATUS ===' AS section;

SELECT
    c.relname AS table_name,
    CASE WHEN c.relrowsecurity THEN 'ENABLED' ELSE 'DISABLED' END AS rls_status,
    CASE WHEN c.relforcerowsecurity THEN 'FORCED' ELSE 'NOT FORCED' END AS force_status
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
AND c.relname IN ('sprints', 'sprint_folders')
ORDER BY c.relname;

-- ============================================================================
-- 6. CHECK FOREIGN KEY CONSTRAINTS ON SPRINTS
-- ============================================================================
SELECT '=== FOREIGN KEY CONSTRAINTS ===' AS section;

SELECT
    tc.constraint_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
AND tc.table_schema = 'public'
AND tc.table_name = 'sprints';

-- ============================================================================
-- 7. TEST: Can current user access via workspace_members?
-- Run this while authenticated as the problematic user
-- ============================================================================
SELECT '=== WORKSPACE MEMBERSHIP CHECK (for current user) ===' AS section;

SELECT
    wm.workspace_id,
    wm.user_id,
    wm.status,
    wm.role,
    CASE
        WHEN wm.user_id = auth.uid() AND wm.status = 'active'
        THEN 'CAN INSERT SPRINTS'
        ELSE 'CANNOT INSERT SPRINTS'
    END AS sprint_insert_permission
FROM workspace_members wm
WHERE wm.user_id = auth.uid()
LIMIT 10;

-- ============================================================================
-- 8. VERIFY space_id -> workspace_id JOIN PATH
-- ============================================================================
SELECT '=== SPACE TO WORKSPACE JOIN VERIFICATION ===' AS section;

SELECT
    s.id AS space_id,
    s.name AS space_name,
    s.workspace_id,
    EXISTS (
        SELECT 1 FROM workspace_members wm
        WHERE wm.workspace_id = s.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.status = 'active'
    ) AS user_has_access
FROM spaces s
WHERE s.deleted_at IS NULL
LIMIT 10;

-- ============================================================================
-- 9. CHECK FOR ORPHANED DATA (spaces without workspace membership)
-- ============================================================================
SELECT '=== ORPHANED SPACES CHECK ===' AS section;

SELECT
    s.id AS space_id,
    s.name AS space_name,
    s.workspace_id,
    'NO ACTIVE MEMBERS' AS issue
FROM spaces s
WHERE s.deleted_at IS NULL
AND NOT EXISTS (
    SELECT 1 FROM workspace_members wm
    WHERE wm.workspace_id = s.workspace_id
    AND wm.status = 'active'
);

-- ============================================================================
-- 10. DIAGNOSE: What would fail INSERT check?
-- ============================================================================
SELECT '=== INSERT FAILURE DIAGNOSIS ===' AS section;

-- Simulates the INSERT check for current user
WITH test_data AS (
    SELECT
        s.id AS space_id,
        s.workspace_id,
        p.id AS project_id,
        sf.id AS sprint_folder_id
    FROM spaces s
    LEFT JOIN projects p ON p.space_id = s.id AND p.deleted_at IS NULL
    LEFT JOIN sprint_folders sf ON sf.space_id = s.id AND sf.deleted_at IS NULL
    WHERE s.deleted_at IS NULL
    LIMIT 5
)
SELECT
    td.space_id,
    td.workspace_id,
    td.project_id,
    td.sprint_folder_id,
    CASE WHEN td.project_id IS NULL THEN 'FAIL: project_id is NULL (NOT NULL constraint)' ELSE 'OK' END AS project_id_check,
    CASE WHEN td.sprint_folder_id IS NULL THEN 'FAIL: sprint_folder_id is NULL' ELSE 'OK' END AS sprint_folder_check,
    EXISTS (
        SELECT 1 FROM workspace_members wm
        WHERE wm.workspace_id = td.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.status = 'active'
    ) AS rls_policy_would_pass
FROM test_data td;

-- ============================================================================
-- SUMMARY: ROOT CAUSE ANALYSIS
-- ============================================================================
SELECT '=== ROOT CAUSE ANALYSIS ===' AS section;

SELECT
    'BUG IDENTIFIED' AS status,
    'project_id column is NOT NULL but client may pass NULL' AS root_cause,
    'sprint-actions.ts:243 - projectId defaults to null' AS code_location,
    'Add validation or make project_id required in function signature' AS recommended_fix;

-- ============================================================================
-- NEXT STEPS:
-- 1. Verify project_id is_nullable = 'NO' in section 2
-- 2. Check if user has workspace membership in section 7
-- 3. Review INSERT policy conditions in section 4
-- 4. If all checks pass, the issue is likely NULL project_id
-- ============================================================================
