-- ============================================================================
-- Step 3 of 13: ARCHIVED_TASKS COLUMNS
-- Verifies all expected columns exist on the archived_tasks table.
-- Expected: All rows should show result = PASS
-- ============================================================================

WITH expected_cols AS (
  SELECT unnest(ARRAY[
    'id', 'original_task_id', 'task_id', 'archived_sprint_id',
    'name', 'description', 'type',
    'assignee_id', 'assigned_member_id',
    'story_points', 'estimated_time', 'priority',
    'complexity', 'risk', 'business_value', 'user_impact', 'dependency_score',
    'final_status_name', 'final_status_type', 'was_completed',
    'created_at', 'started_at', 'completed_at',
    'cycle_time_ms', 'lead_time_ms',
    'generated_by_ai', 'epic_id',
    'tags', 'acceptance_criteria', 'acceptance_criteria_met',
    'archived_at'
  ]) AS col_name
)
SELECT
  e.col_name,
  CASE WHEN c.column_name IS NOT NULL THEN 'PASS' ELSE 'MISSING' END AS result
FROM expected_cols e
LEFT JOIN information_schema.columns c
  ON c.table_schema = 'public'
  AND c.table_name = 'archived_tasks'
  AND c.column_name = e.col_name
ORDER BY e.col_name;
