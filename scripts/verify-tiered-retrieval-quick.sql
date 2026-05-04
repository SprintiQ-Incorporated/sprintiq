-- ============================================================================
-- TAWOS Tiered Retrieval QUICK Verification
-- Run each section SEPARATELY to avoid timeouts
-- ============================================================================

-- ============================================================================
-- SECTION 1: Basic Table Check (run first)
-- ============================================================================
SELECT 'Table exists' as check,
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_name = 'tawos_user_stories'
    ) THEN 'PASS' ELSE 'FAIL' END as result;

-- ============================================================================
-- SECTION 2: Vector Extension (run separately)
-- ============================================================================
SELECT 'Vector extension' as check,
    CASE WHEN EXISTS (
        SELECT 1 FROM pg_extension WHERE extname = 'vector'
    ) THEN 'PASS' ELSE 'FAIL' END as result;

-- ============================================================================
-- SECTION 3: Index Check (run separately)
-- ============================================================================
SELECT 'HNSW index' as check,
    CASE WHEN EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE tablename = 'tawos_user_stories'
        AND indexname LIKE '%embedding%'
    ) THEN 'PASS' ELSE 'FAIL' END as result;

-- ============================================================================
-- SECTION 4: Function Check (run separately)
-- ============================================================================
SELECT 'match_documents function' as check,
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.routines
        WHERE routine_name = 'match_documents'
    ) THEN 'PASS' ELSE 'FAIL' END as result;

-- ============================================================================
-- SECTION 5: Record Count (run separately)
-- ============================================================================
SELECT
    COUNT(*) as total_records,
    COUNT(embedding) as with_embeddings
FROM tawos_user_stories;

-- ============================================================================
-- SECTION 6: Coverage Percentage (run separately)
-- ============================================================================
SELECT
    ROUND(COUNT(embedding)::numeric / NULLIF(COUNT(*), 0)::numeric * 100, 2) as coverage_percent
FROM tawos_user_stories;
