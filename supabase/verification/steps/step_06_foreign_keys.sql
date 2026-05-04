-- ============================================================================
-- Step 6 of 13: FOREIGN KEYS
-- Verifies all 5 expected foreign key constraints exist.
-- Expected: All rows should show result = PASS
-- ============================================================================

WITH expected_fks AS (
  SELECT unnest(ARRAY[
    'archived_sprints_workspace_id_fkey',
    'archived_sprints_space_id_fkey',
    'archived_sprints_project_id_fkey',
    'archived_sprints_archived_by_fkey',
    'archived_tasks_archived_sprint_id_fkey'
  ]) AS fk_name
)
SELECT
  e.fk_name,
  CASE WHEN tc.constraint_name IS NOT NULL THEN 'PASS' ELSE 'MISSING' END AS result
FROM expected_fks e
LEFT JOIN information_schema.table_constraints tc
  ON tc.constraint_schema = 'public'
  AND tc.constraint_name = e.fk_name
  AND tc.constraint_type = 'FOREIGN KEY'
ORDER BY e.fk_name;
