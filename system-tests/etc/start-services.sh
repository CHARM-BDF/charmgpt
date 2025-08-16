#!/bin/bash

# System Tests Service Startup Script
# This script starts all required services for Cypress system testing

set -e

echo "🚀 Starting services for system tests..."

# Function to wait for a service to be ready
wait_for_service() {
    local url=$1
    local service_name=$2
    local max_attempts=30
    local attempt=1
    
    echo "⏳ Waiting for $service_name to be ready..."
    
    while [ $attempt -le $max_attempts ]; do
        if curl -s "$url" >/dev/null 2>&1; then
            echo "✅ $service_name is ready"
            return 0
        fi
        
        echo "   Attempt $attempt/$max_attempts - $service_name not ready yet..."
        sleep 2
        attempt=$((attempt + 1))
    done
    
    echo "❌ $service_name failed to start within timeout"
    return 1
}

# Pull Ollama Docker image if it doesn't exist
echo "🤖 Pulling Ollama Docker image..."
if ! docker image inspect ollama/ollama >/dev/null 2>&1; then
    echo "   Pulling ollama/ollama image..."
    docker pull ollama/ollama
else
    echo "   ollama/ollama image already exists"
fi

# Pull Docker images if they don't exist
echo "🐳 Pulling Docker images..."
if ! docker image inspect my-python-mcp >/dev/null 2>&1; then
    echo "   Pulling python-mcp image..."
    docker pull namin/my-python-mcp
    docker tag namin/my-python-mcp my-python-mcp
else
    echo "   python-mcp image already exists"
fi

if ! docker image inspect my-r-mcp >/dev/null 2>&1; then
    echo "   Pulling r-mcp image..."
    docker pull namin/my-r-mcp
    docker tag namin/my-r-mcp my-r-mcp
else
    echo "   r-mcp image already exists"
fi

# Stop and remove existing containers
echo "🧹 Cleaning up existing containers..."
docker stop python-mcp-test 2>/dev/null || true
docker rm python-mcp-test 2>/dev/null || true
docker stop r-mcp-test 2>/dev/null || true
docker rm r-mcp-test 2>/dev/null || true
docker stop ollama-test 2>/dev/null || true
docker rm ollama-test 2>/dev/null || true

# Start Ollama container
echo "🤖 Starting Ollama container..."
docker run -d -v ollama:/root/.ollama --name ollama-test -p 11434:11434 ollama/ollama

# Wait for Ollama
wait_for_service "http://localhost:11434/api/tags" "Ollama" || true

# Wait for services to be ready
echo "⏳ Waiting for services to be ready..."

# Pull required Ollama models
echo "🤖 Pulling required Ollama models..."
docker exec ollama-test ollama pull deepseek-coder:latest || echo "   Failed to pull deepseek-coder:latest"
docker exec ollama-test ollama pull llama3.2 || echo "   Failed to pull llama3.2"

# Check Ollama models
echo "🤖 Checking Ollama models..."
OLLAMA_RESPONSE=$(curl -s http://localhost:11434/api/tags 2>/dev/null || echo '{"models": []}')
MODELS=$(echo "$OLLAMA_RESPONSE" | grep -o '"name":"[^"]*"' | cut -d'"' -f4)

HAS_DEEPSEEK=false
HAS_LLAMA=false

for model in $MODELS; do
    if [[ $model == *"deepseek-coder"* ]]; then
        HAS_DEEPSEEK=true
    fi
    if [[ $model == *"llama3.2"* ]]; then
        HAS_LLAMA=true
    fi
done

if [ "$HAS_DEEPSEEK" = true ] || [ "$HAS_LLAMA" = true ]; then
    echo "✅ Required Ollama models found"
else
    echo "⚠️  Warning: Required Ollama models not found"
    echo "   Models will be pulled automatically when needed"
fi


# Start backend service
echo "🔧 Starting backend and frontend services..."
echo "   In new shell, run 'npm run test:e2e' in 'system-tests' directory"
cd ..
npm run start