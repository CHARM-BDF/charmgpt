# MCP Logging System Troubleshooting Guide

This document provides a comprehensive guide for troubleshooting the MCP (Model Context Protocol) logging system based on our successful minimal implementation. It details the expected behavior, communication flow, message formats, and common issues to help diagnose and fix problems in the main application's logging system.

## Table of Contents

1. [System Architecture](#system-architecture)
2. [Communication Flow](#communication-flow)
3. [Message Formats](#message-formats)
4. [Expected Behavior](#expected-behavior)
5. [Common Issues](#common-issues)
6. [Minimal Implementation Reference](#minimal-implementation-reference)
7. [Debugging Steps](#debugging-steps)
8. [Implementation Comparison](#implementation-comparison)

## System Architecture

The MCP logging system consists of three main components:

1. **MCP Servers**: Generate log messages of various levels (debug, info, warning, error)
2. **Main Server**: Receives, processes, and forwards log messages
3. **Web Client**: Displays log messages in a user-friendly interface

## Communication Flow

The correct communication flow for the MCP logging system is:

1. MCP servers generate log messages
2. MCP servers send log messages to the main server using JSON-RPC notifications
3. Main server receives and parses these notifications
4. Main server formats the log messages
5. Main server forwards the formatted messages to connected WebSocket clients
6. Web clients display the messages with appropriate styling

## Message Formats

### MCP Server to Main Server (JSON-RPC)

MCP servers should send log messages in this JSON-RPC notification format:

```json
{
  "method": "notifications/message",
  "params": {
    "level": "debug|info|notice|warning|error",
    "logger": "server-name",
    "data": {
      "message": "[SERVER-NAME] [LEVEL] [traceId] Message content",
      "timestamp": "2025-03-07T00:50:50.062Z",
      "traceId": "8589ade1",
      "level": "debug|info|notice|warning|error",
      "method": "logging/message",
      "source": "timer",
      "additionalData": "any-additional-data"
    }
  },
  "jsonrpc": "2.0"
}
```

Key fields:
- `level`: Log severity level
- `logger`: Source of the log (MCP server name)
- `data.message`: Formatted log message
- `data.timestamp`: ISO timestamp
- `data.traceId`: Unique identifier for the log message
- Additional metadata can be included in the data object

### Main Server to WebSocket Clients

The main server should forward logs to WebSocket clients in this format:

```json
{
  "type": "log",
  "timestamp": "2025-03-07T00:50:50.062Z",
  "logger": "server-name",
  "level": "debug|info|notice|warning|error",
  "message": "[LEVEL] [traceId] Message content",
  "traceId": "8589ade1",
  "metadata": {
    "timestamp": "2025-03-07T00:50:50.062Z",
    "traceId": "8589ade1",
    "level": "debug|info|notice|warning|error",
    "method": "logging/message",
    "source": "timer",
    "additionalData": "any-additional-data"
  }
}
```

## Expected Behavior

When the logging system is working correctly, you should observe:

1. **Console Output**:
   - MCP server sending log messages: `[SERVER-NAME] Sending log: Message content`
   - JSON-RPC notifications in the console
   - Main server receiving log messages: `[MAIN:traceId] Received log message from MCP server`
   - Main server forwarding logs: `[MAIN:traceId] Forwarding log to X clients`

2. **Web Client**:
   - Real-time log updates
   - Proper formatting based on log level
   - Ability to filter logs by level
   - Metadata display when clicking on log entries

## Common Issues

### 1. MCP Server Not Sending Logs

**Symptoms**:
- No log messages in the console
- No JSON-RPC notifications visible

**Possible Causes**:
- MCP server not initialized correctly
- Logging functionality not implemented
- Incorrect JSON-RPC format

**Solution**:
- Verify MCP server initialization
- Check that the server has a logging method
- Ensure JSON-RPC notifications use the correct format

### 2. Main Server Not Receiving Logs

**Symptoms**:
- MCP server sends logs, but no "Received log message" entries in the console
- No forwarding messages

**Possible Causes**:
- Incorrect parsing of JSON-RPC notifications
- Missing or incorrect notification handler
- Communication channel issues

**Solution**:
- Verify JSON-RPC parsing logic
- Check notification handler registration
- Ensure the communication channel is working

### 3. Logs Not Forwarded to Clients

**Symptoms**:
- Main server receives logs but shows "Forwarding log to 0 clients"
- No logs appear in the web interface

**Possible Causes**:
- No WebSocket clients connected
- WebSocket server not initialized
- Incorrect message format sent to clients

**Solution**:
- Verify WebSocket server initialization
- Check client connections
- Ensure correct message format

### 4. Port Conflicts

**Symptoms**:
- Error: `listen EADDRINUSE: address already in use :::PORT`
- Server crashes on startup

**Solution**:
- Use a different port (e.g., 3002 instead of 3001)
- Set `NODE_ENV=test` to prevent multiple server instances
- Kill existing processes using the port

## Minimal Implementation Reference

Our minimal implementation demonstrates the correct behavior:

### MCP Server Log Generation

The MCP server generates logs in a continuous cycle:

1. **Debug logs**:
   ```json
   {"method":"notifications/message","params":{"level":"debug","logger":"test-mcp","data":{"message":"[DEBUG] [8589ade1] Debug log message","timestamp":"2025-03-07T00:50:50.062Z","traceId":"8589ade1","source":"timer","count":52}}}
   ```

2. **Info logs**:
   ```json
   {"method":"notifications/message","params":{"level":"info","logger":"test-mcp","data":{"message":"[INFO] [95be0bc5] Info log message","timestamp":1741308656059,"traceId":"95be0bc5","source":"timer"}}}
   ```

3. **Warning logs**:
   ```json
   {"method":"notifications/message","params":{"level":"warning","logger":"test-mcp","data":{"message":"[WARNING] [f4e530aa] Warning log message","timestamp":"2025-03-07T00:50:53.057Z","traceId":"f4e530aa","source":"timer","alert":true}}}
   ```

4. **Error logs**:
   ```json
   {"method":"notifications/message","params":{"level":"error","logger":"test-mcp","data":{"message":"[ERROR] [c4f03087] Error log message","timestamp":"2025-03-07T00:50:56.056Z","traceId":"c4f03087","source":"timer","errorCode":"ERR_313"}}}
   ```

### Main Server Log Processing

The main server processes logs through these steps:

1. **Parse log messages**:
   ```javascript
   mcpProcess.stdout.on('data', (data) => {
     const output = data.toString().trim();
     if (output.includes('"method":"notifications/message"')) {
       const jsonStart = output.indexOf('{"method');
       if (jsonStart >= 0) {
         const jsonStr = output.substring(jsonStart);
         const notification = JSON.parse(jsonStr);
         if (notification.params && notification.method === 'notifications/message') {
           handleLogMessage(notification.params);
         }
       }
     }
   });
   ```

2. **Format logs**:
   ```javascript
   const formattedMessage = {
     type: 'log',
     timestamp: new Date().toISOString(),
     logger: message.logger || 'unknown',
     level: message.level,
     message: message.data?.message || JSON.stringify(message.data),
     traceId,
     metadata: message.data || {}
   };
   ```

3. **Forward logs**:
   ```javascript
   clients.forEach(client => {
     if (client.readyState === WebSocket.OPEN) {
       client.send(messageStr);
       sentCount++;
     }
   });
   ```

## Debugging Steps

If you're experiencing issues with the main application's logging system, follow these steps:

1. **Verify MCP Server Log Generation**:
   - Check if MCP servers are generating logs
   - Verify the JSON-RPC notification format
   - Look for debug output from the MCP servers

2. **Check Main Server Log Reception**:
   - Verify the notification handler is registered
   - Check parsing logic for JSON-RPC messages
   - Look for "Received log message" entries in the console

3. **Inspect WebSocket Communication**:
   - Verify WebSocket server initialization
   - Check for client connections
   - Inspect message format sent to clients

4. **Compare with Minimal Implementation**:
   - Use the minimal implementation as a reference
   - Compare message formats and communication flow
   - Identify differences that might cause issues

5. **Isolate Components**:
   - Test MCP servers independently
   - Verify main server functionality with test messages
   - Check client display with mock data

By following these steps and comparing with our successful minimal implementation, you should be able to identify and fix issues in the main application's logging system.

## Implementation Comparison

This section compares the minimal implementation with the main application to help identify potential issues in the logging system.

### Key Files Involved in MCP SDK Integration

#### Server-Side Files:

1. **Main Application:**
   - `src/server/index.ts` - Sets up the global log handler and initializes the MCP service
   - `src/server/services/mcp.ts` - Implements the MCPService class that manages MCP clients and handles notifications
   - `src/server/routes/chat.ts` - Implements the chat route that handles MCP log messages and sends them as status updates
   - `src/mcp/client.ts` - Implements the MCP client wrapper
   - `src/mcp/contextManager.ts` - Manages MCP context
   - `src/mcp/types.ts` - Defines MCP-related types

2. **Minimal System:**
   - `custom-mcp-servers/minimal-mcp-logging/minimal-server/src/index.ts` - Implements a simple server that spawns MCP processes and forwards logs to clients
   - `custom-mcp-servers/minimal-mcp-logging/minimal-server/src/config.ts` - Configuration for the minimal server
   - `custom-mcp-servers/minimal-mcp-logging/minimal-mcp/src/index.ts` - Implements a simple MCP server that sends log messages

#### Client-Side Files:

1. **Main Application:**
   - `src/store/chatStore.ts` - Manages chat state including status updates (which contain MCP logs)
   - `src/types/chat.ts` - Defines chat-related types including StatusUpdate
   - Various components that display status updates

2. **Minimal System:**
   - `custom-mcp-servers/minimal-mcp-logging/minimal-client/index.html` - Simple HTML/JS client that displays logs from WebSocket

### Key Differences in Implementation

1. **Log Message Handling:**
   - **Minimal System:** Directly parses JSON from stdout, extracts log messages, and forwards them to clients via WebSocket
   - **Main Application:** Uses the SDK's notification system, with a global log handler that forwards messages to chat routes, which then send them as status updates

2. **Client Display:**
   - **Minimal System:** Dedicated log viewer with filtering and formatting
   - **Main Application:** Logs are displayed as status updates in the chat interface

3. **Transport:**
   - **Minimal System:** Uses WebSocket for client communication
   - **Main Application:** Uses SSE (Server-Sent Events) for streaming responses including status updates

4. **Log Message Format:**
   - **Minimal System:** Structured format with level, logger, message, timestamp, traceId, and metadata
   - **Main Application:** Logs are converted to status updates with a message, id, and timestamp

### Key Insights for Troubleshooting

1. **Architectural Complexity:**
   The main application has more layers of abstraction in its logging system. Logs pass through multiple handlers (global handler → chat route handler → status update), which increases the potential points of failure.

2. **Integration vs. Dedicated Approach:**
   The minimal system has a direct, purpose-built approach to log handling, while the main application integrates logs into the existing status update system. This integration might obscure log messages among other status updates.

3. **Visibility Differences:**
   The minimal system has a dedicated UI for log display with filtering and formatting, making logs more visible and manageable. In the main application, logs appear as status updates in the chat interface, which might make them less noticeable.

4. **SDK Usage:**
   Both systems use the same SDK functions (`sendLoggingMessage` in MCP servers, notification handlers in clients), but the implementation details differ. The main application's more complex implementation might be affected by SDK version changes.

5. **Debugging Approach:**
   When troubleshooting the main application, it's helpful to compare each step of the log flow with the minimal system:
   - Is the MCP server sending logs in the correct format?
   - Is the notification handler receiving and processing logs correctly?
   - Is the chat route receiving logs from the global handler?
   - Are status updates being sent to the client?
   - Is the client displaying the status updates properly?

By comparing these specific aspects between the two implementations, you can identify where the main application's logging system might be failing and apply targeted fixes.

## Console Output Reference

When the system is working correctly, you should see console output similar to this:

```
[test-mcp-STDOUT] [TEST-MCP] Sending log: Debug log message
[test-mcp-STDOUT] {"method":"notifications/message","params":{"level":"debug","logger":"test-mcp","data":{"message":"[DEBUG] [8589ade1] Debug log message","timestamp":"2025-03-07T00:50:50.062Z","traceId":"8589ade1","source":"timer","count":52}},"jsonrpc":"2.0"}
[MAIN:8589ade1] Received log message from MCP server
[MAIN:8589ade1] Logger: test-mcp
[MAIN:8589ade1] Level: debug
[MAIN:8589ade1] Message: [DEBUG] [8589ade1] Debug log message
[MAIN:8589ade1] Forwarding log to 1 clients
[MAIN:8589ade1] Log forwarded to 1/1 clients
```

This indicates:
1. The MCP server is sending a debug log
2. The JSON-RPC notification is properly formatted
3. The main server receives and parses the log
4. The main server forwards the log to one connected client
5. The forwarding is successful

If your output differs significantly from this pattern, use the debugging steps above to identify and fix the issues. 