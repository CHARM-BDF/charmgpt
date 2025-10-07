# Plan: Graph Mode MCP UI Reload & Bug Fixes

## 🚨 **Critical Issues Identified**

### **Issue 1: Remove Node Function Not Working**
**Root Cause**: API route calls `graphDb.deleteNode(nodeId)` but function requires `deleteNode(nodeId, graphId)`

**Location**: `backend-mcp-client/src/routes/graph.ts:176`
```typescript
// ❌ BROKEN: Missing graphId parameter
await graphDb.deleteNode(nodeId);

// ✅ FIXED: Should be
const graphProject = await graphDb.getGraphProject(conversationId);
if (graphProject) {
  await graphDb.deleteNode(nodeId, graphProject.id);
}
```

### **Issue 2: UI Not Updating After MCP Operations**
**Root Cause**: No mechanism to trigger frontend refresh after MCP operations complete

**Current Flow**:
```
MCP Operation → Database Updated → MCP Returns Success → UI Still Shows Old Data ❌
```

**Needed Flow**:
```
MCP Operation → Database Updated → MCP Returns Success → UI Refreshes → Shows New Data ✅
```

## 🎯 **Implementation Plan**

### **Phase 1: Fix Critical Bugs (Priority 1)**

#### **1.1 Fix deleteNode API Route**
**File**: `backend-mcp-client/src/routes/graph.ts`
**Lines**: 169-199

**Current Code**:
```typescript
router.delete('/:conversationId/nodes/:nodeId', async (req: Request, res: Response) => {
  try {
    const { conversationId, nodeId } = req.params;
    
    await graphDb.deleteNode(nodeId); // ❌ Missing graphId
    
    // ... rest of function
  } catch (error) {
    // ... error handling
  }
});
```

**Fixed Code**:
```typescript
router.delete('/:conversationId/nodes/:nodeId', async (req: Request, res: Response) => {
  try {
    const { conversationId, nodeId } = req.params;
    
    // Get graph project to get graphId
    const graphProject = await graphDb.getGraphProject(conversationId);
    if (!graphProject) {
      return res.status(404).json({
        success: false,
        error: 'Graph project not found for this conversation'
      });
    }
    
    // Delete node with correct parameters
    await graphDb.deleteNode(nodeId, graphProject.id);
    
    // Save state for undo/redo
    await graphDb.saveState(
      graphProject.id,
      `Deleted node: ${nodeId}`,
      await graphDb.getCurrentGraphState(conversationId)
    );
    
    res.json({
      success: true,
      message: 'Node deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting node:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});
```

#### **1.2 Fix deleteEdge API Route**
**File**: `backend-mcp-client/src/routes/graph.ts`
**Lines**: 201-232

**Same Issue**: Missing `graphId` parameter in `graphDb.deleteEdge(edgeId)` call

**Fix**: Add graphId parameter similar to deleteNode fix

#### **1.3 Test the Fixes**
```bash
# Test removeNode
1. Create Graph Mode conversation
2. Add test data
3. Try: "Remove RAF1 gene"
4. Verify node is actually deleted from database
5. Check server logs for success/error messages
```

### **Phase 2: Implement MCP-Triggered UI Reload (Priority 2)**

#### **2.1 MCP Response Enhancement**
**Goal**: MCPs return a special flag that triggers frontend refresh

**Approach**: Add `refreshGraph: true` to MCP responses

**Files to Modify**:
- `custom-mcp-servers/graphModeMCPs/graphmodeBaseMCP/src/index.ts`

**Current MCP Response**:
```typescript
return {
  content: [{
    type: "text",
    text: "Successfully removed node 'RAF1' from the graph."
  }]
};
```

**Enhanced MCP Response**:
```typescript
return {
  content: [{
    type: "text",
    text: "Successfully removed node 'RAF1' from the graph. The graph will refresh automatically."
  }],
  refreshGraph: true  // New flag to trigger UI refresh
};
```

#### **2.2 Backend Response Processing**
**Goal**: Backend detects `refreshGraph` flag and triggers frontend update

**Files to Modify**:
- `backend-mcp-client/src/services/chat/index.ts`
- `backend-mcp-client/src/routes/chat-artifacts.ts`

**Implementation**:
```typescript
// In ChatService.executeToolCall
if (result.refreshGraph) {
  // Trigger frontend refresh
  await this.triggerGraphRefresh(conversationId);
}

// New method in ChatService
private async triggerGraphRefresh(conversationId: string) {
  // Option A: Send WebSocket message
  // Option B: Add to response metadata
  // Option C: Use Server-Sent Events
}
```

#### **2.3 Frontend Refresh Mechanism**
**Goal**: Frontend detects refresh trigger and reloads graph data

**Files to Modify**:
- `frontend-client/src/components/artifacts/GraphModeViewer.tsx`
- `frontend-client/src/store/chatStore.ts`

**Approach Options**:

##### **Option A: Response Metadata (Simplest)**
```typescript
// In chatStore.ts - processMessage
if (data.refreshGraph) {
  // Trigger GraphModeViewer refresh
  window.dispatchEvent(new CustomEvent('graphRefresh'));
}

// In GraphModeViewer.tsx
useEffect(() => {
  const handleRefresh = () => {
    loadGraphDataFromDatabase();
  };
  
  window.addEventListener('graphRefresh', handleRefresh);
  return () => window.removeEventListener('graphRefresh', handleRefresh);
}, []);
```

##### **Option B: WebSocket (Real-time)**
```typescript
// Backend sends WebSocket message
websocket.send({
  type: 'graphRefresh',
  conversationId: conversationId
});

// Frontend listens for WebSocket messages
useEffect(() => {
  websocket.on('graphRefresh', (data) => {
    if (data.conversationId === currentConversationId) {
      loadGraphDataFromDatabase();
    }
  });
}, [currentConversationId]);
```

##### **Option C: Server-Sent Events (Real-time)**
```typescript
// Backend sends SSE
res.write(`data: ${JSON.stringify({ type: 'graphRefresh' })}\n\n`);

// Frontend listens for SSE
const eventSource = new EventSource('/api/graph/events');
eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.type === 'graphRefresh') {
    loadGraphDataFromDatabase();
  }
};
```

### **Phase 3: Enhanced User Experience (Priority 3)**

#### **3.1 Loading States**
**Goal**: Show loading indicators during MCP operations

**Implementation**:
```typescript
// In GraphModeViewer.tsx
const [isRefreshing, setIsRefreshing] = useState(false);

const loadGraphDataFromDatabase = async () => {
  setIsRefreshing(true);
  try {
    // ... existing load logic
  } finally {
    setIsRefreshing(false);
  }
};

// Show loading indicator
{isRefreshing && <div className="loading-indicator">Refreshing graph...</div>}
```

#### **3.2 Success/Error Notifications**
**Goal**: Show user feedback for MCP operations

**Implementation**:
```typescript
// In GraphModeViewer.tsx
const [notification, setNotification] = useState<{
  show: boolean;
  message: string;
  type: 'success' | 'error';
}>({ show: false, message: '', type: 'success' });

// Show notification
{notification.show && (
  <div className={`notification ${notification.type}`}>
    {notification.message}
  </div>
)}
```

#### **3.3 Manual Refresh Button**
**Goal**: Allow users to manually refresh graph data

**Implementation**:
```typescript
// In GraphModeViewer.tsx toolbar
<button 
  onClick={loadGraphDataFromDatabase}
  className="refresh-button"
  title="Refresh graph data"
>
  <RefreshCw className="w-4 h-4" />
</button>
```

## 🔧 **Implementation Steps**

### **Step 1: Fix Critical Bugs (30 minutes)**
1. **Fix deleteNode API route** - Add missing graphId parameter
2. **Fix deleteEdge API route** - Add missing graphId parameter  
3. **Test both fixes** - Verify nodes/edges are actually deleted
4. **Update error handling** - Add proper error messages

### **Step 2: Implement MCP-Triggered Refresh (2 hours)**
1. **Enhance MCP responses** - Add `refreshGraph: true` flag
2. **Modify backend processing** - Detect refresh flag in responses
3. **Implement frontend refresh** - Use Option A (Response Metadata) initially
4. **Test end-to-end** - Verify UI updates after MCP operations

### **Step 3: Enhanced UX (1 hour)**
1. **Add loading states** - Show refresh indicators
2. **Add notifications** - Success/error messages
3. **Add manual refresh** - Refresh button in toolbar
4. **Test user experience** - Verify smooth operation

## 🧪 **Testing Strategy**

### **Test Cases**

#### **1. Remove Node Functionality**
```bash
# Test 1: Remove existing node
1. Create Graph Mode conversation
2. Add test data with RAF1 gene
3. Ask: "Remove RAF1 gene"
4. Verify: Node deleted from database
5. Verify: UI shows updated graph
6. Verify: Success message displayed

# Test 2: Remove non-existent node
1. Ask: "Remove NONEXISTENT gene"
2. Verify: Error message displayed
3. Verify: Graph unchanged
4. Verify: No database changes
```

#### **2. UI Refresh Functionality**
```bash
# Test 1: Automatic refresh after remove
1. Remove a node via MCP
2. Verify: UI updates within 3 seconds
3. Verify: Graph shows correct data
4. Verify: No manual refresh needed

# Test 2: Manual refresh button
1. Click refresh button
2. Verify: Graph data reloads
3. Verify: Loading indicator shows
4. Verify: Latest data displayed
```

#### **3. Error Handling**
```bash
# Test 1: Network errors
1. Disconnect network
2. Try to remove node
3. Verify: Error message displayed
4. Verify: Graph unchanged

# Test 2: Invalid conversation ID
1. Use wrong conversation ID
2. Try to remove node
3. Verify: Error message displayed
4. Verify: No database changes
```

## 📊 **Success Criteria**

### **Functional Requirements**
- ✅ **Remove node works**: Nodes are actually deleted from database
- ✅ **Remove edge works**: Edges are actually deleted from database
- ✅ **UI updates automatically**: Graph refreshes after MCP operations
- ✅ **Error handling**: Proper error messages for failures
- ✅ **Loading states**: Users see feedback during operations

### **Performance Requirements**
- ✅ **Fast response**: MCP operations complete within 2 seconds
- ✅ **Quick refresh**: UI updates within 3 seconds of MCP completion
- ✅ **No memory leaks**: Proper cleanup of event listeners
- ✅ **Efficient polling**: Minimal database queries

### **User Experience Requirements**
- ✅ **Clear feedback**: Users know when operations succeed/fail
- ✅ **No confusion**: UI always shows current data
- ✅ **Manual control**: Users can refresh manually if needed
- ✅ **Smooth operation**: No jarring UI updates or delays

## 🚀 **Future Enhancements**

### **Real-time Updates (Phase 4)**
- **WebSocket integration**: Real-time graph updates
- **Multi-user support**: Multiple users editing same graph
- **Conflict resolution**: Handle simultaneous edits

### **Advanced Features (Phase 5)**
- **Undo/Redo UI**: Visual undo/redo buttons
- **Batch operations**: Remove multiple nodes at once
- **Graph history**: Visual timeline of changes
- **Export functionality**: Save graph state

## 📝 **Implementation Notes**

### **Code Quality**
- **Error handling**: Comprehensive try/catch blocks
- **Logging**: Detailed logs for debugging
- **Type safety**: Proper TypeScript types
- **Testing**: Unit tests for critical functions

### **Performance Considerations**
- **Database queries**: Minimize unnecessary queries
- **Frontend updates**: Debounce rapid updates
- **Memory usage**: Clean up event listeners
- **Network requests**: Cache where appropriate

### **Security Considerations**
- **Input validation**: Validate all user inputs
- **SQL injection**: Use parameterized queries
- **Access control**: Verify user permissions
- **Rate limiting**: Prevent abuse of API endpoints

## 🎯 **Priority Order**

1. **🔥 CRITICAL**: Fix deleteNode/deleteEdge API routes (30 min)
2. **⚡ HIGH**: Implement MCP-triggered UI refresh (2 hours)
3. **📈 MEDIUM**: Add loading states and notifications (1 hour)
4. **✨ LOW**: Manual refresh button and enhanced UX (30 min)

## 📚 **Related Documentation**

- **Main Plan**: `/docs/cursor-plans/README.PLAN.Graphmode2.md`
- **MCP Architecture**: `/custom-mcp-servers/graphModeMCPs/README.INFO.graphMode.MCP.md`
- **Backend API**: `/backend-mcp-client/src/routes/graph.ts`
- **Database Service**: `/backend-mcp-client/src/services/database.ts`
- **Frontend Viewer**: `/frontend-client/src/components/artifacts/GraphModeViewer.tsx`

---

**Created**: December 2024  
**Status**: 🚧 Ready for Implementation  
**Estimated Time**: 4 hours total  
**Next Steps**: Start with Phase 1 (Critical Bug Fixes)
