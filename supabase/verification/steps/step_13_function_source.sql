-- ============================================================================
-- Step 13 of 13: FUNCTION SOURCE - KEY OPERATIONS CHECK
-- Inspects the archive_sprint() function body for all required operations.
-- Expected: All rows should show result = PASS
-- ============================================================================

WITH fn_source AS (
  SELECT prosrc AS src
  FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'public' AND p.proname = 'archive_sprint'
),
checks AS (
  SELECT 'Sprint validation query' AS check_name,
    CASE WHEN src LIKE '%FROM sprints%' THEN 'PASS' ELSE 'FAIL' END AS result
  FROM fn_source
  UNION ALL
  SELECT 'Duplicate archive guard',
    CASE WHEN src LIKE '%already archived%' THEN 'PASS' ELSE 'FAIL' END
  FROM fn_source
  UNION ALL
  SELECT 'Metrics snapshot query',
    CASE WHEN src LIKE '%sprint_metrics%' THEN 'PASS' ELSE 'FAIL' END
  FROM fn_source
  UNION ALL
  SELECT 'Insert into archived_sprints',
    CASE WHEN src LIKE '%INSERT INTO archived_sprints%' THEN 'PASS' ELSE 'FAIL' END
  FROM fn_source
  UNION ALL
  SELECT 'Insert into archived_tasks',
    CASE WHEN src LIKE '%INSERT INTO archived_tasks%' THEN 'PASS' ELSE 'FAIL' END
  FROM fn_source
  UNION ALL
  SELECT 'Unlink tasks from sprint',
    CASE WHEN src LIKE '%sprint_id = NULL%' THEN 'PASS' ELSE 'FAIL' END
  FROM fn_source
  UNION ALL
  SELECT 'Soft-delete sprint',
    CASE WHEN src LIKE '%deleted_at%' THEN 'PASS' ELSE 'FAIL' END
  FROM fn_source
  UNION ALL
  SELECT 'Clean up sprint_metrics',
    CASE WHEN src LIKE '%DELETE FROM sprint_metrics%' THEN 'PASS' ELSE 'FAIL' END
  FROM fn_source
  UNION ALL
  SELECT 'Exception handler',
    CASE WHEN src LIKE '%EXCEPTION WHEN OTHERS%' THEN 'PASS' ELSE 'FAIL' END
  FROM fn_source
)
SELECT * FROM checks ORDER BY check_name;
