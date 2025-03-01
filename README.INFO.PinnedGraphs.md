# Pinned Knowledge Graphs

This document explains the Knowledge Graph pinning feature in the Charm MCP application, which allows users to attach a specific knowledge graph to all subsequent messages sent to the AI.

## Overview

The pinning feature enables users to maintain context across multiple messages by "pinning" an important knowledge graph. When a graph is pinned, it is automatically included with every new message sent to the AI, allowing the AI to reference and use the graph information when generating responses.

## User Interface

### Pinning a Graph

Users can pin a knowledge graph by clicking the pin icon in the knowledge graph viewer component. The UI provides visual feedback:

- Unpinned graphs show a regular pin icon
- Pinned graphs show a "pin off" icon (indicating clicking will unpin)
- The button has different styling based on the pinned state

### Visual Components

The pin button appears in:
1. The KnowledgeGraphViewer component
2. The ArtifactContent component when displaying knowledge graphs

## Technical Implementation

### State Management

The pinned graph state is managed in the `chatStore`:

```typescript
// State definition
pinnedGraphId: string | null;

// Action to update the state
setPinnedGraphId: (id: string | null) => void;
```

When a graph is pinned, its ID is stored in the `pinnedGraphId` state. When unpinned, this value is set to `null`.

### Data Flow

#### 1. User Interface to State

When a user clicks the pin button:

```typescript
// In KnowledgeGraphViewer.tsx
<button
  onClick={() => {
    if (artifactId) {
      setPinnedGraphId(isPinned ? null : artifactId);
    }
  }}
  title={isPinned ? "Unpin graph (stop sending with messages)" : "Pin graph (send with messages)"}
>
  {isPinned ? <PinOff size={18} /> : <Pin size={18} />}
</button>
```

The component determines if the graph is currently pinned by comparing:
```typescript
const isPinned = artifactId ? pinnedGraphId === artifactId : false;
```

#### 2. Message Processing

When a user sends a message, the `processMessage` function in `chatStore.ts` includes the pinned graph in the request:

```typescript
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

// Include in API request
const response = await fetch(apiUrl, {
  method: 'POST',
  body: JSON.stringify({
    message: content,
    history: get().messages.map(/* ... */),
    blockedServers: useMCPStore.getState().getBlockedServers(),
    pinnedGraph: pinnedGraph ? {
      id: pinnedGraph.id,
      type: pinnedGraph.type,
      title: pinnedGraph.title,
      content: pinnedGraph.content
    } : undefined
  })
});
```

#### 3. Server-Side Processing

The server receives the request with the pinned graph in `chat.ts`:

```typescript
const { message, history, blockedServers = [], pinnedGraph } = req.body;
let messages: ChatMessage[] = [...history, { role: 'user', content: message }];

// If there's a pinned graph, add it to the context
if (pinnedGraph) {
  console.log('\n=== PINNED GRAPH DETECTED ===');
  console.log('Graph ID:', pinnedGraph.id);
  console.log('Graph Title:', pinnedGraph.title);
  
  // Add an assistant message about the pinned graph
  messages.push({
    role: 'assistant',
    content: `I notice you've pinned a knowledge graph titled "${pinnedGraph.title}". I'll reference this graph in my responses.`
  });
  
  // Add the graph content as a user message
  messages.push({
    role: 'user',
    content: `Here is the knowledge graph I've pinned for reference:\n\`\`\`json\n${
      typeof pinnedGraph.content === 'string' 
        ? pinnedGraph.content 
        : JSON.stringify(pinnedGraph.content, null, 2)
    }\n\`\`\``
  });
}
```

#### 4. AI Processing

The AI model (Claude) receives these additional messages as part of its context and can reference the knowledge graph when generating its response.

## Knowledge Graph Merging

The system supports automatic merging of knowledge graphs when new graph data is generated during a conversation.

### Merging Process

1. **Detection**: When a tool response includes a knowledge graph artifact, the system detects it:
   ```typescript
   const knowledgeGraphArtifact = toolResult.artifacts.find((a: any) => 
     a.type === 'application/vnd.knowledge-graph' && typeof a.content === 'string'
   );
   ```

2. **Validation**: The system validates the knowledge graph structure using `isValidKnowledgeGraph()`.

3. **Merging**: If an existing knowledge graph is present in the message context, the system merges them:
   ```typescript
   if ((messages as any).knowledgeGraph) {
     // Merge the knowledge graphs
     const currentGraph = (messages as any).knowledgeGraph as KnowledgeGraph;
     const mergedGraph = mergeKnowledgeGraphs(currentGraph, newGraph);
     
     // Update the merged graph
     (messages as any).knowledgeGraph = mergedGraph;
   }
   ```

4. **Response Formatting**: The merged knowledge graph is added to the response.

### Merging Logic

The `mergeKnowledgeGraphs` function handles the merging with these rules:

- **Node Deduplication**: Nodes are deduplicated based on their IDs
- **Link Merging**: Links are deduplicated based on source, target, and label
- **Evidence Combination**: For duplicate links, evidence is combined
- **Metadata Merging**: Metadata from both graphs is merged

### Interaction with Pinned Graphs

When a graph is pinned:

1. The pinned graph is sent with each user message
2. If a tool generates a new knowledge graph, it will be merged with any existing graph in the conversation
3. The merged graph becomes available for pinning in subsequent messages

This allows for progressive building of knowledge graphs across multiple interactions, where each new piece of information can be integrated with the existing pinned graph.

## Usage Guidelines

### When to Pin a Graph

Pin a knowledge graph when:
- You want the AI to consistently reference specific information
- You're having an extended conversation about a particular topic
- You've built up a valuable knowledge graph that provides important context

### When to Unpin a Graph

Unpin a graph when:
- You're changing topics and the graph is no longer relevant
- The graph is large and you want to reduce context size
- You want to start fresh without the previous context

## Technical Considerations

### Performance

Pinned graphs increase the context size sent to the AI model, which can:
- Increase token usage
- Potentially slow down response times for very large graphs
- Provide more consistent and contextually relevant responses

### Persistence

The pinned graph state is persisted in the chat store, which means:
- The pinned state survives page refreshes
- It remains pinned until explicitly unpinned by the user
- Only one graph can be pinned at a time

## Implementation Details

### Component Integration

The pinning functionality is integrated into:
1. `KnowledgeGraphViewer.tsx` - Main graph visualization component
2. `ArtifactContent.tsx` - General artifact display component
3. `chatStore.ts` - State management and API communication
4. `chat.ts` (server) - Server-side processing of pinned graphs

### State Persistence

The pinned graph ID is stored in the persisted chat store state:

```typescript
persist(
  (set, get) => ({
    // ... other state
    pinnedGraphId: null,
    // ... actions
  }),
  {
    name: 'chat-storage',
    partialize: (state) => ({
      conversations: state.conversations,
      currentConversationId: state.currentConversationId,
      messages: state.messages,
      artifacts: state.artifacts
      // pinnedGraphId is included in the persisted state
    })
  }
)
```

## Example Flow

1. User creates or receives a knowledge graph
2. User pins the graph by clicking the pin icon
3. User sends a new message
4. The system includes the pinned graph in the request
5. The server adds the graph to the context for the AI
6. The AI references the graph in its response
7. The graph remains pinned for subsequent messages until unpinned

### Example Flow with Graph Merging

1. User pins an existing knowledge graph about a medical condition
2. User asks a question that triggers a tool call to medik-mcp
3. The tool returns a new knowledge graph with additional information
4. The server automatically merges the new graph with the existing graph
5. The merged graph is included in the AI's response
6. User can pin this new, enriched graph for future messages

## Troubleshooting

### Common Issues

#### Claude API Error with System Messages

If you encounter an error like this when using pinned graphs:

```
"message": "400 {\"type\":\"error\",\"error\":{\"type\":\"invalid_request_error\",\"message\":\"messages: Unexpected role \\\"system\\\". The Messages API accepts a top-level `system` parameter, not \\\"system\\\" as an input message role.\"}}"
```

**Cause**: The Claude API doesn't accept messages with the role "system" in the messages array. It expects system instructions to be provided as a top-level parameter.

**Solution**: The application has been updated to use 'assistant' role messages instead of 'system' role messages when adding pinned graph context. This ensures compatibility with Claude's API requirements.

### Debugging

If a pinned graph is not being included in messages, check:
1. The `pinnedGraphId` state in the chat store
2. That the artifact with that ID exists in the artifacts array
3. Server logs for the "PINNED GRAPH DETECTED" message
4. Network requests to confirm the graph is being sent 