# Knowledge Graph Visualization in Charm MCP

This document provides an overview of the knowledge graph visualization implementation in Charm MCP, including both the original Force Graph implementation and the new Reagraph implementation.

## Table of Contents

1. [Overview](#overview)
2. [Components](#components)
3. [Data Structure](#data-structure)
4. [Graph Visualization Libraries](#graph-visualization-libraries)
5. [Versioning System](#versioning-system)
6. [Graph Commands](#graph-commands)
7. [Usage Examples](#usage-examples)
8. [Integration Points](#integration-points)
9. [Troubleshooting](#troubleshooting)

## Overview

The knowledge graph visualization system allows displaying, manipulating, and interacting with graph data within the Charm MCP application. It supports two different rendering engines:

1. **Force Graph** - Using the `react-force-graph-2d` library
2. **Reagraph** - Using the `reagraph` library which is WebGL-based for better performance

Both implementations support the same data format and provide similar functionality, with Reagraph offering better performance for larger graphs.

## Components

### Main Components

1. **KnowledgeGraphViewer** (`src/components/artifacts/KnowledgeGraphViewer.tsx`)
   - Renders graphs using the Force Graph library
   - Supports version controls and graph navigation
   - Handles data parsing and container resizing

2. **ReagraphKnowledgeGraphViewer** (`src/components/artifacts/ReagraphKnowledgeGraphViewer.tsx`)
   - Renders graphs using the Reagraph library
   - Supports the same features as KnowledgeGraphViewer
   - Provides better performance for larger graphs

3. **ArtifactContent** (`src/components/artifacts/ArtifactContent.tsx`)
   - Integrates graph viewers into the artifact display system
   - Provides UI controls for toggling between viewers and manipulating graphs
   - Handles artifact content parsing and rendering

### Testing Components

1. **KnowledgeGraphTest** (`src/components/artifacts/KnowledgeGraphTest.tsx`)
   - Provides a test environment for both graph viewers
   - Displays sample graphs side by side
   - Allows toggling between Force Graph and Reagraph

2. **GraphTest** (`src/pages/GraphTest.tsx`)
   - Test page for graph versioning and commands
   - Displays artifact metadata and version information
   - Integrates with the test button component

3. **KnowledgeGraphTestButton** (`src/components/artifacts/KnowledgeGraphTestButton.tsx`)
   - Creates test graphs and runs test commands
   - Demonstrates graph command functionality

## Data Structure

Knowledge graphs use a consistent data format across both visualization libraries:

```typescript
interface KnowledgeGraphData {
  nodes: KnowledgeGraphNode[];
  links: KnowledgeGraphLink[];
  metadata?: {
    version?: number;
    previousVersion?: string;
    commandHistory?: Array<{
      command: string;
      params: Record<string, any>;
      timestamp: string;
    }>;
  };
}

interface KnowledgeGraphNode {
  id: string;
  name: string;
  group?: number;
  val?: number;
  color?: string;
  [key: string]: any; // Additional properties
}

interface KnowledgeGraphLink {
  source: string;
  target: string;
  label?: string;
  value?: number;
  color?: string;
  [key: string]: any; // Additional properties
}
```

### Key Properties

- **Nodes**:
  - `id`: Unique identifier (required)
  - `name`: Display name (required)
  - `group`: Used for coloring nodes by category
  - `val`: Controls node size
  - `color`: Custom node color

- **Links**:
  - `source`: ID of source node (required)
  - `target`: ID of target node (required)
  - `label`: Relationship label
  - `value`: Controls link thickness
  - `color`: Custom link color

## Graph Visualization Libraries

### Force Graph

- Based on `react-force-graph-2d`
- Uses D3's force-directed layout
- Renders to HTML Canvas
- Good for small to medium graphs

```jsx
<KnowledgeGraphViewer 
  data={graphData} 
  artifactId={artifactId}
  showVersionControls={true}
/>
```

### Reagraph

- Based on `reagraph`
- Uses WebGL for rendering
- Better performance for large graphs
- More modern visual appearance

```jsx
<ReagraphKnowledgeGraphViewer 
  data={graphData} 
  artifactId={artifactId}
  showVersionControls={true}
/>
```

## Versioning System

The knowledge graph system supports versioning, allowing changes to be tracked over time:

1. Each graph modification creates a new artifact
2. Artifacts maintain references to previous and next versions
3. Version controls allow navigation through the history
4. Command history is stored in the graph metadata

### Version Controls

The version controls UI provides:
- Version number indicator
- Previous/Next navigation buttons
- Jump to latest version button

## Graph Commands

The system supports several commands for manipulating graphs:

### 1. Group By Property

Groups nodes based on a specified property, assigning colors by group.

```javascript
const { handleGraphCommand } = useMCPStore.getState();
handleGraphCommand({
  type: 'groupByProperty',
  targetGraphId: artifactId,
  params: { propertyName: 'type' }
});
```

### 2. Highlight Nodes

Highlights specific nodes with a custom color.

```javascript
handleGraphCommand({
  type: 'highlightNodes',
  targetGraphId: artifactId,
  params: { 
    nodeIds: ['node1', 'node2'],
    color: '#ff0000'
  }
});
```

### 3. Filter Nodes

Filters nodes based on a property value.

```javascript
handleGraphCommand({
  type: 'filterNodes',
  targetGraphId: artifactId,
  params: { 
    predicate: 'type',
    value: 'person'
  }
});
```

### 4. Reset View

Resets the graph to its original state.

```javascript
handleGraphCommand({
  type: 'resetView',
  targetGraphId: artifactId,
  params: {}
});
```

## Usage Examples

### Creating a New Graph

```javascript
const { addArtifact, selectArtifact } = useChatStore.getState();

// Create a new graph artifact
const artifactId = addArtifact({
  id: crypto.randomUUID(),
  artifactId: crypto.randomUUID(),
  type: 'application/vnd.ant.knowledge-graph',
  title: 'My Knowledge Graph',
  content: JSON.stringify({
    nodes: [
      { id: 'node1', name: 'Node 1', type: 'person', age: 30 },
      { id: 'node2', name: 'Node 2', type: 'person', age: 25 },
      { id: 'node3', name: 'Node 3', type: 'company', age: null },
      { id: 'node4', name: 'Node 4', type: 'company', age: null },
      { id: 'node5', name: 'Node 5', type: 'location', age: null },
    ],
    links: [
      { source: 'node1', target: 'node2', label: 'knows' },
      { source: 'node1', target: 'node3', label: 'works_at' },
      { source: 'node2', target: 'node4', label: 'works_at' },
      { source: 'node3', target: 'node5', label: 'located_in' },
      { source: 'node4', target: 'node5', label: 'located_in' },
    ]
  }),
  position: 0,
  versionNumber: 1
});

// Select the artifact to display it
selectArtifact(artifactId);
```

### Toggling Between Graph Viewers

```jsx
const [useReagraph, setUseReagraph] = useState(true);

// In your render function:
{useReagraph ? (
  <div className="w-full h-full overflow-hidden">
    <ReagraphKnowledgeGraphViewer 
      data={artifact.content} 
      artifactId={artifact.id}
    />
  </div>
) : (
  <KnowledgeGraphViewer 
    data={artifact.content} 
    artifactId={artifact.id}
    showVersionControls={true}
  />
)}
```

### Navigating Version History

```javascript
const { getGraphVersionHistory, selectArtifact } = useChatStore.getState();

// Get all versions of a graph
const versions = getGraphVersionHistory(artifactId);

// Navigate to a specific version
selectArtifact(versions[index].id);

// Get the latest version
const { getLatestGraphVersion } = useChatStore.getState();
const latestVersion = getLatestGraphVersion(artifactId);
selectArtifact(latestVersion.id);
```

## Integration Points

### 1. ArtifactContent Component

The `ArtifactContent` component integrates graph visualization by:
- Detecting knowledge graph artifact types
- Providing UI controls for graph manipulation
- Toggling between Force Graph and Reagraph viewers

### 2. Chat Store

The chat store manages graph artifacts and provides functions for:
- Creating and updating graph artifacts
- Tracking version history
- Selecting artifacts for display

### 3. MCP Store

The MCP store handles graph commands through:
- The `handleGraphCommand` function
- Command processing and application
- Version creation and management

## Troubleshooting

### Common Issues

1. **Graph overflows container**
   - Ensure the container has `overflow: hidden` set
   - Wrap the graph component in a div with proper sizing constraints
   - Example: `<div className="w-full h-full overflow-hidden">`

2. **Performance issues with large graphs**
   - Switch to Reagraph for better performance
   - Consider filtering or paginating large datasets
   - Optimize node and link properties

3. **Version controls not appearing**
   - Ensure `showVersionControls={true}` is set
   - Verify the artifact has a valid ID
   - Check that the artifact is properly registered in the chat store

4. **Graph commands not working**
   - Verify the correct artifact ID is being used
   - Check command parameters for correctness
   - Ensure the MCP store is properly initialized

### Debugging Tips

- Use browser developer tools to inspect the graph container
- Check console for errors related to graph rendering
- Verify data structure matches the expected format
- Test with simple graphs before using complex data

## Future Enhancements

Potential improvements to consider:

1. **Advanced Layouts**
   - Add support for hierarchical layouts
   - Implement radial layouts for certain graph types
   - Support custom layout algorithms

2. **Interactive Features**
   - Add node editing capabilities
   - Support for adding/removing nodes and links
   - Implement graph search functionality

3. **Performance Optimizations**
   - Implement node clustering for large graphs
   - Add level-of-detail rendering
   - Support for WebWorkers to offload layout calculations

4. **Integration with AI**
   - Allow natural language commands for graph manipulation
   - Implement automatic graph analysis
   - Support for AI-generated graph suggestions 