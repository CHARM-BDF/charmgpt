#!/bin/bash

# ARAX MCP Server Build Script

echo "🧬 Building ARAX MCP Server..."

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Please run this script from the arax-mcp directory"
    exit 1
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

if [ $? -ne 0 ]; then
    echo "❌ Failed to install dependencies"
    exit 1
fi

# Build TypeScript
echo "🔨 Building TypeScript..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Failed to build TypeScript"
    exit 1
fi

# Make the built file executable
chmod +x dist/index.js

echo "✅ Build completed successfully!"
echo ""
echo "🚀 Usage:"
echo "  npm run start          # Start the MCP server"
echo "  node test-mcp.js       # Test the server"
echo ""
echo "📍 The server is ready to use with MCP clients!" 