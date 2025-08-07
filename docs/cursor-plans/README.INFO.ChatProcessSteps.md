# Chat Process Steps Documentation

## Overview

This document provides a comprehensive overview of how process steps (status updates) are handled in the chat interface. These steps provide real-time feedback to users about the progress of their requests, from initialization through completion.

## Core Data Structures

### Status Update Interface
```typescript
export interface StatusUpdate {
  id: string;        // Unique identifier for the update
  message: string;   // Status message content
  timestamp: Date;   // When the update was created
}
```

### Message Interface with Status Updates
```typescript
export interface MessageWithThinking extends Message {
  statusUpdates?: StatusUpdate[];        // Array of status updates
  statusUpdatesCollapsed?: boolean;      // Controls visibility of updates
  thinking?: string;                     // Thinking process content
  artifactId?: string;                   // Primary artifact reference
  artifactIds?: string[];               // All related artifact references
  isStreaming?: boolean;                // Whether message is currently streaming
  isLastStatusUpdate?: boolean;         // Marks final status update
}
```

## Key Features
- Real-time status updates during processing
- Collapsible/expandable update display
- Timestamp-based tracking
- Preservation during async operations
- Visual feedback during streaming
- Integration with artifact processing 

## Server-Side Implementation

### Chat Route Setup
The server is configured to handle streaming responses with appropriate headers:

```typescript
// src/server/routes/chat.ts
router.post('/', async (req: Request, res: Response) => {
  // Set headers for streaming
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Transfer-Encoding', 'chunked');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
});
```

### Status Update Generation
Status updates are generated and sent through the streaming response:

```typescript
const sendStatusUpdate = (status: string) => {
  const timestamp = new Date().toISOString();
  console.log(`[MAIN] Status Update: ${status}`);
  res.write(JSON.stringify({ 
    type: 'status', 
    message: status,
    id: crypto.randomUUID(),
    timestamp: timestamp
  }) + '\n');
};
```

### Common Status Update Points
1. **Initialization**
   ```typescript
   sendStatusUpdate('Initializing request...');
   ```

2. **Graph Processing**
   ```typescript
   if (pinnedGraph) {
     sendStatusUpdate('Processing pinned knowledge graph...');
   }
   ```

3. **Message History**
   ```typescript
   sendStatusUpdate('Preparing message history...');
   ```

4. **Server Connection**
   ```typescript
   sendStatusUpdate('Connecting to MCP server...');
   ```

5. **Tool Execution**
   ```typescript
   sendStatusUpdate(`Executing tool: ${toolName}...`);
   ```

6. **Response Processing**
   ```typescript
   sendStatusUpdate('Processing response format...');
   sendStatusUpdate('Adding bibliography...');
   sendStatusUpdate('Finalizing response...');
   ``` 

## Client-Side State Management

### Chat Store Implementation
The chat store (`chatStore.ts`) manages the state of status updates using Zustand:

### Status Update Processing
```typescript
// Processing incoming status updates during streaming
if (data.type === 'status') {
  set((state: ChatState) => ({
    messages: state.messages.map(msg => {
      if (msg.id === assistantMessageId) {
        const updatedMsg: MessageWithThinking = {
          ...msg,
          statusUpdates: [
            ...((msg.statusUpdates || []) as StatusUpdate[]),
            {
              id: crypto.randomUUID(),
              message: data.message,
              timestamp: new Date()
            }
          ]
        };
        return updatedMsg;
      }
      return msg;
    }),
    streamingContent: `_Status: ${data.message}_\n\n`
  }));
}
```

### State Preservation
The system includes mechanisms to preserve status updates during async operations:

```typescript
// Before processing artifacts
const beforeFinalMsg = get().messages.find(msg => msg.id === assistantMessageId);
const savedStatusUpdates = beforeFinalMsg?.statusUpdates || [];

// After processing, merge with final message
set(state => ({
  messages: state.messages.map(msg => {
    if (msg.id === assistantMessageId) {
      return {
        ...msg,
        statusUpdates: savedStatusUpdates,
        content: fullContent,
        thinking: storeResponse.thinking,
        artifactId: artifactIds[0],
        artifactIds: artifactIds.length > 0 ? artifactIds : undefined
      };
    }
    return msg;
  })
}));
```

### Status Update Visibility Control
```typescript
// Toggle status updates visibility
toggleStatusUpdatesCollapsed: (messageId: string) => {
  set(state => {
    const updatedConversation = {
      ...state.conversations[state.currentConversationId!],
      messages: state.conversations[state.currentConversationId!].messages.map(msg =>
        msg.id === messageId ? 
          { ...msg, statusUpdatesCollapsed: !msg.statusUpdatesCollapsed } : 
          msg
      )
    };
    
    return {
      messages: updatedConversation.messages,
      conversations: {
        ...state.conversations,
        [state.currentConversationId!]: updatedConversation
      }
    };
  });
}
``` 

## UI Implementation

### ChatMessages Component
The `ChatMessages` component handles the display of status updates in two modes:

### 1. Streaming Mode Display
```typescript
{isStreaming && hasStatusUpdates(message) && (
  <div className="mb-3">
    <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-100 dark:border-blue-800 text-xs text-blue-800 dark:text-blue-300 font-mono">
      {message.statusUpdates && Array.isArray(message.statusUpdates) && message.statusUpdates.map((update) => (
        <div key={update.id} className="mb-1 last:mb-0">
          <span className="opacity-70 mr-2">
            {(typeof update.timestamp === 'string' ? new Date(update.timestamp) : update.timestamp)
              .toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'})}
          </span>
          <span>{update.message}</span>
        </div>
      ))}
    </div>
  </div>
)}
```

### 2. Completed Message Display
```typescript
{!isStreaming && message.statusUpdates && message.statusUpdates.length > 0 && (
  <div className="mt-2">
    {/* Collapse/Expand button */}
    <button
      onClick={() => toggleStatusUpdatesCollapsed(message.id)}
      className="text-xs text-gray-500 hover:text-gray-700"
    >
      {message.statusUpdatesCollapsed ? 'Show' : 'Hide'} processing steps
    </button>
    
    {/* Status updates content */}
    {(!message.statusUpdatesCollapsed || message.thinking) && (
      <div className="mt-1 rounded-md bg-blue-50 p-2">
        <div className="text-sm text-blue-700">
          {message.statusUpdates.map((update: StatusUpdate) => (
            <div key={update.id} className="flex items-start space-x-2">
              <span className="text-xs text-blue-500">
                {update.timestamp.toLocaleTimeString([], {
                  hour: '2-digit',
                  minute:'2-digit',
                  second:'2-digit'
                })}
              </span>
              <span>{update.message}</span>
            </div>
          ))}
        </div>
      </div>
    )}
  </div>
)}
```

## Best Practices

### Status Update Generation
1. Keep status messages concise and informative
2. Include specific details when relevant (e.g., tool names, progress indicators)
3. Use consistent terminology across updates
4. Ensure timestamps are properly formatted

### State Management
1. Always preserve status updates during async operations
2. Handle edge cases (empty updates, malformed data)
3. Maintain update order using timestamps
4. Clean up stale updates when appropriate

### UI Considerations
1. Provide clear visual distinction between streaming and completed states
2. Implement collapsible updates to manage screen space
3. Ensure timestamps are properly formatted and localized
4. Maintain consistent styling across different themes (light/dark mode)

### Error Handling
1. Gracefully handle missing or malformed status updates
2. Provide fallback UI for error states
3. Log errors for debugging purposes
4. Maintain user experience during error states

## Common Pitfalls to Avoid
1. Losing status updates during state transitions
2. Inconsistent timestamp handling
3. Missing error states
4. Poor performance with large numbers of updates
5. Incomplete cleanup of stale updates
6. Inconsistent styling between states 