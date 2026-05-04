-- ============================================================================
-- Step 10 of 13: GRANTS
-- Verifies SELECT and INSERT are granted to authenticated on both tables.
-- Expected: 4 rows, all with result = PASS
-- ============================================================================

SELECT
  table_name,
  privilege_type,
  grantee,
  'PASS' AS result
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN ('archived_sprints', 'archived_tasks')
  AND grantee = 'authenticated'
  AND privilege_type IN ('SELECT', 'INSERT')
ORDER BY table_name, privilege_type;
