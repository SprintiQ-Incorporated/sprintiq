#!/bin/bash

# Run personas table migration script
# This script creates the personas table in the database

set -e

echo "🚀 Starting personas table migration..."

# Check if SUPABASE_URL and SUPABASE_ANON_KEY are set
if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_ANON_KEY" ]; then
    echo "❌ Error: SUPABASE_URL and SUPABASE_ANON_KEY environment variables must be set"
    echo "Please set these variables in your .env file or environment"
    exit 1
fi

# Run the SQL migration
echo "📝 Creating personas table..."
psql "$SUPABASE_URL" -f scripts/create-personas-table.sql

echo "✅ Personas table migration completed successfully!"
echo ""
echo "📋 What was created:"
echo "   - personas table with all necessary fields"
echo "   - Indexes for better performance"
echo "   - Row Level Security (RLS) policies"
echo "   - Updated_at trigger"
echo ""
echo "🔒 Security:"
echo "   - RLS enabled on personas table"
echo "   - Users can only access personas in their workspace"
echo "   - Proper foreign key constraints"
echo ""
echo "🎉 You can now use the personas feature in your application!" 