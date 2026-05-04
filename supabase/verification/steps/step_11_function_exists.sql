-- ============================================================================
-- Step 11 of 13: FUNCTION EXISTS WITH CORRECT SIGNATURE
-- Verifies archive_sprint() exists, returns UUID, is SECURITY DEFINER,
-- and has search_path set to public.
-- Expected: 1 row with all check columns = PASS
-- ============================================================================

SELECT
  p.proname AS function_name,
  pg_get_function_result(p.oid) AS return_type,
  CASE WHEN pg_get_function_result(p.oid) = 'uuid' THEN 'PASS' ELSE 'FAIL' END AS return_check,
  p.prosecdef AS is_security_definer,
  CASE WHEN p.prosecdef THEN 'PASS' ELSE 'FAIL' END AS secdef_check,
  p.proconfig AS config,
  CASE WHEN p.proconfig @> ARRAY['search_path=public'] THEN 'PASS' ELSE 'FAIL' END AS search_path_check
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname = 'archive_sprint';
