-- Add name field to team_members table
-- This migration adds a name field to store display names for team members

-- Add name field to team_members table
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS name VARCHAR(255);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_team_members_name ON team_members(name);

-- Add comment for documentation
COMMENT ON COLUMN team_members.name IS 'Display name for the team member'; 