# MCP Logging System Documentation

## Overview

The Model Context Protocol (MCP) logging system provides a standardized way for MCP servers to send structured log messages to clients. The system supports different log levels, contextual data, and flexible message routing through a notification-based architecture.

## Table of Contents

1. [Core Components](#core-components)
2. [Message Structure](#message-structure)
3. [Implementation Guide](#implementation-guide)
4. [Server Implementation](#server-implementation)
5. [Client Implementation](#client-implementation)
6. [Examples](#examples)
7. [Best Practices](#best-practices)
8. [Troubleshooting](#troubleshooting)

## Core Components

### Log Message Interface

```typescript
interface MCPLogMessage {
  level: 'debug' | 'info' | 'notice' | 'warning' | 'error' | 'critical' | 'alert' | 'emergency';
  logger?: string;
  data?: Record<string, unknown>;
}
```

### Log Levels (RFC 5424 Syslog Levels)

| Level | Description | Use Case |
|-------|-------------|----------|
| debug | Detailed debugging information | Function entry/exit, variable states |
| info | General informational messages | Operation progress, status updates |
| notice | Normal but significant events | Configuration changes |
| warning | Warning conditions | Deprecated feature usage |
| error | Error conditions | Operation failures |
| critical | Critical conditions | System component failures |
| alert | Immediate action required | Data corruption |
| emergency | System is unusable | Complete system failure |

## Message Structure

### Notification Format

```json
{
  "jsonrpc": "2.0",
  "method": "notifications/message",
  "params": {
    "level": "info",
    "logger": "my-mcp-server",
    "data": {
      "message": "Operation completed successfully",
      "traceId": "abc123",
      "details": {
        "operation": "data_processing",
        "duration": 1500
      }
    }
  }
}
```

## Implementation Guide

### Server Requirements

1. **Capability Declaration**
   - Must declare logging capability during initialization
   ```typescript
   const server = new Server({
     name: "my-mcp-server",
     version: "1.0.0"
   }, {
     capabilities: {
       logging: {}  // Enable logging capability
     }
   });
   ```

2. **Logger Implementation**
   ```typescript
   const logger = {
     info: (message: string, ...args: any[]) => {
       server.sendLoggingMessage({
         level: "info",
         logger: "my-mcp-server",
         data: {
           message,
           args,
           traceId: randomUUID().split('-')[0]
         }
       });
     },
     error: (message: string, ...args: any[]) => {
       server.sendLoggingMessage({
         level: "error",
         logger: "my-mcp-server",
         data: {
           message,
           args,
           traceId: randomUUID().split('-')[0]
         }
       });
     }
     // Implement other log levels as needed
   };
   ```

### Client Requirements

1. **Notification Handler Setup**
   ```typescript
   class MCPClient {
     constructor() {
       this.client = new Client(
         { name: "mcp-client", version: "1.0.0" },
         { capabilities: { logging: {} } }
       );

       this.client.notification = async (notification) => {
         if (notification.method === "notifications/message") {
           this.handleLogMessage(notification.params);
         }
       };
     }

     private handleLogMessage(message: MCPLogMessage) {
       // Implement log message handling
       const { level, logger, data } = message;
       // Forward to appropriate handler
     }
   }
   ```

2. **Log Message Handler**
   ```typescript
   interface LogHandler {
     (message: MCPLogMessage): void;
   }

   class MCPService {
     private logMessageHandler?: LogHandler;

     setLogMessageHandler(handler: LogHandler) {
       this.logMessageHandler = handler;
       // Set for all clients
       for (const client of this.clients) {
         client.setLogMessageHandler(handler);
       }
     }
   }
   ```

## Server Implementation

### Basic Server Example

```typescript
import { Server } from "@modelcontextprotocol/sdk/server";
import { randomUUID } from "crypto";

export class MyMCPServer {
  private server: Server;
  
  constructor() {
    this.server = new Server(
      { name: "my-mcp-server", version: "1.0.0" },
      { capabilities: { logging: {} } }
    );
    
    this.setupLogger();
  }

  private setupLogger() {
    const logger = {
      info: (message: string, data?: Record<string, unknown>) => {
        this.server.sendLoggingMessage({
          level: "info",
          logger: "my-mcp-server",
          data: {
            message,
            ...data,
            traceId: randomUUID().split('-')[0]
          }
        });
      },
      error: (message: string, error?: Error, data?: Record<string, unknown>) => {
        this.server.sendLoggingMessage({
          level: "error",
          logger: "my-mcp-server",
          data: {
            message,
            error: error?.message,
            stack: error?.stack,
            ...data,
            traceId: randomUUID().split('-')[0]
          }
        });
      }
    };

    return logger;
  }
}
```

## Client Implementation

### Basic Client Example

```typescript
import { Client } from "@modelcontextprotocol/sdk/client";
import { MCPLogMessage } from "./types";

export class MyMCPClient {
  private client: Client;
  private logHandler?: (message: MCPLogMessage) => void;

  constructor() {
    this.client = new Client(
      { name: "my-mcp-client", version: "1.0.0" },
      { capabilities: { logging: {} } }
    );

    this.setupNotificationHandler();
  }

  private setupNotificationHandler() {
    this.client.notification = async (notification) => {
      if (notification.method === "notifications/message") {
        const logMessage = notification.params as MCPLogMessage;
        if (this.logHandler) {
          this.logHandler(logMessage);
        }
      }
    };
  }

  public setLogHandler(handler: (message: MCPLogMessage) => void) {
    this.logHandler = handler;
  }
}
```

## Examples

### Server-Side Logging

```typescript
// Basic logging
logger.info("Processing started", { operation: "data_import" });

// Error logging
try {
  // Some operation
} catch (error) {
  logger.error("Operation failed", error, { operation: "data_import" });
}

// Debug logging with context
logger.debug("Variable state", { 
  variable: "config",
  value: config,
  stage: "initialization"
});
```

### Client-Side Handling

```typescript
// Chat-specific handler
const chatLogHandler = (message: MCPLogMessage) => {
  const traceId = message.data?.traceId || randomUUID().split('-')[0];
  const formattedMessage = `[${message.logger}:${traceId}] ${message.data?.message}`;
  
  // Send to UI
  sendStatusUpdate(formattedMessage);
};

// Global handler
const globalLogHandler = (message: MCPLogMessage) => {
  const { level, logger, data } = message;
  console.log(`[${logger}] [${level}] ${data?.message}`);
};

// Set handlers
mcpService.setLogMessageHandler(chatLogHandler);  // For chat sessions
mcpService.setLogMessageHandler(globalLogHandler);  // For general logging
```

## Best Practices

1. **Structured Logging**
   - Always include a `traceId` for message correlation
   - Use consistent logger names
   - Include relevant context in the `data` field

2. **Error Handling**
   - Include error stack traces when available
   - Add context about the operation that failed
   - Use appropriate log levels for different error severities

3. **Performance**
   - Implement rate limiting for high-volume logs
   - Use debug level for verbose logging
   - Consider log rotation for file outputs

4. **Security**
   - Never log sensitive information (passwords, tokens)
   - Sanitize error messages before logging
   - Implement log access controls

## Troubleshooting

### Common Issues

1. **Logs Not Appearing**
   - Check if logging capability is declared
   - Verify notification handler is set up
   - Ensure log handler is registered

2. **Missing Context**
   - Always include `traceId` in log data
   - Use consistent logger names
   - Add relevant operation context

3. **Performance Issues**
   - Implement rate limiting
   - Use appropriate log levels
   - Monitor log volume

### Debugging Tips

1. Enable debug mode for detailed logging:
   ```typescript
   const DEBUG = true;
   ```

2. Monitor raw notifications:
   ```typescript
   client.notification = async (notification) => {
     console.log("Raw notification:", notification);
     // Normal handling
   };
   ```

3. Add trace logging:
   ```typescript
   const traceId = randomUUID().split('-')[0];
   console.log(`[TRACE:${traceId}] Processing notification`);
   ``` 