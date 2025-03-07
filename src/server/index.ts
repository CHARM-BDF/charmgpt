import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import chatRouter from './routes/chat';
import ollamaRouter from './routes/ollama_mcp';
import serverStatusRouter from './routes/server-status';
import { MCPService, MCPLogMessage } from './services/mcp';
import { LoggingService } from './services/logging';
import { randomUUID } from 'crypto';

// ES Module dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
const port = 3001; // Explicitly set to 3001

// Initialize services
const mcpService = new MCPService();
const loggingService = new LoggingService();

// Initialize logging directory
const logDir = path.join(process.cwd(), 'logs');

// Ensure log directory exists
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Initialize logging
loggingService.initializeLogging(logDir);

// Log server startup
console.log('=== Server Initialization ===');
console.log(`Log directory: ${logDir}`);

// Store services in app locals for route access
app.locals.mcpService = mcpService;
app.locals.loggingService = loggingService;

// Enhanced debug log
console.log('\n=== MCP Service Initialization ===');

// Set up MCP log message handler BEFORE initializing clients
console.log('[MCP-DEBUG] Setting up global log message handler');
const globalLogHandler = (message: MCPLogMessage) => {
  const traceId = message.data?.traceId || randomUUID().split('-')[0];
  console.log(`\n=== [GLOBAL-HANDLER:${traceId}] MCP LOG MESSAGE RECEIVED ===`);
  
  const timestamp = new Date().toISOString();
  const logger = message.logger || 'MCP';
  const level = message.level;
  const messageText = message.data?.message || JSON.stringify(message.data);
  
  // Format for easy identification
  const formattedMessage = `[${logger}:${traceId}] [${level.toUpperCase()}] ${messageText}`;
  
  console.log(`[GLOBAL-HANDLER:${traceId}] Timestamp: ${timestamp}`);
  console.log(`[GLOBAL-HANDLER:${traceId}] Logger: ${logger}`);
  console.log(`[GLOBAL-HANDLER:${traceId}] Level: ${level}`);
  console.log(`[GLOBAL-HANDLER:${traceId}] Message: ${messageText}`);
  
  // Standard log output
  console.log(`[SERVER] ${formattedMessage}`);
  
  // Consider SSE clients connected to /api/logs or /api/events endpoint
  // This would be implemented here if we want to send logs to all connected clients
  // For now, logs will only be sent to clients in active chat sessions
  
  console.log(`=== [GLOBAL-HANDLER:${traceId}] END LOG MESSAGE ===\n`);
};

// Set the global handler
mcpService.setLogMessageHandler(globalLogHandler);

// Store the global handler for routes to access
app.locals.globalLogHandler = globalLogHandler;

console.log('[MCP-DEBUG] Global log message handler registered');

// Initialize MCP service
try {
  // Load MCP server configuration from JSON file
  const mcpConfigPath = path.join(__dirname, '../config/mcp_server_config.json');
  console.log(`[MCP-DEBUG] Loading config from: ${mcpConfigPath}`);
  
  const configContent = fs.readFileSync(mcpConfigPath, 'utf-8');
  const config = JSON.parse(configContent);
  console.log(`[MCP-DEBUG] Found ${Object.keys(config.mcpServers).length} MCP servers in config`);
  
  // Initialize MCP servers
  console.log('[MCP-DEBUG] Starting MCP server initialization');
  await mcpService.initializeServers(config);
  console.log('[MCP-DEBUG] MCP server initialization completed');
} catch (error) {
  loggingService.logError(error as Error);
  console.error('[MCP-DEBUG] Failed to initialize MCP service:', error);
}

app.use(cors());
app.use(express.json());

// Mount routes
app.use('/api/chat', chatRouter);
app.use('/api/ollama', ollamaRouter);
app.use('/api/server-status', serverStatusRouter);

app.listen(port, () => {
  const now = new Date();
  const timestamp = now.toLocaleString();
  console.log(`Server started at: ${timestamp}`);
  console.log(`API running at http://localhost:${port}`);
}); 