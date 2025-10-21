#!/bin/bash

# Start the Charm MCP server with separate timestamped log files for each service
# Usage: ./start-with-separate-logs.sh

echo "Starting Charm MCP Server with separate service logs..."

# Create logs directory if it doesn't exist
mkdir -p logs

# Generate timestamp for this session
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")

# Create separate log files for each service
VITE_LOG="logs/vite_${TIMESTAMP}.log"
SERVER_LOG="logs/server_${TIMESTAMP}.log"
PRISMA_LOG="logs/prisma_${TIMESTAMP}.log"
COMBINED_LOG="logs/combined_${TIMESTAMP}.log"

echo "Log files:"
echo "  Vite: $VITE_LOG"
echo "  Server: $SERVER_LOG"
echo "  Prisma: $PRISMA_LOG"
echo "  Combined: $COMBINED_LOG"
echo ""

# Start the services with separate logging (using original command to avoid loops)
npm run kill-ports && concurrently -n "VITE,SERVER,PRISMA" -c "blue,green,yellow" "npm run dev --workspace=frontend-client" "npm run server:dev --workspace=backend-mcp-client" "npm run db:studio --workspace=backend-mcp-client" 2>&1 | tee -a "$COMBINED_LOG" | while IFS= read -r line; do
    # Write to combined log
    echo "$line" >> "$COMBINED_LOG"
    
    # Write to service-specific logs based on prefixes
    if [[ "$line" == *"[VITE]"* ]]; then
        echo "$line" >> "$VITE_LOG"
    elif [[ "$line" == *"[SERVER]"* ]]; then
        echo "$line" >> "$SERVER_LOG"
    elif [[ "$line" == *"[PRISMA]"* ]]; then
        echo "$line" >> "$PRISMA_LOG"
    else
        # If no prefix, write to all service logs
        echo "$line" >> "$VITE_LOG"
        echo "$line" >> "$SERVER_LOG"
        echo "$line" >> "$PRISMA_LOG"
    fi
done
