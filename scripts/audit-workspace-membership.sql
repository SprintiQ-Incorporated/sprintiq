-- ============================================================================
-- Workspace Membership Debug Script
-- Created: 2026-01-26
-- Description: Investigate why RLS policy user_has_access = false for all users
-- ============================================================================

-- ============================================================================
-- 1. CHECK CURRENT USER AUTH
-- ============================================================================
SELECT '=== CURRENT USER AUTH ===' AS section;

SELECT
    auth.uid() AS current_user_id,
    CASE WHEN auth.uid() IS NOT NULL THEN 'AUTHENTICATED' ELSE 'NOT AUTHENTICATED - THIS IS THE PROBLEM' END AS auth_status;

-- ============================================================================
-- 2. CHECK ALL WORKSPACE_MEMBERS STATUS VALUES (case sensitivity issue?)
-- ============================================================================
SELECT '=== WORKSPACE MEMBER STATUS VALUES ===' AS section;

SELECT DISTINCT
    status,
    COUNT(*) as count,
    CASE
        WHEN status = 'active' THEN 'MATCHES RLS POLICY'
        WHEN LOWER(status) = 'active' THEN 'CASE MISMATCH - Policy expects lowercase "active"'
        ELSE 'DOES NOT MATCH RLS POLICY'
    END AS rls_compatibility
FROM workspace_members
GROUP BY status
ORDER BY count DESC;

-- ============================================================================
-- 3. CHECK IF CURRENT USER EXISTS IN WORKSPACE_MEMBERS
-- ============================================================================
SELECT '=== CURRENT USER MEMBERSHIPS ===' AS section;

SELECT
    wm.id,
    wm.workspace_id,
    wm.user_id,
    wm.status,
    wm.role,
    wm.created_at,
    CASE
        WHEN wm.status = 'active' THEN 'RLS WILL PASS'
        ELSE 'RLS WILL FAIL - status is not "active"'
    END AS rls_status
FROM workspace_members wm
WHERE wm.user_id = auth.uid();

-- ============================================================================
-- 4. CHECK FOR USER_ID MISMATCH (profiles vs auth.users)
-- ============================================================================
SELECT '=== USER ID VERIFICATION ===' AS section;

SELECT
    p.id AS profile_id,
    p.email,
    auth.uid() AS auth_uid,
    CASE
        WHEN p.id = auth.uid() THEN 'MATCH'
        ELSE 'MISMATCH - profile.id does not equal auth.uid()'
    END AS id_match_status
FROM profiles p
WHERE p.id = auth.uid()
   OR p.email = (SELECT email FROM auth.users WHERE id = auth.uid());

-- ============================================================================
-- 5. CHECK WORKSPACE_MEMBERS FOR ANY ISSUES
-- ============================================================================
SELECT '=== WORKSPACE_MEMBERS SAMPLE ===' AS section;

SELECT
    wm.user_id,
    wm.workspace_id,
    wm.status,
    wm.role,
    wm.user_id = auth.uid() AS is_current_user
FROM workspace_members wm
LIMIT 20;

-- ============================================================================
-- 6. DIRECT RLS POLICY TEST
-- ============================================================================
SELECT '=== DIRECT RLS POLICY TEST ===' AS section;

-- This exactly replicates the RLS policy check
SELECT
    s.id AS space_id,
    s.name AS space_name,
    s.workspace_id,
    EXISTS (
        SELECT 1 FROM workspace_members wm
        WHERE wm.workspace_id = s.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.status = 'active'
    ) AS rls_insert_allowed
FROM spaces s
WHERE s.deleted_at IS NULL
LIMIT 10;

-- ============================================================================
-- 7. FIND WHY RLS FAILS - BREAKDOWN
-- ============================================================================
SELECT '=== RLS FAILURE BREAKDOWN ===' AS section;

SELECT
    s.id AS space_id,
    s.workspace_id,
    auth.uid() AS current_auth_uid,
    (SELECT COUNT(*) FROM workspace_members wm WHERE wm.workspace_id = s.workspace_id) AS total_members_in_workspace,
    (SELECT COUNT(*) FROM workspace_members wm WHERE wm.workspace_id = s.workspace_id AND wm.user_id = auth.uid()) AS current_user_memberships,
    (SELECT status FROM workspace_members wm WHERE wm.workspace_id = s.workspace_id AND wm.user_id = auth.uid() LIMIT 1) AS current_user_status,
    (SELECT COUNT(*) FROM workspace_members wm WHERE wm.workspace_id = s.workspace_id AND wm.user_id = auth.uid() AND wm.status = 'active') AS active_memberships
FROM spaces s
WHERE s.deleted_at IS NULL
LIMIT 5;

-- ============================================================================
-- 8. CHECK IF STATUS COLUMN HAS UNUSUAL VALUES
-- ============================================================================
SELECT '=== STATUS COLUMN ANALYSIS ===' AS section;

SELECT
    status,
    LENGTH(status) AS status_length,
    ENCODE(status::bytea, 'hex') AS hex_representation,
    CASE
        WHEN status = 'active' THEN 'EXACT MATCH'
        WHEN status ILIKE 'active' THEN 'CASE INSENSITIVE MATCH ONLY'
        WHEN status LIKE '%active%' THEN 'CONTAINS "active" BUT HAS EXTRA CHARS'
        ELSE 'NO MATCH'
    END AS match_type
FROM workspace_members
GROUP BY status
ORDER BY COUNT(*) DESC;

-- ============================================================================
-- DIAGNOSIS
-- ============================================================================
SELECT '=== DIAGNOSIS ===' AS section;

SELECT
    'Check section 2 for status values' AS step_1,
    'If status is "Active" (capital A) instead of "active", that is the bug' AS hint_1,
    'Check section 3 to see if current user has any memberships' AS step_2,
    'If no rows returned, user is not in workspace_members table' AS hint_2,
    'Check section 7 for detailed breakdown of why RLS fails' AS step_3;
