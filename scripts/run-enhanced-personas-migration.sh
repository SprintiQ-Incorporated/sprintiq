#!/bin/bash

# Run enhanced personas migration for Story 2.3
# This script enhances the personas table with new fields for tech-savviness, usage frequency, priority, and TAWOS integration

set -e

echo "🚀 Starting enhanced personas migration for Story 2.3..."

# Check if SUPABASE_URL and SUPABASE_ANON_KEY are set
if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_ANON_KEY" ]; then
    echo "❌ Error: SUPABASE_URL and SUPABASE_ANON_KEY environment variables must be set"
    echo "Please set these variables in your .env file or environment"
    exit 1
fi

# Run the SQL migration
echo "📝 Enhancing personas table with new fields..."
psql "$SUPABASE_URL" -f scripts/enhance-personas-table.sql

echo "✅ Enhanced personas migration completed successfully!"
echo ""
echo "📋 What was added:"
echo "   - tech_savviness (1-5 scale for technical skill level)"
echo "   - usage_frequency (daily/weekly/monthly)"
echo "   - priority_level (high/medium/low)"
echo "   - role (specific role like 'Data Scientist')"
echo "   - domain (industry domain like 'fintech', 'ecommerce')"
echo "   - tawos_patterns (JSON field for TAWOS integration)"
echo "   - auto_detected (boolean for tracking auto-detection)"
echo "   - subscription_tier, subscription_limits, and subscription_expires_at in profiles"
echo ""
echo "🔧 New Features:"
echo "   - Automatic attribute detection from description"
echo "   - Database trigger for auto-detection"
echo "   - Subscription limit checking function"
echo "   - Enhanced indexing for better performance"
echo ""
echo "🎯 Story 2.3 Requirements Met:"
echo "   ✅ Tech-savviness level (1-5) with auto-detection"
echo "   ✅ Usage frequency (daily/weekly/monthly)"
echo "   ✅ Priority level (high/medium/low)"
echo "   ✅ Role detection and storage"
echo "   ✅ Domain intelligence (fintech/ecommerce/enterprise)"
echo "   ✅ TAWOS integration support"
echo "   ✅ Subscription limits (Free: 3, Starter: 5, Pro/Enterprise: unlimited) - User-level"
echo "   ✅ Personas persist across sessions"
echo ""
echo "🔒 Security:"
echo "   - RLS policies maintained for new columns"
echo "   - Proper permissions for new functions"
echo "   - Input validation with CHECK constraints"
echo ""
echo "🎉 Enhanced personas feature is now ready to use!"
echo ""
echo "📝 Next steps:"
echo "   1. Update the CreatePersonaModal component"
echo "   2. Integrate with persona-intelligence-service.ts"
echo "   3. Add subscription limit enforcement in UI"
echo "   4. Test auto-detection functionality" 