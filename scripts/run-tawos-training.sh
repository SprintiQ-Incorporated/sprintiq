#!/bin/bash

# TAWOS Training Script
# This script trains TAWOS data from JSON files to Supabase Vector Database

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if required environment variables are set
check_env_vars() {
    print_status "Checking environment variables..."
    
    if [ -z "$VOYAGE_API_KEY" ]; then
        print_error "VOYAGE_API_KEY environment variable is required"
        exit 1
    fi

    print_success "Voyage API key found - will use Voyage AI embeddings"
    
    if [ -z "$NEXT_PUBLIC_SUPABASE_URL" ]; then
        print_error "NEXT_PUBLIC_SUPABASE_URL environment variable is not set"
        exit 1
    fi
    
    if [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
        print_error "SUPABASE_SERVICE_ROLE_KEY environment variable is not set"
        exit 1
    fi
    
    print_success "Environment variables are properly configured"
}

# Check if required tools are installed
check_dependencies() {
    print_status "Checking dependencies..."
    
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed"
        exit 1
    fi
    
    if ! command -v pnpm &> /dev/null; then
        print_error "pnpm is not installed"
        exit 1
    fi
    
    print_success "Dependencies are satisfied"
}

# Install dependencies if needed
install_dependencies() {
    print_status "Installing dependencies..."
    
    if [ ! -d "node_modules" ]; then
        pnpm install
        print_success "Dependencies installed"
    else
        print_status "Dependencies already installed"
    fi
}

# Run the training script
run_training() {
    local json_file=$1
    
    print_status "Starting TAWOS training with file: $json_file"
    
    # Run the TypeScript training script
    npx tsx scripts/train-tawos-data.ts "$json_file"
    
    if [ $? -eq 0 ]; then
        print_success "Training completed successfully!"
    else
        print_error "Training failed!"
        exit 1
    fi
}

# Main function
main() {
    echo "🚀 TAWOS Vector Database Training Script"
    echo "========================================"
    echo ""
    
    # Check if JSON file is provided
    if [ $# -eq 0 ]; then
        print_error "No JSON file specified"
        echo ""
        echo "Usage: $0 <path-to-json-file>"
        echo ""
        echo "Examples:"
        echo "  $0 public/sample-tawos-dataset.json"
        echo "  $0 data/my-tawos-data.json"
        echo ""
        exit 1
    fi
    
    local json_file=$1
    
    # Check if file exists
    if [ ! -f "$json_file" ]; then
        print_error "File not found: $json_file"
        exit 1
    fi
    
    # Check if file is valid JSON
    if ! jq empty "$json_file" 2>/dev/null; then
        print_error "Invalid JSON file: $json_file"
        exit 1
    fi
    
    print_success "Valid JSON file found: $json_file"
    
    # Run checks
    check_env_vars
    check_dependencies
    install_dependencies
    
    # Run training
    run_training "$json_file"
    
    echo ""
    print_success "🎉 TAWOS training process completed!"
    echo ""
    echo "Next steps:"
    echo "1. Check your Supabase dashboard to verify the data"
    echo "2. Test the AI story generation with your trained data"
    echo "3. Monitor the vector similarity search performance"
    echo ""
}

# Run main function with all arguments
main "$@" 