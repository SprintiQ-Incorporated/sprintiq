-- ============================================================================
-- Step 9 of 13: RLS POLICIES
-- Verifies all 4 expected RLS policies exist on the archive tables.
-- Expected: All rows should show result = PASS
-- ============================================================================

WITH expected_policies AS (
  SELECT unnest(ARRAY[
    'Users can view archived sprints in their workspace',
    'Workspace members can archive sprints',
    'Users can view archived tasks in their workspace',
    'Workspace members can insert archived tasks'
  ]) AS policy_name
)
SELECT
  e.policy_name,
  COALESCE(p.tablename, 'N/A') AS table_name,
  CASE WHEN p.policyname IS NOT NULL THEN 'PASS' ELSE 'MISSING' END AS result
FROM expected_policies e
LEFT JOIN pg_policies p
  ON p.schemaname = 'public'
  AND p.policyname = e.policy_name
ORDER BY e.policy_name;
