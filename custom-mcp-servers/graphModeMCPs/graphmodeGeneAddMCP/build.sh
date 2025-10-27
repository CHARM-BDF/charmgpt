#!/bin/bash
set -e

echo "Building graphModeGeneAddMCP..."
npm install
npm run build
echo "Build complete!"
