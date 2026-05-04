-- Create table for MCP authentication tokens
CREATE TABLE IF NOT EXISTS mcp_auth_tokens (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    token TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'active_session')),
    session_data JSONB, -- Store user session data for active sessions
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_mcp_auth_tokens_token ON mcp_auth_tokens(token);
CREATE INDEX IF NOT EXISTS idx_mcp_auth_tokens_status ON mcp_auth_tokens(status);
CREATE INDEX IF NOT EXISTS idx_mcp_auth_tokens_expires_at ON mcp_auth_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_mcp_auth_tokens_email ON mcp_auth_tokens(email);

-- Create function to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_mcp_auth_tokens_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER trigger_update_mcp_auth_tokens_updated_at
    BEFORE UPDATE ON mcp_auth_tokens
    FOR EACH ROW
    EXECUTE FUNCTION update_mcp_auth_tokens_updated_at();

-- Enable Row Level Security (RLS)
ALTER TABLE mcp_auth_tokens ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations (since this is for system use)
CREATE POLICY "Allow all operations on mcp_auth_tokens" ON mcp_auth_tokens
    FOR ALL USING (true);

-- Grant permissions
GRANT ALL ON mcp_auth_tokens TO authenticated;
GRANT ALL ON mcp_auth_tokens TO anon; 