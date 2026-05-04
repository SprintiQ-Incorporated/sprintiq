#!/bin/bash

# Simple script to run the role enhancement migration
echo "Running role enhancement migration..."

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "Error: DATABASE_URL environment variable is not set"
    echo "Please set it with: export DATABASE_URL='your_database_url_here'"
    exit 1
fi

# Run the SQL migration
echo "Executing SQL migration..."
psql "$DATABASE_URL" -f scripts/enhance-roles-table.sql

if [ $? -eq 0 ]; then
    echo "✅ Migration completed successfully!"
    echo "New columns added to roles table:"
    echo "  - created_by (UUID, references profiles.id)"
    echo "  - workspace_id (UUID, references workspaces.id)"
    echo "  - Indexes created for optimal performance"
else
    echo "❌ Migration failed!"
    exit 1
fi
