# MediK MCP Data Flow

This document explains how data flows from the MediK MCP server to the frontend UI components that display knowledge graphs.

## 1. Server-side Data Processing (index.js)

### Request Handling

The MediK MCP server (built using the Model Context Protocol SDK) exposes three main tools:
- `run-query`: Executes a 1-hop query in mediKanren
- `get-everything`: Runs bidirectional queries (both X->Known and Known->X) for comprehensive relationships
- `network-neighborhood`: Finds network relationships between multiple genes/proteins

When a tool is called, the server processes the request in the `CallToolRequestSchema` handler:

```javascript
server.setRequestHandler(CallToolRequestSchema, async (request, extra) => {
  const toolName = request.params.name;
  const toolArgs = request.params.arguments || {};
  
  // Tool-specific processing...
});
```

### Data Fetching

Data is fetched from the MediKanren API using the `makeMediKanrenRequest` function:

```javascript
async function makeMediKanrenRequest(params, retryCount = 0) {
  const url = `${MEDIKANREN_API_BASE}/query`;
  // Constructs query parameters
  // Makes HTTP request
  // Returns JSON response or null on failure
}
```

For knowledge graphs, specific query functions are used:
- `runQuery`: For 1-hop queries
- `runBidirectionalQuery`: For combined X->Known and Known->X queries
- `runNetworkNeighborhoodQuery`: For finding relationships between multiple entities

### Data Formatting

Raw query results are formatted into knowledge graph structures using:
- `formatKnowledgeGraphArtifact`: For regular and bidirectional queries
- `formatNetworkNeighborhood`: For network neighborhood queries

These formatters transform the raw data into a graph structure with nodes and links, filtering out unwanted nodes (e.g., those with CAID prefix).

### Response Format

The server returns a structured response:

```javascript
{
  content: [
    {
      type: "text",
      text: "Description of the knowledge graph..."
    }
  ],
  artifacts: [
    {
      id: "unique-artifact-id",
      type: "application/vnd.knowledge-graph",
      title: "Knowledge Graph Title",
      content: JSON.stringify({
        nodes: [...],
        links: [...]
      })
    }
  ]
}
```

## 2. Client-side State Management

### Chat Store

The knowledge graph data is stored in the chat store, accessed via the `useChatStore` hook:

```javascript
const {
  artifacts,           // Array of all artifacts
  selectedArtifactId,  // Currently selected artifact
  setPinnedGraphId,    // Function to pin a graph
  pinnedGraphId,       // Currently pinned graph ID
  getGraphVersionHistory,  // Get version history of a graph
  getLatestGraphVersion,   // Get latest version of a graph
  selectArtifact       // Select an artifact for display
} = useChatStore();
```

The store maintains:
- A list of all artifacts across the chat
- Tracking of which artifact is currently selected
- Version history for knowledge graphs
- State for pinned graphs (graphs that should be sent with messages)

## 3. Component Rendering Flow

### ArtifactWindow.tsx

This component serves as a container for displaying artifacts:

```javascript
export const ArtifactWindow: React.FC<ArtifactWindowProps> = ({ storageService }) => {
  const { artifacts, selectedArtifactId } = useChatStore();
  const selectedArtifact = artifacts.find(a => a.id === selectedArtifactId);

  return (
    <div className="w-1/2 border-l border-gray-200 dark:border-gray-700 flex flex-col min-w-0">
      <div className="flex-1 flex min-h-0 min-w-0 bg-gray-200 dark:bg-gray-900">
        {selectedArtifact ? (
          <ArtifactContent artifact={selectedArtifact} storageService={storageService} />
        ) : (
          // "No artifact selected" message
        )}
      </div>
    </div>
  );
};
```

It:
1. Gets the list of artifacts and selected artifact ID from the chat store
2. Finds the selected artifact in the list
3. Passes the selected artifact to `ArtifactContent` for rendering

### ArtifactContent.tsx

This component renders artifacts based on their type:

```javascript
export const ArtifactContent: React.FC<{
  artifact: Artifact;
  storageService?: any;
}> = ({ artifact, storageService }) => {
  const [viewMode, setViewMode] = useState<'rendered' | 'source'>('rendered');
  const [useReagraph, setUseReagraph] = useState(true);
  
  // Check if this is a knowledge graph
  const isKnowledgeGraph = artifact.type === 'application/vnd.knowledge-graph' || 
                           artifact.type === 'application/vnd.ant.knowledge-graph';
  
  // Render content based on type and view mode
  // ...
}
```

For knowledge graphs:
- It provides a toggle between rendered view and source view
- In rendered view, it renders either `ReagraphKnowledgeGraphViewer` or `KnowledgeGraphViewer`
- In source view, it parses and pretty-prints the JSON content

```javascript
// Example of rendered view for knowledge graphs
return (
  <div className="w-full h-full min-h-[400px] flex flex-col">
    {useReagraph ? (
      <ReagraphKnowledgeGraphViewer data={artifact.content} artifactId={artifact.id} />
    ) : (
      <KnowledgeGraphViewer data={artifact.content} artifactId={artifact.id} showVersionControls={true} />
    )}
  </div>
);

// Example of source view for knowledge graphs
try {
  const jsonObj = typeof artifact.content === 'string' 
    ? JSON.parse(artifact.content) 
    : artifact.content;
  
  const prettyJson = JSON.stringify(jsonObj, null, 2);
  
  return (
    <SyntaxHighlighter language="json" style={oneLight}>
      {prettyJson}
    </SyntaxHighlighter>
  );
} catch (error) {
  console.error('Failed to parse knowledge graph JSON:', error);
}
```

### KnowledgeGraphViewer.tsx

This component renders the actual interactive graph visualization:

```javascript
export const KnowledgeGraphViewer: React.FC<KnowledgeGraphViewerProps> = ({
  data,  // Either JSON string or parsed object
  width = 800,
  height = 600,
  artifactId,  // For tracking the artifact
  showVersionControls = false
}) => {
  const [graphData, setGraphData] = useState<KnowledgeGraphData | null>(null);
  const { setPinnedGraphId, pinnedGraphId } = useChatStore();
  const isPinned = artifactId ? pinnedGraphId === artifactId : false;

  // Parse the data if it's a string
  useEffect(() => {
    try {
      if (typeof data === 'string') {
        setGraphData(JSON.parse(data));
      } else {
        setGraphData(data);
      }
    } catch (err) {
      console.error('Failed to parse knowledge graph data:', err);
      setError('Failed to parse knowledge graph data.');
    }
  }, [data]);

  // Render the graph using react-force-graph-2d
  return (
    <div className="flex flex-col w-full h-full">
      {/* Version controls and pin button */}
      <div ref={containerRef} className="w-full h-full min-h-[400px]">
        <ForceGraph2D
          graphData={graphData}
          nodeLabel="name"
          nodeColor={(node) => node.color || colorByGroup(node)}
          nodeVal={(node) => node.val || 1}
          linkLabel="label"
          linkColor={(link) => link.color || '#999'}
          linkWidth={(link) => link.value || 1}
          width={dimensions.width}
          height={dimensions.height}
          onNodeClick={(node) => {
            console.log('Node clicked:', node);
            // Additional click behavior
          }}
        />
      </div>
      <button
        onClick={() => {
          if (artifactId) {
            setPinnedGraphId(isPinned ? null : artifactId);
          }
        }}
        className={`p-2 rounded-full ${
          isPinned 
            ? 'bg-blue-100 text-blue-600 hover:bg-blue-200 dark:bg-blue-900 dark:text-blue-300' 
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300'
        }`}
        title={isPinned ? "Unpin graph (stop sending with messages)" : "Pin graph (send with messages)"}
      >
        {isPinned ? <PinOff size={18} /> : <Pin size={18} />}
      </button>
    </div>
  );
};
```

Key features:
- Parses JSON data if needed
- Provides version navigation if `showVersionControls` is true
- Allows pinning/unpinning graphs
- Renders an interactive force-directed graph using `ForceGraph2D`
- Customizes node and link appearance based on properties in the data

## 4. Data Structure

### Knowledge Graph JSON Structure

```json
{
  "nodes": [
    {
      "id": "unique-node-id",
      "name": "Display Name",
      "group": 1,         // Used for coloring
      "val": 2,           // Size factor
      "color": "#ff0000", // Optional explicit color
      "metadata": {       // Additional properties
        "curie": "MONDO:0011719",
        "category": "disease",
        "url": "https://example.com/entity/MONDO:0011719"
      }
    }
  ],
  "links": [
    {
      "source": "source-node-id",
      "target": "target-node-id",
      "label": "treats",
      "value": 1,         // Line width
      "color": "#999999"  // Optional explicit color
    }
  ]
}
```

## 5. Complete Data Flow

1. **Request**: Client sends a request to the MediK MCP server for a knowledge graph
2. **Processing**: Server fetches data from MediKanren API, formats it, and returns artifacts
3. **Storage**: Artifacts are stored in the chat store
4. **Selection**: User selects an artifact, which updates `selectedArtifactId` in the store
5. **Container**: `ArtifactWindow` gets the selected artifact from the store
6. **Type Detection**: `ArtifactContent` determines the artifact is a knowledge graph
7. **Visualization**: `KnowledgeGraphViewer` parses the data and renders the interactive graph
8. **Interaction**: User can interact with the graph, pin it, and navigate between versions

## 6. Additional Features

### Pinning Graphs

Graphs can be "pinned" using the `setPinnedGraphId` function:
- A pinned graph is included with future messages
- The UI indicates which graph is currently pinned
- Only one graph can be pinned at a time

#### Pinning Mechanism Details

When a user clicks the pin icon in the knowledge graph viewer:

1. **UI Interaction**: 
   ```javascript
   // In KnowledgeGraphViewer.tsx
   <button
     onClick={() => {
       if (artifactId) {
         setPinnedGraphId(isPinned ? null : artifactId);
       }
     }}
     className={`p-2 rounded-full ${
       isPinned 
         ? 'bg-blue-100 text-blue-600 hover:bg-blue-200 dark:bg-blue-900 dark:text-blue-300' 
         : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300'
     }`}
     title={isPinned ? "Unpin graph (stop sending with messages)" : "Pin graph (send with messages)"}
   >
     {isPinned ? <PinOff size={18} /> : <Pin size={18} />}
   </button>
   ```

2. **State Management**:
   In `chatStore.ts`, the pinned graph ID is stored in the state:
   ```javascript
   // In chatStore.ts state definition
   pinnedGraphId: string | null;
   
   // Function to update pinned graph
   setPinnedGraphId: (id: string | null) => {
     console.log('ChatStore: Setting pinned graph ID to', id);
     set({ pinnedGraphId: id });
   }
   ```

3. **Message Processing**:
   When sending a message, the pinned graph is retrieved and included:
   ```javascript
   // In processMessage function of chatStore.ts
   // Get pinned graph if available
   const pinnedGraphId = get().pinnedGraphId;
   let pinnedGraph = null;
   
   if (pinnedGraphId) {
     const pinnedArtifact = get().artifacts.find(a => a.id === pinnedGraphId);
     if (pinnedArtifact) {
       console.log('ChatStore: Including pinned graph in message:', pinnedGraphId);
       pinnedGraph = pinnedArtifact;
     }
   }
   
   // Include pinned graph in API request
   const response = await fetch(apiUrl, {
     method: 'POST',
     body: JSON.stringify({
       message: content,
       history: messageHistory,
       blockedServers: useMCPStore.getState().getBlockedServers(),
       pinnedGraph: pinnedGraph
     })
   });
   ```

4. **Server-side Processing**:
   In the server route (`chat.ts`), the pinned graph is processed:
   ```javascript
   // If there's a pinned graph, add it to the context
   if (pinnedGraph) {
     sendStatusUpdate('Processing pinned knowledge graph...');
     console.log('\n=== PINNED GRAPH DETECTED ===');
     console.log('Graph ID:', pinnedGraph.id);
     console.log('Graph Title:', pinnedGraph.title);
     
     // Add an assistant message about the pinned graph
     messages.push({
       role: 'assistant',
       content: `I notice you've pinned a knowledge graph titled "${pinnedGraph.title}". I'll reference this graph in my responses.`
     });
     
     // Parse and store the pinned graph
     try {
       const graphContent = typeof pinnedGraph.content === 'string' 
         ? JSON.parse(pinnedGraph.content) 
         : pinnedGraph.content;
       
       if (isValidKnowledgeGraph(graphContent)) {
         console.log(`Pinned knowledge graph contains ${graphContent.nodes.length} nodes and ${graphContent.links.length} links`);
         (messages as any).knowledgeGraph = graphContent;
         console.log('Stored pinned knowledge graph for merging with future graphs');
       } else {
         console.error('Invalid knowledge graph structure in pinned graph');
       }
     } catch (error) {
       console.error('Error processing pinned knowledge graph:', error);
     }
   }
   ```

5. **Graph Merging**:
   If new knowledge graph data is generated during the conversation, it's merged with the pinned graph:
   ```javascript
   // Check if knowledge graph exists and merge if it does
   if ((messages as any).knowledgeGraph) {
     console.log('Merging with existing knowledge graph...');
     
     // Merge the knowledge graphs
     const currentGraph = (messages as any).knowledgeGraph as KnowledgeGraph;
     const mergedGraph = mergeKnowledgeGraphs(currentGraph, newGraph);
     
     // Update the merged graph
     (messages as any).knowledgeGraph = mergedGraph;
     
     console.log(`Merged graph now contains ${mergedGraph.nodes.length} nodes and ${mergedGraph.links.length} links`);
   } else {
     // First knowledge graph, just set it
     console.log('Setting initial knowledge graph');
     (messages as any).knowledgeGraph = newGraph;
   }
   ```

This system allows for:
- Persistent context across multiple messages
- Progressive building of knowledge graphs by merging new information
- Seamless integration with the AI assistant, which receives information about the pinned graph
- Visual indication to the user about which graph is currently pinned

### Version Control

The chat store tracks version history for knowledge graphs:
- Each query creates a new version of the graph
- Functions like `getGraphVersionHistory` and `getLatestGraphVersion` enable navigation
- The UI provides controls to move between versions 