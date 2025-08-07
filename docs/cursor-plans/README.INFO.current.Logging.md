# MCP Server Logging Architecture

> Understanding how logging flows from MCP servers through the application to the UI

## Overview

The MCP (Model Context Protocol) logging system in this application provides real-time log streaming from MCP servers to the web UI through a sophisticated multi-layer architecture. This document explains how the logging mechanism works, what files are involved, and how the communication flows.

## Architecture Components

### 1. MCP Server (index.ts)
**File: `custom-mcp-servers/medik-mcp2/src/index.ts`**

The MCP server is the source of all logging messages. Here's how it works:

#### Server Initialization
```typescript
// Create the MCP server with logging capabilities
const server = new Server({
  name: 'medik-mcp',
  version: '2.0.0',
}, {
  capabilities: {
    tools: {},
    logging: {},  // ← Enables logging capability
  },
});

// ✅ Set global server reference for logging
mcpServer = server;
```

#### Logging Function
The server uses a centralized logging function that attempts MCP logging first, then falls back to console:

```typescript
function log(message: string, data?: any): void {
  const timestamp = new Date().toISOString();
  const fullMessage = data ? `${message} | Data: ${JSON.stringify(data)}` : message;
  
  // Use MCP logging if server is available, fallback to console
  if (mcpServer) {
    const logPayload = {
      level: 'info' as LoggingLevel,
      logger: 'medik-mcp',
      data: {
        message: fullMessage,
        timestamp: timestamp,
        traceId: Math.random().toString(36).substring(2, 8),
        ...data
      }
    };
    
    mcpServer.sendLoggingMessage(logPayload).then(() => {
      console.error(`✅ sendLoggingMessage() completed successfully`);
    }).catch((error: any) => {
      console.error(`❌ sendLoggingMessage() failed:`, error);
      // Fallback to console if MCP logging fails
      console.error(`[${timestamp}] MEDIK: ${fullMessage}`);
    });
  } else {
    console.error(`[${timestamp}] MEDIK: ${fullMessage}`);
  }
}
```

#### Server Startup
```typescript
async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  
  // Now that server is connected, we can safely use MCP logging
  log('🚀 Starting MediK MCP Server v2.0.0 (Simplified)');
  log('✅ MediK MCP Server connected and ready');
  
  // Send explicit test log message
  mcpServer!.sendLoggingMessage({
    level: 'info',
    logger: 'startup',
    data: {
      message: 'Test MCP log message - server startup complete',
      timestamp: new Date().toISOString(),
      traceId: Math.random().toString(36).substring(2, 8)
    }
  });
}
```

### 2. Chat Route Handler (chat.ts)
**File: `src/server/routes/chat.ts`**

The chat route acts as the bridge between MCP servers and the UI, handling log message routing.

#### MCP Log Message Handler
```typescript
// Helper function to send MCP log messages as status updates
const sendMCPLogMessage = (message: MCPLogMessage) => {
  const timestamp = new Date().toISOString();
  const traceId = crypto.randomUUID().split('-')[0]; // Short unique ID for tracing
  
  console.log(`\n=== [MAIN:${traceId}] [CHAT:LOG-STEP-1] MCP LOG MESSAGE RECEIVED IN CHAT ROUTE ===`);
  console.log(`[MAIN:${traceId}] [CHAT:LOG-STEP-1] Timestamp: ${timestamp}`);
  console.log(`[MAIN:${traceId}] [CHAT:LOG-STEP-1] Logger: ${message.logger || 'MCP'}`);
  console.log(`[MAIN:${traceId}] [CHAT:LOG-STEP-1] Level: ${message.level}`);
  console.log(`[MAIN:${traceId}] [CHAT:LOG-STEP-1] Data:`, message.data);
  
  // Format message for both console and UI
  const formattedMessage = `[${message.logger || 'MCP'}:${traceId}] ${message.data?.message || JSON.stringify(message.data)}`;
  console.log(`[MAIN:${traceId}] [CHAT:LOG-STEP-2] Formatted message: ${formattedMessage}`);
  
  try {
    // Send to UI with trace ID
    console.log(`[MAIN:${traceId}] [CHAT:LOG-STEP-3] Sending to client via sendStatusUpdate`);
    sendStatusUpdate(`[TRACE:${traceId}] ${formattedMessage}`);
    console.log(`[MAIN:${traceId}] [CHAT:LOG-STEP-3] ✅ Status update sent successfully`);
  } catch (error) {
    console.error(`[MAIN:${traceId}] [CHAT:LOG-STEP-3] ❌ Error sending status update: ${error}`);
  }
  
  console.log(`[MAIN:${traceId}] [CHAT:LOG-STEP-4] ================================\n`);
};
```

#### Request-Specific Log Handler Setup
```typescript
// Set MCP log message handler for this request
if (mcpService) {
  console.log('[CHAT-DEBUG] Adding request-specific MCP log handler');
  
  // Add our chat-specific handler (this won't remove the global handler)
  mcpService.addLogHandler(sendMCPLogMessage);
  sendStatusUpdate('MCP log handler enabled - you will receive server logs in this session');
  
  // Remove our handler when the request is complete
  res.on('close', () => {
    console.log('[CHAT-DEBUG] Request closed, removing chat-specific MCP log handler');
    mcpService.removeLogHandler(sendMCPLogMessage);
  });
}
```

#### Status Update Streaming
```typescript
// Helper function to send status updates
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

### 3. MCP Service Layer
**File: `src/services/mcp.ts` (Referenced but not shown)**

The MCPService acts as the intermediary between the chat route and MCP servers:

#### Key Interfaces
```typescript
interface MCPLogMessage {
  level: string;
  logger?: string;
  data?: any;
}
```

#### Handler Management
Based on the usage in chat.ts, the MCPService provides:
- `addLogHandler(handler: Function)` - Add log message handlers
- `removeLogHandler(handler: Function)` - Remove log message handlers
- `getAllAvailableTools(blockedServers)` - Get available MCP tools
- `callTool(serverName, toolName, input)` - Execute MCP tools

## Message Flow Architecture

### 1. MCP Server → MCPService
```
MCP Server (index.ts)
    ↓ sendLoggingMessage()
MCPService
    ↓ Log handlers triggered
Chat Route Handler
```

### 2. Chat Route → UI
```
Chat Route (chat.ts)
    ↓ sendMCPLogMessage()
    ↓ sendStatusUpdate()
HTTP Response Stream
    ↓ JSON status messages
Web UI
```

## Detailed Message Flow

### Step 1: MCP Server Generates Log
```typescript
// In index.ts - MCP server generates a log message
log(`Making API request to MediKanren`, { url, subject, predicate, object });

// This calls sendLoggingMessage() internally
mcpServer.sendLoggingMessage({
  level: 'info',
  logger: 'medik-mcp',
  data: {
    message: fullMessage,
    timestamp: timestamp,
    traceId: Math.random().toString(36).substring(2, 8),
    ...data
  }
});
```

### Step 2: MCPService Receives and Routes
The MCPService (not shown in provided files) likely:
1. Receives the log message from the MCP server via stdio transport
2. Triggers all registered log handlers
3. Passes the message to the chat route's `sendMCPLogMessage` function

### Step 3: Chat Route Processes and Streams
```typescript
// In chat.ts - Chat route receives the log message
const sendMCPLogMessage = (message: MCPLogMessage) => {
  const traceId = crypto.randomUUID().split('-')[0];
  const formattedMessage = `[${message.logger || 'MCP'}:${traceId}] ${message.data?.message || JSON.stringify(message.data)}`;
  
  // Stream to UI as status update
  sendStatusUpdate(`[TRACE:${traceId}] ${formattedMessage}`);
};
```

### Step 4: UI Receives Real-time Updates
```typescript
// In chat.ts - Status updates streamed to UI
const sendStatusUpdate = (status: string) => {
  res.write(JSON.stringify({ 
    type: 'status', 
    message: status,
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString()
  }) + '\n');
};
```

## Key Files and Their Roles

### Core Files

1. **`custom-mcp-servers/medik-mcp2/src/index.ts`**
   - **Role**: MCP Server implementation
   - **Responsibilities**: 
     - Generate log messages
     - Send logs via `sendLoggingMessage()`
     - Execute MCP tools (get-everything, query-with-predicate, get-connecting-paths)

2. **`src/server/routes/chat.ts`**
   - **Role**: HTTP API endpoint and log routing
   - **Responsibilities**:
     - Handle chat requests
     - Set up MCP log handlers per request
     - Stream status updates to UI
     - Convert MCP logs to UI-friendly format

3. **`src/services/mcp.ts`** (Referenced)
   - **Role**: MCP Service abstraction layer
   - **Responsibilities**:
     - Manage MCP server connections
     - Route log messages to handlers
     - Provide tool execution interface

### Supporting Files

4. **`src/services/message.ts`** (Referenced)
   - **Role**: Message formatting and conversion
   - **Responsibilities**:
     - Convert between different message formats
     - Handle conversation state

5. **`src/services/logging.ts`** (Referenced)
   - **Role**: Application-level logging
   - **Responsibilities**:
     - Log HTTP requests/responses
     - General application logging

## Transport Mechanism

### HTTP Streaming
The chat route uses HTTP chunked transfer encoding to stream real-time updates:

```typescript
// Set headers for streaming
res.setHeader('Content-Type', 'application/json');
res.setHeader('Transfer-Encoding', 'chunked');
res.setHeader('Cache-Control', 'no-cache');
res.setHeader('Connection', 'keep-alive');
```

### MCP Transport (stdio)
The MCP server uses stdio transport for communication:

```typescript
// In index.ts
async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // ... rest of setup
}
```

## Error Handling and Fallbacks

### MCP Server Logging Fallback
```typescript
// If MCP logging fails, fall back to console
mcpServer.sendLoggingMessage(logPayload).then(() => {
  console.error(`✅ sendLoggingMessage() completed successfully`);
}).catch((error: any) => {
  console.error(`❌ sendLoggingMessage() failed:`, error);
  // Fallback to console if MCP logging fails
  console.error(`[${timestamp}] MEDIK: ${fullMessage}`);
});
```

### Chat Route Error Handling
```typescript
try {
  sendStatusUpdate(`[TRACE:${traceId}] ${formattedMessage}`);
} catch (error) {
  console.error(`[MAIN:${traceId}] ❌ Error sending status update: ${error}`);
}
```

## Debugging Features

### Trace IDs
Every log message gets a unique trace ID for debugging:
```typescript
traceId: Math.random().toString(36).substring(2, 8)
```

### Detailed Console Logging
Extensive console logging at each step:
```typescript
console.log(`\n=== [MAIN:${traceId}] [CHAT:LOG-STEP-1] MCP LOG MESSAGE RECEIVED IN CHAT ROUTE ===`);
console.log(`[MAIN:${traceId}] [CHAT:LOG-STEP-2] Formatted message: ${formattedMessage}`);
console.log(`[MAIN:${traceId}] [CHAT:LOG-STEP-3] Sending to client via sendStatusUpdate`);
```

### Step-by-Step Flow Tracking
```typescript
console.log(`[STEP-1-DEBUG] log() function called`);
console.log(`[STEP-1-DEBUG] mcpServer exists: ${mcpServer !== null}`);
console.log(`[STEP-1-DEBUG] Attempting to send MCP logging message`);
```

## Request Lifecycle

### Setup Phase
1. Chat request received
2. MCP log handler added for this request: `mcpService.addLogHandler(sendMCPLogMessage)`
3. Status update sent: "MCP log handler enabled"

### Execution Phase
1. MCP tools executed
2. Log messages generated in MCP server
3. Messages routed through MCPService to chat route
4. Status updates streamed to UI in real-time

### Cleanup Phase
1. Request completes or connection closes
2. Log handler removed: `mcpService.removeLogHandler(sendMCPLogMessage)`
3. Resources cleaned up

## Configuration

### MCP Server Capabilities
```typescript
capabilities: {
  tools: {},
  logging: {},  // Enables logging capability
}
```

### Log Message Structure
```typescript
{
  level: 'info' | 'warning' | 'error',
  logger: 'medik-mcp' | 'startup' | 'diagnostic',
  data: {
    message: string,
    timestamp: string,
    traceId: string,
    ...additionalData
  }
}
```

This architecture provides real-time visibility into MCP server operations, enabling users to see exactly what's happening during tool execution and troubleshoot issues effectively.

---

## Comparison with Official MCP Standards

### Current Implementation vs. Official MCP Documentation

After analyzing the official MCP transport documentation, here's how the current system compares to standard practices:

## ✅ Standards Compliance

### 1. **Transport Layer (COMPLIANT)**
- **Standard Used**: `StdioServerTransport` ✅
- **Official Recommendation**: Uses stdio transport as recommended for local integrations
- **Implementation**: Correctly implemented in `index.ts`:
  ```typescript
  const transport = new StdioServerTransport();
  await server.connect(transport);
  ```

### 2. **JSON-RPC 2.0 Message Format (COMPLIANT)**
- **Standard**: Official docs specify JSON-RPC 2.0 format ✅
- **Implementation**: The MCP SDK handles this automatically
- **Evidence**: Server uses standard `sendLoggingMessage()` from MCP SDK

### 3. **Server Capabilities (COMPLIANT)**
- **Standard**: Declare logging capability in server configuration ✅
- **Implementation**: Correctly declared:
  ```typescript
  capabilities: {
    tools: {},
    logging: {},  // ← Standard logging capability
  }
  ```

### 4. **Error Handling (COMPLIANT)**
- **Standard**: Handle connection errors, message parsing errors, protocol errors ✅
- **Implementation**: Proper error handling with fallbacks:
  ```typescript
  mcpServer.sendLoggingMessage(logPayload).catch((error: any) => {
    // Fallback to console if MCP logging fails
    console.error(`[${timestamp}] MEDIK: ${fullMessage}`);
  });
  ```

## ⚠️ Custom Extensions (Non-Standard but Valid)

### 1. **Custom Log Routing Architecture**
- **Standard**: Official docs don't specify how to route logs to UI
- **Current Implementation**: Custom routing through chat.ts ⚠️
- **Analysis**: This is an **extension**, not a violation. The official docs focus on transport layer, not application-level log handling.

### 2. **HTTP Streaming for UI Updates**
- **Standard**: Not covered in official transport docs
- **Current Implementation**: Custom HTTP chunked transfer encoding ⚠️
- **Analysis**: Valid extension for web UI integration. Official docs don't address UI streaming.

### 3. **Request-Specific Log Handlers**
- **Standard**: Not specified in official docs
- **Current Implementation**: Dynamic handler registration per request ⚠️
- **Analysis**: Innovative approach for multi-tenant logging. Not against standards.

## 🔴 Potential Standards Gaps

### 1. **Missing JSON-RPC Message Structure Validation**
- **Issue**: Current system doesn't validate incoming JSON-RPC message structure
- **Official Standard**: Should validate requests/responses/notifications format
- **Recommendation**: Add validation for:
  ```typescript
  {
    jsonrpc: "2.0",
    id: number | string,
    method: string,
    params?: object
  }
  ```

### 2. **No Custom Transport Implementation**
- **Current**: Only uses stdio transport
- **Official Guide**: Provides interface for custom transports
- **Analysis**: Not an issue, but limiting for future expansion

### 3. **Limited Security Considerations**
- **Official Recommendations**: 
  - Validate message integrity
  - Implement message size limits
  - Use appropriate timeouts
- **Current Implementation**: Basic error handling, but missing security validations

## 📊 Architecture Comparison Table

| Aspect | Official MCP Standard | Current Implementation | Compliance |
|--------|----------------------|------------------------|------------|
| **Transport Layer** | stdio/SSE recommended | stdio ✅ | ✅ COMPLIANT |
| **Message Format** | JSON-RPC 2.0 | Handled by SDK ✅ | ✅ COMPLIANT |
| **Server Capabilities** | Declare capabilities | `logging: {}` ✅ | ✅ COMPLIANT |
| **Connection Lifecycle** | Proper startup/cleanup | ✅ Implemented | ✅ COMPLIANT |
| **Error Handling** | Multiple error types | Basic + fallbacks ✅ | ✅ COMPLIANT |
| **Log Routing** | Not specified | Custom HTTP streaming ⚠️ | ⚠️ EXTENSION |
| **UI Integration** | Not covered | Custom implementation ⚠️ | ⚠️ EXTENSION |
| **Security Validation** | Message validation recommended | Limited validation 🔴 | 🔴 GAP |
| **Custom Transports** | Interface provided | Not implemented ⚠️ | ⚠️ OPTIONAL |

## 🎯 Recommendations for Standards Alignment

### High Priority (Security & Reliability)
1. **Add Message Validation**: Implement JSON-RPC 2.0 format validation
2. **Security Enhancements**: Add message size limits and integrity checks
3. **Timeout Handling**: Implement proper timeout mechanisms

### Medium Priority (Architecture)
1. **Transport Abstraction**: Consider implementing custom transport interface
2. **Connection Monitoring**: Add connection health checks as recommended
3. **Rate Limiting**: Implement rate limiting for log messages

### Low Priority (Future Enhancement)
1. **SSE Transport**: Consider implementing SSE transport for alternative connectivity
2. **Custom Transport**: Implement custom transport interface for specialized needs

## 📝 Summary

**The current implementation is largely standards-compliant** with the official MCP documentation. The core transport layer, message format, and server capabilities all follow official guidelines correctly.

**Key Strengths:**
- Proper use of stdio transport
- Correct server capability declaration
- Standard MCP SDK usage
- Good error handling with fallbacks

**Innovative Extensions:**
- Custom log routing architecture for web UI integration
- Request-specific log handler management
- Real-time HTTP streaming to UI
- Comprehensive debugging with trace IDs

**Areas for Improvement:**
- Enhanced security validation
- JSON-RPC message format validation
- Connection health monitoring
- Rate limiting implementation

The current system goes **beyond** the official standards to provide a complete web application integration, while maintaining compliance with core MCP principles. The extensions are well-architected and don't violate any official guidelines. 