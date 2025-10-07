# Graph Mode MCP Server

This is a Model Context Protocol (MCP) server for Graph Mode operations in the charm-mcp system. It provides tools for **removing nodes/edges** and **querying/filtering** the knowledge graph.

## Overview

This MCP is designed to work with Graph Mode conversations, which store graph data in a Prisma database. It does NOT handle node/edge creation (that's handled by a different strategy), but focuses on:

1. **Removal Operations**: Delete nodes and edges from the graph
2. **Query Operations**: Get current graph state with optional filtering

## Architecture

### Database Context Pattern

Unlike standalone MCPs, this server receives **database context** with each request:

```typescript
{
  conversationId: string;     // Which Graph Mode conversation
  apiBaseUrl: string;         // Backend API URL (e.g., http://localhost:5001)
  accessToken?: string;       // Optional auth token
}
```

The MCP makes HTTP calls to the backend API at:
- `GET /api/graph/:conversationId/state` - Get graph state
- `DELETE /api/graph/:conversationId/nodes/:nodeId` - Remove node
- `DELETE /api/graph/:conversationId/edges/:edgeId` - Remove edge

## Available Tools

### 1. removeNode

Remove a node from the knowledge graph (and all connected edges).

**Input:**
```json
{
  "nodeId": "NCBIGene:7157",
  "databaseContext": {
    "conversationId": "conv_abc123",
    "apiBaseUrl": "http://localhost:5001"
  }
}
```

**Output:**
```
Successfully removed node 'TP53' (ID: NCBIGene:7157) from the graph. 
All edges connected to this node were also removed.
```

**When to use:**
- User wants to delete a node that is no longer relevant
- Correcting mistakes (wrong node added)
- Cleaning up the graph

### 2. removeEdge

Remove an edge (relationship) from the knowledge graph.

**Input:**
```json
{
  "edgeId": "edge_abc123",
  "databaseContext": {
    "conversationId": "conv_abc123",
    "apiBaseUrl": "http://localhost:5001"
  }
}
```

**Output:**
```
Successfully removed edge 'TP53 → Type 2 Diabetes' (ID: edge_abc123) from the graph.
```

**When to use:**
- User wants to remove a specific relationship
- Correcting incorrect connections
- Refining the graph structure

### 3. getGraphState

Query the current state of the knowledge graph with optional filtering.

**Input (no filter):**
```json
{
  "databaseContext": {
    "conversationId": "conv_abc123",
    "apiBaseUrl": "http://localhost:5001"
  }
}
```

**Input (with filters):**
```json
{
  "databaseContext": {
    "conversationId": "conv_abc123"
  },
  "filter": {
    "nodeType": "gene",
    "edgeType": "associated_with",
    "nodeIds": ["NCBIGene:7157", "NCBIGene:5468"]
  }
}
```

**Output:**
```
# Current Graph State

**Total Nodes:** 8
**Total Edges:** 10
**Last Updated:** 2024-01-15T10:30:00Z

## Nodes

**gene** (4):
  - TP53 (ID: NCBIGene:7157)
  - PPARG (ID: NCBIGene:5468)
  - INS (ID: NCBIGene:3630)
  - LEP (ID: NCBIGene:3952)

**disease** (2):
  - Type 2 Diabetes (ID: MONDO:0005148)
  - Obesity (ID: MONDO:0005151)

## Edges

  - TP53 → Type 2 Diabetes (associated_with)
  - PPARG → Type 2 Diabetes (associated_with)
  - LEP → Obesity (associated_with)
  ...
```

**Also returns JSON artifact** with structured data for programmatic use.

**When to use:**
- User asks "What's in the graph?"
- User wants to see specific types of nodes
- User wants to filter by relationships
- Before making changes to understand current state

## Usage

### Building

```bash
npm install
npm run build
```

### Running

```bash
npm start
```

### Development Mode

```bash
npm run dev
```

## Configuration

Add to your `backend-mcp-client/config/mcp_server_config.json`:

```json
{
  "mcpServers": {
    "graph-mode-mcp": {
      "command": "node",
      "args": [
        "/Users/dr.crouse/Documents/GitHubProjects/charm-mcp/custom-mcp-servers/graphModeMCPs/dist/index.js"
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

## How It Works

### Data Flow

1. **User Message**: "Remove the TP53 node"
2. **AI Decision**: Calls `removeNode` tool with nodeId
3. **Backend Adds Context**: Injects `databaseContext` with conversationId
4. **MCP Receives Call**: Gets tool name, args, and database context
5. **MCP Makes API Call**: `DELETE /api/graph/conv_abc123/nodes/NCBIGene:7157`
6. **Backend Updates DB**: Prisma deletes node and related edges
7. **MCP Returns Response**: "Successfully removed node 'TP53'..."
8. **UI Auto-Refreshes**: GraphModeViewer polls and updates display

### Why This Design?

- ✅ **No state in MCP**: Always works with latest database data
- ✅ **Scalable**: No memory limits, works with any graph size
- ✅ **Multi-user safe**: All changes go through database
- ✅ **Audit trail**: Database maintains full history
- ✅ **Undo/redo support**: Database snapshots enable rollback

## Examples

### Example 1: Clean Up Graph

```
User: "Show me what's in the graph"
AI: [calls getGraphState] → Shows 8 nodes and 10 edges

User: "Remove the LEP gene"
AI: [calls removeNode with nodeId="NCBIGene:3952"] → Removes LEP node

User: "Show me the graph again"
AI: [calls getGraphState] → Shows 7 nodes and 8 edges (LEP and its edges removed)
```

### Example 2: Filter Query

```
User: "Show me only the disease nodes"
AI: [calls getGraphState with filter={nodeType: "disease"}] → Shows only diseases

User: "What are all the gene-disease associations?"
AI: [calls getGraphState with filter={edgeType: "associated_with"}] → Shows filtered edges
```

### Example 3: Remove Specific Edge

```
User: "Remove the connection between TP53 and diabetes"
AI: [calls getGraphState to find the edge ID]
AI: [calls removeEdge with edgeId="edge_xyz"] → Removes that specific edge
```

## Error Handling

The MCP handles common errors:

- **Node/Edge not found**: Returns clear message
- **Network errors**: Logs and returns error to user
- **Invalid input**: Zod validation with helpful messages
- **Auth errors**: Passes through from backend API

## Testing

Test with the mock data endpoint:

```bash
# Add mock data to graph
curl -X POST http://localhost:5001/api/graph/conv_abc123/mock-data

# Then use MCP tools to query and manipulate
```

## Future Enhancements

Potential additions (not implemented yet):

- **Batch removal**: Remove multiple nodes/edges at once
- **Search**: Find nodes by properties
- **Analytics**: Graph metrics and statistics
- **Undo/redo**: Direct state restoration
- **Export**: Generate graph visualizations

## Related Components

- **GraphModeViewer** (`frontend-client/src/components/artifacts/GraphModeViewer.tsx`): UI component
- **Graph API Routes** (`backend-mcp-client/src/routes/graph.ts`): Database operations
- **Graph Database Service** (`backend-mcp-client/src/services/database.ts`): Prisma integration
- **Prisma Schema** (`backend-mcp-client/prisma/schema.prisma`): Database models

