# Chat Server Architecture

## Overview

The chat server implementation in `src/server/routes/chat.ts` handles client requests for AI-assisted conversations. This document provides a detailed explanation of how the chat server processes requests, interacts with services, and structures responses for frontend consumption.

## Core Components

### Services Used

- **MessageService**: Handles conversion between different message formats
- **ArtifactService**: Processes binary outputs and artifacts
- **LoggingService**: Logs requests, responses, and errors
- **MCPService**: Provides access to tool functionality

### Request Flow

1. Client sends a POST request to the chat endpoint with:
   - User message
   - Conversation history
   - Optional blocked servers list
   - Optional pinned knowledge graph

2. Server sets up streaming response headers for real-time updates
3. Server initializes logging and MCP (Multi-agent Compute Platform) services
4. Sequential thinking and tool usage phase begins:
   - Claude model processes the context using sequential thinking
   - Any tool requests are executed via MCPService
   - Tool results are integrated into the conversation
   - Knowledge graphs, bibliographies, and binary outputs are processed
5. Final response is formatted using the response_formatter tool
6. Response is sent to the client as JSON

## Data Flow

### Request Structure
```typescript
{
  message: string; 
  history: Array<{ role: 'user' | 'assistant'; content: string }>;
  blockedServers?: string[];
  pinnedGraph?: {
    id: string;
    type: string;
    title: string;
    content: string;
  };
}
```

### Response Architecture

The chat server creates a structured `storeResponse` object that is compatible with frontend store consumption:

```typescript
interface StoreResponse {
  thinking?: string;
  conversation: string;
  artifacts?: Array<{
    id: string;
    artifactId?: string;
    type: string;
    title: string;
    content: string;
    position: number;
    language?: string;
  }>;
}
```

This response is enhanced through several methods:
- `convertToStoreFormat()`: Transforms Claude's tool response into store-compatible format
- `formatResponseWithBibliography()`: Adds bibliography artifacts when available
- `formatResponseWithMarkdown()`: Adds grant markdown when available
- `formatResponseWithKnowledgeGraph()`: Adds knowledge graph artifacts when available

## Store Interaction

The chat server does not directly interact with frontend stores. Instead:

1. It structures data in a format compatible with frontend store expectations
2. Sends the structured data to the client as JSON
3. The frontend client (likely using the `chatStore.ts` module) consumes this data and updates its state accordingly

## Special Features

### Knowledge Graph Support
- Merges multiple knowledge graphs using `mergeKnowledgeGraphs()`
- Preserves pinned knowledge graphs across requests
- Adds knowledge graphs as artifacts in the response

### Artifact Management
- Processes various artifact types including:
  - Code snippets
  - Knowledge graphs
  - Bibliographies
  - Binary outputs (images, etc.)
- Assigns unique IDs and positions to artifacts

### Real-time Status Updates
- Sends progress updates during processing via `sendStatusUpdate()`
- Handles MCP log messages with `sendMCPLogMessage()`
- Maintains connection with client during potentially long-running operations

## Error Handling

- Uses try/catch blocks to handle errors during processing
- Logs errors via LoggingService
- Sends error status to client
- Ensures clean response termination even on error

## Technical Implementation Notes

- Uses Anthropic's Claude 3.5 Sonnet model
- Supports system prompts and tools
- Manages streaming response
- Preserves state between requests via attached data in messages
- Handles both text and structured JSON responses 