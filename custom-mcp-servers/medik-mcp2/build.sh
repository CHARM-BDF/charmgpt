#!/bin/bash

# Build script for MediKanren MCP Server

echo "🔨 Building MediKanren MCP Server..."

# Clean previous build
echo "🧹 Cleaning previous build..."
rm -rf dist/

# Compile TypeScript
echo "📦 Compiling TypeScript..."
npx tsc

# Make the output executable
echo "🔧 Setting executable permissions..."
chmod +x dist/index.js

echo "✅ Build complete! Output available in dist/index.js"
echo "🚀 You can now run: node dist/index.js" 