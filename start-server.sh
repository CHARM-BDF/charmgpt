#!/bin/bash

# Start the Charm MCP server with proper environment setup
# Usage: ./start-server.sh

echo "Starting Charm MCP Server..."

# Set the database URL (absolute path)
export DATABASE_URL="file:$(pwd)/backend-mcp-client/prisma/dev.db"
echo "Root DATABASE_URL: $DATABASE_URL"

# Set LLM API keys (you need to set these with your actual API keys)
export ANTHROPIC_API_KEY="${ANTHROPIC_API_KEY:-your_anthropic_api_key_here}"
export OPENAI_API_KEY="${OPENAI_API_KEY:-your_openai_api_key_here}"

# Set Ollama configuration (local AI - no API key needed)
export OLLAMA_BASE="http://localhost"
export OLLAMA_PORT="11434"

# Set other required environment variables
export PORT=3001
export NODE_ENV=development
export MCP_AUTH_TOKEN="${MCP_AUTH_TOKEN:-your-auth-token-here}"

# Generate Prisma client first
echo "Generating Prisma client..."
cd backend-mcp-client
export DATABASE_URL="file:$(pwd)/prisma/dev.db"
echo "Using DATABASE_URL: $DATABASE_URL"
npm run db:generate
npm run db:push
cd ..

# Start the server with proper environment
echo "Starting all services..."
export DATABASE_URL="file:$(pwd)/backend-mcp-client/prisma/dev.db"
echo "Server DATABASE_URL: $DATABASE_URL"

# Set DATABASE_URL for the server process
export DATABASE_URL="file:$(pwd)/backend-mcp-client/prisma/dev.db"
npm start

