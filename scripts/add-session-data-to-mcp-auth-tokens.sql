-- Migration script to add session_data column and update status constraint
-- for existing mcp_auth_tokens table

-- Add session_data column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'mcp_auth_tokens' AND column_name = 'session_data'
    ) THEN
        ALTER TABLE mcp_auth_tokens ADD COLUMN session_data JSONB;
        RAISE NOTICE 'Added session_data column to mcp_auth_tokens table';
    ELSE
        RAISE NOTICE 'session_data column already exists in mcp_auth_tokens table';
    END IF;
END $$;

-- Update status constraint to include 'active_session'
DO $$
BEGIN
    -- Drop the existing constraint if it exists
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'mcp_auth_tokens' 
        AND constraint_name = 'mcp_auth_tokens_status_check'
    ) THEN
        ALTER TABLE mcp_auth_tokens DROP CONSTRAINT mcp_auth_tokens_status_check;
        RAISE NOTICE 'Dropped existing status constraint';
    END IF;
    
    -- Add the new constraint with 'active_session' included
    ALTER TABLE mcp_auth_tokens ADD CONSTRAINT mcp_auth_tokens_status_check 
        CHECK (status IN ('pending', 'completed', 'failed', 'active_session'));
    RAISE NOTICE 'Added updated status constraint with active_session';
END $$;

-- Create index for email if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_mcp_auth_tokens_email ON mcp_auth_tokens(email);

-- Create index for session_data if it doesn't exist (for faster JSON queries)
CREATE INDEX IF NOT EXISTS idx_mcp_auth_tokens_session_data ON mcp_auth_tokens USING GIN (session_data);

RAISE NOTICE 'Migration completed successfully'; 