-- ============================================================================
-- Step 12 of 13: FUNCTION PARAMETERS
-- Verifies archive_sprint() accepts p_sprint_id, p_archived_by, p_archive_notes.
-- Expected: 1 row with all param columns = PASS
-- ============================================================================

SELECT
  pg_get_function_arguments(p.oid) AS parameters,
  CASE WHEN pg_get_function_arguments(p.oid) LIKE '%p_sprint_id uuid%' THEN 'PASS' ELSE 'MISSING' END AS p_sprint_id,
  CASE WHEN pg_get_function_arguments(p.oid) LIKE '%p_archived_by uuid%' THEN 'PASS' ELSE 'MISSING' END AS p_archived_by,
  CASE WHEN pg_get_function_arguments(p.oid) LIKE '%p_archive_notes text%' THEN 'PASS' ELSE 'MISSING' END AS p_archive_notes
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname = 'archive_sprint';
