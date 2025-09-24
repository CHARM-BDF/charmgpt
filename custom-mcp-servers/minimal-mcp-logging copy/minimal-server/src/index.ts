import express from 'express';
import http from 'http';
import { WebSocket, WebSocketServer } from 'ws';
import { spawn, ChildProcess } from 'child_process';
import { randomUUID } from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from './config.js';

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create Express app
const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// Connected clients
const clients: WebSocket[] = [];

// MCP server processes
const mcpProcesses: Record<string, ChildProcess> = {};

// Serve static files from the client directory
app.use(express.static(path.join(__dirname, '../../minimal-client')));

// Initialize MCP servers from config
async function initializeMCPServers() {
  console.log('[MAIN] Initializing MCP servers from config');
  
  // Get MCP servers from config
  const { mcpServers } = config;
  
  // Start each MCP server
  for (const [serverName, serverConfig] of Object.entries(mcpServers)) {
    try {
      console.log(`[MAIN] Starting MCP server: ${serverName}`);
      
      // Prepare environment variables
      const env = {
        ...process.env,
        ...serverConfig.env
      };
      
      // Spawn MCP server process
      const mcpProcess = spawn(serverConfig.command, serverConfig.args, { env });
      
      // Store process for cleanup
      mcpProcesses[serverName] = mcpProcess;
      
      // Log MCP server output
      mcpProcess.stdout.on('data', (data) => {
        const output = data.toString().trim();
        console.log(`[${serverName}-STDOUT] ${output}`);
        
        // Try to parse JSON from the output to see if it contains log messages
        try {
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
        } catch (error) {
          // Ignore parsing errors, just log raw output
        }
      });
      
      mcpProcess.stderr.on('data', (data) => {
        console.error(`[${serverName}-STDERR] ${data.toString().trim()}`);
      });
      
      mcpProcess.on('close', (code) => {
        console.log(`[MAIN] MCP server ${serverName} exited with code ${code}`);
        delete mcpProcesses[serverName];
      });
      
      console.log(`[MAIN] MCP server ${serverName} started`);
    } catch (error) {
      console.error(`[MAIN] Error starting MCP server ${serverName}:`, error);
    }
  }
  
  console.log('[MAIN] All MCP servers initialized');
}

// Log message handler
function handleLogMessage(message: any) {
  const traceId = message.data?.traceId || randomUUID().split('-')[0];
  
  console.log(`\n[MAIN:${traceId}] Received log message from MCP server`);
  console.log(`[MAIN:${traceId}] Logger: ${message.logger}`);
  console.log(`[MAIN:${traceId}] Level: ${message.level}`);
  console.log(`[MAIN:${traceId}] Message: ${message.data?.message}`);
  
  // Format message for client
  const formattedMessage = {
    type: 'log',
    timestamp: new Date().toISOString(),
    logger: message.logger || 'unknown',
    level: message.level,
    message: message.data?.message || JSON.stringify(message.data),
    traceId,
    metadata: message.data || {}
  };
  
  // Send to all connected clients
  const messageStr = JSON.stringify(formattedMessage);
  const clientCount = clients.length;
  
  console.log(`[MAIN:${traceId}] Forwarding log to ${clientCount} clients`);
  
  let sentCount = 0;
  clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(messageStr);
      sentCount++;
    }
  });
  
  console.log(`[MAIN:${traceId}] Log forwarded to ${sentCount}/${clientCount} clients\n`);
}

// Set up WebSocket connection
wss.on('connection', (ws: WebSocket) => {
  console.log('[MAIN] Client connected');
  clients.push(ws);
  
  // Send welcome message
  ws.send(JSON.stringify({
    type: 'log',
    timestamp: new Date().toISOString(),
    logger: 'system',
    level: 'info',
    message: 'Connected to MCP Log Server',
    traceId: randomUUID().split('-')[0]
  }));
  
  ws.on('close', () => {
    console.log('[MAIN] Client disconnected');
    const index = clients.indexOf(ws);
    if (index !== -1) {
      clients.splice(index, 1);
    }
  });
});

// Cleanup function for graceful shutdown
function cleanup() {
  console.log('[MAIN] Shutting down MCP servers...');
  
  // Terminate all MCP processes
  for (const [serverName, process] of Object.entries(mcpProcesses)) {
    console.log(`[MAIN] Terminating MCP server: ${serverName}`);
    process.kill();
  }
  
  console.log('[MAIN] All MCP servers terminated');
  process.exit(0);
}

// Register cleanup handlers
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

// Initialize MCP servers and start the server
initializeMCPServers().catch(error => {
  console.error('[MAIN] Failed to initialize MCP servers:', error);
});

// Start server
const PORT = config.server.port;
server.listen(PORT, () => {
  console.log(`[MAIN] Server listening on port ${PORT}`);
  console.log(`[MAIN] Open http://localhost:${PORT} in your browser to view logs`);
}); 