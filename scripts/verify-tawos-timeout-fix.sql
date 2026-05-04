-- ============================================================================
-- TAWOS Vector Search - Verification Script
-- ============================================================================
-- Run this AFTER apply-tawos-timeout-fix.sql to verify the changes.
-- ============================================================================

-- TEST 1: Function has timeout configured
SELECT
    'TEST 1: Function Timeout' AS test,
    CASE WHEN proconfig @> ARRAY['statement_timeout=6s']
         THEN '✓ PASS'
         ELSE '✗ FAIL' END AS result,
    proconfig AS config
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' AND p.proname = 'match_documents';

-- TEST 2: HNSW index exists
SELECT
    'TEST 2: HNSW Index' AS test,
    CASE WHEN count(*) > 0 THEN '✓ PASS' ELSE '✗ FAIL' END AS result
FROM pg_indexes
WHERE tablename = 'tawos_user_stories'
AND indexname = 'tawos_user_stories_embedding_hnsw_idx';

-- TEST 3: IVFFlat index removed
SELECT
    'TEST 3: IVFFlat Removed' AS test,
    CASE WHEN count(*) = 0 THEN '✓ PASS' ELSE '⚠ Still exists' END AS result
FROM pg_indexes
WHERE tablename = 'tawos_user_stories'
AND indexname = 'tawos_user_stories_embedding_ivfflat_idx';

-- TEST 4: Table statistics
SELECT
    'TEST 4: Data Status' AS test,
    count(*) AS total_rows,
    count(*) FILTER (WHERE embedding IS NOT NULL) AS with_embeddings
FROM tawos_user_stories;

-- TEST 5: List all indexes on table
SELECT 'Current Indexes:' AS info;
SELECT indexname,
       CASE
           WHEN indexname LIKE '%hnsw%' THEN 'HNSW (optimal)'
           WHEN indexname LIKE '%ivfflat%' THEN 'IVFFlat (slower)'
           WHEN indexname LIKE '%pkey%' THEN 'Primary Key'
           ELSE 'Other'
       END AS index_type
FROM pg_indexes
WHERE tablename = 'tawos_user_stories';

-- TEST 6: Quick performance test
DO $$
DECLARE
    v_start timestamp;
    v_duration_ms integer;
    v_count integer;
    v_test_embedding vector(1536);
BEGIN
    -- Create normalized test vector
    v_test_embedding := (SELECT array_agg(0.01)::vector(1536) FROM generate_series(1, 1536));

    v_start := clock_timestamp();

    SELECT count(*) INTO v_count
    FROM match_documents(v_test_embedding, 0.65, 10);

    v_duration_ms := EXTRACT(MILLISECONDS FROM (clock_timestamp() - v_start));

    RAISE NOTICE 'TEST 6: Performance - % ms, % results', v_duration_ms, v_count;

    IF v_duration_ms < 500 THEN
        RAISE NOTICE '  Result: ✓ PASS (excellent, <500ms)';
    ELSIF v_duration_ms < 2000 THEN
        RAISE NOTICE '  Result: ✓ PASS (good, <2s)';
    ELSIF v_duration_ms < 6000 THEN
        RAISE NOTICE '  Result: ⚠ SLOW (approaching timeout)';
    ELSE
        RAISE NOTICE '  Result: ✗ FAIL (would timeout)';
    END IF;
END $$;

SELECT '=== VERIFICATION COMPLETE ===' AS status;
