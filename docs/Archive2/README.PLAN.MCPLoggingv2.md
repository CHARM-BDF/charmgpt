# MCP Logging System Implementation Plan (v2)

## Problem Statement

The MCP (Model Context Protocol) logging system needs to capture logs from MCP servers and display them in the chat interface. Specifically, we need:

1. MCP servers (like medik-mcp) to send logs via the MCP SDK's logging mechanism
2. The main server to receive these logs through notifications
3. The chat route to display relevant logs to users during active chat sessions
4. A global log handler to capture logs when no chat session is active

## System Architecture

The MCP logging system follows this flow:

```
┌─────────────┐     ┌──────────────┐     ┌───────────────┐     ┌────────────┐
│  MCP Server  │────▶│  MCP Client  │────▶│  MCP Service  │────▶│ Log Handler│
└─────────────┘     └──────────────┘     └───────────────┘     └────────────┘
      │                                                              │
      │                                                              │
      │                                                              ▼
      │                                                        ┌────────────┐
      │                                                        │Global Handler│
      │                                                        └────────────┘
      │                                                              │
      ▼                                                              ▼
┌─────────────┐                                                ┌────────────┐
│Console Logs │                                                │ Chat Route │
└─────────────┘                                                └────────────┘
                                                                      │
                                                                      ▼
                                                                ┌────────────┐
                                                                │   Client   │
                                                                └────────────┘
```

## Key Components

1. **MCP Server**: Generates logs using `sendLoggingMessage()`
2. **MCP Client**: Receives notifications from MCP servers
3. **MCP Service**: Manages MCP clients and forwards notifications
4. **Log Handlers**:
   - **Global Handler**: Processes all logs, sends to console/file
   - **Chat Handler**: Sends logs to the client during active chat sessions

## Implementation Plan

### 1. MCP Server Log Generation

**File: `custom-mcp-servers/medik-mcp/src/index.ts`**

```typescript
// Import necessary modules
import { randomUUID } from 'crypto';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';

// Define log levels
type LogLevel = 'debug' | 'info' | 'notice' | 'warning' | 'error' | 'critical' | 'alert' | 'emergency';

// Create a structured logging function
function sendStructuredLog(server: Server, level: LogLevel, message: string, metadata?: Record<string, unknown>) {
  const timestamp = new Date().toISOString();
  const traceId = randomUUID().split('-')[0]; // Generate unique ID for tracing
  
  // Format message with trace ID for easier tracking
  const formattedMessage = `[${level.toUpperCase()}] [${traceId}] ${message}`;
  
  try {
    // Create log payload with required fields
    const logPayload = {
      level,
      logger: 'MEDIK-MCP',
      data: {
        message: formattedMessage,
        timestamp,
        traceId,
        ...metadata
      },
    };
    
    // Send log using SDK's method
    server.sendLoggingMessage(logPayload);
    
    // Also log to console for debugging
    console.error(formattedMessage);
  } catch (error) {
    // Fallback to console if sending fails
    console.error(`[ERROR] Failed to send log: ${error}`);
    console.error(formattedMessage);
  }
}

// Server initialization
const server = new Server(
  {
    name: "medik-mcp",
    version: "1.0.0"
  },
  {
    capabilities: {
      tools: {},
      logging: {}  // Declare logging capability
    }
  }
);

// Example usage
sendStructuredLog(server, 'info', 'Server started');
```

### 2. MCP Client Notification Handling

**File: `src/mcp/client.ts`**

```typescript
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { z } from 'zod';

// Define MCPLogMessage interface
export interface MCPLogMessage {
  level: 'debug' | 'info' | 'notice' | 'warning' | 'error' | 'critical' | 'alert' | 'emergency';
  logger?: string;
  data?: Record<string, unknown>;
}

export class MCPClient {
  private client: Client;
  private config: MCPClientConfig;
  private onLogMessage?: (message: MCPLogMessage) => void;

  constructor(config: MCPClientConfig) {
    this.config = config;
    this.client = new Client(
      { name: config.name, version: config.version },
      {
        capabilities: {
          prompts: {},
          resources: {},
          tools: {},
          logging: {}  // Enable logging capability
        }
      }
    );

    // Set up notification handler for the specific method
    this.setUpNotificationHandler();
  }

  private setUpNotificationHandler() {
    // Define the schema for log message notifications
    const logMessageSchema = {
      method: 'notifications/message',
      params: z.object({
        level: z.enum(['debug', 'info', 'notice', 'warning', 'error', 'critical', 'alert', 'emergency']),
        logger: z.string().optional(),
        data: z.record(z.unknown()).optional()
      })
    };

    // Register the notification handler
    this.client.setNotificationHandler(logMessageSchema, (notification) => {
      if (notification.params) {
        try {
          // Process the log message
          if (this.onLogMessage) {
            // Forward to handler if one is set
            this.onLogMessage(notification.params as MCPLogMessage);
          }
        } catch (error) {
          console.error(`Error processing log message: ${error}`);
        }
      }
    });
  }

  // Method to set log message handler
  setLogMessageHandler(handler: (message: MCPLogMessage) => void) {
    this.onLogMessage = handler;
  }

  // Other methods for MCP client functionality...
}
```

### 3. MCP Service Implementation

**File: `src/server/services/mcp.ts`**

```typescript
import { randomUUID } from 'crypto';
import { MCPClient, MCPLogMessage } from '../../mcp/client';

export class MCPService {
  private mcpClients: Map<string, MCPClient>;
  private logMessageHandler?: (message: MCPLogMessage) => void;

  constructor() {
    this.mcpClients = new Map();
  }

  // Set the log message handler for all clients
  setLogMessageHandler(handler: (message: MCPLogMessage) => void) {
    console.log('[MCP-SERVICE] Setting new log message handler');
    
    // Store the handler
    this.logMessageHandler = handler;
    
    // Set handler for all existing clients
    for (const [serverName, client] of this.mcpClients.entries()) {
      console.log(`[MCP-SERVICE] Setting handler for client: ${serverName}`);
      client.setLogMessageHandler((message) => {
        this.processLogMessage(serverName, message);
      });
    }
  }

  // Process incoming log messages
  private processLogMessage(serverName: string, message: MCPLogMessage) {
    const traceId = message.data?.traceId || randomUUID().split('-')[0];
    
    console.log(`[MCP-SERVICE:${traceId}] Received log from ${serverName}`);
    
    try {
      // Call the registered log handler if one exists
      if (this.logMessageHandler) {
        this.logMessageHandler(message);
      } else {
        console.warn(`[MCP-SERVICE:${traceId}] No log message handler available`);
      }
    } catch (error) {
      console.error(`[MCP-SERVICE:${traceId}] Error in log message handler: ${error}`);
    }
  }

  // Initialize a new MCP client
  initClient(name: string, config: MCPClientConfig) {
    console.log(`[MCP-SERVICE] Initializing client: ${name}`);
    
    const client = new MCPClient(config);
    
    // Set log message handler if one is already registered
    if (this.logMessageHandler) {
      client.setLogMessageHandler((message) => {
        this.processLogMessage(name, message);
      });
    }
    
    this.mcpClients.set(name, client);
    return client;
  }

  // Other methods for MCP service functionality...
}
```

### 4. Global Log Handler Setup

**File: `src/server/index.ts`**

```typescript
import express from 'express';
import { randomUUID } from 'crypto';
import { MCPService } from './services/mcp';
import { LoggingService } from './services/logging';
import { MCPLogMessage } from '../mcp/client';

const app = express();

// Initialize services
const mcpService = new MCPService();
const loggingService = new LoggingService();

// Define the global log handler
const globalLogHandler = (message: MCPLogMessage) => {
  const traceId = message.data?.traceId || randomUUID().split('-')[0];
  
  // Format log for console
  const timestamp = message.data?.timestamp || new Date().toISOString();
  const logger = message.logger || 'MCP';
  const level = message.level;
  const messageText = message.data?.message || JSON.stringify(message.data);
  
  // Log to console with consistent format
  console.log(`[${timestamp}] [${level.toUpperCase()}] [${logger}:${traceId}] ${messageText}`);
  
  // Store in logging service if needed
  loggingService.logMessage({
    timestamp,
    level,
    source: logger,
    message: messageText,
    traceId,
    rawData: message
  });
  
  // The global handler should NOT send to clients directly
  // That should be handled by the chat route
};

// Set it as the default handler
mcpService.setLogMessageHandler(globalLogHandler);

// Store services and handlers in app locals for route access
app.locals.mcpService = mcpService;
app.locals.loggingService = loggingService;
app.locals.globalLogHandler = globalLogHandler;

// Set up routes
import chatRouter from './routes/chat';
app.use('/api/chat', chatRouter);

// Start the server
const port = 3001;
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
```

### 5. Chat Route Implementation

**File: `src/server/routes/chat.ts`**

```typescript
import express from 'express';
import WebSocket from 'ws';
import { randomUUID } from 'crypto';
import { MCPService } from '../services/mcp';
import { MCPLogMessage } from '../../mcp/client';

const router = express.Router();

router.ws('/', (ws, req) => {
  const mcpService = req.app.locals.mcpService as MCPService;
  let chatSessionActive = false;
  
  // Function to send status updates to the client
  const sendStatusUpdate = (status: string) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'status',
        status
      }));
    }
  };
  
  // Function to send MCP logs to the client
  const sendMCPLogMessage = (message: MCPLogMessage) => {
    const traceId = message.data?.traceId || randomUUID().split('-')[0];
    
    console.log(`[CHAT:LOG-STEP-1:${traceId}] Received log in chat handler`);
    
    if (!chatSessionActive) {
      console.log(`[CHAT:LOG-STEP-2:${traceId}] No active chat session, not forwarding`);
      // Forward to global handler as fallback
      req.app.locals.globalLogHandler(message);
      return;
    }
    
    try {
      console.log(`[CHAT:LOG-STEP-3:${traceId}] Preparing to send log to client`);
      
      // Format the log message
      const formattedMessage = message.data?.message || 
                              `[${message.level.toUpperCase()}] ${JSON.stringify(message.data)}`;
      
      // Send to client
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'log',
          log: {
            level: message.level,
            message: formattedMessage,
            timestamp: message.data?.timestamp || new Date().toISOString(),
            source: message.logger || 'MCP',
            traceId
          }
        }));
        
        console.log(`[CHAT:LOG-STEP-4:${traceId}] Log sent to client successfully`);
      } else {
        console.log(`[CHAT:LOG-STEP-4:${traceId}] WebSocket not open, log not sent`);
      }
    } catch (error) {
      console.error(`[CHAT:LOG-STEP-ERROR:${traceId}] Error sending log to client: ${error}`);
    }
  };
  
  // Set up event handlers
  ws.on('message', (msg) => {
    try {
      const data = JSON.parse(msg.toString());
      
      if (data.type === 'chat_start') {
        chatSessionActive = true;
        sendStatusUpdate('Chat session started');
        
        // Set the chat-specific log handler when chat starts
        console.log('[CHAT] Setting chat-specific log handler');
        mcpService.setLogMessageHandler(sendMCPLogMessage);
      } else if (data.type === 'chat_end') {
        chatSessionActive = false;
        sendStatusUpdate('Chat session ended');
        
        // Reset to global handler when chat ends
        console.log('[CHAT] Resetting to global log handler');
        mcpService.setLogMessageHandler(req.app.locals.globalLogHandler);
      }
      
      // Handle other message types...
    } catch (error) {
      console.error(`Error processing WebSocket message: ${error}`);
    }
  });
  
  ws.on('close', () => {
    console.log('[CHAT] WebSocket closed, resetting to global log handler');
    chatSessionActive = false;
    // Reset to global handler when connection closes
    mcpService.setLogMessageHandler(req.app.locals.globalLogHandler);
  });
});

export default router;
```

## Testing the Implementation

1. **Start the MCP Server**:
   - Run the medik-mcp server
   - Verify it initializes correctly and declares logging capability
   - Check for log messages indicating it's ready

2. **Start the Main Server**:
   - Run the main server
   - Verify the global log handler is set up
   - Check that MCP clients are initialized

3. **Test Log Flow Without Chat**:
   - Generate logs from the MCP server
   - Verify they appear in the server console via the global handler
   - Check that log format includes all expected fields

4. **Test Log Flow With Chat**:
   - Open a chat session
   - Generate logs from the MCP server
   - Verify they appear in both the server console and the chat interface
   - Check that the log format is consistent

5. **Test Handler Switching**:
   - Start a chat session (should switch to chat handler)
   - End the chat session (should switch back to global handler)
   - Verify logs are routed appropriately in each state

## Key Considerations

1. **Trace IDs**
   - Every log message should have a unique trace ID
   - This ID should be preserved throughout the entire log flow
   - Use it for correlation and debugging

2. **Error Handling**
   - Each component should have robust error handling
   - Errors in log handling should not affect core application functionality
   - All errors should be logged to the console

3. **Format Consistency**
   - Log format should be consistent across all components
   - Include timestamp, level, logger name, and message
   - Use the trace ID in all log references

4. **Handler Priority**
   - Chat handler takes precedence during active chat sessions
   - Global handler serves as a fallback
   - Ensure clean switching between handlers

5. **Performance**
   - Log handling should be asynchronous where possible
   - Consider batching logs if volume is high
   - Monitor for any performance impact

## Possible Enhancements

1. **Log Filtering**
   - Allow clients to filter logs by level, source, etc.
   - Implement server-side filtering to reduce network traffic

2. **Log Persistence**
   - Store logs in a database for later analysis
   - Implement log rotation for file-based logs

3. **Log Visualization**
   - Add a dashboard for log visualization
   - Implement search and filtering capabilities

4. **Log Correlation**
   - Enhance correlation across different services
   - Add context information to logs

5. **Log Format Standardization**
   - Standardize log format across all services
   - Consider adopting a standard like JSON Logging 