#!/bin/bash

# Run user_baselines table migration
# This script creates the user_baselines table for storing onboarding survey data

echo "Running user_baselines table migration..."

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "Error: .env file not found. Please make sure you're in the project root directory."
    exit 1
fi

# Load environment variables
source .env

# Check if required environment variables are set
if [ -z "$NEXT_PUBLIC_SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
    echo "Error: Required environment variables not set. Please check your .env file."
    echo "Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY"
    exit 1
fi

# Run the SQL migration
echo "Creating user_baselines table..."
psql "$NEXT_PUBLIC_SUPABASE_URL" -f scripts/create-user-baselines-table.sql

if [ $? -eq 0 ]; then
    echo "✅ user_baselines table migration completed successfully!"
else
    echo "❌ user_baselines table migration failed!"
    exit 1
fi

echo "Migration complete!"
