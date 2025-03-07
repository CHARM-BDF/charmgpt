# MCP Server Status Updates Implementation Guide

## Overview
This document outlines the complete flow of status updates in the MCP server system, from server-side generation to client-side display.

## Server-Side Implementation (src/server/routes/chat.ts)

### 1. Status Update Generation
```typescript
// Helper function to send status updates
const sendStatusUpdate = (status: string) => {
  res.write(JSON.stringify({ 
    type: 'status', 
    message: status,
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString()
  }) + '\n');
};
```

### 2. Key Status Update Points
1. **Initialization**
   ```typescript
   sendStatusUpdate('Initializing request...');
   ```

2. **Pinned Graph Processing**
   ```typescript
   if (pinnedGraph) {
     sendStatusUpdate('Processing pinned knowledge graph...');
     // ... processing ...
     sendStatusUpdate('Knowledge graph retrieved');
   }
   ```

3. **Message History Preparation**
   ```typescript
   sendStatusUpdate('Preparing message history...');
   ```

4. **MCP Server Connection**
   ```typescript
   sendStatusUpdate('Connecting to MCP server...');
   ```

5. **Tool Execution**
   ```typescript
   sendStatusUpdate(`Executing tool: ${toolName} on server: ${serverName}...`);
   ```

6. **Response Processing**
   ```typescript
   sendStatusUpdate('Processing response format...');
   sendStatusUpdate('Adding bibliography...');
   sendStatusUpdate('Adding knowledge graph...');
   sendStatusUpdate('Processing binary outputs...');
   sendStatusUpdate('Finalizing response...');
   ```

## Client-Side Implementation (src/store/chatStore.ts)

### 1. Status Update Processing
```typescript
const processStatusUpdate = (data: { message: string; id?: string; timestamp?: string }) => {
  set((state: ChatState) => {
    const assistantMessage = state.messages.find(msg => msg.id === assistantMessageId);
    
    // Create new status update
    const newUpdate: StatusUpdate = {
      id: data.id || crypto.randomUUID(),
      message: data.message,
      timestamp: data.timestamp ? new Date(data.timestamp) : new Date()
    };
    
    // Update messages with new status update
    const updatedMessages = state.messages.map(msg => {
      if (msg.id === assistantMessageId) {
        const existingUpdates = Array.isArray(msg.statusUpdates) ? msg.statusUpdates : [];
        return {
          ...msg,
          statusUpdates: [...existingUpdates, newUpdate],
          statusUpdatesCollapsed: false,
          isLastStatusUpdate: data.message === 'Finalizing response...'
        };
      }
      return msg;
    });
    
    return { messages: updatedMessages };
  });
};
```

### 2. Status Update Preservation
```typescript
// CRITICAL: Capture status updates BEFORE artifact processing
const beforeFinalMsg = get().messages.find(msg => msg.id === assistantMessageId);
const savedStatusUpdates = beforeFinalMsg?.statusUpdates || [];

// Later, merge with any new updates
const finalStatusUpdates = [...savedStatusUpdates];
if (currentMsg?.statusUpdates && currentMsg.statusUpdates.length > 0) {
  const lastPreservedTime = savedStatusUpdates.length > 0 
    ? savedStatusUpdates[savedStatusUpdates.length - 1].timestamp.getTime() 
    : 0;
  
  const newUpdates = currentMsg.statusUpdates.filter(update => {
    const updateTime = update.timestamp instanceof Date 
      ? update.timestamp.getTime() 
      : new Date(update.timestamp).getTime();
    return updateTime > lastPreservedTime;
  });
  
  finalStatusUpdates.push(...newUpdates);
}
```

## UI Implementation (src/components/chat/ChatMessages.tsx)

### 1. Status Updates Display
```typescript
{message.statusUpdates && message.statusUpdates.length > 0 && (
  <div className="mt-2">
    {!message.thinking && (
      <button
        onClick={() => toggleStatusUpdatesCollapsed(message.id)}
        className="text-xs text-gray-500 hover:text-gray-700"
      >
        {message.statusUpdatesCollapsed ? 'Show' : 'Hide'} processing steps
      </button>
    )}
    
    {(!message.statusUpdatesCollapsed || message.thinking) && (
      <div className="mt-1 rounded-md bg-blue-50 p-2">
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
    )}
  </div>
)}
```

## Critical Implementation Notes

### 1. State Preservation
- Always capture status updates before any async operations
- Use immutable state updates to prevent data loss
- Preserve updates during artifact processing
- Merge new updates with preserved updates based on timestamps

### 2. UI Considerations
- Status updates are always expanded during streaming
- Updates can be collapsed after completion
- Each update shows timestamp and message
- Updates are displayed in a blue formatted box

### 3. Common Pitfalls to Avoid
- Don't capture status updates too late in the process
- Don't mutate state directly, always create new objects
- Don't lose updates during artifact processing
- Don't forget to merge new updates with preserved ones

### 4. Debugging Tips
- Log status update counts at each stage
- Track message IDs throughout the process
- Monitor state transitions
- Verify update preservation after async operations

## Testing Checklist
1. Verify status updates appear during streaming
2. Confirm updates are preserved after completion
3. Test collapsing/expanding updates
4. Verify timestamps are displayed correctly
5. Check update preservation during artifact processing
6. Test with multiple concurrent updates
7. Verify updates persist after page refresh 