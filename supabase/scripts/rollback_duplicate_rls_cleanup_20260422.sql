-- ============================================================================
-- MANUAL ROLLBACK for 20260422_cleanup_duplicate_rls_policies.sql
--
-- NOT a migration — lives in supabase/scripts/ so it will NOT auto-apply
-- via `supabase db push`. Run manually in the Supabase SQL editor ONLY if
-- the cleanup migration caused an incident.
--
-- Recreates the 14 `_policy`-suffixed duplicate RLS policies on projects,
-- spaces, workspaces, and space_members. Plus 10 additional CREATEs for
-- sprint_folders / sprints / statuses (harmless — those tables already had
-- these names cleaned up by earlier migrations; the CREATEs restore the
-- original Nov 2024 shape if for some reason it's needed).
--
-- Each statement uses DROP POLICY IF EXISTS + CREATE so it's idempotent.
--
-- Originally from: 20260123_cleanup_duplicate_rls_policies_rollback.sql
-- (deleted from supabase/migrations/ in the same commit that introduced
--  the 20260422 cleanup migration).
-- ============================================================================

BEGIN;

-- ============================================================================
-- WORKSPACES TABLE (recreate 4 policies)
-- ============================================================================
-- Note: Using DROP IF EXISTS + CREATE to make idempotent

DROP POLICY IF EXISTS "workspaces_select_policy" ON public.workspaces;
CREATE POLICY "workspaces_select_policy" ON public.workspaces
FOR SELECT TO authenticated
USING (
    owner_id = auth.uid()
    OR id IN (
        SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
    )
);

DROP POLICY IF EXISTS "workspaces_insert_policy" ON public.workspaces;
CREATE POLICY "workspaces_insert_policy" ON public.workspaces
FOR INSERT TO authenticated
WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "workspaces_update_policy" ON public.workspaces;
CREATE POLICY "workspaces_update_policy" ON public.workspaces
FOR UPDATE TO authenticated
USING (
    owner_id = auth.uid()
    OR id IN (
        SELECT workspace_id FROM public.workspace_members
        WHERE user_id = auth.uid() AND role = 'owner'
    )
);

DROP POLICY IF EXISTS "workspaces_delete_policy" ON public.workspaces;
CREATE POLICY "workspaces_delete_policy" ON public.workspaces
FOR DELETE TO authenticated
USING (owner_id = auth.uid());

-- ============================================================================
-- PROJECTS TABLE (recreate 4 policies)
-- ============================================================================

DROP POLICY IF EXISTS "projects_select_policy" ON public.projects;
CREATE POLICY "projects_select_policy" ON public.projects
FOR SELECT TO authenticated
USING (
    workspace_id IN (
        SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
    )
);

DROP POLICY IF EXISTS "projects_insert_policy" ON public.projects;
CREATE POLICY "projects_insert_policy" ON public.projects
FOR INSERT TO authenticated
WITH CHECK (
    workspace_id IN (
        SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
    )
);

DROP POLICY IF EXISTS "projects_update_policy" ON public.projects;
CREATE POLICY "projects_update_policy" ON public.projects
FOR UPDATE TO authenticated
USING (
    workspace_id IN (
        SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
    )
);

DROP POLICY IF EXISTS "projects_delete_policy" ON public.projects;
CREATE POLICY "projects_delete_policy" ON public.projects
FOR DELETE TO authenticated
USING (
    workspace_id IN (
        SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
    )
);

-- ============================================================================
-- SPACES TABLE (recreate 4 policies)
-- ============================================================================

DROP POLICY IF EXISTS "spaces_select_policy" ON public.spaces;
CREATE POLICY "spaces_select_policy" ON public.spaces
FOR SELECT TO authenticated
USING (
    workspace_id IN (
        SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
    )
);

DROP POLICY IF EXISTS "spaces_insert_policy" ON public.spaces;
CREATE POLICY "spaces_insert_policy" ON public.spaces
FOR INSERT TO authenticated
WITH CHECK (
    workspace_id IN (
        SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
    )
);

DROP POLICY IF EXISTS "spaces_update_policy" ON public.spaces;
CREATE POLICY "spaces_update_policy" ON public.spaces
FOR UPDATE TO authenticated
USING (
    workspace_id IN (
        SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
    )
);

DROP POLICY IF EXISTS "spaces_delete_policy" ON public.spaces;
CREATE POLICY "spaces_delete_policy" ON public.spaces
FOR DELETE TO authenticated
USING (
    workspace_id IN (
        SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
    )
);

-- ============================================================================
-- SPRINT_FOLDERS TABLE (recreate 4 policies)
-- ============================================================================

DROP POLICY IF EXISTS "Users can view sprint_folders in their workspace" ON public.sprint_folders;
CREATE POLICY "Users can view sprint_folders in their workspace"
ON public.sprint_folders FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.spaces s
        JOIN public.workspace_members wm ON wm.workspace_id = s.workspace_id
        WHERE s.id = sprint_folders.space_id
        AND wm.user_id = auth.uid()
        AND wm.status = 'active'
    )
);

DROP POLICY IF EXISTS "Users can create sprint_folders in their workspace" ON public.sprint_folders;
CREATE POLICY "Users can create sprint_folders in their workspace"
ON public.sprint_folders FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.spaces s
        JOIN public.workspace_members wm ON wm.workspace_id = s.workspace_id
        WHERE s.id = sprint_folders.space_id
        AND wm.user_id = auth.uid()
        AND wm.status = 'active'
    )
);

DROP POLICY IF EXISTS "Users can update sprint_folders in their workspace" ON public.sprint_folders;
CREATE POLICY "Users can update sprint_folders in their workspace"
ON public.sprint_folders FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM public.spaces s
        JOIN public.workspace_members wm ON wm.workspace_id = s.workspace_id
        WHERE s.id = sprint_folders.space_id
        AND wm.user_id = auth.uid()
        AND wm.status = 'active'
    )
);

DROP POLICY IF EXISTS "Users can delete sprint_folders in their workspace" ON public.sprint_folders;
CREATE POLICY "Users can delete sprint_folders in their workspace"
ON public.sprint_folders FOR DELETE
USING (
    EXISTS (
        SELECT 1 FROM public.spaces s
        JOIN public.workspace_members wm ON wm.workspace_id = s.workspace_id
        WHERE s.id = sprint_folders.space_id
        AND wm.user_id = auth.uid()
        AND wm.status = 'active'
    )
);

-- ============================================================================
-- SPRINTS TABLE (recreate 4 policies)
-- ============================================================================

DROP POLICY IF EXISTS "Users can view sprints in their workspace" ON public.sprints;
CREATE POLICY "Users can view sprints in their workspace"
ON public.sprints FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.spaces s
        JOIN public.workspace_members wm ON wm.workspace_id = s.workspace_id
        WHERE s.id = sprints.space_id
        AND wm.user_id = auth.uid()
        AND wm.status = 'active'
    )
);

DROP POLICY IF EXISTS "Users can create sprints in their workspace" ON public.sprints;
CREATE POLICY "Users can create sprints in their workspace"
ON public.sprints FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.spaces s
        JOIN public.workspace_members wm ON wm.workspace_id = s.workspace_id
        WHERE s.id = sprints.space_id
        AND wm.user_id = auth.uid()
        AND wm.status = 'active'
    )
);

DROP POLICY IF EXISTS "Users can update sprints in their workspace" ON public.sprints;
CREATE POLICY "Users can update sprints in their workspace"
ON public.sprints FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM public.spaces s
        JOIN public.workspace_members wm ON wm.workspace_id = s.workspace_id
        WHERE s.id = sprints.space_id
        AND wm.user_id = auth.uid()
        AND wm.status = 'active'
    )
);

DROP POLICY IF EXISTS "Users can delete sprints in their workspace" ON public.sprints;
CREATE POLICY "Users can delete sprints in their workspace"
ON public.sprints FOR DELETE
USING (
    EXISTS (
        SELECT 1 FROM public.spaces s
        JOIN public.workspace_members wm ON wm.workspace_id = s.workspace_id
        WHERE s.id = sprints.space_id
        AND wm.user_id = auth.uid()
        AND wm.status = 'active'
    )
);

-- ============================================================================
-- STATUSES TABLE (recreate 2 policies)
-- ============================================================================
-- Note: These policy names may vary based on actual database state

DROP POLICY IF EXISTS "Workspace members can view statuses" ON public.statuses;
CREATE POLICY "Workspace members can view statuses"
ON public.statuses FOR SELECT TO public
USING (
    EXISTS (
        SELECT 1 FROM public.workspace_members wm
        WHERE wm.workspace_id = statuses.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.status = 'active'
    )
);

DROP POLICY IF EXISTS "Workspace members can update status colors" ON public.statuses;
CREATE POLICY "Workspace members can update status colors"
ON public.statuses FOR UPDATE TO public
USING (
    EXISTS (
        SELECT 1 FROM public.workspace_members wm
        WHERE wm.workspace_id = statuses.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.status = 'active'
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.workspace_members wm
        WHERE wm.workspace_id = statuses.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.status = 'active'
    )
);

-- ============================================================================
-- SPACE_MEMBERS TABLE (recreate 2 policies)
-- ============================================================================

DROP POLICY IF EXISTS "space_members_select_policy" ON public.space_members;
CREATE POLICY "space_members_select_policy" ON public.space_members
FOR SELECT TO authenticated
USING (
    space_id IN (
        SELECT s.id FROM public.spaces s
        JOIN public.workspace_members wm ON s.workspace_id = wm.workspace_id
        WHERE wm.user_id = auth.uid()
    )
);

DROP POLICY IF EXISTS "space_members_insert_policy" ON public.space_members;
CREATE POLICY "space_members_insert_policy" ON public.space_members
FOR INSERT TO authenticated
WITH CHECK (
    space_id IN (
        SELECT s.id FROM public.spaces s
        JOIN public.workspace_members wm ON s.workspace_id = wm.workspace_id
        WHERE wm.user_id = auth.uid()
    )
);

COMMIT;

-- ============================================================================
-- POST-ROLLBACK VERIFICATION
-- ============================================================================
/*
-- Should return 8 policies for most tables, 6 for statuses and space_members
SELECT tablename, COUNT(*) as policy_count
FROM pg_policies
WHERE tablename IN ('workspaces','projects','spaces','sprint_folders','sprints','statuses','space_members')
GROUP BY tablename
ORDER BY tablename;

-- Expected output (back to original state):
-- projects       | 8
-- space_members  | 6
-- spaces         | 8
-- sprint_folders | 8
-- sprints        | 8
-- statuses       | 6
-- workspaces     | 8
*/
-- ============================================================================
