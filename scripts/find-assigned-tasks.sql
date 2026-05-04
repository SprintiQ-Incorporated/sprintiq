-- Find assigned tasks in workspace
-- Shows which tasks have assignee_id vs assigned_member_id

-- First, get the workspace UUID
WITH workspace_info AS (
  SELECT id, workspace_id, name
  FROM workspaces
  WHERE workspace_id = 'w027293317360'  -- Replace with your workspace ID
    AND deleted_at IS NULL
)

-- Then find all tasks with assignment details
SELECT 
  t.id,
  t.title,
  t.task_id,
  t.assignee_id,
  t.assigned_member_id,
  t.epic_id,
  
  -- Show who it's assigned to via assignee_id (old field - profiles)
  CASE 
    WHEN t.assignee_id IS NOT NULL THEN 'Assigned via assignee_id'
    ELSE NULL
  END as assignee_type,
  p.full_name as assignee_name,
  p.email as assignee_email,
  
  -- Show who it's assigned to via assigned_member_id (new field - team members)
  CASE 
    WHEN t.assigned_member_id IS NOT NULL THEN 'Assigned via assigned_member_id'
    ELSE NULL
  END as team_member_type,
  tm.id as team_member_id,
  p2.full_name as team_member_name,
  p2.email as team_member_email,
  teams.name as team_name,
  
  -- Status
  CASE 
    WHEN t.assignee_id IS NOT NULL OR t.assigned_member_id IS NOT NULL THEN 'ASSIGNED'
    ELSE 'UNASSIGNED'
  END as assignment_status
  
FROM tasks t
CROSS JOIN workspace_info wi
LEFT JOIN profiles p ON t.assignee_id = p.id
LEFT JOIN team_members tm ON t.assigned_member_id = tm.id
LEFT JOIN profiles p2 ON tm.user_id = p2.id
LEFT JOIN teams ON tm.team_id = teams.id

WHERE t.workspace_id = wi.id
  AND t.deleted_at IS NULL
ORDER BY 
  CASE 
    WHEN t.assignee_id IS NOT NULL OR t.assigned_member_id IS NOT NULL THEN 0
    ELSE 1
  END,
  t.created_at DESC;

-- Summary count
SELECT 
  COUNT(*) FILTER (WHERE assignee_id IS NOT NULL OR assigned_member_id IS NOT NULL) as assigned_tasks,
  COUNT(*) FILTER (WHERE assignee_id IS NULL AND assigned_member_id IS NULL) as unassigned_tasks,
  COUNT(*) FILTER (WHERE assignee_id IS NOT NULL) as assigned_via_assignee_id,
  COUNT(*) FILTER (WHERE assigned_member_id IS NOT NULL) as assigned_via_team_member,
  COUNT(*) as total_tasks
FROM tasks t
CROSS JOIN (
  SELECT id FROM workspaces 
  WHERE workspace_id = 'w027293317360'  -- Replace with your workspace ID
    AND deleted_at IS NULL
) wi
WHERE t.workspace_id = wi.id
  AND t.deleted_at IS NULL;
