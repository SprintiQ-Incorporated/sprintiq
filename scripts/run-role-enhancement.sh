#!/bin/bash

# Run role enhancement migration
echo "Running role enhancement migration..."

# Check if SUPABASE_URL is set
if [ -z "$SUPABASE_URL" ]; then
    echo "Error: SUPABASE_URL environment variable is not set"
    echo "Please set it to your Supabase project URL"
    exit 1
fi

# Run the role enhancement SQL script
echo "Enhancing roles table with new columns and templates..."
psql "$SUPABASE_URL" -f scripts/enhance-roles-table.sql

if [ $? -eq 0 ]; then
    echo "✅ Role enhancement migration completed successfully!"
    echo ""
    echo "New features added:"
    echo "- Enhanced role table with experience, competencies, and categories"
    echo "- Pre-built role templates for common engineering roles"
    echo "- Support for detailed role descriptions and skill requirements"
    echo ""
    echo "You can now:"
    echo "1. Create detailed roles with competencies using the new role creation modal"
    echo "2. Use pre-built templates for common roles like AI/ML Engineer, Cloud Engineer, etc."
    echo "3. View enhanced role information in team member displays"
    echo "4. Manage roles through the new role management page"
else
    echo "❌ Role enhancement migration failed!"
    echo "Please check the error messages above and try again."
    exit 1
fi
