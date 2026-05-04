-- ============================================================================
-- Verify match_documents function has correct defaults
-- Expected: threshold 0.65, count 10
-- ============================================================================

-- Get function source to verify defaults
SELECT prosrc
FROM pg_proc
WHERE proname = 'match_documents'
LIMIT 1;

-- Alternative: Check parameter defaults
SELECT
    p.proname as function_name,
    pg_get_function_arguments(p.oid) as arguments,
    pg_get_function_result(p.oid) as returns
FROM pg_proc p
WHERE p.proname = 'match_documents';
