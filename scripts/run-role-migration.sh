#!/bin/bash

# Run role migration for users table
echo "Running role migration for users table..."

# Get Supabase URL and key from environment
SUPABASE_URL=${SUPABASE_URL}
SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}

if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
    echo "Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set"
    exit 1
fi

# Run the SQL migration
echo "Executing SQL migration..."
psql "$SUPABASE_URL" -f scripts/add-role-to-users-table.sql

if [ $? -eq 0 ]; then
    echo "✅ Role migration completed successfully!"
    echo "Users table now has role field with Admin, User, Investor options"
else
    echo "❌ Role migration failed!"
    exit 1
fi 