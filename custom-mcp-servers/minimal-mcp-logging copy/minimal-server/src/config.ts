import path from 'path';
import { fileURLToPath } from 'url';

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define types for the configuration
export interface MCPServerConfig {
  command: string;
  args: string[];
  env?: Record<string, string>;
}

export interface Config {
  server: {
    port: number;
    logLevel: string;
  };
  mcpServers: Record<string, MCPServerConfig>;
}

// Configuration for the minimal MCP logging test environment
export const config: Config = {
  // Server configuration
  server: {
    port: 3002,
    logLevel: 'debug'
  },
  
  // MCP servers configuration
  mcpServers: {
    'test-mcp': {
      command: 'node',
      args: [
        path.resolve(__dirname, '../../minimal-mcp/dist/index.js')
      ],
      // Optional environment variables
      env: {}
    }
    // Additional test MCP servers can be added here
  }
}; 