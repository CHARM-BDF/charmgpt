#!/bin/bash

# Test Database Initialization Script for Charm MCP Backend
# This script tests the database setup using a test database name

set -e  # Exit on any error

echo "🧪  Charm MCP Database Initialization TEST"
echo "=========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Get the directory where the script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Change to project directory
cd "$PROJECT_DIR"

echo "📁 Project directory: $PROJECT_DIR"
echo ""

# Use test database name
TEST_DB_NAME="test-dev.db"
TEST_DB_PATH="prisma/$TEST_DB_NAME"

echo "🧪 Using test database: $TEST_DB_PATH"
echo ""

# Step 1: Check if .env file exists
if [ ! -f ".env" ]; then
    echo "${YELLOW}⚠️  .env file not found. Creating from example...${NC}"
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo "${GREEN}✓ Created .env file from .env.example${NC}"
    else
        # Create a minimal .env file with test database
        echo "DATABASE_URL=\"file:./prisma/$TEST_DB_NAME\"" > .env
        echo "${GREEN}✓ Created minimal .env file with test database${NC}"
    fi
    echo ""
else
    echo "${GREEN}✓ .env file exists${NC}"
    
    # Backup current DATABASE_URL and set test one
    if grep -q "DATABASE_URL" .env; then
        # Create backup of current .env
        cp .env .env.backup
        echo "${GREEN}✓ Backed up current .env to .env.backup${NC}"
        
        # Update DATABASE_URL to test database
        sed -i.bak "s|DATABASE_URL=.*|DATABASE_URL=\"file:./prisma/$TEST_DB_NAME\"|" .env
        echo "${GREEN}✓ Updated .env to use test database${NC}"
    else
        echo "DATABASE_URL=\"file:./prisma/$TEST_DB_NAME\"" >> .env
        echo "${GREEN}✓ Added test DATABASE_URL to .env${NC}"
    fi
    echo ""
fi

# Step 2: Remove test database if it exists
if [ -f "$TEST_DB_PATH" ]; then
    echo "${YELLOW}⚠️  Test database already exists${NC}"
    rm -f "$TEST_DB_PATH"
    rm -f "$TEST_DB_PATH-journal"
    echo "${GREEN}✓ Removed existing test database${NC}"
    echo ""
fi

# Step 3: Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "${YELLOW}⚠️  node_modules not found. Installing dependencies...${NC}"
    npm install
    echo "${GREEN}✓ Dependencies installed${NC}"
    echo ""
else
    echo "${GREEN}✓ Dependencies are installed${NC}"
    echo ""
fi

# Step 4: Generate Prisma Client
echo "🔧 Generating Prisma Client..."
npm run db:generate
echo "${GREEN}✓ Prisma Client generated${NC}"
echo ""

# Step 5: Push database schema (creates tables)
echo "📤 Pushing database schema to test database..."
npm run db:push
echo "${GREEN}✓ Test database schema created${NC}"
echo ""

# Step 6: Verify test database was created
if [ -f "$TEST_DB_PATH" ]; then
    echo "${GREEN}✓ Test database file created successfully${NC}"
    echo ""
    
    # Get file size
    DB_SIZE=$(du -h "$TEST_DB_PATH" | cut -f1)
    echo "📊 Test database size: $DB_SIZE"
    
    # Show table count
    TABLE_COUNT=$(sqlite3 "$TEST_DB_PATH" "SELECT COUNT(*) FROM sqlite_master WHERE type='table';" 2>/dev/null || echo "0")
    echo "📋 Tables created: $TABLE_COUNT"
    
    # List tables
    echo "📋 Table names:"
    sqlite3 "$TEST_DB_PATH" ".tables" 2>/dev/null || echo "Could not list tables"
else
    echo "${RED}✗ Test database file was not created${NC}"
    exit 1
fi

echo ""
echo "=========================================="
echo "${GREEN}✅ Test database initialization complete!${NC}"
echo "=========================================="
echo ""
echo "📝 Test Results:"
echo "   • Test database: $TEST_DB_PATH"
echo "   • Original database: prisma/dev.db (preserved)"
echo "   • .env backup: .env.backup"
echo ""
echo "🔄 To restore original setup:"
echo "   1. mv .env.backup .env"
echo "   2. rm $TEST_DB_PATH"
echo ""
echo "📋 Database schema includes:"
echo "   • GraphProject - Main graph containers"
echo "   • GraphNode - Individual nodes with positions"
echo "   • GraphEdge - Connections between nodes"
echo "   • GraphState - Snapshots for undo/redo"
echo ""

