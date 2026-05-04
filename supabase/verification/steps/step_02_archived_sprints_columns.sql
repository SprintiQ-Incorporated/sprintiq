-- ============================================================================
-- Step 2 of 13: ARCHIVED_SPRINTS COLUMNS
-- Verifies all expected columns exist on the archived_sprints table.
-- Expected: All rows should show result = PASS
-- ============================================================================

WITH expected_cols AS (
  SELECT unnest(ARRAY[
    'id', 'original_sprint_id', 'sprint_id', 'name', 'goal',
    'start_date', 'end_date', 'duration', 'status',
    'workspace_id', 'space_id', 'project_id', 'sprint_folder_id',
    'planned_points', 'completed_points', 'velocity',
    'total_stories', 'completed_stories', 'completion_rate',
    'on_track', 'variance_points', 'burndown_data',
    'team_size', 'team_member_ids',
    'avg_cycle_time_ms', 'avg_lead_time_ms',
    'archived_at', 'archived_by', 'archive_notes',
    'original_created_at', 'original_updated_at'
  ]) AS col_name
)
SELECT
  e.col_name,
  CASE WHEN c.column_name IS NOT NULL THEN 'PASS' ELSE 'MISSING' END AS result
FROM expected_cols e
LEFT JOIN information_schema.columns c
  ON c.table_schema = 'public'
  AND c.table_name = 'archived_sprints'
  AND c.column_name = e.col_name
ORDER BY e.col_name;
