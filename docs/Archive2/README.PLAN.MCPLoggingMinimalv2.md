# Minimal MCP Logging Test Environment (v2)

## Overview

This plan outlines a simplified test environment to isolate and debug the MCP logging system. The focus is on creating the most minimal implementation possible to verify that logs can flow correctly from an MCP server to a client, with no custom wrappers or unnecessary abstractions.

## Goals

1. Create a minimal MCP server that sends logs using the SDK directly
2. Create a minimal main server that receives logs using the SDK directly
3. Create a simple client that displays logs
4. Verify the complete logging flow with minimal variables

## Key Principles

1. **Direct SDK Usage**: Use the SDK classes directly without custom wrappers
2. **Minimal Code**: Implement only what's necessary to test logging
3. **Clear Tracing**: Use trace IDs to track logs through the system
4. **Consistent Formatting**: Use consistent log formats across components

## Components

### 1. Minimal MCP Server

**Purpose**: Generate logs using the MCP SDK's logging mechanism.

**Features**:
- Uses the SDK's `Server` class directly
- Sends logs at regular intervals
- Includes trace IDs and timestamps in logs
- Logs at different levels (debug, info, warning, error)

**Implementation**:
```typescript
// minimal-mcp/src/index.ts
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { randomUUID } from 'crypto';

// Create server
const server = new Server(
  { name: 'test-mcp', version: '1.0.0' },
  { capabilities: { logging: {} } }
);

// Send log function
function sendLog(level, message, metadata = {}) {
  const traceId = randomUUID().split('-')[0];
  const timestamp = new Date().toISOString();
  
  console.log(`[TEST-MCP] Sending log: ${message}`);
  
  server.sendLoggingMessage({
    level,
    logger: 'test-mcp',
    data: {
      message: `[${level.toUpperCase()}] [${traceId}] ${message}`,
      timestamp,
      traceId,
      ...metadata
    }
  });
}

// Main function
async function main() {
  // Connect to transport
  const transport = new StdioServerTransport();
  await server.connect(transport);
  
  console.log('[TEST-MCP] Server connected');
  
  // Send initial log
  sendLog('info', 'Server started');
  
  // Send logs at regular intervals
  setInterval(() => {
    sendLog('debug', 'Debug log message');
  }, 5000);
  
  setInterval(() => {
    sendLog('info', 'Info log message');
  }, 7000);
  
  setInterval(() => {
    sendLog('warning', 'Warning log message');
  }, 11000);
  
  setInterval(() => {
    sendLog('error', 'Error log message');
  }, 13000);
}

main().catch(error => {
  console.error('[TEST-MCP] Fatal error:', error);
});
```

### 2. Minimal Main Server

**Purpose**: Receive logs from the MCP server and forward them to clients.

**Features**:
- Uses the SDK's `Client` class directly
- Spawns and connects to the MCP server
- Registers notification handler for log messages
- Forwards logs to connected clients via WebSocket
- Detailed logging of the notification flow

**Implementation**:
```typescript
// minimal-server/src/index.ts
import express from 'express';
import http from 'http';
import WebSocket from 'ws';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { spawn } from 'child_process';
import { z } from 'zod';
import { randomUUID } from 'crypto';

// Create Express app
const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Connected clients
const clients = [];

// Initialize MCP client directly (no custom wrapper)
async function initializeMCPClient() {
  console.log('[MAIN] Initializing MCP client');
  
  // Create client
  const client = new Client(
    { name: 'test-client', version: '1.0.0' },
    { capabilities: { logging: {} } }
  );
  
  // Spawn MCP server process
  const mcpProcess = spawn('node', ['../minimal-mcp/dist/index.js']);
  
  // Create transport
  const transport = new StdioClientTransport({
    stdin: mcpProcess.stdin,
    stdout: mcpProcess.stdout,
  });
  
  // Connect client to transport
  await client.connect(transport);
  
  // Define log message schema
  const logMessageSchema = {
    method: 'notifications/message',
    params: z.object({
      level: z.enum(['debug', 'info', 'notice', 'warning', 'error']),
      logger: z.string().optional(),
      data: z.record(z.unknown()).optional()
    })
  };
  
  // Register notification handler
  client.setNotificationHandler(logMessageSchema, (notification) => {
    if (notification.params) {
      handleLogMessage(notification.params);
    }
  });
  
  console.log('[MAIN] MCP client initialized');
  return client;
}

// Log message handler
function handleLogMessage(message) {
  const traceId = message.data?.traceId || randomUUID().split('-')[0];
  
  console.log(`[MAIN] Received log message from MCP server`);
  console.log(`[MAIN] Logger: ${message.logger}`);
  console.log(`[MAIN] Level: ${message.level}`);
  console.log(`[MAIN] Message: ${message.data?.message}`);
  
  // Format message for client
  const formattedMessage = {
    type: 'log',
    timestamp: new Date().toISOString(),
    logger: message.logger || 'unknown',
    level: message.level,
    message: message.data?.message || JSON.stringify(message.data),
    traceId
  };
  
  // Send to all connected clients
  const messageStr = JSON.stringify(formattedMessage);
  clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(messageStr);
    }
  });
}

// Set up WebSocket connection
wss.on('connection', (ws) => {
  console.log('[MAIN] Client connected');
  clients.push(ws);
  
  ws.on('close', () => {
    console.log('[MAIN] Client disconnected');
    const index = clients.indexOf(ws);
    if (index !== -1) {
      clients.splice(index, 1);
    }
  });
});

// Initialize MCP client
initializeMCPClient().catch(error => {
  console.error('[MAIN] Failed to initialize MCP client:', error);
});

// Start server
const PORT = 3000;
server.listen(PORT, () => {
  console.log(`[MAIN] Server listening on port ${PORT}`);
});
```

### 3. Simple Client

**Purpose**: Display logs received from the main server.

**Features**:
- Basic HTML/CSS/JS
- Connects to the main server via WebSocket
- Displays logs in a formatted way
- Highlights different log levels

**Implementation**:
```html
<!-- minimal-client/index.html -->
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MCP Log Viewer</title>
  <style>
    body {
      font-family: monospace;
      margin: 20px;
    }
    #logs {
      border: 1px solid #ccc;
      padding: 10px;
      height: 500px;
      overflow-y: auto;
    }
    .log {
      margin-bottom: 5px;
      padding: 5px;
      border-radius: 3px;
    }
    .debug { background-color: #f0f0f0; }
    .info { background-color: #e6f7ff; }
    .notice { background-color: #e6ffe6; }
    .warning { background-color: #fff9e6; }
    .error { background-color: #ffe6e6; }
  </style>
</head>
<body>
  <h1>MCP Log Viewer</h1>
  <div id="status">Connecting...</div>
  <div id="logs"></div>

  <script>
    const logsContainer = document.getElementById('logs');
    const statusElement = document.getElementById('status');
    
    // Connect to WebSocket server
    const ws = new WebSocket('ws://localhost:3000');
    
    ws.onopen = () => {
      statusElement.textContent = 'Connected';
      addLog('system', 'info', 'Connected to server');
    };
    
    ws.onclose = () => {
      statusElement.textContent = 'Disconnected';
      addLog('system', 'error', 'Disconnected from server');
    };
    
    ws.onerror = (error) => {
      statusElement.textContent = 'Error';
      addLog('system', 'error', 'WebSocket error');
      console.error('WebSocket error:', error);
    };
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'log') {
          addLog(data.logger, data.level, data.message, data.timestamp, data.traceId);
        }
      } catch (error) {
        console.error('Error parsing message:', error);
      }
    };
    
    function addLog(logger, level, message, timestamp = new Date().toISOString(), traceId = '') {
      const logElement = document.createElement('div');
      logElement.className = `log ${level}`;
      
      const timeStr = timestamp.split('T')[1].split('.')[0];
      logElement.textContent = `${timeStr} [${logger}] [${level.toUpperCase()}] ${traceId ? `[${traceId}] ` : ''}${message}`;
      
      logsContainer.appendChild(logElement);
      logsContainer.scrollTop = logsContainer.scrollHeight;
    }
  </script>
</body>
</html>
```

## Project Structure

```
minimal-mcp-logging/
├── minimal-mcp/
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       └── index.ts
├── minimal-server/
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       └── index.ts
└── minimal-client/
    └── index.html
```

## Implementation Steps

1. **Set Up Project Structure**:
   ```bash
   mkdir -p minimal-mcp-logging/{minimal-mcp,minimal-server,minimal-client}/src
   ```

2. **Set Up MCP Server**:
   ```bash
   cd minimal-mcp-logging/minimal-mcp
   npm init -y
   npm install @modelcontextprotocol/sdk typescript
   npx tsc --init
   ```

3. **Set Up Main Server**:
   ```bash
   cd ../minimal-server
   npm init -y
   npm install @modelcontextprotocol/sdk express ws zod typescript
   npm install --save-dev @types/express @types/ws
   npx tsc --init
   ```

4. **Create Implementation Files**:
   - Create the MCP server implementation
   - Create the main server implementation
   - Create the client HTML file

5. **Build and Run**:
   ```bash
   # Build MCP server
   cd minimal-mcp
   npx tsc
   
   # Build main server
   cd ../minimal-server
   npx tsc
   
   # Run main server (which will spawn MCP server)
   node dist/index.js
   ```

6. **Test**:
   - Open the client HTML file in a browser
   - Verify logs appear in the browser
   - Check console output for detailed flow

## Testing and Debugging

1. **Console Logging**:
   - Each component logs its actions to the console
   - Use unique prefixes ([TEST-MCP], [MAIN]) to identify the source
   - Include trace IDs for correlation

2. **Component Testing**:
   - Test MCP server in isolation first
   - Verify it generates logs correctly
   - Test main server connection to MCP server
   - Verify WebSocket communication

3. **End-to-End Testing**:
   - Test the complete flow from MCP server to client
   - Verify trace IDs are preserved
   - Check formatting consistency

## Key Differences from v1

1. **Direct SDK Usage**: Uses SDK classes directly without custom wrappers
2. **Simplified Architecture**: Removes unnecessary abstraction layers
3. **Focused Testing**: Concentrates solely on the logging flow
4. **Minimal Dependencies**: Reduces external dependencies

## Expected Outcomes

1. **Verification**: Confirm that logs flow correctly from MCP server to client
2. **Understanding**: Gain clear insight into the notification mechanism
3. **Debugging**: Identify any issues in the logging flow
4. **Documentation**: Document the correct implementation pattern

## Applying Learnings

Once the minimal test environment is working:

1. **Document Findings**:
   - Note the correct flow of logs
   - Identify any issues or gotchas

2. **Apply to Main Codebase**:
   - Update the main codebase based on learnings
   - Focus on the specific areas that were problematic

3. **Verify in Main Codebase**:
   - Test the updated main codebase
   - Ensure logs flow correctly

## Conclusion

This simplified approach focuses on testing the core MCP logging functionality with minimal variables and complexity. By using the SDK classes directly and eliminating custom wrappers, we can more easily identify and fix issues in the logging flow. 