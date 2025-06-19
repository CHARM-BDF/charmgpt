#!/bin/bash

# Build all MCP servers and Docker images
# Usage: ./build-all-mcps.sh

set -e  # Exit on any error

# Display header
echo "====================================="
echo "Building All MCP Servers and Dockers"
echo "====================================="

# Store the root directory
ROOT_DIR=$(pwd)
cd $(dirname "$0")
MCP_ROOT=$(pwd)
cd ..
REPO_ROOT=$(pwd)

echo "Repository root: $REPO_ROOT"
echo "MCP servers root: $MCP_ROOT"
echo

# Function to check if Docker is running
check_docker() {
  if ! docker info > /dev/null 2>&1; then
    echo "⚠️ Docker is not running. Starting Docker..."
    open -a Docker
    
    # Wait for Docker to start (max 30 seconds)
    COUNTER=0
    echo "Waiting for Docker to start..."
    while ! docker info > /dev/null 2>&1; do
      if [ $COUNTER -gt 30 ]; then
        echo "❌ Docker failed to start in time. Please start Docker manually and try again."
        exit 1
      fi
      echo "."
      sleep 1
      COUNTER=$((COUNTER+1))
    done
    echo "✅ Docker is now running."
  else
    echo "✅ Docker is already running."
  fi
}

# Function to install and build MCP servers
build_mcp_servers() {
  echo
  echo "====================================="
  echo "Installing and building MCP servers"
  echo "====================================="
  
  cd "$REPO_ROOT"
  
  echo "Installing dependencies for all MCP servers..."
  npm run install:mcp-servers
  
  echo "Building all MCP servers..."
  npm run build:mcp-servers
  
  echo "✅ All MCP servers built successfully."
}

# Function to build Docker images
build_docker_images() {
  echo
  echo "====================================="
  echo "Building Docker images"
  echo "====================================="
  
  # Build Python MCP Docker
  echo "Building Python MCP Docker image..."
  cd "$MCP_ROOT/python-mcp"
  # docker build -t my-python-mcp .
  docker pull namin/my-python-mcp
  docker tag namin/my-python-mcp my-python-mcp
  echo "✅ Python MCP Docker image built successfully."
  
  # Build R MCP Docker
  echo "Building R MCP Docker image (this may take 30+ minutes)..."
  cd "$MCP_ROOT/r-mcp"
  #docker build --platform linux/amd64 -t my-r-mcp .
  docker pull namin/my-r-mcp
  docker tag namin/my-r-mcp my-r-mcp
  echo "✅ R MCP Docker image built successfully."
}

# Main execution
check_docker
build_mcp_servers
build_docker_images

echo
echo "====================================="
echo "All MCP servers and Docker images built successfully!"
echo "====================================="
echo "Docker images:"
docker images | grep -E 'my-python-mcp|my-r-mcp'
echo
echo "You can now run the MCP servers."
echo "=====================================" 