-- ============================================================================
-- Sprint Insert Permission Test Script
-- Created: 2026-01-26
-- Description: Test sprint insertion to identify RLS policy failures
--
-- HOW TO RUN:
-- 1. Connect to Supabase as an authenticated user
-- 2. Replace the placeholder UUIDs with real values from your workspace
-- 3. Run each test individually to identify the failure point
-- ============================================================================

-- ============================================================================
-- PRE-FLIGHT CHECKS
-- ============================================================================
SELECT '=== PRE-FLIGHT CHECKS ===' AS section;

-- Check current user
SELECT
    auth.uid() AS current_user_id,
    CASE WHEN auth.uid() IS NOT NULL THEN 'AUTHENTICATED' ELSE 'NOT AUTHENTICATED' END AS auth_status;

-- ============================================================================
-- TEST 1: Verify user has active workspace membership
-- ============================================================================
SELECT '=== TEST 1: WORKSPACE MEMBERSHIP ===' AS section;

SELECT
    wm.id AS membership_id,
    wm.workspace_id,
    wm.status,
    wm.role,
    w.name AS workspace_name
FROM workspace_members wm
JOIN workspaces w ON w.id = wm.workspace_id
WHERE wm.user_id = auth.uid()
AND wm.status = 'active';

-- ============================================================================
-- TEST 2: Find valid space_id for testing
-- ============================================================================
SELECT '=== TEST 2: ACCESSIBLE SPACES ===' AS section;

SELECT
    s.id AS space_id,
    s.name AS space_name,
    s.workspace_id
FROM spaces s
JOIN workspace_members wm ON wm.workspace_id = s.workspace_id
WHERE wm.user_id = auth.uid()
AND wm.status = 'active'
AND s.deleted_at IS NULL
LIMIT 5;

-- ============================================================================
-- TEST 3: Find valid project_id for testing (CRITICAL - project_id is NOT NULL)
-- ============================================================================
SELECT '=== TEST 3: ACCESSIBLE PROJECTS ===' AS section;

SELECT
    p.id AS project_id,
    p.name AS project_name,
    p.space_id,
    s.name AS space_name
FROM projects p
JOIN spaces s ON s.id = p.space_id
JOIN workspace_members wm ON wm.workspace_id = s.workspace_id
WHERE wm.user_id = auth.uid()
AND wm.status = 'active'
AND p.deleted_at IS NULL
LIMIT 5;

-- ============================================================================
-- TEST 4: Find valid sprint_folder_id for testing
-- ============================================================================
SELECT '=== TEST 4: ACCESSIBLE SPRINT FOLDERS ===' AS section;

SELECT
    sf.id AS sprint_folder_id,
    sf.name AS folder_name,
    sf.space_id,
    sf.project_id,
    s.name AS space_name
FROM sprint_folders sf
JOIN spaces s ON s.id = sf.space_id
JOIN workspace_members wm ON wm.workspace_id = s.workspace_id
WHERE wm.user_id = auth.uid()
AND wm.status = 'active'
AND sf.deleted_at IS NULL
LIMIT 5;

-- ============================================================================
-- TEST 5: Simulate RLS policy check (without actual INSERT)
-- ============================================================================
SELECT '=== TEST 5: RLS POLICY SIMULATION ===' AS section;

-- This simulates what the RLS INSERT policy checks
WITH test_values AS (
    SELECT
        s.id AS space_id,
        s.workspace_id,
        p.id AS project_id,
        sf.id AS sprint_folder_id
    FROM spaces s
    JOIN projects p ON p.space_id = s.id AND p.deleted_at IS NULL
    JOIN sprint_folders sf ON sf.space_id = s.id AND sf.deleted_at IS NULL
    JOIN workspace_members wm ON wm.workspace_id = s.workspace_id
    WHERE wm.user_id = auth.uid()
    AND wm.status = 'active'
    AND s.deleted_at IS NULL
    LIMIT 1
)
SELECT
    tv.*,
    EXISTS (
        SELECT 1 FROM spaces s
        JOIN workspace_members wm ON wm.workspace_id = s.workspace_id
        WHERE s.id = tv.space_id
        AND wm.user_id = auth.uid()
        AND wm.status = 'active'
    ) AS rls_check_passes,
    'If rls_check_passes is TRUE, the INSERT should succeed' AS note
FROM test_values tv;

-- ============================================================================
-- TEST 6: DRY RUN INSERT (wrapped in transaction that gets rolled back)
-- ============================================================================
SELECT '=== TEST 6: DRY RUN INSERT ===' AS section;

-- IMPORTANT: This is a dry run - it will be rolled back
-- Uncomment and run manually to test actual INSERT behavior

/*
BEGIN;

-- Replace these with actual UUIDs from tests above
INSERT INTO sprints (
    name,
    goal,
    start_date,
    end_date,
    sprint_folder_id,
    space_id,
    workspace_id,
    project_id,  -- CRITICAL: Must not be NULL
    status
) VALUES (
    'Test Sprint',
    'Test goal',
    CURRENT_DATE,
    CURRENT_DATE + INTERVAL '14 days',
    'YOUR_SPRINT_FOLDER_ID',  -- Replace with real UUID
    'YOUR_SPACE_ID',          -- Replace with real UUID
    'YOUR_WORKSPACE_ID',      -- Replace with real UUID
    'YOUR_PROJECT_ID',        -- Replace with real UUID - CANNOT BE NULL
    'planned'
);

-- Check if it worked
SELECT * FROM sprints WHERE name = 'Test Sprint' ORDER BY created_at DESC LIMIT 1;

-- Always rollback in test mode
ROLLBACK;
*/

SELECT
    'Uncomment the BEGIN/ROLLBACK block above to test actual INSERT' AS instruction,
    'Replace placeholder UUIDs with real values from tests 2-4' AS note;

-- ============================================================================
-- TEST 7: Check for NULL project_id issue (MOST LIKELY CAUSE)
-- ============================================================================
SELECT '=== TEST 7: NULL PROJECT_ID CHECK ===' AS section;

-- Check column constraint
SELECT
    column_name,
    is_nullable,
    CASE
        WHEN is_nullable = 'NO' THEN 'ERROR: project_id cannot be NULL!'
        ELSE 'OK: project_id is nullable'
    END AS constraint_status,
    'If client passes NULL for project_id, INSERT will fail with RLS-like error' AS note
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'sprints'
AND column_name = 'project_id';

-- ============================================================================
-- TEST 8: Spaces without projects (would cause NULL project_id)
-- ============================================================================
SELECT '=== TEST 8: SPACES WITHOUT PROJECTS ===' AS section;

SELECT
    s.id AS space_id,
    s.name AS space_name,
    s.workspace_id,
    'NO PROJECTS - Sprint creation will fail!' AS issue
FROM spaces s
JOIN workspace_members wm ON wm.workspace_id = s.workspace_id
WHERE wm.user_id = auth.uid()
AND wm.status = 'active'
AND s.deleted_at IS NULL
AND NOT EXISTS (
    SELECT 1 FROM projects p
    WHERE p.space_id = s.id
    AND p.deleted_at IS NULL
);

-- ============================================================================
-- DIAGNOSIS SUMMARY
-- ============================================================================
SELECT '=== DIAGNOSIS SUMMARY ===' AS section;

SELECT
    'Check TEST 7 and TEST 8 results' AS action,
    'If project_id is NOT NULL constraint and space has no projects, that is the bug' AS explanation,
    'Fix: Ensure createSprints() always receives valid projectId' AS solution;
