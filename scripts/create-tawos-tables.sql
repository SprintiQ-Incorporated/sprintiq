-- Create TAWOS training data table
CREATE TABLE IF NOT EXISTS tawos_training_data (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    patterns JSONB NOT NULL,
    insights JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_tawos_training_data_workspace_id ON tawos_training_data(workspace_id);
CREATE INDEX IF NOT EXISTS idx_tawos_training_data_created_at ON tawos_training_data(created_at DESC);

-- Add RLS policies
ALTER TABLE tawos_training_data ENABLE ROW LEVEL SECURITY;

-- Policy for workspace members to access their workspace's training data
CREATE POLICY "Workspace members can access their workspace's TAWOS training data" ON tawos_training_data
    FOR ALL USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members 
            WHERE user_id = auth.uid()
        )
    );

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_tawos_training_data_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_tawos_training_data_updated_at
    BEFORE UPDATE ON tawos_training_data
    FOR EACH ROW
    EXECUTE FUNCTION update_tawos_training_data_updated_at(); 