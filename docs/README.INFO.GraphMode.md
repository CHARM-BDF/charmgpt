# Graph Mode - Complete Reference Guide

## 🎯 **Overview**

Graph Mode is a specialized conversation mode in the charm-mcp system designed for building and managing interactive knowledge graphs. It fundamentally changes the system architecture from a multi-artifact, static display model to a single-artifact, interactive, database-backed model.

## 🏗️ **Core Architecture Principles**

### **1. Single Artifact Per Conversation**
- **One Artifact Rule**: Each graph mode conversation has exactly **one artifact** (the knowledge graph)
- **Same ID Strategy**: The artifact ID is the same as the conversation ID (not different UUIDs)
- **No New Artifacts**: Graph mode MCPs never create new artifacts, only update the existing one
- **Database Persistence**: Graph data is stored in the database using the conversation ID as the key

### **2. Database Context Pattern**
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

### **3. Undo/Redo = Database Snapshots**
- NOT new artifacts
- `GraphState` table stores JSON snapshots
- Artifact ID stays the same, content updates

## 🔍 **Graph Mode Detection**

### **Backend Detection Logic**
```typescript
// Location: backend-mcp-client/src/services/chat/index.ts
private async checkIfGraphModeConversation(conversationId?: string, maxRetries = 3): Promise<boolean> {
  if (!conversationId) return false;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Check if graph project exists for this conversation
      const graphProject = await this.graphDb?.getGraphProject(conversationId);
      if (graphProject) {
        return true;
      }
      return false;
    } catch (error) {
      // Retry logic with exponential backoff
    }
  }
}
```

### **Frontend Detection Logic**
```typescript
// Location: frontend-client/src/components/artifacts/ArtifactContent.tsx
const currentConversationId = useChatStore(state => state.currentConversationId);
const conversations = useChatStore(state => state.conversations);
const currentConversation = currentConversationId ? conversations[currentConversationId] : null;
const isGraphModeConversation = currentConversation?.metadata.mode === 'graph_mode';
```

### **Detection Methods (in order of preference)**
1. **Conversation Metadata Check** (Primary): `conversation.metadata.mode === 'graph_mode'`
2. **Graph Project Existence Check** (Fallback): Check if `GraphProject` exists for conversation ID
3. **Frontend Store Check** (Alternative): Check conversation store for mode

## 📝 **System Prompt Differences**

### **Graph Mode System Prompt** (`graphModeSystemPrompt.ts`)
**Key Features:**
- **Interactive Button Preservation**: Extensive instructions for preserving interactive buttons with special protocols like `graphnode:add:`
- **Mandatory Tool Usage**: Enforces specific tool usage for node searches (must use `addNodeByName` tool)
- **Special Markers**: Recognizes `INTERACTIVE_BUTTONS_START/END` and `NODE_SEARCH_RESULTS` markers
- **Content Preservation**: Emphasizes preserving exact markdown link syntax for interactive elements

### **Normal Mode System Prompt** (`normalModeSystemPrompt.ts`)
**Key Features:**
- **Standard Tool Usage**: No special tool requirements
- **General Content Handling**: Standard markdown processing
- **No Interactive Elements**: No special handling for interactive buttons

### **Critical Differences**
```typescript
// Graph Mode: Must preserve interactive buttons exactly
CRITICAL: When displaying node search results with interactive buttons, you MUST preserve the exact markdown link syntax returned by the tool. DO NOT paraphrase, reformat, or summarize these responses.

// Example of what MUST be preserved:
[🔘 Add Type 2 Diabetes](graphnode:add:MONDO:0005148:Type%202%20Diabetes:Disease) - **MONDO:0005148**
   Type: Disease | Score: 0.95
```

## 🎨 **Display and UI Changes**

### **Graph Mode Viewer** (`GraphModeViewer.tsx`)
**Enhanced Features:**
- **Edit Mode**: Interactive editing capabilities for nodes and edges
- **Auto-refresh**: Automatically refreshes graph data from the database
- **Version Controls**: Undo/redo functionality with database snapshots
- **Interactive Forms**: Add node/edge forms for direct graph manipulation
- **Real-time Updates**: Live updates when graph data changes
- **State Management**: Edit mode, selected nodes/edges, form visibility

### **Regular Knowledge Graph Viewer** (`ReagraphKnowledgeGraphViewer.tsx`)
**Standard Features:**
- **Read-only**: Static display of knowledge graphs
- **Version History**: Basic version navigation
- **Filtering**: Entity type and node name filtering
- **Standard Controls**: Pin, version navigation, basic interactions

### **Rendering Logic**
```typescript
// Location: frontend-client/src/components/artifacts/ArtifactContent.tsx
case 'application/vnd.knowledge-graph':
case 'application/vnd.ant.knowledge-graph':
  // Check if this is a Graph Mode conversation
  if (isGraphModeConversation) {
    return (
      <GraphModeViewer
        data={displayContent}
        width={800}
        height={600}
        artifactId={artifact.id}
        showVersionControls={true}
        clusterNodes={clusterNodes}
        collapseNodes={collapseNodes}
      />
    );
  }
  
  // Regular knowledge graph viewer
  return (
    <div className="w-full h-full min-h-[400px] flex flex-col">
      {useReagraph ? (
        <ReagraphKnowledgeGraphViewer data={displayContent} artifactId={artifact.id} />
      ) : (
        <KnowledgeGraphViewer data={displayContent} artifactId={artifact.id} showVersionControls={true} />
      )}
    </div>
  );
```

## 🔧 **Artifact Behavior Changes**

### **Single Artifact Strategy**
```typescript
// Location: frontend-client/src/store/chatStore.ts
startNewGraphModeConversation: async (name?: string) => {
  const conversationId = crypto.randomUUID();
  
  // Initialize GraphProject in database immediately
  const response = await fetch(`/api/graph/${conversationId}/init`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: defaultName,
      description: 'Graph Mode conversation'
    })
  });
  
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
}
```

### **Artifact Update Pattern**
- **Update in Place**: Graph mode MCPs update the existing artifact content
- **No New Artifacts**: Prevents creation of additional artifacts during graph building
- **Database Sync**: Changes are immediately synced to the database
- **Version History**: Database snapshots provide undo/redo functionality

## 🤖 **LLM Behavior Changes**

### **Tool Execution Differences**
- **Interactive Elements**: Graph mode LLM must preserve interactive buttons exactly as returned by tools
- **Mandatory Tool Usage**: Must use specific tools for node searches instead of providing general information
- **Content Formatting**: Special handling for `graphnode:add:` protocol links
- **Response Structure**: Same JSON structure but with enhanced content preservation rules

### **System Prompt Selection**
```typescript
// Location: backend-mcp-client/src/services/chat/index.ts
// Check if this is a Graph Mode conversation
const isGraphMode = await this.checkIfGraphModeConversation(this.currentConversationId);
console.log(`🔍 [FORMATTER-PROMPT] Conversation ${this.currentConversationId} is Graph Mode: ${isGraphMode}`);

// Use appropriate base prompt based on conversation mode
const basePrompt = isGraphMode ? graphModeSystemPrompt : normalModeSystemPrompt;
console.log(`🔍 [FORMATTER-PROMPT] Using ${isGraphMode ? 'graph' : 'normal'} mode system prompt`);
```

### **Interactive Button Handling**
```typescript
// Location: frontend-client/src/components/chat/AssistantMarkdown.tsx
// Fallback: Convert LLM-emitted <button> rows into graphnode:add links
const processContent = (rawContent: string): string => {
  let transformed = rawContent;

  // Convert patterns like
  //   <button>🔘 Add NAME</button> - <strong>CURIE</strong>\n   Type: TYPE | Score: ...
  // into markdown link: [🔘 Add NAME](graphnode:add:CURIE:NAME:TYPE) - **CURIE**\n   Type: TYPE | Score: ...
  transformed = transformed.replace(
    /<button[^>]*>\s*🔘\s*Add\s*([^<]+?)\s*<\/button>\s*-\s*<strong>([^<]+)<\/strong>([\s\S]*?Type:\s*([^|\n]+))/gi,
    (_m, name, curie, tail, type) => {
      const encCurie = encodeURIComponent(curie.trim());
      const encName = encodeURIComponent(String(name).trim());
      const encType = encodeURIComponent(String(type).trim());
      return `<a href="graphnode:add:${encCurie}:${encName}:${encType}">🔘 Add ${name}</a> - <strong>${curie}</strong>${tail}`;
    }
  );
}
```

## 🗄️ **Database Integration**

### **Graph Mode Database Pattern**
- **Database Context**: MCPs receive database context instead of direct graph data
- **Real-time Queries**: MCPs query the database for fresh graph information
- **State Snapshots**: Undo/redo functionality uses database snapshots, not new artifacts
- **Conversation ID Key**: All graph data is keyed by conversation ID, not artifact ID

### **Node Data Structure Format**

#### **Database Schema (Prisma)**
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

#### **TypeScript Interface**
```typescript
interface GraphModeNode {
  id: string;                    // REQUIRED: Unique identifier (e.g., "NCBIGene:3727")
  label: string;                 // REQUIRED: Display name (e.g., "JUND")
  type: string;                  // REQUIRED: Node type (e.g., "Gene", "Disease")
  data: {                        // REQUIRED: Additional metadata
    categories?: string[];       // Biolink categories (e.g., ["biolink:Gene"])
    originalId?: string;         // Original source ID
    source?: string;             // Data source (e.g., "translator", "pubtator")
    [key: string]: any;          // Additional custom properties
  };
  position: { x: number; y: number }; // REQUIRED: Coordinates for layout
}
```

#### **Complete Example**
```typescript
{
  id: "NCBIGene:3727",           // REQUIRED: Unique identifier
  label: "JUND",                 // REQUIRED: Display name
  type: "Gene",                  // REQUIRED: Node type (without biolink: prefix)
  data: {                        // REQUIRED: Additional metadata
    categories: ["biolink:Gene"],
    originalId: "NCBIGene:3727",
    source: "id-finder-mcp",
    description: "JunD proto-oncogene",
    synonyms: ["JUND_HUMAN"]
  },
  position: { x: 100, y: 200 }   // REQUIRED: Layout coordinates
}
```

#### **Critical Requirements**
1. **`id` field is REQUIRED** - Must be at top level of data object
2. **`graphId` is auto-injected** - Don't include in your node data (backend adds this)
3. **Composite primary key** - Uses `id` + `graphId` combination
4. **Field order matters** - `id` must come first in the data object
5. **All fields are required** - `id`, `label`, `type`, `data`, `position`

#### **Common Node Types**
- **Gene**: `"Gene"` (e.g., JUND, FOS, PON1)
- **Disease**: `"Disease"` (e.g., Type 2 Diabetes)
- **Drug**: `"Drug"` (e.g., Aspirin)
- **Protein**: `"Protein"` (e.g., JUND protein)
- **Pathway**: `"Pathway"` (e.g., MAPK signaling)

#### **Data Object Properties**
The `data` object can contain any additional metadata:
- `categories`: Array of biolink categories
- `originalId`: Original identifier from source
- `source`: MCP or data source identifier
- `description`: Human-readable description
- `synonyms`: Alternative names
- `publications`: Related publication IDs
- Custom properties specific to your use case

#### **Common Database Errors**
- **"Argument `id` is missing"** → Add `id` field to node data
- **"Invalid `prisma.graphNode.create()` invocation"** → Check field structure
- **"Unique constraint failed"** → Node with same `id` + `graphId` already exists

### **Edge Data Structure Format**

#### **Database Schema (Prisma)**
```prisma
model GraphEdge {
  id        String   // REQUIRED: Unique identifier (composite)
  source    String   // REQUIRED: Source node ID
  target    String   // REQUIRED: Target node ID
  label     String   // REQUIRED: Relationship type
  data      Json     // REQUIRED: Additional metadata
  createdAt DateTime @default(now())
  graphId   String   // REQUIRED: Conversation/graph ID
  
  @@unique([id, graphId])  // Composite unique constraint
  @@id([id, graphId])      // Composite primary key
}
```

#### **TypeScript Interface**
```typescript
interface GraphModeEdge {
  id: string;                    // REQUIRED: Composite identifier for deduplication
  source: string;                // REQUIRED: Source node ID
  target: string;                // REQUIRED: Target node ID
  label: string;                 // REQUIRED: Relationship type (e.g., "related_to", "causes")
  data: {                        // REQUIRED: Additional metadata
    source: string;              // REQUIRED: MCP identifier (e.g., "translator", "pubtator")
    primary_source: string;      // REQUIRED: Knowledge source identifier
    publications: string[];      // REQUIRED: Array of publication IDs (can be empty)
    phrase?: string;             // Human-readable relationship description
    qualifiers?: any[];          // Biolink qualifiers
    [key: string]: any;          // Additional custom properties
  };
}
```

#### **Complete Example**
```typescript
{
  id: "graphId|translator|arax|NCBIGene:3727|related_to|MONDO:0005148",
  source: "NCBIGene:3727",      // JUND gene
  target: "MONDO:0005148",       // Type 2 Diabetes
  label: "related_to",
  data: {
    source: "translator",
    primary_source: "arax",
    publications: ["PMID:12345678", "PMID:87654321"],
    phrase: "JUND gene is related to Type 2 Diabetes",
    qualified_predicate: "causes",
    object_direction_qualifier: "increased",
    object_aspect_qualifier: "abundance"
  }
}
```

#### **Edge Deduplication Requirements**
All Graph Mode MCPs must populate edge metadata fields that enable automatic deduplication:

**Required Edge Data Fields:**
- `source`: MCP identifier (e.g., "translator", "pubtator")
- `primary_source`: Knowledge source identifier
- `publications`: Array of publication IDs (can be empty)

**Composite ID Generation:**
```typescript
// Format: graphId|data.source|primary_source|source|label|target
const compositeId = [
  graphId,
  dataSource,
  primarySource,
  source,
  label,
  target
].join('|');
```

### **API Endpoints**
```
/api/graph/{conversationId}/state     - Get current graph state
/api/graph/{conversationId}/init      - Initialize graph project
/api/graph/{conversationId}/update    - Update graph data
/api/graph/{conversationId}/history   - Get version history
```

### **Database Schema**
```sql
-- GraphProject table
CREATE TABLE GraphProject (
  id TEXT PRIMARY KEY,
  conversationId TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- GraphState table (for undo/redo)
CREATE TABLE GraphState (
  id TEXT PRIMARY KEY,
  conversationId TEXT NOT NULL,
  stateData JSON NOT NULL,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (conversationId) REFERENCES GraphProject(conversationId)
);
```

## 🎛️ **Frontend State Management**

### **Graph Mode Conversation Creation**
```typescript
// Location: frontend-client/src/store/chatStore.ts
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
      throw new Error('Failed to initialize graph project');
    }
  } catch (error) {
    throw new Error('Failed to initialize Graph Mode. Please try again.');
  }
  
  // Create conversation with graph mode metadata
  set(state => ({
    conversations: {
      ...state.conversations,
      [conversationId]: {
        metadata: {
          id: conversationId,
          name: defaultName,
          created: new Date(),
          lastUpdated: new Date(),
          messageCount: 0,
          mode: 'graph_mode' // Set Graph Mode
        },
        messages: [welcomeMessage],
        artifacts: [graphArtifact] // Start with blank graph artifact
      }
    },
    currentConversationId: conversationId,
    artifacts: [graphArtifact],
    messages: [welcomeMessage],
    selectedArtifactId: graphArtifact.id,
    showArtifactWindow: true, // Show the artifact window immediately
    inProjectConversationFlow: false,
    activeCompletionId: null,
    blockedServers: []
  }));
}
```

### **Conversation Metadata Structure**
```typescript
interface ConversationMetadata {
  id: string;
  name: string;
  lastUpdated: Date;
  created: Date;
  messageCount: number;
  projectId?: string; // Optional - not all conversations belong to projects
  mode?: 'normal' | 'graph_mode'; // Optional - conversation mode for Graph Mode
}
```

## 🔄 **Data Flow Architecture**

### **Current MCP → Store Update Flow**
```typescript
// Current flow: MCPs return new data → artifacts created → store updated
MCP Tool Call → New Artifact Created → ChatStore.addArtifact() → UI Updates
```

### **Graph Mode Data Flow**
```typescript
// Graph Mode: MCPs must UPDATE existing graph data
MCP Tool Call → Database Update → Store Refresh → UI Updates
```

### **Key Differences**
1. **Current**: MCPs create new artifacts → store adds to array
2. **Graph Mode**: MCPs modify existing graph → store updates single artifact

## 🛠️ **MCP Integration**

### **Graph Mode MCPs**
- **graphmodeBaseMCP**: Core graph operations (add/remove nodes/edges)
- **graphmodeTranslator**: Translator API integration
- **graphmodeBTEMCP**: Biomedical text extraction
- **graphmodeAraxMCP**: ARAX integration

### **MCP Configuration**
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

### **Database Context Injection**
```typescript
// MCPs receive database context automatically
{
  conversationId: "f2d8d99e-...",  // Required - the conversation ID (database key)
  apiBaseUrl: "http://localhost:3001",
  accessToken: "token"
}
```

## 🚀 **Key Benefits of Graph Mode**

### **1. Persistent Knowledge Graphs**
- Database-backed storage ensures data persistence
- Real-time collaboration capabilities
- Version history and undo/redo functionality

### **2. Interactive Graph Building**
- Direct node/edge manipulation
- Interactive search and discovery
- Real-time graph updates

### **3. Specialized MCPs**
- Graph-specific tools and operations
- Database context for fresh data
- Optimized for knowledge graph workflows

### **4. Enhanced User Experience**
- Single artifact focus (no artifact switching)
- Immediate visual feedback
- Streamlined graph building workflow

## 🔧 **Implementation Checklist**

### **Backend Requirements**
- [ ] Graph Mode conversation detection
- [ ] Database schema for graph storage
- [ ] API endpoints for graph operations
- [ ] MCP service integration
- [ ] System prompt switching logic

### **Frontend Requirements**
- [ ] Graph Mode conversation creation
- [ ] GraphModeViewer component
- [ ] Interactive button handling
- [ ] Database context injection
- [ ] State management updates

### **MCP Requirements**
- [ ] Graph Mode MCP servers
- [ ] Database context handling
- [ ] Interactive element generation
- [ ] Graph data processing

## 📚 **Related Files**

### **Backend Files**
- `backend-mcp-client/src/services/chat/graphModeSystemPrompt.ts`
- `backend-mcp-client/src/services/chat/normalModeSystemPrompt.ts`
- `backend-mcp-client/src/services/chat/index.ts` (detection logic)
- `backend-mcp-client/prisma/schema.prisma` (database schema)

### **Frontend Files**
- `frontend-client/src/components/artifacts/GraphModeViewer.tsx`
- `frontend-client/src/components/artifacts/ArtifactContent.tsx` (rendering logic)
- `frontend-client/src/components/chat/AssistantMarkdown.tsx` (button handling)
- `frontend-client/src/store/chatStore.ts` (state management)

### **MCP Files**
- `custom-mcp-servers/graphModeMCPs/graphmodeBaseMCP/`
- `custom-mcp-servers/graphModeMCPs/graphmodeTranslator/`
- `custom-mcp-servers/graphModeMCPs/graphmodeBTEMCP/`

### **Documentation Files**
- `custom-mcp-servers/graphModeMCPs/README.INFO.graphMode.MCP.md`
- `docs/cursor-plans/README.PLAN.Graphmode2.md`
- `docs/cursor-plans/README.PLAN.GraphMode.MCPs.md`

## 🎯 **Future Considerations**

### **Potential Enhancements**
- Multi-user collaboration
- Graph export/import functionality
- Advanced layout algorithms
- Real-time synchronization
- Graph analytics and insights

### **Performance Optimizations**
- Lazy loading for large graphs
- Efficient database queries
- Caching strategies
- Memory management

### **Integration Opportunities**
- External graph databases
- API integrations
- Visualization libraries
- Export formats

---

**Last Updated**: 2025-01-26
**Version**: 1.0
**Status**: Production Ready
