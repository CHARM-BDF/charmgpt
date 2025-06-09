#!/bin/bash

# Build PKDED MCP Server
echo "Building PKDED MCP Server..."

# Clean previous build
rm -rf dist/

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
fi

# Build TypeScript
echo "Compiling TypeScript..."
npx tsc

if [ $? -eq 0 ]; then
    echo "✅ PKDED MCP Server built successfully!"
    echo "Dist files:"
    ls -la dist/
else
    echo "❌ Build failed!"
    exit 1
fi 