-- Enhance personas table for Story 2.3: Enhanced User Persona Creation
-- This migration adds new fields to support tech-savviness, usage frequency, priority, and TAWOS integration

-- Add new columns to personas table
ALTER TABLE personas ADD COLUMN IF NOT EXISTS tech_savviness INTEGER CHECK (tech_savviness >= 1 AND tech_savviness <= 5);
ALTER TABLE personas ADD COLUMN IF NOT EXISTS usage_frequency VARCHAR(20) CHECK (usage_frequency IN ('daily', 'weekly', 'monthly'));
ALTER TABLE personas ADD COLUMN IF NOT EXISTS priority_level VARCHAR(20) CHECK (priority_level IN ('high', 'medium', 'low'));
ALTER TABLE personas ADD COLUMN IF NOT EXISTS role VARCHAR(255);
ALTER TABLE personas ADD COLUMN IF NOT EXISTS domain VARCHAR(100);
ALTER TABLE personas ADD COLUMN IF NOT EXISTS tawos_patterns JSONB;
ALTER TABLE personas ADD COLUMN IF NOT EXISTS auto_detected BOOLEAN DEFAULT false;

-- Add subscription tracking to profiles table (user-level)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS subscription_tier VARCHAR(50) DEFAULT 'free';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS subscription_limits JSONB;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMP WITH TIME ZONE;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_personas_tech_savviness ON personas(tech_savviness);
CREATE INDEX IF NOT EXISTS idx_personas_domain ON personas(domain);
CREATE INDEX IF NOT EXISTS idx_personas_role ON personas(role);
CREATE INDEX IF NOT EXISTS idx_personas_priority ON personas(priority_level);
CREATE INDEX IF NOT EXISTS idx_profiles_subscription_tier ON profiles(subscription_tier);
CREATE INDEX IF NOT EXISTS idx_profiles_subscription_expires ON profiles(subscription_expires_at);

-- Add comments for documentation
COMMENT ON COLUMN personas.tech_savviness IS 'Technical skill level from 1 (beginner) to 5 (expert)';
COMMENT ON COLUMN personas.usage_frequency IS 'How often the persona uses the system: daily, weekly, or monthly';
COMMENT ON COLUMN personas.priority_level IS 'Priority level for this persona: high, medium, or low';
COMMENT ON COLUMN personas.role IS 'Specific role of the persona (e.g., Data Scientist, Product Manager)';
COMMENT ON COLUMN personas.domain IS 'Industry domain (e.g., fintech, ecommerce, healthcare, enterprise)';
COMMENT ON COLUMN personas.tawos_patterns IS 'TAWOS success patterns and insights for this persona type';
COMMENT ON COLUMN personas.auto_detected IS 'Whether attributes were auto-detected from description';
COMMENT ON COLUMN profiles.subscription_tier IS 'Subscription tier: free, starter, professional, enterprise';
COMMENT ON COLUMN profiles.subscription_limits IS 'JSON object containing subscription limits for various features';
COMMENT ON COLUMN profiles.subscription_expires_at IS 'When the subscription expires (null for free tier)';

-- Update existing personas with default values
UPDATE personas SET 
  tech_savviness = 3,
  usage_frequency = 'weekly',
  priority_level = 'medium',
  role = 'User',
  domain = 'general',
  auto_detected = false
WHERE tech_savviness IS NULL;

-- Set default subscription tier for existing users
UPDATE profiles SET subscription_tier = 'free' WHERE subscription_tier IS NULL;

-- Create a function to automatically detect persona attributes
CREATE OR REPLACE FUNCTION detect_persona_attributes(description_text TEXT)
RETURNS JSON AS $$
DECLARE
  result JSON;
  lower_desc TEXT;
BEGIN
  lower_desc := LOWER(description_text);
  
  -- Initialize result with defaults
  result := '{
    "tech_savviness": 3,
    "role": "User",
    "domain": "general",
    "usage_frequency": "weekly",
    "priority_level": "medium",
    "confidence": 0.3
  }'::JSON;
  
  -- Detect tech-savviness
  IF lower_desc LIKE '%expert%' OR lower_desc LIKE '%senior%' OR lower_desc LIKE '%architect%' OR lower_desc LIKE '%lead%' THEN
    result := jsonb_set(result::jsonb, '{tech_savviness}', '5'::jsonb);
  ELSIF lower_desc LIKE '%developer%' OR lower_desc LIKE '%engineer%' OR lower_desc LIKE '%scientist%' OR lower_desc LIKE '%analyst%' THEN
    result := jsonb_set(result::jsonb, '{tech_savviness}', '4'::jsonb);
  ELSIF lower_desc LIKE '%manager%' OR lower_desc LIKE '%coordinator%' THEN
    result := jsonb_set(result::jsonb, '{tech_savviness}', '3'::jsonb);
  ELSIF lower_desc LIKE '%beginner%' OR lower_desc LIKE '%junior%' OR lower_desc LIKE '%user%' OR lower_desc LIKE '%customer%' THEN
    result := jsonb_set(result::jsonb, '{tech_savviness}', '2'::jsonb);
  ELSIF lower_desc LIKE '%non-technical%' OR lower_desc LIKE '%business%' THEN
    result := jsonb_set(result::jsonb, '{tech_savviness}', '1'::jsonb);
  END IF;
  
  -- Detect role
  IF lower_desc LIKE '%developer%' OR lower_desc LIKE '%engineer%' THEN
    result := jsonb_set(result::jsonb, '{role}', '"Developer"'::jsonb);
  ELSIF lower_desc LIKE '%manager%' OR lower_desc LIKE '%lead%' THEN
    result := jsonb_set(result::jsonb, '{role}', '"Manager"'::jsonb);
  ELSIF lower_desc LIKE '%scientist%' OR lower_desc LIKE '%analyst%' THEN
    result := jsonb_set(result::jsonb, '{role}', '"Data Scientist"'::jsonb);
  ELSIF lower_desc LIKE '%designer%' OR lower_desc LIKE '%ux%' THEN
    result := jsonb_set(result::jsonb, '{role}', '"Designer"'::jsonb);
  ELSIF lower_desc LIKE '%product%' THEN
    result := jsonb_set(result::jsonb, '{role}', '"Product Manager"'::jsonb);
  END IF;
  
  -- Detect domain
  IF lower_desc LIKE '%fintech%' OR lower_desc LIKE '%finance%' OR lower_desc LIKE '%banking%' OR lower_desc LIKE '%payment%' THEN
    result := jsonb_set(result::jsonb, '{domain}', '"fintech"'::jsonb);
  ELSIF lower_desc LIKE '%ecommerce%' OR lower_desc LIKE '%retail%' OR lower_desc LIKE '%shopping%' OR lower_desc LIKE '%store%' THEN
    result := jsonb_set(result::jsonb, '{domain}', '"ecommerce"'::jsonb);
  ELSIF lower_desc LIKE '%healthcare%' OR lower_desc LIKE '%medical%' OR lower_desc LIKE '%clinical%' OR lower_desc LIKE '%hipaa%' THEN
    result := jsonb_set(result::jsonb, '{domain}', '"healthcare"'::jsonb);
  ELSIF lower_desc LIKE '%enterprise%' OR lower_desc LIKE '%corporate%' THEN
    result := jsonb_set(result::jsonb, '{domain}', '"enterprise"'::jsonb);
  END IF;
  
  -- Detect usage frequency
  IF lower_desc LIKE '%daily%' OR lower_desc LIKE '%every day%' THEN
    result := jsonb_set(result::jsonb, '{usage_frequency}', '"daily"'::jsonb);
  ELSIF lower_desc LIKE '%monthly%' OR lower_desc LIKE '%occasionally%' THEN
    result := jsonb_set(result::jsonb, '{usage_frequency}', '"monthly"'::jsonb);
  END IF;
  
  -- Detect priority level
  IF lower_desc LIKE '%critical%' OR lower_desc LIKE '%urgent%' OR lower_desc LIKE '%high priority%' THEN
    result := jsonb_set(result::jsonb, '{priority_level}', '"high"'::jsonb);
  ELSIF lower_desc LIKE '%low priority%' OR lower_desc LIKE '%nice to have%' THEN
    result := jsonb_set(result::jsonb, '{priority_level}', '"low"'::jsonb);
  END IF;
  
  -- Increase confidence if we detected multiple attributes
  IF (result->>'tech_savviness' != '3' OR result->>'role' != 'User' OR result->>'domain' != 'general') THEN
    result := jsonb_set(result::jsonb, '{confidence}', '0.7'::jsonb);
  END IF;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Create a trigger to auto-detect attributes when description changes
CREATE OR REPLACE FUNCTION auto_detect_persona_attributes()
RETURNS TRIGGER AS $$
BEGIN
  -- Only auto-detect if auto_detected is true or not set
  IF NEW.auto_detected IS NULL OR NEW.auto_detected = true THEN
    -- Get detected attributes
    DECLARE
      detected JSON;
    BEGIN
      detected := detect_persona_attributes(NEW.description);
      
      -- Update fields if they're not already set
      IF NEW.tech_savviness IS NULL THEN
        NEW.tech_savviness := (detected->>'tech_savviness')::INTEGER;
      END IF;
      
      IF NEW.role IS NULL THEN
        NEW.role := detected->>'role';
      END IF;
      
      IF NEW.domain IS NULL THEN
        NEW.domain := detected->>'domain';
      END IF;
      
      IF NEW.usage_frequency IS NULL THEN
        NEW.usage_frequency := detected->>'usage_frequency';
      END IF;
      
      IF NEW.priority_level IS NULL THEN
        NEW.priority_level := detected->>'priority_level';
      END IF;
      
      -- Mark as auto-detected
      NEW.auto_detected := true;
    END;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for auto-detection
DROP TRIGGER IF EXISTS trigger_auto_detect_persona_attributes ON personas;
CREATE TRIGGER trigger_auto_detect_persona_attributes
  BEFORE INSERT OR UPDATE ON personas
  FOR EACH ROW
  EXECUTE FUNCTION auto_detect_persona_attributes();

-- Create a function to check persona limits for a user across all their workspaces
CREATE OR REPLACE FUNCTION check_user_persona_limit(user_uuid UUID)
RETURNS JSON AS $$
DECLARE
  total_count INTEGER;
  limit_count INTEGER;
  tier TEXT;
  expires_at TIMESTAMP WITH TIME ZONE;
  result JSON;
BEGIN
  -- Get user's subscription info
  SELECT subscription_tier, subscription_expires_at INTO tier, expires_at
  FROM profiles
  WHERE id = user_uuid;
  
  -- Check if subscription is expired
  IF expires_at IS NOT NULL AND expires_at < NOW() THEN
    tier := 'free'; -- Downgrade to free if expired
  END IF;
  
  -- Get total persona count across all user's workspaces
  SELECT COUNT(*) INTO total_count
  FROM personas p
  JOIN workspace_members wm ON p.workspace_id = wm.workspace_id
  WHERE wm.user_id = user_uuid;
  
  -- Set limit based on tier
  CASE tier
    WHEN 'free' THEN limit_count := 3;
    WHEN 'starter' THEN limit_count := 5;
    WHEN 'professional', 'enterprise' THEN limit_count := 999999; -- Effectively unlimited
    ELSE limit_count := 3; -- Default to free tier
  END CASE;
  
  -- Build result
  result := json_build_object(
    'current', total_count,
    'limit', limit_count,
    'tier', tier,
    'canCreate', total_count < limit_count,
    'remaining', GREATEST(0, limit_count - total_count),
    'expiresAt', expires_at,
    'isExpired', expires_at IS NOT NULL AND expires_at < NOW()
  );
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Create a function to check persona limits for a specific workspace (for backward compatibility)
CREATE OR REPLACE FUNCTION check_workspace_persona_limit(workspace_uuid UUID)
RETURNS JSON AS $$
DECLARE
  current_count INTEGER;
  limit_count INTEGER;
  tier TEXT;
  result JSON;
BEGIN
  -- Get current count for this workspace
  SELECT COUNT(*) INTO current_count
  FROM personas
  WHERE workspace_id = workspace_uuid;
  
  -- Get the workspace owner's subscription tier
  SELECT p.subscription_tier INTO tier
  FROM workspaces w
  JOIN profiles p ON w.owner_id = p.id
  WHERE w.id = workspace_uuid;
  
  -- Set limit based on tier
  CASE tier
    WHEN 'free' THEN limit_count := 3;
    WHEN 'starter' THEN limit_count := 5;
    WHEN 'professional', 'enterprise' THEN limit_count := 999999; -- Effectively unlimited
    ELSE limit_count := 3; -- Default to free tier
  END CASE;
  
  -- Build result
  result := json_build_object(
    'current', current_count,
    'limit', limit_count,
    'tier', tier,
    'canCreate', current_count < limit_count,
    'remaining', GREATEST(0, limit_count - current_count)
  );
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION detect_persona_attributes(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION check_user_persona_limit(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION check_workspace_persona_limit(UUID) TO authenticated;

-- Add RLS policies for new columns (if needed)
-- The existing RLS policies should already cover the new columns since they're based on workspace_id

COMMENT ON FUNCTION detect_persona_attributes(TEXT) IS 'Automatically detect persona attributes from description text';
COMMENT ON FUNCTION check_user_persona_limit(UUID) IS 'Check if user can create more personas across all workspaces based on subscription tier';
COMMENT ON FUNCTION check_workspace_persona_limit(UUID) IS 'Check if workspace can create more personas based on workspace owner subscription tier'; 