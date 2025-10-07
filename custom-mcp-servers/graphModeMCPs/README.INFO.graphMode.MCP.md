# Graph Mode MCPs - Information & Architecture Guide

## 🎯 **Overview**

This document explains the architecture, design decisions, and key concepts behind the Graph Mode MCPs (Model Context Protocol servers) in the charm-mcp system.

## ⚡ **Quick Reference: Critical Architecture Decisions**

### **1. One Artifact Per Conversation (But Different IDs)**
```
conversationId: "f2d8d99e-a538-4fff-a0f5-4aa6881f545e"  ← Database key
artifactId:     "f3dfe34f-d471-453d-9b4c-282a400a17d3"  ← Frontend display key
```
- **One conversation** has **one artifact** (1:1 relationship)
- **Different UUIDs** (not the same!)
- **Database uses conversationId** to store graph data

### **2. Database Key is Conversation ID**
```
API Calls:  /api/graph/{conversationId}/state
Database:   WHERE conversationId = 'f2d8d99e...'
NOT:        WHERE conversationId = artifactId  ← WRONG!
```

### **3. No New Artifacts**
- Graph Mode MCPs **never create artifacts**
- Only update existing artifact or return text
- One artifact per conversation, updated in place

### **4. Undo/Redo = Database Snapshots**
- NOT new artifacts
- `GraphState` table stores JSON snapshots
- Artifact ID stays the same, content updates

### **5. Database Context Pattern**
```typescript
{
  conversationId: "f2d8d99e-...",  // Required - the conversation ID (database key)
  apiBaseUrl: "http://localhost:3001",
  accessToken: "token"
}
```

### **6. Frontend Must Send Conversation ID (Not Artifact ID)**
```typescript
// CORRECT:
fetch('/api/chat-artifacts', {
  body: JSON.stringify({
    conversationId: currentConversationId,  // The conversation ID!
    // NOT artifactId!
  })
});
```

---

## 🏗️ **Architecture Overview**

### **Core Principle: Database Context Pattern**

Graph Mode MCPs follow a unique architecture where they **do not receive graph data directly**. Instead, they receive **database context** that allows them to query the backend database for fresh, up-to-date graph information.

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   User Query    │───▶│   Backend API    │───▶│   Database      │
│ "What's in the  │    │ (Graph Router)   │    │ (Prisma/SQLite) │
│  graph?"        │    │                  │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   AI Assistant  │───▶│   MCP Service    │───▶│   Graph Mode    │
│                 │    │ (Auto-adds       │    │   MCP           │
│                 │    │  database        │    │                 │
│                 │    │  context)        │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## 🔑 **Key Concepts**

### **1. Graph Mode Identity: One Artifact, Different IDs**

**CRITICAL DESIGN DECISION**: In Graph Mode, each conversation has **one artifact**, but they have **different IDs**.

#### **The Relationship:**

```
Conversation:
  - conversationId: "f2d8d99e-a538-4fff-a0f5-4aa6881f545e"  ← Database key
  - Has exactly ONE artifact

Artifact:
  - artifactId: "f3dfe34f-d471-453d-9b4c-282a400a17d3"  ← Frontend display key
  - Belongs to ONE conversation
  - Shows the graph visualization

Database:
  - Stores graph data using CONVERSATION ID (not artifact ID)
  - GraphProject.conversationId = "f2d8d99e..."
  - GraphNode.graphId → references GraphProject
```

#### **Why This Matters:**

```typescript
// When creating a Graph Mode conversation
const conversationId = crypto.randomUUID();  // "f2d8d99e..."
const artifactId = crypto.randomUUID();      // "f3dfe34f..." (DIFFERENT!)

// Database stores graph under CONVERSATION ID
await createGraphProject(conversationId, ...);

// Frontend artifact has its own ID
const artifact = {
  id: artifactId,  // Different ID!
  type: 'application/vnd.knowledge-graph',
  content: { nodes: [], links: [] }
};

// But they're linked in the conversation
conversations[conversationId].artifacts = [artifact];
```

#### **Implications for MCP Development:**

- ✅ **Use `conversationId`** as the primary key for all database operations
- ✅ **Database queries** use conversationId, NOT artifact ID
- ✅ **Frontend must send** the conversation ID (not artifact ID) to backend
- ❌ **Don't use artifact ID** to query the database - it won't find anything!

#### **Common Confusion:**

```
❌ WRONG: Using artifact ID to query database
GET /api/graph/{artifactId}/state  ← Returns empty (no data for artifact ID)

✅ CORRECT: Using conversation ID to query database
GET /api/graph/{conversationId}/state  ← Returns graph data
```

### **2. Database Context**

**Database context** is the information an MCP needs to know **which conversation's data** to work with and **how to connect** to the backend database.

#### **What Gets Added Automatically:**

When you call a Graph Mode MCP tool, the backend automatically adds:

```typescript
{
  conversationId: "current-conversation-id",  // Which conversation/artifact
  apiBaseUrl: "http://localhost:3001",        // Where to find the API
  accessToken: "auth-token"                   // How to authenticate
}
```

#### **Why This Architecture?**

- **Multi-User Safety**: Each conversation has its own graph data
- **No Hardcoded URLs**: MCPs work in different environments
- **Security**: Access tokens for authentication
- **Data Isolation**: MCPs can't access wrong conversation's data
- **Single Source of Truth**: One ID for conversation and artifact

### **2. Undo/Redo: Database Snapshots, Not Artifact Versions**

**CRITICAL DESIGN DECISION**: Undo/redo uses **database-level state snapshots**, NOT new artifact versions.

#### **How It Works:**

```
Graph Operation → Database Mutation → GraphState Snapshot Saved
                                    ↓
                          Artifact Content Updated (SAME ID)
```

#### **Database Schema for Versioning:**

```typescript
model GraphState {
  id          String   @id @default(cuid())
  snapshot    Json     // Complete graph state at this point
  command     String   // "addNode", "removeEdge", etc.
  timestamp   DateTime @default(now())
  graphId     String   // Links to GraphProject
}
```

#### **Key Points:**

- **Artifact ID never changes** - Always the same ID (= conversationId)
- **Database stores snapshots** - Multiple GraphState records per graph
- **Undo/Redo is DB operation** - Load previous snapshot, update artifact content
- **Filtering is UI-only** - Doesn't create snapshots or affect database

#### **What This Means for MCPs:**

- ✅ MCPs don't create new artifacts for each operation
- ✅ MCPs don't manage undo/redo (that's a backend API operation)
- ✅ MCPs just make changes and backend handles snapshot creation
- ✅ Same artifact gets updated in place, users see seamless transitions

#### **Example Flow:**

```
1. User: "Add TP53 gene"
   → MCP adds node to database
   → Backend saves GraphState snapshot: { command: "addNode", snapshot: {...} }
   → Frontend updates SAME artifact with new data

2. User: "Remove RAF1 gene"  
   → MCP removes node from database
   → Backend saves GraphState snapshot: { command: "removeNode", snapshot: {...} }
   → Frontend updates SAME artifact with new data

3. User: "Undo"
   → Frontend calls: POST /api/graph/:id/undo
   → Backend loads previous GraphState snapshot
   → Frontend updates SAME artifact with previous state
   → Artifact ID still the same!
```

### **3. No New Artifacts Policy**

**Critical Design Decision**: Graph Mode MCPs **do not create artifacts**. They either:

- **Modify existing graph artifacts** (removeNode, removeEdge)
- **Return information directly** to the conversation (getGraphState)

#### **Why No New Artifacts?**

- **Single Source of Truth**: Graph data lives in the database
- **Real-time Updates**: Always fresh data, no stale artifacts
- **Simplified UX**: Users see one graph artifact that updates
- **Consistency**: All graph operations work on the same data
- **Versioning is DB-level**: GraphState snapshots handle history, not artifact versions

### **3. API-First Design**

Graph Mode MCPs make HTTP calls to the backend API rather than direct database access:

```
MCP → HTTP Request → Backend API → Database
```

#### **Benefits:**

- **Scalability**: No database connection limits
- **Security**: Backend controls access
- **Consistency**: Same API used by frontend and MCPs
- **Maintainability**: Single point of truth for graph operations

## 🛠️ **Implementation Details**

### **Backend Integration**

The backend automatically detects Graph Mode MCP calls and adds database context:

```typescript
// In chat.ts route
if (serverName === 'graph-mode-mcp') {
  toolArguments = {
    ...toolArguments,
    databaseContext: {
      conversationId: conversationId,
      apiBaseUrl: process.env.API_BASE_URL || 'http://localhost:3001',
      accessToken: process.env.ACCESS_TOKEN
    }
  };
}
```

### **MCP Tool Structure**

All Graph Mode MCP tools follow this pattern:

```typescript
// 1. Parse arguments (including databaseContext)
const { databaseContext, ...otherArgs } = ToolArgumentsSchema.parse(args);

// 2. Make API request to backend
const result = await makeAPIRequest('/state', databaseContext);

// 3. Process and return text response (no artifacts)
return {
  content: [{ type: "text", text: formattedResponse }]
};
```

### **API Endpoints Used**

- `GET /api/graph/{conversationId}/state` - Get current graph state
- `DELETE /api/graph/{conversationId}/nodes/{nodeId}` - Remove node
- `DELETE /api/graph/{conversationId}/edges/{edgeId}` - Remove edge

## 📊 **Data Flow Examples**

### **Example 1: Querying Graph State (Correct Flow)**

```
Frontend State:
  currentConversationId: "f2d8d99e-a538-4fff-a0f5-4aa6881f545e"
  artifact.id: "f2d8d99e-a538-4fff-a0f5-4aa6881f545e"  (SAME ID!)
  
User: "What's in the graph?"
↓
Frontend → Backend: { conversationId: "f2d8d99e-a538-4fff-a0f5-4aa6881f545e" }
↓
Backend: Adds databaseContext { conversationId: "f2d8d99e..." }
↓
AI: Calls getGraphState(databaseContext: {...})
↓
MCP: GET /api/graph/f2d8d99e-a538-4fff-a0f5-4aa6881f545e/state
↓
Database: Returns { nodes: [7 nodes], edges: [6 edges] }
↓
MCP: Formats response as text
↓
User: "Your graph contains 7 nodes: TP53, PPARG, INS, LEP..."
```

### **Example 2: Removing a Node (Correct Flow)**

```
Frontend State:
  currentConversationId: "f2d8d99e-a538-4fff-a0f5-4aa6881f545e"
  artifact.id: "f2d8d99e-a538-4fff-a0f5-4aa6881f545e"  (SAME ID!)

User: "Remove the RAF1 gene"
↓
Frontend → Backend: { conversationId: "f2d8d99e..." }
↓
Backend: Adds databaseContext
↓
AI: Calls removeNode(nodeId: "RAF1", databaseContext: {...})
↓
MCP: DELETE /api/graph/f2d8d99e.../nodes/RAF1
↓
Database: 
  - Removes node and connected edges
  - Saves GraphState snapshot: { command: "removeNode", snapshot: {...} }
↓
MCP: Returns confirmation message
↓
Frontend: Updates artifact f2d8d99e... with new data (SAME ID!)
↓
User: "Successfully removed RAF1 gene and 3 connected edges"
```

### **Example 3: Wrong Flow (ID Mismatch - DON'T DO THIS)**

```
❌ BROKEN Frontend State:
  currentConversationId: "f3dfe34f-d471-453d-9b4c-282a400a17d3"  (artifact ID - WRONG!)
  artifact.id: "f3dfe34f-d471-453d-9b4c-282a400a17d3"
  BUT database has data under: "f2d8d99e-a538-4fff-a0f5-4aa6881f545e"

User: "What's in the graph?"
↓
Frontend → Backend: { conversationId: "f3dfe34f..." }  ← WRONG ID!
↓
MCP: GET /api/graph/f3dfe34f.../state
↓
Database: No project found for f3dfe34f... → Returns empty state
↓
User: "The graph is currently empty"  ← FALSE! Data exists under different ID
```

## 🎯 **Current MCPs**

### **graphmodeBaseMCP** (✅ Complete)

**Location**: `graphModeMCPs/graphmodeBaseMCP/`

**Tools**:
- `removeNode` - Delete a node and connected edges
- `removeEdge` - Delete a specific edge  
- `getGraphState` - Query graph with optional filtering

**Status**: Built and ready for integration

### **Future MCPs** (Planned)

- **graphmodeAnalyticsMCP** - Graph analysis tools
- **graphmodeBatchMCP** - Batch operations
- **graphmodeVisualizationMCP** - Layout algorithms

## 🔧 **Configuration**

### **MCP Server Config**

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
        "API_BASE_URL": "http://localhost:3001",
        "NODE_ENV": "development"
      }
    }
  }
}
```

### **Backend Requirements**

- Graph Mode API routes enabled (`/api/graph`)
- Database context injection in chat routes
- Prisma database with graph tables

## 🚨 **Common Issues & Solutions**

### **Issue: "Graph is empty" (Most Common)**

**Symptoms**:
- MCP returns "The graph is currently empty"
- Frontend shows graph with data
- Database has nodes for the conversation

**Root Cause**: **Conversation ID mismatch** - MCP is querying wrong conversation ID

**Diagnosis**:
```bash
# 1. Check server logs for conversation ID MCP is using
[SERVER] [graph-mode] Conversation ID: xyz789

# 2. Check if that ID exists in database
sqlite3 prisma/dev.db "SELECT conversationId FROM graph_projects WHERE conversationId = 'xyz789';"

# 3. Check if it has nodes
sqlite3 prisma/dev.db "SELECT COUNT(*) FROM graph_nodes WHERE graphId = (SELECT id FROM graph_projects WHERE conversationId = 'xyz789');"
```

**Solutions**:
1. **Verify frontend sends conversationId** (not artifactId) in request body
2. **Check conversationId matches** what GraphModeViewer is using to load data
3. **For existing conversations**: Ensure `currentConversationId` is the actual conversation ID, not artifact ID
4. **Verify in database**: The conversation ID being sent should exist in `graph_projects.conversationId`

### **Issue: "Frontend Sends Artifact ID Instead of Conversation ID"**

**Symptoms**:
- Frontend logs show: `selectedArtifactId: f3dfe34f...`
- GraphModeViewer loads from: `conversationId: f2d8d99e...` (different!)
- MCP receives artifact ID but database has data under conversation ID
- Database query returns empty even though GraphModeViewer shows data

**Root Cause**: Frontend's `currentConversationId` is incorrectly set to the **artifact ID** instead of the actual **conversation ID**

**Diagnosis**:
```typescript
// Check what IDs are in play
console.log('currentConversationId:', currentConversationId);     // Shows f3dfe34f... (artifact)
console.log('selectedArtifactId:', selectedArtifactId);           // Shows f3dfe34f... (same)
console.log('GraphModeViewer loading from:', useChatStore.getState().currentConversationId);  // Shows f2d8d99e... (DIFFERENT!)
```

**Solution**:
Frontend must send the **actual conversation ID** (the one used by GraphModeViewer and stored in database), not the artifact ID.

```typescript
// CORRECT: GraphModeViewer shows this works
const actualConversationId = "f2d8d99e-a538-4fff-a0f5-4aa6881f545e";
fetch(`/api/graph/${actualConversationId}/state`);  // ← Returns data!

// WRONG: What's currently being sent to MCP
const wrongId = "f3dfe34f-d471-453d-9b4c-282a400a17d3";  // Artifact ID
fetch(`/api/graph/${wrongId}/state`);  // ← Returns empty!
```

**Fix Required**:
- Ensure `currentConversationId` in chatStore matches the actual conversation ID
- Frontend must send correct conversation ID in processMessage request body
- Don't confuse artifact selection with conversation identification

### **Issue: "Connection refused"**

**Cause**: Wrong API URL in MCP config
**Solution**: Update API_BASE_URL to match backend port (usually 3001)

### **Issue: "MCP creates artifacts"**

**Cause**: MCP returning artifacts instead of text
**Solution**: Remove `artifacts` array from MCP response, return only `content`

## 📋 **Development Guidelines**

### **Adding New Graph Mode MCPs**

1. **Follow the pattern**: Database context + API calls + text responses
2. **No artifacts**: Return information directly to conversation
3. **Use existing API**: Leverage backend graph routes
4. **Test thoroughly**: Verify database context is passed correctly

### **Tool Design Principles**

- **Single Responsibility**: Each tool does one thing well
- **Database Context**: Always require databaseContext parameter
- **Text Responses**: Return formatted text, not raw data
- **Error Handling**: Graceful failure with helpful messages

## 🤖 **AI Assistant Development Guide**

### **When Creating New Graph Mode MCPs**

#### **Step 1: Choose MCP Category**
- **Base Operations**: Node/edge manipulation (remove, add, update)
- **Analytics**: Graph analysis (centrality, communities, paths)
- **Batch Operations**: Bulk operations (import, export, transform)
- **Visualization**: Layout algorithms (force-directed, hierarchical)

#### **Step 2: Follow Template Structure**
```bash
# Copy from graphmodeBaseMCP
cp -r graphmodeBaseMCP/ graphmodeNewMCP/
cd graphmodeNewMCP/

# Update package.json name
# Update tool names and descriptions
# Implement new tool logic
# Test with database context
```

#### **Step 3: Required Code Patterns**

**Tool Schema Pattern:**
```typescript
const NewToolArgumentsSchema = z.object({
  // Tool-specific parameters
  param1: z.string().min(1, "Parameter description"),
  param2: z.number().optional(),
  
  // ALWAYS include database context
  databaseContext: DatabaseContextSchema,
});
```

**Tool Implementation Pattern:**
```typescript
if (name === "newTool") {
  const { param1, param2, databaseContext } = NewToolArgumentsSchema.parse(args);
  
  console.error(`[${SERVICE_NAME}] Executing newTool: ${param1}`);
  
  // Make API request to backend
  const result = await makeAPIRequest('/endpoint', databaseContext, {
    method: 'POST',
    body: JSON.stringify({ param1, param2 })
  });
  
  // Return text response (NO artifacts)
  return {
    content: [{
      type: "text",
      text: `Tool executed successfully: ${result.message}`
    }]
  };
}
```

#### **Step 4: Backend API Requirements**

**If new API endpoints needed:**
1. Add to `backend-mcp-client/src/routes/graph.ts`
2. Follow existing patterns for error handling
3. Use GraphDatabaseService for data operations
4. Return consistent JSON structure

**Example new endpoint:**
```typescript
// POST /api/graph/:conversationId/analyze
router.post('/:conversationId/analyze', async (req: Request, res: Response) => {
  try {
    const { conversationId } = req.params;
    const { analysisType } = req.body;
    
    const graphState = await getGraphDb().getCurrentGraphState(conversationId);
    const analysis = performAnalysis(graphState, analysisType);
    
    res.json({
      success: true,
      data: analysis
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});
```

### **Common MCP Categories & Examples**

#### **Analytics MCPs**
- **Tools**: `analyzeCentrality`, `findCommunities`, `detectPaths`
- **API Endpoints**: `/analyze`, `/communities`, `/paths`
- **Response Format**: "Found 3 communities with sizes: 8, 5, 2 nodes"

#### **Batch Operations MCPs**
- **Tools**: `importCSV`, `exportGraph`, `bulkRemove`
- **API Endpoints**: `/import`, `/export`, `/bulk-remove`
- **Response Format**: "Imported 25 nodes and 40 edges from CSV file"

#### **Visualization MCPs**
- **Tools**: `applyLayout`, `setNodePositions`, `optimizeLayout`
- **API Endpoints**: `/layout`, `/positions`, `/optimize`
- **Response Format**: "Applied force-directed layout to 15 nodes"

### **Testing Checklist for New MCPs**

#### **Pre-Development**
- [ ] Identify which existing API endpoints to use
- [ ] Determine if new backend endpoints are needed
- [ ] Plan tool names and descriptions
- [ ] Design response format (text only, no artifacts)

#### **Development**
- [ ] Copy template structure from graphmodeBaseMCP
- [ ] Update package.json name to `@custom-mcp/graphmode-[category]`
- [ ] Implement tool schemas with databaseContext
- [ ] Add tool handlers following the pattern
- [ ] Test with mock data

#### **Integration**
- [ ] Add to MCP config with unique server name
- [ ] Update backend if new API endpoints needed
- [ ] Test end-to-end with Graph Mode conversation
- [ ] Verify no artifacts are created
- [ ] Check database context is passed correctly

#### **Documentation**
- [ ] Update this README with new MCP category
- [ ] Add tool descriptions to MCP documentation
- [ ] Create integration checklist
- [ ] Document any new API endpoints

### **Error Handling Patterns**

#### **Database Context Missing**
```typescript
if (!databaseContext?.conversationId) {
  return {
    content: [{
      type: "text",
      text: "Error: Database context missing. Please ensure you're in a Graph Mode conversation."
    }]
  };
}
```

#### **API Request Failed**
```typescript
try {
  const result = await makeAPIRequest('/endpoint', databaseContext);
  // Process result
} catch (error) {
  console.error(`[${SERVICE_NAME}] API request failed:`, error);
  return {
    content: [{
      type: "text",
      text: `Error: Could not connect to graph database. ${error.message}`
    }]
  };
}
```

#### **No Data Found**
```typescript
if (!result.data || result.data.nodes.length === 0) {
  return {
    content: [{
      type: "text",
      text: "No graph data found for this conversation. Try adding some data first."
    }]
  };
}
```

## 🔍 **Debugging**

### **Backend Logs to Check**

```
🔧 Graph Mode MCP detected - adding database context
[SERVER] [graph-mode] Getting graph state
[SERVER] [graph-mode] Conversation ID: abc123-def456
[SERVER] [graph-mode] Making request to: http://localhost:3001/api/graph/abc123-def456/state
```

### **Database Verification**

```bash
# Check if conversation has graph data
sqlite3 prisma/dev.db "SELECT conversationId FROM graph_projects WHERE conversationId = 'your-conversation-id';"

# Check node count
sqlite3 prisma/dev.db "SELECT COUNT(*) FROM graph_nodes WHERE graphId = (SELECT id FROM graph_projects WHERE conversationId = 'your-conversation-id');"
```

## 📚 **Related Documentation**

- **Main Plan**: `/docs/cursor-plans/README.PLAN.Graphmode2.md`
- **MCP Plan**: `/docs/cursor-plans/README.PLAN.GraphMode.MCPs.md`
- **Backend API**: `/backend-mcp-client/src/routes/graph.ts`
- **Database Service**: `/backend-mcp-client/src/services/database.ts`
- **Frontend Viewer**: `/frontend-client/src/components/artifacts/GraphModeViewer.tsx`

## 🚀 **Quick Start for AI Assistants**

### **When User Asks for New Graph Mode MCP:**

1. **Identify the category** (Analytics, Batch, Visualization, etc.)
2. **Copy template**: `cp -r graphmodeBaseMCP/ graphmode[Category]MCP/`
3. **Update package.json**: Change name to `@custom-mcp/graphmode-[category]`
4. **Implement tools**: Follow the code patterns above
5. **Add to config**: Update `mcp_server_config.json`
6. **Test**: Verify database context works

### **Critical Rules for AI Assistants:**

#### **✅ DO:**
- Always include `databaseContext` in tool schemas
- Return only `content` array with text responses
- Use existing API endpoints when possible
- Follow the exact code patterns shown above
- Test with actual Graph Mode conversations
- **Send `conversationId` (NOT artifactId)** in request body from frontend
- **Use `conversationId` as the primary key** for all database operations
- **Understand that artifactId ≠ conversationId** (they're different)
- **Query database using conversationId** for all graph operations

#### **❌ DON'T:**
- Create artifacts in MCP responses
- Hardcode API URLs or conversation IDs
- Access database directly (use API calls)
- Skip database context validation
- Return raw JSON data to users
- **Use artifact ID to query the database** (use conversation ID!)
- **Assume artifact ID and conversation ID are the same** (they're different!)
- **Create new artifacts for undo/redo** (use database snapshots instead)

### **Common AI Assistant Mistakes:**

1. **Forgetting database context**: Tools will fail without it
2. **Creating artifacts**: Graph Mode MCPs should never create artifacts
3. **Wrong API endpoints**: Use `/api/graph/{conversationId}/...` pattern
4. **Missing error handling**: Always handle API failures gracefully
5. **Inconsistent naming**: Follow `graphmode[Category]MCP` pattern
6. **Confusing artifact ID with conversation ID**: They're different! Use conversation ID for database
7. **Using artifact ID to query database**: Database is keyed by conversation ID, not artifact ID
8. **Not sending conversationId**: Frontend must include conversationId in request body
9. **Creating artifacts for undo**: Use database snapshots, not new artifacts
10. **Assuming IDs are the same**: Artifact ID ≠ Conversation ID (common error!)

## 📝 **Template Checklist for New MCPs**

### **File Structure to Copy:**
```
graphmodeNewMCP/
├── src/index.ts          # Main MCP implementation
├── package.json          # Update name and description
├── tsconfig.json         # TypeScript config
├── README.md             # Update for new MCP
├── QUICK_START.md        # Update paths and instructions
└── dist/                 # Build output
```

### **Required Changes:**
- [ ] Update `package.json` name to `@custom-mcp/graphmode-[category]`
- [ ] Update `TOOL_NAME` and `SERVICE_NAME` constants
- [ ] Implement new tool schemas with `databaseContext`
- [ ] Add tool handlers following the pattern
- [ ] Update tool descriptions (no artifacts mentioned)
- [ ] Test with database context

### **Integration Steps:**
- [ ] Add to `mcp_server_config.json` with unique server name
- [ ] Update backend if new API endpoints needed
- [ ] Test end-to-end in Graph Mode conversation
- [ ] Verify no artifacts are created
- [ ] Update this documentation

## 🎯 **Future MCP Roadmap**

### **Phase 1: Core Operations** ✅
- **graphmodeBaseMCP**: Remove nodes/edges, query state

### **Phase 2: Analytics** (Next)
- **graphmodeAnalyticsMCP**: Centrality, communities, path analysis
- **Tools**: `analyzeCentrality`, `findCommunities`, `detectPaths`

### **Phase 3: Batch Operations**
- **graphmodeBatchMCP**: Import/export, bulk operations
- **Tools**: `importCSV`, `exportGraph`, `bulkRemove`

### **Phase 4: Visualization**
- **graphmodeVisualizationMCP**: Layout algorithms
- **Tools**: `applyLayout`, `setNodePositions`, `optimizeLayout`

### **Phase 5: Advanced Features**
- **graphmodeAdvancedMCP**: Complex graph operations
- **Tools**: `mergeGraphs`, `compareGraphs`, `transformGraph`

## 🎉 **Summary**

Graph Mode MCPs use a **database context pattern** that:

- ✅ **Ensures data isolation** between conversations
- ✅ **Provides real-time data** from the database
- ✅ **Maintains security** through controlled access
- ✅ **Enables scalability** through API-based architecture
- ✅ **Prevents artifacts** by returning text responses only

This architecture allows Graph Mode MCPs to work seamlessly with the existing graph visualization while maintaining data consistency and security.

### **For AI Assistants:**
This document provides everything needed to create new Graph Mode MCPs following the established patterns. Always follow the database context pattern, never create artifacts, and test thoroughly with real Graph Mode conversations.

---

**Last Updated**: October 7, 2024  
**Status**: ✅ Architecture documented and implemented  
**Next Steps**: Add additional specialized MCPs following this pattern
