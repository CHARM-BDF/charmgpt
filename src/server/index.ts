import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import chatRouter from './routes/chat';
import ollamaRouter from './routes/ollama_mcp';
import { MCPService } from './services/mcp';
import { LoggingService } from './services/logging';

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

// Initialize MCP service
try {
  // Load MCP server configuration from JSON file
  const mcpConfigPath = path.join(__dirname, '../config/mcp_server_config.json');
  const configContent = fs.readFileSync(mcpConfigPath, 'utf-8');
  const config = JSON.parse(configContent);
  
  // Initialize MCP servers
  await mcpService.initializeServers(config);
} catch (error) {
  loggingService.logError(error as Error);
  console.error('Failed to initialize MCP service:', error);
}

app.use(cors());
app.use(express.json());

// Mount routes
app.use('/api/chat', chatRouter);
app.use('/api/ollama', ollamaRouter);

app.listen(port, () => {
  const now = new Date();
  const timestamp = now.toLocaleString();
  console.log(`Server started at: ${timestamp}`);
  console.log(`API running at http://localhost:${port}`);
}); 