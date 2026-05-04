-- ============================================================================
-- UPDATE match_documents function with new tiered retrieval defaults
-- RUN THIS IN SUPABASE SQL EDITOR to apply the changes
-- ============================================================================

-- Drop existing function first
DROP FUNCTION IF EXISTS match_documents(vector(1536), float, int, jsonb);

-- Recreate with new defaults using single-quoted string (Supabase compatible)
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
AS '
    SELECT
        tawos_user_stories.id,
        1 - (tawos_user_stories.embedding <=> query_embedding) AS similarity,
        tawos_user_stories.metadata
    FROM tawos_user_stories
    WHERE tawos_user_stories.embedding IS NOT NULL
        AND 1 - (tawos_user_stories.embedding <=> query_embedding) > match_threshold
    ORDER BY tawos_user_stories.embedding <=> query_embedding
    LIMIT match_count
';
