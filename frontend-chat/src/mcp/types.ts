// Import types from SDK
import type { Client } from '@modelcontextprotocol/sdk/client/index.js';

export type LogLevel = 'debug' | 'info' | 'notice' | 'warning' | 'error' | 'critical' | 'alert' | 'emergency';

export interface MCPLogMessage {
  level: LogLevel;
  logger?: string;
  data?: Record<string, unknown>;
}

export interface MCPClientConfig {
  name: string;
  version: string;
  roots?: string[];
  logLevel?: LogLevel;
}

export interface MCPServerInfo {
  name: string;
  version: string;
  capabilities: Record<string, any>;
}

export interface MCPServerState extends MCPServerInfo {
  status: 'inactive' | 'active' | 'blocked';
  tools?: MCPTool[];
  isRunning: boolean;  // To maintain compatibility with existing code
  displayName?: string; // User-friendly name for display in the UI
}

export interface MCPToolResult {
  isError: boolean;
  content: Array<{
    type: string;
    text?: string;
  }>;
}

export interface MCPToolSchema {
  type: string;
  properties?: Record<string, MCPToolSchema>;
  items?: MCPToolSchema;
}

export interface MCPTool {
  name: string;
  description?: string;
  inputSchema: MCPToolSchema;
}

export interface MCPPromptArgument {
  name: string;
  description?: string;
  required?: boolean;
}

export interface MCPPrompt {
  name: string;
  description?: string;
  arguments?: MCPPromptArgument[];
}

export interface MCPResource {
  name: string;
  uri: string;
  description?: string;
}

export interface MCPResourceTemplate {
  uriTemplate: string;
  name: string;
  description?: string;
}

export interface MCPToolContext {
  name: string;
  description: string;
  parameters: Record<string, any>;
  example: Record<string, any> | null;
}

export interface MCPContext {
  available_tools: MCPToolContext[];
  available_prompts: MCPPrompt[];
  available_resources: MCPResource[];
}

// SDK Response Types
export interface MCPToolResponse {
  tools: MCPTool[];
}

export interface MCPPromptResponse {
  prompts: MCPPrompt[];
}

export interface MCPResourceResponse {
  resources: MCPResource[];
  resourceTemplates: MCPResourceTemplate[];
}

// Re-export Client type
export type { Client }; 