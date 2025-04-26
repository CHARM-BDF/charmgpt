import { Client as McpClient } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { randomUUID } from 'crypto';
import { ChildProcess, spawn } from 'child_process';

const DEBUG = false;  // Debug flag for controlling verbose logging

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
  private mcpProcesses: Map<string, ChildProcess>;

  constructor() {
    this.mcpClients = new Map();
    this.toolNameMapping = new Map();
    this.serverStatuses = {};
    this.mcpProcesses = new Map();
    if (DEBUG) console.log('[MCP-DEBUG] MCPService initialized');
  }

  // Function to handle notifications from MCP clients
  private handleMCPNotification(serverName: string, notification: { method: string; params?: unknown }) {
    const traceId = notification?.params && typeof notification.params === 'object' && 'data' in notification.params
      ? ((notification.params as any).data?.traceId || randomUUID().split('-')[0])
      : randomUUID().split('-')[0];
    
    if (DEBUG) {
      console.log(`\n=== [CLIENT-NOTIFICATION:${traceId}] RECEIVED FROM ${serverName} ===`);
      console.log(`[CLIENT-NOTIFICATION:${traceId}] Method: ${notification.method}`);
      console.log(`[CLIENT-NOTIFICATION:${traceId}] Params Type: ${typeof notification.params}`);
    }
    
    if (notification.method === 'notifications/message') {
      if (DEBUG) console.log(`[CLIENT-NOTIFICATION:${traceId}] 📝 LOG MESSAGE DETECTED - FULL PARAMS:`, JSON.stringify(notification.params, null, 2));
    } else if (DEBUG) {
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
    } 
    // else {
    //   console.log(`[CLIENT-NOTIFICATION:${traceId}] Not a log message notification, ignoring`);
    // }
    // console.log(`=== [CLIENT-NOTIFICATION:${traceId}] END NOTIFICATION PROCESSING ===\n`);
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
      // console.log(`[MCP-LOG-HANDLER] Setting notification handler for client: ${serverName}`);
      
      if ('notification' in client) {
        client.notification = async (notification: { method: string; params?: unknown }) => {
          console.log(`[MCP-LOG-HANDLER] Notification received from ${serverName}`);
          this.handleMCPNotification(serverName, notification);
        };
        // console.log(`[MCP-LOG-HANDLER] Successfully set notification handler for ${serverName}`);
      } else {
        console.warn(`[MCP-LOG-HANDLER] Client ${serverName} does not support notifications!`);
      }
    }
    console.log('=== [MCP-LOG-HANDLER] LOG HANDLER SETUP COMPLETE ===\n');
  }

  // Add method to handle direct stdout parsing from MCP processes
  private handleMCPOutput(serverName: string, mcpProcess: ChildProcess) {
    if (DEBUG) console.log(`[MCP-DIRECT:${serverName}] Setting up direct stdout parsing for ${serverName}`);
    
    if (mcpProcess.stdout) {
      mcpProcess.stdout.on('data', (data) => {
        const output = data.toString().trim();
        
        if (DEBUG) {
          console.log(`\n[MCP-DIRECT:${serverName}] RAW OUTPUT START ===`);
          console.log(output);
          console.log(`=== [MCP-DIRECT:${serverName}] RAW OUTPUT END\n`);
        }
        
        if (output.includes('"method":"notifications/message"')) {
          const jsonStart = output.indexOf('{"method');
          if (jsonStart >= 0) {
            try {
              const jsonStr = output.substring(jsonStart);
              const notification = JSON.parse(jsonStr);
              
              const traceId = randomUUID().split('-')[0];
              if (DEBUG) {
                console.log(`\n=== [MCP-DIRECT:${serverName}:${traceId}] DETECTED LOG MESSAGE IN STDOUT ===`);
              }
              
              if (notification.params && notification.method === 'notifications/message') {
                if (this.logMessageHandler) {
                  try {
                    this.logMessageHandler(notification.params as MCPLogMessage);
                  } catch (error) {
                    console.error(`[MCP-DIRECT:${serverName}:${traceId}] ❌ Error in log handler:`, error);
                  }
                } else if (DEBUG) {
                  console.warn(`[MCP-DIRECT:${serverName}:${traceId}] ❌ No log message handler available`);
                }
              } else if (DEBUG) {
                console.log(`[MCP-DIRECT:${serverName}:${traceId}] Not a log message notification, method: ${notification.method}`);
              }
            } catch (error) {
              console.error(`[MCP-DIRECT:${serverName}] Error parsing JSON from stdout:`, error);
            }
          }
        } else if (DEBUG) {
          console.log(`[MCP-DIRECT:${serverName}] No notification message found in output`);
        }
      });
    } else {
      console.warn(`[MCP-DIRECT:${serverName}] No stdout available for process`);
    }
    
    if (mcpProcess.stderr) {
      mcpProcess.stderr.on('data', (data) => {
        if (DEBUG) console.error(`[MCP-DIRECT:${serverName}] STDERR: ${data.toString().trim()}`);
      });
    } else {
      console.warn(`[MCP-DIRECT:${serverName}] No stderr available for process`);
    }
    
    mcpProcess.on('close', (code) => {
      console.log(`[MCP-DIRECT:${serverName}] Process closed with code ${code}`);
    });
    
    mcpProcess.on('error', (error) => {
      console.error(`[MCP-DIRECT:${serverName}] Process error:`, error);
    });
    
    if (DEBUG) console.log(`[MCP-DIRECT:${serverName}] Direct stdout parsing setup complete`);
  }

  // Modify initializeServers to add process spawning
  async initializeServers(config: MCPServersConfig): Promise<void> {
    for (const [serverName, serverConfig] of Object.entries(config.mcpServers)) {
      try {
        if (DEBUG) console.log(`\n=== [SETUP] Creating client for: ${serverName} ===`);
        
        const client = new McpClient(
          { name: serverName, version: '1.0.0' },
          { capabilities: { tools: {}, logging: {} } }
        );
        if (DEBUG) console.log(`[SETUP] Client created with capabilities:`, {
          tools: true,
          logging: true
        });
        
        if ('notification' in client) {
          const serverNameCopy = serverName;
          client.notification = async (notification: { method: string; params?: unknown }) => {
            this.handleMCPNotification(serverNameCopy, notification);
          };
        } else if (DEBUG) {
          console.warn(`[SETUP] ❌ Client ${serverName} does NOT support notifications!`);
        }

        const modifiedArgs = serverConfig.args.map(arg => {
          if (arg.startsWith('./node_modules/')) {
            return arg.replace('./', '');
          }
          return arg;
        });

        if (DEBUG) console.log(`[SETUP] Attempting to connect client for ${serverName}`);
        
        await client.connect(new StdioClientTransport({ 
          command: serverConfig.command,
          args: modifiedArgs,
          env: {
            ...serverConfig.env,
            ...Object.fromEntries(
              Object.entries(process.env).filter(([_, v]) => v !== undefined)
            ) as Record<string, string>
          }
        }));
        
        this.mcpClients.set(serverName, client);
        
        const tools = await client.listTools();
        
        const toolsList = (tools.tools || []) as unknown[];
        const serverTools = toolsList
          .filter((tool: unknown) => {
            if (!tool || typeof tool !== 'object') return false;
            const t = tool as { name: string };
            if (!t.name || typeof t.name !== 'string') return false;
            return t.name.startsWith(`${serverName}:`) || !t.name.includes(':');
          })
          .map((tool: unknown) => (tool as { name: string }).name);

        this.serverStatuses[serverName] = serverTools.length > 0;
        
        if (DEBUG) console.log(`[${serverName}] ✅ Started successfully with ${serverTools.length} tools`);

        try {
          const env = {
            ...process.env,
            ...serverConfig.env
          };
          
          const mcpProcess = spawn(serverConfig.command, serverConfig.args, { env });
          
          this.mcpProcesses.set(serverName, mcpProcess);
          
          this.handleMCPOutput(serverName, mcpProcess);
          
        } catch (spawnError) {
          console.error(`[SETUP] Error spawning MCP process for ${serverName}:`, spawnError);
        }
      } catch (error) {
        console.error(`[${serverName}] ❌ Failed to start:`, error);
        this.serverStatuses[serverName] = false;
      }
    }

    console.log('\n\n=== MCP Server Status Summary ===\n' + 
      Object.entries(this.serverStatuses)
        .map(([name, status]) => `${status ? '✅' : '❌'} ${name}: ${status ? 'Running' : 'Failed'}`)
        .join('\n')
    );
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
        // console.log(`- [${tool.name}] ${tool.description}`);
        console.log(`- ${tool.name}`);
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

  // Add cleanup method
  cleanup(): void {
    console.log('\n=== [CLEANUP] Shutting down MCP service ===');
    
    // Clean up MCP processes
    console.log(`[CLEANUP] Terminating ${this.mcpProcesses.size} MCP processes`);
    for (const [serverName, process] of this.mcpProcesses.entries()) {
      try {
        console.log(`[CLEANUP] Terminating process for ${serverName}`);
        process.kill();
      } catch (error) {
        console.error(`[CLEANUP] Error terminating process for ${serverName}:`, error);
      }
    }
    
    // Clear the processes map
    this.mcpProcesses.clear();
    
    console.log('[CLEANUP] MCP service shutdown complete');
  }

  // Add a method to send a test log message
  // sendTestLogMessage() {
  //   console.log('\n=== [MCP-TEST] SENDING TEST LOG MESSAGE ===');
    
  //   const testMessage: MCPLogMessage = {
  //     level: 'info',
  //     logger: 'test-logger',
  //     data: {
  //       message: '[TEST] This is a test log message',
  //       timestamp: new Date().toISOString(),
  //       traceId: randomUUID().split('-')[0],
  //       source: 'test'
  //     }
  //   };
    
  //   if (this.logMessageHandler) {
  //     console.log('[MCP-TEST] Log handler found, sending test message');
  //     try {
  //       this.logMessageHandler(testMessage);
  //       console.log('[MCP-TEST] ✅ Test message sent successfully');
  //     } catch (error) {
  //       console.error('[MCP-TEST] ❌ Error sending test message:', error);
  //     }
  //   } else {
  //     console.warn('[MCP-TEST] ❌ No log message handler available');
  //   }
    
  //   console.log('=== [MCP-TEST] TEST COMPLETE ===\n');
  // }
} 