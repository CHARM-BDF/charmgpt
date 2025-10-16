#!/bin/bash

# Database Initialization Script for Charm MCP Backend
# This script sets up a fresh Prisma database for the Graph Mode feature

set -e  # Exit on any error

echo "🗄️  Charm MCP Database Initialization"
echo "======================================"
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

# Step 1: Check if .env file exists
if [ ! -f ".env" ]; then
    echo "${YELLOW}⚠️  .env file not found. Creating from example...${NC}"
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo "${GREEN}✓ Created .env file from .env.example${NC}"
    else
        # Create a minimal .env file
        echo "DATABASE_URL=\"file:./prisma/dev.db\"" > .env
        echo "${GREEN}✓ Created minimal .env file${NC}"
    fi
    echo ""
else
    echo "${GREEN}✓ .env file exists${NC}"
    echo ""
fi

# Step 2: Check if DATABASE_URL is set
if ! grep -q "DATABASE_URL" .env; then
    echo "${YELLOW}⚠️  DATABASE_URL not found in .env. Adding default...${NC}"
    echo "DATABASE_URL=\"file:./prisma/dev.db\"" >> .env
    echo "${GREEN}✓ Added DATABASE_URL to .env${NC}"
    echo ""
else
    echo "${GREEN}✓ DATABASE_URL is configured${NC}"
    echo ""
fi

# Step 3: Remove existing database if it exists
if [ -f "prisma/dev.db" ]; then
    echo "${YELLOW}⚠️  Existing database found${NC}"
    read -p "Do you want to remove the existing database? (y/N) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        rm -f prisma/dev.db
        rm -f prisma/dev.db-journal
        echo "${GREEN}✓ Removed existing database${NC}"
    else
        echo "${YELLOW}⚠️  Keeping existing database${NC}"
    fi
    echo ""
fi

# Step 4: Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "${YELLOW}⚠️  node_modules not found. Installing dependencies...${NC}"
    npm install
    echo "${GREEN}✓ Dependencies installed${NC}"
    echo ""
else
    echo "${GREEN}✓ Dependencies are installed${NC}"
    echo ""
fi

# Step 5: Generate Prisma Client
echo "🔧 Generating Prisma Client..."
npm run db:generate
echo "${GREEN}✓ Prisma Client generated${NC}"
echo ""

# Step 6: Push database schema (creates tables)
echo "📤 Pushing database schema..."
npm run db:push
echo "${GREEN}✓ Database schema created${NC}"
echo ""

# Step 7: Verify database was created
if [ -f "prisma/dev.db" ]; then
    echo "${GREEN}✓ Database file created successfully${NC}"
    echo ""
    
    # Get file size
    DB_SIZE=$(du -h prisma/dev.db | cut -f1)
    echo "📊 Database size: $DB_SIZE"
else
    echo "${RED}✗ Database file was not created${NC}"
    exit 1
fi

echo ""
echo "======================================"
echo "${GREEN}✅ Database initialization complete!${NC}"
echo "======================================"
echo ""
echo "📝 Next steps:"
echo "   1. Start the backend server: npm run server:dev"
echo "   2. (Optional) View database: npm run db:studio"
echo "   3. The database will be automatically populated when you use Graph Mode"
echo ""
echo "📋 Database schema includes:"
echo "   • GraphProject - Main graph containers"
echo "   • GraphNode - Individual nodes with positions"
echo "   • GraphEdge - Connections between nodes"
echo "   • GraphState - Snapshots for undo/redo"
echo ""

