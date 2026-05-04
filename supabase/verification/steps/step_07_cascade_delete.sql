-- ============================================================================
-- Step 7 of 13: CASCADE DELETE
-- Verifies that archived_tasks cascade-delete with their parent sprint.
-- Expected: 1 row with delete_rule = CASCADE and result = PASS
-- ============================================================================

SELECT
  rc.constraint_name,
  rc.delete_rule,
  CASE WHEN rc.delete_rule = 'CASCADE' THEN 'PASS' ELSE 'FAIL' END AS result
FROM information_schema.referential_constraints rc
WHERE rc.constraint_name = 'archived_tasks_archived_sprint_id_fkey';
