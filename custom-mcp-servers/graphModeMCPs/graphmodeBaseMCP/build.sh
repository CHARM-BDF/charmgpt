#!/bin/bash

# Build script for Graph Mode MCP

set -e  # Exit on error

echo "🔨 Building Graph Mode MCP..."

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
else
    echo "✓ Dependencies already installed"
fi

# Clean dist directory
if [ -d "dist" ]; then
    echo "🧹 Cleaning dist directory..."
    rm -rf dist
fi

# Build TypeScript
echo "🏗️  Compiling TypeScript..."
npm run build

# Check if build was successful
if [ -f "dist/index.js" ]; then
    echo "✅ Build successful!"
    echo "📍 Output: dist/index.js"
    echo ""
    echo "To run: npm start"
else
    echo "❌ Build failed!"
    exit 1
fi

