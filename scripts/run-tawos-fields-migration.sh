#!/bin/bash

# Script to add TAWOS fields to tasks table

echo "Adding TAWOS fields to tasks table..."

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
echo "Running TAWOS fields migration..."
psql "$DATABASE_URL" -f scripts/add-tawos-fields-to-tasks.sql

if [ $? -eq 0 ]; then
    echo "✅ Migration completed successfully!"
    echo "The following fields have been added to the tasks table:"
    echo "  - story_points (INTEGER)"
    echo "  - estimated_time (DECIMAL(5,2))"
    echo "  - business_value (INTEGER 1-5)"
    echo "  - success_pattern (TEXT)"
    echo "  - completion_rate (DECIMAL(5,2))"
    echo "  - velocity (DECIMAL(5,2))"
    echo "  - anti_pattern_warnings (JSONB)"
    echo "  - requirements (JSONB)"
    echo "  - tawos_metadata (JSONB)"
    echo ""
    echo "Additional features added:"
    echo "  - Performance indexes on new fields"
    echo "  - Automatic trigger to sync external_data with new fields"
    echo "  - tawos_tasks view for easy querying"
    echo "  - Migration of existing TAWOS data from external_data"
else
    echo "❌ Migration failed!"
    exit 1
fi 