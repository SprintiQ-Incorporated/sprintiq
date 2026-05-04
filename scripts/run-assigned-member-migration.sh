#!/bin/bash

# Script to add assigned_member_id field to tasks table

echo "Adding assigned_member_id field to tasks table..."

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
echo "Running assigned_member_id migration..."
psql "$DATABASE_URL" -f scripts/add-assigned-member-id-to-tasks.sql

if [ $? -eq 0 ]; then
    echo "✅ Migration completed successfully!"
    echo "The following changes have been made to the tasks table:"
    echo "  - Added assigned_member_id field (UUID, references team_members.id)"
    echo "  - Created index for better performance"
    echo "  - Created tasks_with_team_members view for easy querying"
    echo ""
    echo "The assigned_member_id field will now store the team member ID"
    echo "when stories are generated with AI team assignments."
else
    echo "❌ Migration failed!"
    exit 1
fi 