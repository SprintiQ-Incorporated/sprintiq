-- Create roles table
CREATE TABLE IF NOT EXISTS roles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create levels table
CREATE TABLE IF NOT EXISTS levels (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create teams table (if it doesn't exist)
CREATE TABLE IF NOT EXISTS teams (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create team_members table (update existing or create new)
-- First, drop the existing team_members table if it exists
DROP TABLE IF EXISTS team_members;

-- Create the new team_members table with the updated schema
CREATE TABLE team_members (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    email VARCHAR(255),
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    level_id UUID NOT NULL REFERENCES levels(id) ON DELETE CASCADE,
    description TEXT,
    is_registered BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_teams_workspace_id ON teams(workspace_id);
CREATE INDEX IF NOT EXISTS idx_team_members_team_id ON team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_team_members_role_id ON team_members(role_id);
CREATE INDEX IF NOT EXISTS idx_team_members_level_id ON team_members(level_id);
CREATE INDEX IF NOT EXISTS idx_team_members_email ON team_members(email);

-- Create unique constraint for team_members to prevent duplicate entries
-- A user can only be in a team once, and an email can only be in a team once
CREATE UNIQUE INDEX IF NOT EXISTS idx_team_members_unique_user ON team_members(team_id, user_id) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_team_members_unique_email ON team_members(team_id, email) WHERE email IS NOT NULL;

-- Create updated_at trigger function (if it doesn't exist)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at columns
CREATE TRIGGER update_roles_updated_at BEFORE UPDATE ON roles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_levels_updated_at BEFORE UPDATE ON levels FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_teams_updated_at BEFORE UPDATE ON teams FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default roles
INSERT INTO roles (name, description) VALUES
('Front-end Developer', 'Develops user-facing features and interfaces'),
('Back-end Developer', 'Develops server-side logic and APIs'),
('Full-stack Developer', 'Develops both front-end and back-end components'),
('UI/UX Designer', 'Designs user interfaces and user experiences'),
('Product Manager', 'Manages product strategy and roadmap'),
('Project Manager', 'Manages project timelines and team coordination'),
('DevOps Engineer', 'Manages infrastructure and deployment processes'),
('QA Engineer', 'Tests software quality and ensures bug-free releases'),
('Data Scientist', 'Analyzes data and builds machine learning models'),
('Business Analyst', 'Analyzes business requirements and processes'),
('Marketing Specialist', 'Handles marketing strategies and campaigns'),
('Sales Representative', 'Manages customer relationships and sales'),
('Content Writer', 'Creates written content for various platforms'),
('Graphic Designer', 'Creates visual designs and graphics'),
('System Administrator', 'Manages IT systems and infrastructure')
ON CONFLICT (name) DO NOTHING;

-- Insert default levels
INSERT INTO levels (name, description) VALUES
('Junior', 'Entry-level position with 0-2 years of experience'),
('Mid-Level', 'Intermediate position with 2-5 years of experience'),
('Senior', 'Advanced position with 5+ years of experience'),
('Lead', 'Leadership position with team management responsibilities'),
('Principal', 'Expert position with strategic decision-making authority'),
('Architect', 'Technical leadership position with system design responsibilities'),
('Manager', 'Management position with team and project oversight'),
('Director', 'Executive position with department-level responsibilities'),
('VP', 'Vice President level with company-wide strategic impact'),
('C-Level', 'Chief-level executive position')
ON CONFLICT (name) DO NOTHING;

-- Grant necessary permissions (adjust based on your Supabase setup)
-- These are typically handled by Supabase automatically, but you might need to adjust
-- based on your specific RLS (Row Level Security) policies

-- Example RLS policies (uncomment and modify as needed for your setup):
/*
-- Enable RLS on tables
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE levels ENABLE ROW LEVEL SECURITY;

-- Example policy for teams (adjust based on your workspace structure)
CREATE POLICY "Users can view teams in their workspace" ON teams
    FOR SELECT USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members 
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Workspace owners can manage teams" ON teams
    FOR ALL USING (
        workspace_id IN (
            SELECT workspace_id FROM workspaces 
            WHERE owner_id = auth.uid()
        )
    );
*/ 