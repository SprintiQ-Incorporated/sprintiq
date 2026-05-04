-- Fix team_members unique constraints to handle empty emails and allow users in multiple teams
-- This migration updates the constraints to be more flexible

-- Drop the existing problematic constraints
DROP INDEX IF EXISTS idx_team_members_unique_email;

-- Recreate the email constraint to exclude empty emails
CREATE UNIQUE INDEX IF NOT EXISTS idx_team_members_unique_email 
ON team_members(team_id, email) 
WHERE email IS NOT NULL AND email != '';

-- The user_id constraint is fine as is, but let's make sure it's properly defined
DROP INDEX IF EXISTS idx_team_members_unique_user;
CREATE UNIQUE INDEX IF NOT EXISTS idx_team_members_unique_user 
ON team_members(team_id, user_id) 
WHERE user_id IS NOT NULL;

-- Add a comment explaining the constraints
COMMENT ON INDEX idx_team_members_unique_email IS 'Prevents duplicate emails within the same team, excluding empty emails';
COMMENT ON INDEX idx_team_members_unique_user IS 'Prevents duplicate user_id within the same team'; 