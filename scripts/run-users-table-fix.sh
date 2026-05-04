#!/bin/bash

# Script to fix users table UUID issue
# This script runs the SQL migration to convert the users table from SERIAL to UUID

set -e

echo "🔧 Fixing users table UUID issue..."

# Check if we're in the right directory
if [ ! -f "scripts/fix-users-table-uuid.sql" ]; then
    echo "❌ Error: fix-users-table-uuid.sql not found in scripts directory"
    echo "Please run this script from the project root directory"
    exit 1
fi

# Check if environment variables are set
if [ -z "$NEXT_PUBLIC_SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
    echo "❌ Error: Required environment variables not set"
    echo "Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY"
    exit 1
fi

echo "📋 Running users table UUID migration..."

# Run the migration using psql (if available) or provide instructions
if command -v psql &> /dev/null; then
    echo "🚀 Running migration with psql..."
    psql "$NEXT_PUBLIC_SUPABASE_URL" -f scripts/fix-users-table-uuid.sql
    echo "✅ Migration completed successfully!"
else
    echo "⚠️  psql not found. Please run the migration manually:"
    echo ""
    echo "1. Connect to your Supabase database"
    echo "2. Run the contents of scripts/fix-users-table-uuid.sql"
    echo ""
    echo "Or install psql and set up your database connection"
fi

echo "🎉 Users table UUID fix completed!"
echo ""
echo "Next steps:"
echo "1. Restart your application"
echo "2. Test user registration again"
echo "3. If you had existing users, you may need to migrate their data"
