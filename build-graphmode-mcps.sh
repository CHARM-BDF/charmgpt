#!/bin/bash

# Build all GraphMode MCPs
# Usage: ./build-graphmode-mcps.sh

set -e  # Exit on any error

echo "====================================="
echo "Building GraphMode MCPs"
echo "====================================="

# Store the root directory
ROOT_DIR=$(pwd)

echo "Building from: $ROOT_DIR"
echo

# Function to build a single MCP
build_mcp() {
    local mcp_dir="$1"
    local mcp_name="$2"
    
    echo "Building $mcp_name..."
    echo "Directory: $mcp_dir"
    
    if [ ! -d "$mcp_dir" ]; then
        echo "❌ Directory $mcp_dir does not exist"
        return 1
    fi
    
    if [ ! -f "$mcp_dir/package.json" ]; then
        echo "❌ No package.json found in $mcp_dir"
        return 1
    fi
    
    cd "$mcp_dir"
    
    echo "Installing dependencies..."
    npm install
    
    echo "Building..."
    npm run build
    
    if [ -f "dist/index.js" ]; then
        echo "✅ $mcp_name built successfully"
    else
        echo "❌ Build failed - no dist/index.js found"
        return 1
    fi
    
    cd "$ROOT_DIR"
    echo
}

# Build all GraphMode MCPs
build_mcp "custom-mcp-servers/graphModeMCPs/graphmodeBaseMCP" "GraphMode Base MCP"
build_mcp "custom-mcp-servers/graphModeMCPs/graphmodeBTEMCP" "GraphMode BTE MCP"
build_mcp "custom-mcp-servers/graphModeMCPs/graphmodePubTatorMCP" "GraphMode PubTator MCP"
build_mcp "custom-mcp-servers/graphModeMCPs/graphmodeTranslator" "GraphMode Translator MCP"

echo "====================================="
echo "All GraphMode MCPs built successfully!"
echo "====================================="
echo "Built MCPs:"
echo "- graphmodeBaseMCP"
echo "- graphmodeBTEMCP"
echo "- graphmodePubTatorMCP"
echo "- graphmodeTranslator"
echo "====================================="
