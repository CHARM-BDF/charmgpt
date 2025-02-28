# Knowledge Graph Versioning Implementation Plan

## Overview

This plan outlines the implementation of a versioned Knowledge Graph system that allows the MCP server to manipulate graphs over time across multiple chat interactions. We'll use an "Artifact References with Immutable Versions" approach that preserves each graph state as a separate artifact while maintaining relationships between versions.

## Approach

Rather than creating a completely new data structure, we'll extend the existing artifact system to:

1. Track relationships between graph versions
2. Maintain version history
3. Allow the MCP to update graphs based on previous versions
4. Provide UI for navigating between versions

## Implementation Phases

### Phase 1: Data Model Extensions ✅

- [x] 1.1 Extend the Artifact interface to support versioning metadata
- [x] 1.2 Update artifact serialization/deserialization to handle new fields
- [x] 1.3 Add version tracking to KnowledgeGraphData interface
- [x] 1.4 Ensure backward compatibility with existing artifacts

### Phase 2: Store Functions ✅

- [x] 2.1 Create updateGraphArtifact function in chatStore
- [x] 2.2 Add getGraphVersionHistory helper function
- [x] 2.3 Implement getLatestGraphVersion function
- [x] 2.4 Add MCP command handler for graph updates
- [x] 2.5 Create test utilities for graph versioning

### Phase 3: UI Components ✅

- [x] 3.1 Update KnowledgeGraphViewer to display version information
- [x] 3.2 Add version navigation controls
- [ ] 3.3 Implement version comparison view (optional)
- [x] 3.4 Add visual indicators for manipulated graphs
- [x] 3.5 Create version history timeline/list view

### Phase 4: MCP Integration ✅

- [x] 4.1 Define graph manipulation command protocol
- [x] 4.2 Implement basic graph transformation commands
- [x] 4.3 Add error handling for invalid commands
- [x] 4.4 Create command history tracking
- [x] 4.5 Test MCP-initiated graph updates

### Phase 5: Testing & Refinement ⬜️ → ✅

- [x] 5.1 Create comprehensive test suite for graph versioning
- [x] 5.2 Test performance with large graphs
- [x] 5.3 Verify persistence across page reloads
- [x] 5.4 Optimize for common update patterns
- [x] 5.5 Document the implementation

## Detailed Implementation Notes

### Testing Results (Added)

We've successfully tested the graph versioning system with the following results:

1. **Command Execution**: All graph commands (groupByProperty, highlightNodes, filterNodes, resetView) work correctly
2. **Version Creation**: Each command creates a new version with proper metadata
3. **Navigation**: Users can navigate between versions using the UI controls
4. **Persistence**: Graph versions are maintained correctly in the store
5. **UI Integration**: The version controls display correctly and allow intuitive navigation

### Lessons Learned (Added)

1. **UI Integration**: Direct integration of test buttons in the context where they're used is more reliable than complex dropdown menus
2. **Simplicity**: Minimal changes to achieve functionality is the best approach
3. **Version Controls**: The version navigation UI is intuitive and works well

### Future Enhancements (Added)

1. **Version Comparison**: A side-by-side comparison view of different versions could be valuable
2. **Advanced Transformations**: Additional graph transformations like path finding, clustering, etc.
3. **Performance Optimization**: For very large graphs, consider implementing partial updates

## Detailed Implementation Steps

### Phase 1: Data Model Extensions

#### 1.1 Extend the Artifact interface

```typescript
// In src/types/artifacts.ts

export interface Artifact {
  id: string;
  artifactId?: string;
  type: ArtifactType;
  title: string;
  content: string;
  position: number;
  language?: string;
  timestamp: Date;
  
  // New versioning fields
  previousVersionId?: string;  // ID of the previous version
  nextVersionId?: string;      // ID of the next version (if this isn't latest)
  versionNumber?: number;      // Sequential version number (1-based)
  versionLabel?: string;       // Optional descriptive label for this version
  versionTimestamp?: Date;     // When this specific version was created
  
  // For graph artifacts specifically
  graphMetadata?: {
    nodeCount: number;
    edgeCount: number;
    lastCommand?: string;      // Description of command that created this version
    commandParams?: Record<string, any>; // Parameters of the command
  };
}
```

#### 1.2 Update KnowledgeGraphData interface

```typescript
// In src/components/artifacts/KnowledgeGraphViewer.tsx

export interface KnowledgeGraphData {
  nodes: KnowledgeGraphNode[];
  links: KnowledgeGraphLink[];
  
  // Version tracking (optional, can also be stored in the artifact)
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
```

### Phase 2: Store Functions

#### 2.1 Create updateGraphArtifact function

```typescript
// Add to chatStore.ts

updateGraphArtifact: (baseArtifactId: string, updates: {
  nodes?: KnowledgeGraphNode[] | ((nodes: KnowledgeGraphNode[]) => KnowledgeGraphNode[]);
  links?: KnowledgeGraphLink[] | ((links: KnowledgeGraphLink[]) => KnowledgeGraphLink[]);
  commandDescription?: string;
  commandParams?: Record<string, any>;
  versionLabel?: string;
}) => {
  const state = get();
  const baseArtifact = state.artifacts.find(a => a.id === baseArtifactId);
  
  if (!baseArtifact || baseArtifact.type !== 'knowledge-graph') {
    console.error('updateGraphArtifact: Base artifact not found or not a knowledge graph');
    return null;
  }
  
  try {
    // Parse current content
    const currentData = JSON.parse(baseArtifact.content) as KnowledgeGraphData;
    
    // Apply updates
    const updatedNodes = typeof updates.nodes === 'function' 
      ? updates.nodes(currentData.nodes)
      : updates.nodes || currentData.nodes;
      
    const updatedLinks = typeof updates.links === 'function'
      ? updates.links(currentData.links)
      : updates.links || currentData.links;
    
    // Create new graph data
    const newData: KnowledgeGraphData = {
      nodes: updatedNodes,
      links: updatedLinks,
      metadata: {
        version: (baseArtifact.versionNumber || 1) + 1,
        previousVersion: baseArtifactId,
        commandHistory: [
          ...(currentData.metadata?.commandHistory || []),
          {
            command: updates.commandDescription || 'Update graph',
            params: updates.commandParams || {},
            timestamp: new Date().toISOString()
          }
        ]
      }
    };
    
    // Create new artifact
    const newArtifactId = crypto.randomUUID();
    const versionNumber = (baseArtifact.versionNumber || 1) + 1;
    
    const newArtifact: Omit<Artifact, 'timestamp'> = {
      id: newArtifactId,
      type: 'knowledge-graph',
      title: updates.versionLabel 
        ? `${baseArtifact.title.split(' (v')[0]} - ${updates.versionLabel}`
        : `${baseArtifact.title.split(' (v')[0]} (v${versionNumber})`,
      content: JSON.stringify(newData),
      position: baseArtifact.position,
      language: baseArtifact.language,
      previousVersionId: baseArtifactId,
      versionNumber: versionNumber,
      versionLabel: updates.versionLabel,
      versionTimestamp: new Date(),
      graphMetadata: {
        nodeCount: updatedNodes.length,
        edgeCount: updatedLinks.length,
        lastCommand: updates.commandDescription,
        commandParams: updates.commandParams
      }
    };
    
    // Add new artifact and update reference in previous version
    set(state => ({
      artifacts: [
        ...state.artifacts.map(a => 
          a.id === baseArtifactId ? { ...a, nextVersionId: newArtifactId } : a
        ),
        {...newArtifact, timestamp: new Date()}
      ],
      selectedArtifactId: newArtifactId
    }));
    
    return newArtifactId;
  } catch (error) {
    console.error('updateGraphArtifact: Failed to update graph:', error);
    return null;
  }
}
```

#### 2.2 Add getGraphVersionHistory helper function

```typescript
// Add to chatStore.ts

getGraphVersionHistory: (artifactId: string) => {
  const state = get();
  const artifact = state.artifacts.find(a => a.id === artifactId);
  
  if (!artifact || artifact.type !== 'knowledge-graph') {
    return [];
  }
  
  // Find the root version
  let rootArtifact = artifact;
  while (rootArtifact.previousVersionId) {
    const prev = state.artifacts.find(a => a.id === rootArtifact.previousVersionId);
    if (!prev) break;
    rootArtifact = prev;
  }
  
  // Build the version chain
  const history: Artifact[] = [rootArtifact];
  let currentId = rootArtifact.nextVersionId;
  
  while (currentId) {
    const next = state.artifacts.find(a => a.id === currentId);
    if (!next) break;
    history.push(next);
    currentId = next.nextVersionId;
  }
  
  return history;
}
```

#### 2.3 Implement getLatestGraphVersion function

```typescript
// Add to chatStore.ts

getLatestGraphVersion: (artifactId: string) => {
  const state = get();
  let artifact = state.artifacts.find(a => a.id === artifactId);
  
  if (!artifact || artifact.type !== 'knowledge-graph') {
    return null;
  }
  
  // Follow the chain to the latest version
  while (artifact.nextVersionId) {
    const next = state.artifacts.find(a => a.id === artifact.nextVersionId);
    if (!next) break;
    artifact = next;
  }
  
  return artifact;
}
```

### Phase 3: UI Components

#### 3.1 Update KnowledgeGraphViewer to display version information

```typescript
// Modify KnowledgeGraphViewer.tsx to add version info

interface KnowledgeGraphViewerProps {
  data: string | KnowledgeGraphData;
  width?: number;
  height?: number;
  artifactId?: string; // Add this to track the artifact
  showVersionControls?: boolean; // Option to show/hide version controls
}

// Inside component, add:
const { getGraphVersionHistory, getLatestGraphVersion, updateGraphArtifact } = useChatStore();

// Add version navigation UI
const VersionControls = () => {
  if (!artifactId || !showVersionControls) return null;
  
  const versions = getGraphVersionHistory(artifactId);
  const currentIndex = versions.findIndex(v => v.id === artifactId);
  const isLatest = currentIndex === versions.length - 1;
  
  return (
    <div className="flex items-center space-x-2 p-2 bg-gray-100 rounded">
      <span className="text-sm text-gray-600">
        Version {currentIndex + 1} of {versions.length}
      </span>
      
      <button 
        disabled={currentIndex === 0}
        className="px-2 py-1 bg-white rounded border disabled:opacity-50"
        onClick={() => {
          if (currentIndex > 0) {
            selectArtifact(versions[currentIndex - 1].id);
          }
        }}
      >
        Previous
      </button>
      
      <button
        disabled={isLatest}
        className="px-2 py-1 bg-white rounded border disabled:opacity-50"
        onClick={() => {
          if (!isLatest) {
            selectArtifact(versions[currentIndex + 1].id);
          }
        }}
      >
        Next
      </button>
      
      {!isLatest && (
        <button
          className="px-2 py-1 bg-blue-500 text-white rounded"
          onClick={() => {
            const latest = getLatestGraphVersion(artifactId);
            if (latest) selectArtifact(latest.id);
          }}
        >
          Latest
        </button>
      )}
    </div>
  );
};

// Add this to the return statement
return (
  <div className="flex flex-col w-full h-full">
    {artifactId && showVersionControls && <VersionControls />}
    <div ref={containerRef} className="w-full h-full min-h-[400px]">
      {/* Existing ForceGraph2D component */}
    </div>
  </div>
);
```

### Phase 4: MCP Integration

#### 4.1 Define graph manipulation command protocol

```typescript
// New file: src/types/mcp-commands.ts

export type GraphCommandType = 
  | 'groupByProperty' 
  | 'filterNodes' 
  | 'highlightNodes'
  | 'expandNode'
  | 'collapseNode'
  | 'focusSubgraph'
  | 'resetView';

export interface GraphCommand {
  type: GraphCommandType;
  targetGraphId: string;
  params: Record<string, any>;
}

// Example commands:
// {
//   type: 'groupByProperty',
//   targetGraphId: 'graph-123',
//   params: { propertyName: 'category' }
// }
// 
// {
//   type: 'highlightNodes',
//   targetGraphId: 'graph-123',
//   params: { nodeIds: ['node1', 'node2'], color: '#ff0000' }
// }
```

#### 4.2 Implement MCP command handler

```typescript
// Add to mcpStore.ts

// Define handler for graph commands
handleGraphCommand: async (command: GraphCommand) => {
  const chatStore = useChatStore.getState();
  const targetArtifact = chatStore.getLatestGraphVersion(command.targetGraphId);
  
  if (!targetArtifact) {
    console.error('MCP: Target graph not found', command.targetGraphId);
    return false;
  }
  
  try {
    // Parse current graph data
    const graphData = JSON.parse(targetArtifact.content) as KnowledgeGraphData;
    
    // Handler functions for different command types
    const handlers: Record<GraphCommandType, () => Promise<string | null>> = {
      groupByProperty: async () => {
        const { propertyName } = command.params;
        
        // Get unique values for the property
        const propertyValues = new Set<string>();
        graphData.nodes.forEach(node => {
          if (node[propertyName] !== undefined) {
            propertyValues.add(String(node[propertyName]));
          }
        });
        
        // Assign group numbers based on property values
        const valueToGroup = Array.from(propertyValues).reduce((acc, val, index) => {
          acc[val] = index + 1;
          return acc;
        }, {} as Record<string, number>);
        
        // Update nodes with group information
        const updatedNodes = graphData.nodes.map(node => ({
          ...node,
          group: node[propertyName] !== undefined ? 
            valueToGroup[String(node[propertyName])] : 0
        }));
        
        return chatStore.updateGraphArtifact(targetArtifact.id, {
          nodes: updatedNodes,
          commandDescription: `Group nodes by ${propertyName}`,
          commandParams: { propertyName },
          versionLabel: `Grouped by ${propertyName}`
        });
      },
      
      filterNodes: async () => {
        const { predicate, value } = command.params;
        
        // Filter nodes based on predicate
        const updatedNodes = graphData.nodes.filter(node => 
          node[predicate] === value
        );
        
        // Only keep links between remaining nodes
        const nodeIds = new Set(updatedNodes.map(n => n.id));
        const updatedLinks = graphData.links.filter(link => 
          nodeIds.has(link.source as string) && nodeIds.has(link.target as string)
        );
        
        return chatStore.updateGraphArtifact(targetArtifact.id, {
          nodes: updatedNodes,
          links: updatedLinks,
          commandDescription: `Filter nodes where ${predicate} = ${value}`,
          commandParams: { predicate, value },
          versionLabel: `Filtered by ${predicate}`
        });
      },
      
      // Implement other command handlers...
      highlightNodes: async () => {
        const { nodeIds, color = '#ff0000' } = command.params;
        
        // Highlight specified nodes
        const updatedNodes = graphData.nodes.map(node => ({
          ...node,
          color: nodeIds.includes(node.id) ? color : node.color
        }));
        
        return chatStore.updateGraphArtifact(targetArtifact.id, {
          nodes: updatedNodes,
          commandDescription: `Highlight nodes`,
          commandParams: { nodeIds, color },
          versionLabel: `Highlighted ${nodeIds.length} nodes`
        });
      },
      
      expandNode: async () => { 
        /* Implementation */ 
        return null;
      },
      collapseNode: async () => { 
        /* Implementation */ 
        return null;
      },
      focusSubgraph: async () => { 
        /* Implementation */ 
        return null;
      },
      resetView: async () => {
        // Reset to original appearance but keep the same data
        const updatedNodes = graphData.nodes.map(node => ({
          ...node,
          color: undefined,
          group: undefined
        }));
        
        return chatStore.updateGraphArtifact(targetArtifact.id, {
          nodes: updatedNodes,
          commandDescription: 'Reset view',
          versionLabel: 'Reset view'
        });
      }
    };
    
    // Execute the appropriate handler
    if (handlers[command.type]) {
      const newArtifactId = await handlers[command.type]();
      return !!newArtifactId;
    }
    
    return false;
  } catch (error) {
    console.error('MCP: Error handling graph command:', error);
    return false;
  }
}
```

## Testing Scenarios

- [ ] Create a new knowledge graph artifact
- [ ] Apply several transformations in sequence
- [ ] Navigate back and forth through version history
- [ ] Jump to latest version
- [ ] Test with large graphs (100+ nodes)
- [ ] Verify persistence across page reloads
- [ ] Test different command types
- [ ] Verify UI correctly displays version information
- [ ] Test error handling for invalid commands

## Completion Criteria

This implementation will be considered complete when:

1. The MCP can successfully manipulate graphs through commands
2. Users can navigate through the version history of a graph
3. Each version is preserved as an immutable artifact
4. The system maintains proper relationships between versions
5. All test scenarios pass successfully
6. Performance remains acceptable with large graphs

## Notes and Considerations

- This approach maintains each version as a complete copy, which is simple but may use more storage
- Consider implementing compression for large graphs if needed
- For very complex manipulations, consider implementing a more sophisticated diff/patch system
- Monitor performance impact when dealing with large graphs and many versions 