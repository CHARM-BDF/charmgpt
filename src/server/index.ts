import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import chatRouter from './routes/chat';
import chatBasicRouter from './routes/chat-basic';
import chatToolsRouter from './routes/chat-tools';
import chatSequentialRouter from './routes/chat-sequential';
import chatArtifactsRouter from './routes/chat-artifacts';
import ollamaRouter from './routes/ollama_mcp';
import serverStatusRouter from './routes/server-status';
import storageRouter from './routes/storage';
import llmRoutes from './routes/api/internal/llm';
import apiKeysRouter from './routes/api-keys';
import { MCPService, MCPLogMessage } from './services/mcp';
import { LoggingService } from './services/logging';
import { LLMService } from './services/llm';
import { createChatService } from './services/chatServiceFactory';
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
const llmService = new LLMService(); // Initialize LLM Service

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
app.locals.llmService = llmService; // Add LLM Service to app locals

// Create and register the chat service using the factory function
app.locals.chatService = createChatService(app);
console.log('Chat Service initialized and registered via factory');

// Enhanced debug log
console.log('\n=== MCP Service Initialization ===');

// Set up MCP log message handler BEFORE initializing clients
// console.log('[MCP-DEBUG] Setting up global log message handler');
const globalLogHandler = (message: MCPLogMessage) => {
  const traceId = message.data?.traceId || randomUUID().split('-')[0];
  // console.log(`\n=== [GLOBAL-HANDLER:${traceId}] MCP LOG MESSAGE RECEIVED ===`);
  
  // const timestamp = new Date().toISOString();
  const logger = message.logger || 'MCP';
  const level = message.level;
  const messageText = message.data?.message || JSON.stringify(message.data);
  
  // Format for easy identification
  const formattedMessage = `[${logger}:${traceId}] [${level.toUpperCase()}] ${messageText}`;
  
  // console.log(`[GLOBAL-HANDLER:${traceId}] Timestamp: ${timestamp}`);
  // console.log(`[GLOBAL-HANDLER:${traceId}] Logger: ${logger} -- ${messageText}`);
  // console.log(`[GLOBAL-HANDLER:${traceId}] Level: ${level}`);
  // console.log(`[GLOBAL-HANDLER:${traceId}] Message: ${messageText}`);
  
  // Standard log output
  console.log(`[SERVER] ${formattedMessage}`);
  
  // console.log(`=== [GLOBAL-HANDLER:${traceId}] END LOG MESSAGE ===\n`);
};

// Set the global handler
mcpService.setLogMessageHandler(globalLogHandler);

// Store the global handler for routes to access
app.locals.globalLogHandler = globalLogHandler;

// console.log('[MCP-DEBUG] Global log message handler registered');

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

// Serve uploaded files
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Add request logging middleware
app.use((req, res, next) => {
  console.log(`[SERVER] ${req.method} ${req.url}`);
  if (req.headers['content-type']) {
    console.log(`[SERVER] Content-Type: ${req.headers['content-type']}`);
  }
  next();
});

// Mount routes
app.use('/api/chat', chatRouter);
app.use('/api/chat-basic', chatBasicRouter); // Basic chat route without tools
app.use('/api/chat-tools', chatToolsRouter); // Chat route with tools support
app.use('/api/chat-sequential', chatSequentialRouter); // Chat route with sequential thinking
app.use('/api/chat-artifacts', chatArtifactsRouter); // Chat route with artifact processing
app.use('/api/ollama', ollamaRouter);
app.use('/api/server-status', serverStatusRouter);
app.use('/api/storage', storageRouter);
app.use('/api/internal/llm', llmRoutes); // Mount LLM API routes
app.use('/api/api-keys', apiKeysRouter); // Mount API keys route

// Add new endpoint for server names
app.get('/api/server-names', (req, res) => {
  try {
    const mcpService = app.locals.mcpService as MCPService;
    if (!mcpService) {
      return res.status(500).json({ error: 'MCP service not initialized' });
    }
    
    // Get the actual server names directly from the MCP service
    const serverNames = Array.from(mcpService.getServerNames());
    
    // Add detailed logging
    console.log('\n=== DEBUG: /api/server-names response ===');
    console.log('Returning server names:', JSON.stringify(serverNames));
    console.log('Total server names:', serverNames.length);
    console.log('=== END DEBUG: /api/server-names response ===\n');
    
    res.json({ serverNames });
  } catch (error) {
    console.error('Error fetching server names:', error);
    res.status(500).json({ error: 'Failed to fetch server names' });
  }
});

// Add cleanup handlers for graceful shutdown
process.on('SIGINT', () => {
  console.log('\n[SERVER] Received SIGINT signal, shutting down gracefully...');
  mcpService.cleanup();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n[SERVER] Received SIGTERM signal, shutting down gracefully...');
  mcpService.cleanup();
  process.exit(0);
});

app.listen(port, () => {
  const now = new Date();
  const timestamp = now.toLocaleString();
  console.log(`Server started at: ${timestamp}`);
  console.log(`API running at http://localhost:${port}`);
  console.log(`Client running at http://localhost:5173`);
  console.log(`LLM Service running at http://localhost:${port}/api/internal/llm`);
  console.log(`Basic Chat Service running at http://localhost:${port}/api/chat-basic`);
  console.log(`Chat with Tools running at http://localhost:${port}/api/chat-tools`);
  console.log(`Chat with Sequential Thinking running at http://localhost:${port}/api/chat-sequential`);
  console.log(`Chat with Artifacts running at http://localhost:${port}/api/chat-artifacts`);
  
  // Send a test log message after a short delay
  // setTimeout(() => {
  //   console.log('\n[SERVER] Sending test log message to verify log handler...');
  //   mcpService.sendTestLogMessage();
  // }, 5000);
}); 