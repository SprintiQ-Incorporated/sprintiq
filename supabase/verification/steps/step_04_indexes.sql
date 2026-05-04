-- ============================================================================
-- Step 4 of 13: INDEXES
-- Verifies all 13 expected indexes exist on both archive tables.
-- Expected: All rows should show result = PASS
-- ============================================================================

WITH expected_indexes AS (
  SELECT unnest(ARRAY[
    'idx_archived_sprints_workspace',
    'idx_archived_sprints_space',
    'idx_archived_sprints_project',
    'idx_archived_sprints_dates',
    'idx_archived_sprints_archived_at',
    'idx_archived_sprints_original',
    'idx_archived_tasks_sprint',
    'idx_archived_tasks_assignee',
    'idx_archived_tasks_points',
    'idx_archived_tasks_priority',
    'idx_archived_tasks_completed',
    'idx_archived_tasks_ai_generated',
    'idx_archived_tasks_original'
  ]) AS index_name
)
SELECT
  e.index_name,
  CASE WHEN i.indexname IS NOT NULL THEN 'PASS' ELSE 'MISSING' END AS result
FROM expected_indexes e
LEFT JOIN pg_indexes i
  ON i.schemaname = 'public'
  AND i.indexname = e.index_name
ORDER BY e.index_name;
