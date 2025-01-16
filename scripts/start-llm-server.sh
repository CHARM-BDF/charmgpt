#!/bin/bash

# Build the TypeScript files
echo "Building TypeScript files..."
npm run build

# Start the LLM server
echo "Starting LLM server..."
node dist/server/llm-server.js 