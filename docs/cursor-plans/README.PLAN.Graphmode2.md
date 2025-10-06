
# Plan: Graph Mode 2 Implementation

## Current Mode System Analysis

### Existing Mode Architecture

The system currently implements a **dual-layer mode system**:

#### 1. Mode Store System (Application-Level)
- **Location**: `frontend-client/src/store/modeStore.ts`
- **Types**: `'grant' | 'research'`
- **Default**: `'research'`
- **UI Component**: `ModeSwitcher.tsx`
- **Purpose**: Controls overall application context and behavior

#### 2. Project Type System (Project-Level)
- **Location**: `frontend-client/src/store/projectStore.ts`
- **Types**: `'project' | 'grant_review'`
- **Purpose**: Determines individual project behavior and features

### Current Project Modes

#### **Project Mode** (Regular Projects)
- **Type**: `'project'` in project store
- **UI**: Main project list (`ProjectListView`)
- **Features**: Standard project functionality with file management
- **Access**: Through main project drawer and project list

#### **Grant Review Mode** (Grant Review Projects)
- **Type**: `'grant_review'` in project store
- **UI**: Separate grant review section
- **Features**:
  - Special document guidance section
  - Expected Documents list (RFA, Specific Aims, Research Proposal, Supplemental Information)
  - Usage instructions for document management
- **Access**: Through "Grant Reviews" section in conversation drawer

### Key Implementation Details

#### Project Filtering Logic
```typescript
// Regular projects exclude grant reviews
const regularProjects = projects?.filter(project => project.type !== 'grant_review') || [];
const grantReviewProjects = projects?.filter(project => project.type === 'grant_review') || [];
```

#### Grant Review Project Creation
```typescript
addProject({
  name: "New Grant Review",
  description: "",
  type: 'grant_review',
  grantMetadata: {
    requiredDocuments: []
  }
});
```

#### Special UI for Grant Reviews
- Document guidance section (lines 439-468 in `ProjectView.tsx`)
- Expected documents list with icons
- Usage instructions for document management
- Separate navigation through grant review list view

## Current Architecture Benefits

The dual-layer approach allows for:
- **Research mode** with regular projects
- **Research mode** with grant review projects  
- **Grant mode** with regular projects
- **Grant mode** with grant review projects

## Graph Mode 2 Goals

### Core Concept
**Graph Mode 2** is a specialized conversation mode for building and managing knowledge graphs with these key characteristics:

1. **Conversation-Level Graph Mode**: Individual conversations can be in Graph Mode (not project-level)
2. **Single Persistent Artifact**: One continuously updated knowledge graph artifact per conversation (vs. multiple separate artifacts)
3. **Database Persistence**: Graph data stored in Prisma database on server
4. **State Management**: Save current state for undo/history functionality
5. **Specialized MCPs**: MCPs designed specifically for graph operations
6. **No New Artifacts**: Prevents creation of additional artifacts during graph building

### Key Differences from Current System

#### Current Artifact System
- **Multiple Artifacts**: Each tool call can create new artifacts
- **Artifact Switching**: Users switch between different artifacts via drawer
- **Local Storage**: Artifacts stored in browser/localStorage
- **No History**: No undo/redo functionality
- **Generic MCPs**: MCPs work for any artifact type

#### Graph Mode 2 System
- **Single Artifact**: One persistent knowledge graph artifact
- **No Switching**: Always shows the same graph (updated in place)
- **Database Storage**: Graph data persisted in Prisma database
- **Full History**: Complete undo/redo with state snapshots
- **Graph-Specific MCPs**: MCPs designed for graph operations only

## Current System Analysis

### Artifact Management Flow

#### 1. Artifact Creation
```typescript
// Current: Multiple artifacts created per conversation
addArtifact: (artifact) => {
  const newArtifact = { ...artifact, timestamp: new Date() };
  set((state) => ({
    artifacts: [...state.artifacts, newArtifact],
    selectedArtifactId: artifact.id,
    showArtifactWindow: true
  }));
}
```

#### 2. Artifact Display
- **ArtifactDrawer**: Lists all artifacts with switching capability
- **ArtifactWindow**: Shows selected artifact content
- **ArtifactControls**: Manage artifact list and clearing

#### 3. Database Integration
- **File Storage**: Uses multer for file uploads to `/uploads/` directory
- **Metadata**: JSON files stored alongside uploaded files
- **No Graph Persistence**: No database schema for graph data

### Current MCP Integration

#### Artifact Collection Process
```typescript
// Current: Collects artifacts from multiple sources
const artifactsToAdd = [];

// Handle bibliography
if ((processedHistory as any).bibliography) {
  artifactsToAdd.push({
    type: 'application/vnd.bibliography',
    title: 'Bibliography',
    content: (processedHistory as any).bibliography
  });
}

// Handle knowledge graph
if ((processedHistory as any).knowledgeGraph) {
  artifactsToAdd.push({
    type: 'application/vnd.knowledge-graph',
    title: 'Knowledge Graph',
    content: (processedHistory as any).knowledgeGraph
  });
}
```

## Graph Mode 2 Implementation Plan

### Phase 1: Database Schema & Backend

#### 1.1 Prisma Schema for Graph Data
```prisma
model GraphProject {
  id          String   @id @default(cuid())
  name        String
  description String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  // Graph data
  nodes       GraphNode[]
  edges       GraphEdge[]
  states      GraphState[]  // For history/undo
  
  // Project relationship
  projectId   String
  project     Project   @relation(fields: [projectId], references: [id])
}

model GraphNode {
  id        String   @id @default(cuid())
  label     String
  type      String
  data      Json     // Flexible node data
  position  Json     // x, y coordinates
  createdAt DateTime @default(now())
  
  graphId   String
  graph     GraphProject @relation(fields: [graphId], references: [id])
}

model GraphEdge {
  id        String   @id @default(cuid())
  source    String   // Node ID
  target    String   // Node ID
  label     String?
  type      String?
  data      Json?
  createdAt DateTime @default(now())
  
  graphId   String
  graph     GraphProject @relation(fields: [graphId], references: [id])
}

model GraphState {
  id          String   @id @default(cuid())
  snapshot    Json     // Complete graph state
  command     String   // Description of what created this state
  timestamp   DateTime @default(now())
  
  graphId     String
  graph       GraphProject @relation(fields: [graphId], references: [id])
}
```

#### 1.2 Graph-Specific API Routes
```typescript
// New routes for graph operations
POST   /api/graph/:projectId/nodes     // Add node
PUT    /api/graph/:projectId/nodes/:id // Update node
DELETE /api/graph/:projectId/nodes/:id // Remove node

POST   /api/graph/:projectId/edges     // Add edge
DELETE /api/graph/:projectId/edges/:id // Remove edge

POST   /api/graph/:projectId/state      // Save current state
GET    /api/graph/:projectId/history   // Get state history
POST   /api/graph/:projectId/undo      // Undo to previous state
```

### Phase 2: Frontend Graph Mode Implementation

#### 2.1 New Conversation Type
```typescript
// Add to ConversationMetadata interface
export interface ConversationMetadata {
  id: string;
  name: string;
  lastUpdated: Date;
  created: Date;
  messageCount: number;
  projectId?: string;
  mode?: 'normal' | 'graph_mode'; // NEW: Conversation-level mode
}

// Graph-specific conversation metadata
graphMetadata?: {
  currentNodeCount: number;
  currentEdgeCount: number;
  lastCommand?: string;
  canUndo: boolean;
  canRedo: boolean;
};
```

#### 2.2 Single Artifact Management
```typescript
// Modified artifact handling for Graph Mode
interface GraphModeState {
  // Single persistent artifact
  graphArtifact: Artifact | null;
  
  // Graph-specific state
  currentNodeCount: number;
  currentEdgeCount: number;
  history: GraphState[];
  currentHistoryIndex: number;
  
  // Operations
  updateGraph: (nodes: GraphNode[], edges: GraphEdge[]) => void;
  saveState: (command: string) => void;
  undo: () => void;
  redo: () => void;
}
```

#### 2.3 Graph Mode UI Components
- **GraphModeView**: Main interface for graph editing
- **GraphCanvas**: Interactive graph visualization
- **GraphControls**: Add/remove nodes and edges
- **HistoryPanel**: Undo/redo controls
- **NodeEditor**: Edit node properties
- **EdgeEditor**: Edit edge properties

### Phase 3: Graph-Specific MCPs

#### 3.1 Graph Operations MCP
```typescript
// New MCP for graph operations
interface GraphMCP {
  // Node operations
  addNode: (label: string, type: string, data?: any) => Promise<GraphNode>;
  updateNode: (id: string, updates: Partial<GraphNode>) => Promise<GraphNode>;
  removeNode: (id: string) => Promise<void>;
  
  // Edge operations
  addEdge: (source: string, target: string, label?: string) => Promise<GraphEdge>;
  removeEdge: (id: string) => Promise<void>;
  
  // Graph operations
  getGraph: () => Promise<{ nodes: GraphNode[], edges: GraphEdge[] }>;
  saveState: (command: string) => Promise<void>;
  undo: () => Promise<{ nodes: GraphNode[], edges: GraphEdge[] }>;
  redo: () => Promise<{ nodes: GraphNode[], edges: GraphEdge[] }>;
}
```

#### 3.2 Graph Analysis MCPs
- **Graph Analytics MCP**: Analyze graph structure, centrality, etc.
- **Graph Import MCP**: Import from various formats (CSV, JSON, etc.)
- **Graph Export MCP**: Export to various formats
- **Graph Visualization MCP**: Different layout algorithms

### Phase 4: Integration & Testing

#### 4.1 Conversation Mode Switching
- Add Graph Mode to conversation creation
- Update ConversationDrawer to support Graph Mode conversations
- Create GraphModeConversationList component

#### 4.2 Artifact Prevention
- Modify artifact collection to prevent new artifacts in Graph Mode conversations
- Ensure only graph updates are allowed
- Maintain single artifact state per conversation

#### 4.3 Database Migration
- Create Prisma schema
- Add migration scripts
- Update existing conversations to support graph mode

## Critical Data Flow Analysis

### Current MCP → Store Update Flow

#### 1. **MCP Execution Process**
```typescript
// Current flow: MCPs return new data → artifacts created → store updated
MCP Tool Call → New Artifact Created → ChatStore.addArtifact() → UI Updates
```

#### 2. **Store Update Mechanism**
```typescript
// Current: Each MCP call creates new artifacts
addArtifact: (artifact) => {
  const newArtifact = { ...artifact, timestamp: new Date() };
  set((state) => ({
    artifacts: [...state.artifacts, newArtifact],  // ADD to array
    selectedArtifactId: artifact.id,
    showArtifactWindow: true
  }));
}
```

#### 3. **Frontend Store Updates**
```typescript
// Current: Store updates via streaming responses
processMessage: async (content: string, attachments?: FileAttachment[]) => {
  // Stream processing updates store in real-time
  if (data.type === 'artifact') {
    const artifactId = get().addArtifact(data.artifact);
    // Store immediately updated, UI reflects changes
  }
}
```

### Graph Mode 2 Data Flow Requirements

#### **CRITICAL INSIGHT**: Graph Mode needs **UPDATE** not **CREATE**

```typescript
// Graph Mode: MCPs must UPDATE existing graph data
MCP Tool Call → Database Update → Store Refresh → UI Updates
```

#### **Key Differences**:
1. **Current**: MCPs create new artifacts → store adds to array
2. **Graph Mode**: MCPs modify existing graph → store updates single artifact
3. **Database**: Graph data persisted in Prisma → store syncs with DB
4. **State Management**: Full history/undo with database snapshots

## Implementation Challenges (REVISED)

### 1. **MCP Data Interaction Pattern**
**Challenge**: Current MCPs return new data, Graph Mode MCPs must interact with existing dataset.

**Current Pattern**:
```typescript
// MCP returns new artifact
return {
  content: [...],
  artifacts: [newArtifact]  // Creates new artifact
}
```

**Graph Mode Pattern Needed**:
```typescript
// MCP receives current graph, returns updated graph
return {
  content: [...],
  graphUpdate: {
    operation: 'addNode' | 'removeNode' | 'addEdge' | 'removeEdge',
    data: { ... },
    currentGraph: { nodes: [...], edges: [...] }
  }
}
```

**Solution**:
- **Pass current graph data to MCPs** as pinned artifacts
- **MCPs return update operations** not new artifacts
- **Backend processes updates** and saves to database
- **Store refreshes** with updated graph data

### 2. **Store Update Mechanism**
**Challenge**: Current store adds artifacts, Graph Mode must update single artifact.

**Current**:
```typescript
artifacts: [...state.artifacts, newArtifact]  // ADD to array
```

**Graph Mode Needed**:
```typescript
// Update single graph artifact
artifacts: state.artifacts.map(artifact => 
  artifact.id === graphArtifactId 
    ? { ...artifact, content: updatedGraphData }
    : artifact
)
```

**Solution**:
- **GraphModeStore** with single artifact management
- **Database sync** for graph data persistence
- **Update mechanism** for single artifact content
- **History tracking** for undo/redo

### 3. **Database Integration with Store Sync**
**Challenge**: Current system uses localStorage, Graph Mode needs database persistence with store sync.

**Current Flow**:
```
MCP → New Artifact → ChatStore → localStorage → UI
```

**Graph Mode Flow**:
```
MCP → Graph Update → Database → Store Refresh → UI
```

**Solution**:
- **Database operations** for graph CRUD
- **Store sync** with database changes
- **Real-time updates** when database changes
- **State persistence** with undo/redo

### 4. **MCP Integration with Existing Data**
**Challenge**: Current MCPs work with new data, Graph Mode MCPs must work with existing graph data.

**Current**: MCPs receive user input, return new artifacts
**Graph Mode**: MCPs receive current graph + user input, return graph updates

**Solution**:
- **Pass current graph** as pinned artifact to MCPs
- **MCPs designed** for graph operations (add/remove nodes/edges)
- **Update operations** instead of new artifact creation
- **Database persistence** for all changes

### 5. **UI/UX with Single Persistent Artifact**
**Challenge**: Current UI switches between artifacts, Graph Mode shows single persistent graph.

**Current**: ArtifactDrawer → ArtifactWindow → Multiple artifacts
**Graph Mode**: GraphCanvas → Single graph → Updates in place

**Solution**:
- **GraphModeView** with persistent graph display
- **Real-time updates** as graph changes
- **Interactive controls** for graph operations
- **History panel** for undo/redo

## Critical Clarifying Questions

### 1. **MCP Data Flow Architecture** ✅ DECIDED
**Decision**: Database context only (for undo/versioning support)

```typescript
// MCPs receive database context for all operations
const mcpResult = await mcpService.callTool(serverName, toolName, {
  ...args,
  databaseContext: {
    projectId,
    graphId,
    apiBaseUrl: process.env.API_BASE_URL,
    accessToken: "mcp-access-token"
  }
});
```

**Why Database Context Only:**
- **Undo/Redo Support**: Need to store complete graph states in database
- **Large Graph Support**: No localStorage size limitations
- **Version History**: Complete state snapshots for rollback
- **Real-time Updates**: Always get latest data from database
- **Scalability**: Works with any graph size

### 2. **Store Update Strategy** ✅ DECIDED
**Decision**: Separate GraphModeStore for cleaner separation

```typescript
// Separate store for graph mode operations
interface GraphModeStore {
  graphArtifact: Artifact | null;
  updateGraph: (newGraphData: any) => void;
  saveState: (command: string) => void;
  undo: () => void;  // Direct database operations, no MCP involvement
  redo: () => void;  // Direct database operations, no MCP involvement
}
```

### 3. **Database Sync Strategy**
**Question**: How should the store sync with database changes?

**Option A**: Polling-based sync
```typescript
// Poll database for changes
useEffect(() => {
  const interval = setInterval(() => {
    fetchGraphData(projectId).then(updateStore);
  }, 1000);
  return () => clearInterval(interval);
}, [projectId]);
```

**Option B**: Event-driven sync
```typescript
// Listen for database change events
useEffect(() => {
  const subscription = subscribeToGraphChanges(projectId, (newData) => {
    updateStore(newData);
  });
  return () => subscription.unsubscribe();
}, [projectId]);
```

**Recommendation**: Option A (polling) is simpler to implement initially.

### 4. **MCP Tool Design** ✅ DECIDED
**Decision**: Single comprehensive Graph MCP with multiple specialized tools

```typescript
// One MCP with multiple specialized tools
interface GraphMCP {
  // Node operations
  addNode: (label: string, type: string, data?: any) => Promise<GraphUpdate>;
  removeNode: (id: string) => Promise<GraphUpdate>;
  updateNode: (id: string, updates: Partial<GraphNode>) => Promise<GraphUpdate>;
  
  // Edge operations  
  addEdge: (source: string, target: string, label?: string) => Promise<GraphUpdate>;
  removeEdge: (id: string) => Promise<GraphUpdate>;
  updateEdge: (id: string, updates: Partial<GraphEdge>) => Promise<GraphUpdate>;
  
  // Analysis tools
  analyzeStructure: () => Promise<GraphAnalysis>;
  findCentrality: () => Promise<CentralityResults>;
  detectCommunities: () => Promise<CommunityResults>;
  
  // Import/Export tools
  importFromCSV: (data: string) => Promise<GraphUpdate>;
  importFromJSON: (data: any) => Promise<GraphUpdate>;
  exportToCSV: () => Promise<ExportResult>;
  exportToJSON: () => Promise<ExportResult>;
  
  // Visualization tools
  applyLayout: (algorithm: string) => Promise<GraphUpdate>;
  optimizeLayout: () => Promise<GraphUpdate>;
}
```

### 5. **Artifact Prevention Strategy**
**Question**: How to prevent new artifacts in Graph Mode?

**Option A**: Backend filtering
```typescript
// Backend detects graph mode and filters artifact creation
if (project.type === 'graph_mode') {
  // Only allow graph updates, block new artifacts
  if (response.artifacts && response.artifacts.length > 0) {
    throw new Error('New artifacts not allowed in Graph Mode');
  }
}
```

**Option B**: Frontend store override
```typescript
// Frontend store overrides artifact creation
addArtifact: (artifact) => {
  if (currentMode === 'graph_mode') {
    // Update existing graph artifact instead
    updateGraphArtifact(artifact.content);
    return;
  }
  // Normal artifact creation
}
```

**Recommendation**: Option A (backend filtering) provides stronger enforcement.

## Revised Implementation Plan

### Phase 1: Database & Backend Foundation
1. **Prisma Schema**: Implement graph data models
2. **Graph API Routes**: CRUD operations for graph data
3. **State Management**: Database snapshots for undo/redo
4. **MCP Integration**: Pass current graph as pinned artifact + database context

### Phase 2: Frontend Graph Mode Store
1. **GraphModeStore**: Separate store for graph operations
2. **Database Sync**: Polling mechanism for store updates
3. **Artifact Override**: Single artifact update mechanism
4. **History Management**: Undo/redo with direct database operations (no MCP involvement)

### Phase 3: Single Comprehensive Graph MCP
1. **Graph MCP with Multiple Tools**: One MCP with multiple specialized tools
2. **Reagraph Compatibility**: Use existing knowledge graph format for display
3. **Database Integration**: MCPs access database via API endpoints
4. **Tool Specialization**: Different tools for different graph operations
5. **Database Operations**: MCPs perform CRUD operations and state management

### Phase 4: UI Components
1. **GraphModeView**: Main graph editing interface
2. **GraphModeViewer**: New interactive graph visualization component (enhanced Reagraph)
3. **GraphControls**: Add/remove nodes and edges
4. **HistoryPanel**: Undo/redo controls (direct database operations)

### Phase 5: Integration & Testing
1. **Mode Switching**: Add Graph Mode to project types
2. **Artifact Prevention**: Block new artifacts in Graph Mode
3. **Database Migration**: Update existing projects
4. **End-to-End Testing**: Complete workflow testing

## All Architecture Decisions Complete! ✅

### **1. Database Sync Strategy** ✅ DECIDED
**Decision**: Event-driven synchronization

```typescript
// Event-driven sync for real-time updates
useEffect(() => {
  const subscription = subscribeToGraphChanges(projectId, (newData) => {
    updateStore(newData);
  });
  return () => subscription.unsubscribe();
}, [projectId]);
```

**Benefits**:
- **Real-time Updates**: Immediate synchronization when graph changes
- **Better Performance**: No unnecessary polling
- **Scalable**: Works well with multiple users
- **Responsive**: Users see changes instantly

### **2. Artifact Prevention Strategy** ✅ DECIDED
**Decision**: Frontend Suppression + MCP Filtering

```typescript
// Graph Mode: Frontend suppression in GraphModeStore
interface GraphModeStore {
  // Override artifact creation to update graph instead
  addArtifact: (artifact) => {
    if (currentMode === 'graph_mode') {
      // Update existing graph artifact instead of creating new one
      updateGraphArtifact(artifact.content);
      return;
    }
    // Normal artifact creation for other modes
    return originalAddArtifact(artifact);
  }
}

// Backend: Filter MCPs to only Graph MCP
if (project.type === 'graph_mode') {
  const allServers = mcpService.getServerNames();
  const blockedServers = allServers.filter(server => server !== 'graph-mcp');
}
```

**Benefits**:
- **Frontend Control**: GraphModeStore handles artifact suppression
- **MCP Filtering**: Only Graph MCP available in Graph Mode
- **Flexible**: Easy to modify suppression logic
- **Clean Separation**: Graph Mode logic contained in GraphModeStore

### **3. MCP Database Integration Requirements**

#### **3.1 Database API Endpoints for MCPs**
```typescript
// MCPs will need to interact with these database endpoints:

// Graph Data Operations
GET    /api/graph/:graphId                    // Get current graph state
POST   /api/graph/:graphId/nodes              // Create new node
PUT    /api/graph/:graphId/nodes/:nodeId      // Update node
DELETE /api/graph/:graphId/nodes/:nodeId      // Delete node

POST   /api/graph/:graphId/edges              // Create new edge
PUT    /api/graph/:graphId/edges/:edgeId     // Update edge
DELETE /api/graph/:graphId/edges/:edgeId     // Delete edge

// State Management for Undo/Redo
POST   /api/graph/:graphId/state              // Save current state
GET    /api/graph/:graphId/history            // Get state history
POST   /api/graph/:graphId/undo               // Undo to previous state
POST   /api/graph/:graphId/redo               // Redo to next state
```

#### **3.2 MCP Tool Implementation Pattern**
```typescript
// Example: addNode tool implementation
async function addNode(label: string, type: string, data?: any) {
  // 1. Get current graph state from database
  const currentGraph = await fetch(`${databaseContext.apiBaseUrl}/graph/${databaseContext.graphId}`);
  
  // 2. Validate input
  if (!label || !type) throw new Error('Label and type required');
  
  // 3. Create node in database
  const newNode = await fetch(`${databaseContext.apiBaseUrl}/graph/${databaseContext.graphId}/nodes`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${databaseContext.accessToken}` },
    body: JSON.stringify({ label, type, data })
  });
  
  // 4. Save state for undo/redo
  await fetch(`${databaseContext.apiBaseUrl}/graph/${databaseContext.graphId}/state`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${databaseContext.accessToken}` },
    body: JSON.stringify({ 
      command: 'addNode',
      description: `Added node "${label}"`
    })
  });
  
  // 5. Get updated graph
  const updatedGraph = await fetch(`${databaseContext.apiBaseUrl}/graph/${databaseContext.graphId}`);
  
  // 6. Return update operation
  return {
    content: `Added node "${label}" to the graph`,
    graphUpdate: {
      operation: 'addNode',
      nodeData: newNode,
      updatedGraph: updatedGraph
    }
  };
}
```

#### **3.3 MCP Authentication & Security**
```typescript
// MCPs need secure access to database
interface DatabaseContext {
  projectId: string;
  graphId: string;
  apiBaseUrl: string;
  accessToken: string;  // JWT token with limited permissions
  permissions: string[]; // ['read', 'write', 'state_management']
}

// Security considerations:
// - MCPs only access their assigned graph
// - Limited permissions (can't access other projects)
// - Token expiration and refresh
// - Rate limiting for database operations
```

#### **3.4 Error Handling in MCPs**
```typescript
// MCPs need robust error handling for database operations
async function addNode(label: string, type: string, data?: any) {
  try {
    // Database operations
    const result = await performDatabaseOperation();
    return { success: true, data: result };
  } catch (error) {
    // Handle different error types
    if (error.status === 401) {
      return { error: 'Authentication failed', retry: true };
    } else if (error.status === 404) {
      return { error: 'Graph not found', retry: false };
    } else if (error.status === 500) {
      return { error: 'Database error', retry: true };
    }
    return { error: 'Unknown error', retry: false };
  }
}
```

### **4. Graph Mode Artifact Window Viewer**

#### **4.1 New GraphModeViewer Component**
**Decision**: Create new component for Graph Mode (copy and enhance existing Reagraph viewer)

```typescript
// New GraphModeViewer component for interactive editing
export const GraphModeViewer: React.FC<{
  data: GraphData;
  onGraphChange: (newData: GraphData) => void;
  onNodeAdd: (node: GraphNode) => void;
  onNodeDelete: (nodeId: string) => void;
  onEdgeAdd: (edge: GraphEdge) => void;
  onEdgeDelete: (edgeId: string) => void;
  showControls?: boolean;
  showVersionControls?: boolean;
  realTimeUpdates?: boolean;
}> = ({ data, onGraphChange, ... }) => {
  // Enhanced Reagraph with Graph Mode functionality
};
```

#### **4.2 Component Architecture**
**Current System**:
```
ArtifactContent → ReagraphKnowledgeGraphViewer (viewing only)
```

**New Graph Mode System**:
```
ArtifactContent → GraphModeViewer (editing + viewing)
```

#### **4.3 Enhanced Features for Graph Mode**
```typescript
// Graph Mode specific functionality
<GraphModeViewer 
  data={graphData}
  onNodeAdd={handleNodeAdd}           // Interactive node creation
  onNodeDelete={handleNodeDelete}     // Interactive node deletion
  onEdgeAdd={handleEdgeAdd}           // Interactive edge creation
  onEdgeDelete={handleEdgeDelete}     // Interactive edge deletion
  onNodeEdit={handleNodeEdit}         // Edit node properties
  onLayoutChange={handleLayoutChange}  // Change layout algorithms
  showControls={true}                 // Editing toolbar
  showVersionControls={true}          // Undo/redo buttons
  showLayoutControls={true}           // Layout selection
  realTimeUpdates={true}              // Live database updates
/>
```

#### **4.4 Integration with Existing System**
```typescript
// Enhanced ArtifactContent for Graph Mode detection
case 'application/vnd.knowledge-graph':
  if (isGraphMode) {
    return <GraphModeViewer data={artifact.content} {...graphModeProps} />;
  } else {
    return <ReagraphKnowledgeGraphViewer data={artifact.content} />;
  }
```

#### **4.5 Graph Mode UI Layout**
```typescript
// Graph Mode artifact window layout
<div className="w-full h-full flex flex-col">
  {/* Graph Controls Toolbar */}
  <div className="flex items-center gap-2 p-2 border-b">
    <button onClick={addNode}>+ Node</button>
    <button onClick={addEdge}>+ Edge</button>
    <button onClick={undo}>Undo</button>
    <button onClick={redo}>Redo</button>
    <select onChange={changeLayout}>
      <option>Force Layout</option>
      <option>Hierarchical</option>
      <option>Circular</option>
    </select>
  </div>
  
  {/* Interactive Reagraph Visualization */}
  <div className="flex-1 overflow-hidden">
    <GraphModeViewer 
      data={graphData}
      onNodeClick={handleNodeClick}
      onEdgeClick={handleEdgeClick}
      onNodeAdd={handleNodeAdd}
      onEdgeAdd={handleEdgeAdd}
    />
  </div>
</div>
```

#### **4.6 Benefits of New Component**
- **Clean Separation**: Existing viewer unchanged for other use cases
- **Focused Development**: New component optimized for Graph Mode
- **Enhanced Features**: Interactive editing, real-time updates, version control
- **Future Flexibility**: Independent evolution of Graph Mode features
- **No Breaking Changes**: Existing knowledge graph viewing continues to work

### **5. Future Considerations** (To be addressed later)
- **Graph Compression**: How should we handle large graphs?
- **Graph Size Limits**: What's the maximum size graph you want to support?
- **Real-time Updates**: How real-time does the graph need to be?

## UI Entry Point: Graph Mode Button

### **Graph Mode Button in ConversationDrawer**
- **Location**: Add Graph Mode button under Grant Review button in `ConversationDrawer.tsx`
- **Icon**: Network/graph icon (e.g., `NetworkIcon` from Heroicons)
- **Functionality**: Create new Graph Mode project and navigate to it
- **Pattern**: Follow same pattern as Grant Review button creation

### **Button Implementation**
```tsx
// Add to collapsed view (icon-only)
<button
  onClick={() => {
    const { addProject } = useProjectStore.getState();
    const newProjectId = addProject({
      name: "New Graph Mode",
      description: "",
      type: 'graph_mode'
    });
    useProjectStore.getState().selectProject(newProjectId);
    setShowProjectView?.(true);
    setIsExpanded(false);
  }}
  className="p-2.5 rounded-full text-gray-400 hover:text-gray-900..."
  title="Graph Mode"
>
  <NetworkIcon className="w-6 h-6" />
</button>

// Add to expanded view (with text)
<button
  onClick={() => {
    // Same creation logic
  }}
  className="p-1.5 text-gray-600 hover:text-gray-900..."
  title="New Graph Mode"
>
  <span className="w-5 h-5 flex items-center justify-center bg-gray-200 rounded-full">
    <span className="text-sm font-semibold leading-none">+</span>
  </span>
</button>
```

## REVISED: Conversation-Level Graph Mode Implementation

### **📊 IMPLEMENTATION PROGRESS**

#### **✅ COMPLETED (8/8)**
1. **ConversationDrawer.tsx** - Graph Mode button with custom SVG icon ✅
2. **Database Schema** - Prisma schema with GraphProject, GraphNode, GraphEdge, GraphState models ✅
3. **ChatStore** - Updated ConversationMetadata interface with mode property ✅
4. **ConversationList.tsx** - Added Graph Mode visual indicators ✅
5. **ArtifactContent.tsx** - Added Graph Mode conversation detection ✅
6. **GraphModeViewer.tsx** - Created enhanced Reagraph component for Graph Mode ✅
7. **Database Service** - Updated to use conversationId instead of projectId ✅
8. **Auto Graph Artifact** - Automatically creates blank knowledge graph artifact ✅

#### **⏳ NEXT PRIORITIES**
- **MCP Integration** - Create Graph MCP with conversation integration
- **Undo/Redo Implementation** - Connect GraphModeViewer to database state management
- **Graph Data Refresh** - Update artifact content when database changes

### **🎯 LATEST SESSION COMPLETED**

#### **Database Schema Updates (Session Update)**
- **Updated Prisma Schema**: Changed `GraphProject` model to use `conversationId` instead of `projectId`
- **Updated Database Service**: Modified `GraphDatabaseService` methods to use `conversationId`
- **Updated Method Signatures**: Changed `createGraphProject()`, `getGraphProject()`, and `getCurrentGraphState()` to use conversation-based approach
- **Maintained Data Structure**: All existing models (GraphNode, GraphEdge, GraphState) remain the same
- **Database Relationships**: Graphs now properly linked to conversations instead of projects

#### **Key Changes Made:**
1. **Prisma Schema**: `GraphProject` model now uses `conversationId` and `conversationName` fields
2. **Database Service**: All methods updated to work with conversation IDs
3. **Data Flow**: MCPs will now receive `conversationId` instead of `projectId` for graph operations
4. **API Routes**: Ready for conversation-based graph endpoints

#### **Database Storage for Graph Mode Conversations:**
- **GraphProject**: Links to conversation with metadata (name, description, timestamps)
- **GraphNode**: Individual nodes with labels, types, positions, and flexible JSON data
- **GraphEdge**: Relationships between nodes with labels, types, and metadata
- **GraphState**: Complete snapshots for undo/redo functionality with command descriptions

### **🚀 API ENDPOINTS CREATED (Latest Session)**

#### **Graph API Routes (`/api/graph`)**
- **GET `/:conversationId/state`** - Get current graph state
- **POST `/:conversationId/nodes`** - Add a new node
- **POST `/:conversationId/edges`** - Add a new edge
- **DELETE `/:conversationId/nodes/:nodeId`** - Delete a node
- **DELETE `/:conversationId/edges/:edgeId`** - Delete an edge
- **POST `/:conversationId/mock-data`** - Add mock data for testing
- **GET `/:conversationId/history`** - Get graph state history

#### **Mock Data Functionality**
- **Test Data Button**: Added "Add Test Data" button to GraphModeViewer toolbar
- **Sample Data**: Creates 5 nodes (Gene A, Gene B, Protein X, Disease Y, Drug Z) with relationships
- **Database Integration**: Stores mock data in database with proper relationships
- **State Management**: Saves state for undo/redo functionality
- **User Feedback**: Shows success/error notifications

#### **Key Features Implemented:**
1. **Database Integration**: All endpoints use GraphDatabaseService
2. **Conversation-Based**: All operations use conversationId instead of projectId
3. **State Management**: Automatic state saving for undo/redo
4. **Error Handling**: Comprehensive error handling and logging
5. **Mock Data**: Ready-to-use test data for development and testing

### **Impact Analysis: Components That Need Updates**

#### **1. ConversationDrawer.tsx** ✅ COMPLETED
- **Current**: Creates new project with `type: 'graph_mode'`
- **New**: Should create new conversation with `mode: 'graph_mode'`
- **Impact**: Change button behavior to start conversation instead of project
- **Status**: ✅ **COMPLETED** - Graph Mode button added with custom SVG icon

#### **2. ChatStore (useChatStore)** ✅ COMPLETED
- **Current**: `ConversationMetadata` interface needs `mode` property
- **New**: Add `mode?: 'normal' | 'graph_mode'` to conversation metadata
- **Impact**: Update conversation creation, switching, and state management
- **Status**: ✅ **COMPLETED** - ConversationMetadata interface updated with mode property

#### **3. ConversationList.tsx** ✅ COMPLETED
- **Current**: Shows all conversations the same way
- **New**: Should show Graph Mode conversations differently (icon, styling)
- **Impact**: Add visual indicators for Graph Mode conversations
- **Status**: ✅ **COMPLETED** - Added Graph Mode visual indicators with purple styling

#### **4. ArtifactContent.tsx** ✅ COMPLETED
- **Current**: Renders artifacts based on type
- **New**: Should detect Graph Mode conversations and use GraphModeViewer
- **Impact**: Add conversation mode detection logic
- **Status**: ✅ **COMPLETED** - Added Graph Mode conversation detection and GraphModeViewer integration

#### **5. ChatInterface.tsx** ✅ COMPLETED
- **Current**: Orchestrates chat components
- **New**: Should handle Graph Mode conversation flow
- **Impact**: Add Graph Mode conversation detection and routing
- **Status**: ✅ **COMPLETED** - Added Graph Mode conversation handling and debugging logs

#### **6. Database Schema Updates** ✅ COMPLETED
- **Current**: Graph data linked to projects
- **New**: Graph data linked to conversations
- **Impact**: Update Prisma schema to use `conversationId` instead of `projectId`
- **Status**: ✅ **COMPLETED** - Prisma schema updated to use conversationId, database service updated

### **Implementation Plan: Conversation-Level Graph Mode**

#### **Phase 1: Update Conversation System**
1. **Update ConversationMetadata interface** - Add `mode` property
2. **Update ChatStore** - Add Graph Mode conversation creation
3. **Update ConversationDrawer** - Change button to create Graph Mode conversation
4. **Update ConversationList** - Show Graph Mode conversations differently

#### **Phase 2: Update Database Schema**
1. **Update Prisma schema** - Link graphs to conversations instead of projects
2. **Update API routes** - Change from `/api/graph/:projectId` to `/api/graph/:conversationId`
3. **Update database service** - Use conversationId for graph operations

#### **Phase 3: Update UI Components**
1. **Update ArtifactContent** - Detect Graph Mode conversations
2. **Create GraphModeViewer** - Enhanced Reagraph for Graph Mode
3. **Update ChatInterface** - Handle Graph Mode conversation flow

#### **Phase 4: MCP Integration**
1. **Update MCP context** - Pass conversationId instead of projectId
2. **Create Graph MCP** - Specialized MCP for Graph Mode conversations
3. **Update artifact prevention** - Block new artifacts in Graph Mode conversations

## Next Steps

1. **Update Conversation System**: Add mode property and Graph Mode conversation creation
2. **Update Database Schema**: Link graphs to conversations instead of projects  
3. **Update UI Components**: Detect and handle Graph Mode conversations
4. **Backend API**: Create graph-specific routes with conversationId
5. **MCP Development**: Create Graph MCP with conversation integration
6. **Frontend Store**: Build GraphModeStore with conversation-level sync
7. **UI Components**: Build GraphModeViewer component
8. **Integration**: Connect all components and test
9. **Documentation**: Update user guides and API docs

