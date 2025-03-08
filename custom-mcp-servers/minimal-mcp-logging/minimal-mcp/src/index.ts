import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { randomUUID } from 'crypto';

// Define log levels
type LogLevel = 'debug' | 'info' | 'notice' | 'warning' | 'error';

// Create server with logging capabilities only
const server = new Server(
  { name: 'test-mcp', version: '1.0.0' },
  { capabilities: { logging: {} } }
);

// Define tools for documentation
const tools = [
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
];

// Send log function
function sendLog(level: LogLevel, message: string, metadata: Record<string, unknown> = {}) {
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

// Handle echo tool
function handleEchoTool(params: any) {
  console.log(`[TEST-MCP] Echo tool called with params: ${JSON.stringify(params)}`);
  
  if (!params.message) {
    throw new Error('Missing required parameter: message');
  }
  
  const result = params.uppercase ? 
    params.message.toUpperCase() : 
    params.message;
  
  // Log that the tool was called
  sendLog('info', `Tool 'echo' was called with: "${params.message}"`, { toolCall: true });
  
  return { result };
}

// Handle calculator tool
function handleCalculatorTool(params: any) {
  console.log(`[TEST-MCP] Calculator tool called with params: ${JSON.stringify(params)}`);
  
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
  
  // Log that the tool was called
  sendLog('info', `Tool 'calculator' was called: ${params.a} ${params.operation} ${params.b} = ${result}`, { toolCall: true });
  
  return { result };
}

// Main function
async function main() {
  try {
    // Connect to transport
    console.log('[TEST-MCP] Initializing server...');
    const transport = new StdioServerTransport();
    await server.connect(transport);
    
    console.log('[TEST-MCP] Server connected');
    
    // Send initial log
    sendLog('info', 'Server started');
    
    // Log available tools
    sendLog('info', `Server has ${tools.length} tools available: ${tools.map(t => t.name).join(', ')}`);
    
    // We'll handle tool calls through the server's raw message handling
    // This is a simplified approach for demonstration purposes
    
    // Send logs at regular intervals
    setInterval(() => {
      sendLog('debug', 'Debug log message', { source: 'timer', count: Math.floor(Math.random() * 100) });
    }, 5000);
    
    setInterval(() => {
      sendLog('info', 'Info log message', { source: 'timer', timestamp: Date.now() });
    }, 7000);
    
    setInterval(() => {
      sendLog('warning', 'Warning log message', { source: 'timer', alert: true });
    }, 11000);
    
    setInterval(() => {
      sendLog('error', 'Error log message', { source: 'timer', errorCode: 'ERR_' + Math.floor(Math.random() * 1000) });
    }, 13000);
    
    console.log('[TEST-MCP] Log timers started');
  } catch (error) {
    console.error('[TEST-MCP] Error in main:', error);
  }
}

main().catch(error => {
  console.error('[TEST-MCP] Fatal error:', error);
}); 