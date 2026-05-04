-- ============================================================================
-- Step 8 of 13: RLS ENABLED
-- Verifies Row Level Security is enabled on both archive tables.
-- Expected: 2 rows, both with rls_enabled = true and result = PASS
-- ============================================================================

SELECT
  c.relname AS table_name,
  c.relrowsecurity AS rls_enabled,
  CASE WHEN c.relrowsecurity THEN 'PASS' ELSE 'FAIL' END AS result
FROM pg_class c
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE n.nspname = 'public'
  AND c.relname IN ('archived_sprints', 'archived_tasks')
ORDER BY c.relname;
