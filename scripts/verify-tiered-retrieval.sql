-- ============================================================================
-- TAWOS Tiered Retrieval Verification Script
-- Run this in Supabase SQL Editor to verify all changes are working
-- ============================================================================

-- ============================================================================
-- 1. VERIFY TABLE EXISTS AND STRUCTURE
-- ============================================================================

SELECT '=== 1. TABLE STRUCTURE VERIFICATION ===' as section;

-- Check tawos_user_stories table exists
SELECT
    table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'tawos_user_stories'
ORDER BY ordinal_position;

-- Check for vector extension
SELECT '=== Vector Extension Check ===' as check_name;
SELECT * FROM pg_extension WHERE extname = 'vector';

-- ============================================================================
-- 2. VERIFY INDEX EXISTS
-- ============================================================================

SELECT '=== 2. INDEX VERIFICATION ===' as section;

SELECT
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'tawos_user_stories';

-- ============================================================================
-- 3. VERIFY FUNCTION EXISTS WITH NEW DEFAULTS
-- ============================================================================

SELECT '=== 3. FUNCTION VERIFICATION ===' as section;

-- Check match_documents function exists and get its definition
SELECT
    routine_name,
    routine_type,
    data_type as return_type
FROM information_schema.routines
WHERE routine_name = 'match_documents';

-- Get function parameters (should show defaults 0.65 and 10)
SELECT
    p.parameter_name,
    p.data_type,
    p.parameter_default
FROM information_schema.parameters p
JOIN information_schema.routines r ON p.specific_name = r.specific_name
WHERE r.routine_name = 'match_documents'
ORDER BY p.ordinal_position;

-- ============================================================================
-- 4. VERIFY EMBEDDING COVERAGE
-- ============================================================================

SELECT '=== 4. EMBEDDING COVERAGE ===' as section;

SELECT
    COUNT(*) as total_records,
    COUNT(embedding) as with_embeddings,
    COUNT(*) - COUNT(embedding) as missing_embeddings,
    ROUND(COUNT(embedding)::numeric / COUNT(*)::numeric * 100, 2) as coverage_percent
FROM tawos_user_stories;

-- ============================================================================
-- 5. VERIFY EMBEDDING DIMENSIONS
-- ============================================================================

SELECT '=== 5. EMBEDDING DIMENSIONS ===' as section;

SELECT
    vector_dims(embedding) as dimension,
    COUNT(*) as count
FROM tawos_user_stories
WHERE embedding IS NOT NULL
GROUP BY vector_dims(embedding);

-- ============================================================================
-- 6. VERIFY METADATA STRUCTURE
-- ============================================================================

SELECT '=== 6. METADATA STRUCTURE ===' as section;

-- Check what keys exist in metadata
SELECT DISTINCT jsonb_object_keys(metadata) as metadata_key
FROM tawos_user_stories
WHERE metadata IS NOT NULL
LIMIT 20;

-- ============================================================================
-- 7. VERIFY COMPLETION RATE DISTRIBUTION
-- ============================================================================

SELECT '=== 7. COMPLETION RATE DISTRIBUTION ===' as section;

SELECT
    CASE
        WHEN (metadata->>'completionRate')::float >= 0.8 THEN 'High (80%+) - Success Patterns'
        WHEN (metadata->>'completionRate')::float >= 0.6 THEN 'Medium (60-80%)'
        WHEN (metadata->>'completionRate')::float < 0.6 THEN 'Low (<60%) - Anti-Patterns'
        ELSE 'Unknown'
    END as rate_category,
    COUNT(*) as count,
    ROUND(AVG((metadata->>'completionRate')::float) * 100, 1) as avg_rate_percent
FROM tawos_user_stories
WHERE metadata->>'completionRate' IS NOT NULL
GROUP BY rate_category
ORDER BY avg_rate_percent DESC;

-- ============================================================================
-- 8. VERIFY FRAMEWORK/TAG DISTRIBUTION
-- ============================================================================

SELECT '=== 8. FRAMEWORK DISTRIBUTION ===' as section;

WITH tag_data AS (
    SELECT
        LOWER(tag::text) as tag
    FROM tawos_user_stories,
         jsonb_array_elements_text(metadata->'tags') as tag
    WHERE metadata->'tags' IS NOT NULL
)
SELECT
    tag,
    COUNT(*) as count,
    ROUND(COUNT(*)::numeric / (SELECT COUNT(*) FROM tag_data)::numeric * 100, 2) as percentage
FROM tag_data
GROUP BY tag
ORDER BY count DESC
LIMIT 20;

-- ============================================================================
-- 9. TEST MATCH_DOCUMENTS WITH DIFFERENT THRESHOLDS
-- ============================================================================

SELECT '=== 9. THRESHOLD TESTING ===' as section;

-- Note: This requires a sample embedding. If you have one, uncomment and run:
-- Replace the embedding array with an actual embedding from your data

/*
-- Get a sample embedding for testing
WITH sample AS (
    SELECT embedding
    FROM tawos_user_stories
    WHERE embedding IS NOT NULL
    LIMIT 1
)
-- Test with threshold 0.75 (success patterns)
SELECT
    '0.75 threshold' as test,
    COUNT(*) as result_count
FROM match_documents(
    (SELECT embedding FROM sample),
    0.75,  -- High threshold for success patterns
    10,
    '{}'::jsonb
);

-- Test with threshold 0.65 (balanced)
WITH sample AS (
    SELECT embedding
    FROM tawos_user_stories
    WHERE embedding IS NOT NULL
    LIMIT 1
)
SELECT
    '0.65 threshold' as test,
    COUNT(*) as result_count
FROM match_documents(
    (SELECT embedding FROM sample),
    0.65,  -- Balanced threshold
    10,
    '{}'::jsonb
);

-- Test with threshold 0.60 (anti-patterns)
WITH sample AS (
    SELECT embedding
    FROM tawos_user_stories
    WHERE embedding IS NOT NULL
    LIMIT 1
)
SELECT
    '0.60 threshold' as test,
    COUNT(*) as result_count
FROM match_documents(
    (SELECT embedding FROM sample),
    0.60,  -- Low threshold for anti-patterns
    10,
    '{}'::jsonb
);
*/

-- ============================================================================
-- 10. VERIFY SUCCESS PATTERNS EXIST
-- ============================================================================

SELECT '=== 10. SUCCESS PATTERNS CHECK ===' as section;

SELECT
    COUNT(*) as total_success_patterns,
    COUNT(CASE WHEN metadata->>'successPattern' IS NOT NULL THEN 1 END) as with_success_pattern_field,
    COUNT(CASE WHEN (metadata->>'completionRate')::float >= 0.8 THEN 1 END) as high_completion_rate
FROM tawos_user_stories;

-- ============================================================================
-- 11. VERIFY ANTI-PATTERNS EXIST
-- ============================================================================

SELECT '=== 11. ANTI-PATTERNS CHECK ===' as section;

SELECT
    COUNT(*) as total_with_anti_patterns,
    COUNT(CASE WHEN jsonb_array_length(metadata->'antiPatterns') > 0 THEN 1 END) as with_anti_patterns_array,
    COUNT(CASE WHEN (metadata->>'completionRate')::float < 0.6 THEN 1 END) as low_completion_rate
FROM tawos_user_stories
WHERE metadata->'antiPatterns' IS NOT NULL;

-- ============================================================================
-- 12. SAMPLE DATA CHECK
-- ============================================================================

SELECT '=== 12. SAMPLE DATA CHECK ===' as section;

-- Show sample records with key fields
SELECT
    id,
    metadata->>'title' as title,
    metadata->>'completionRate' as completion_rate,
    metadata->>'complexity' as complexity,
    metadata->'tags' as tags,
    CASE WHEN embedding IS NOT NULL THEN 'Yes' ELSE 'No' END as has_embedding
FROM tawos_user_stories
LIMIT 5;

-- ============================================================================
-- 13. VERIFICATION SUMMARY
-- ============================================================================

SELECT '=== VERIFICATION SUMMARY ===' as section;

SELECT
    'Total Records' as metric,
    COUNT(*)::text as value
FROM tawos_user_stories
UNION ALL
SELECT
    'Embedding Coverage %',
    ROUND(COUNT(embedding)::numeric / NULLIF(COUNT(*), 0)::numeric * 100, 2)::text
FROM tawos_user_stories
UNION ALL
SELECT
    'Success Patterns (>=80%)',
    COUNT(*)::text
FROM tawos_user_stories
WHERE (metadata->>'completionRate')::float >= 0.8
UNION ALL
SELECT
    'Anti-Pattern Candidates (<60%)',
    COUNT(*)::text
FROM tawos_user_stories
WHERE (metadata->>'completionRate')::float < 0.6
UNION ALL
SELECT
    'Records with Tags',
    COUNT(*)::text
FROM tawos_user_stories
WHERE metadata->'tags' IS NOT NULL AND jsonb_array_length(metadata->'tags') > 0;

-- ============================================================================
-- EXPECTED RESULTS FOR TIERED RETRIEVAL
-- ============================================================================

/*
VERIFICATION CHECKLIST:

1. TABLE STRUCTURE
   [x] tawos_user_stories table exists
   [x] embedding column is vector(1536)
   [x] metadata column is JSONB

2. INDEX
   [x] HNSW index exists on embedding column

3. FUNCTION
   [x] match_documents function exists
   [x] Default threshold is 0.65 (was 0.7)
   [x] Default count is 10 (was 5)

4. DATA QUALITY
   [x] Embedding coverage > 90%
   [x] All embeddings are 1536 dimensions
   [x] Metadata contains required fields

5. TIERED RETRIEVAL READINESS
   [x] Success patterns exist (completionRate >= 0.8)
   [x] Anti-patterns exist (completionRate < 0.6 or antiPatterns array)
   [x] Tags/frameworks are populated for diversity

If any checks fail, review:
- scripts/create-tawos-vector-table.sql
- lib/tiered-retrieval-service.ts
- docs/TAWOS_TIERED_RETRIEVAL.md
*/
