-- Seed default roles
INSERT INTO roles (name, description) VALUES
('Front-end Developer', 'Develops user-facing features and interfaces'),
('Back-end Developer', 'Develops server-side logic and APIs'),
('Full-stack Developer', 'Develops both front-end and back-end components'),
('UI/UX Designer', 'Designs user interfaces and user experiences'),
('Product Manager', 'Manages product strategy and roadmap'),
('Project Manager', 'Manages project timelines and team coordination'),
('DevOps Engineer', 'Manages infrastructure and deployment processes'),
('QA Engineer', 'Tests software quality and ensures bug-free releases'),
('Data Scientist', 'Analyzes data and builds machine learning models'),
('Business Analyst', 'Analyzes business requirements and processes'),
('Marketing Specialist', 'Handles marketing strategies and campaigns'),
('Sales Representative', 'Manages customer relationships and sales'),
('Content Writer', 'Creates written content for various platforms'),
('Graphic Designer', 'Creates visual designs and graphics'),
('System Administrator', 'Manages IT systems and infrastructure');

-- Seed default levels
INSERT INTO levels (name, description) VALUES
('Junior', 'Entry-level position with 0-2 years of experience'),
('Mid-Level', 'Intermediate position with 2-5 years of experience'),
('Senior', 'Advanced position with 5+ years of experience'),
('Lead', 'Leadership position with team management responsibilities'),
('Principal', 'Expert position with strategic decision-making authority'),
('Architect', 'Technical leadership position with system design responsibilities'),
('Manager', 'Management position with team and project oversight'),
('Director', 'Executive position with department-level responsibilities'),
('VP', 'Vice President level with company-wide strategic impact'),
('C-Level', 'Chief-level executive position'); 