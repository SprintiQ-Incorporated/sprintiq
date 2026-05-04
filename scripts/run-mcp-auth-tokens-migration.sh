#!/bin/bash

# Run the MCP auth tokens table migration
echo "Creating MCP auth tokens table..."

# Check if we have the necessary environment variables
if [ -z "$DATABASE_URL" ] && [ -z "$SUPABASE_URL" ]; then
    echo "Error: DATABASE_URL or SUPABASE_URL environment variable is required"
    exit 1
fi

# Run the SQL script
if [ -n "$DATABASE_URL" ]; then
    psql "$DATABASE_URL" -f "$(dirname "$0")/create-mcp-auth-tokens-table.sql"
else
    echo "Please run the SQL script create-mcp-auth-tokens-table.sql manually in your Supabase dashboard"
    echo "Or set the DATABASE_URL environment variable to run it automatically"
fi

echo "MCP auth tokens table migration completed!" 