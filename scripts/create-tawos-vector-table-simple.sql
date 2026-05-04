-- Enable the pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create the tawos_user_stories table with vector support
-- Using 1536 dimensions for Voyage AI voyage-large-2 model
CREATE TABLE IF NOT EXISTS tawos_user_stories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    embedding vector(1536), -- Voyage AI voyage-large-2 produces 1536-dimensional vectors
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create a simple index on the id field (no vector-specific index)
-- This will work but similarity searches will be slower
CREATE INDEX IF NOT EXISTS tawos_user_stories_id_idx 
ON tawos_user_stories (id);

-- Create a function for similarity search (will work without vector index)
CREATE OR REPLACE FUNCTION match_documents(
    query_embedding vector(1536),
    match_threshold float DEFAULT 0.7,
    match_count int DEFAULT 5,
    filter jsonb DEFAULT '{}'
)
RETURNS TABLE (
    id UUID,
    similarity float,
    metadata jsonb
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        tawos_user_stories.id,
        1 - (tawos_user_stories.embedding <=> query_embedding) AS similarity,
        tawos_user_stories.metadata
    FROM tawos_user_stories
    WHERE tawos_user_stories.embedding IS NOT NULL
        AND 1 - (tawos_user_stories.embedding <=> query_embedding) > match_threshold
    ORDER BY tawos_user_stories.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- Create a trigger to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_tawos_user_stories_updated_at 
    BEFORE UPDATE ON tawos_user_stories 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Add RLS (Row Level Security) policies if needed
ALTER TABLE tawos_user_stories ENABLE ROW LEVEL SECURITY;

-- Create a policy that allows all operations (you can customize this based on your needs)
CREATE POLICY "Allow all operations on tawos_user_stories" ON tawos_user_stories
    FOR ALL USING (true);

-- Insert some sample data for testing (without embedding for now)
INSERT INTO tawos_user_stories (id, metadata) VALUES 
(
    gen_random_uuid(),
    '{
        "title": "Sample User Story",
        "description": "A sample user story for testing",
        "role": "User",
        "want": "to test the system",
        "benefit": "to ensure it works correctly",
        "acceptanceCriteria": ["System responds correctly", "Data is saved properly"],
        "storyPoints": 5,
        "businessValue": 3,
        "priority": "Medium",
        "tags": ["testing", "sample"],
        "completionRate": 0.9,
        "successPattern": "Thorough testing approach",
        "antiPatterns": ["Rushing through testing"]
    }'::jsonb
); 