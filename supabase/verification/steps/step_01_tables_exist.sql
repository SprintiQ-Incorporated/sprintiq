-- ============================================================================
-- Step 1 of 13: TABLES EXIST
-- Verifies that both archived_sprints and archived_tasks tables were created.
-- Expected: 2 rows, both with result = PASS
-- ============================================================================

SELECT
  table_name,
  CASE WHEN table_name IS NOT NULL THEN 'PASS' END AS result
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('archived_sprints', 'archived_tasks')
ORDER BY table_name;
