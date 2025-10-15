#!/bin/bash

# Database Setup Script for Charm MCP
# This script sets up the SQLite database using Prisma

set -e  # Exit on error

echo "🗄️  Setting up Charm MCP Database..."
echo ""

# Check if backend directory exists
if [ ! -d "backend-mcp-client" ]; then
    echo "❌ Error: backend-mcp-client directory not found"
    echo "Please run this script from the repository root"
    exit 1
fi

# Navigate to backend directory
cd backend-mcp-client

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "⚠️  No .env file found. Creating one with default settings..."
    cat > .env << EOF
# Database Configuration
DATABASE_URL="file:./dev.db"

# Server Configuration
PORT=3001
NODE_ENV=development

# Add other environment variables as needed
# BRAVE_API_KEY=your_brave_api_key_here
# NCBI_API_KEY=your_ncbi_api_key_here
# NCBI_TOOL_EMAIL=your_email@example.com
EOF
    echo "✅ Created .env file with default database configuration"
    echo ""
fi

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing backend dependencies..."
    npm install
    echo "✅ Dependencies installed"
    echo ""
fi

# Generate Prisma client
echo "🔧 Generating Prisma client..."
npm run db:generate

# Push schema to database (creates dev.db if it doesn't exist)
echo "🔧 Creating/updating database schema..."
npm run db:push

# Check if database was created
if [ -f "dev.db" ]; then
    echo ""
    echo "✅ Database setup complete!"
    echo ""
    echo "📊 Database location: backend-mcp-client/dev.db"
    echo "📋 Database schema:"
    echo "   - GraphProject: Main graph container"
    echo "   - GraphNode: Individual nodes with position and data"
    echo "   - GraphEdge: Connections between nodes with metadata"
    echo "   - GraphState: Snapshots for undo/redo functionality"
    echo ""
    echo "💡 Useful commands:"
    echo "   npm run db:studio    - Open Prisma Studio to view/edit data"
    echo "   npm run db:generate  - Regenerate Prisma client after schema changes"
    echo "   npm run db:migrate   - Create a new migration"
    echo ""
else
    echo "⚠️  Warning: Database file not found after setup"
    echo "Please check for errors above"
    exit 1
fi

# Return to root directory
cd ..

echo "🚀 Database is ready! You can now start the application with 'npm start'"

