-- Create insights table for managing blog posts
CREATE TABLE IF NOT EXISTS insights (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  insight_id TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  link TEXT,
  post_image TEXT,
  category TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',
  author TEXT,
  read_time TEXT,
  featured BOOLEAN DEFAULT FALSE,
  published BOOLEAN DEFAULT TRUE,
  post_date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_insights_category ON insights(category);
CREATE INDEX IF NOT EXISTS idx_insights_published ON insights(published);
CREATE INDEX IF NOT EXISTS idx_insights_featured ON insights(featured);
CREATE INDEX IF NOT EXISTS idx_insights_post_date ON insights(post_date);

-- Insert some sample data
INSERT INTO insights (insight_id, title, description, link, post_image, category, tags, author, read_time, featured, post_date) VALUES
(
  'AI-Native-sprint-planning',
  'The Future of AI-Native Agile Planning',
  'Discover how artificial intelligence is revolutionizing the way teams plan and execute sprints, leading to unprecedented productivity gains.',
  'https://blog.sprintiq.ai/AI-Native-sprint-planning',
  'https://images.unsplash.com/photo-1551434678-e076c223a692?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2070&q=80',
  'AI & Automation',
  ARRAY['AI', 'Sprint Planning', 'Productivity'],
  'Sarah Chen',
  '5 min read',
  TRUE,
  '2024-01-15'
),
(
  'team-collaboration-best-practices',
  '10 Best Practices for Effective Team Collaboration',
  'Learn the proven strategies that successful agile teams use to maintain high performance and deliver exceptional results consistently.',
  'https://blog.sprintiq.ai/team-collaboration-best-practices',
  'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2071&q=80',
  'Team Management',
  ARRAY['Collaboration', 'Agile', 'Leadership'],
  'Michael Rodriguez',
  '8 min read',
  FALSE,
  '2024-01-12'
),
(
  'story-point-estimation-guide',
  'How to Estimate Story Points Like a Pro',
  'Master the art of story point estimation with our comprehensive guide that will help your team make more accurate predictions.',
  'https://blog.sprintiq.ai/story-point-estimation-guide',
  'https://images.unsplash.com/photo-1460925895917-afdab827c52f?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2015&q=80',
  'Estimation',
  ARRAY['Story Points', 'Estimation', 'Planning'],
  'Emily Watson',
  '6 min read',
  FALSE,
  '2024-01-10'
),
(
  'jira-integration-guide',
  'Integrating Jira with SprintiQ: A Complete Guide',
  'Step-by-step instructions for seamlessly connecting your Jira instance with SprintiQ to streamline your workflow.',
  'https://blog.sprintiq.ai/jira-integration-guide',
  'https://images.unsplash.com/photo-1551288049-bebda4e38f71?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2070&q=80',
  'Integrations',
  ARRAY['Jira', 'Integration', 'Workflow'],
  'David Kim',
  '4 min read',
  FALSE,
  '2024-01-08'
),
(
  'sprint-retrospectives-psychology',
  'The Psychology Behind Successful Sprint Retrospectives',
  'Understand the human factors that make retrospectives effective and learn how to create a safe space for honest feedback.',
  'https://blog.sprintiq.ai/sprint-retrospectives-psychology',
  'https://images.unsplash.com/photo-1552664730-d307ca884978?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2070&q=80',
  'Psychology',
  ARRAY['Retrospectives', 'Psychology', 'Feedback'],
  'Lisa Thompson',
  '7 min read',
  FALSE,
  '2024-01-05'
),
(
  'remote-agile-teams',
  'Building High-Performing Remote Agile Teams',
  'Essential strategies for maintaining team cohesion and productivity when working across different time zones and locations.',
  'https://blog.sprintiq.ai/remote-agile-teams',
  'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2071&q=80',
  'Remote Work',
  ARRAY['Remote Work', 'Agile', 'Team Building'],
  'Alex Johnson',
  '9 min read',
  FALSE,
  '2024-01-03'
); 