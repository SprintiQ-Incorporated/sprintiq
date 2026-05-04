-- ============================================================================
-- Diagnostic: Find all completed sprints for user da4cc03b-4949-44a8-936f-41f300bf0162
-- Run this in the Supabase SQL Editor BEFORE the backfill migration.
-- ============================================================================

-- ============================================================================
-- 1. Confirm the user exists
-- ============================================================================
SELECT
  id,
  full_name,
  email,
  created_at
FROM profiles
WHERE id = 'da4cc03b-4949-44a8-936f-41f300bf0162';

-- ============================================================================
-- 2. Show user's workspace memberships
-- ============================================================================
SELECT
  wm.workspace_id,
  w.name AS workspace_name,
  wm.status AS membership_status,
  wm.role
FROM workspace_members wm
JOIN workspaces w ON w.id = wm.workspace_id
WHERE wm.user_id = 'da4cc03b-4949-44a8-936f-41f300bf0162'
ORDER BY w.name;

-- ============================================================================
-- 3. Find all completed sprints across user's workspaces
--    (excluding already-archived and soft-deleted sprints)
-- ============================================================================
SELECT
  s.id AS sprint_uuid,
  s.sprint_id,
  s.name,
  s.goal,
  s.status,
  s.start_date,
  s.end_date,
  s.workspace_id,
  w.name AS workspace_name,
  sp.name AS space_name,
  p.name AS project_name,
  sf.name AS folder_name,
  s.created_at,
  s.deleted_at,
  CASE
    WHEN s.deleted_at IS NOT NULL THEN 'SOFT-DELETED'
    ELSE 'ACTIVE'
  END AS state,
  CASE
    WHEN EXISTS (SELECT 1 FROM archived_sprints a WHERE a.original_sprint_id = s.id)
    THEN 'YES'
    ELSE 'NO'
  END AS already_archived,
  (SELECT COUNT(*) FROM tasks t
   WHERE t.sprint_id = s.id AND t.deleted_at IS NULL) AS linked_task_count,
  (SELECT COALESCE(SUM(t.story_points), 0) FROM tasks t
   WHERE t.sprint_id = s.id AND t.deleted_at IS NULL) AS total_points
FROM sprints s
JOIN workspaces w ON s.workspace_id = w.id
LEFT JOIN spaces sp ON s.space_id = sp.id
LEFT JOIN projects p ON s.project_id = p.id
LEFT JOIN sprint_folders sf ON s.sprint_folder_id = sf.id
WHERE s.status = 'completed'
  AND EXISTS (
    SELECT 1 FROM workspace_members wm
    WHERE wm.workspace_id = s.workspace_id
      AND wm.user_id = 'da4cc03b-4949-44a8-936f-41f300bf0162'
      AND wm.status = 'active'
  )
ORDER BY s.end_date DESC NULLS LAST, s.created_at DESC;

-- ============================================================================
-- 4. Summary counts
-- ============================================================================
SELECT
  COUNT(*) AS total_completed_sprints,
  COUNT(*) FILTER (WHERE s.deleted_at IS NULL) AS active_completed,
  COUNT(*) FILTER (WHERE s.deleted_at IS NOT NULL) AS soft_deleted_completed,
  COUNT(*) FILTER (
    WHERE EXISTS (SELECT 1 FROM archived_sprints a WHERE a.original_sprint_id = s.id)
  ) AS already_archived,
  COUNT(*) FILTER (
    WHERE NOT EXISTS (SELECT 1 FROM archived_sprints a WHERE a.original_sprint_id = s.id)
  ) AS needs_backfill
FROM sprints s
WHERE s.status = 'completed'
  AND EXISTS (
    SELECT 1 FROM workspace_members wm
    WHERE wm.workspace_id = s.workspace_id
      AND wm.user_id = 'da4cc03b-4949-44a8-936f-41f300bf0162'
      AND wm.status = 'active'
  );
