-- ============================================================================
-- TAWOS Vector Search Fix - Timeout + HNSW Index
-- ============================================================================
-- Copy and paste this entire script into Supabase SQL Editor and run it.
--
-- This script:
-- 1. Creates an HNSW index (faster than IVFFlat)
-- 2. Updates match_documents with 6-second timeout
-- 3. Drops the old IVFFlat index
-- ============================================================================

-- ============================================================================
-- STEP 1: Pre-flight checks
-- ============================================================================
DO $$
DECLARE
    v_row_count integer;
    v_embedding_count integer;
BEGIN
    SELECT count(*) INTO v_row_count FROM tawos_user_stories;
    SELECT count(*) INTO v_embedding_count FROM tawos_user_stories WHERE embedding IS NOT NULL;

    RAISE NOTICE '[PRE-FLIGHT] Table has % total rows, % with embeddings', v_row_count, v_embedding_count;
END $$;

-- Show current indexes
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'tawos_user_stories';

-- ============================================================================
-- STEP 2: Create HNSW index (faster than IVFFlat)
-- ============================================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE tablename = 'tawos_user_stories'
        AND indexname = 'tawos_user_stories_embedding_hnsw_idx'
    ) THEN
        RAISE NOTICE '[INDEX] Creating HNSW index... (this may take a moment)';
    ELSE
        RAISE NOTICE '[INDEX] HNSW index already exists';
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS tawos_user_stories_embedding_hnsw_idx
ON tawos_user_stories
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- ============================================================================
-- STEP 3: Drop the slower IVFFlat index
-- ============================================================================
DROP INDEX IF EXISTS tawos_user_stories_embedding_ivfflat_idx;

-- ============================================================================
-- STEP 4: Update match_documents function with timeout
-- ============================================================================
DROP FUNCTION IF EXISTS match_documents(vector(1536), float, int, jsonb);

CREATE OR REPLACE FUNCTION match_documents(
    query_embedding vector(1536),
    match_threshold float DEFAULT 0.65,
    match_count int DEFAULT 10,
    filter jsonb DEFAULT '{}'
)
RETURNS TABLE (
    id UUID,
    similarity float,
    metadata jsonb
)
LANGUAGE sql
STABLE
SET statement_timeout = '6s'
AS $$
    SELECT
        tawos_user_stories.id,
        1 - (tawos_user_stories.embedding <=> query_embedding) AS similarity,
        tawos_user_stories.metadata
    FROM tawos_user_stories
    WHERE tawos_user_stories.embedding IS NOT NULL
        AND 1 - (tawos_user_stories.embedding <=> query_embedding) > match_threshold
    ORDER BY tawos_user_stories.embedding <=> query_embedding
    LIMIT match_count;
$$;

COMMENT ON FUNCTION match_documents(vector(1536), float, int, jsonb) IS
'Vector similarity search for TAWOS user stories.
- Uses HNSW index for fast cosine similarity search
- Has 6-second timeout (returns error 57014 on timeout)
- Expected performance: <500ms with HNSW index';

-- ============================================================================
-- STEP 5: Verify everything
-- ============================================================================

-- Check function has timeout
SELECT
    'Function Config' AS check_type,
    CASE WHEN proconfig @> ARRAY['statement_timeout=6s']
         THEN '✓ statement_timeout=6s'
         ELSE '✗ Missing timeout' END AS status
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' AND p.proname = 'match_documents';

-- Check HNSW index exists
SELECT
    'HNSW Index' AS check_type,
    CASE WHEN EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE tablename = 'tawos_user_stories'
        AND indexname = 'tawos_user_stories_embedding_hnsw_idx'
    ) THEN '✓ HNSW index exists'
    ELSE '✗ HNSW index missing' END AS status;

-- Check IVFFlat removed
SELECT
    'IVFFlat Removed' AS check_type,
    CASE WHEN NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE tablename = 'tawos_user_stories'
        AND indexname = 'tawos_user_stories_embedding_ivfflat_idx'
    ) THEN '✓ IVFFlat index removed'
    ELSE '⚠ IVFFlat index still exists' END AS status;

-- Final index list
SELECT indexname FROM pg_indexes WHERE tablename = 'tawos_user_stories';

SELECT '=== MIGRATION COMPLETE ===' AS status;
