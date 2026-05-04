#!/bin/bash

# Script to check if the roles table migration has been run and run it if needed

echo "🔍 Checking roles table schema..."

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "❌ Error: DATABASE_URL environment variable is not set"
    echo "Please set it with: export DATABASE_URL='your_database_url_here'"
    exit 1
fi

# Check if the new columns exist
echo "Checking for new columns in roles table..."
COLUMNS_EXIST=$(psql "$DATABASE_URL" -t -c "
SELECT COUNT(*) 
FROM information_schema.columns 
WHERE table_name = 'roles' 
AND column_name IN ('created_by', 'workspace_id', 'experience', 'core_competencies', 'category', 'is_template', 'template_data');
")

if [ "$COLUMNS_EXIST" -eq 7 ]; then
    echo "✅ All new columns already exist in roles table"
    echo "Migration has already been run."
else
    echo "⚠️  New columns are missing. Running migration..."
    echo "Found $COLUMNS_EXIST out of 7 expected columns"
    
    # Run the migration
    echo "🚀 Running roles table enhancement migration..."
    psql "$DATABASE_URL" -f scripts/enhance-roles-table.sql
    
    if [ $? -eq 0 ]; then
        echo "✅ Migration completed successfully!"
    else
        echo "❌ Migration failed!"
        exit 1
    fi
fi

echo "🎉 Roles table is ready!"
