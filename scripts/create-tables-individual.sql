-- 1. Create roles table
CREATE TABLE IF NOT EXISTS roles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create levels table
CREATE TABLE IF NOT EXISTS levels (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Create teams table
CREATE TABLE IF NOT EXISTS teams (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Drop existing team_members table (if it exists)
DROP TABLE IF EXISTS team_members;

-- 5. Create new team_members table
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

-- 6. Create indexes
CREATE INDEX IF NOT EXISTS idx_teams_workspace_id ON teams(workspace_id);
CREATE INDEX IF NOT EXISTS idx_team_members_team_id ON team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_team_members_role_id ON team_members(role_id);
CREATE INDEX IF NOT EXISTS idx_team_members_level_id ON team_members(level_id);
CREATE INDEX IF NOT EXISTS idx_team_members_email ON team_members(email);

-- 7. Create unique constraints
CREATE UNIQUE INDEX IF NOT EXISTS idx_team_members_unique_user ON team_members(team_id, user_id) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_team_members_unique_email ON team_members(team_id, email) WHERE email IS NOT NULL;

-- 8. Create trigger function for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 9. Create triggers
CREATE TRIGGER update_roles_updated_at BEFORE UPDATE ON roles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_levels_updated_at BEFORE UPDATE ON levels FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_teams_updated_at BEFORE UPDATE ON teams FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 10. Insert default roles
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

-- 11. Insert default levels
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

-- 12. Create time_tracking_sessions table for story generation timing
CREATE TABLE IF NOT EXISTS time_tracking_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    session_id TEXT NOT NULL UNIQUE,
    event_type TEXT NOT NULL,
    story_count INTEGER NOT NULL,
    feature TEXT NOT NULL,
    method TEXT NOT NULL,
    complexity TEXT NOT NULL,
    team_size INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    timestamp BIGINT -- duration in ms (time taken from start to end)
);

CREATE INDEX IF NOT EXISTS idx_time_tracking_sessions_user_id ON time_tracking_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_time_tracking_sessions_created_at ON time_tracking_sessions(created_at DESC); 