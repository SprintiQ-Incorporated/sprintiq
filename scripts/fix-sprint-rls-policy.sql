-- ============================================================================
-- FIX: Sprint RLS Policy Failure
-- Created: 2026-01-26
-- Description: Fixes the RLS policy that prevents ALL users from creating sprints
--
-- ROOT CAUSE:
--   RLS policy checks `wm.status = 'active'` (lowercase)
--   But workspace_members.status may contain 'Active' (capitalized) or other values
--
-- RUN THIS SCRIPT TO FIX THE ISSUE
-- ============================================================================

-- ============================================================================
-- STEP 1: DIAGNOSE - Check current status values
-- ============================================================================
SELECT '=== CURRENT STATUS VALUES ===' AS section;

SELECT
    status,
    COUNT(*) AS count,
    CASE
        WHEN status = 'active' THEN 'OK - Matches RLS policy'
        WHEN LOWER(status) = 'active' THEN 'PROBLEM - Case mismatch (needs fix)'
        ELSE 'OTHER - Does not match "active"'
    END AS diagnosis
FROM workspace_members
GROUP BY status
ORDER BY count DESC;

-- ============================================================================
-- STEP 2: FIX - Normalize status values to lowercase
-- ============================================================================
SELECT '=== APPLYING FIX: Normalize status to lowercase ===' AS section;

-- Normalize all status values to lowercase
UPDATE workspace_members
SET status = LOWER(status)
WHERE status IS NOT NULL
AND status != LOWER(status);

-- Verify the fix
SELECT '=== VERIFICATION: Status values after fix ===' AS section;

SELECT
    status,
    COUNT(*) AS count
FROM workspace_members
GROUP BY status
ORDER BY count DESC;

-- ============================================================================
-- STEP 3: TEST - Verify RLS policy now works
-- ============================================================================
SELECT '=== RLS POLICY TEST ===' AS section;

SELECT
    s.id AS space_id,
    s.name AS space_name,
    EXISTS (
        SELECT 1 FROM workspace_members wm
        WHERE wm.workspace_id = s.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.status = 'active'
    ) AS rls_insert_allowed
FROM spaces s
WHERE s.deleted_at IS NULL
LIMIT 5;

-- ============================================================================
-- ALTERNATIVE FIX: Make RLS policies case-insensitive
-- Use this if you want to support mixed-case status values
-- ============================================================================

/*
-- Uncomment this block if you prefer case-insensitive RLS policies

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view sprints in their workspace" ON public.sprints;
DROP POLICY IF EXISTS "Users can create sprints in their workspace" ON public.sprints;
DROP POLICY IF EXISTS "Users can update sprints in their workspace" ON public.sprints;
DROP POLICY IF EXISTS "Users can delete sprints in their workspace" ON public.sprints;

-- Recreate with case-insensitive check
CREATE POLICY "Users can view sprints in their workspace"
    ON public.sprints FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.spaces s
            JOIN public.workspace_members wm ON wm.workspace_id = s.workspace_id
            WHERE s.id = sprints.space_id
            AND wm.user_id = auth.uid()
            AND LOWER(wm.status) = 'active'
        )
    );

CREATE POLICY "Users can create sprints in their workspace"
    ON public.sprints FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.spaces s
            JOIN public.workspace_members wm ON wm.workspace_id = s.workspace_id
            WHERE s.id = sprints.space_id
            AND wm.user_id = auth.uid()
            AND LOWER(wm.status) = 'active'
        )
    );

CREATE POLICY "Users can update sprints in their workspace"
    ON public.sprints FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.spaces s
            JOIN public.workspace_members wm ON wm.workspace_id = s.workspace_id
            WHERE s.id = sprints.space_id
            AND wm.user_id = auth.uid()
            AND LOWER(wm.status) = 'active'
        )
    );

CREATE POLICY "Users can delete sprints in their workspace"
    ON public.sprints FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.spaces s
            JOIN public.workspace_members wm ON wm.workspace_id = s.workspace_id
            WHERE s.id = sprints.space_id
            AND wm.user_id = auth.uid()
            AND LOWER(wm.status) = 'active'
        )
    );

-- Do the same for sprint_folders
DROP POLICY IF EXISTS "Users can view sprint_folders in their workspace" ON public.sprint_folders;
DROP POLICY IF EXISTS "Users can create sprint_folders in their workspace" ON public.sprint_folders;
DROP POLICY IF EXISTS "Users can update sprint_folders in their workspace" ON public.sprint_folders;
DROP POLICY IF EXISTS "Users can delete sprint_folders in their workspace" ON public.sprint_folders;

CREATE POLICY "Users can view sprint_folders in their workspace"
    ON public.sprint_folders FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.spaces s
            JOIN public.workspace_members wm ON wm.workspace_id = s.workspace_id
            WHERE s.id = sprint_folders.space_id
            AND wm.user_id = auth.uid()
            AND LOWER(wm.status) = 'active'
        )
    );

CREATE POLICY "Users can create sprint_folders in their workspace"
    ON public.sprint_folders FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.spaces s
            JOIN public.workspace_members wm ON wm.workspace_id = s.workspace_id
            WHERE s.id = sprint_folders.space_id
            AND wm.user_id = auth.uid()
            AND LOWER(wm.status) = 'active'
        )
    );

CREATE POLICY "Users can update sprint_folders in their workspace"
    ON public.sprint_folders FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.spaces s
            JOIN public.workspace_members wm ON wm.workspace_id = s.workspace_id
            WHERE s.id = sprint_folders.space_id
            AND wm.user_id = auth.uid()
            AND LOWER(wm.status) = 'active'
        )
    );

CREATE POLICY "Users can delete sprint_folders in their workspace"
    ON public.sprint_folders FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.spaces s
            JOIN public.workspace_members wm ON wm.workspace_id = s.workspace_id
            WHERE s.id = sprint_folders.space_id
            AND wm.user_id = auth.uid()
            AND LOWER(wm.status) = 'active'
        )
    );
*/

-- ============================================================================
-- SUMMARY
-- ============================================================================
SELECT '=== FIX APPLIED ===' AS section;

SELECT
    'workspace_members.status values have been normalized to lowercase' AS fix_applied,
    'RLS policies should now work correctly' AS expected_result,
    'Try creating a sprint again to verify' AS next_step;
