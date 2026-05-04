-- Drop existing functions if they exist (safe to re-run)
DROP FUNCTION IF EXISTS get_sprint_view_data(UUID, UUID) CASCADE;
DROP FUNCTION IF EXISTS get_workspace_analytics(UUID, INT) CASCADE;
DROP FUNCTION IF EXISTS get_workspace_role_usage(UUID) CASCADE;
DROP FUNCTION IF EXISTS per_minute_counts(UUID, INT) CASCADE;

-- ============================================================================

-- Create RPC function: get_sprint_view_data
-- Fetches all sprint-related data in a single optimized query
-- Returns: tasks, statuses, team_members, and sprint data

CREATE OR REPLACE FUNCTION get_sprint_view_data(
  p_sprint_id UUID,
  p_workspace_id UUID
)
RETURNS TABLE (
  tasks JSONB,
  statuses JSONB,
  team_members JSONB,
  sprint JSONB
) AS $$
DECLARE
  v_sprint_id UUID := p_sprint_id;
  v_workspace_id UUID := p_workspace_id;
BEGIN
  RETURN QUERY
  SELECT
    -- Fetch all tasks for this sprint
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'id', t.id,
          'task_id', t.task_id,
          'name', t.name,
          'description', t.description,
          'status_id', t.status_id,
          'priority', t.priority,
          'assignee_id', t.assignee_id,
          'estimated_hours', t.estimated_hours,
          'story_points', t.story_points,
          'created_at', t.created_at,
          'updated_at', t.updated_at
        ) ORDER BY t.created_at DESC
      ) FILTER (WHERE t.id IS NOT NULL),
      '[]'::JSONB
    ) AS tasks,
    -- Fetch all statuses for the workspace/space
    COALESCE(
      jsonb_agg(
        DISTINCT jsonb_build_object(
          'id', s.id,
          'status_id', s.status_id,
          'name', s.name,
          'type', s.type,
          'color', s.color,
          'position', s.position
        ) ORDER BY s.position ASC
      ) FILTER (WHERE s.id IS NOT NULL),
      '[]'::JSONB
    ) AS statuses,
    -- Fetch all team members for the workspace
    COALESCE(
      jsonb_agg(
        DISTINCT jsonb_build_object(
          'id', wm.id,
          'user_id', wm.user_id,
          'workspace_id', wm.workspace_id,
          'role', wm.role,
          'email', u.email,
          'full_name', u.full_name,
          'avatar_url', u.avatar_url
        ) ORDER BY u.full_name ASC
      ) FILTER (WHERE wm.id IS NOT NULL),
      '[]'::JSONB
    ) AS team_members,
    -- Fetch sprint details
    COALESCE(
      jsonb_build_object(
        'id', sp.id,
        'sprint_id', sp.sprint_id,
        'name', sp.name,
        'goal', sp.goal,
        'start_date', sp.start_date,
        'end_date', sp.end_date,
        'status', sp.status,
        'space_id', sp.space_id,
        'sprint_folder_id', sp.sprint_folder_id,
        'created_at', sp.created_at,
        'updated_at', sp.updated_at
      ),
      'null'::JSONB
    ) AS sprint
  FROM tasks t
  FULL OUTER JOIN statuses s ON s.workspace_id = v_workspace_id AND s.deleted_at IS NULL
  FULL OUTER JOIN workspace_members wm ON wm.workspace_id = v_workspace_id
  FULL OUTER JOIN auth.users u ON wm.user_id = u.id
  FULL OUTER JOIN sprints sp ON sp.id = v_sprint_id
  WHERE t.sprint_id = v_sprint_id OR t.id IS NULL;
END;
$$ LANGUAGE plpgsql STABLE;

GRANT EXECUTE ON FUNCTION get_sprint_view_data(UUID, UUID) TO authenticated;

-- ============================================================================

-- Create RPC function: get_workspace_analytics
-- Aggregates analytics data for a workspace efficiently
-- Returns: total_tasks, completed_tasks, active_sprints, team_members_count, recent_activity

CREATE FUNCTION get_workspace_analytics(
  p_workspace_id UUID,
  p_days_back INT DEFAULT 30
)
RETURNS TABLE (
  total_tasks BIGINT,
  completed_tasks BIGINT,
  active_sprints BIGINT,
  team_members_count BIGINT,
  recent_activity BIGINT,
  completion_rate NUMERIC,
  average_story_points NUMERIC
) AS $$
DECLARE
  v_workspace_id UUID := p_workspace_id;
  v_days_back INT := p_days_back;
  v_cutoff_date TIMESTAMP := NOW() - (v_days_back || ' days')::INTERVAL;
BEGIN
  RETURN QUERY
  SELECT
    -- Total tasks in workspace
    COALESCE(
      (SELECT COUNT(*) FROM tasks t 
       JOIN sprints sp ON t.sprint_id = sp.id 
       WHERE sp.workspace_id = v_workspace_id AND t.deleted_at IS NULL),
      0
    )::BIGINT AS total_tasks,
    -- Completed tasks
    COALESCE(
      (SELECT COUNT(*) FROM tasks t 
       JOIN sprints sp ON t.sprint_id = sp.id 
       JOIN statuses s ON t.status_id = s.id 
       WHERE sp.workspace_id = v_workspace_id 
       AND s.type = 'done' 
       AND t.deleted_at IS NULL),
      0
    )::BIGINT AS completed_tasks,
    -- Active sprints
    COALESCE(
      (SELECT COUNT(*) FROM sprints 
       WHERE workspace_id = v_workspace_id 
       AND status IN ('active', 'in_progress')
       AND deleted_at IS NULL),
      0
    )::BIGINT AS active_sprints,
    -- Team members count
    COALESCE(
      (SELECT COUNT(*) FROM workspace_members 
       WHERE workspace_id = v_workspace_id),
      0
    )::BIGINT AS team_members_count,
    -- Recent activity (tasks updated in last N days)
    COALESCE(
      (SELECT COUNT(*) FROM tasks t 
       JOIN sprints sp ON t.sprint_id = sp.id 
       WHERE sp.workspace_id = v_workspace_id 
       AND t.updated_at >= v_cutoff_date 
       AND t.deleted_at IS NULL),
      0
    )::BIGINT AS recent_activity,
    -- Completion rate (percentage)
    CASE 
      WHEN (SELECT COUNT(*) FROM tasks t 
            JOIN sprints sp ON t.sprint_id = sp.id 
            WHERE sp.workspace_id = v_workspace_id AND t.deleted_at IS NULL) = 0 
      THEN 0
      ELSE ROUND(
        100.0 * (SELECT COUNT(*) FROM tasks t 
                 JOIN sprints sp ON t.sprint_id = sp.id 
                 JOIN statuses s ON t.status_id = s.id 
                 WHERE sp.workspace_id = v_workspace_id 
                 AND s.type = 'done' 
                 AND t.deleted_at IS NULL) / 
        (SELECT COUNT(*) FROM tasks t 
         JOIN sprints sp ON t.sprint_id = sp.id 
         WHERE sp.workspace_id = v_workspace_id AND t.deleted_at IS NULL),
        2
      )
    END::NUMERIC AS completion_rate,
    -- Average story points per task
    ROUND(
      COALESCE(
        (SELECT AVG(story_points) FROM tasks t 
         JOIN sprints sp ON t.sprint_id = sp.id 
         WHERE sp.workspace_id = v_workspace_id 
         AND t.story_points IS NOT NULL 
         AND t.deleted_at IS NULL),
        0
      )::NUMERIC,
      2
    ) AS average_story_points;
END;
$$ LANGUAGE plpgsql STABLE;

GRANT EXECUTE ON FUNCTION get_workspace_analytics(UUID, INT) TO authenticated;

-- ============================================================================

-- NOTE: get_workspace_role_usage is defined in 20250101_add_role_usage_tracking.sql
-- and 20260104_fix_get_workspace_role_usage.sql with the correct implementation
-- that counts from the roles table (not workspace_members).

-- ============================================================================

-- Create RPC function: per_minute_counts
-- Returns per-minute activity counts (for analytics/monitoring)

CREATE FUNCTION per_minute_counts(
  p_workspace_id UUID,
  p_hours_back INT DEFAULT 24
)
RETURNS TABLE (
  minute TIMESTAMP,
  count INT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    DATE_TRUNC('minute', updated_at) AS minute,
    COUNT(*)::INT AS count
  FROM tasks t
  JOIN sprints sp ON t.sprint_id = sp.id
  WHERE sp.workspace_id = p_workspace_id
    AND t.updated_at >= NOW() - (p_hours_back || ' hours')::INTERVAL
    AND t.deleted_at IS NULL
  GROUP BY DATE_TRUNC('minute', updated_at)
  ORDER BY minute DESC;
END;
$$ LANGUAGE plpgsql STABLE;

GRANT EXECUTE ON FUNCTION per_minute_counts(UUID, INT) TO authenticated;
