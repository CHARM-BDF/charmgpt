# Graph Mode MCP - Integration Checklist

Use this checklist to integrate the Graph Mode MCP into your system.

## ✅ Prerequisites

- [ ] Backend server running (`backend-mcp-client`)
- [ ] Frontend client running (`frontend-client`)
- [ ] Database initialized (`backend-mcp-client/prisma/dev.db` exists)
- [ ] Graph Mode UI working (Graph Mode button creates conversations)
- [ ] API endpoints working (`/api/graph/:conversationId/state`, etc.)

## 🔧 Step 1: Add MCP to Configuration

**File**: `backend-mcp-client/config/mcp_server_config.json`

Add this entry:
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

- [ ] Added to config file
- [ ] Path is correct for your system
- [ ] API_BASE_URL matches your backend port

## 🔌 Step 2: Update Backend MCP Service

**File**: `backend-mcp-client/src/services/mcpService.ts`

### 2A: Add method to detect Graph Mode

```typescript
// Add this helper method
private async isGraphModeConversation(conversationId: string): Promise<boolean> {
  // TODO: Implement conversation mode detection
  // For now, check if conversation exists in graph_projects table
  try {
    const response = await fetch(`http://localhost:5001/api/graph/${conversationId}/state`);
    const data = await response.json();
    return data.success; // Has graph data = Graph Mode
  } catch {
    return false;
  }
}
```

- [ ] Added helper method
- [ ] Tested conversation detection

### 2B: Update callTool method

```typescript
async callTool(
  serverName: string,
  toolName: string,
  args: Record<string, unknown>,
  conversationId?: string
): Promise<any> {
  // Check if this is a Graph Mode conversation
  const isGraphMode = conversationId 
    ? await this.isGraphModeConversation(conversationId)
    : false;
  
  // Add database context for Graph Mode MCP
  if (isGraphMode && serverName === 'graph-mode-mcp') {
    args = {
      ...args,
      databaseContext: {
        conversationId,
        apiBaseUrl: process.env.API_BASE_URL || 'http://localhost:5001',
        accessToken: 'mcp-access-token', // TODO: Implement real auth
      }
    };
  }
  
  // ... rest of existing call logic
}
```

- [ ] Updated callTool method
- [ ] Added database context injection
- [ ] Tested context passing

## 🚫 Step 3: Implement MCP Filtering (Optional but Recommended)

**File**: `backend-mcp-client/src/services/mcpService.ts`

Add method to filter MCPs by conversation mode:

```typescript
getAvailableMCPs(conversationId?: string): string[] {
  const allServers = this.getServerNames();
  
  // Check if Graph Mode conversation
  const isGraphMode = conversationId 
    ? this.isGraphModeConversation(conversationId)
    : false;
  
  if (isGraphMode) {
    // Only allow Graph Mode MCP
    return allServers.filter(server => server === 'graph-mode-mcp');
  }
  
  // Normal mode: exclude Graph Mode MCP
  return allServers.filter(server => server !== 'graph-mode-mcp');
}
```

- [ ] Added filtering method
- [ ] Integrated with tool selection
- [ ] Tested MCP availability

## 🧪 Step 4: Test MCP Functionality

### 4A: Start Backend

```bash
cd backend-mcp-client
npm run dev
```

- [ ] Backend starts without errors
- [ ] MCP service initializes
- [ ] Graph Mode MCP appears in logs

### 4B: Create Graph Mode Conversation

1. Open frontend
2. Click Graph Mode button
3. Note the conversation ID

- [ ] Graph Mode conversation created
- [ ] Blank graph artifact appears
- [ ] GraphModeViewer displays

### 4C: Add Test Data

Click "Add Test Data" button OR:

```bash
curl -X POST http://localhost:5001/api/graph/YOUR_CONVERSATION_ID/mock-data
```

- [ ] Mock data added successfully
- [ ] Nodes appear in UI
- [ ] Edges connect nodes

### 4D: Test getGraphState Tool

In chat, type:
```
"What's in the graph?"
```

**Expected**:
- AI calls `getGraphState` tool
- Returns formatted list of nodes and edges
- JSON artifact created

- [ ] Tool called successfully
- [ ] Response formatted correctly
- [ ] Artifact created

### 4E: Test removeNode Tool

In chat, type:
```
"Remove the TP53 node"
```

**Expected**:
- AI calls `removeNode` tool with nodeId
- Node removed from database
- UI updates to reflect change
- Success message returned

- [ ] Tool called successfully
- [ ] Node removed from database
- [ ] UI updates automatically
- [ ] Related edges also removed

### 4F: Test removeEdge Tool

In chat, type:
```
"Remove the connection between PPARG and Type 2 Diabetes"
```

**Expected**:
- AI queries graph to find edge
- AI calls `removeEdge` tool with edgeId
- Edge removed from database
- UI updates to reflect change

- [ ] Tool called successfully
- [ ] Edge removed from database
- [ ] UI updates automatically

### 4G: Test Filtering

In chat, type:
```
"Show me only the disease nodes"
```

**Expected**:
- AI calls `getGraphState` with filter={nodeType: "disease"}
- Returns only disease nodes
- Edges filtered to match

- [ ] Filter applied correctly
- [ ] Only relevant nodes shown
- [ ] JSON artifact reflects filter

## 🐛 Step 5: Troubleshooting

### MCP not starting

```bash
# Check MCP is built
ls -la custom-mcp-servers/graphModeMCPs/graphmodeBaseMCP/dist/index.js

# If missing, rebuild
cd custom-mcp-servers/graphModeMCPs/graphmodeBaseMCP
npm run build
```

- [ ] MCP built successfully
- [ ] dist/index.js exists

### MCP not appearing in tool list

```bash
# Check backend logs for MCP initialization
tail -f backend-mcp-client/server.log | grep graph-mode
```

- [ ] MCP initialized in logs
- [ ] No errors during startup
- [ ] Tools registered

### Tool calls failing

```bash
# Check if API endpoints work directly
curl http://localhost:5001/api/graph/YOUR_CONVERSATION_ID/state

# Should return graph data
```

- [ ] API endpoints respond
- [ ] Database has data
- [ ] Conversation exists

### Database context not passed

Check backend logs for:
```
[graph-mode-mcp] Making request to: http://localhost:5001/api/graph/...
```

If missing conversationId, database context not passed correctly.

- [ ] Database context in logs
- [ ] ConversationId present
- [ ] API URL correct

## ✅ Step 6: Verification

Complete this checklist to verify everything works:

- [ ] Graph Mode conversation created
- [ ] Mock data added successfully
- [ ] "What's in the graph?" → Returns formatted list
- [ ] "Remove the TP53 node" → Node deleted
- [ ] "Show me only diseases" → Filtered results
- [ ] UI updates after each operation
- [ ] No unwanted artifacts created
- [ ] Error messages are clear

## 📝 Step 7: Document & Clean Up

- [ ] Update README with integration notes
- [ ] Document any custom configuration
- [ ] Clean up test data
- [ ] Commit changes to git

## 🚀 Next Steps

After successful integration:

1. [ ] Implement node/edge creation (different strategy)
2. [ ] Add undo/redo functionality
3. [ ] Implement batch operations
4. [ ] Add graph analytics tools
5. [ ] Performance optimization
6. [ ] Production deployment

---

**Integration Status**: ⏳ In Progress

Update this checklist as you complete each step!

