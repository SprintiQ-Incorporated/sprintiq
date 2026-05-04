-- Add assigned_member_id field to tasks table
-- This field stores the team member ID assigned to the task

-- Add assigned_member_id field to tasks table
ALTER TABLE tasks 
ADD COLUMN IF NOT EXISTS assigned_member_id UUID REFERENCES team_members(id) ON DELETE SET NULL;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_member_id ON tasks(assigned_member_id);

-- Add comment for documentation
COMMENT ON COLUMN tasks.assigned_member_id IS 'References team_members.id for AI-assigned team members';

-- Create a view to easily query tasks with team member information
CREATE OR REPLACE VIEW tasks_with_team_members AS
SELECT 
    t.*,
    tm.name as assigned_member_name,
    tm.email as assigned_member_email,
    r.name as assigned_member_role,
    l.name as assigned_member_level
FROM tasks t
LEFT JOIN team_members tm ON t.assigned_member_id = tm.id
LEFT JOIN roles r ON tm.role_id = r.id
LEFT JOIN levels l ON tm.level_id = l.id;

-- Add comment for the view
COMMENT ON VIEW tasks_with_team_members IS 'View to easily query tasks with their assigned team member information'; 