# UI Real-Time Status Updates Implementation

## Overview

This document explains the complete flow of real-time status updates in the chat system, from server-side generation through HTTP streaming to client-side display. The system provides live feedback to users about processing steps, tool executions, and system status.

## Architecture Flow

```
Server Processing → HTTP Streaming → Client State → UI Display
     ↓                    ↓              ↓           ↓
statusHandler()    res.write(JSON)   Zustand Store  React UI
```

## 1. Server-Side Status Generation

### Chat Route Status Handler (`src/server/routes/chat.ts`)

The foundation of the status update system is the `sendStatusUpdate` helper function:

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

**Key Features:**
- **Immediate Streaming**: Uses `res.write()` for instant delivery
- **Structured Format**: JSON with type, message, ID, and timestamp
- **Newline Delimiter**: Enables client-side parsing of chunks
- **Unique IDs**: Each update gets a UUID for tracking

### HTTP Streaming Setup

```typescript
// Set headers for streaming
res.setHeader('Content-Type', 'application/json');
res.setHeader('Transfer-Encoding', 'chunked');
res.setHeader('Cache-Control', 'no-cache');
res.setHeader('Connection', 'keep-alive');
```

## 2. Chat Service Integration

### Status Handler Callback Pattern

The `statusHandler` callback is passed through the entire chat processing pipeline:

```typescript
// In ChatService.processChat()
async processChat(
  message: string,
  history: ChatMessage[],
  options: { modelProvider: ModelType; /* ... */ },
  statusHandler?: (status: string) => void
): Promise<StoreFormat>
```

### Key Status Update Points

1. **Initialization Phase**
   ```typescript
   statusHandler?.('Initializing chat processing...');
   statusHandler?.('Retrieving available tools...');
   statusHandler?.('Processing with sequential thinking...');
   ```

2. **Sequential Thinking Loop**
   ```typescript
   statusHandler?.(`Running thinking step ${thinkingSteps}...`);
   statusHandler?.(`Step ${thinkingSteps}: Executing ${toolCalls.length} tool(s) - ${toolCalls.map(tc => tc.name).join(', ')}`);
   ```

3. **Tool Execution**
   ```typescript
   statusHandler?.(`Executing tool: ${toolCall.name}...`);
   
   // Result-based status updates
   if (textContent.includes('SyntaxError')) {
     statusHandler?.(`Tool ${toolCall.name}: Syntax error detected - LLM will attempt to fix`);
   } else if (textContent.includes('Docker container exited')) {
     statusHandler?.(`Tool ${toolCall.name}: Runtime error - LLM will retry`);
   } else {
     statusHandler?.(`Tool ${toolCall.name}: Executed successfully`);
   }
   ```

4. **Loop Control and Termination**
   ```typescript
   statusHandler?.(`Continuing to step ${thinkingSteps + 1} - LLM requested more tool calls`);
   statusHandler?.(`Sequential thinking stopped after ${thinkingSteps} steps: ${reason}`);
   ```

## 3. Client-Side Processing

### Status Update Data Structure

```typescript
export interface StatusUpdate {
  id: string;
  message: string;
  timestamp: Date;
}

export interface MessageWithThinking extends Message {
  statusUpdates?: StatusUpdate[];
  statusUpdatesCollapsed?: boolean;
  isStreaming?: boolean;
  // ... other properties
}
```

### Zustand Store Processing (`src/store/chatStore.ts`)

The client processes incoming status updates in real-time:

```typescript
// Stream processing loop
for (const line of lines) {
  if (!line.trim()) continue;
  
  const data = JSON.parse(line);
  
  if (data.type === 'status') {
    set((state: ChatState) => {
      const updatedConversation = {
        ...state.conversations[state.currentConversationId!],
        messages: state.conversations[state.currentConversationId!].messages.map(msg => {
          if (msg.id === assistantMessageId) {
            return {
              ...msg,
              content: msg.content === '_Processing your request..._' ?
                `_Status: ${data.message}_\n\n` : msg.content,
              statusUpdates: [
                ...((msg.statusUpdates || []) as StatusUpdate[]),
                {
                  id: crypto.randomUUID(),
                  message: data.message,
                  timestamp: new Date()
                }
              ]
            };
          }
          return msg;
        })
      };

      return {
        messages: updatedConversation.messages,
        conversations: {
          ...state.conversations,
          [state.currentConversationId!]: updatedConversation
        },
        streamingContent: `_Status: ${data.message}_\n\n`
      };
    });
  }
}
```

### Status Update Preservation

Critical feature for maintaining status updates during async operations:

```typescript
// BEFORE artifact processing - capture existing status updates
const beforeFinalMsg = get().messages.find(msg => msg.id === assistantMessageId);
const savedStatusUpdates = beforeFinalMsg?.statusUpdates || [];

// AFTER processing - merge with final message
set(state => ({
  messages: state.messages.map(msg => {
    if (msg.id === assistantMessageId) {
      return {
        ...msg,
        statusUpdates: savedStatusUpdates, // Preserve status updates
        content: fullContent,
        // ... other properties
      };
    }
    return msg;
  })
}));
```

## 4. UI Display Implementation

### Real-Time Streaming Display (`src/components/chat/ChatMessages.tsx`)

During streaming, status updates appear in a blue status box:

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

### Completed Message Display

After streaming completes, status updates can be collapsed/expanded:

```typescript
{!isStreaming && message.statusUpdates && message.statusUpdates.length > 0 && (
  <div className="mb-3">
    <div className="rounded-md bg-blue-50 p-2">
      <div className="text-sm text-blue-700">
        {message.statusUpdates.map((update: StatusUpdate) => (
          <div key={update.id} className="flex items-start space-x-2">
            <span className="text-xs text-blue-500">
              {(typeof update.timestamp === 'string' ? new Date(update.timestamp) : update.timestamp)
                .toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'})}
            </span>
            <span>{update.message}</span>
          </div>
        ))}
      </div>
    </div>
  </div>
)}
```

## 5. Example Status Update Flow

Here's what a typical status update sequence looks like:

```
04:27:19 PM - Processing request...
04:27:20 PM - Using model provider: ollama
04:27:20 PM - Initializing chat processing...
04:27:20 PM - Retrieving available tools...
04:27:21 PM - Processing with sequential thinking...
04:27:21 PM - Adding sequential thinking tool...
04:27:21 PM - Running thinking step 1...
04:27:23 PM - Step 1: Executing 1 tool(s) - python-execute_python
04:27:23 PM - Executing tool: python-execute_python...
04:27:23 PM - Tool python-execute_python: Runtime error - LLM will retry
04:27:24 PM - Continuing to step 2 - LLM requested more tool calls
04:27:24 PM - Running thinking step 2...
04:27:26 PM - Step 2: Executing 1 tool(s) - python-execute_python
04:27:26 PM - Executing tool: python-execute_python...
04:27:27 PM - Tool python-execute_python: Runtime error - LLM will retry
04:27:27 PM - Continuing to step 3 - LLM requested more tool calls
04:27:27 PM - Running thinking step 3...
04:27:29 PM - Step 3: Executing 1 tool(s) - python-execute_python
04:27:29 PM - Executing tool: python-execute_python...
04:27:30 PM - Tool python-execute_python: Executed successfully
04:27:30 PM - Continuing to step 4 - LLM requested more tool calls
```

## 6. Technical Implementation Details

### HTTP Chunked Transfer Encoding

The system uses HTTP chunked transfer encoding to stream data:

1. **Server**: `res.write()` sends immediate chunks
2. **Client**: `fetch()` with response body reader processes chunks
3. **Parsing**: Each line is parsed as separate JSON object
4. **State Updates**: Zustand store updates trigger React re-renders

### Error Handling

Status updates include error detection and reporting:

```typescript
// Tool execution error detection
if (textContent && typeof textContent === 'string') {
  if (textContent.includes('Error:') || textContent.includes('SyntaxError') || textContent.includes('Traceback')) {
    if (textContent.includes('SyntaxError')) {
      statusHandler?.(`Tool ${toolCall.name}: Syntax error detected - LLM will attempt to fix`);
    } else if (textContent.includes('Docker container exited')) {
      statusHandler?.(`Tool ${toolCall.name}: Runtime error - LLM will retry`);
    } else {
      statusHandler?.(`Tool ${toolCall.name}: Error occurred - ${textContent.substring(0, 100)}...`);
    }
  } else {
    statusHandler?.(`Tool ${toolCall.name}: Executed successfully`);
  }
}
```

### Performance Considerations

1. **Immediate Streaming**: No buffering delays
2. **Efficient State Updates**: Only updates relevant message
3. **Memory Management**: Status updates are preserved but not duplicated
4. **UI Optimization**: Conditional rendering based on streaming state

## 7. Debugging and Monitoring

### Server-Side Logging

All status updates are logged to console:

```typescript
console.log(`[MAIN] Status Update: ${status}`);
```

### Client-Side Debugging

Stream processing includes debug logging:

```typescript
console.log('[STREAM DEBUG] Processing line:', line);
console.log(`[STREAM DEBUG] Received chunk type:`, data.type);
```

### Status Update Tracking

Each update includes:
- Unique ID for tracking
- Precise timestamp
- Message content
- Processing context

This comprehensive system provides users with real-time visibility into the chat processing pipeline, from initial request through tool execution to final response generation. 