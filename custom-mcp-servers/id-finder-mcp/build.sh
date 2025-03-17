#!/bin/bash

# Build and test script for ID Finder MCP server

# Print commands
set -x

# Exit on error
set -e

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  npm install
fi

# Build TypeScript
echo "Building TypeScript..."
npm run build

# Create logs directory if it doesn't exist
mkdir -p logs

echo "Build complete. To run the server, use:"
echo "npm start"
echo ""
echo "Or to capture logs:"
echo "npm start > logs/stdout.log 2> logs/stderr.log" 