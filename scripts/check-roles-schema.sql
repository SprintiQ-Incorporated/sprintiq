-- Check current roles table schema
\d roles;

-- Check if new columns exist
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'roles' 
ORDER BY ordinal_position;

-- Check existing roles data
SELECT id, name, description, created_at 
FROM roles 
LIMIT 5;
