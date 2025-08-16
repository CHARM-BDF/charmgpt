#!/bin/bash

# System Tests Prerequisites Check Script
# This script verifies all requirements are met before running tests

set -e

echo "🔍 Checking prerequisites for system tests..."

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check if a port is in use
check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null ; then
        echo "⚠️  Port $port is already in use"
        return 1
    fi
    return 0
}

# Check if Docker is running
echo "🐳 Checking Docker..."
if ! command_exists docker; then
    echo "❌ Docker is not installed. Please install Docker and try again."
    exit 1
fi

if ! docker info >/dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker and try again."
    exit 1
fi
echo "✅ Docker is running"

# Check if Ollama Docker container is running
echo "🤖 Checking Ollama Docker container..."
if ! docker ps --format "table {{.Names}}" | grep -q "ollama"; then
    echo "⚠️  Ollama Docker container not running. It will be started when starting services."
else
    echo "✅ Ollama Docker container is running"
fi

# Check required ports
echo "🔍 Checking port availability..."
check_port 3001 || echo "   Backend port 3001 may be in use"
check_port 5173 || echo "   Frontend port 5173 may be in use"
check_port 3002 || echo "   Python MCP port 3002 may be in use"
check_port 3003 || echo "   R MCP port 3003 may be in use"
check_port 11434 || echo "   Ollama port 11434 may be in use"

# Check if Docker images exist
echo "🐳 Checking Docker images..."
if ! docker image inspect python-mcp >/dev/null 2>&1; then
    echo "⚠️  python-mcp Docker image not found. It will be built when starting services."
else
    echo "✅ python-mcp Docker image exists"
fi

if ! docker image inspect r-mcp >/dev/null 2>&1; then
    echo "⚠️  r-mcp Docker image not found. It will be built when starting services."
else
    echo "✅ r-mcp Docker image exists"
fi

if ! docker image inspect ollama/ollama >/dev/null 2>&1; then
    echo "⚠️  ollama/ollama Docker image not found. It will be pulled when starting services."
else
    echo "✅ ollama/ollama Docker image exists"
fi

echo ""
echo "✅ Prerequisites check completed!" 