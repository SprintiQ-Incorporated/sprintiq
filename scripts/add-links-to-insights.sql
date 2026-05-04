-- Add links field to insights table
-- This field will store an array of JSON objects with type and url
ALTER TABLE insights ADD COLUMN IF NOT EXISTS links JSONB DEFAULT '[]';

-- Create index for better performance when querying links
CREATE INDEX IF NOT EXISTS idx_insights_links ON insights USING GIN (links);

-- Update existing insights with sample links (optional)
UPDATE insights 
SET links = '[
  {"type": "Facebook", "url": "https://facebook.com/sprintiq"},
  {"type": "Twitter", "url": "https://twitter.com/sprintiq"},
  {"type": "LinkedIn", "url": "https://linkedin.com/company/sprintiq"}
]'::jsonb
WHERE insight_id = 'AI-Native-sprint-planning';

UPDATE insights 
SET links = '[
  {"type": "Medium", "url": "https://medium.com/@sprintiq"},
  {"type": "YouTube", "url": "https://youtube.com/@sprintiq"}
]'::jsonb
WHERE insight_id = 'team-collaboration-best-practices'; 