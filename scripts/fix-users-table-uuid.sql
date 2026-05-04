-- Fix users table to use UUID primary key instead of SERIAL
-- This script converts the existing users table to use UUIDs

-- First, backup existing data (if any)
CREATE TABLE IF NOT EXISTS users_backup AS SELECT * FROM users;

-- Drop the existing users table
DROP TABLE IF EXISTS users;

-- Create the new users table with UUID primary key
CREATE TABLE users (
  id UUID PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(50) DEFAULT 'user',
  allowed BOOLEAN DEFAULT FALSE,
  company VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_allowed ON users(allowed);
CREATE INDEX IF NOT EXISTS idx_users_company ON users(company);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_users_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at 
  BEFORE UPDATE ON users 
  FOR EACH ROW 
  EXECUTE FUNCTION update_users_updated_at();

-- Note: If you had existing data in the users_backup table, you would need to migrate it here
-- with proper UUID generation for each existing record
