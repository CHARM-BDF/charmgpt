#!/bin/bash

# Start the Charm MCP server with timestamped log files
# Usage: ./start-with-timestamped-logs.sh

echo "Starting Charm MCP Server with timestamped logs..."

# Create logs directory if it doesn't exist
mkdir -p logs

# Generate timestamp for this session
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
LOG_FILE="logs/charm-mcp_${TIMESTAMP}.log"

echo "Log file: $LOG_FILE"
echo "Starting services..."

# Start with timestamped log file (using original command to avoid loops)
npm run kill-ports && concurrently -n "VITE,SERVER,PRISMA" -c "blue,green,yellow" "npm run dev --workspace=frontend-client" "npm run server:dev --workspace=backend-mcp-client" "npm run db:studio --workspace=backend-mcp-client" 2>&1 | tee -a "$LOG_FILE"
