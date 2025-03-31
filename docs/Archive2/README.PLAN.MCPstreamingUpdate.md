# MCP Streaming Updates Implementation Plan

## Overview

This document outlines the implementation plan for adding real-time status updates to the MCP chat interface. The goal is to provide users with immediate feedback about the progress of their requests as they are being processed on the server, rather than leaving them waiting with no feedback until the complete response is returned.

## Current Implementation

Currently, the system works as follows:

1. The client sends a request to the server
2. The server processes the entire request (selecting MCP server, retrieving data, processing, etc.)
3. Once complete, the server returns a single response with all results
4. The client then simulates streaming by breaking the complete response into chunks and displaying them progressively

This approach leaves users waiting with no feedback during server processing, which can take several seconds or longer.

## Proposed Solution: HTTP Response Streaming

We will implement HTTP response streaming to send real-time status updates from the server to the client as processing occurs. This approach:

- Uses standard HTTP features without requiring WebSockets or SSE
- Allows the server to send multiple updates before completing the response
- Provides true real-time feedback about server-side processing
- Requires minimal changes to the existing architecture

## Implementation Details

### 1. Server-Side Changes (src/server/routes/chat.ts)

#### 1.1 Set Up Response for Streaming

```javascript
router.post('/', async (req: Request, res: Response) => {
  // Set headers for streaming
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Transfer-Encoding', 'chunked');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  
  // Helper function to send status updates
  const sendStatusUpdate = (status: string) => {
    res.write(JSON.stringify({ 
      type: 'status', 
      message: status,
      timestamp: new Date().toISOString()
    }) + '\n');
  };
  
  try {
    // Initial status update
    sendStatusUpdate('Initializing request...');
    
    // Rest of the processing code...
```

#### 1.2 Add Status Updates at Key Processing Points

Insert status update calls at strategic points in the processing flow:

```javascript
// When selecting model
sendStatusUpdate('Selecting model...');

// When retrieving pinned graph
if (pinnedGraph) {
  sendStatusUpdate('Retrieving pinned knowledge graph...');
  // Process pinned graph...
  sendStatusUpdate('Knowledge graph retrieved');
}

// Before tool execution
sendStatusUpdate('Executing tools...');

// Before final response generation
sendStatusUpdate('Generating final response...');

// When processing artifacts
sendStatusUpdate('Processing artifacts...');
```

#### 1.3 Send Final Result and End Response

```javascript
// Send the final complete response
res.write(JSON.stringify({ 
  type: 'result',
  response: storeResponse,
  timestamp: new Date().toISOString()
}) + '\n');

// End the response
res.end();
```

#### 1.4 Handle Errors

```javascript
} catch (error) {
  // Send error as a status update
  res.write(JSON.stringify({ 
    type: 'error',
    message: error instanceof Error ? error.message : 'Unknown error',
    timestamp: new Date().toISOString()
  }) + '\n');
  
  // End the response
  res.end();
}
```

### 2. Client-Side Changes (src/store/chatStore.ts)

#### 2.1 Update the Fetch Request to Handle Streaming

```typescript
processMessage: async (content: string) => {
  console.log('ChatStore: Processing message:', content);
  
  set({ isLoading: true, error: null });
  
  try {
    // Create assistant message for status updates
    const assistantMessageId = crypto.randomUUID();
    const assistantMessage: MessageWithThinking = {
      role: 'assistant',
      content: '_Status: Initializing..._\n\n',
      id: assistantMessageId,
      timestamp: new Date()
    };

    // Add assistant message to current conversation
    set(state => {
      const updatedConversation = {
        ...state.conversations[state.currentConversationId!],
        messages: [...state.conversations[state.currentConversationId!].messages, assistantMessage],
        metadata: {
          ...state.conversations[state.currentConversationId!].metadata,
          lastUpdated: new Date(),
          messageCount: state.conversations[state.currentConversationId!].metadata.messageCount + 1
        }
      };

      return {
        messages: updatedConversation.messages,
        conversations: {
          ...state.conversations,
          [state.currentConversationId!]: updatedConversation
        },
        streamingMessageId: assistantMessageId,
        streamingContent: '_Status: Initializing..._\n\n'
      };
    });

    // Get the selected model from the correct store
    const selectedModel = useModelStore.getState().selectedModel;
    
    // Choose the appropriate API endpoint based on the model
    const endpoint = selectedModel === 'ollama' ? API_ENDPOINTS.OLLAMA : API_ENDPOINTS.CHAT;
    const apiUrl = getApiUrl(endpoint);

    // Prepare request body
    const requestBody = JSON.stringify({
      message: content,
      history: get().messages
        .filter(msg => msg.content.trim() !== '')
        .map(msg => ({
          role: msg.role,
          content: msg.content
        })),
      blockedServers: useMCPStore.getState().getBlockedServers(),
      pinnedGraph: get().pinnedGraphId ? 
        get().artifacts.find(a => a.id === get().pinnedGraphId) : 
        null
    });

    // Make fetch request
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: requestBody
    });

    if (!response.ok) {
      throw new Error('Failed to get response from chat API');
    }

    // Process the streaming response
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let finalResponse = null;

    while (true) {
      const { done, value } = await reader.read();
      
      if (done) {
        break;
      }
      
      // Decode the chunk and add to buffer
      buffer += decoder.decode(value, { stream: true });
      
      // Process complete JSON objects
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep the last potentially incomplete line in the buffer
      
      for (const line of lines) {
        if (!line.trim()) continue;
        
        try {
          const data = JSON.parse(line);
          
          if (data.type === 'status') {
            // Update the message with the status
            set(state => ({
              messages: state.messages.map(msg =>
                msg.id === assistantMessageId ? 
                  { ...msg, content: `_Status: ${data.message}_\n\n` } : 
                  msg
              ),
              streamingContent: `_Status: ${data.message}_\n\n`
            }));
          } 
          else if (data.type === 'result') {
            // Store the final response for processing after the loop
            finalResponse = data.response;
          }
          else if (data.type === 'error') {
            throw new Error(data.message);
          }
        } catch (e) {
          console.error('Error parsing chunk:', e, 'Line:', line);
        }
      }
    }

    // Process the final response
    if (finalResponse) {
      const storeResponse = finalResponse;
      const fullContent = storeResponse.conversation;
      
      // Process the rest of the response as in the current implementation...
```

#### 2.2 Process Final Response

The rest of the processing remains similar to the current implementation, but we'll need to update the message that was used for status updates instead of creating a new one.

### 3. Testing Plan

1. **Unit Tests**:
   - Test server-side status update function
   - Test client-side chunk processing logic
   - Test error handling in streaming context

2. **Integration Tests**:
   - Verify status updates appear in the UI
   - Confirm final response is correctly processed
   - Test with slow network conditions
   - Test with connection interruptions

3. **Manual Testing**:
   - Verify status updates are meaningful and timely
   - Check UI rendering of status updates
   - Test with various request complexities

## Implementation Steps

1. **Server-Side Implementation**:
   - Modify chat.ts to support streaming responses
   - Add status update calls at key processing points
   - Update error handling for streaming context

2. **Client-Side Implementation**:
   - Update chatStore.ts to handle streaming responses
   - Implement chunk processing logic
   - Update UI to display status updates

3. **Testing and Refinement**:
   - Test the implementation
   - Refine status update messages
   - Optimize timing and frequency of updates

## Potential Challenges and Mitigations

1. **Proxy Buffering**:
   - Some proxies might buffer chunks, delaying updates
   - Mitigation: Add appropriate headers and ensure chunks are large enough

2. **Connection Stability**:
   - Long-running connections might drop
   - Mitigation: Implement reconnection logic and fallback to non-streaming mode

3. **Parsing Complexity**:
   - Handling partial JSON chunks correctly
   - Mitigation: Use line-based delimiting and robust parsing logic

4. **Browser Compatibility**:
   - Ensure streaming works across browsers
   - Mitigation: Test on major browsers and implement polyfills if needed

## Conclusion

This implementation plan provides a roadmap for adding real-time status updates to the MCP chat interface using HTTP response streaming. This approach offers a good balance between implementation complexity and user experience improvement, providing users with immediate feedback during request processing. 