-- ============================================================================
-- Step 5 of 13: UNIQUE CONSTRAINTS
-- Verifies unique indexes on original_sprint_id and original_task_id.
-- Expected: 2 rows, both with is_unique = true and result = PASS
-- ============================================================================

SELECT
  indexname,
  (indexdef LIKE '%UNIQUE%') AS is_unique,
  CASE WHEN indexdef LIKE '%UNIQUE%' THEN 'PASS' ELSE 'NOT UNIQUE' END AS result
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname IN ('idx_archived_sprints_original', 'idx_archived_tasks_original')
ORDER BY indexname;
