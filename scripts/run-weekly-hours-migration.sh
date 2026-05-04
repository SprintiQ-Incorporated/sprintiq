#!/bin/bash

# Script to add weekly_hours field to team_members table

echo "Adding weekly_hours field to team_members table..."

# Check if psql is available
if ! command -v psql &> /dev/null; then
    echo "Error: psql is not installed or not in PATH"
    exit 1
fi

# Check if environment variables are set
if [ -z "$DATABASE_URL" ]; then
    echo "Error: DATABASE_URL environment variable is not set"
    echo "Please set it to your Supabase database URL"
    exit 1
fi

# Run the migration
echo "Running migration..."
psql "$DATABASE_URL" -f scripts/add-weekly-hours-to-team-members.sql

if [ $? -eq 0 ]; then
    echo "✅ Migration completed successfully!"
    echo "The weekly_hours field has been added to the team_members table."
else
    echo "❌ Migration failed!"
    exit 1
fi 