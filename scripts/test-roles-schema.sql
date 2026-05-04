-- Test script to check roles table schema and data
-- This will help us understand what columns exist and what data is in the table

-- Check table structure
\d roles;

-- Check if new columns exist
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'roles' 
ORDER BY ordinal_position;

-- Check existing data
SELECT id, name, description, created_at 
FROM roles 
LIMIT 5;

-- Test insert with minimal data
INSERT INTO roles (name, description) 
VALUES ('Test Role', 'Test Description') 
RETURNING *;

-- Clean up test data
DELETE FROM roles WHERE name = 'Test Role';
