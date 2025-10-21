#!/bin/bash

# Quick fix for LLM provider initialization
# This sets up Ollama as the default provider

echo "Setting up Ollama as default LLM provider..."

# Set environment variables for Ollama
export OLLAMA_BASE="http://localhost"
export OLLAMA_PORT="11434"

# Check if Ollama is running
if curl -s http://localhost:11434/api/tags > /dev/null; then
    echo "✅ Ollama is running"
    
    # Get available models
    echo "Available models:"
    curl -s http://localhost:11434/api/tags | jq -r '.models[].name' | head -5
    
    echo
    echo "To use a specific model, set:"
    echo "export OLLAMA_MODEL='llama3.2:latest'  # or any other model"
    echo
    echo "Then restart the server with: ./start-server.sh"
else
    echo "❌ Ollama is not running"
    echo "Start it with: ollama serve"
fi
