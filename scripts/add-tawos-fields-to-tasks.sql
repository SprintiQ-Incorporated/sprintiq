-- Add TAWOS-specific fields to tasks table
-- This script adds story points, estimated time, and business value fields

-- Add story_points field (integer, nullable)
ALTER TABLE tasks 
ADD COLUMN IF NOT EXISTS story_points INTEGER;

-- Add estimated_time field (decimal for hours, nullable)
ALTER TABLE tasks 
ADD COLUMN IF NOT EXISTS estimated_time DECIMAL(5,2);

-- Add business_value field (integer 1-5, nullable)
ALTER TABLE tasks 
ADD COLUMN IF NOT EXISTS business_value INTEGER CHECK (business_value >= 1 AND business_value <= 5);

-- Add success_pattern field (text, nullable)
ALTER TABLE tasks 
ADD COLUMN IF NOT EXISTS success_pattern TEXT;

-- Add completion_rate field (decimal for percentage, nullable)
ALTER TABLE tasks 
ADD COLUMN IF NOT EXISTS completion_rate DECIMAL(5,2) CHECK (completion_rate >= 0 AND completion_rate <= 100);

-- Add velocity field (decimal for points per sprint, nullable)
ALTER TABLE tasks 
ADD COLUMN IF NOT EXISTS velocity DECIMAL(5,2);

-- Add anti_pattern_warnings field (JSON array, nullable)
ALTER TABLE tasks 
ADD COLUMN IF NOT EXISTS anti_pattern_warnings JSONB;

-- Add requirements field (JSON array, nullable)
ALTER TABLE tasks 
ADD COLUMN IF NOT EXISTS requirements JSONB;

-- Add TAWOS metadata field (JSON object, nullable)
ALTER TABLE tasks 
ADD COLUMN IF NOT EXISTS tawos_metadata JSONB;

-- Create indexes for better performance on new fields
CREATE INDEX IF NOT EXISTS idx_tasks_story_points ON tasks(story_points);
CREATE INDEX IF NOT EXISTS idx_tasks_business_value ON tasks(business_value);
CREATE INDEX IF NOT EXISTS idx_tasks_estimated_time ON tasks(estimated_time);
CREATE INDEX IF NOT EXISTS idx_tasks_tawos_metadata ON tasks USING GIN(tawos_metadata);

-- Add comments to document the new fields
COMMENT ON COLUMN tasks.story_points IS 'Story points for the task (Fibonacci sequence: 1, 2, 3, 5, 8, 13)';
COMMENT ON COLUMN tasks.estimated_time IS 'Estimated time in hours for task completion';
COMMENT ON COLUMN tasks.business_value IS 'Business value score from 1-5 (1=low, 5=high)';
COMMENT ON COLUMN tasks.success_pattern IS 'TAWOS success pattern applied to this task';
COMMENT ON COLUMN tasks.completion_rate IS 'Expected completion rate as percentage (0-100)';
COMMENT ON COLUMN tasks.velocity IS 'Expected velocity in story points per sprint';
COMMENT ON COLUMN tasks.anti_pattern_warnings IS 'JSON array of anti-pattern warnings for this task';
COMMENT ON COLUMN tasks.requirements IS 'JSON array of detailed requirements for this task';
COMMENT ON COLUMN tasks.tawos_metadata IS 'Complete TAWOS metadata for the task including all AI-generated information';

-- Update existing tasks that have TAWOS data in external_data to populate the new fields
-- This will extract data from existing external_data JSON field
UPDATE tasks 
SET 
    story_points = (external_data->>'tawos'->>'storyPoints')::INTEGER,
    estimated_time = (external_data->>'tawos'->>'estimatedTime')::DECIMAL(5,2),
    business_value = (external_data->>'tawos'->>'businessValue')::INTEGER,
    success_pattern = external_data->>'tawos'->>'successPattern',
    completion_rate = (external_data->>'tawos'->>'completionRate')::DECIMAL(5,2),
    velocity = (external_data->>'tawos'->>'velocity')::DECIMAL(5,2),
    anti_pattern_warnings = external_data->>'tawos'->>'antiPatternWarnings',
    requirements = external_data->>'tawos'->>'requirements',
    tawos_metadata = external_data->>'tawos'
WHERE 
    external_data IS NOT NULL 
    AND external_data->>'aiGenerated' = 'true'
    AND external_data->>'tawos' IS NOT NULL;

-- Create a function to automatically populate TAWOS fields when external_data is updated
CREATE OR REPLACE FUNCTION update_tawos_fields()
RETURNS TRIGGER AS $$
BEGIN
    -- Only update if external_data contains TAWOS information
    IF NEW.external_data IS NOT NULL 
       AND NEW.external_data->>'aiGenerated' = 'true' 
       AND NEW.external_data->>'tawos' IS NOT NULL THEN
        
        NEW.story_points = (NEW.external_data->>'tawos'->>'storyPoints')::INTEGER;
        NEW.estimated_time = (NEW.external_data->>'tawos'->>'estimatedTime')::DECIMAL(5,2);
        NEW.business_value = (NEW.external_data->>'tawos'->>'businessValue')::INTEGER;
        NEW.success_pattern = NEW.external_data->>'tawos'->>'successPattern';
        NEW.completion_rate = (NEW.external_data->>'tawos'->>'completionRate')::DECIMAL(5,2);
        NEW.velocity = (NEW.external_data->>'tawos'->>'velocity')::DECIMAL(5,2);
        NEW.anti_pattern_warnings = NEW.external_data->>'tawos'->>'antiPatternWarnings';
        NEW.requirements = NEW.external_data->>'tawos'->>'requirements';
        NEW.tawos_metadata = NEW.external_data->>'tawos';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update TAWOS fields when external_data changes
DROP TRIGGER IF EXISTS trigger_update_tawos_fields ON tasks;
CREATE TRIGGER trigger_update_tawos_fields
    BEFORE INSERT OR UPDATE ON tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_tawos_fields();

-- Create a view for easy querying of TAWOS tasks
CREATE OR REPLACE VIEW tawos_tasks AS
SELECT 
    t.id,
    t.task_id,
    t.name,
    t.description,
    t.story_points,
    t.estimated_time,
    t.business_value,
    t.success_pattern,
    t.completion_rate,
    t.velocity,
    t.anti_pattern_warnings,
    t.requirements,
    t.tawos_metadata,
    t.priority,
    t.status_id,
    t.assignee_id,
    t.project_id,
    t.space_id,
    t.workspace_id,
    t.created_at,
    t.updated_at,
    s.name as status_name,
    p.name as project_name,
    sp.name as space_name
FROM tasks t
LEFT JOIN statuses s ON t.status_id = s.id
LEFT JOIN projects p ON t.project_id = p.id
LEFT JOIN spaces sp ON t.space_id = sp.id
WHERE t.external_data->>'aiGenerated' = 'true';

-- Grant necessary permissions (adjust based on your Supabase setup)
-- These are typically handled by Supabase automatically, but you might need to adjust
-- based on your specific RLS (Row Level Security) policies

-- Example RLS policies (uncomment and modify as needed for your setup):
/*
-- Enable RLS on tasks table if not already enabled
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- Example policy for tasks (adjust based on your workspace structure)
CREATE POLICY "Users can view tasks in their workspace" ON tasks
    FOR SELECT USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members 
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update tasks in their workspace" ON tasks
    FOR UPDATE USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members 
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert tasks in their workspace" ON tasks
    FOR INSERT WITH CHECK (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members 
            WHERE user_id = auth.uid()
        )
    );
*/

-- Print success message
DO $$
BEGIN
    RAISE NOTICE '✅ Successfully added TAWOS fields to tasks table';
    RAISE NOTICE '✅ Created indexes for performance optimization';
    RAISE NOTICE '✅ Created trigger for automatic field updates';
    RAISE NOTICE '✅ Created tawos_tasks view for easy querying';
    RAISE NOTICE '✅ Migrated existing TAWOS data from external_data';
END $$; 