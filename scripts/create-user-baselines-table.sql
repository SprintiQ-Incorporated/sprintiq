-- Create user_baselines table for storing onboarding survey data
CREATE TABLE IF NOT EXISTS user_baselines (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    baseline_story_time_ms BIGINT NOT NULL DEFAULT 0,
    baseline_coding_time_ms BIGINT NOT NULL DEFAULT 0,
    baseline_planning_time_ms BIGINT NOT NULL DEFAULT 0,
    baseline_stories_per_session INTEGER NOT NULL DEFAULT 0,
    baseline_method TEXT NOT NULL DEFAULT 'manual',
    team_size INTEGER NOT NULL DEFAULT 1,
    experience_level TEXT NOT NULL DEFAULT 'beginner',
    agile_tools TEXT,
    agile_tools_other TEXT,
    biggest_frustration TEXT,
    heard_about_sprintiq TEXT,
    heard_about_sprintiq_other TEXT,
    measurement_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_user_baselines_user_id ON user_baselines(user_id);
CREATE INDEX IF NOT EXISTS idx_user_baselines_measurement_date ON user_baselines(measurement_date DESC);
CREATE INDEX IF NOT EXISTS idx_user_baselines_experience_level ON user_baselines(experience_level);
CREATE INDEX IF NOT EXISTS idx_user_baselines_team_size ON user_baselines(team_size);

-- Create unique constraint to ensure one baseline per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_baselines_unique_user ON user_baselines(user_id);

-- Create trigger function for updated_at
CREATE OR REPLACE FUNCTION update_user_baselines_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for updated_at
CREATE TRIGGER update_user_baselines_updated_at 
    BEFORE UPDATE ON user_baselines 
    FOR EACH ROW 
    EXECUTE FUNCTION update_user_baselines_updated_at();

-- Add comments for documentation
COMMENT ON TABLE user_baselines IS 'Stores onboarding survey data for new users to help personalize their experience';
COMMENT ON COLUMN user_baselines.baseline_story_time_ms IS 'Time in milliseconds it takes to create a user story';
COMMENT ON COLUMN user_baselines.baseline_coding_time_ms IS 'Time in milliseconds for one coding task without AI assistance';
COMMENT ON COLUMN user_baselines.baseline_planning_time_ms IS 'Time in milliseconds spent on sprint planning';
COMMENT ON COLUMN user_baselines.baseline_stories_per_session IS 'Number of stories typically created per session';
COMMENT ON COLUMN user_baselines.baseline_method IS 'Current method for creating stories (manual, templates, other_tools)';
COMMENT ON COLUMN user_baselines.team_size IS 'Size of the user''s team';
COMMENT ON COLUMN user_baselines.experience_level IS 'User''s agile experience level (beginner, intermediate, expert)';
COMMENT ON COLUMN user_baselines.agile_tools IS 'Agile tools currently used by the team';
COMMENT ON COLUMN user_baselines.biggest_frustration IS 'User''s biggest frustration with current agile processes';
COMMENT ON COLUMN user_baselines.heard_about_sprintiq IS 'How the user heard about SprintiQ';
