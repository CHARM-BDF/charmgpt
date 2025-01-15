import { JSONSchemaType } from 'ajv';

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: JSONSchemaType<any>;
}

export interface MCPResource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

export interface MCPPrompt {
  name: string;
  description?: string;
  arguments?: {
    name: string;
    description?: string;
    required?: boolean;
  }[];
}

export interface MCPServer {
  name: string;
  tools: MCPTool[];
  resources: MCPResource[];
  prompts: MCPPrompt[];
  connected: boolean;
}
