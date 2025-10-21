#!/bin/bash

# Start the Charm MCP server with a timestamped log file
# This is a simple wrapper around your existing approach
# Usage: ./start-with-timestamp.sh

echo "Starting Charm MCP Server with timestamped log..."

# Create logs directory if it doesn't exist
mkdir -p logs

# Generate timestamp for this session
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
LOG_FILE="logs/logtext_${TIMESTAMP}.log"

echo "Log file: $LOG_FILE"
echo "Starting services..."

# Use the original npm start command directly to avoid loops
npm run kill-ports && concurrently -n "VITE,SERVER,PRISMA" -c "blue,green,yellow" "npm run dev --workspace=frontend-client" "npm run server:dev --workspace=backend-mcp-client" "npm run db:studio --workspace=backend-mcp-client" 2>&1 | tee -a "$LOG_FILE"
