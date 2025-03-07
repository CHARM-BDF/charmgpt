#!/bin/bash

# Start the minimal MCP logging test environment
echo "Starting Minimal MCP Logging Test Environment..."

# Change to the minimal-server directory
cd "$(dirname "$0")/minimal-server"

# Run the server directly with NODE_ENV=test to ensure it doesn't trigger the main app
echo "Starting minimal server on port 3002..."
NODE_ENV=test node dist/index.js

# Note: The MCP server will be spawned by the minimal server 