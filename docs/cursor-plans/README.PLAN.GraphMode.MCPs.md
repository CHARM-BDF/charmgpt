# Plan: Graph Mode MCP Implementation

## Overview

This document focuses on **Phase 4: MCP Integration** for Graph Mode 2. The core infrastructure (database, API routes, UI components) is complete. Now we need to create the specialized MCP that enables AI-driven graph manipulation.

## Current Status

### ✅ **Infrastructure Complete**
- **Database Schema**: GraphProject, GraphNode, GraphEdge, GraphState models
- **API Endpoints**: All CRUD operations at `/api/graph/:conversationId/*`
- **UI Components**: GraphModeViewer with Reagraph visualization
- **Conversation System**: Graph Mode conversations with visual indicators
- **Mock Data**: Test endpoint for development (`/mock-data`)

### ⏳ **MCP Implementation Needed**
- Graph MCP server with specialized tools
- Database integration via API calls
- Conversation-based context handling
- Artifact prevention in Graph Mode

---

## Architecture Decisions (from Main Plan)

### **1. MCP Data Flow** ✅ DECIDED
**Decision**: Database context only (no graph state passed to MCP)

**Rationale**:
- **Undo/Redo Support**: Full state history in database
- **Large Graph Support**: No size limitations
- **Version History**: Complete snapshots for rollback
- **Real-time Updates**: Always get latest data from database
- **Scalability**: Works with any graph size

**Implementation**:
```typescript
const mcpResult = await mcpService.callTool(serverName, toolName, {
  ...args,
  databaseContext: {
    conversationId: currentConversationId,
    apiBaseUrl: process.env.API_BASE_URL || 'http://localhost:5001',
    accessToken: "mcp-access-token"
  }
});
```

### **2. MCP Tool Design** ✅ DECIDED
**Decision**: Single comprehensive Graph MCP with multiple specialized tools

**Benefits**:
- Easier to maintain (one MCP server)
- Consistent database integration
- Shared utility functions
- Simpler configuration

**Tools Structure**:
```typescript
interface GraphMCP {
  // Node operations
  addNode: (label: string, type: string, data?: any) => Promise<GraphUpdate>;
  removeNode: (id: string) => Promise<GraphUpdate>;
  updateNode: (id: string, updates: Partial<GraphNode>) => Promise<GraphUpdate>;
  
  // Edge operations  
  addEdge: (source: string, target: string, label?: string) => Promise<GraphUpdate>;
  removeEdge: (id: string) => Promise<GraphUpdate>;
  updateEdge: (id: string, updates: Partial<GraphEdge>) => Promise<GraphUpdate>;
  
  // Batch operations (future)
  addMultipleNodes: (nodes: NodeInput[]) => Promise<GraphUpdate>;
  addMultipleEdges: (edges: EdgeInput[]) => Promise<GraphUpdate>;
}
```

### **3. Artifact Prevention Strategy** ✅ DECIDED
**Decision**: Frontend Suppression + MCP Filtering

**Frontend**: GraphModeStore overrides artifact creation
**Backend**: Filter available MCPs to only Graph MCP in Graph Mode

---

## Implementation Plan

### **Phase 4.1: Create Graph MCP Server**

#### **Directory Structure**
```
custom-mcp-servers/graphbuilder-mcp/
├── package.json
├── tsconfig.json
├── src/
│   └── index.ts          # Main MCP implementation
├── dist/                  # Compiled JavaScript
└── README.md             # MCP documentation
```

#### **Key Dependencies**
```json
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.6.1",
    "node-fetch": "^3.3.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "typescript": "^5.6.2"
  }
}
```

#### **MCP Configuration**
```json
// backend-mcp-client/config/mcp_server_config.json
{
  "mcpServers": {
    "graphbuilder-mcp": {
      "command": "node",
      "args": [
        "/Users/dr.crouse/Documents/GitHubProjects/charm-mcp/custom-mcp-servers/graphbuilder-mcp/dist/index.js"
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

---

## Tool Specifications

### **Tool 1: addNode**

**Purpose**: Add a new node to the graph

**Input Schema**:
```typescript
{
  label: string;           // Required: Node display name
  type: string;            // Required: Node type (gene, protein, disease, drug, pathway, other)
  data?: {                 // Optional: Additional node data
    category?: string;     // Category for coloring
    description?: string;  // Node description
    [key: string]: any;    // Flexible additional properties
  };
  position?: {            // Optional: Node position
    x: number;
    y: number;
  };
  canonicalId?: string;   // Optional: Custom ID (e.g., NCBIGene:7157)
}
```

**API Call**:
```typescript
POST /api/graph/:conversationId/nodes
Body: {
  label: string,
  type: string,
  data: object,
  position: { x: number, y: number },
  customId?: string
}
```

**Response**:
```typescript
{
  success: true,
  data: {
    id: "NCBIGene:7157",    // Node ID (custom or generated)
    label: "TP53",
    type: "gene",
    data: { category: "gene", description: "..." },
    position: { x: 0, y: 0 },
    createdAt: "2024-01-01T00:00:00Z"
  }
}
```

**MCP Tool Output**:
```typescript
{
  content: [
    {
      type: "text",
      text: "Added node 'TP53' (gene) to the graph."
    }
  ]
}
```

---

### **Tool 2: addEdge**

**Purpose**: Add a new edge connecting two nodes

**Input Schema**:
```typescript
{
  source: string;         // Required: Source node ID
  target: string;         // Required: Target node ID
  label?: string;         // Optional: Edge label (e.g., "inhibits", "encodes")
  type?: string;          // Optional: Edge type (e.g., "pharmacological", "biological")
  data?: {                // Optional: Additional edge data
    [key: string]: any;
  };
}
```

**API Call**:
```typescript
POST /api/graph/:conversationId/edges
Body: {
  source: string,
  target: string,
  label?: string,
  type?: string,
  data?: object
}
```

**Response**:
```typescript
{
  success: true,
  data: {
    id: "edge_abc123",
    source: "NCBIGene:7157",
    target: "MONDO:0005148",
    label: "associated_with",
    type: "biological",
    createdAt: "2024-01-01T00:00:00Z"
  }
}
```

**MCP Tool Output**:
```typescript
{
  content: [
    {
      type: "text",
      text: "Added edge from 'TP53' to 'Type 2 Diabetes' with label 'associated_with'."
    }
  ]
}
```

---

### **Tool 3: removeNode**

**Purpose**: Remove a node and its connected edges from the graph

**Input Schema**:
```typescript
{
  nodeId: string;         // Required: Node ID to remove
}
```

**API Call**:
```typescript
DELETE /api/graph/:conversationId/nodes/:nodeId
```

**Response**:
```typescript
{
  success: true,
  message: "Node deleted successfully"
}
```

**MCP Tool Output**:
```typescript
{
  content: [
    {
      type: "text",
      text: "Removed node 'TP53' and its connected edges from the graph."
    }
  ]
}
```

---

### **Tool 4: removeEdge**

**Purpose**: Remove an edge from the graph

**Input Schema**:
```typescript
{
  edgeId: string;         // Required: Edge ID to remove
}
```

**API Call**:
```typescript
DELETE /api/graph/:conversationId/edges/:edgeId
```

**Response**:
```typescript
{
  success: true,
  message: "Edge deleted successfully"
}
```

**MCP Tool Output**:
```typescript
{
  content: [
    {
      type: "text",
      text: "Removed edge connecting 'TP53' to 'Type 2 Diabetes'."
    }
  ]
}
```

---

### **Tool 5: getGraphState**

**Purpose**: Get current graph state (nodes and edges)

**Input Schema**:
```typescript
{
  // No input required - uses conversationId from context
}
```

**API Call**:
```typescript
GET /api/graph/:conversationId/state
```

**Response**:
```typescript
{
  success: true,
  data: {
    nodes: GraphNode[],
    edges: GraphEdge[],
    metadata: {
      nodeCount: number,
      edgeCount: number,
      lastUpdated: string
    }
  }
}
```

**MCP Tool Output**:
```typescript
{
  content: [
    {
      type: "text",
      text: "Current graph has 8 nodes and 10 edges.\n\nNodes:\n- TP53 (gene)\n- PPARG (gene)\n- ...\n\nEdges:\n- TP53 -> Type 2 Diabetes (associated_with)\n- ..."
    }
  ]
}
```

---

## MCP Implementation Template

### **Basic Structure**

```typescript
// custom-mcp-servers/graphbuilder-mcp/src/index.ts

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

// Database context interface
interface DatabaseContext {
  conversationId: string;
  apiBaseUrl: string;
  accessToken?: string;
}

// Helper function to make API calls
async function callGraphAPI(
  endpoint: string,
  method: string,
  context: DatabaseContext,
  body?: any
): Promise<any> {
  const url = `${context.apiBaseUrl}/api/graph/${context.conversationId}${endpoint}`;
  
  const response = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(context.accessToken && { 'Authorization': `Bearer ${context.accessToken}` })
    },
    ...(body && { body: JSON.stringify(body) })
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

// Create MCP server
const server = new Server(
  {
    name: 'graphbuilder-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'addNode',
        description: 'Add a new node to the knowledge graph',
        inputSchema: {
          type: 'object',
          properties: {
            label: {
              type: 'string',
              description: 'Node display name',
            },
            type: {
              type: 'string',
              description: 'Node type (gene, protein, disease, drug, pathway, other)',
            },
            data: {
              type: 'object',
              description: 'Additional node data (category, description, etc.)',
            },
            position: {
              type: 'object',
              properties: {
                x: { type: 'number' },
                y: { type: 'number' },
              },
              description: 'Node position coordinates',
            },
            canonicalId: {
              type: 'string',
              description: 'Custom node ID (e.g., NCBIGene:7157)',
            },
          },
          required: ['label', 'type'],
        },
      },
      {
        name: 'addEdge',
        description: 'Add a new edge connecting two nodes in the knowledge graph',
        inputSchema: {
          type: 'object',
          properties: {
            source: {
              type: 'string',
              description: 'Source node ID',
            },
            target: {
              type: 'string',
              description: 'Target node ID',
            },
            label: {
              type: 'string',
              description: 'Edge label (e.g., inhibits, encodes, associated_with)',
            },
            type: {
              type: 'string',
              description: 'Edge type (e.g., pharmacological, biological, clinical)',
            },
            data: {
              type: 'object',
              description: 'Additional edge data',
            },
          },
          required: ['source', 'target'],
        },
      },
      {
        name: 'removeNode',
        description: 'Remove a node and its connected edges from the knowledge graph',
        inputSchema: {
          type: 'object',
          properties: {
            nodeId: {
              type: 'string',
              description: 'ID of the node to remove',
            },
          },
          required: ['nodeId'],
        },
      },
      {
        name: 'removeEdge',
        description: 'Remove an edge from the knowledge graph',
        inputSchema: {
          type: 'object',
          properties: {
            edgeId: {
              type: 'string',
              description: 'ID of the edge to remove',
            },
          },
          required: ['edgeId'],
        },
      },
      {
        name: 'getGraphState',
        description: 'Get the current state of the knowledge graph',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  // Extract database context from arguments
  const context: DatabaseContext = {
    conversationId: args.databaseContext?.conversationId || '',
    apiBaseUrl: args.databaseContext?.apiBaseUrl || 'http://localhost:5001',
    accessToken: args.databaseContext?.accessToken,
  };

  if (!context.conversationId) {
    throw new Error('conversationId is required in databaseContext');
  }

  try {
    switch (name) {
      case 'addNode': {
        const { label, type, data, position, canonicalId } = args;
        
        const result = await callGraphAPI(
          '/nodes',
          'POST',
          context,
          {
            label,
            type,
            data: data || { category: type },
            position: position || { x: 0, y: 0 },
            customId: canonicalId,
          }
        );

        return {
          content: [
            {
              type: 'text',
              text: `Added node '${label}' (${type}) to the graph.`,
            },
          ],
        };
      }

      case 'addEdge': {
        const { source, target, label, type, data } = args;
        
        const result = await callGraphAPI(
          '/edges',
          'POST',
          context,
          {
            source,
            target,
            label,
            type,
            data: data || {},
          }
        );

        return {
          content: [
            {
              type: 'text',
              text: `Added edge from '${source}' to '${target}'${label ? ` with label '${label}'` : ''}.`,
            },
          ],
        };
      }

      case 'removeNode': {
        const { nodeId } = args;
        
        await callGraphAPI(
          `/nodes/${nodeId}`,
          'DELETE',
          context
        );

        return {
          content: [
            {
              type: 'text',
              text: `Removed node '${nodeId}' from the graph.`,
            },
          ],
        };
      }

      case 'removeEdge': {
        const { edgeId } = args;
        
        await callGraphAPI(
          `/edges/${edgeId}`,
          'DELETE',
          context
        );

        return {
          content: [
            {
              type: 'text',
              text: `Removed edge '${edgeId}' from the graph.`,
            },
          ],
        };
      }

      case 'getGraphState': {
        const result = await callGraphAPI(
          '/state',
          'GET',
          context
        );

        const { nodes, edges, metadata } = result.data;

        const nodesList = nodes.map((n: any) => `- ${n.label} (${n.type})`).join('\n');
        const edgesList = edges.map((e: any) => 
          `- ${e.source} -> ${e.target}${e.label ? ` (${e.label})` : ''}`
        ).join('\n');

        return {
          content: [
            {
              type: 'text',
              text: `Current graph has ${metadata.nodeCount} nodes and ${metadata.edgeCount} edges.\n\nNodes:\n${nodesList}\n\nEdges:\n${edgesList}`,
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        },
      ],
      isError: true,
    };
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Graph Builder MCP server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error in main():', error);
  process.exit(1);
});
```

---

## Phase 4.2: Backend MCP Context Integration

### **Update MCP Service to Pass Context**

**Location**: `backend-mcp-client/src/services/mcpService.ts`

**Required Changes**:
```typescript
// Add conversationId to MCP tool calls in Graph Mode
async callTool(
  serverName: string,
  toolName: string,
  args: Record<string, unknown>,
  conversationId?: string  // NEW: Pass conversationId
): Promise<any> {
  // ... existing code ...
  
  // Add database context for Graph Mode
  const toolArgs = {
    ...args,
    ...(conversationId && {
      databaseContext: {
        conversationId,
        apiBaseUrl: process.env.API_BASE_URL || 'http://localhost:5001',
        accessToken: 'mcp-access-token', // TODO: Real auth
      }
    })
  };
  
  // Call MCP with enhanced args
  return this.callToolWithContext(serverName, toolName, toolArgs);
}
```

### **Update Chat Route to Detect Graph Mode**

**Location**: `backend-mcp-client/src/routes/chat.ts`

**Required Changes**:
```typescript
// Detect Graph Mode conversations and pass conversationId
router.post('/stream', async (req: Request, res: Response) => {
  const { messages, conversationId } = req.body;
  
  // Check if this is a Graph Mode conversation
  // (This logic will depend on how you store conversation metadata)
  const isGraphMode = await checkIfGraphMode(conversationId);
  
  // When calling MCP tools, pass conversationId if in Graph Mode
  if (isGraphMode) {
    mcpResult = await mcpService.callTool(
      serverName,
      toolName,
      args,
      conversationId  // Pass conversationId for database context
    );
  } else {
    mcpResult = await mcpService.callTool(serverName, toolName, args);
  }
});
```

---

## Phase 4.3: Artifact Prevention

### **Frontend: Override Artifact Creation**

**Location**: `frontend-client/src/store/chatStore.ts`

**Strategy**: Detect Graph Mode and prevent new artifact creation

```typescript
// In addArtifact method
addArtifact: (artifact: Artifact) => {
  const currentConversation = get().conversations.find(
    c => c.id === get().currentConversationId
  );
  
  // If Graph Mode conversation, don't create new artifacts
  if (currentConversation?.mode === 'graph_mode') {
    console.log('Graph Mode: Suppressing new artifact creation');
    // Optionally: update existing graph artifact instead
    return;
  }
  
  // Normal artifact creation
  const newArtifact = { ...artifact, timestamp: new Date() };
  set((state) => ({
    artifacts: [...state.artifacts, newArtifact],
    selectedArtifactId: artifact.id,
    showArtifactWindow: true
  }));
},
```

### **Backend: Filter Available MCPs**

**Location**: `backend-mcp-client/src/services/mcpService.ts`

**Strategy**: Only expose Graph MCP in Graph Mode conversations

```typescript
// Add method to get filtered MCP list based on conversation mode
getAvailableMCPs(conversationMode?: 'normal' | 'graph_mode'): string[] {
  const allServers = this.getServerNames();
  
  if (conversationMode === 'graph_mode') {
    // Only allow Graph MCP in Graph Mode
    return allServers.filter(server => server === 'graphbuilder-mcp');
  }
  
  // In normal mode, exclude Graph MCP
  return allServers.filter(server => server !== 'graphbuilder-mcp');
}
```

---

## Testing Plan

### **Unit Tests**

1. **Test addNode Tool**
   - Valid node creation
   - Node with custom ID
   - Node with position
   - Invalid input handling

2. **Test addEdge Tool**
   - Valid edge creation
   - Edge between existing nodes
   - Edge with missing source/target (error)

3. **Test removeNode Tool**
   - Remove existing node
   - Remove non-existent node (error)

4. **Test removeEdge Tool**
   - Remove existing edge
   - Remove non-existent edge (error)

5. **Test getGraphState Tool**
   - Empty graph
   - Graph with nodes and edges
   - Large graph performance

### **Integration Tests**

1. **End-to-End Graph Building**
   - Create Graph Mode conversation
   - Add multiple nodes
   - Add edges between nodes
   - Verify UI updates
   - Remove nodes and edges
   - Verify state consistency

2. **Database Persistence**
   - Create graph data
   - Restart backend
   - Verify data persists

3. **Artifact Prevention**
   - Attempt to create non-graph artifacts in Graph Mode
   - Verify suppression works

### **Manual Testing Scenarios**

1. **Scenario: Build Gene-Disease Graph**
   ```
   User: "Add a gene node named TP53"
   AI: [calls addNode tool] "Added node 'TP53' (gene) to the graph."
   
   User: "Add a disease node for Type 2 Diabetes"
   AI: [calls addNode tool] "Added node 'Type 2 Diabetes' (disease) to the graph."
   
   User: "Connect TP53 to Type 2 Diabetes with an association"
   AI: [calls addEdge tool] "Added edge from 'TP53' to 'Type 2 Diabetes' with label 'associated_with'."
   
   User: "Show me the current graph"
   AI: [calls getGraphState tool] "Current graph has 2 nodes and 1 edge..."
   ```

2. **Scenario: Error Handling**
   ```
   User: "Remove the XYZ node"
   AI: [calls removeNode tool] "Error: Node 'XYZ' not found in the graph."
   ```

---

## Future Enhancements

### **Advanced Tools (Phase 5)**

1. **Batch Operations**
   - `addMultipleNodes`: Add many nodes at once
   - `addMultipleEdges`: Add many edges at once
   - `importFromJSON`: Import entire graph structure

2. **Analysis Tools**
   - `analyzeStructure`: Graph metrics (density, diameter, etc.)
   - `findCentrality`: Node centrality analysis
   - `detectCommunities`: Community detection algorithms

3. **Search Tools**
   - `findPath`: Find shortest path between nodes
   - `searchNodes`: Search nodes by properties
   - `filterByType`: Get all nodes of a specific type

4. **Layout Tools**
   - `applyForceLayout`: Apply force-directed layout
   - `applyHierarchicalLayout`: Hierarchical organization
   - `optimizePositions`: Minimize edge crossings

---

## Implementation Checklist

### **Phase 4.1: Create Graph MCP Server**
- [ ] Create `graphbuilder-mcp` directory structure
- [ ] Set up `package.json` with dependencies
- [ ] Implement MCP server with 5 core tools
- [ ] Add to MCP configuration file
- [ ] Test MCP independently (unit tests)

### **Phase 4.2: Backend Integration**
- [ ] Update `mcpService.ts` to pass database context
- [ ] Update chat route to detect Graph Mode
- [ ] Test MCP context passing
- [ ] Verify API calls from MCP to backend

### **Phase 4.3: Artifact Prevention**
- [ ] Implement frontend artifact suppression
- [ ] Implement backend MCP filtering
- [ ] Test artifact prevention
- [ ] Verify only Graph MCP available in Graph Mode

### **Phase 4.4: End-to-End Testing**
- [ ] Create Graph Mode conversation
- [ ] Use MCP to add nodes
- [ ] Use MCP to add edges
- [ ] Verify UI updates in real-time
- [ ] Test node/edge removal
- [ ] Test error scenarios
- [ ] Verify database persistence

### **Phase 4.5: Documentation**
- [ ] Document MCP tools in README
- [ ] Add usage examples
- [ ] Document error handling
- [ ] Create user guide for Graph Mode

---

## Success Criteria

✅ **Graph MCP is working when:**
1. AI can add nodes to graph via natural language
2. AI can add edges between nodes via natural language
3. AI can remove nodes and edges via natural language
4. AI can query current graph state via natural language
5. All changes persist to database
6. UI updates reflect database changes
7. No unintended artifacts are created in Graph Mode
8. Only Graph MCP is available in Graph Mode conversations

---

## Next Actions

1. **Create `graphbuilder-mcp` directory** and implement MCP server
2. **Test MCP locally** with mock database context
3. **Update backend** to pass conversation context to MCPs
4. **Test end-to-end flow** with real Graph Mode conversation
5. **Implement artifact prevention** in frontend and backend
6. **Document and polish** for production use

---

## Notes

- Use existing mock data endpoint (`/mock-data`) for initial testing
- Keep MCP simple initially - add advanced features later
- Focus on reliability over features
- Ensure good error messages for debugging
- Consider logging all MCP calls for troubleshooting

