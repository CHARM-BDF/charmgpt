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

// Enable JSON parsing for request bodies
app.use(express.json());

// Connected clients
const clients: WebSocket[] = [];

// MCP server processes
const mcpProcesses: Record<string, ChildProcess> = {};

// Serve static files from the client directory
app.use(express.static(path.join(__dirname, '../../minimal-client')));

// Define tool interface
interface Tool {
  name: string;
  description: string;
  input_schema: {
    type: string;
    properties: Record<string, any>;
    required: string[];
  };
}

// Mock tools for demonstration
const mockTools: Record<string, Tool[]> = {
  'test-mcp': [
    {
      name: 'echo',
      description: 'Echoes back the input with optional transformation',
      input_schema: {
        type: 'object',
        properties: {
          message: {
            type: 'string',
            description: 'Message to echo back'
          },
          uppercase: {
            type: 'boolean',
            description: 'Convert message to uppercase'
          }
        },
        required: ['message']
      }
    },
    {
      name: 'calculator',
      description: 'Performs basic arithmetic operations',
      input_schema: {
        type: 'object',
        properties: {
          operation: {
            type: 'string',
            description: 'Operation to perform (add, subtract, multiply, divide)',
            enum: ['add', 'subtract', 'multiply', 'divide']
          },
          a: {
            type: 'number',
            description: 'First operand'
          },
          b: {
            type: 'number',
            description: 'Second operand'
          }
        },
        required: ['operation', 'a', 'b']
      }
    }
  ]
};

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

// Mock implementation of echo tool
function mockEchoTool(params: any) {
  console.log(`[MOCK] Echo tool called with params: ${JSON.stringify(params)}`);
  
  if (!params.message) {
    throw new Error('Missing required parameter: message');
  }
  
  const result = params.uppercase ? 
    params.message.toUpperCase() : 
    params.message;
  
  // Create a log message for this tool call
  const traceId = randomUUID().split('-')[0];
  const logMessage = {
    type: 'log',
    timestamp: new Date().toISOString(),
    logger: 'test-mcp',
    level: 'info',
    message: `[INFO] [${traceId}] Tool 'echo' was called with: "${params.message}"`,
    traceId,
    metadata: { toolCall: true, params }
  };
  
  // Send log to all clients
  const messageStr = JSON.stringify(logMessage);
  clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(messageStr);
    }
  });
  
  return { result };
}

// Mock implementation of calculator tool
function mockCalculatorTool(params: any) {
  console.log(`[MOCK] Calculator tool called with params: ${JSON.stringify(params)}`);
  
  if (!params.operation || !('a' in params) || !('b' in params)) {
    throw new Error('Missing required parameters: operation, a, b');
  }
  
  let result: number;
  
  switch (params.operation) {
    case 'add':
      result = params.a + params.b;
      break;
    case 'subtract':
      result = params.a - params.b;
      break;
    case 'multiply':
      result = params.a * params.b;
      break;
    case 'divide':
      if (params.b === 0) {
        throw new Error('Division by zero');
      }
      result = params.a / params.b;
      break;
    default:
      throw new Error(`Unknown operation: ${params.operation}`);
  }
  
  // Create a log message for this tool call
  const traceId = randomUUID().split('-')[0];
  const logMessage = {
    type: 'log',
    timestamp: new Date().toISOString(),
    logger: 'test-mcp',
    level: 'info',
    message: `[INFO] [${traceId}] Tool 'calculator' was called: ${params.a} ${params.operation} ${params.b} = ${result}`,
    traceId,
    metadata: { toolCall: true, params }
  };
  
  // Send log to all clients
  const messageStr = JSON.stringify(logMessage);
  clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(messageStr);
    }
  });
  
  return { result };
}

// API endpoint to list available tools
app.get('/api/tools', async (req, res) => {
  try {
    console.log('[MAIN] Listing available tools');
    
    // Collect tools from all MCP servers (using mock data for now)
    const allTools = [];
    
    for (const serverName of Object.keys(mcpProcesses)) {
      if (mockTools[serverName]) {
        // Process the tools and add server prefix
        const tools = mockTools[serverName].map((tool: Tool) => ({
          ...tool,
          name: `${serverName}:${tool.name}`
        }));
        
        allTools.push(...tools);
      }
    }
    
    res.json({ tools: allTools });
  } catch (error) {
    console.error('[MAIN] Error listing tools:', error);
    res.status(500).json({ error: 'Failed to list tools' });
  }
});

// API endpoint to call a tool
app.post('/api/tools/call', async (req, res) => {
  try {
    const { serverName, toolName, params } = req.body;
    
    if (!serverName || !toolName || !params) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }
    
    console.log(`[MAIN] Calling tool: ${toolName} on server: ${serverName}`);
    console.log(`[MAIN] Params: ${JSON.stringify(params)}`);
    
    // Check if server exists
    if (!mcpProcesses[serverName]) {
      return res.status(404).json({ error: `Server ${serverName} not found` });
    }
    
    // Extract the actual tool name (remove server prefix if present)
    const actualToolName = toolName.includes(':') ? 
      toolName.split(':')[1] : 
      toolName;
    
    // Call the mock tool implementation
    let result;
    
    if (actualToolName === 'echo') {
      result = mockEchoTool(params);
    } else if (actualToolName === 'calculator') {
      result = mockCalculatorTool(params);
    } else {
      return res.status(404).json({ error: `Tool ${actualToolName} not found` });
    }
    
    res.json(result);
  } catch (error: any) {
    console.error('[MAIN] Error calling tool:', error);
    res.status(500).json({ 
      error: 'Failed to call tool', 
      message: error.message || 'Unknown error' 
    });
  }
});

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
  console.log(`[MAIN] Use curl http://localhost:${PORT}/api/tools to list available tools`);
  console.log(`[MAIN] Use curl -X POST http://localhost:${PORT}/api/tools/call -H "Content-Type: application/json" -d '{"serverName":"test-mcp","toolName":"echo","params":{"message":"Hello"}}' to call a tool`);
}); 