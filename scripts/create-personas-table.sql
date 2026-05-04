-- Create personas table
CREATE TABLE IF NOT EXISTS personas (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    persona_id VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_personas_workspace_id ON personas(workspace_id);
CREATE INDEX IF NOT EXISTS idx_personas_created_by ON personas(created_by);
CREATE INDEX IF NOT EXISTS idx_personas_persona_id ON personas(persona_id);

-- Create updated_at trigger function (if it doesn't exist)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for updated_at column
CREATE TRIGGER update_personas_updated_at BEFORE UPDATE ON personas FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS on personas table
ALTER TABLE personas ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for personas
CREATE POLICY "Users can view personas in their workspace" ON personas
    FOR SELECT USING (
        workspace_id IN (
            SELECT w.id FROM workspaces w
            JOIN workspace_members wm ON w.workspace_id = wm.workspace_id
            WHERE wm.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can create personas in their workspace" ON personas
    FOR INSERT WITH CHECK (
        workspace_id IN (
            SELECT w.id FROM workspaces w
            JOIN workspace_members wm ON w.workspace_id = wm.workspace_id
            WHERE wm.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update personas in their workspace" ON personas
    FOR UPDATE USING (
        workspace_id IN (
            SELECT w.id FROM workspaces w
            JOIN workspace_members wm ON w.workspace_id = wm.workspace_id
            WHERE wm.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete personas in their workspace" ON personas
    FOR DELETE USING (
        workspace_id IN (
            SELECT w.id FROM workspaces w
            JOIN workspace_members wm ON w.workspace_id = wm.workspace_id
            WHERE wm.user_id = auth.uid()
        )
    ); 