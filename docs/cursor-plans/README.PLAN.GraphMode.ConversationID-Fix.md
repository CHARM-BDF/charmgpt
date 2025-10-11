# Fix GraphMode Conversation ID vs Artifact ID Mismatch

## Overview

Eliminate the conversation ID vs artifact ID confusion in Graph Mode by using a single ID for both the conversation and artifact, and creating the GraphProject immediately when a new Graph Mode conversation is created.

## Problem

Currently, Graph Mode conversations create two separate IDs:
- **Conversation ID** (`65193b89-62de-4249-8501-97279b839ce0`): Used for chat messages
- **Artifact ID** (`b370b072-0a1c-4940-b822-51a4f07bcd53`): Used for the graph artifact

The ChatService injects the artifact ID into the database context for PubTator MCP, causing nodes to be stored under the wrong conversation. The UI looks for nodes using the conversation ID but they're stored under the artifact ID.

**Evidence from logs:**
```
Line 182: ChatService stores: 65193b89-62de-4249-8501-97279b839ce0 (conversation ID)
Line 214: PubTator MCP receives: b370b072-0a1c-4940-b822-51a4f07bcd53 (artifact ID)
Line 217: Backend creates GraphProject with artifact ID
Line 992: Graph Mode MCP receives conversation ID
Line 1014: Graph Mode MCP finds no data (looking in wrong conversation)
```

## Solution

Use the conversation ID as both the conversation ID and artifact ID, and create the GraphProject immediately when the conversation starts.

## Implementation Steps

### Step 1: Add GraphProject Initialization Route

**File:** `backend-mcp-client/src/routes/graph.ts`

Add a new route before existing routes (around line 73):

```typescript
// POST /api/graph/:conversationId/init - Initialize GraphProject for new conversation
router.post('/:conversationId/init', async (req: Request, res: Response) => {
  try {
    const { conversationId } = req.params;
    const { name, description } = req.body;
    
    const db = getGraphDb();
    
    // Check if GraphProject already exists
    let graphProject = await db.getGraphProject(conversationId);
    if (!graphProject) {
      // Create new GraphProject
      graphProject = await db.createGraphProject(
        conversationId,
        name || `Graph Mode ${conversationId.slice(0, 8)}`,
        description || 'Graph Mode conversation'
      );
    }
    
    res.json({
      success: true,
      data: graphProject
    });
  } catch (error) {
    console.error('Error initializing graph project:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});
```

### Step 2: Update Graph Mode Conversation Creation

**File:** `frontend-client/src/store/chatStore.ts`

Replace the `startNewGraphModeConversation` method (around lines 1072-1147):

```typescript
startNewGraphModeConversation: async (name?: string) => {
  const conversationId = crypto.randomUUID();
  const defaultName = name || `Graph Mode ${Object.keys(get().conversations).length + 1}`;
  
  // Initialize GraphProject in database immediately
  try {
    const response = await fetch(`/api/graph/${conversationId}/init`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: defaultName,
        description: 'Graph Mode conversation'
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to initialize graph project');
    }
    
    console.log('✅ GraphProject initialized for conversation:', conversationId);
  } catch (error) {
    console.error('❌ Error creating graph project:', error);
    // Continue with conversation creation even if graph init fails
    // The backend will create it lazily on first node/edge creation
  }
  
  // Create artifact with SAME ID as conversation
  const graphArtifact = {
    id: conversationId,  // Use conversation ID, not separate artifact ID
    type: 'application/vnd.knowledge-graph' as const,
    title: 'Graph Mode Canvas',
    content: {
      nodes: [],
      links: []
    },
    timestamp: new Date()
  };
  
  console.log('🔥 [GRAPH-MODE] Creating conversation with ID:', conversationId);
  console.log('🔥 [GRAPH-MODE] Artifact ID (same as conversation):', graphArtifact.id);
  console.log('🔥 [GRAPH-MODE] Single ID approach - no more confusion!');
  
  // Create welcome message with the artifact link
  const welcomeMessage = {
    id: crypto.randomUUID(),
    role: 'assistant' as const,
    content: `Welcome to Graph Mode! I've created a blank canvas for you to build your knowledge graph.\n\n[Open Graph Canvas](artifact:${graphArtifact.id})`,
    timestamp: new Date(),
    artifactId: graphArtifact.id
  };
  
  console.log('Graph Mode: Creating blank graph artifact:', graphArtifact);
  console.log('Graph Mode: Creating welcome message:', welcomeMessage);
  
  set(state => ({
    conversations: {
      ...state.conversations,
      [conversationId]: {
        id: conversationId,
        name: defaultName,
        messages: [welcomeMessage],
        artifacts: [graphArtifact],
        metadata: {
          mode: 'graph_mode',
          createdAt: new Date().toISOString()
        }
      }
    },
    currentConversationId: conversationId,
    messages: [welcomeMessage],
    artifacts: [graphArtifact],
    selectedArtifactId: graphArtifact.id,
    showArtifactWindow: true,
    blockedServers: []  // Reset blocked servers for new conversation
  }));
  
  return conversationId;
},
```

### Step 3: Verify ChatService Database Context Injection

**File:** `backend-mcp-client/src/services/chat/index.ts`

No changes needed, but verify the logging around line 1757 shows the conversation ID is being injected correctly:

```typescript
console.error('🔧 Graph Mode detected - injecting database context into tool input');
console.error('🔧 [EXECUTETOOLS] Server name:', serverName);
console.error('🔧 [EXECUTETOOLS] Adding database context with conversationId:', this.currentConversationId);
```

After the fix, both PubTator MCP and Graph Mode MCP should receive the same conversation ID.

### Step 4: Update Documentation

**File:** `docs/README.INFO.GraphModeMCPGuide.md`

Add a note about the single ID approach (around line 50):

```markdown
## Critical: Single ID Approach

As of [DATE], Graph Mode uses a **single ID** for both the conversation and artifact:

- **Conversation ID** = **Artifact ID** = **Database Key**
- GraphProject is created **immediately** when conversation starts
- No more confusion between conversation ID and artifact ID
- All components use the same ID consistently

This eliminates the ID mismatch issues that previously caused nodes to be created in one conversation but displayed in another.
```

## Testing

### Test 1: Create New Graph Mode Conversation

1. Click "New Graph Mode Conversation"
2. Check browser console for logs:
   ```
   ✅ GraphProject initialized for conversation: [ID]
   🔥 [GRAPH-MODE] Creating conversation with ID: [ID]
   🔥 [GRAPH-MODE] Artifact ID (same as conversation): [ID]
   ```
3. Verify same ID is used in all three places

### Test 2: Verify Database Creation

```bash
# Check that GraphProject was created immediately
sqlite3 backend-mcp-client/prisma/dev.db "SELECT id, conversationId, name FROM graph_projects ORDER BY createdAt DESC LIMIT 1;"
```

The `conversationId` should match the conversation ID from browser console.

### Test 3: Use PubTator MCP

1. In the new Graph Mode conversation, ask: "Find information about FAM177A1 and add it to the graph"
2. Check server logs for database context injection:
   ```
   🔧 [EXECUTETOOLS] Server name: graphmode-pubtator-mcp
   🔧 [EXECUTETOOLS] Adding database context with conversationId: [SAME_ID]
   ```
3. Verify nodes appear in UI immediately
4. Check database:
   ```bash
   sqlite3 backend-mcp-client/prisma/dev.db "SELECT id, label, type FROM graph_nodes WHERE graphId = (SELECT id FROM graph_projects WHERE conversationId = '[SAME_ID]');"
   ```

### Test 4: Verify Graph State Query

1. Ask: "What's in the graph?"
2. Graph Mode MCP should find the nodes (no more "No data found" message)
3. UI should display the graph state correctly

### Test 5: Test with Existing Conversation

1. Switch to an existing Graph Mode conversation
2. Verify it still works (backward compatibility)
3. If artifact ID differs from conversation ID, nodes should still be accessible

## Success Criteria

- GraphProject created immediately when Graph Mode conversation starts
- Conversation ID equals Artifact ID (single ID for everything)
- PubTator MCP receives conversation ID in database context
- Graph Mode MCP receives same conversation ID
- Nodes created under correct conversation ID
- UI displays nodes immediately after creation
- No more "No data found for ID" messages in logs
- Database queries show nodes in correct GraphProject

## Files Modified

1. `backend-mcp-client/src/routes/graph.ts` - Add `/init` route
2. `frontend-client/src/store/chatStore.ts` - Update `startNewGraphModeConversation`
3. `docs/README.INFO.GraphModeMCPGuide.md` - Document single ID approach

## Rollback Plan

If issues occur:

1. Revert changes to `frontend-client/src/store/chatStore.ts`
2. Remove `/init` route from `backend-mcp-client/src/routes/graph.ts`
3. System will fall back to lazy GraphProject creation on first node

## Benefits

1. **Single Source of Truth**: One ID for conversation, artifact, and database
2. **No ID Confusion**: Eliminates root cause of mismatch
3. **Immediate GraphProject**: Database ready from the start
4. **Consistent State**: All components use same ID
5. **Simpler Logic**: No artifact ID vs conversation ID mapping needed
6. **Better Debugging**: Same ID in all logs makes tracking easier

## Notes

- This is a breaking change for the frontend state structure
- Existing conversations with separate artifact IDs will continue to work
- New conversations will use the single ID approach
- The backend already supports both patterns (lazy and eager GraphProject creation)

