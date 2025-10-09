# Plan: Graph Mode MCP Data Processing & UI Loading Implementation

## 🎯 **Overview**

This document provides a comprehensive implementation guide for how MCP (Model Context Protocol) data gets processed and loaded into the Graph Mode UI. It covers the complete data flow from MCP tool execution through database storage to UI refresh, including all the technical details needed for implementation.

## 🏗️ **System Architecture**

### **Complete Data Flow**
```
User Input → AI Processing → MCP Tool Call → Database Update → UI Refresh → User Sees Changes
     ↓              ↓              ↓              ↓              ↓              ↓
"Add TP53" → AI decides → addNode tool → Prisma DB → GraphModeViewer → Updated Graph
```

### **Key Components**
1. **MCP Tools**: Graph manipulation tools (addNode, addEdge, removeNode, etc.)
2. **Database Layer**: Prisma database with GraphProject, GraphNode, GraphEdge models
3. **API Layer**: REST endpoints for CRUD operations
4. **Frontend Store**: Zustand store managing UI state
5. **UI Component**: GraphModeViewer with Reagraph visualization

---

## 📊 **Current Implementation Status**

### **✅ What's Working**
- **Database Schema**: Complete Prisma models for graph data
- **API Endpoints**: All CRUD operations implemented
- **UI Component**: GraphModeViewer with basic refresh mechanism
- **MCP Integration**: Database context injection working
- **Test Data**: Mock data endpoint functional

### **🚨 Critical Issues**
1. **UI Refresh Problem**: UI doesn't reliably update after MCP operations
2. **Missing Refresh Triggers**: No mechanism to signal UI refresh
3. **API Route Bugs**: deleteNode/deleteEdge missing graphId parameter
4. **Race Condition Risk**: UI may refresh before database operations complete

---

## 🔄 **Detailed Data Flow Implementation**

### **Phase 1: MCP Tool Execution**

#### **1.1 MCP Tool Call Initiation**
**Location**: `backend-mcp-client/src/services/chat/index.ts:1700-1755`

**Process**:
```typescript
async executeToolCall(toolCall: ToolCall): Promise<ToolResult> {
  // 1. Extract server and tool names
  const [serverName, toolName] = originalToolName.split(':');
  
  // 2. Prepare tool input
  let toolInput = toolCall.input;
  
  // 3. Add database context for Graph Mode conversations
  // Check if this is a Graph Mode conversation (regardless of MCP name)
  const isGraphModeConversation = await this.checkIfGraphModeConversation(this.currentConversationId);
  
  if (isGraphModeConversation && this.currentConversationId) {
    console.error('🔧 Graph Mode conversation detected - adding database context to all MCPs');
    toolInput = {
      ...toolInput,
      databaseContext: {
        conversationId: this.currentConversationId,
        apiBaseUrl: process.env.API_BASE_URL || 'http://localhost:3001',
        accessToken: process.env.ACCESS_TOKEN
      }
    };
  }
  
  // 4. Execute tool via MCP service
  const result = await this.mcpService.callTool(serverName, toolName, toolInput);
  
  return result;
}

// NEW: Method to check if conversation is in Graph Mode
private async checkIfGraphModeConversation(conversationId?: string): Promise<boolean> {
  if (!conversationId) return false;
  
  try {
    // Option 1: Check conversation metadata in database
    const conversation = await this.getConversationMetadata(conversationId);
    if (conversation?.mode === 'graph_mode') {
      return true;
    }
    
    // Option 2: Check if graph project exists for this conversation
    const graphProject = await this.graphDb?.getGraphProject(conversationId);
    if (graphProject) {
      return true;
    }
    
    // Option 3: Check conversation store (if available)
    // This would require access to the conversation store
    // const conversationStore = getConversationStore();
    // const conversation = conversationStore.getConversation(conversationId);
    // return conversation?.metadata?.mode === 'graph_mode';
    
    return false;
  } catch (error) {
    console.error('Error checking Graph Mode conversation:', error);
    return false;
  }
}

// Helper method to get conversation metadata
private async getConversationMetadata(conversationId: string): Promise<{ mode?: string } | null> {
  try {
    // This would query the database for conversation metadata
    // Implementation depends on how conversation metadata is stored
    // For now, return null to use fallback methods
    return null;
  } catch (error) {
    console.error('Error getting conversation metadata:', error);
    return null;
  }
}
```

#### **1.2 Graph Mode Conversation Detection Strategy**

**Multiple Detection Methods** (in order of preference):

1. **Conversation Metadata Check** (Primary):
```typescript
// Check conversation.metadata.mode === 'graph_mode'
const conversation = await getConversationMetadata(conversationId);
return conversation?.mode === 'graph_mode';
```

2. **Graph Project Existence Check** (Fallback):
```typescript
// Check if GraphProject exists for this conversation
const graphProject = await graphDb.getGraphProject(conversationId);
return !!graphProject;
```

3. **Frontend Store Check** (Alternative):
```typescript
// Check frontend conversation store
const conversation = conversationStore.getConversation(conversationId);
return conversation?.metadata?.mode === 'graph_mode';
```

**Benefits of This Approach**:
- **Universal**: Works for ANY MCP in Graph Mode conversations
- **Robust**: Multiple fallback detection methods
- **Future-proof**: Not dependent on specific MCP names
- **Flexible**: Can add new detection methods as needed

#### **1.3 MCP Tool Implementation**
**Location**: `custom-mcp-servers/graphModeMCPs/graphmodeBaseMCP/src/index.ts`

**Example: addNode Tool**:
```typescript
case 'addNode': {
  const { label, type, data, position, canonicalId } = args;
  
  // 1. Call database API
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

  // 2. Return MCP response
  return {
    content: [{
      type: 'text',
      text: `Added node '${label}' (${type}) to the graph.`,
    }],
    refreshGraph: true  // NEW: Flag to trigger UI refresh
  };
}
```

### **Phase 2: Database Operations**

#### **2.1 API Endpoint Processing**
**Location**: `backend-mcp-client/src/routes/graph.ts:74-120`

**Process**:
```typescript
// POST /api/graph/:conversationId/nodes
router.post('/:conversationId/nodes', async (req: Request, res: Response) => {
  try {
    const { conversationId } = req.params;
    const { label, type, data, position } = req.body;
    
    // 1. Get or create graph project
    let graphProject = await graphDb.getGraphProject(conversationId);
    if (!graphProject) {
      graphProject = await graphDb.createGraphProject(
        conversationId, 
        `Graph Mode ${conversationId.slice(0, 8)}`,
        'Graph Mode conversation'
      );
    }
    
    // 2. Add node to database
    const node = await graphDb.addNode(
      graphProject.id,
      label || 'New Node',
      type || 'default',
      data || {},
      position || { x: 0, y: 0 }
    );
    
    // 3. Save state for undo/redo
    await graphDb.saveState(
      graphProject.id,
      `Added node: ${label}`,
      await graphDb.getCurrentGraphState(conversationId)
    );
    
    // 4. Return success response
    res.json({
      success: true,
      data: node
    });
  } catch (error) {
    console.error('Error adding node:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});
```

#### **2.2 Database Service Operations**
**Location**: `backend-mcp-client/src/services/database.ts:50-94`

**Process**:
```typescript
async addNode(graphId: string, label: string, type: string, data?: any, position?: { x: number; y: number }, customId?: string) {
  // 1. Prepare node data
  const nodeData = {
    ...(customId && { id: customId }),
    graphId,
    label,
    type,
    data: data ? JSON.parse(JSON.stringify(data)) : {},
    position: position ? JSON.parse(JSON.stringify(position)) : { x: 0, y: 0 },
  };
  
  // 2. Check if node already exists
  if (nodeData.id) {
    const existingNode = await this.prisma.graphNode.findFirst({
      where: { 
        id: nodeData.id,
        graphId: nodeData.graphId
      }
    });
    
    if (existingNode) {
      // Update existing node
      return await this.prisma.graphNode.updateMany({
        where: { 
          id: nodeData.id,
          graphId: nodeData.graphId
        },
        data: {
          label: nodeData.label,
          type: nodeData.type,
          data: nodeData.data,
          position: nodeData.position,
        }
      });
    }
  }
  
  // 3. Create new node
  return await this.prisma.graphNode.create({
    data: nodeData,
  });
}
```

### **Phase 3: UI Refresh Implementation**

#### **3.1 Current Refresh Mechanism**
**Location**: `frontend-client/src/components/artifacts/GraphModeViewer.tsx:257-273`

**Current Implementation**:
```typescript
// Reload graph when new messages arrive (MCP responses)
useEffect(() => {
  if (!currentConversationId) return;
  
  const unsubscribe = useChatStore.subscribe((state, prevState) => {
    const currentLoading = state.isLoading;
    const prevLoading = prevState.isLoading;
    
    // Only reload when loading changes from true to false (response complete)
    if (prevLoading === true && currentLoading === false) {
      console.log('🔄 MCP response complete, reloading graph data');
      loadGraphDataFromDatabase();
    }
  });
  
  return unsubscribe;
}, [currentConversationId, loadGraphDataFromDatabase]);
```

#### **3.2 Enhanced Refresh Mechanism (Proposed)**
**Location**: `frontend-client/src/components/artifacts/GraphModeViewer.tsx`

**Implementation**:
```typescript
// Enhanced refresh with custom events
useEffect(() => {
  const handleGraphRefresh = () => {
    console.log('🔄 Custom graph refresh event received');
    loadGraphDataFromDatabase();
  };
  
  // Listen for custom refresh events
  window.addEventListener('graphRefresh', handleGraphRefresh);
  
  return () => {
    window.removeEventListener('graphRefresh', handleGraphRefresh);
  };
}, [loadGraphDataFromDatabase]);

// Also keep the existing loading state subscription as fallback
useEffect(() => {
  if (!currentConversationId) return;
  
  const unsubscribe = useChatStore.subscribe((state, prevState) => {
    const currentLoading = state.isLoading;
    const prevLoading = prevState.isLoading;
    
    if (prevLoading === true && currentLoading === false) {
      console.log('🔄 MCP response complete, reloading graph data');
      loadGraphDataFromDatabase();
    }
  });
  
  return unsubscribe;
}, [currentConversationId, loadGraphDataFromDatabase]);
```

#### **3.3 Data Loading from Database**
**Location**: `frontend-client/src/components/artifacts/GraphModeViewer.tsx:192-248`

**Process**:
```typescript
const loadGraphDataFromDatabase = useCallback(async () => {
  if (!currentConversationId) return;
  
  try {
    console.log('🔄 Loading graph data from database for conversation:', currentConversationId);
    
    // 1. Fetch current graph state from API
    const response = await fetch(`/api/graph/${currentConversationId}/state`);
    const result = await response.json();
    
    if (result.success && result.data) {
      console.log('📊 Graph state loaded:', result.data);
      
      // 2. Convert database format to knowledge graph format
      const graphData = {
        nodes: result.data.nodes.map((node: any) => {
          const category = normalizeCategory(node.data?.category || node.type);
          return {
            id: node.id,
            name: node.label,
            canonicalId: node.id,
            category,
            group: getGroupForCategory(category),
            val: 15,
            entityType: node.type,
            metadata: node.data,
            fill: categoryColors[category] || categoryColors.other,
            color: categoryColors[category] || categoryColors.other
          };
        }),
        links: result.data.edges.map((edge: any) => ({
          source: edge.source,
          target: edge.target,
          label: edge.label,
          value: 1
        }))
      };
      
      // 3. Update UI state
      setParsedData(graphData);
    }
  } catch (error) {
    console.error('Error loading graph data from database:', error);
  }
}, [currentConversationId]);
```

---

## ⚡ **Race Condition Analysis & SSE Solution**

### **The Race Condition Problem**

**Current Flow**:
```
1. User: "Add TP53 gene"
2. AI decides to call MCP tool
3. MCP tool calls API endpoint
4. API endpoint calls database service
5. Database service starts inserting data
6. MCP tool returns success response to AI
7. AI generates text response: "Added TP53 gene"
8. LLM response completes → isLoading = false
9. UI refreshes and calls loadGraphDataFromDatabase()
```

**The Problem**: Steps 6-8 happen **before** the database operation is guaranteed to be complete and committed.

**Race Scenarios**:
- Database transaction not committed yet
- Async database operations (indexing, constraints)
- Database locking with large graphs
- Network delays in API calls

### **SSE Solution: Real-Time Progress Communication**

**New Flow with SSE**:
```
1. User: "Add TP53 gene"
2. AI decides to call MCP tool
3. MCP tool calls API endpoint
4. API endpoint streams progress via SSE
5. Database service sends progress updates
6. UI receives real-time progress
7. Database operation completes
8. UI receives completion signal
9. UI refreshes with guaranteed fresh data
```

### **SSE Implementation Architecture**

#### **Backend: SSE-Enabled API Routes**
**Location**: `backend-mcp-client/src/routes/graph.ts`

**Enhanced API Route with SSE**:
```typescript
// POST /api/graph/:conversationId/nodes - Add node with SSE progress
router.post('/:conversationId/nodes', async (req: Request, res: Response) => {
  // Set up SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control',
  });

  try {
    const { conversationId } = req.params;
    const { label, type, data, position } = req.body;
    
    // Send progress update
    res.write(`data: ${JSON.stringify({ 
      type: 'progress', 
      message: 'Starting node creation...',
      step: 'validation',
      timestamp: new Date().toISOString()
    })}\n\n`);
    
    // Get or create graph project
    res.write(`data: ${JSON.stringify({ 
      type: 'progress', 
      message: 'Getting graph project...',
      step: 'graph_project',
      timestamp: new Date().toISOString()
    })}\n\n`);
    
    let graphProject = await graphDb.getGraphProject(conversationId);
    if (!graphProject) {
      res.write(`data: ${JSON.stringify({ 
        type: 'progress', 
        message: 'Creating new graph project...',
        step: 'create_project',
        timestamp: new Date().toISOString()
      })}\n\n`);
      
      graphProject = await graphDb.createGraphProject(
        conversationId, 
        `Graph Mode ${conversationId.slice(0, 8)}`,
        'Graph Mode conversation'
      );
    }
    
    // Send progress update
    res.write(`data: ${JSON.stringify({ 
      type: 'progress', 
      message: 'Adding node to database...',
      step: 'database_insert',
      timestamp: new Date().toISOString()
    })}\n\n`);
    
    // Add node to database with progress callback
    const node = await graphDb.addNodeWithProgress(
      graphProject.id,
      label || 'New Node',
      type || 'default',
      data || {},
      position || { x: 0, y: 0 },
      (progress) => {
        // Send progress updates from database layer
        res.write(`data: ${JSON.stringify({ 
          type: 'progress', 
          message: progress.message,
          step: progress.step,
          timestamp: new Date().toISOString()
        })}\n\n`);
      }
    );
    
    // Send progress update
    res.write(`data: ${JSON.stringify({ 
      type: 'progress', 
      message: 'Saving state for undo/redo...',
      step: 'save_state',
      timestamp: new Date().toISOString()
    })}\n\n`);
    
    // Save state for undo/redo
    await graphDb.saveState(
      graphProject.id,
      `Added node: ${label}`,
      await graphDb.getCurrentGraphState(conversationId)
    );
    
    // Send completion signal
    res.write(`data: ${JSON.stringify({ 
      type: 'complete', 
      message: 'Node added successfully',
      data: node,
      step: 'complete',
      timestamp: new Date().toISOString()
    })}\n\n`);
    
  } catch (error) {
    // Send error signal
    res.write(`data: ${JSON.stringify({ 
      type: 'error', 
      message: error.message,
      step: 'error',
      timestamp: new Date().toISOString()
    })}\n\n`);
  } finally {
    res.end();
  }
});
```

#### **Enhanced Database Service with Progress Callbacks**
**Location**: `backend-mcp-client/src/services/database.ts`

**Progress-Enabled Database Methods**:
```typescript
async addNodeWithProgress(
  graphId: string, 
  label: string, 
  type: string, 
  data?: any, 
  position?: { x: number; y: number }, 
  customId?: string,
  progressCallback?: (progress: { step: string; message: string }) => void
) {
  // Progress: Validation
  progressCallback?.({ step: 'validation', message: 'Validating node data...' });
  
  const nodeData = {
    ...(customId && { id: customId }),
    graphId,
    label,
    type,
    data: data ? JSON.parse(JSON.stringify(data)) : {},
    position: position ? JSON.parse(JSON.stringify(position)) : { x: 0, y: 0 },
  };
  
  // Progress: Check existing
  progressCallback?.({ step: 'check_existing', message: 'Checking for existing node...' });
  
  if (nodeData.id) {
    const existingNode = await this.prisma.graphNode.findFirst({
      where: { 
        id: nodeData.id,
        graphId: nodeData.graphId
      }
    });
    
    if (existingNode) {
      // Progress: Update existing
      progressCallback?.({ step: 'update_existing', message: 'Updating existing node...' });
      
      return await this.prisma.graphNode.updateMany({
        where: { 
          id: nodeData.id,
          graphId: nodeData.graphId
        },
        data: {
          label: nodeData.label,
          type: nodeData.type,
          data: nodeData.data,
          position: nodeData.position,
        }
      });
    }
  }
  
  // Progress: Create new
  progressCallback?.({ step: 'create_new', message: 'Creating new node...' });
  
  const result = await this.prisma.graphNode.create({
    data: nodeData,
  });
  
  // Progress: Verify creation
  progressCallback?.({ step: 'verify_creation', message: 'Verifying node creation...' });
  
  // Verify the node was actually created
  const verification = await this.prisma.graphNode.findUnique({
    where: { id: result.id }
  });
  
  if (!verification) {
    throw new Error('Node creation verification failed');
  }
  
  progressCallback?.({ step: 'complete', message: 'Node created successfully' });
  
  return result;
}

// Similar methods for addEdge, removeNode, removeEdge
async addEdgeWithProgress(
  graphId: string,
  source: string,
  target: string,
  label?: string,
  type?: string,
  data?: any,
  progressCallback?: (progress: { step: string; message: string }) => void
) {
  progressCallback?.({ step: 'validation', message: 'Validating edge data...' });
  
  // Validate source and target nodes exist
  const sourceNode = await this.prisma.graphNode.findFirst({
    where: { id: source, graphId }
  });
  const targetNode = await this.prisma.graphNode.findFirst({
    where: { id: target, graphId }
  });
  
  if (!sourceNode || !targetNode) {
    throw new Error('Source or target node not found');
  }
  
  progressCallback?.({ step: 'create_edge', message: 'Creating edge...' });
  
  const result = await this.prisma.graphEdge.create({
    data: {
      graphId,
      source,
      target,
      label,
      type,
      data: data ? JSON.parse(JSON.stringify(data)) : {},
    },
  });
  
  progressCallback?.({ step: 'verify_creation', message: 'Verifying edge creation...' });
  
  // Verify the edge was actually created
  const verification = await this.prisma.graphEdge.findUnique({
    where: { id: result.id }
  });
  
  if (!verification) {
    throw new Error('Edge creation verification failed');
  }
  
  progressCallback?.({ step: 'complete', message: 'Edge created successfully' });
  
  return result;
}
```

#### **Frontend: SSE Client Implementation**
**Location**: `frontend-client/src/components/artifacts/GraphModeViewer.tsx`

**SSE Progress State Management**:
```typescript
// Enhanced state for operation progress
const [operationProgress, setOperationProgress] = useState<{
  isActive: boolean;
  step: string;
  message: string;
  error?: string;
  timestamp?: string;
}>({ isActive: false, step: '', message: '' });

// SSE connection management
const [sseConnection, setSseConnection] = useState<EventSource | null>(null);

// Function to add node with SSE progress tracking
const addNodeWithProgress = async (nodeData: {
  label: string;
  type: string;
  data?: any;
  position?: { x: number; y: number };
  canonicalId?: string;
}) => {
  setOperationProgress({ 
    isActive: true, 
    step: 'starting', 
    message: 'Starting node creation...',
    timestamp: new Date().toISOString()
  });
  
  try {
    // Create SSE connection
    const eventSource = new EventSource(
      `/api/graph/${currentConversationId}/nodes?${new URLSearchParams({
        method: 'POST',
        body: JSON.stringify(nodeData)
      })}`
    );
    
    setSseConnection(eventSource);
    
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        switch (data.type) {
          case 'progress':
            setOperationProgress({
              isActive: true,
              step: data.step,
              message: data.message,
              timestamp: data.timestamp
            });
            break;
            
          case 'complete':
            setOperationProgress({ 
              isActive: false, 
              step: 'complete', 
              message: data.message,
              timestamp: data.timestamp
            });
            
            // Now refresh the graph data - guaranteed to be complete
            setTimeout(() => {
              loadGraphDataFromDatabase();
            }, 100); // Small delay to ensure database is fully committed
            
            eventSource.close();
            setSseConnection(null);
            break;
            
          case 'error':
            setOperationProgress({ 
              isActive: false, 
              step: 'error', 
              message: data.message,
              error: data.message,
              timestamp: data.timestamp
            });
            eventSource.close();
            setSseConnection(null);
            break;
        }
      } catch (parseError) {
        console.error('Error parsing SSE data:', parseError);
      }
    };
    
    eventSource.onerror = (error) => {
      console.error('SSE connection error:', error);
      setOperationProgress({ 
        isActive: false, 
        step: 'error', 
        message: 'Connection error occurred',
        error: 'SSE connection failed'
      });
      eventSource.close();
      setSseConnection(null);
    };
    
  } catch (error) {
    setOperationProgress({ 
      isActive: false, 
      step: 'error', 
      message: 'Failed to start node creation',
      error: error.message
    });
  }
};

// Cleanup SSE connection on unmount
useEffect(() => {
  return () => {
    if (sseConnection) {
      sseConnection.close();
      setSseConnection(null);
    }
  };
}, [sseConnection]);
```

#### **Enhanced Progress UI Components**
**Location**: `frontend-client/src/components/artifacts/GraphModeViewer.tsx`

**Progress Indicator UI**:
```typescript
// Progress indicator component
const ProgressIndicator = () => {
  if (!operationProgress.isActive) return null;
  
  const getStepIcon = (step: string) => {
    switch (step) {
      case 'validation': return '🔍';
      case 'graph_project': return '📁';
      case 'create_project': return '🆕';
      case 'database_insert': return '💾';
      case 'save_state': return '💾';
      case 'complete': return '✅';
      case 'error': return '❌';
      default: return '⏳';
    }
  };
  
  const getStepColor = (step: string) => {
    switch (step) {
      case 'error': return 'bg-red-100 text-red-800 border-red-200';
      case 'complete': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-blue-100 text-blue-800 border-blue-200';
    }
  };
  
  return (
    <div className={`absolute top-4 right-4 px-4 py-3 rounded-lg border shadow-lg max-w-sm ${getStepColor(operationProgress.step)}`}>
      <div className="flex items-center gap-3">
        <div className="text-lg">{getStepIcon(operationProgress.step)}</div>
        <div className="flex-1">
          <div className="font-medium text-sm">{operationProgress.message}</div>
          <div className="text-xs opacity-75 mt-1">
            Step: {operationProgress.step}
            {operationProgress.timestamp && (
              <span className="ml-2">
                {new Date(operationProgress.timestamp).toLocaleTimeString()}
              </span>
            )}
          </div>
        </div>
        {operationProgress.step === 'complete' && (
          <div className="animate-pulse">✨</div>
        )}
      </div>
      
      {/* Progress bar for active operations */}
      {operationProgress.isActive && operationProgress.step !== 'complete' && (
        <div className="mt-2 w-full bg-gray-200 rounded-full h-1">
          <div className="bg-blue-600 h-1 rounded-full animate-pulse" style={{ width: '60%' }}></div>
        </div>
      )}
    </div>
  );
};

// Error notification component
const ErrorNotification = () => {
  if (!operationProgress.error) return null;
  
  return (
    <div className="absolute top-4 left-4 bg-red-100 text-red-800 px-4 py-2 rounded-lg border border-red-200 shadow-lg max-w-sm">
      <div className="flex items-center gap-2">
        <div className="text-lg">❌</div>
        <div>
          <div className="font-medium text-sm">Operation Failed</div>
          <div className="text-xs mt-1">{operationProgress.error}</div>
        </div>
      </div>
    </div>
  );
};

// Render progress components
return (
  <div className="relative w-full h-full">
    {/* Existing graph content */}
    
    {/* Progress and error indicators */}
    <ProgressIndicator />
    <ErrorNotification />
  </div>
);
```

#### **MCP Integration with SSE**
**Location**: `custom-mcp-servers/graphModeMCPs/graphmodeBaseMCP/src/index.ts`

**Enhanced MCP Tool with SSE Support**:
```typescript
case 'addNode': {
  const { label, type, data, position, canonicalId } = args;
  
  try {
    // Call SSE-enabled API endpoint
    const result = await callGraphAPIWithSSE(
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
      content: [{
        type: 'text',
        text: `Added node '${label}' (${type}) to the graph.`,
      }],
      refreshGraph: true,
      operationComplete: true,  // Signal that database operation is complete
      sseEnabled: true  // Indicate SSE was used
    };
  } catch (error) {
    return {
      content: [{
        type: 'text',
        text: `Error adding node: ${error.message}`,
      }],
      isError: true,
      sseEnabled: true
    };
  }
}

// Helper function for SSE-enabled API calls
async function callGraphAPIWithSSE(
  endpoint: string,
  method: string,
  context: DatabaseContext,
  body: any
): Promise<any> {
  const url = `${context.apiBaseUrl}/api/graph/${context.conversationId}${endpoint}`;
  
  // For SSE endpoints, we don't wait for the full response
  // The frontend will handle the SSE stream
  const response = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(context.accessToken && { 'Authorization': `Bearer ${context.accessToken}` })
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }

  // Return immediately - SSE will handle progress
  return { success: true, sseEnabled: true };
}
```

### **SSE Benefits**

1. **No Race Conditions**: UI only refreshes when database operation is guaranteed complete
2. **Real-time Progress**: Users see exactly what's happening
3. **Error Handling**: Immediate error communication
4. **Scalable**: Works with large graphs and complex operations
5. **User Experience**: Clear feedback during long operations

### **Implementation Priority**

1. **Phase 1**: Implement SSE-enabled API routes
2. **Phase 2**: Add progress callbacks to database service
3. **Phase 3**: Update frontend to use SSE connections
4. **Phase 4**: Enhance MCP tools to support SSE
5. **Phase 5**: Add comprehensive progress UI

---

## 🔧 **Implementation Steps**

### **Step 1: Fix Critical API Bugs (30 minutes)**

#### **1.1 Fix deleteNode API Route**
**File**: `backend-mcp-client/src/routes/graph.ts:169-199`

**Current Broken Code**:
```typescript
router.delete('/:conversationId/nodes/:nodeId', async (req: Request, res: Response) => {
  try {
    const { conversationId, nodeId } = req.params;
    
    await graphDb.deleteNode(nodeId); // ❌ Missing graphId parameter
    
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
**File**: `backend-mcp-client/src/routes/graph.ts:201-232`

**Same Fix Pattern**: Add graphId parameter to `graphDb.deleteEdge(edgeId, graphId)` call

### **Step 2: Implement MCP-Triggered UI Refresh (2 hours)**

#### **2.1 Enhance MCP Responses**
**File**: `custom-mcp-servers/graphModeMCPs/graphmodeBaseMCP/src/index.ts`

**Add refreshGraph flag to all MCP responses**:
```typescript
// For addNode tool
return {
  content: [{
    type: 'text',
    text: `Added node '${label}' (${type}) to the graph.`,
  }],
  refreshGraph: true  // NEW: Flag to trigger UI refresh
};

// For addEdge tool
return {
  content: [{
    type: 'text',
    text: `Added edge from '${source}' to '${target}'${label ? ` with label '${label}'` : ''}.`,
  }],
  refreshGraph: true  // NEW: Flag to trigger UI refresh
};

// For removeNode tool
return {
  content: [{
    type: 'text',
    text: `Removed node '${nodeId}' from the graph.`,
  }],
  refreshGraph: true  // NEW: Flag to trigger UI refresh
};

// For removeEdge tool
return {
  content: [{
    type: 'text',
    text: `Removed edge '${edgeId}' from the graph.`,
  }],
  refreshGraph: true  // NEW: Flag to trigger UI refresh
};
```

#### **2.2 Backend Response Processing**
**File**: `backend-mcp-client/src/services/chat/index.ts`

**Add refresh detection in ChatService**:
```typescript
async executeToolCall(toolCall: ToolCall): Promise<ToolResult> {
  // ... existing code ...
  
  // Execute the tool call
  const result = await this.mcpService.callTool(serverName, toolName, toolInput);
  
  // NEW: Check for refresh flag and trigger frontend update
  if (result.refreshGraph && this.currentConversationId) {
    console.log('🔄 MCP returned refreshGraph flag, triggering UI refresh');
    await this.triggerGraphRefresh(this.currentConversationId);
  }
  
  return result;
}

// NEW: Method to trigger frontend refresh
private async triggerGraphRefresh(conversationId: string) {
  // Option A: Send custom event via response metadata
  // This will be handled in the frontend response processing
  
  // Option B: WebSocket message (future enhancement)
  // websocket.send({ type: 'graphRefresh', conversationId });
  
  // Option C: Server-Sent Events (future enhancement)
  // res.write(`data: ${JSON.stringify({ type: 'graphRefresh' })}\n\n`);
  
  console.log(`🔄 Graph refresh triggered for conversation: ${conversationId}`);
}
```

#### **2.3 Frontend Response Processing**
**File**: `frontend-client/src/store/chatStore.ts`

**Add refresh detection in message processing**:
```typescript
// In processMessage method
processMessage: async (content: string, attachments?: FileAttachment[]) => {
  // ... existing code ...
  
  // Process streaming response
  for await (const chunk of response.body) {
    const data = JSON.parse(chunk.toString());
    
    // ... existing processing ...
    
    // NEW: Check for refresh flag
    if (data.refreshGraph) {
      console.log('🔄 Refresh flag detected in response, triggering graph refresh');
      // Trigger GraphModeViewer refresh
      window.dispatchEvent(new CustomEvent('graphRefresh', {
        detail: { conversationId: currentConversationId }
      }));
    }
  }
}
```

#### **2.4 Enhanced Frontend Refresh Mechanism**
**File**: `frontend-client/src/components/artifacts/GraphModeViewer.tsx`

**Add custom event listener**:
```typescript
// Enhanced refresh mechanism
useEffect(() => {
  const handleGraphRefresh = (event: CustomEvent) => {
    const { conversationId } = event.detail || {};
    
    // Only refresh if this is for the current conversation
    if (!conversationId || conversationId === currentConversationId) {
      console.log('🔄 Custom graph refresh event received');
      loadGraphDataFromDatabase();
    }
  };
  
  // Listen for custom refresh events
  window.addEventListener('graphRefresh', handleGraphRefresh as EventListener);
  
  return () => {
    window.removeEventListener('graphRefresh', handleGraphRefresh as EventListener);
  };
}, [currentConversationId, loadGraphDataFromDatabase]);

// Keep existing loading state subscription as fallback
useEffect(() => {
  if (!currentConversationId) return;
  
  const unsubscribe = useChatStore.subscribe((state, prevState) => {
    const currentLoading = state.isLoading;
    const prevLoading = prevState.isLoading;
    
    if (prevLoading === true && currentLoading === false) {
      console.log('🔄 MCP response complete, reloading graph data (fallback)');
      loadGraphDataFromDatabase();
    }
  });
  
  return unsubscribe;
}, [currentConversationId, loadGraphDataFromDatabase]);
```

### **Step 3: Enhanced User Experience (1 hour)**

#### **3.1 Loading States**
**File**: `frontend-client/src/components/artifacts/GraphModeViewer.tsx`

**Add loading indicators**:
```typescript
// Add loading state
const [isRefreshing, setIsRefreshing] = useState(false);

const loadGraphDataFromDatabase = useCallback(async () => {
  if (!currentConversationId) return;
  
  setIsRefreshing(true);
  try {
    console.log('🔄 Loading graph data from database for conversation:', currentConversationId);
    
    const response = await fetch(`/api/graph/${currentConversationId}/state`);
    const result = await response.json();
    
    if (result.success && result.data) {
      // ... existing conversion logic ...
      setParsedData(graphData);
    }
  } catch (error) {
    console.error('Error loading graph data from database:', error);
  } finally {
    setIsRefreshing(false);
  }
}, [currentConversationId]);

// Show loading indicator in UI
{isRefreshing && (
  <div className="absolute top-4 right-4 bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm">
    Refreshing graph...
  </div>
)}
```

#### **3.2 Success/Error Notifications**
**File**: `frontend-client/src/components/artifacts/GraphModeViewer.tsx`

**Add notification system**:
```typescript
// Enhanced notification state
const [notification, setNotification] = useState<{
  show: boolean;
  message: string;
  type: 'success' | 'error' | 'info';
}>({ show: false, message: '', type: 'success' });

// Show notification function
const showNotification = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
  setNotification({ show: true, message, type });
  setTimeout(() => setNotification({ show: false, message: '', type: 'success' }), 3000);
};

// Enhanced load function with notifications
const loadGraphDataFromDatabase = useCallback(async () => {
  if (!currentConversationId) return;
  
  setIsRefreshing(true);
  try {
    const response = await fetch(`/api/graph/${currentConversationId}/state`);
    const result = await response.json();
    
    if (result.success && result.data) {
      // ... existing conversion logic ...
      setParsedData(graphData);
      showNotification('Graph data refreshed successfully', 'success');
    } else {
      showNotification('Failed to load graph data', 'error');
    }
  } catch (error) {
    console.error('Error loading graph data from database:', error);
    showNotification('Error loading graph data', 'error');
  } finally {
    setIsRefreshing(false);
  }
}, [currentConversationId]);

// Notification UI component
{notification.show && (
  <div className={`absolute top-4 left-4 px-4 py-2 rounded-lg text-sm font-medium ${
    notification.type === 'success' ? 'bg-green-100 text-green-800' :
    notification.type === 'error' ? 'bg-red-100 text-red-800' :
    'bg-blue-100 text-blue-800'
  }`}>
    {notification.message}
  </div>
)}
```

#### **3.3 Manual Refresh Button**
**File**: `frontend-client/src/components/artifacts/GraphModeViewer.tsx`

**Add refresh button to toolbar**:
```typescript
// In the toolbar section
<div className="flex items-center gap-2 p-2 border-b bg-gray-50">
  {/* Existing buttons */}
  
  {/* NEW: Manual refresh button */}
  <button 
    onClick={loadGraphDataFromDatabase}
    disabled={isRefreshing}
    className="flex items-center gap-1 px-2 py-1 text-sm bg-blue-100 hover:bg-blue-200 text-blue-800 rounded disabled:opacity-50"
    title="Refresh graph data"
  >
    <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
    Refresh
  </button>
</div>
```

---

## 🧪 **Testing Strategy**

### **Test Cases**

#### **1. MCP Data Addition**
```bash
# Test 1: Add node via MCP
1. Create Graph Mode conversation
2. Ask: "Add a gene node named TP53"
3. Verify: Node added to database
4. Verify: UI updates within 3 seconds
5. Verify: Success notification shown

# Test 2: Add edge via MCP
1. Add two nodes first
2. Ask: "Connect TP53 to BRCA1 with an association"
3. Verify: Edge added to database
4. Verify: UI shows new edge
5. Verify: Success notification shown
```

#### **2. UI Refresh Functionality**
```bash
# Test 1: Automatic refresh after MCP operation
1. Add node via MCP
2. Verify: UI updates automatically
3. Verify: No manual refresh needed
4. Verify: Loading indicator shows during refresh

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
2. Try to add node via MCP
3. Verify: Error notification shown
4. Verify: Graph unchanged

# Test 2: Invalid operations
1. Try to remove non-existent node
2. Verify: Error message in chat
3. Verify: Graph unchanged
```

---

## 📊 **Success Criteria**

### **Functional Requirements**
- ✅ **MCP Operations Work**: All MCP tools (addNode, addEdge, removeNode, removeEdge) function correctly
- ✅ **Database Persistence**: All changes saved to Prisma database
- ✅ **UI Auto-Refresh**: Graph updates automatically after MCP operations
- ✅ **Error Handling**: Proper error messages for failures
- ✅ **Loading States**: Users see feedback during operations

### **Performance Requirements**
- ✅ **Fast Response**: MCP operations complete within 2 seconds
- ✅ **Quick Refresh**: UI updates within 3 seconds of MCP completion
- ✅ **No Memory Leaks**: Proper cleanup of event listeners
- ✅ **Efficient Queries**: Minimal database queries

### **User Experience Requirements**
- ✅ **Clear Feedback**: Users know when operations succeed/fail
- ✅ **No Confusion**: UI always shows current data
- ✅ **Manual Control**: Users can refresh manually if needed
- ✅ **Smooth Operation**: No jarring UI updates or delays

---

## 🔧 **Implementation Checklist**

### **Phase 1: Fix Critical Bugs & Graph Mode Detection (45 minutes)**
- [ ] Fix deleteNode API route - Add missing graphId parameter
- [ ] Fix deleteEdge API route - Add missing graphId parameter
- [ ] Implement Graph Mode conversation detection - Add checkIfGraphModeConversation method
- [ ] Update database context injection - Use conversation-based detection instead of MCP name
- [ ] Test both fixes - Verify nodes/edges are actually deleted
- [ ] Test Graph Mode detection - Verify database context injected for all MCPs in Graph Mode
- [ ] Update error handling - Add proper error messages

### **Phase 2: Implement SSE Progress Communication (3 hours)**
- [ ] Implement SSE-enabled API routes - Add progress streaming to all endpoints
- [ ] Add progress callbacks to database service - Enhanced methods with progress reporting
- [ ] Update frontend to use SSE connections - Real-time progress tracking
- [ ] Enhance MCP tools to support SSE - Progress-aware MCP responses
- [ ] Add comprehensive progress UI - Visual progress indicators and error handling
- [ ] Test end-to-end - Verify no race conditions and proper progress communication

### **Phase 3: Enhanced UX (1 hour)**
- [ ] Add loading states - Show refresh indicators
- [ ] Add notifications - Success/error messages
- [ ] Add manual refresh - Refresh button in toolbar
- [ ] Test user experience - Verify smooth operation

### **Phase 4: Race Condition Testing (30 minutes)**
- [ ] Test with large graphs - Verify no race conditions
- [ ] Test network delays - Simulate slow database operations
- [ ] Test concurrent operations - Multiple MCP operations simultaneously
- [ ] Verify database consistency - Ensure all operations complete properly

### **Phase 5: Testing & Validation (30 minutes)**
- [ ] Test all MCP operations - addNode, addEdge, removeNode, removeEdge
- [ ] Test UI refresh scenarios - Automatic and manual
- [ ] Test error scenarios - Network errors, invalid operations
- [ ] Verify database persistence - Restart and check data

---

## 🚀 **Future Enhancements**

### **Real-time Updates (Phase 4)**
- **WebSocket Integration**: Real-time graph updates
- **Multi-user Support**: Multiple users editing same graph
- **Conflict Resolution**: Handle simultaneous edits

### **Advanced Features (Phase 5)**
- **Undo/Redo UI**: Visual undo/redo buttons
- **Batch Operations**: Add/remove multiple nodes at once
- **Graph History**: Visual timeline of changes
- **Export Functionality**: Save graph state

---

## 📝 **Implementation Notes**

### **Code Quality**
- **Error Handling**: Comprehensive try/catch blocks
- **Logging**: Detailed logs for debugging
- **Type Safety**: Proper TypeScript types
- **Testing**: Unit tests for critical functions

### **Performance Considerations**
- **Database Queries**: Minimize unnecessary queries
- **Frontend Updates**: Debounce rapid updates
- **Memory Usage**: Clean up event listeners
- **Network Requests**: Cache where appropriate

### **Security Considerations**
- **Input Validation**: Validate all user inputs
- **SQL Injection**: Use parameterized queries
- **Access Control**: Verify user permissions
- **Rate Limiting**: Prevent abuse of API endpoints

---

## 📚 **Related Documentation**

- **Main Plan**: `/docs/cursor-plans/README.PLAN.Graphmode2.md`
- **MCP Architecture**: `/custom-mcp-servers/graphModeMCPs/README.INFO.graphMode.MCP.md`
- **UI Reload Plan**: `/docs/cursor-plans/README.PLAN.graphMode.mcp_reloadUI.md`
- **Backend API**: `/backend-mcp-client/src/routes/graph.ts`
- **Database Service**: `/backend-mcp-client/src/services/database.ts`
- **Frontend Viewer**: `/frontend-client/src/components/artifacts/GraphModeViewer.tsx`

---

**Created**: December 2024  
**Status**: 🚧 Ready for Implementation  
**Estimated Time**: 5 hours total (updated for SSE implementation)  
**Priority**: High (solves critical UI refresh issue and race conditions)  
**Next Steps**: Start with Phase 1 (Critical Bug Fixes), then implement SSE solution
