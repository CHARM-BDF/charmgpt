#!/bin/bash

# MCP API Template Setup Script
# Usage: ./setup.sh [api-name]
# Example: ./setup.sh newsapi

set -e

# Get API name from argument or prompt
if [ -z "$1" ]; then
    echo "🚀 MCP API Template Setup"
    echo "========================="
    echo ""
    read -p "Enter your API name (e.g., 'newsapi', 'github', 'weather'): " API_NAME
else
    API_NAME="$1"
fi

# Validate API name
if [[ ! "$API_NAME" =~ ^[a-z][a-z0-9-]*[a-z0-9]$ ]]; then
    echo "❌ Error: API name must be lowercase, start with a letter, and contain only letters, numbers, and hyphens."
    echo "   Examples: newsapi, github-api, weather-service"
    exit 1
fi

PROJECT_DIR="../${API_NAME}-mcp"

echo ""
echo "📁 Creating project: $PROJECT_DIR"

# Check if target directory exists
if [ -d "$PROJECT_DIR" ]; then
    echo "❌ Error: Directory $PROJECT_DIR already exists!"
    exit 1
fi

# Copy template
echo "📋 Copying template files..."
cp -r . "$PROJECT_DIR"

# Remove setup script from new project
rm -f "$PROJECT_DIR/setup.sh"

cd "$PROJECT_DIR"

# Update package.json
echo "📝 Updating package.json..."
sed -i.bak "s/@custom-mcp\/example-api/@custom-mcp\/${API_NAME}/g" package.json
sed -i.bak "s/MCP server for integrating with \[API_NAME\]/MCP server for integrating with ${API_NAME}/g" package.json
rm package.json.bak

# Update environment example
echo "📝 Updating environment configuration..."
API_NAME_UPPER=$(echo "$API_NAME" | tr '[:lower:]' '[:upper:]' | tr '-' '_')
sed -i.bak "s/EXAMPLE/${API_NAME_UPPER}/g" env.example
rm env.example.bak

# Create .env from example
cp env.example .env

# Update TypeScript configuration hints
echo "📝 Adding API-specific hints to index.ts..."
sed -i.bak "s/EXAMPLE_API_KEY/${API_NAME_UPPER}_API_KEY/g" src/index.ts
sed -i.bak "s/EXAMPLE_USER_EMAIL/${API_NAME_UPPER}_USER_EMAIL/g" src/index.ts
sed -i.bak "s/example-api-mcp/${API_NAME}-mcp/g" src/index.ts
sed -i.bak "s/example-api/${API_NAME}/g" src/index.ts
rm src/index.ts.bak

# Install dependencies
echo "📦 Installing dependencies..."
npm install

echo ""
echo "✅ Project created successfully!"
echo ""
echo "📍 Project location: $PROJECT_DIR"
echo ""
echo "🔧 Next steps:"
echo "1. cd $PROJECT_DIR"
echo "2. Edit .env with your API credentials"
echo "3. Customize src/index.ts (follow the TODO comments)"
echo "4. Test with: npm run dev"
echo ""
echo "📚 Documentation:"
echo "- README.md - Comprehensive setup guide"
echo "- QUICK_REFERENCE.md - Fast customization checklist"
echo "- examples/newsapi-implementation.md - Concrete example"
echo ""
echo "🎯 Focus areas to customize:"
echo "- Lines 11-35: API configuration"
echo "- Lines 37-70: Input schemas"
echo "- Lines 87-130: Authentication & requests"
echo "- Lines 132-190: Data formatting"
echo "- Lines 235-310: Tool definitions"
echo "- Lines 315-450: Tool execution"
echo ""
echo "Happy coding! 🚀" 