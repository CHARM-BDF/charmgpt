# Minimal MCP Logging Test Environment

## Overview

This plan outlines a minimal test environment to isolate and debug the MCP logging system. By creating a simplified version of the system, we can focus solely on the logging mechanism without other factors interfering.

## Goals

1. Create a minimal MCP server that only sends logs
2. Create a minimal main server that receives and forwards logs
3. Create a simple client that displays logs
4. Establish a clear understanding of the logging flow
5. Apply learnings back to the main codebase

## Components

### 1. Minimal MCP Server

**Purpose**: Generate logs using the MCP SDK's logging mechanism.

**Features**:
- No external dependencies or data sources
- Sends logs at regular intervals
- Uses `sendLoggingMessage()` with clear logger name (e.g., 'test-mcp')
- Includes trace IDs and timestamps in logs
- Logs at different levels (debug, info, warning, error)

**Implementation**:
```typescript
// minimal-mcp/src/index.ts
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { randomUUID } from 'crypto';

// Define log levels
type LogLevel = 'debug' | 'info' | 'notice' | 'warning' | 'error';

// Create server
const server = new Server(
  { name: 'test-mcp', version: '1.0.0' },
  { capabilities: { logging: {} } }
);

// Send log function
function sendLog(level: LogLevel, message: string, metadata?: Record<string, unknown>) {
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
- Simple Express server
- Connects to the MCP server
- Processes notifications
- Forwards logs to connected clients
- Detailed logging of the notification flow

**Implementation**:
```typescript
// minimal-server/src/index.ts
import express from 'express';
import http from 'http';
import WebSocket from 'ws';
import { MCPClient } from './mcp-client';
import { randomUUID } from 'crypto';

// Create Express app
const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Create MCP client
const mcpClient = new MCPClient({
  name: 'test-mcp',
  command: 'node',
  args: ['../minimal-mcp/dist/index.js']
});

// Connected clients
const clients: WebSocket[] = [];

// Log message handler
function handleLogMessage(message: any) {
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
mcpClient.init().then(() => {
  console.log('[MAIN] MCP client initialized');
  mcpClient.setLogMessageHandler(handleLogMessage);
}).catch(error => {
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

## Implementation Steps

1. **Set Up Project Structure**:
   - Create directories for each component
   - Set up package.json files
   - Install dependencies

2. **Implement MCP Server**:
   - Create the minimal MCP server
   - Test it standalone to ensure it generates logs

3. **Implement Main Server**:
   - Create the MCP client wrapper
   - Implement the notification handling
   - Set up WebSocket for client communication

4. **Implement Client**:
   - Create the HTML/CSS/JS for the client
   - Test WebSocket connection

5. **Test End-to-End**:
   - Start all components
   - Verify logs flow from MCP server to client
   - Debug any issues

## Testing and Debugging

1. **Console Logging**:
   - Add detailed console logs at each step
   - Use unique identifiers to track log flow

2. **Component Testing**:
   - Test each component in isolation
   - Verify MCP server generates logs
   - Verify main server receives notifications
   - Verify client displays logs

3. **End-to-End Testing**:
   - Test the complete flow
   - Monitor console output for all components
   - Check for any missing logs or errors

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

This minimal test environment will help isolate and debug the MCP logging system. By focusing solely on the logging mechanism, we can identify and fix issues more effectively than trying to debug the full system. 