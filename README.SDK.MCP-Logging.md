# MCP SDK Logging System Analysis

## Structure of the MCP SDK

The ModelContextProtocol SDK is located at `/Users/andycrouse/Documents/GitHub/charm-mcp/node_modules/@modelcontextprotocol/sdk/` and has the following structure:

- `dist/` - Compiled code
  - `esm/` - ES Modules version
    - `server/` - Server-side implementation
    - `client/` - Client-side implementation
    - `shared/` - Shared utilities and protocols
    - `types.js` and `types.d.ts` - Type definitions

## Server Implementation

In the server implementation (`dist/esm/server/index.js`), we found:

1. The `Server` class extends the `Protocol` class from `shared/protocol.js`

2. The `sendLoggingMessage` method is defined as:
```javascript
async sendLoggingMessage(params) {
    return this.notification({ method: "notifications/message", params });
}
```

3. The `Server` class has a method `assertNotificationCapability` that ensures the server has the required capabilities for sending certain types of notifications:
```javascript
assertNotificationCapability(method) {
    switch (method) {
        case "notifications/message":
            if (!this._capabilities.logging) {
                throw new Error(`Server does not support logging (required for ${method})`);
            }
            break;
        // other cases...
    }
}
```

## Client Implementation

In the client implementation (`dist/esm/client/index.js`), we found:

1. The `Client` class extends the same `Protocol` class as the server

2. The client has a method to set the logging level:
```javascript
async setLoggingLevel(level, options) {
    return this.request({ method: "logging/setLevel", params: { level } }, EmptyResultSchema, options);
}
```

3. The client doesn't seem to have explicit methods for handling log messages, suggesting that:
   - Log message handling might be done via the generic notification handling in the Protocol class
   - Custom handlers need to be registered for the "notifications/message" method

4. The client's `assertNotificationCapability` method doesn't specifically check for logging capabilities

## Notification Protocol

In the shared protocol implementation (`dist/esm/shared/protocol.js`), we found:

1. The `Protocol` class contains a method for sending notifications:
```javascript
async notification(notification) {
    if (!this._transport) {
        throw new Error("Not connected");
    }
    this.assertNotificationCapability(notification.method);
    const jsonrpcNotification = {
        ...notification,
        jsonrpc: "2.0",
    };
    await this._transport.send(jsonrpcNotification);
}
```

2. The Protocol class handles incoming notifications through the `_onnotification` method, which calls registered handlers:
```javascript
_onnotification(notification) {
    const handler = this._notificationHandlers.get(notification.method) ?? this.fallbackNotificationHandler;
    // Ignore notifications not being subscribed to.
    if (handler === undefined) {
        return;
    }
    // Starting with Promise.resolve() puts any synchronous errors into the monad as well.
    Promise.resolve()
        .then(() => handler(notification))
        .catch((error) => this._onerror(new Error(`Uncaught error in notification handler: ${error}`)));
}
```

3. Handlers for notifications can be registered using the `setNotificationHandler` method:
```javascript
setNotificationHandler(notificationSchema, handler) {
    this.assertCanSetNotificationHandler(notificationSchema.shape.method.value);
    this._notificationHandlers.set(notificationSchema.shape.method.value, handler);
}
```

## Our Application Implementation

In our application code, we found:

1. **MCPClient Implementation** (`src/mcp/client.ts`):
   - Our custom `MCPClient` class wraps the SDK's `Client` class
   - It sets up a notification handler by overriding the `client.notification` method:
   ```typescript
   this.client.notification = async (notification: { method: string; params?: unknown }) => {
     console.log(`[MCP-DEBUG] ${config.name} received notification:`, notification.method);
     if (notification.method === 'notifications/message') {
       try {
         const logMessage = z.object({
           level: z.enum(['debug', 'info', 'notice', 'warning', 'error', 'critical', 'alert', 'emergency']),
           logger: z.string().optional(),
           data: z.record(z.unknown()).optional()
         }).parse(notification.params);

         console.log(`[MCP-DEBUG] ${config.name} parsed log message:`, logMessage);
         if (this.onLogMessage) {
           console.log(`[MCP-DEBUG] ${config.name} forwarding to handler`);
           this.onLogMessage(logMessage);
         } else {
           console.log(`[MCP-DEBUG] ${config.name} no handler available for log message`);
         }
       } catch (error) {
         console.error(`[MCP-DEBUG] ${config.name} invalid log message format:`, error);
       }
     }
   };
   ```

2. **MCP Service Implementation** (`src/server/services/mcp.ts`):
   - The `MCPService` class manages multiple MCP clients
   - It has a `handleMCPNotification` method that processes notifications from clients:
   ```typescript
   private handleMCPNotification(serverName: string, notification: { method: string; params?: unknown }) {
     // ... logging and tracing ...
     
     if (notification.method === 'notifications/message' && notification.params) {
       try {
         const logMessage = notification.params as MCPLogMessage;
         
         // Validate required fields
         if (!logMessage.level) {
           console.error(`[CLIENT-NOTIFICATION:${traceId}] ❌ MISSING REQUIRED FIELD 'level' IN LOG MESSAGE`);
           return;
         }
         
         if (this.logMessageHandler) {
           try {
             // Call the handler which should forward to chat.ts
             this.logMessageHandler(logMessage);
           } catch (handlerError) {
             console.error(`[CLIENT-NOTIFICATION:${traceId}] ❌ ERROR IN HANDLER:`, handlerError);
           }
         } else {
           console.warn(`[CLIENT-NOTIFICATION:${traceId}] ❌ NO LOG MESSAGE HANDLER AVAILABLE`);
         }
       } catch (error) {
         console.error(`[CLIENT-NOTIFICATION:${traceId}] ❌ ERROR PARSING LOG MESSAGE:`, error);
       }
     }
   }
   ```

3. **Log Message Handler Setup**:
   - The `setLogMessageHandler` method in `MCPService` sets a handler for log messages:
   ```typescript
   setLogMessageHandler(handler: (message: MCPLogMessage) => void) {
     // ... logging and tracing ...
     
     // Store the handler
     this.logMessageHandler = handler;
     
     // Set handler for existing clients
     for (const [serverName, client] of this.mcpClients.entries()) {
       if ('notification' in client) {
         client.notification = async (notification: { method: string; params?: unknown }) => {
           this.handleMCPNotification(serverName, notification);
         };
       }
     }
   }
   ```

## Key Findings

1. **Logging Method Implementation**:
   - The `sendLoggingMessage` method in the `Server` class is a wrapper around the general `notification` method
   - It explicitly sets the method to `"notifications/message"` 
   - The `Server` class ensures that logging capability is declared before allowing notifications/message

2. **Notification Flow**:
   - When `sendLoggingMessage` is called, it creates a notification with method `"notifications/message"`
   - This notification is sent through the transport layer (which is typically StdioServerTransport)
   - The client side would need to register a handler for the `"notifications/message"` method to receive these logs

3. **Types and Interfaces**:
   - The `LoggingMessageNotification` type is referenced in the server's type definitions but we couldn't find its exact definition
   - The logging system appears to be part of the protocol but isn't extensively documented

4. **Client-Side Logging**:
   - The client has a method to set the logging level (`setLoggingLevel`) but doesn't have explicit methods for receiving logs
   - Log message reception would need to be handled via custom notification handlers

5. **Our Implementation**:
   - Our code correctly sets up notification handlers for the `"notifications/message"` method
   - The `MCPService` properly forwards log messages to the registered handler
   - The logs from the server are being sent with the correct method (`"notifications/message"`)
   - Our diagnostic logs show that the MCP server is sending logs, but they might not be reaching the client or being processed correctly

## Discrepancies with Documentation

There seems to be a mismatch between the SDK implementation and some documentation:

1. The SDK implementation uses `sendLoggingMessage` which internally uses the `notification` method with `"notifications/message"` as the method
   
2. The `README.INFO.MCPLogging.md` documentation suggests using `server.notify("notifications/message", ...)` directly which isn't a method on the `Server` class

## Implications for Our Code

1. **Server-Side Implementation**:
   - Our medik-mcp server was correctly using `server.sendLoggingMessage()` to send logs
   - The server properly declared logging capabilities in its initialization
   
2. **Client-Side Implementation**:
   - The MCP client needs to register a handler specifically for the `"notifications/message"` method
   - This handler should then forward the logs to the appropriate destination (global handler, chat route, etc.)
   
3. **Payload Format**:
   - The format we're using for the log payload appears correct, though we added an extra `method: "logging/message"` field
   - This extra field might be unnecessary or even potentially causing confusion in the notification handler

## Conclusion

The MCP SDK's logging system is implemented through the `sendLoggingMessage` method, which sends a notification with the method `"notifications/message"`. This appears to be the correct way to send logs from an MCP server to clients.

There is a standard format to be followed for the log message payload, which should include:
- `level`: The log level (debug, info, notice, warning, error, etc.)
- `logger`: The name of the logger
- `data`: An object containing at least a `message` field and potentially other metadata

The implementation in our medik-mcp server was correctly using `sendLoggingMessage`, and our addition of `method: "logging/message"` in the payload might have been unnecessary or potentially causing confusion in the handling code.

## Potential Fixes

To fix the issue with logs not being received, we should focus on:

1. **Client-Side Notification Handling**:
   - Ensure the MCP client correctly registers a handler for `"notifications/message"`
   - Check if the client's notification handler is properly distinguishing log messages

2. **Log Payload Format**:
   - Remove the potentially unnecessary `method: "logging/message"` field from the data payload
   - Ensure the log payload structure matches what the client handler expects

3. **Transport and Connection Issues**:
   - Verify that notifications are being sent through the transport layer
   - Check if there are any connection or serialization issues

4. **Notification Method Verification**:
   - Log the method and structure of all notifications received by the client
   - Verify that log messages are coming through with the expected method (`"notifications/message"`) 