import { Client as McpClient } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { randomUUID } from 'crypto';

export interface MCPLogMessage {
  level: 'debug' | 'info' | 'notice' | 'warning' | 'error' | 'critical' | 'alert' | 'emergency';
  logger?: string;
  data?: Record<string, unknown>;
}

export interface MCPServersConfig {
  mcpServers: Record<string, {
    command: string;
    args: string[];
    env?: Record<string, string>;
  }>;
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

export class MCPService {
  private mcpClients: Map<string, McpClient>;
  private toolNameMapping: Map<string, string>;
  private serverStatuses: Record<string, boolean>;
  private logMessageHandler?: (message: MCPLogMessage) => void;

  constructor() {
    this.mcpClients = new Map();
    this.toolNameMapping = new Map();
    this.serverStatuses = {};
    console.log('[MCP-DEBUG] MCPService initialized');
  }

  // Function to handle notifications from MCP clients
  private handleMCPNotification(serverName: string, notification: { method: string; params?: unknown }) {
    const traceId = notification?.params && typeof notification.params === 'object' && 'data' in notification.params
      ? ((notification.params as any).data?.traceId || randomUUID().split('-')[0])
      : randomUUID().split('-')[0];
    
    // Log essential details first to quickly identify the notification
    console.log(`\n=== [CLIENT-NOTIFICATION:${traceId}] RECEIVED FROM ${serverName} ===`);
    console.log(`[CLIENT-NOTIFICATION:${traceId}] Method: ${notification.method}`);
    console.log(`[CLIENT-NOTIFICATION:${traceId}] Params Type: ${typeof notification.params}`);
    
    // Special detailed logging for exact notification/message format
    if (notification.method === 'notifications/message') {
      console.log(`[CLIENT-NOTIFICATION:${traceId}] 📝 LOG MESSAGE DETECTED - FULL PARAMS:`, JSON.stringify(notification.params, null, 2));
    } else {
      console.log(`[CLIENT-NOTIFICATION:${traceId}] Raw params:`, notification.params);
    }
    
    if (notification.method === 'notifications/message' && notification.params) {
      console.log(`\n=== [CLIENT-NOTIFICATION:${traceId}] PROCESSING LOG MESSAGE FROM ${serverName} ===`);
      try {
        // Attempt to parse and validate the log message
        const logMessage = notification.params as MCPLogMessage;
        
        // Validate required fields
        if (!logMessage.level) {
          console.error(`[CLIENT-NOTIFICATION:${traceId}] ❌ MISSING REQUIRED FIELD 'level' IN LOG MESSAGE`);
          console.error(`[CLIENT-NOTIFICATION:${traceId}] Raw params:`, notification.params);
          return;
        }
        
        console.log(`[CLIENT-NOTIFICATION:${traceId}] ✅ Parsed log level: ${logMessage.level}`);
        console.log(`[CLIENT-NOTIFICATION:${traceId}] ✅ Parsed logger: ${logMessage.logger || 'undefined'}`);
        console.log(`[CLIENT-NOTIFICATION:${traceId}] ✅ Parsed data:`, logMessage.data);
        
        if (this.logMessageHandler) {
          console.log(`\n=== [CLIENT-NOTIFICATION:${traceId}] FOUND LOG HANDLER, CALLING NOW ===`);
          try {
            // Important: Call the handler which should forward to chat.ts
            this.logMessageHandler(logMessage);
            console.log(`[CLIENT-NOTIFICATION:${traceId}] ✅ HANDLER CALL COMPLETED SUCCESSFULLY`);
            console.log(`[CLIENT-NOTIFICATION:${traceId}] Handler implementation type: ${typeof this.logMessageHandler}`);
          } catch (handlerError) {
            console.error(`[CLIENT-NOTIFICATION:${traceId}] ❌ ERROR IN HANDLER:`, handlerError);
          }
        } else {
          console.warn(`[CLIENT-NOTIFICATION:${traceId}] ❌ NO LOG MESSAGE HANDLER AVAILABLE`);
        }
      } catch (error) {
        console.error(`[CLIENT-NOTIFICATION:${traceId}] ❌ ERROR PARSING LOG MESSAGE:`, error);
        console.error(`[CLIENT-NOTIFICATION:${traceId}] Raw notification.params:`, notification.params);
      }
    } else {
      console.log(`[CLIENT-NOTIFICATION:${traceId}] Not a log message notification, ignoring`);
    }
    console.log(`=== [CLIENT-NOTIFICATION:${traceId}] END NOTIFICATION PROCESSING ===\n`);
  }

  // Update setLogMessageHandler method
  setLogMessageHandler(handler: (message: MCPLogMessage) => void) {
    const stackTrace = new Error().stack || '';
    const callerInfo = stackTrace.split('\n')[2] || 'unknown caller';
    
    console.log('\n=== [MCP-LOG-HANDLER] SETTING NEW LOG MESSAGE HANDLER ===');
    console.log(`[MCP-LOG-HANDLER] Called from: ${callerInfo}`);
    console.log(`[MCP-LOG-HANDLER] Handler type: ${typeof handler}`);
    console.log(`[MCP-LOG-HANDLER] Previous handler existed: ${this.logMessageHandler !== undefined ? 'YES' : 'NO'}`);
    
    // Store the handler
    this.logMessageHandler = handler;
    
    // Set handler for existing clients
    const clientCount = this.mcpClients.size;
    console.log(`[MCP-LOG-HANDLER] Setting notification handler for ${clientCount} existing clients`);
    
    for (const [serverName, client] of this.mcpClients.entries()) {
      console.log(`[MCP-LOG-HANDLER] Setting notification handler for client: ${serverName}`);
      
      if ('notification' in client) {
        client.notification = async (notification: { method: string; params?: unknown }) => {
          console.log(`[MCP-LOG-HANDLER] Notification received from ${serverName}`);
          this.handleMCPNotification(serverName, notification);
        };
        console.log(`[MCP-LOG-HANDLER] Successfully set notification handler for ${serverName}`);
      } else {
        console.warn(`[MCP-LOG-HANDLER] Client ${serverName} does not support notifications!`);
      }
    }
    console.log('=== [MCP-LOG-HANDLER] LOG HANDLER SETUP COMPLETE ===\n');
  }

  async initializeServers(config: MCPServersConfig): Promise<void> {
    console.log('\n=== [SETUP] Starting MCP Server Initialization ===');

    for (const [serverName, serverConfig] of Object.entries(config.mcpServers)) {
      try {
        console.log(`\n=== [SETUP] Creating client for: ${serverName} ===`);
        
        // Create new MCP client instance for this server
        const client = new McpClient(
          { name: serverName, version: '1.0.0' },
          { capabilities: { tools: {}, logging: {} } }  // Add logging capability
        );
        console.log(`[SETUP] Client created with capabilities:`, {
          tools: true,
          logging: true
        });
        
        // Set up notification handler
        if ('notification' in client) {
          console.log(`[SETUP] Setting notification handler for ${serverName} BEFORE connection`);
          const serverNameCopy = serverName; // Ensure serverName is captured for the closure
          
          client.notification = async (notification: { method: string; params?: unknown }) => {
            console.log(`\n[RECEIVE] ${serverName} INITIAL NOTIFICATION RECEIVED:`, notification.method);
            this.handleMCPNotification(serverNameCopy, notification);
          };
          
          console.log(`[SETUP] Notification handler set`);
        } else {
          console.warn(`[SETUP] ❌ Client ${serverName} does NOT support notifications!`);
        }

        // Adjust paths for node_modules if needed
        const modifiedArgs = serverConfig.args.map(arg => {
          if (arg.startsWith('./node_modules/')) {
            return arg.replace('./', '');
          }
          return arg;
        });

        console.log(`[SETUP] Attempting to connect client for ${serverName}`);
        // Connect client using StdioClientTransport
        await client.connect(new StdioClientTransport({ 
          command: serverConfig.command,
          args: modifiedArgs,
          env: {
            ...serverConfig.env,  // Base environment from config
            ...Object.fromEntries(  // Override with process.env values
              Object.entries(process.env).filter(([_, v]) => v !== undefined)
            ) as Record<string, string>
          }
        }));
        console.log(`[SETUP] ✅ Client connected successfully for ${serverName}`);
        
        // Store client instance for future use
        this.mcpClients.set(serverName, client);
        
        // Verify notification handler is still set after connection
        console.log(`[SETUP] Verifying notification handler after connection`);
        if ('notification' in client && typeof client.notification === 'function') {
          console.log(`[SETUP] ✅ Notification handler still present after connection`);
        } else {
          console.warn(`[SETUP] ❌ Notification handler LOST after connection!`);
        }
        
        // Verify server functionality by listing available tools
        console.log(`[SETUP] Testing server by listing tools`);
        const tools = await client.listTools();
        console.log(`[SETUP] Successfully listed tools, count:`, tools.tools?.length || 0);
        
        // Process and validate tool list
        const toolsList = (tools.tools || []) as unknown[];
        const serverTools = toolsList
          .filter((tool: unknown) => {
            if (!tool || typeof tool !== 'object') return false;
            const t = tool as { name: string };
            if (!t.name || typeof t.name !== 'string') return false;
            return t.name.startsWith(`${serverName}:`) || !t.name.includes(':');
          })
          .map((tool: unknown) => (tool as { name: string }).name);

        // Update server status based on tool availability
        this.serverStatuses[serverName] = serverTools.length > 0;
        
        console.log(`[${serverName}] ✅ Started successfully with ${serverTools.length} tools`);
      } catch (error) {
        console.error(`[${serverName}] ❌ Failed to start:`, error);
        this.serverStatuses[serverName] = false;
      }
    }

    console.log('\n=== MCP Server Status Summary ===');
    Object.entries(this.serverStatuses).forEach(([name, status]) => {
      console.log(`${status ? '✅' : '❌'} ${name}: ${status ? 'Running' : 'Failed'}`);
    });
  }

  async getAllAvailableTools(blockedServers: string[] = []): Promise<AnthropicTool[]> {
    let mcpTools: AnthropicTool[] = [];
    
    console.log('\n=== Tool Selection Process ===');
    console.log('Checking available servers and their tools...');
    console.log('Blocked servers:', blockedServers);
    
    this.toolNameMapping.clear();
    
    for (const [serverName, client] of this.mcpClients.entries()) {
      try {
        console.log(`\nServer: ${serverName}`);
        console.log(`Status: ${blockedServers.includes(serverName) ? 'BLOCKED' : 'AVAILABLE'}`);
        
        if (blockedServers.includes(serverName)) {
          console.log('Skipping blocked server');
          continue;
        }

        const toolsResult = await client.listTools();
        
        if (toolsResult.tools) {
          console.log(`Available tools: ${toolsResult.tools.length}`);
          const toolsWithPrefix = toolsResult.tools.map(tool => {
            console.log(`- ${tool.name}: ${tool.description || 'No description'}`);
            
            // Create Anthropic-friendly tool name and store mapping
            const originalName = `${serverName}:${tool.name}`;
            const anthropicName = `${serverName}-${tool.name}`.replace(/[^a-zA-Z0-9_-]/g, '-');
            this.toolNameMapping.set(anthropicName, originalName);
            
            // Extract and process schema definitions
            const definitions = tool.inputSchema.$defs || {};
            
            // Create complete schema with all properties
            const completeSchema = {
              ...tool.inputSchema,
              properties: tool.inputSchema.properties || {}
            };

            // Resolve all schema references
            const resolvedSchema = this.resolveSchemaRefs(completeSchema, definitions);
            
            // Format tool for Anthropic's API
            const formattedTool: AnthropicTool = {
              name: anthropicName,
              description: tool.description || `Tool for ${tool.name} from ${serverName} server`,
              input_schema: {
                type: "object",
                properties: resolvedSchema.properties || {},
                required: Array.isArray(tool.inputSchema.required) ? tool.inputSchema.required : []
              }
            };
            
            return formattedTool;
          });
          mcpTools = mcpTools.concat(toolsWithPrefix);
        } else {
          console.log('No tools available');
        }
      } catch (error) {
        console.error(`Failed to get tools from server ${serverName}:`, error);
      }
    }
    
    console.log('\n=== Tool Selection Summary ===');
    console.log(`Total tools available to LLM: ${mcpTools.length}`);
    if (mcpTools.length > 0) {
      console.log('\nAvailable Tools List:');
      mcpTools.forEach(tool => {
        console.log(`- [${tool.name}] ${tool.description}`);
      });
    }
    console.log('=============================\n');
    
    return mcpTools;
  }

  private resolveSchemaRefs(schema: any, definitions: Record<string, any> = {}): any {
    if (!schema || typeof schema !== 'object') return schema;

    // Handle direct references
    if ('$ref' in schema) {
      const refPath = schema.$ref.replace(/^#\/components\/schemas\//, '').replace(/^#\/\$defs\//, '');
      const resolved = definitions[refPath];
      if (!resolved) {
        console.error(`Failed to resolve reference: ${schema.$ref}`);
        return schema;
      }
      const { $ref, ...rest } = schema;
      return { ...this.resolveSchemaRefs(resolved, definitions), ...rest };
    }

    // Handle arrays
    if (Array.isArray(schema)) {
      return schema.map(item => this.resolveSchemaRefs(item, definitions));
    }

    // Handle nested objects and special cases
    const result: any = {};
    for (const [key, value] of Object.entries(schema)) {
      if (key === 'properties' && typeof value === 'object' && value !== null) {
        result[key] = {};
        for (const [propKey, propValue] of Object.entries(value)) {
          result[key][propKey] = this.resolveSchemaRefs(propValue, definitions);
        }
      } else if (key === 'items' && typeof value === 'object') {
        result[key] = this.resolveSchemaRefs(value, definitions);
      } else if (typeof value === 'object') {
        result[key] = this.resolveSchemaRefs(value, definitions);
      } else {
        result[key] = value;
      }
    }
    return result;
  }

  getOriginalToolName(anthropicName: string): string | undefined {
    return this.toolNameMapping.get(anthropicName);
  }

  async callTool(serverName: string, toolName: string, args: Record<string, unknown>) {
    const client = this.mcpClients.get(serverName);
    if (!client) {
      throw new Error(`Server ${serverName} not found`);
    }

    return await client.callTool({
      name: toolName,
      arguments: args
    });
  }

  getServerStatus(serverName: string): boolean {
    return this.serverStatuses[serverName] || false;
  }
} 