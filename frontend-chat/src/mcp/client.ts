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
  MCPToolSchema,
  MCPLogMessage,
  LogLevel 
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
  private onLogMessage?: (message: MCPLogMessage) => void;

  constructor(config: MCPClientConfig) {
    console.log(`[MCP-DEBUG] Initializing MCPClient for ${config.name}`);
    this.config = config;
    this.client = new Client(
      { name: config.name, version: config.version },
      {
        capabilities: {
          prompts: {},
          resources: {},
          tools: {},
          logging: {}  // Explicitly enable logging capability
        }
      }
    );

    // Set up notification handler for log messages
    console.log(`[MCP-DEBUG] Setting up notification handler for ${config.name}`);
    this.client.notification = async (notification: { method: string; params?: unknown }) => {
      console.log(`[MCP-DEBUG] ${config.name} received notification:`, notification.method);
      if (notification.method === 'notifications/message') {
        try {
          const logMessage = z.object({
            level: z.enum(['debug', 'info', 'notice', 'warning', 'error', 'critical', 'alert', 'emergency']),
            logger: z.string().optional(),
            data: z.record(z.unknown()).optional()
          }).parse(notification.params);

          console.log(`[MCP-DEBUG] ${config.name} parsed log message:`, logMessage);
          if (this.onLogMessage) {
            console.log(`[MCP-DEBUG] ${config.name} forwarding to handler`);
            this.onLogMessage(logMessage);
          } else {
            console.log(`[MCP-DEBUG] ${config.name} no handler available for log message`);
          }
        } catch (error) {
          console.error(`[MCP-DEBUG] ${config.name} invalid log message format:`, error);
        }
      }
    };
  }

  // Method to set the log message handler
  setLogMessageHandler(handler: (message: MCPLogMessage) => void) {
    console.log(`[MCP-DEBUG] ${this.config.name} setting log message handler`);
    this.onLogMessage = handler;
  }

  // Method to set the minimum log level
  async setLogLevel(level: LogLevel): Promise<void> {
    try {
      await this.client.request(
        {
          method: 'logging/setLevel',
          params: { level }
        },
        z.object({ result: z.object({}).optional() })
      );
    } catch (error) {
      console.error('Error setting log level:', error);
      throw error;
    }
  }

  async connect(command: string, args: string[]): Promise<MCPServerInfo> {
    try {
      console.log(`[MCP-DEBUG] ${this.config.name} connecting with command:`, command);
      const transport = new StdioClientTransport({ command, args });
      await this.client.connect(transport);
      console.log(`[MCP-DEBUG] ${this.config.name} connected successfully`);

      // Send initialize request
      console.log(`[MCP-DEBUG] ${this.config.name} sending initialize request`);
      const initializeResponse = await this.client.request(
        {
          method: 'initialize',
          params: {
            roots: this.config.roots || []
          }
        },
        serverInfoSchema
      );
      console.log(`[MCP-DEBUG] ${this.config.name} initialization response:`, initializeResponse);

      this.serverInfo = {
        name: initializeResponse.serverInfo?.name || 'unknown',
        version: initializeResponse.serverInfo?.version || '0.0.0',
        capabilities: initializeResponse.capabilities || {},
      };

      // Set initial log level if provided in config
      if (this.config.logLevel && this.serverInfo.capabilities.logging) {
        console.log(`[MCP-DEBUG] ${this.config.name} setting initial log level:`, this.config.logLevel);
        await this.setLogLevel(this.config.logLevel);
      }

      console.log(`[MCP-DEBUG] ${this.config.name} connected to MCP server:`, this.serverInfo);
      return this.serverInfo;
    } catch (error) {
      console.error(`[MCP-DEBUG] ${this.config.name} failed to connect:`, error);
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