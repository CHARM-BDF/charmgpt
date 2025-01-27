import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { z } from 'zod';
import { 
  MCPClientConfig, 
  MCPServerInfo, 
  MCPToolResult,
  MCPToolResponse,
  MCPPromptResponse,
  MCPResourceResponse,
  MCPToolSchema 
} from './types';

// Response schemas
const serverInfoSchema = z.object({
  serverInfo: z.object({
    name: z.string().optional(),
    version: z.string().optional()
  }).optional(),
  capabilities: z.record(z.boolean()).optional()
});

const toolSchemaSchema: z.ZodType<MCPToolSchema> = z.lazy(() => 
  z.object({
    type: z.string(),
    properties: z.record(toolSchemaSchema).optional(),
    items: toolSchemaSchema.optional()
  })
);

const toolResponseSchema = z.object({
  tools: z.array(z.object({
    name: z.string(),
    description: z.string().optional(),
    inputSchema: toolSchemaSchema
  }))
});

const resourceResponseSchema = z.object({
  resources: z.array(z.object({
    name: z.string(),
    uri: z.string(),
    description: z.string().optional()
  })),
  resourceTemplates: z.array(z.any())
});

const promptResponseSchema = z.object({
  prompts: z.array(z.object({
    name: z.string(),
    description: z.string().optional(),
    arguments: z.array(z.object({
      name: z.string(),
      description: z.string(),
      required: z.boolean()
    })).optional()
  }))
});

const toolCallResponseSchema = z.object({
  isError: z.boolean(),
  content: z.array(z.object({
    type: z.string(),
    text: z.string()
  }))
});

export class MCPClient {
  private client: Client;
  private config: MCPClientConfig;
  private serverInfo: MCPServerInfo | null = null;

  constructor(config: MCPClientConfig) {
    this.config = config;
    this.client = new Client(
      { name: config.name, version: config.version },
      {
        capabilities: {
          prompts: {},
          resources: {},
          tools: {}
        }
      }
    );
  }

  async connect(command: string, args: string[]): Promise<MCPServerInfo> {
    try {
      const transport = new StdioClientTransport({ command, args });
      await this.client.connect(transport);

      // Send initialize request
      const initializeResponse = await this.client.request(
        {
          method: 'initialize',
          params: {
            roots: this.config.roots || []
          }
        },
        serverInfoSchema
      );

      this.serverInfo = {
        name: initializeResponse.serverInfo?.name || 'unknown',
        version: initializeResponse.serverInfo?.version || '0.0.0',
        capabilities: initializeResponse.capabilities || {},
      };

      console.log('Successfully connected to MCP server:', this.serverInfo);
      return this.serverInfo;
    } catch (error) {
      console.error('Failed to connect to MCP server:', error);
      throw error;
    }
  }

  async listTools(): Promise<MCPToolResponse> {
    try {
      const response = await this.client.request(
        {
          method: 'tools/list',
          params: {}
        },
        toolResponseSchema
      );
      return {
        tools: response.tools?.map(tool => ({
          name: tool.name,
          description: tool.description || '',
          inputSchema: tool.inputSchema
        })) || []
      };
    } catch (error) {
      console.error('Error listing tools:', error);
      throw error;
    }
  }

  async listResources(): Promise<MCPResourceResponse> {
    try {
      const response = await this.client.request(
        {
          method: 'resources/list',
          params: {}
        },
        resourceResponseSchema
      );
      return {
        resources: response.resources || [],
        resourceTemplates: response.resourceTemplates || []
      };
    } catch (error) {
      console.error('Error listing resources:', error);
      throw error;
    }
  }

  async listPrompts(): Promise<MCPPromptResponse> {
    try {
      const response = await this.client.request(
        {
          method: 'prompts/list',
          params: {}
        },
        promptResponseSchema
      );
      return {
        prompts: response.prompts || []
      };
    } catch (error) {
      console.error('Error listing prompts:', error);
      throw error;
    }
  }

  async callTool(name: string, args: Record<string, any>): Promise<MCPToolResult> {
    try {
      const response = await this.client.request(
        {
          method: 'tools/call',
          params: {
            name,
            arguments: args
          }
        },
        toolCallResponseSchema
      );
      
      return {
        isError: Boolean(response.isError),
        content: Array.isArray(response.content) ? response.content.map(c => ({
          type: c.type === 'error' ? 'error' : 'text',
          text: String(c.text || '')
        })) : []
      };
    } catch (error) {
      console.error(`Error calling tool ${name}:`, error);
      throw error;
    }
  }

  async readResource(uri: string) {
    try {
      const response = await this.client.request(
        {
          method: 'resources/read',
          params: { uri }
        },
        z.object({
          contents: z.array(z.object({
            uri: z.string(),
            text: z.string().optional()
          })).optional()
        })
      );
      return response;
    } catch (error) {
      console.error('Error reading resource:', error);
      throw error;
    }
  }

  async close() {
    try {
      await this.client.close();
      this.serverInfo = null;
      console.log('MCP client closed successfully');
    } catch (error) {
      console.error('Error closing MCP client:', error);
      throw error;
    }
  }

  getServerInfo(): MCPServerInfo | null {
    return this.serverInfo;
  }
} 