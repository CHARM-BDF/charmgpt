# MCP Artifact Processing Flow

## Overview

This document explains how artifacts from Model Context Protocol (MCP) servers are processed, stored, and displayed in the Charm MCP framework. It covers the complete lifecycle of artifacts from their creation on the server to their display in the UI, with specific examples for bibliography and knowledge graph artifacts.

## Table of Contents

1. [Artifact Lifecycle](#artifact-lifecycle)
2. [Server Response Format](#server-response-format)
3. [Artifact Processing in the Chat Router](#artifact-processing-in-the-chat-router)
4. [Message Service Formatting](#message-service-formatting)
5. [Store Integration](#store-integration)
6. [UI Rendering](#ui-rendering)
7. [Examples](#examples)
   - [Bibliography Artifacts](#bibliography-artifacts)
   - [Knowledge Graph Artifacts](#knowledge-graph-artifacts)
8. [Troubleshooting](#troubleshooting)

## Artifact Lifecycle

Artifacts in the Charm MCP framework follow this general lifecycle:

1. **Creation**: An MCP server generates an artifact (e.g., bibliography, knowledge graph)
2. **Response**: The artifact is included in the server's response
3. **Processing**: The chat router processes the artifact and formats it
4. **Storage**: The artifact is stored in the chat store
5. **Association**: The artifact is linked to the relevant message
6. **Display**: The UI renders a button to view the artifact
7. **Interaction**: Users can click the button to view the artifact in detail

## Server Response Format

When an MCP server responds to a tool call, it can include artifacts in its response. Here's the typical structure of a response with artifacts:

```javascript
{
  "type": "tool_use",
  "name": "tool-name",
  "input": {
    "thinking": "Optional thinking process...",
    "conversation": [
      {
        "type": "text",
        "content": "Text response from the tool..."
      },
      {
        "type": "artifact",
        "artifact": {
          "type": "application/vnd.bibliography", // or "application/vnd.knowledge-graph"
          "id": "unique-id",
          "title": "Artifact Title",
          "content": "JSON string of the artifact content"
        }
      }
    ]
  }
}
```

The server can include multiple artifacts of different types in a single response. Each artifact has a unique ID, a type, a title, and content (usually a JSON string).

## Artifact Processing in the Chat Router

The chat router (`src/server/routes/chat.ts`) is responsible for processing the MCP server response and extracting artifacts. Here's how it works:

1. The router receives the response from the MCP server
2. It extracts the text content for the assistant's message
3. It identifies and processes any artifacts in the response
4. For special artifact types (bibliography, knowledge graph), it performs additional processing
5. It formats the final response with all artifacts included

### Special Artifact Processing

For certain artifact types, the chat router performs additional processing:

#### Bibliography Processing

```javascript
// Handle bibliography if present
if ('bibliography' in toolResult && toolResult.bibliography) {
  console.log('\n=== BIBLIOGRAPHY DATA ===');
  
  // Check if bibliography exists and merge if it does
  if ((messages as any).bibliography) {
    // Merge and deduplicate based on PMID
    const currentBibliography = (messages as any).bibliography as any[];
    const newBibliography = toolResult.bibliography as any[];
    
    // Deduplicate entries based on PMID
    const mergedBibliography = [...currentBibliography];
    for (const entry of newBibliography) {
      if (!mergedBibliography.some(e => e.pmid === entry.pmid)) {
        mergedBibliography.push(entry);
      }
    }
    
    // Update the bibliography
    (messages as any).bibliography = mergedBibliography;
  } else {
    // Initialize bibliography
    (messages as any).bibliography = toolResult.bibliography;
  }
  
  // Format the response with bibliography
  storeResponse = messageService.formatResponseWithBibliography(
    storeResponse, 
    (messages as any).bibliography
  );
}
```

#### Knowledge Graph Processing

```javascript
// Handle knowledge graph if present
if ('knowledgeGraph' in toolResult && toolResult.knowledgeGraph) {
  console.log('\n=== KNOWLEDGE GRAPH DATA ===');
  console.log(`Nodes: ${toolResult.knowledgeGraph.nodes.length}, Links: ${toolResult.knowledgeGraph.links.length}`);
  
  // Check if knowledge graph exists and merge if it does
  if ((messages as any).knowledgeGraph) {
    // Merge the knowledge graphs
    const currentGraph = (messages as any).knowledgeGraph as KnowledgeGraph;
    const newGraph = toolResult.knowledgeGraph as KnowledgeGraph;
    
    // Use the utility function to merge graphs
    const mergedGraph = mergeKnowledgeGraphs(currentGraph, newGraph);
    (messages as any).knowledgeGraph = mergedGraph;
    
    console.log(`Merged knowledge graph - Nodes: ${mergedGraph.nodes.length}, Links: ${mergedGraph.links.length}`);
  } else {
    // Initialize knowledge graph
    (messages as any).knowledgeGraph = toolResult.knowledgeGraph;
  }
  
  // Format the response with knowledge graph
  storeResponse = messageService.formatResponseWithKnowledgeGraph(
    storeResponse, 
    (messages as any).knowledgeGraph
  );
}
```

Both bibliography and knowledge graph artifacts are accumulated across multiple tool calls. This means that if a user makes multiple queries that return bibliography or knowledge graph data, the system will merge the new data with the existing data, avoiding duplicates.

## Message Service Formatting

The Message Service (`src/services/MessageService.ts`) is responsible for formatting the response from the chat router. It includes methods for formatting the response with bibliography and knowledge graph data.

## Store Integration

The chat store (`src/store/chatStore.ts`) is responsible for storing the artifacts and their associations with messages. This is a critical part of the artifact processing flow, as it determines how artifacts are linked to messages and how they can be retrieved later.

### Artifact Storage

Artifacts are stored in the `artifacts` array in the chat store. Each artifact has a unique ID, a type, a title, and content. The store also maintains a mapping of artifact IDs to their positions in the array for quick lookup.

```typescript
// Artifact storage in the chat store
interface ChatState {
  // ... other state properties ...
  artifacts: Artifact[];
  artifactMap: Record<string, number>; // Maps artifact IDs to their positions in the artifacts array
}
```

### Message Processing

When a new message is received from the server, the `processMessage` function in the chat store is responsible for processing any artifacts associated with the message. Here's how it works:

```typescript
// Process a message and its associated artifacts
const processMessage = (message: MessageWithThinking) => {
  // ... other message processing ...
  
  // Process artifacts if present
  if (message.artifacts && message.artifacts.length > 0) {
    console.log(`Processing ${message.artifacts.length} artifacts for message`);
    
    const artifactIds: string[] = [];
    
    // Process each artifact
    message.artifacts.forEach((artifact) => {
      console.log(`Processing artifact: ${artifact.id}, type: ${artifact.type}, title: ${artifact.title}`);
      
      // Add the artifact to the store if it doesn't exist
      if (!(artifact.id in state.artifactMap)) {
        const position = state.artifacts.length;
        state.artifacts.push(artifact);
        state.artifactMap[artifact.id] = position;
      }
      
      // Add the artifact ID to the list of artifact IDs for this message
      artifactIds.push(artifact.id);
    });
    
    // Update the message with the artifact IDs
    if (artifactIds.length > 0) {
      message.artifactIds = artifactIds;  // Store all artifact IDs
      message.artifactId = artifactIds[0]; // For backward compatibility, store the first artifact ID
      console.log(`Linked message to artifacts: primary=${message.artifactId}, all=[${message.artifactIds.join(', ')}], count=${artifactIds.length}`);
    }
  }
  
  // ... other message processing ...
  
  // Add the processed message to the store
  state.messages.push(message);
};
```

### Artifact Retrieval

The `getMessageArtifacts` function in the `ChatMessages.tsx` component is responsible for retrieving artifacts associated with a message. It uses several strategies to find artifacts:

1. **Direct Linking**: Check if the message has an `artifactId` or `artifactIds` property and retrieve those artifacts.
2. **Reference Lookup**: Find artifacts that reference the message ID.
3. **Content Extraction**: Extract artifact IDs from buttons in the message content.

```typescript
// Get artifacts associated with a message
const getMessageArtifacts = (message: MessageWithThinking): Artifact[] => {
  const result: Artifact[] = [];
  const seenIds = new Set<string>();
  
  // Step 1: Check for directly linked artifacts
  if (message.artifactId) {
    const artifact = artifacts.find(a => a.id === message.artifactId);
    if (artifact) {
      result.push(artifact);
      seenIds.add(artifact.id);
    }
  }
  
  // Check for multiple artifacts using the new artifactIds property
  if (message.artifactIds && message.artifactIds.length > 0) {
    for (const id of message.artifactIds) {
      if (!seenIds.has(id)) {
        const artifact = artifacts.find(a => a.id === id);
        if (artifact) {
          result.push(artifact);
          seenIds.add(id);
        }
      }
    }
  }
  
  // Step 2: Find artifacts that reference this message
  const referencingArtifacts = artifacts.filter(a => 
    a.references && a.references.includes(message.id)
  );
  
  for (const artifact of referencingArtifacts) {
    if (!seenIds.has(artifact.id)) {
      result.push(artifact);
      seenIds.add(artifact.id);
    }
  }
  
  // Step 3: Extract artifact IDs from buttons in the message content
  if (message.content) {
    const buttonMatches = message.content.matchAll(/<button[^>]*data-artifact-id="([^"]+)"[^>]*>/g);
    for (const match of buttonMatches) {
      const artifactId = match[1];
      if (!seenIds.has(artifactId)) {
        const artifact = artifacts.find(a => a.id === artifactId);
        if (artifact) {
          result.push(artifact);
          seenIds.add(artifactId);
        }
      }
    }
  }
  
  return result;
};
```

This comprehensive approach ensures that all artifacts associated with a message are retrieved, regardless of how they are linked.

## UI Rendering

The UI components in `src/components/chat/ChatMessages.tsx` are responsible for rendering the artifacts in the chat interface. Different artifact types are rendered differently:

### Artifact Rendering Logic

The main rendering logic for artifacts is in the `ChatMessages.tsx` component. Here's how it works:

```typescript
// Get artifacts for the current message
const messageArtifacts = getMessageArtifacts(message);

// Render different types of artifacts
const hasBibliography = messageArtifacts.some(a => a.type === 'bibliography');
const hasKnowledgeGraph = messageArtifacts.some(a => a.type === 'knowledge-graph');
const hasJson = messageArtifacts.some(a => a.type === 'json');

// Render UI elements based on artifact types
{hasBibliography && (
  <BibliographyLink
    onClick={() => handleViewArtifact(
      messageArtifacts.find(a => a.type === 'bibliography')!
    )}
  />
)}

{hasKnowledgeGraph && (
  <KnowledgeGraphLinkLucide
    onClick={() => handleViewArtifact(
      messageArtifacts.find(a => a.type === 'knowledge-graph')!
    )}
  />
)}

{hasJson && (
  <JsonLink
    onClick={() => handleViewArtifact(
      messageArtifacts.find(a => a.type === 'json')!
    )}
  />
)}
```

### Artifact Viewer

When a user clicks on an artifact link, the `handleViewArtifact` function is called, which opens a modal dialog to display the artifact. The modal content depends on the artifact type:

```typescript
// Handle viewing an artifact
const handleViewArtifact = (artifact: Artifact) => {
  setSelectedArtifact(artifact);
  setIsArtifactModalOpen(true);
};

// Render the artifact modal
{isArtifactModalOpen && selectedArtifact && (
  <ArtifactModal
    artifact={selectedArtifact}
    onClose={() => setIsArtifactModalOpen(false)}
  />
)}
```

The `ArtifactModal` component renders different content based on the artifact type:

- For bibliography artifacts, it renders a list of references
- For knowledge graph artifacts, it renders a graph visualization
- For JSON artifacts, it renders a formatted JSON viewer

## Examples

### Bibliography Artifacts

Bibliography artifacts are used to represent references to scholarly articles, books, or other publications. They are typically returned by the MCP server when the LLM references scientific literature.

#### Example Bibliography Artifact

```json
{
  "id": "bib-123456",
  "artifactId": "bib-123456",
  "type": "bibliography",
  "title": "References",
  "content": [
    {
      "pmid": "12345678",
      "title": "Example Research Paper",
      "authors": ["Smith, J.", "Johnson, A."],
      "journal": "Journal of Example Research",
      "year": 2020,
      "volume": "45",
      "issue": "2",
      "pages": "123-145",
      "doi": "10.1234/example.12345678",
      "url": "https://doi.org/10.1234/example.12345678",
      "abstract": "This is an example abstract for a research paper..."
    },
    {
      "pmid": "87654321",
      "title": "Another Research Study",
      "authors": ["Brown, R.", "Davis, M."],
      "journal": "Scientific Reports",
      "year": 2019,
      "volume": "32",
      "issue": "4",
      "pages": "567-589",
      "doi": "10.1234/example.87654321",
      "url": "https://doi.org/10.1234/example.87654321",
      "abstract": "This is another example abstract..."
    }
  ],
  "references": ["msg-abcdef123456"],
  "timestamp": "2023-06-15T14:30:45.123Z"
}
```

#### Bibliography Rendering

When a bibliography artifact is detected, the UI displays a bibliography icon that users can click to view the references. The bibliography is rendered as a list of citations with links to the original sources.

### Knowledge Graph Artifacts

Knowledge graph artifacts represent relationships between entities in a domain. They are typically returned by the MCP server when the LLM is asked to analyze relationships or create a conceptual map.

#### Example Knowledge Graph Artifact

```json
{
  "id": "kg-789012",
  "artifactId": "kg-789012",
  "type": "knowledge-graph",
  "title": "Disease Pathway Analysis",
  "content": {
    "nodes": [
      {
        "id": "node1",
        "label": "Type 2 Diabetes",
        "type": "disease",
        "properties": {
          "description": "A metabolic disorder characterized by high blood sugar and insulin resistance"
        }
      },
      {
        "id": "node2",
        "label": "Insulin Resistance",
        "type": "condition",
        "properties": {
          "description": "When cells in muscles, fat, and liver don't respond well to insulin"
        }
      },
      {
        "id": "node3",
        "label": "Obesity",
        "type": "condition",
        "properties": {
          "description": "Excessive body fat accumulation that presents a risk to health"
        }
      }
    ],
    "links": [
      {
        "source": "node1",
        "target": "node2",
        "label": "characterized by",
        "properties": {}
      },
      {
        "source": "node3",
        "target": "node2",
        "label": "contributes to",
        "properties": {}
      }
    ]
  },
  "references": ["msg-ghijkl789012"],
  "timestamp": "2023-06-15T15:45:30.456Z"
}
```

#### Knowledge Graph Rendering

When a knowledge graph artifact is detected, the UI displays a graph icon that users can click to view the knowledge graph. The graph is rendered using a visualization library that shows nodes and edges with interactive features like zooming, panning, and node selection.

### JSON Artifacts

JSON artifacts can contain any structured data that doesn't fit into the other categories. They are typically used for custom data structures or analysis results.

#### Example JSON Artifact

```json
{
  "id": "json-345678",
  "artifactId": "json-345678",
  "type": "json",
  "title": "Analysis Results",
  "content": {
    "summary": {
      "totalSamples": 150,
      "meanValue": 42.5,
      "medianValue": 41.2,
      "standardDeviation": 3.8
    },
    "categories": [
      {
        "name": "Category A",
        "count": 45,
        "percentage": 30
      },
      {
        "name": "Category B",
        "count": 65,
        "percentage": 43.3
      },
      {
        "name": "Category C",
        "count": 40,
        "percentage": 26.7
      }
    ],
    "recommendations": [
      "Focus on Category B for highest impact",
      "Investigate correlation between Categories A and C",
      "Consider additional sampling for Category A"
    ]
  },
  "references": ["msg-mnopqr345678"],
  "timestamp": "2023-06-15T16:20:15.789Z"
}
```

#### JSON Rendering

When a JSON artifact is detected, the UI displays a JSON icon that users can click to view the structured data. The JSON is rendered in a formatted, collapsible viewer that makes it easy to explore complex data structures.

## Troubleshooting

If you encounter issues with artifact processing, check the following:

1. **Server Response Format**: Ensure that the server response is in the correct format with properly structured artifacts.

2. **Artifact Processing**: Check the chat router logs to ensure that artifacts are being correctly extracted from the server response.

3. **Store Integration**: Verify that artifacts are being correctly stored in the chat store and that message-artifact associations are being maintained.

4. **UI Rendering**: Check the browser console for any errors related to artifact rendering and ensure that the correct components are being used for each artifact type.

### Common Issues

#### Missing Artifacts

If artifacts are not appearing in the UI:

1. Check if the artifacts are present in the server response
2. Verify that the artifacts are being correctly processed by the chat router
3. Ensure that the artifacts are being stored in the chat store
4. Check that the `getMessageArtifacts` function is correctly retrieving the artifacts

#### Incorrect Artifact Rendering

If artifacts are appearing but not rendering correctly:

1. Verify that the artifact type is correctly identified
2. Check that the appropriate rendering component is being used
3. Ensure that the artifact content is in the expected format
4. Look for any errors in the browser console related to rendering

#### Multiple Artifacts Not Showing

If only some artifacts are showing when multiple are expected:

1. Verify that all artifacts are being stored in the chat store
2. Check that the message has the correct `artifactIds` property with all artifact IDs
3. Ensure that the `getMessageArtifacts` function is correctly handling multiple artifacts
4. Verify that the UI is rendering all artifact types that are present

## Conclusion

The artifact processing flow in the MCP system is a complex but powerful feature that enables rich, interactive content in the chat interface. By understanding how artifacts are created, processed, stored, and rendered, you can better diagnose issues and develop new features that leverage this capability. 