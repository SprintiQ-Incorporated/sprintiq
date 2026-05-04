-- Add role field to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'User';

-- Update existing users to have 'User' role if they don't have one
UPDATE users SET role = 'User' WHERE role IS NULL;

-- Add constraint to ensure role is one of the allowed values
ALTER TABLE users ADD CONSTRAINT check_role CHECK (role IN ('Admin', 'User', 'Investor')); 