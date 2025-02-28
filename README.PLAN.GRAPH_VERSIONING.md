# Knowledge Graph Versioning Implementation Plan

## Overview

This plan outlines the implementation of a versioned Knowledge Graph system that allows the MCP server to manipulate graphs over time across multiple chat interactions. We use an "Artifact References with Immutable Versions" approach that preserves each graph state as a separate artifact while maintaining relationships between versions.

## Approach

Rather than creating a completely new data structure, we've extended the existing artifact system to:

1. Track relationships between graph versions
2. Maintain version history
3. Allow the MCP to update graphs based on previous versions
4. Provide UI for navigating between versions

## Implementation Status

All core functionality has been successfully implemented and tested. The system is now operational and can be used for knowledge graph versioning and manipulation.

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

### Phase 5: Testing & Refinement ✅

- [x] 5.1 Create comprehensive test suite for graph versioning
- [x] 5.2 Test performance with large graphs
- [x] 5.3 Verify persistence across page reloads
- [x] 5.4 Optimize for common update patterns
- [x] 5.5 Document the implementation

## Usage Guide

### Creating a Knowledge Graph

To create a new knowledge graph:

```typescript
const { addArtifact, selectArtifact } = useChatStore.getState();

// Create a new graph artifact
const artifactId = addArtifact({
  id: crypto.randomUUID(),
  artifactId: crypto.randomUUID(),
  type: 'application/vnd.ant.knowledge-graph',
  title: 'My Knowledge Graph',
  content: JSON.stringify({
    nodes: [
      // Define your nodes here
      { id: 'node1', name: 'Node 1', type: 'person' },
      { id: 'node2', name: 'Node 2', type: 'company' },
    ],
    links: [
      // Define your links here
      { source: 'node1', target: 'node2', label: 'works_at' },
    ]
  }),
  position: 0,
  versionNumber: 1
});

// Select the artifact to display it
selectArtifact(artifactId);
```

### Applying Graph Transformations

To apply transformations to a graph:

```typescript
const { handleGraphCommand } = useMCPStore.getState();

// Group nodes by a property
await handleGraphCommand({
  type: 'groupByProperty',
  targetGraphId: artifactId,
  params: { propertyName: 'type' }
});

// Highlight specific nodes
await handleGraphCommand({
  type: 'highlightNodes',
  targetGraphId: artifactId,
  params: { 
    nodeIds: ['node1', 'node2'],
    color: '#ff0000'
  }
});

// Filter nodes by a property
await handleGraphCommand({
  type: 'filterNodes',
  targetGraphId: artifactId,
  params: { 
    predicate: 'type',
    value: 'person'
  }
});

// Reset view to original state
await handleGraphCommand({
  type: 'resetView',
  targetGraphId: artifactId,
  params: {}
});
```

### Navigating Version History

The version history navigation is handled automatically by the `KnowledgeGraphViewer` component when the `showVersionControls` prop is set to `true`:

```typescript
<KnowledgeGraphViewer 
  data={artifact.content} 
  artifactId={artifact.id}
  showVersionControls={true}
/>
```

Programmatically, you can navigate versions using:

```typescript
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

## API Documentation

### Store Functions

#### `updateGraphArtifact`

Creates a new version of a knowledge graph with specified updates.

```typescript
function updateGraphArtifact(
  baseArtifactId: string, 
  updates: {
    nodes?: KnowledgeGraphNode[] | ((nodes: KnowledgeGraphNode[]) => KnowledgeGraphNode[]);
    links?: KnowledgeGraphLink[] | ((links: KnowledgeGraphLink[]) => KnowledgeGraphLink[]);
    commandDescription?: string;
    commandParams?: Record<string, any>;
    versionLabel?: string;
  }
): string | null
```

**Parameters:**
- `baseArtifactId`: ID of the graph to update
- `updates`: Object containing updates to apply
  - `nodes`: New nodes array or function to transform existing nodes
  - `links`: New links array or function to transform existing links
  - `commandDescription`: Description of the update (for history)
  - `commandParams`: Parameters used for the update
  - `versionLabel`: Optional label for this version

**Returns:** ID of the new artifact version, or null if update failed

#### `getGraphVersionHistory`

Retrieves the version history of a knowledge graph.

```typescript
function getGraphVersionHistory(artifactId: string): Artifact[]
```

**Parameters:**
- `artifactId`: ID of any version of the graph

**Returns:** Array of artifacts representing the version history, ordered from oldest to newest

#### `getLatestGraphVersion`

Gets the latest version of a knowledge graph.

```typescript
function getLatestGraphVersion(artifactId: string): Artifact | null
```

**Parameters:**
- `artifactId`: ID of any version of the graph

**Returns:** The latest version artifact, or null if not found

### MCP Commands

#### `handleGraphCommand`

Processes a graph manipulation command.

```typescript
function handleGraphCommand(command: GraphCommand): Promise<boolean>
```

**Parameters:**
- `command`: The command to execute
  - `type`: Command type (e.g., 'groupByProperty', 'highlightNodes')
  - `targetGraphId`: ID of the graph to manipulate
  - `params`: Command-specific parameters

**Returns:** Promise resolving to true if successful, false otherwise

### Supported Command Types

1. **groupByProperty**
   - Groups nodes by a specified property
   - Params: `{ propertyName: string }`

2. **highlightNodes**
   - Highlights specific nodes with a color
   - Params: `{ nodeIds: string[], color?: string }`

3. **filterNodes**
   - Filters nodes based on a property value
   - Params: `{ predicate: string, value: any }`

4. **resetView**
   - Resets node styling to default
   - Params: `{}`

## MCP Server Integration

### Overview

This section outlines how to implement knowledge graph manipulation through the MCP server instead of direct button interactions. This approach allows users to request graph operations using natural language, which is then processed by Claude and executed through the MCP server.

### Architecture

The flow for MCP-based graph manipulation is as follows:

1. **User sends a message** to the server requesting a graph operation
2. **Server processes the message** through Claude
3. **Claude identifies the intent** to manipulate a knowledge graph
4. **MCP tool is called** to perform the graph operation
5. **Result is returned** to the client with updated graph data
6. **Client store is updated** with the new graph version

### MCP Tool Implementation

To enable knowledge graph manipulation through the MCP server, implement a specialized tool:

```typescript
// Example MCP tool definition for knowledge graph operations
const knowledgeGraphTool = {
  name: "knowledge_graph_manipulator",
  description: "Manipulate knowledge graphs by applying transformations like grouping, filtering, or highlighting",
  input_schema: {
    type: "object",
    properties: {
      operation: {
        type: "string",
        enum: ["groupByProperty", "filterNodes", "highlightNodes", "resetView"],
        description: "The type of operation to perform on the graph"
      },
      targetGraphId: {
        type: "string",
        description: "ID of the graph artifact to manipulate"
      },
      params: {
        type: "object",
        description: "Parameters specific to the operation",
        properties: {
          propertyName: { type: "string" },
          predicate: { type: "string" },
          value: { type: "string" },
          nodeIds: { type: "array", items: { type: "string" } },
          color: { type: "string" }
        }
      }
    },
    required: ["operation", "targetGraphId"]
  }
};
```

### Server-Side Processing

Add a handler for the knowledge graph tool in your server's chat route:

```typescript
// Inside the tool processing section of chat.ts
if (content.name === "knowledge_graph_manipulator") {
  console.log('\n=== KNOWLEDGE GRAPH MANIPULATION ===');
  console.log('Operation:', content.input.operation);
  console.log('Target Graph ID:', content.input.targetGraphId);
  
  // Find the target artifact in the conversation history
  const targetArtifact = findArtifactById(messages, content.input.targetGraphId);
  
  if (!targetArtifact) {
    return { content: [{ type: 'text', text: "Error: Target graph not found" }] };
  }
  
  try {
    // Parse the current graph data
    const graphData = JSON.parse(targetArtifact.content);
    let updatedNodes, updatedLinks;
    
    // Apply the requested operation
    switch (content.input.operation) {
      case 'groupByProperty': {
        const { propertyName } = content.input.params;
        
        // Get unique values for the property
        const propertyValues = new Set();
        graphData.nodes.forEach(node => {
          if (node[propertyName] !== undefined) {
            propertyValues.add(String(node[propertyName]));
          }
        });
        
        // Assign group numbers based on property values
        const valueToGroup = Array.from(propertyValues).reduce((acc, val, index) => {
          acc[val] = index + 1;
          return acc;
        }, {});
        
        // Update nodes with group information
        updatedNodes = graphData.nodes.map(node => ({
          ...node,
          group: node[propertyName] !== undefined ? 
            valueToGroup[String(node[propertyName])] : 0
        }));
        
        break;
      }
      
      // Add other operation handlers...
    }
    
    // Create a new version of the graph
    const newGraph = {
      ...graphData,
      nodes: updatedNodes || graphData.nodes,
      links: updatedLinks || graphData.links,
      metadata: {
        ...graphData.metadata,
        version: (graphData.metadata?.version || 0) + 1,
        previousVersion: targetArtifact.id,
        commandHistory: [
          ...(graphData.metadata?.commandHistory || []),
          {
            command: content.input.operation,
            params: content.input.params,
            timestamp: new Date().toISOString()
          }
        ]
      }
    };
    
    // Create a new artifact with the updated graph
    const newArtifactId = crypto.randomUUID();
    const newArtifact = {
      id: newArtifactId,
      artifactId: newArtifactId,
      type: 'application/vnd.ant.knowledge-graph',
      title: `${targetArtifact.title} (v${newGraph.metadata.version})`,
      content: JSON.stringify(newGraph),
      previousVersionId: targetArtifact.id,
      versionNumber: newGraph.metadata.version,
      versionLabel: `Applied ${content.input.operation}`,
      versionTimestamp: new Date(),
      graphMetadata: {
        nodeCount: newGraph.nodes.length,
        edgeCount: newGraph.links.length,
        lastCommand: content.input.operation,
        commandParams: content.input.params
      }
    };
    
    // Add the new artifact to the response
    return {
      content: [{ 
        type: 'text', 
        text: `Successfully applied ${content.input.operation} to the knowledge graph.` 
      }],
      artifacts: [newArtifact]
    };
  } catch (error) {
    console.error('Error manipulating knowledge graph:', error);
    return { 
      content: [{ 
        type: 'text', 
        text: `Error manipulating knowledge graph: ${error.message}` 
      }]
    };
  }
}
```

### Client-Side Integration

The client doesn't directly call store functions. Instead:

1. **User sends a natural language request** like "Group the nodes in the knowledge graph by type"
2. **Claude interprets this** and calls the `knowledge_graph_manipulator` tool
3. **Server processes the request** and returns a new artifact
4. **Client receives the response** with the new artifact
5. **Chat store automatically updates** with the new artifact

### Example User Interactions

Here are examples of natural language requests that can trigger graph operations:

1. **Grouping**: "Can you group the nodes in my knowledge graph by their type property?"
2. **Filtering**: "Show me only the person nodes in the knowledge graph."
3. **Highlighting**: "Highlight all the company nodes in red."
4. **Resetting**: "Reset the knowledge graph to its original state."

### Advantages of MCP Integration

1. **Natural language interface** - Users can request graph operations in plain English
2. **Consistent versioning** - All changes go through the same pipeline
3. **Server-side processing** - Complex operations can be handled on the server
4. **Integration with AI** - Claude can suggest appropriate operations based on context
5. **Extensibility** - New operations can be added without client-side changes

### Implementation Steps

1. **Create the MCP Tool**: Define a knowledge graph manipulation tool in your MCP server
2. **Update Server Processing**: Add handling for the tool in your chat.ts route
3. **Update Client Prompts**: Ensure Claude knows how to use this tool
4. **Test with Natural Language**: Try various graph manipulation requests

### Prompt Engineering for Graph Operations

To ensure Claude effectively recognizes and processes graph operation requests, include the following in your system prompt:

```
When the user asks to manipulate a knowledge graph:
1. Identify the current graph artifact ID from the conversation context
2. Determine the appropriate operation (groupByProperty, filterNodes, highlightNodes, resetView)
3. Extract relevant parameters from the user's request
4. Call the knowledge_graph_manipulator tool with the correct parameters
5. Explain the changes made to the graph in your response

Example operations:
- Grouping: "Group nodes by [property]"
- Filtering: "Show only nodes where [property] equals [value]"
- Highlighting: "Highlight nodes with IDs [id1, id2, ...] in [color]"
- Resetting: "Reset the graph view"
```

## Implementation Examples

### Example 1: Creating and Manipulating a Knowledge Graph via MCP

This example demonstrates how to create a knowledge graph and manipulate it through natural language requests processed by the MCP server:

```typescript
// Server-side MCP tool registration
// In your MCP server setup code:

const mcpServer = new MCPServer();

// Register the knowledge graph manipulation tool
mcpServer.registerTool({
  name: "knowledge_graph_manipulator",
  description: "Manipulate knowledge graphs by applying transformations like grouping, filtering, or highlighting",
  input_schema: {
    type: "object",
    properties: {
      operation: {
        type: "string",
        enum: ["groupByProperty", "filterNodes", "highlightNodes", "resetView"],
        description: "The type of operation to perform on the graph"
      },
      targetGraphId: {
        type: "string",
        description: "ID of the graph artifact to manipulate"
      },
      params: {
        type: "object",
        description: "Parameters specific to the operation",
        properties: {
          propertyName: { type: "string" },
          predicate: { type: "string" },
          value: { type: "string" },
          nodeIds: { type: "array", items: { type: "string" } },
          color: { type: "string" }
        }
      }
    },
    required: ["operation", "targetGraphId"]
  },
  handler: async (input) => {
    // Implementation as shown in the Server-Side Processing section
    // ...
  }
});
```

### Example 2: Client-Side Integration with Chat Interface

This example shows how to integrate the knowledge graph manipulation with a chat interface:

```typescript
import React, { useState, useEffect } from 'react';
import { useChatStore } from '../../store/chatStore';
import KnowledgeGraphViewer from '../components/artifacts/KnowledgeGraphViewer';

const ChatWithGraphInterface: React.FC = () => {
  const [message, setMessage] = useState('');
  const { sendMessage, chatHistory, artifacts, selectedArtifactId, selectArtifact } = useChatStore();
  
  // Find the most recent knowledge graph artifact
  const knowledgeGraphArtifact = artifacts
    .filter(a => a.type === 'application/vnd.ant.knowledge-graph')
    .sort((a, b) => (b.position || 0) - (a.position || 0))[0];
  
  // Handle sending a message
  const handleSendMessage = async () => {
    if (!message.trim()) return;
    
    // If the message is about manipulating the graph, include the graph ID in the message
    // This helps Claude identify which graph to manipulate
    let enhancedMessage = message;
    if (
      knowledgeGraphArtifact && 
      (message.includes('graph') || message.includes('node') || message.includes('group'))
    ) {
      enhancedMessage = `${message} (referring to the knowledge graph with ID: ${knowledgeGraphArtifact.id})`;
    }
    
    await sendMessage(enhancedMessage);
    setMessage('');
  };
  
  return (
    <div className="flex flex-col h-screen">
      {/* Chat history display */}
      <div className="flex-1 overflow-y-auto p-4">
        {chatHistory.map((msg, i) => (
          <div key={i} className={`mb-4 ${msg.role === 'user' ? 'text-right' : 'text-left'}`}>
            <div className={`inline-block p-3 rounded-lg ${
              msg.role === 'user' ? 'bg-blue-100' : 'bg-gray-100'
            }`}>
              {msg.content}
            </div>
          </div>
        ))}
      </div>
      
      {/* Knowledge graph display */}
      {knowledgeGraphArtifact && (
        <div className="border-t border-gray-200 h-1/2">
          <KnowledgeGraphViewer 
            data={knowledgeGraphArtifact.content}
            artifactId={knowledgeGraphArtifact.id}
            showVersionControls={true}
          />
        </div>
      )}
      
      {/* Message input */}
      <div className="border-t border-gray-200 p-4">
        <div className="flex">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Ask about the graph or request changes..."
            className="flex-1 p-2 border rounded-l"
            onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
          />
          <button 
            onClick={handleSendMessage}
            className="bg-blue-500 text-white p-2 rounded-r"
          >
            Send
          </button>
        </div>
        
        {/* Example prompts */}
        <div className="mt-2 text-sm text-gray-500">
          <p>Try: "Group the nodes by type" or "Highlight the person nodes in red"</p>
        </div>
      </div>
    </div>
  );
};

export default ChatWithGraphInterface;
```

### Example 3: System Prompt for Graph Manipulation

This example shows how to enhance the system prompt to handle knowledge graph operations:

```typescript
// In your systemPrompt.ts file

export const systemPrompt = `
You are an AI assistant that can help users analyze and manipulate knowledge graphs.

${/* ... other system prompt content ... */}

When the user asks to manipulate a knowledge graph:
1. Identify the current graph artifact ID from the conversation context
   - Look for graph IDs mentioned in the message
   - If no ID is explicitly mentioned, use the most recently displayed graph
   
2. Determine the appropriate operation based on the user's request:
   - groupByProperty: When the user wants to group or cluster nodes by a property
   - filterNodes: When the user wants to show only certain nodes
   - highlightNodes: When the user wants to emphasize specific nodes
   - resetView: When the user wants to return to the original view
   
3. Extract relevant parameters from the user's request:
   - For groupByProperty: Which property to group by (e.g., "type", "category")
   - For filterNodes: Which property and value to filter on
   - For highlightNodes: Which nodes to highlight and what color to use
   
4. Call the knowledge_graph_manipulator tool with the correct parameters
   
5. Explain the changes made to the graph in your response

Example operations:
- "Group nodes by type" → groupByProperty with propertyName="type"
- "Show only person nodes" → filterNodes with predicate="type", value="person"
- "Highlight nodes 1, 2, and 3 in red" → highlightNodes with nodeIds=["1","2","3"], color="#ff0000"
- "Reset the graph view" → resetView
`;
```

### Example 4: Handling Graph Operations in chat.ts

This example shows how to implement the findArtifactById function used in the server-side processing:

```typescript
// In chat.ts or a utility file

/**
 * Finds an artifact by ID in the conversation history
 */
function findArtifactById(messages: ChatMessage[], artifactId: string): any {
  // First check if any message has the artifact directly
  for (const message of messages) {
    if (message.role === 'assistant' && message.artifacts) {
      const artifact = message.artifacts.find(a => a.id === artifactId);
      if (artifact) return artifact;
    }
  }
  
  // Then check if any message has a knowledgeGraph property
  // that might contain the artifact
  for (const message of messages) {
    if ((message as any).knowledgeGraph) {
      // If the message has a knowledge graph, check if it's the one we're looking for
      const graph = (message as any).knowledgeGraph;
      if (graph.id === artifactId) return {
        id: artifactId,
        type: 'application/vnd.ant.knowledge-graph',
        content: JSON.stringify(graph)
      };
    }
  }
  
  // Finally check if any message has artifacts in its content
  for (const message of messages) {
    if (message.role === 'assistant' && Array.isArray(message.content)) {
      for (const content of message.content) {
        if (content.type === 'tool_use' && content.name === 'response_formatter') {
          const formatterResponse = content.input;
          if (formatterResponse.conversation) {
            for (const item of formatterResponse.conversation) {
              if (item.type === 'artifact' && item.artifact && item.artifact.id === artifactId) {
                return item.artifact;
              }
            }
          }
        }
      }
    }
  }
  
  return null;
}
```

### Example 5: Testing the MCP Integration

This example shows how to test the knowledge graph manipulation through the MCP:

```typescript
// In a test file

import { MCPService } from '../services/mcp';
import { MessageService } from '../services/message';

describe('Knowledge Graph MCP Integration', () => {
  let mcpService: MCPService;
  let messageService: MessageService;
  let testGraphId: string;
  
  beforeEach(() => {
    mcpService = new MCPService();
    messageService = new MessageService();
    
    // Create a test graph
    const testGraph = {
      nodes: [
        { id: 'node1', name: 'Node 1', type: 'person' },
        { id: 'node2', name: 'Node 2', type: 'company' },
        { id: 'node3', name: 'Node 3', type: 'person' }
      ],
      links: [
        { source: 'node1', target: 'node2', label: 'works_at' }
      ]
    };
    
    testGraphId = 'test-graph-id';
    
    // Mock the messages with the test graph
    const messages = [
      {
        role: 'assistant',
        artifacts: [
          {
            id: testGraphId,
            type: 'application/vnd.ant.knowledge-graph',
            content: JSON.stringify(testGraph)
          }
        ]
      }
    ];
    
    // Set up the test environment
    mcpService.setMessages(messages);
  });
  
  test('Group nodes by type', async () => {
    const toolInput = {
      operation: 'groupByProperty',
      targetGraphId: testGraphId,
      params: { propertyName: 'type' }
    };
    
    const result = await mcpService.callTool('graph', 'knowledge_graph_manipulator', toolInput);
    
    expect(result).toBeDefined();
    expect(result.artifacts).toHaveLength(1);
    
    const newGraph = JSON.parse(result.artifacts[0].content);
    expect(newGraph.nodes).toHaveLength(3);
    
    // Check that nodes have been assigned groups
    const personNodes = newGraph.nodes.filter(n => n.type === 'person');
    expect(personNodes[0].group).toBe(personNodes[1].group);
    
    const companyNodes = newGraph.nodes.filter(n => n.type === 'company');
    expect(companyNodes[0].group).not.toBe(personNodes[0].group);
  });
  
  // Additional tests for other operations...
});
```

## Integration Guide

// ... existing code ... 