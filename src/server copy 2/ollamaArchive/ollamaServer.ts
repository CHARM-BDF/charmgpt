/**
 * Ollama Server Implementation
 */

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { OllamaWrapper } from './ollamaClient';
import { configurePort, formatErrorResponse } from './ollamaUtils';
import { OllamaConfig } from './ollamaTypes';
import { Client as McpClient } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// MCP Server configuration types
interface MCPServerConfig {
  command: string;
  args: string[];
  env?: Record<string, string>;
}

interface MCPServersConfig {
  mcpServers: Record<string, MCPServerConfig>;
}

dotenv.config();

// Initialize Express app
const app = express();
app.use(cors());
app.use(express.json());

// Store MCP clients
const mcpClients = new Map<string, McpClient>();

// Add missing ES Module dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Ollama configuration
const ollamaConfig: OllamaConfig = {
  host: process.env.OLLAMA_HOST || 'http://localhost:11434',
  port: parseInt(process.env.OLLAMA_PORT || '3001'),
  fallbackPort: parseInt(process.env.OLLAMA_FALLBACK_PORT || '3002')
};

/**
 * Initialize MCP servers
 */
async function initializeMcpServers() {
  console.log('\n=== Starting MCP Server Initialization ===');
  
  try {
    // Load MCP server configuration
    const mcpConfigPath = path.join(__dirname, '../config/mcp_server_config.json');
    const configContent = fs.readFileSync(mcpConfigPath, 'utf-8');
    const config = JSON.parse(configContent) as MCPServersConfig;
    
    // Initialize each configured server
    for (const [serverName, serverConfig] of Object.entries(config.mcpServers)) {
      try {
        const client = new McpClient(
          { name: `${serverName}-client`, version: '1.0.0' },
          { capabilities: { tools: {} } }
        );

        // Adjust paths for node_modules if needed
        const modifiedArgs = serverConfig.args.map((arg: string) => 
          arg.startsWith('./node_modules/') ? arg.replace('./', '') : arg
        );

        // Connect client
        await client.connect(new StdioClientTransport({ 
          command: serverConfig.command,
          args: modifiedArgs,
          env: {
            ...serverConfig.env,
            ...process.env as Record<string, string>
          }
        }));

        mcpClients.set(serverName, client);
        console.log(`✅ ${serverName}: Initialized successfully`);
      } catch (error) {
        console.error(`❌ ${serverName}: Failed to initialize:`, error);
      }
    }
  } catch (error) {
    console.error('Failed to initialize MCP servers:', error);
    process.exit(1);
  }
}

/**
 * Get all available tools from MCP servers
 */
async function getAllAvailableTools(blockedServers: string[] = []): Promise<any[]> {
  const tools: any[] = [];
  
  for (const [serverName, client] of mcpClients.entries()) {
    if (blockedServers.includes(serverName)) continue;
    
    try {
      const result = await client.listTools();
      if (result.tools) {
        tools.push(...result.tools.map(tool => ({
          ...tool,
          name: `${serverName}:${tool.name}`
        })));
      }
    } catch (error) {
      console.error(`Failed to get tools from ${serverName}:`, error);
    }
  }
  
  return tools;
}

// Initialize server
async function startServer() {
  try {
    // Initialize MCP servers
    await initializeMcpServers();
    
    // Configure port
    const port = await configurePort(ollamaConfig);
    
    // Initialize Ollama client
    const ollama = new OllamaWrapper(ollamaConfig);

    // Chat endpoint
    app.post('/api/chat', async (req, res) => {
      try {
        const { message, history, blockedServers = [] } = req.body;
        
        // Get available tools
        const tools = await getAllAvailableTools(blockedServers);
        
        // Process message
        const response = await ollama.processMessage(message, history, tools);
        
        res.json(response);
      } catch (error) {
        console.error('Error processing chat request:', error);
        res.status(500).json(formatErrorResponse(
          error instanceof Error ? error : new Error('Unknown error in chat endpoint')
        ));
      }
    });

    // Server status endpoint
    app.get('/api/server-status', async (_req, res) => {
      try {
        const serverStatuses = [];
        
        for (const [serverName, client] of mcpClients.entries()) {
          try {
            const tools = await client.listTools();
            serverStatuses.push({
              name: serverName,
              isRunning: true,
              tools: tools.tools || []
            });
          } catch (error) {
            serverStatuses.push({
              name: serverName,
              isRunning: false,
              tools: []
            });
          }
        }
        
        res.json({ servers: serverStatuses });
      } catch (error) {
        console.error('Error getting server status:', error);
        res.status(500).json(formatErrorResponse(
          error instanceof Error ? error : new Error('Unknown error in server status endpoint')
        ));
      }
    });

    // Start server
    app.listen(port, () => {
      console.log(`\n=== Ollama Server Started ===`);
      console.log(`Server running at http://localhost:${port}`);
      console.log(`Using Ollama at ${ollamaConfig.host}`);
      console.log(`=========================\n`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
startServer(); 