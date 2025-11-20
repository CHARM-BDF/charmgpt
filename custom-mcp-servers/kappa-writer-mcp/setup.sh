#!/bin/bash

# Kappa Writer MCP Server Setup Script
# This script sets up the kappa-writer-mcp server

set -e

echo "🔧 Setting up Kappa Writer MCP Server..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm first."
    exit 1
fi

echo "✅ Node.js and npm are available"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Build the project
echo "🔨 Building the project..."
npm run build

# Check if build was successful
if [ -d "dist" ]; then
    echo "✅ Build successful"
else
    echo "❌ Build failed"
    exit 1
fi

# Make sure the syntax prompt file exists
if [ -f "Kappa_Syntax_Validation_Prompt.md" ]; then
    echo "✅ Kappa syntax validation prompt found"
else
    echo "❌ Kappa syntax validation prompt not found"
    exit 1
fi

echo ""
echo "🎉 Kappa Writer MCP Server setup complete!"
echo ""
echo "Available commands:"
echo "  npm run dev    - Start in development mode"
echo "  npm start      - Start the production server"
echo "  npm run build  - Build the project"
echo "  npm run lint   - Run linting"
echo ""
echo "The server provides two tools:"
echo "  - get-kappa-syntax-guide: Returns Kappa syntax guidance"
echo "  - validate-kappa-code: Validates Kappa code for errors"
echo ""
echo "Ready to use! 🚀"
