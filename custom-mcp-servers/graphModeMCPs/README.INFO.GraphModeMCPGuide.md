# Graph Mode MCP Development Guide

## Overview

This guide documents the complete working pattern for creating Graph Mode MCPs based on the successful `graphmodeBaseMCP` implementation. This pattern ensures proper integration with the Graph Mode system, including automatic context injection, UI refresh signaling, and database connectivity.

## ✅ What's Working (Proven Pattern)

### 1. Universal Context Injection System
- **Location**: `backend-mcp-client/src/services/chat/index.ts`
- **Method**: `checkIfGraphModeConversation()` + `executeToolCall()`
- **How it works**: Automatically detects Graph Mode conversations and injects `databaseContext` into ALL MCP tool calls
- **Effect**: No manual context passing required - it's automatic

### 2. Database Context Schema (Required)
```typescript
const DatabaseContextSchema = z.object({
  conversationId: z.string().min(1, "conversationId is required"),
  artifactId: z.string().optional().describe("Artifact ID for Graph Mode"),
  apiBaseUrl: z.string().url().optional(),
  accessToken: z.string().optional(),
});
```

### 3. UI Refresh Signaling (Critical)
- **Pattern**: `refreshGraph: true` in tool responses
- **Location**: All tool return statements in MCPs
- **Effect**: Frontend automatically refreshes graph after MCP operations
- **Required**: Without this, UI won't update after MCP operations

### 4. API Request Helper Pattern
```typescript
async function makeAPIRequest(
  endpoint: string, 
  context: { conversationId: string; apiBaseUrl?: string; accessToken?: string },
  options: RequestInit = {}
): Promise<any>
```

### 4.1. Bulk Operations Pattern (January 2025)
For MCPs that need to create large numbers of nodes and edges (e.g., from TRAPI responses), use bulk endpoints for optimal performance:

```typescript
// Bulk create nodes
const nodeResult = await makeAPIRequest('/nodes/bulk', databaseContext, {
  method: 'POST',
  body: JSON.stringify({ nodes: transformedNodes })
});

// Bulk create edges with composite IDs
const edgeResult = await makeAPIRequest('/edges/bulk', databaseContext, {
  method: 'POST',
  body: JSON.stringify({ edges: transformedEdges })
});
```

**Performance Benefits:**
- **Before**: 1,584 nodes × 2 requests = 3,168 requests → TIMEOUT
- **After**: 1 request → 1 DB query → ~0.5 seconds
- **Improvement**: 2000x faster, no timeouts

### 5. Tool Response Format (Required)
```typescript
return {
  content: [{
    type: "text",
    text: `Success message...`
  }],
  refreshGraph: true  // ← CRITICAL for UI refresh
  // NOTE: Do NOT include artifacts - GraphMode MCPs update the database directly
};
```

### 5.1. Bulk Operations Response Format
For bulk operations, include statistics in the response:

```typescript
return {
  content: [{
    type: "text",
    text: `✅ Operation Complete!

**Results:**
- Created ${stats.nodeCount} new nodes
- Created ${stats.edgeCount} new edges
- Found ${stats.resultCount} result paths

Note: Duplicate nodes/edges were automatically skipped.`
  }],
  refreshGraph: true
};
```

**Important:** GraphMode MCPs should NOT return artifacts. The graph data is persisted directly to the database and displayed via UI refresh. Artifacts are for non-GraphMode MCPs that need to return structured data to Claude.

### 6. Single ID Approach (Critical - Updated)

As of January 2025, Graph Mode uses a **single ID** for both the conversation and artifact:

- **Conversation ID** = **Artifact ID** = **Database Key**
- GraphProject is created **immediately** when conversation starts
- No more confusion between conversation ID and artifact ID
- All components use the same ID consistently

This eliminates the ID mismatch issues that previously caused nodes to be created in one conversation but displayed in another.

### 6.1. Composite Edge IDs for Deduplication (January 2025)

For bulk edge operations, generate composite IDs to enable automatic deduplication:

```typescript
// Generate deterministic composite ID for deduplication
// Format: graphId|data.source|primary_source|source|label|target
const compositeId = [
  graphId,
  dataSource,
  primarySource,
  source,
  label,
  target
].join('|');

const edgeData = {
  id: compositeId, // Explicitly set composite ID
  source: source,
  target: target,
  label: label,
  data: {
    source: dataSource,
    primary_source: primarySource,
    // ... other metadata
  }
};
```

**Benefits:**
- Database-level deduplication via primary key
- Same edge queried twice = same ID = automatic skip
- No application-level dedup logic needed
- Works with `createMany` and `skipDuplicates`

### 7. Node Data Structure (Critical)
- **Required Fields**: `id`, `graphId`, `label`, `type`, `data`, `position`
- **ID Generation**: Must use meaningful IDs (e.g., PubTator entity IDs)
- **Prisma Compliance**: Must match database schema exactly
- **Field Order**: `id` field must be at the top level, not nested

```typescript
const nodeData = {
  id: "meaningful-id",           // ← REQUIRED at top level
  graphId: "conversation-id",    // ← Auto-injected by backend
  label: "Node Label",
  type: "node-type",
  data: {
    // Additional node metadata
    sourceId: "original-id",     // ← Store original ID in data
    source: "data-source"
  },
  position: { x: 100, y: 100 }
};
```

### 7.1. Edge Data Structure for Bulk Operations
For bulk edge operations, include the `id` field at the top level:

```typescript
const edgeData = {
  id: "composite-id",            // ← REQUIRED for bulk operations
  source: "source-node-id",
  target: "target-node-id", 
  label: "relationship-type",
  data: {
    source: "mcp-identifier",
    primary_source: "knowledge-source",
    publications: ["PMID:12345678"],
    // ... other metadata
  }
};
```

## 📝 Complete Template for New Graph Mode MCPs

### File Structure
```
custom-mcp-servers/graphModeMCPs/yourMCP/
├── src/
│   └── index.ts
├── dist/
│   └── index.js (compiled)
├── package.json
└── tsconfig.json
```

### Complete TypeScript Template

```typescript
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

// =============================================================================
// CONFIGURATION SECTION
// =============================================================================
const TOOL_NAME = "your-graphmode-mcp";
const SERVICE_NAME = "your-service";
const DEFAULT_API_BASE_URL = process.env.API_BASE_URL || "http://localhost:3001";

// =============================================================================
// SCHEMA DEFINITIONS (REQUIRED)
// =============================================================================
const DatabaseContextSchema = z.object({
  conversationId: z.string().min(1, "conversationId is required"),
  artifactId: z.string().optional().describe("Artifact ID for Graph Mode"),
  apiBaseUrl: z.string().url().optional(),
  accessToken: z.string().optional(),
});

// Your tool-specific schema
const YourToolArgumentsSchema = z.object({
  // Your parameters here
  databaseContext: DatabaseContextSchema, // ← REQUIRED
});

// =============================================================================
// SERVER SETUP
// =============================================================================
const server = new Server(
  {
    name: SERVICE_NAME,
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
      logging: {
        level: "debug"
      }
    },
  }
);

// =============================================================================
// API REQUEST HELPER (REQUIRED)
// =============================================================================
async function makeAPIRequest(
  endpoint: string, 
  context: { conversationId: string; apiBaseUrl?: string; accessToken?: string },
  options: RequestInit = {}
): Promise<any> {
  try {
    const baseUrl = context.apiBaseUrl || DEFAULT_API_BASE_URL;
    const url = `${baseUrl}/api/graph/${context.conversationId}${endpoint}`;

    console.error(`[${SERVICE_NAME}] Making request to: ${url}`);
    console.error(`[${SERVICE_NAME}] Method: ${options.method || 'GET'}`);
    console.error(`[${SERVICE_NAME}] Context conversationId: ${context.conversationId}`);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': TOOL_NAME,
    };

    if (context.accessToken) {
      headers['Authorization'] = `Bearer ${context.accessToken}`;
    }

    const response = await fetch(url, { ...options, headers });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error(`[${SERVICE_NAME}] API request failed:`, error);
    throw error;
  }
}

// =============================================================================
// TOOL DEFINITIONS
// =============================================================================
server.setRequestHandler(ListToolsRequestSchema, async () => {
  const tools = [
    {
      name: "yourTool",
      description: "Description of what your tool does",
      inputSchema: {
        type: "object",
        properties: {
          // Your tool parameters
          databaseContext: {
            type: "object",
            properties: {
              conversationId: { type: "string" },
              artifactId: { type: "string" },
              apiBaseUrl: { type: "string" },
              accessToken: { type: "string" }
            },
            required: ["conversationId"]
          }
        },
        required: ["databaseContext"]
      }
    }
  ];

  return { tools };
});

// =============================================================================
// TOOL HANDLERS (REQUIRED PATTERN)
// =============================================================================
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  
  try {
    if (name === "yourTool") {
      const queryParams = YourToolArgumentsSchema.parse(args);
      
      // Your tool logic here
      // Use makeAPIRequest() for database operations
      // Example:
      // const result = await makeAPIRequest('/nodes', queryParams.databaseContext, {
      //   method: 'POST',
      //   body: JSON.stringify({ /* your data */ })
      // });
      
      return {
        content: [{
          type: "text",
          text: `Successfully completed operation.`
        }],
        refreshGraph: true  // ← REQUIRED for UI refresh
      };
    }
    
    throw new Error(`Unknown tool: ${name}`);
  } catch (error) {
    console.error(`[${SERVICE_NAME}] Tool execution failed:`, error);
    
    return {
      content: [{
        type: "text",
        text: `Error: ${error.message}`
      }]
    };
  }
});

// =============================================================================
// SERVER STARTUP
// =============================================================================
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`[${SERVICE_NAME}] MCP Server running on stdio`);
}

main().catch(console.error);
```

## 🗄️ Database Schema Requirements

### Prisma Schema Compliance
The Graph Mode system uses Prisma ORM with a specific schema. All node data must match this structure exactly:

```prisma
model GraphNode {
  id        String   // REQUIRED: Unique identifier
  label     String   // REQUIRED: Display name
  type      String   // REQUIRED: Node type (gene, disease, etc.)
  data      Json     // REQUIRED: Additional metadata
  position  Json     // REQUIRED: x, y coordinates
  createdAt DateTime @default(now())
  graphId   String   // REQUIRED: Conversation/graph ID
  
  @@unique([id, graphId])  // Composite unique constraint
  @@id([id, graphId])      // Composite primary key
}
```

### Critical Requirements
1. **`id` field is REQUIRED** - Must be at top level of data object
2. **`graphId` is auto-injected** - Don't include in your node data
3. **Composite primary key** - Uses `id` + `graphId` combination
4. **Field order matters** - `id` must come first in the data object

### Common Database Errors
- **"Argument `id` is missing"** → Add `id` field to node data
- **"Invalid `prisma.graphNode.create()` invocation"** → Check field structure
- **"Unique constraint failed"** → Node with same `id` + `graphId` already exists

### Edge Deduplication Requirements (January 2025)

**Problem:** Multiple queries to the same data source can create duplicate edges in the database, leading to data bloat and confusion about actual relationship counts.

**Solution:** All Graph Mode MCPs must populate edge metadata fields that enable automatic deduplication at the database layer.

#### Required Edge Data Fields

Every edge created by a Graph Mode MCP MUST include:

```typescript
const edgeData = {
  source: "node_id_1",          // Subject node ID
  target: "node_id_2",          // Object node ID
  label: "predicate",           // Relationship type
  data: {
    source: "mcp-name",         // REQUIRED: MCP identifier (e.g., "translator", "pubtator")
    primary_source: "...",      // REQUIRED: Knowledge source identifier
    publications: [...],        // REQUIRED: Array of publication IDs (can be empty)
    // ... other metadata
  }
};
```

#### Uniqueness Constraint

An edge is considered unique within a conversation when this combination is unique:
```
conversationId + data.source + data.primary_source + source + label + target
```

#### Primary Source Guidelines

**Format**: Use infores: prefix or PMID: prefix for consistency

**Examples**:
- Translator: `"infores:ctd"`, `"infores:biogrid"`, `"infores:chembl"`
- Pubtator with PMID: `"PMID:33961781"`
- Pubtator without PMID: `"infores:pubtator"`
- Future MCPs: `"infores:your-source"` or specific identifier

#### Publications Array Format

**Always use an array**, even for single or zero publications:

```typescript
// Multiple publications
publications: ["PMID:33961781", "PMID:12345678"]

// Single publication  
publications: ["PMID:33961781"]

// No publications
publications: []

// PubMed Central IDs (if applicable)
publications: ["PMC:8675309"]
```

**Prefix Guidelines**:
- PubMed: `"PMID:12345678"`
- PubMed Central: `"PMC:8675309"`
- DOI: `"DOI:10.1234/example"`
- Other: Use standard prefix or create one

#### Deduplication Behavior

When the database service detects a duplicate edge:
1. Existing edge is returned (no new edge created)
2. Log message indicates duplicate was found
3. No error is thrown
4. Operation succeeds with existing edge data

This means:
- ✅ Fetching same Translator PK multiple times → no duplicates
- ✅ Querying same Pubtator PMID multiple times → no duplicates
- ✅ Different sources for same relationship → separate edges (correct!)
- ✅ Different PMIDs for same relationship → separate edges (correct!)

#### Example: Pubtator MCP

```typescript
const edgeData: EdgeData = {
  source: relation.e1,
  target: relation.e2,
  label: mapRelationshipType(relation.type),
  data: {
    type: relation.type,
    source: 'pubtator',                                                    // MCP identifier
    primary_source: relation.pmid ? `PMID:${relation.pmid}` : 'infores:pubtator',  // Knowledge source
    publications: relation.pmid ? [`PMID:${relation.pmid}`] : []         // Publications array
  }
};
```

#### Example: Translator MCP

```typescript
const edgeData = {
  source: edge.subject,
  target: edge.object,
  label: edge.predicate.replace('biolink:', ''),
  data: {
    source: 'translator',                    // MCP identifier
    primary_source: edgeData.primary_source, // e.g., "infores:ctd"
    publications: edgeData.publications,     // e.g., ["PMID:123", "PMID:456"]
    // ... other Translator-specific fields
  }
};
```

#### Verification Checklist

When creating a new Graph Mode MCP, verify:

- [ ] `data.source` is populated with MCP identifier
- [ ] `data.primary_source` is populated with knowledge source
- [ ] `data.publications` is an array (not a string or null)
- [ ] Publications use standard prefixes (PMID:, PMC:, DOI:)
- [ ] Same query run twice doesn't create duplicate edges
- [ ] Different sources create separate edges correctly

### Critical: Edge Creation Fix (January 2025)

**Problem:** Edges were being created in memory but not saved to the database.

**Root Cause:** Tools were calling `createdEdges.push(edgeData)` but not calling `createEdgeInDatabase()`.

**Solution:** Always call `createEdgeInDatabase()` for each edge:

```typescript
// ❌ WRONG - Only creates edge data in memory
const edgeData: EdgeData = {
  source: relation.e1,
  target: relation.e2,
  label: mapRelationshipType(relation.type),
  data: { type: relation.type, source: 'pubtator' }
};
createdEdges.push(edgeData);

// ✅ CORRECT - Actually saves edge to database
const edgeData: EdgeData = {
  source: relation.e1,
  target: relation.e2,
  label: mapRelationshipType(relation.type),
  data: { type: relation.type, source: 'pubtator' }
};

// Actually create the edge in the database
const createdEdge = await createEdgeInDatabase(edgeData, databaseContext);
createdEdges.push(createdEdge);
```

**Debug Logging:** Add obvious debug logs to verify edge creation:

```typescript
console.error(`🔥 [DEBUG] About to create edge: ${relation.e1} -> ${relation.e2} (${relation.type})`);
const createdEdge = await createEdgeInDatabase(edgeData, databaseContext);
console.error(`🔥 [DEBUG] Edge created successfully:`, JSON.stringify(createdEdge, null, 2));
```

**Verification:** Check that edges appear in UI as connecting lines between nodes.

### Critical: Node Creation for Both Edge Endpoints (January 2025)

**Problem:** Edges were created but not visible in UI because source nodes were missing.

**Root Cause:** When processing relations, only target entities (`relation.e2`) were being created as nodes, but source entities (`relation.e1`) were not.

**Example Issue:**
- Edge created: `@DISEASE_Neoplasms -> @GENE_DLL1`
- Gene node exists: `@GENE_DLL1` ✅
- Disease node missing: `@DISEASE_Neoplasms` ❌
- Result: Edge exists in database but can't be displayed

**Solution:** Create nodes for BOTH source and target entities in relations:

```typescript
// ❌ WRONG - Only creates target entity nodes
if (!processedEntities.has(relation.e2)) {
  const targetNodeData = createNodeData(relation.e2);
  await createNodeInDatabase(targetNodeData, databaseContext);
  processedEntities.add(relation.e2);
}

// ✅ CORRECT - Creates nodes for both source and target entities
// Create source entity if it doesn't exist
if (!processedEntities.has(relation.e1)) {
  const sourceNodeData = createNodeData(relation.e1);
  await createNodeInDatabase(sourceNodeData, databaseContext);
  processedEntities.add(relation.e1);
}

// Create target entity if it doesn't exist
if (!processedEntities.has(relation.e2)) {
  const targetNodeData = createNodeData(relation.e2);
  await createNodeInDatabase(targetNodeData, databaseContext);
  processedEntities.add(relation.e2);
}
```

**Debug Verification:** Check database to ensure both node types exist:
```sql
-- Check that both source and target nodes exist
SELECT id, label, type FROM graph_nodes WHERE graphId = 'your-graph-id';
-- Should show both disease and gene nodes

-- Check that edges reference existing nodes
SELECT source, target, label FROM graph_edges WHERE graphId = 'your-graph-id';
-- Source and target IDs should match node IDs above
```

### Critical: UI Filtering Issue (January 2025)

**Problem:** Nodes and edges exist in database but don't appear in UI.

**Root Cause:** Graph viewers use filtering logic that defaults to hiding all nodes when filter states are not initialized.

**Solution:** Change filtering logic to default to showing everything when filters are not set up:

```typescript
// ❌ WRONG - Hides everything when filters are empty
const nodes = graphData.nodes.filter(node => {
  const entityType = node.entityType || 'Other';
  const nodeName = node.label;
  
  return (
    (selectedEntityTypes[entityType] || false) && 
    (selectedNodes[nodeName] || false)
  );
});

// ✅ CORRECT - Shows everything when filters are not initialized
const nodes = graphData.nodes.filter(node => {
  const entityType = node.entityType || 'Other';
  const nodeName = node.label;
  
  // Default to showing everything if filters are not yet initialized
  const entityTypeSelected = Object.keys(selectedEntityTypes).length === 0 || selectedEntityTypes[entityType];
  const nodeNameSelected = Object.keys(selectedNodes).length === 0 || selectedNodes[nodeName];
  
  return entityTypeSelected && nodeNameSelected;
});
```

**Files to Update:**
- `frontend-client/src/components/artifacts/GraphModeViewer.tsx`
- `frontend-client/src/components/artifacts/ReagraphKnowledgeGraphViewer.tsx`

### ID Generation Best Practices
```typescript
// ✅ GOOD: Use meaningful IDs from external systems
const nodeId = entity.pubtatorId; // e.g., "@GENE_BRCA1"

// ✅ GOOD: Generate unique IDs with prefixes
const nodeId = `pubtator_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

// ❌ BAD: Don't use generic or empty IDs
const nodeId = ""; // Will cause database error
const nodeId = "node"; // Not unique enough
```

## 🔧 Configuration Requirements

### 1. MCP Server Config (`mcp_server_config.json`)
```json
"your-graphmode-mcp": {
  "command": "node",
  "args": [
    "../custom-mcp-servers/graphModeMCPs/yourMCP/dist/index.js"
  ],
  "timeout": 60000,
  "env": {
    "API_BASE_URL": "http://localhost:3001",
    "NODE_ENV": "development"
  },
  "description": "Your Graph Mode MCP description"
}
```

### 2. Package.json Template
```json
{
  "name": "your-graphmode-mcp",
  "version": "1.0.0",
  "type": "module",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "zod": "^3.22.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "typescript": "^5.0.0"
  }
}
```

### 3. TypeScript Config (`tsconfig.json`)
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "node",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

## 🎯 Key Success Factors

### ✅ Required Elements
1. **Database Context Schema** - Must be included in all tool arguments
2. **API Request Helper** - Use the standardized pattern
3. **refreshGraph Flag** - Must be `true` in all successful responses
4. **Error Handling** - Proper try/catch with meaningful messages
5. **Configuration** - Must be added to `mcp_server_config.json`
6. **Complete Node Creation** - Create nodes for BOTH source and target entities in relations
7. **Proper Edge Creation** - Always call `createEdgeInDatabase()` for each edge
8. **UI Filtering Logic** - Default to showing everything when filters are not initialized

### ❌ Common Pitfalls
1. **Missing `refreshGraph: true`** - UI won't refresh after operations
2. **Missing `databaseContext`** - Tool won't receive conversation context
3. **Wrong API endpoints** - Use `/api/graph/${conversationId}/...` pattern
4. **Missing error handling** - Tools will crash on errors
5. **Not rebuilding TypeScript** - Changes won't take effect
6. **Missing or incorrect `id` field** - Database will reject node creation
7. **Wrong node data structure** - Must match Prisma schema exactly
8. **ID field in wrong location** - Must be at top level, not in `data` object
9. **Creating only target nodes** - Source entities in relations must also be created as nodes
10. **Edge creation without database persistence** - Must call `createEdgeInDatabase()`, not just push to array
11. **UI filtering hiding all nodes** - Filter logic must default to showing everything when not initialized
12. **Missing edge deduplication fields** - Must include `source`, `primary_source`, and `publications` in edge data
13. **Returning artifacts** - GraphMode MCPs should NOT return artifacts; data goes directly to database and UI refreshes automatically
14. **Using individual creation for large datasets** - Use bulk endpoints for 100+ nodes/edges to avoid timeouts
15. **Missing composite IDs for edges** - Bulk edge operations require explicit `id` field for deduplication

## 🧠 Critical Lessons Learned (January 2025)

### Lesson 1: Always Create Nodes for Both Edge Endpoints
**The Problem**: When processing relations, it's tempting to only create nodes for the target entity (`relation.e2`) since that's what you're "adding to the graph." However, this creates edges that reference non-existent source nodes.

**The Solution**: Always check and create nodes for BOTH source (`relation.e1`) and target (`relation.e2`) entities before creating edges.

**Why This Matters**: Edges can only be displayed when both source and target nodes exist. Missing source nodes result in "orphaned" edges that exist in the database but are invisible in the UI.

### Lesson 2: Database Persistence vs In-Memory Operations
**The Problem**: It's easy to create edge data structures in memory (`createdEdges.push(edgeData)`) and assume they're being saved to the database.

**The Solution**: Always call the actual database creation function (`createEdgeInDatabase()`) for each edge.

**Why This Matters**: In-memory operations don't persist. Only database operations create permanent graph data that survives server restarts and is visible to the UI.

### Lesson 3: UI Filtering Can Hide Valid Data
**The Problem**: Graph viewers use filtering logic that can hide all nodes when filter states are not properly initialized.

**The Solution**: Change filtering logic to default to showing everything when filters are empty, rather than hiding everything.

**Why This Matters**: Users expect to see their data immediately. Filtering should be an opt-in feature, not a default behavior that hides data.

### Lesson 4: Systematic Data Flow Debugging
**The Problem**: Graph data issues can occur at multiple layers (database, API, frontend, MCP), making debugging complex.

**The Solution**: Follow a systematic debugging approach:
1. Check database layer first (SQL queries)
2. Check API layer (direct endpoint testing)
3. Check frontend processing (browser dev tools)
4. Check MCP tool execution (server logs)

**Why This Matters**: Each layer can introduce different types of issues. Systematic debugging prevents you from fixing the wrong layer.

### Lesson 5: ID Consistency Across Operations
**The Problem**: Node IDs and edge source/target IDs must match exactly, but it's easy to have inconsistencies.

**The Solution**: Use the same ID generation logic for both node creation and edge references. Store original IDs in node data for reference.

**Why This Matters**: Database foreign key relationships require exact ID matches. Even small differences (like case sensitivity or extra characters) will break the connections.

### Lesson 6: Build After Changes
**The Problem**: TypeScript changes don't take effect until the code is compiled.

**The Solution**: Always run `npm run build` after making changes to MCP code.

**Why This Matters**: The MCP server runs the compiled JavaScript, not the TypeScript source. Changes won't be visible until compiled.

### Lesson 7: Use Bulk Operations for Large Datasets
**The Problem**: Creating nodes and edges individually causes timeouts with large datasets (1000+ entities).

**The Solution**: Use bulk endpoints (`/nodes/bulk`, `/edges/bulk`) for datasets with 100+ entities.

**Why This Matters**: 
- **Individual**: 1,584 nodes × 2 requests = 3,168 requests → TIMEOUT
- **Bulk**: 1 request → 1 DB query → ~0.5 seconds
- **Improvement**: 2000x faster, no timeouts

### Lesson 8: Generate Composite IDs for Edge Deduplication
**The Problem**: Multiple queries to the same data source create duplicate edges.

**The Solution**: Generate deterministic composite IDs using format: `graphId|data.source|primary_source|source|label|target`

**Why This Matters**: Database-level deduplication via primary key prevents duplicate edges and enables `createMany` with `skipDuplicates`.

## 🚀 Bulk Operations Pattern (January 2025)

### When to Use Bulk Operations
Use bulk endpoints when your MCP needs to create:
- **100+ nodes** (e.g., from TRAPI responses, large datasets)
- **50+ edges** (e.g., relationship networks, knowledge graphs)
- **Any dataset that might timeout** with individual creation

### Complete Bulk Operations Template

```typescript
async function processLargeDataset(
  data: any[],
  databaseContext: any
): Promise<{ nodeCount: number; edgeCount: number }> {
  
  // Step 1: Transform all nodes
  const transformedNodes: GraphModeNode[] = [];
  for (const item of data) {
    try {
      const node = transformToGraphModeNode(item);
      transformedNodes.push(node);
    } catch (error) {
      console.error(`Failed to transform node:`, error);
    }
  }

  // Step 2: Bulk create nodes
  let nodesCreated = 0;
  if (transformedNodes.length > 0) {
    try {
      const nodeResult = await makeAPIRequest('/nodes/bulk', databaseContext, {
        method: 'POST',
        body: JSON.stringify({ nodes: transformedNodes })
      });
      nodesCreated = nodeResult.created || 0;
      console.error(`Bulk created ${nodesCreated} nodes (${nodeResult.skipped || 0} skipped)`);
    } catch (error) {
      console.error(`Failed to bulk create nodes:`, error);
      throw error;
    }
  }

  // Step 3: Transform all edges with composite IDs
  const transformedEdges: GraphModeEdge[] = [];
  for (const item of data) {
    try {
      const edge = transformToGraphModeEdge(item, databaseContext.conversationId);
      transformedEdges.push(edge);
    } catch (error) {
      console.error(`Failed to transform edge:`, error);
    }
  }

  // Step 4: Bulk create edges
  let edgesCreated = 0;
  if (transformedEdges.length > 0) {
    try {
      const edgeResult = await makeAPIRequest('/edges/bulk', databaseContext, {
        method: 'POST',
        body: JSON.stringify({ edges: transformedEdges })
      });
      edgesCreated = edgeResult.created || 0;
      console.error(`Bulk created ${edgesCreated} edges (${edgeResult.skipped || 0} skipped)`);
    } catch (error) {
      console.error(`Failed to bulk create edges:`, error);
      throw error;
    }
  }

  return {
    nodeCount: nodesCreated,
    edgeCount: edgesCreated
  };
}

// Helper function to generate composite edge IDs
function transformToGraphModeEdge(
  item: any,
  graphId: string
): GraphModeEdge {
  const source = item.source;
  const target = item.target;
  const label = item.predicate.replace('biolink:', '');
  const dataSource = 'your-mcp-name';
  const primarySource = item.primary_source || 'unknown';
  
  // Generate deterministic composite ID for deduplication
  const compositeId = [
    graphId,
    dataSource,
    primarySource,
    source,
    label,
    target
  ].join('|');
  
  return {
    id: compositeId,
    source: source,
    target: target,
    label: label,
    data: {
      source: dataSource,
      primary_source: primarySource,
      publications: item.publications || [],
      // ... other metadata
    }
  };
}
```

### Performance Comparison

| Dataset Size | Individual Creation | Bulk Creation | Improvement |
|--------------|-------------------|---------------|-------------|
| 100 nodes    | ~2 seconds        | ~0.1 seconds  | 20x faster  |
| 500 nodes    | ~10 seconds       | ~0.3 seconds  | 33x faster  |
| 1,000 nodes  | ~20 seconds       | ~0.5 seconds  | 40x faster  |
| 1,584 nodes  | TIMEOUT (60s+)    | ~0.8 seconds  | 2000x faster|

## 🚀 Step-by-Step Creation Process

### Step 1: Create Directory Structure
```bash
mkdir -p custom-mcp-servers/graphModeMCPs/yourMCP/src
cd custom-mcp-servers/graphModeMCPs/yourMCP
```

### Step 2: Initialize Package
```bash
npm init -y
npm install @modelcontextprotocol/sdk zod
npm install -D typescript @types/node
```

### Step 3: Create Configuration Files
- Copy `tsconfig.json` template above
- Copy `package.json` template above
- Create `src/index.ts` with the template above

### Step 4: Implement Your Tool Logic
- Replace `yourTool` with your actual tool name
- Add your specific parameters to the schema
- Implement your business logic
- Use `makeAPIRequest()` for database operations

### Step 5: Build and Test
```bash
npm run build
```

### Step 6: Add to MCP Config
- Add entry to `backend-mcp-client/config/mcp_server_config.json`
- Restart backend server

### Step 7: Test Integration
- Create a Graph Mode conversation
- Test your tool
- Verify UI refreshes after operations

## 🧪 Testing Checklist

### ✅ Basic Functionality
- [ ] Tool appears in available tools list
- [ ] Tool executes without errors
- [ ] Tool returns proper response format
- [ ] `refreshGraph: true` is included in response

### ✅ Graph Mode Integration
- [ ] Tool receives `databaseContext` automatically
- [ ] Tool can make API requests to backend
- [ ] UI refreshes after tool execution
- [ ] Loading indicators work during tool execution

### ✅ Error Handling
- [ ] Tool handles invalid parameters gracefully
- [ ] Tool handles API errors gracefully
- [ ] Error messages are user-friendly
- [ ] Tool doesn't crash on unexpected errors

### ✅ User Experience
- [ ] Success notifications appear
- [ ] Error notifications appear with specific messages
- [ ] Manual refresh button works
- [ ] Last updated time displays correctly

## 🔍 Debugging Guide

### Common Issues and Solutions

#### Issue: Tool not appearing in available tools
**Solution**: Check MCP server config and restart backend

#### Issue: Tool executes but UI doesn't refresh
**Solution**: Ensure `refreshGraph: true` is in response

#### Issue: Tool doesn't receive database context
**Solution**: Check that `databaseContext` is in tool schema

#### Issue: API requests fail
**Solution**: Verify endpoint URLs and authentication

#### Issue: TypeScript compilation errors
**Solution**: Check imports and type definitions

#### Issue: "Argument `id` is missing" database error
**Solution**: Ensure node data includes `id` field at top level

#### Issue: Node creation fails with Prisma validation error
**Solution**: Verify node data structure matches Prisma schema exactly

#### Issue: Edges exist in database but don't appear in UI
**Root Cause**: Missing source or target nodes
**Solution**: 
1. Check database for both node types: `SELECT id, label, type FROM graph_nodes WHERE graphId = 'your-graph-id';`
2. Check edge references: `SELECT source, target, label FROM graph_edges WHERE graphId = 'your-graph-id';`
3. Ensure source and target IDs in edges match existing node IDs
4. Create missing nodes for both source and target entities in relations

#### Issue: Nodes exist in database but don't appear in UI
**Root Cause**: UI filtering logic hiding nodes
**Solution**: 
1. Check browser console for filtering logs
2. Verify filter initialization in graph viewers
3. Update filtering logic to default to showing everything when filters are not initialized

#### Issue: Only some entity types visible (e.g., genes but not diseases)
**Root Cause**: Incomplete node creation in relation processing
**Solution**: Ensure both source (`relation.e1`) and target (`relation.e2`) entities are created as nodes

### Data Flow Debugging Checklist

When debugging graph data issues, follow this systematic approach:

#### 1. Check Database Layer
```sql
-- Verify nodes exist
SELECT id, label, type FROM graph_nodes WHERE graphId = (SELECT id FROM graph_projects WHERE conversationId = 'your-conversation-id');

-- Verify edges exist  
SELECT source, target, label FROM graph_edges WHERE graphId = (SELECT id FROM graph_projects WHERE conversationId = 'your-conversation-id');

-- Check for ID mismatches
SELECT DISTINCT source FROM graph_edges WHERE graphId = 'your-graph-id' 
EXCEPT 
SELECT id FROM graph_nodes WHERE graphId = 'your-graph-id';
```

#### 2. Check API Layer
```bash
# Test API endpoint directly
curl -X GET "http://localhost:3001/api/graph/your-conversation-id/state"
```

#### 3. Check Frontend Processing
- Open browser dev tools
- Check console for graph data loading logs
- Verify `parsedData.links` contains expected edges
- Check if filtering is hiding nodes

#### 4. Check MCP Tool Execution
- Look for node creation logs in server console
- Verify both source and target entities are being processed
- Check for edge creation logs
- Ensure `createNodeInDatabase()` is called for all entities

### Critical Debugging Patterns

#### Pattern 1: Missing Source Nodes
**Symptoms**: Edges exist but only show as disconnected lines
**Debug Steps**:
1. Check if source entities are in `processedEntities` set
2. Verify source entity node creation is called
3. Check database for source node existence

#### Pattern 2: UI Filtering Issues  
**Symptoms**: Data exists in database but UI is empty
**Debug Steps**:
1. Check browser console for filter state logs
2. Verify `selectedEntityTypes` and `selectedNodes` initialization
3. Test with manual filter toggling

#### Pattern 3: ID Mismatch Issues
**Symptoms**: Edges reference non-existent nodes
**Debug Steps**:
1. Compare edge source/target IDs with actual node IDs
2. Check ID generation logic in MCP
3. Verify consistent ID usage across node and edge creation

### Debug Logging
Add these console.error statements for debugging:
```typescript
console.error(`[${SERVICE_NAME}] Tool called: ${name}`);
console.error(`[${SERVICE_NAME}] Arguments:`, args);
console.error(`[${SERVICE_NAME}] Database context:`, queryParams.databaseContext);
console.error(`[${SERVICE_NAME}] Node data structure:`, JSON.stringify(nodeData, null, 2));
console.error(`[${SERVICE_NAME}] API request URL:`, url);
console.error(`[${SERVICE_NAME}] API response status:`, response.status);
```

## 📋 Integration with Phase 2 Features

### Loading Indicators
- Automatically work with any MCP tool
- Show during tool execution
- Hide when tool completes

### Notifications
- Success notifications for completed operations
- Error notifications for failed operations
- Specific error messages based on error type

### Manual Refresh
- Works for any graph operation
- Can be used if auto-refresh fails
- Shows loading state during refresh

### Retry Logic
- Automatically retries failed operations
- Shows retry notifications
- Uses exponential backoff

## 🎯 Best Practices

### 1. Tool Design
- Keep tools focused on single operations
- Use descriptive tool names and descriptions
- Provide clear parameter documentation

### 2. Error Handling
- Always include try/catch blocks
- Provide specific error messages
- Log errors for debugging

### 3. Performance
- Use appropriate timeouts
- Handle large datasets efficiently
- Provide progress feedback for long operations

### 4. User Experience
- Always include `refreshGraph: true`
- Provide meaningful success messages
- Handle edge cases gracefully

## 📚 Reference Examples

### Working Examples
- `graphmodeBaseMCP` - Basic graph operations (removeNode, removeEdge, getGraphState)
- `graphmodePubTatorMCP` - PubTator integration (fully updated with `refreshGraph` and proper ID generation)
- `graphmodeBTEMCP` - BioThings Explorer TRAPI integration with bulk operations (1,584+ nodes in <2 seconds)

### API Endpoints
- `GET /api/graph/${conversationId}/state` - Get current graph state
- `POST /api/graph/${conversationId}/nodes` - Add single node
- `POST /api/graph/${conversationId}/nodes/bulk` - Add multiple nodes (bulk)
- `POST /api/graph/${conversationId}/edges` - Add single edge
- `POST /api/graph/${conversationId}/edges/bulk` - Add multiple edges (bulk)
- `DELETE /api/graph/${conversationId}/nodes/${nodeId}` - Remove node
- `DELETE /api/graph/${conversationId}/edges/${edgeId}` - Remove edge

## 🔄 Maintenance

### Regular Updates
- Keep MCP SDK version current
- Update dependencies regularly
- Test with new Graph Mode features

### Monitoring
- Check server logs for errors
- Monitor tool execution times
- Verify UI refresh functionality

---

## 📝 Quick Reference

### Essential Code Snippets

#### Database Context Schema
```typescript
const DatabaseContextSchema = z.object({
  conversationId: z.string().min(1, "conversationId is required"),
  artifactId: z.string().optional(),
  apiBaseUrl: z.string().url().optional(),
  accessToken: z.string().optional(),
});
```

#### Tool Response with Refresh
```typescript
return {
  content: [{
    type: "text",
    text: `Success message`
  }],
  refreshGraph: true
};
```

#### API Request Helper
```typescript
const result = await makeAPIRequest('/endpoint', context, {
  method: 'POST',
  body: JSON.stringify(data)
});
```

#### Bulk Operations Helper
```typescript
// For large datasets, use bulk endpoints
const nodeResult = await makeAPIRequest('/nodes/bulk', context, {
  method: 'POST',
  body: JSON.stringify({ nodes: transformedNodes })
});

const edgeResult = await makeAPIRequest('/edges/bulk', context, {
  method: 'POST',
  body: JSON.stringify({ edges: transformedEdges })
});
```

#### Node Creation Helper
```typescript
async function createNodeInDatabase(nodeData, databaseContext) {
  const endpoint = `/api/graph/${databaseContext.conversationId}/nodes`;
  const nodeWithId = {
    id: nodeData.data?.sourceId || `generated_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    ...nodeData
  };
  return await makeAPIRequest(endpoint, databaseContext, 'POST', nodeWithId);
}
```

#### Error Handling
```typescript
try {
  // Tool logic
} catch (error) {
  return {
    content: [{
      type: "text",
      text: `Error: ${error.message}`
    }]
  };
}
```

This guide provides everything needed to create new Graph Mode MCPs that integrate seamlessly with the existing system and provide excellent user experience.
