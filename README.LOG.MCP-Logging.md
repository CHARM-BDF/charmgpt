# MCP Logging System: Troubleshooting Log

## Problem Statement

The logging system between the MCP server and the main application was not functioning as expected. Specifically:

- Logs were being sent from the MCP server (medik-mcp)
- The logs were visible in the console output of the MCP server
- However, logs were not being properly transmitted to the `@chat.ts` route
- The existing implementation successfully sends logs from `@chat.ts` to the client

## Architecture Overview

The MCP logging system follows this flow:

1. **MCP Server** (e.g., medik-mcp) sends logs using `server.sendLoggingMessage()`
2. **MCP Service** in the main server receives notifications and processes them in `handleMCPNotification()`
3. **MCP Service** calls the appropriate log message handler:
   - Global handler in server/index.ts (for all logs)
   - Chat-specific handler in server/routes/chat.ts (for active chat sessions)
4. **Chat Route** forwards logs to the client via `sendStatusUpdate()` during active chat sessions

## Investigation Process

### Initial Diagnostics

1. Enhanced logging at various points in the system:
   - MCP Service notification handler
   - Global log message handler
   - Chat route log message handler
   - MCP Server log sending functions

2. Added unique trace IDs to track logs through the system

3. Implemented diagnostic test logs at MCP server startup to verify the notification pathway

### SDK Analysis

We performed a thorough analysis of the MCP SDK to understand how logging is implemented:

1. **Server Implementation**:
   - The `sendLoggingMessage` method in the SDK's `Server` class is a wrapper around the general `notification` method
   - It explicitly sets the method to `"notifications/message"`
   - The server requires the `logging` capability to be declared before allowing notifications/message

2. **Client Implementation**:
   - The SDK's `Client` class doesn't have explicit methods for handling log messages
   - Log message reception is handled via the generic notification handling mechanism
   - Clients need to register a handler for the `"notifications/message"` method

3. **Our Implementation**:
   - Our custom `MCPClient` class correctly sets up notification handlers for `"notifications/message"`
   - The `MCPService` properly forwards log messages to the registered handler
   - The logs from the server are being sent with the correct method (`"notifications/message"`)

### Key Findings

1. **Documentation vs. Implementation Mismatch**:
   - The README documentation suggested using `server.notify("notifications/message", ...)` to send logs
   - However, the SDK actually provides a dedicated `server.sendLoggingMessage()` method
   - The MCP server was correctly using `sendLoggingMessage()`, but we initially thought this was incorrect

2. **SDK Method Availability**:
   - The Server class from the MCP SDK includes `sendLoggingMessage()` but does NOT have `notify()` or `sendNotification()` methods
   - This caused type errors when we attempted to implement the approach from the documentation

3. **Log Message Format**:
   - The log payload should include a `method: "logging/message"` field to ensure proper routing
   - Each log should have a unique trace ID to track it through the system

4. **Notification Processing**:
   - The MCP Service properly receives notifications through `handleMCPNotification()`
   - Log messages are identified by checking if they match the expected format
   - When a log message handler is set, it's called with the log message payload

5. **Log Flow Analysis**:
   - Our logs show that the MCP server is successfully sending logs
   - The logs are being received as notifications by the MCP service
   - However, they don't appear to be reaching the global handler or chat route handler
   - This suggests an issue with how the log message handler is being set or called

## Solutions Implemented

1. **Enhanced MCP Server Logging**:
   - Added detailed tracing for log message sending
   - Made the log payload structure explicit, including the `method: "logging/message"` field
   - Improved error handling and fallback to console logging

2. **Improved MCP Service Notification Handling**:
   - Enhanced the `handleMCPNotification()` method with better tracing
   - Added validation for log message format
   - Incorporated unique trace IDs for each log message

3. **Enhanced Log Message Handler Management**:
   - Added detailed logging for when and how handlers are set
   - Improved context in log messages

4. **Diagnostic Tools**:
   - Added diagnostic test logs at MCP server startup
   - Implemented multiple log sending methods to test different pathways
   - Created unique identifiers for diagnostic sessions

## Key Lessons Learned

1. **SDK Implementation Details Matter**:
   - The SDK's actual implementation may differ from documentation
   - Always verify available methods before making changes
   - Type checking can reveal important discrepancies

2. **Logging System Complexity**:
   - The flow of logs through a distributed system involves multiple components
   - Each component must properly handle and forward the logs
   - Tracing with unique IDs is essential for debugging

3. **Multiple Log Handlers**:
   - The system supports both global and route-specific log handlers
   - Understanding which handler processes which logs is critical

4. **Log Payload Structure**:
   - The structure of log payloads must be consistent
   - Including method information in the payload helps with routing

## Recommendations for Future Development

1. **Standardize Log Format**:
   - Use a consistent format for all logs across the system
   - Always include trace IDs, timestamps, log levels, and source information

2. **Enhance Documentation**:
   - Update documentation to reflect the actual SDK methods available
   - Provide clear examples of proper log sending and receiving

3. **Improve Error Handling**:
   - Implement robust error handling at each step of the logging process
   - Ensure errors in log handling don't impact application functionality

4. **Monitoring and Visualization**:
   - Consider implementing a log visualization system for easier debugging
   - Add metrics to track log flow through the system

## Technical Reference

### Correct Log Sending Method

```typescript
// Using the SDK's sendLoggingMessage method
server.sendLoggingMessage({
  level: 'info',
  logger: 'MEDIK',
  data: {
    message: formattedMessage,
    timestamp: timestamp,
    traceId: traceId,
    method: "logging/message", // Important for routing
    // Other metadata...
  },
});
```

### Log Message Handler Setup

```typescript
// Setting up a log message handler
mcpService.setLogMessageHandler((message) => {
  const traceId = message.data?.traceId || randomUUID().split('-')[0];
  console.log(`[HANDLER:${traceId}] Log message received`);
  
  // Process the log message...
});
```

### MCP Notification Handling

```typescript
// In the MCP service
handleMCPNotification(notification: MCPNotification) {
  // Check if it's a log message
  if (notification.method === 'logging/message' || 
      (notification.params?.data && 'message' in notification.params.data)) {
    // Call the log message handler if set
    if (this.logMessageHandler) {
      this.logMessageHandler(notification.params);
    }
  }
}
``` 