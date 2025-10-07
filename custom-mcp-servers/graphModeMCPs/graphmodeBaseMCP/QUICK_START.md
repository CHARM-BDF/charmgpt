# Graph Mode MCP - Quick Start

## Installation

```bash
cd /Users/dr.crouse/Documents/GitHubProjects/charm-mcp/custom-mcp-servers/graphModeMCPs/graphmodeBaseMCP
npm install
npm run build
```

Or use the build script:
```bash
./build.sh
```

## Add to MCP Configuration

Edit `backend-mcp-client/config/mcp_server_config.json`:

```json
{
  "mcpServers": {
    "graph-mode-mcp": {
      "command": "node",
      "args": [
        "../custom-mcp-servers/graphModeMCPs/graphmodeBaseMCP/dist/index.js"
      ],
      "disabled": false,
      "env": {
        "API_BASE_URL": "http://localhost:5001",
        "NODE_ENV": "development"
      }
    }
  }
}
```

## Testing

1. **Start backend server**:
   ```bash
   cd backend-mcp-client
   npm run dev
   ```

2. **Create Graph Mode conversation** in the UI (click Graph Mode button)

3. **Add test data**:
   - Click "Add Test Data" button in GraphModeViewer, OR
   - Use curl:
     ```bash
     curl -X POST http://localhost:5001/api/graph/YOUR_CONVERSATION_ID/mock-data
     ```

4. **Test MCP tools** through chat:
   ```
   "Show me what's in the graph"           → getGraphState
   "Remove the TP53 node"                  → removeNode
   "Show me only the gene nodes"           → getGraphState with filter
   "Remove the edge between TP53 and diabetes" → removeEdge
   ```

## Available Tools

### getGraphState
Query the graph with optional filters.

**Examples:**
- "What's in the graph?"
- "Show me all disease nodes"
- "List all gene-disease relationships"

### removeNode
Delete a node and its connected edges.

**Examples:**
- "Remove the TP53 node"
- "Delete the Type 2 Diabetes disease"

### removeEdge
Delete a specific relationship.

**Examples:**
- "Remove the connection between TP53 and diabetes"
- "Delete the inhibits relationship"

## Troubleshooting

### MCP not appearing in tool list

1. Check configuration path in `mcp_server_config.json`
2. Verify build completed: `ls dist/index.js`
3. Check backend logs for MCP initialization errors

### API calls failing

1. Verify backend server is running on port 5001
2. Check `API_BASE_URL` environment variable
3. Verify conversation exists (create Graph Mode conversation first)

### Tool calls timing out

1. Database may be locked - restart backend
2. Check backend logs for Prisma errors
3. Verify database file exists: `backend-mcp-client/prisma/dev.db`

## Development

### Run in dev mode (auto-reload):
```bash
npm run dev
```

### View logs:
- MCP logs: Check terminal where backend is running
- Backend logs: `backend-mcp-client/server.log`

### Test API directly:
```bash
# Get graph state
curl http://localhost:5001/api/graph/YOUR_CONVERSATION_ID/state

# Delete node
curl -X DELETE http://localhost:5001/api/graph/YOUR_CONVERSATION_ID/nodes/NODE_ID

# Delete edge
curl -X DELETE http://localhost:5001/api/graph/YOUR_CONVERSATION_ID/edges/EDGE_ID
```

## Next Steps

After testing removal/filtering tools:

1. **Implement node/edge creation** (different strategy - not in this MCP)
2. **Add undo/redo functionality** to GraphModeViewer
3. **Implement batch operations** for efficiency
4. **Add search/analytics tools** for graph insights

