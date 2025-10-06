#!/bin/bash

# PFOCR MCP Server Setup Script
# This script sets up the PFOCR MCP server for development

set -e

echo "🧬 Setting up PFOCR MCP Server..."

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

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env file from template..."
    cp env.example .env
    echo "✅ Created .env file. Please edit it with your configuration."
else
    echo "✅ .env file already exists"
fi

# Build the project
echo "🔨 Building the project..."
npm run build

echo "✅ PFOCR MCP Server setup complete!"
echo ""
echo "🚀 To start the server:"
echo "   npm run dev    # Development mode"
echo "   npm start      # Production mode"
echo ""
echo "📚 Documentation:"
echo "   README.md           # Full documentation"
echo "   QUICK_REFERENCE.md  # Quick reference guide"
echo ""
echo "🔧 Configuration:"
echo "   Edit .env file to set your email and other options"
echo ""
echo "🧪 Test the server:"
echo "   Try searching for 'cancer pathway' or 'metabolism'"
echo ""
echo "Happy pathway analysis! 🧬🚀"
