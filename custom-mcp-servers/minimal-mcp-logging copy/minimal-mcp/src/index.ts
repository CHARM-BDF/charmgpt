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