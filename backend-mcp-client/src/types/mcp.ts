/**
 * Enhanced MCP Server Configuration Types
 * Supports both local and remote MCP servers
 */

export interface BaseServerConfig {
  timeout?: number;
  env?: Record<string, string>;
}

export interface LocalServerConfig extends BaseServerConfig {
  type?: 'local'; // Optional for backward compatibility
  command: string;
  args: string[];
}

export interface RemoteServerConfig extends BaseServerConfig {
  type: 'remote';
  transport: 'sse' | 'websocket' | 'http';
  url: string;
  auth?: {
    type: 'bearer' | 'api-key' | 'header';
    token?: string;
    apiKey?: string;
    headerName?: string;
    headerValue?: string;
  };
}

export type ServerConfig = LocalServerConfig | RemoteServerConfig;

export interface MCPServersConfig {
  mcpServers: Record<string, ServerConfig>;
}

export interface MCPLogMessage {
  level: 'debug' | 'info' | 'notice' | 'warning' | 'error' | 'critical' | 'alert' | 'emergency';
  logger?: string;
  data?: Record<string, unknown>;
}

export interface AnthropicTool {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}

// Transport creation result
export interface TransportInfo {
  transport: unknown; // Transport instance
  isRemote: boolean;
  serverConfig: ServerConfig;
}
