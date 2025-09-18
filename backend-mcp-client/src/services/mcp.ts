import { Client as McpClient } from '@modelcontextprotocol/sdk/client/index.js';
import { randomUUID } from 'crypto';
import { ChildProcess } from 'child_process';
import { TransportFactory } from './transportFactory.js';
import { MCPServersConfig, MCPLogMessage, AnthropicTool } from '../types/mcp.js';

const DEBUG = false;  // Debug flag for controlling verbose logging

export class MCPService {
  private mcpClients: Map<string, McpClient>;
  private toolNameMapping: Map<string, string>;
  private serverStatuses: Record<string, boolean>;
  private logHandlers: Set<(message: MCPLogMessage) => void>;
  private mcpProcesses: Map<string, ChildProcess>;
  private stderrCapture: Map<string, ChildProcess>;

  constructor() {
    this.mcpClients = new Map();
    this.toolNameMapping = new Map();
    this.serverStatuses = {};
    this.logHandlers = new Set();
    this.mcpProcesses = new Map();
    this.stderrCapture = new Map();
    if (DEBUG) console.log('[MCP-DEBUG] MCPService initialized with event emitter pattern');
  }

  // Function to handle notifications from MCP clients
  private handleMCPNotification(serverName: string, notification: { method: string; params?: unknown }) {
    const traceId = notification?.params && typeof notification.params === 'object' && 'data' in notification.params
      ? ((notification.params as any).data?.traceId || randomUUID().split('-')[0])
      : randomUUID().split('-')[0];
    
    console.log(`\n🔍 [MCP-DEBUG:${traceId}] ===== MCP NOTIFICATION FLOW START =====`);
    console.log(`🔍 [MCP-DEBUG:${traceId}] 1. Received notification from ${serverName}`);
    console.log(`🔍 [MCP-DEBUG:${traceId}] Method: ${notification.method}`);
    
    if (notification.method === 'notifications/message') {
      console.log(`🔍 [MCP-DEBUG:${traceId}] 2. Processing log message notification`);
      console.log(`🔍 [MCP-DEBUG:${traceId}] Raw params:`, JSON.stringify(notification.params, null, 2));
      
      if (notification.params) {
        try {
          const logMessage = notification.params as MCPLogMessage;
          
          if (!logMessage.level) {
            console.error(`🔍 [MCP-DEBUG:${traceId}] ❌ Missing level in log message`);
            return;
          }
          
          console.log(`🔍 [MCP-DEBUG:${traceId}] 3. Log message validated:`);
          console.log(`🔍 [MCP-DEBUG:${traceId}] - Level: ${logMessage.level}`);
          console.log(`🔍 [MCP-DEBUG:${traceId}] - Logger: ${logMessage.logger || 'undefined'}`);
          console.log(`🔍 [MCP-DEBUG:${traceId}] - Data:`, logMessage.data);
          
          if (this.logHandlers.size > 0) {
            console.log(`🔍 [MCP-DEBUG:${traceId}] 4. Found ${this.logHandlers.size} log handlers`);
            let handlerIndex = 0;
            
            this.logHandlers.forEach(handler => {
              try {
                console.log(`🔍 [MCP-DEBUG:${traceId}] 5. Calling handler ${++handlerIndex}`);
                
                const formattedLogMessage: MCPLogMessage = {
                  level: logMessage.level,
                  logger: logMessage.logger || serverName,
                  data: {
                    ...logMessage.data,
                    message: logMessage.data?.message || JSON.stringify(logMessage.data),
                    traceId: traceId,
                    timestamp: new Date().toISOString()
                  }
                };
                
                console.log(`🔍 [MCP-DEBUG:${traceId}] 6. Sending formatted message to handler:`);
                console.log(`🔍 [MCP-DEBUG:${traceId}]`, JSON.stringify(formattedLogMessage, null, 2));
                
                handler(formattedLogMessage);
                console.log(`🔍 [MCP-DEBUG:${traceId}] ✅ Handler ${handlerIndex} completed`);
              } catch (handlerError) {
                console.error(`🔍 [MCP-DEBUG:${traceId}] ❌ Handler ${handlerIndex} error:`, handlerError);
              }
            });
          } else {
            console.warn(`🔍 [MCP-DEBUG:${traceId}] ❌ No log handlers registered`);
          }
        } catch (error) {
          console.error(`🔍 [MCP-DEBUG:${traceId}] ❌ Error processing log message:`, error);
        }
      }
    }
    console.log(`🔍 [MCP-DEBUG:${traceId}] ===== MCP NOTIFICATION FLOW END =====\n`);
  }

  // Add a log handler (multiple handlers supported)
  addLogHandler(handler: (message: MCPLogMessage) => void): void {
    const stackTrace = new Error().stack || '';
    const callerInfo = stackTrace.split('\n')[2] || 'unknown caller';
    
    console.log('\n=== [MCP-LOG-HANDLER] ADDING NEW LOG MESSAGE HANDLER ===');
    console.log(`[MCP-LOG-HANDLER] Called from: ${callerInfo}`);
    console.log(`[MCP-LOG-HANDLER] Handler type: ${typeof handler}`);
    console.log(`[MCP-LOG-HANDLER] Total handlers before add: ${this.logHandlers.size}`);
    
    this.logHandlers.add(handler);
    
    console.log(`[MCP-LOG-HANDLER] Total handlers after add: ${this.logHandlers.size}`);
    console.log('=== [MCP-LOG-HANDLER] LOG HANDLER ADDED ===\n');
  }

  // Remove a log handler
  removeLogHandler(handler: (message: MCPLogMessage) => void): void {
    const removed = this.logHandlers.delete(handler);
    console.log(`[MCP-LOG-HANDLER] Handler removed: ${removed}, remaining handlers: ${this.logHandlers.size}`);
  }

  // Legacy method for backward compatibility - now adds to the set instead of replacing
  setLogMessageHandler(handler: (message: MCPLogMessage) => void): void {
    console.log('[MCP-LOG-HANDLER] DEPRECATED: setLogMessageHandler called, using addLogHandler instead');
    this.addLogHandler(handler);
  }

  // Clear all handlers (useful for cleanup)
  clearLogHandlers(): void {
    const count = this.logHandlers.size;
    this.logHandlers.clear();
    console.log(`[MCP-LOG-HANDLER] Cleared ${count} log handlers`);
  }

  // ❌ REMOVED: handleMCPOutput method
  // This method was used for direct process spawning which was causing logging conflicts.
  // MCP logging now works through the proper notification system in the MCP client connection.

  // NEW: Start stderr capture process for real-time logging
  // REMOVED: Old stderr capture method - replaced with direct StdioClientTransport process access

  // NEW: Helper method to trigger log handlers
  private triggerLogHandlers(message: MCPLogMessage): void {
    for (const handler of this.logHandlers) {
      try {
        handler(message);
      } catch (error) {
        console.error('Error in log handler:', error);
      }
    }
  }

  // Initialize MCP servers with proper notification setup AND stderr capture
  async initializeServers(config: MCPServersConfig): Promise<void> {
    console.log('\n=== [SETUP] Starting MCP Server Initialization ===');
    console.log(`[SETUP] Found ${Object.keys(config.mcpServers).length} servers to initialize`);
    
    for (const [serverName, serverConfig] of Object.entries(config.mcpServers)) {
      try {
        if (DEBUG) console.log(`\n=== [SETUP] Creating client for: ${serverName} ===`);
        
        // Validate server configuration
        TransportFactory.validateConfig(serverName, serverConfig);
        
        const client = new McpClient(
          { name: serverName, version: '1.0.0' },
          { 
            capabilities: { 
              tools: {},
              logging: {},
              notifications: {
                "notifications/message": true
              }
            } 
          }
        );
        if (DEBUG) console.log(`[SETUP] Client created with capabilities:`, {
          tools: true,
          logging: true,
          notifications: { "notifications/message": true }
        });

        if (DEBUG) console.log(`[SETUP] Attempting to connect client for ${serverName}`);
        
        // Create appropriate transport (local or remote)
        const transportInfo = TransportFactory.createTransport(serverName, serverConfig);
        const { transport, isRemote } = transportInfo;
        
        // Set timeout for remote connections
        const connectionTimeout = serverConfig.timeout || (isRemote ? 30000 : 10000);
        
        // Connect with timeout and proper error handling
        try {
          await Promise.race([
            client.connect(transport),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error(`Connection timeout after ${connectionTimeout}ms`)), connectionTimeout)
            )
          ]);
          
          const connectionType = isRemote ? 'remote' : 'local';
          console.log(`[SETUP] ✅ Connected to ${serverName} (${connectionType}) with official MCP logging support`);
        } catch (connectionError) {
          const connectionType = isRemote ? 'remote' : 'local';
          const errorMessage = connectionError instanceof Error ? connectionError.message : 'Unknown connection error';
          
          console.error(`[SETUP] ❌ Failed to connect to ${connectionType} server ${serverName}: ${errorMessage}`);
          
          if (isRemote) {
            console.error(`[SETUP] Remote server details:`, {
              url: (serverConfig as { url?: string }).url,
              transport: (serverConfig as { transport?: string }).transport
            });
          }
          
          // Mark server as failed but continue with other servers
          this.serverStatuses[serverName] = false;
          continue;
        }
        
        // ✅ SET NOTIFICATION HANDLER ONCE AFTER CONNECTION
        if ('notification' in client) {
          const serverNameCopy = serverName;
          client.notification = async (notification: { method: string; params?: unknown }) => {
            this.handleMCPNotification(serverNameCopy, notification);
          };
          console.log(`[SETUP] ✅ Notification handler set for ${serverName}`);
        } else {
          console.warn(`[SETUP] ❌ Client ${serverName} does NOT support notifications!`);
        }
        
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
        
        console.log(`[${serverName}] ✅ Started successfully with ${serverTools.length} tools`);

        // ❌ REMOVED: Duplicate process spawning that was interfering with logging
        // This was causing conflicts because each MCP server can only handle one stdio connection
        
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
    
    console.log(`\n[SETUP] ✅ MCP Server initialization complete. Active log handlers: ${this.logHandlers.size}`);
  }

  async getAllAvailableTools(blockedServers: string[] = []): Promise<AnthropicTool[]> {
    let mcpTools: AnthropicTool[] = [];
    
    console.log('\n=== Tool Selection Process ===');
    console.log('Checking available servers and their tools...');
    
    // Enhanced debugging for blockedServers
    console.log('💡 [MCP TRACE] Blocked servers list (raw):', blockedServers);
    console.log('💡 [MCP TRACE] Type of blockedServers:', Array.isArray(blockedServers) ? 'Array' : typeof blockedServers);
    console.log('💡 [MCP TRACE] blockedServers.length:', blockedServers.length);
    
    if (Array.isArray(blockedServers)) {
      console.log('💡 [MCP TRACE] Individual blocked servers:');
      blockedServers.forEach((server, index) => {
        console.log(`  [${index}] "${server}" (type: ${typeof server})`);
      });
      
      // Check for mapping issues by trying to match each blocked server
      console.log('💡 [MCP TRACE] Checking if any servers would be blocked:');
      const mcpServerNames = Array.from(this.mcpClients.keys());
      console.log('💡 [MCP TRACE] Available server names:', mcpServerNames);
      
      let potentialBlocks = 0;
      for (const serverToBlock of blockedServers) {
        const exactMatches = mcpServerNames.filter(name => name === serverToBlock);
        const partialMatches = mcpServerNames.filter(name => 
          name.includes(serverToBlock) || serverToBlock.includes(name)
        );
        
        console.log(`💡 [MCP TRACE] Server "${serverToBlock}": ` +
          `${exactMatches.length} exact matches, ${partialMatches.length} partial matches`);
          
        if (exactMatches.length > 0) {
          console.log(`  - Exact matches: ${exactMatches.join(', ')}`);
          potentialBlocks += exactMatches.length;
        }
        
        if (partialMatches.length > 0) {
          console.log(`  - Partial matches: ${partialMatches.join(', ')}`);
          potentialBlocks += partialMatches.length - exactMatches.length; // Don't double count
        }
      }
      
      console.log(`💡 [MCP TRACE] Total potential blocks: ${potentialBlocks}`);
    } else {
      console.error('⚠️ blockedServers is not an array! This will cause filtering to fail.');
    }
    
    this.toolNameMapping.clear();
    
    console.log('\n=== Processing Individual Servers ===');
    for (const [serverName, client] of this.mcpClients.entries()) {
      try {
        console.log(`\nServer: "${serverName}"`);
        
        // Technical names should be exact matches since we're passing the correct names
        const isBlocked = Array.isArray(blockedServers) && 
                         blockedServers.some(blockedName => 
                           serverName === blockedName
                         );
                           
        console.log(`💡 [MCP TRACE] Status check: "${serverName}" blocked? ${isBlocked}`);
        console.log(`Final Status: ${isBlocked ? '🚫 BLOCKED' : '✅ ALLOWED'} - Server "${serverName}"`);
        
        // Enhanced debugging of the matching check  
        if (Array.isArray(blockedServers) && blockedServers.length > 0) {
          console.log('💡 [MCP TRACE] Checking exact matches with each blocked server:');
          console.log('💡 [MCP TRACE] IMPORTANT: Using exact string matching (===) for server names.');
          console.log('💡 [MCP TRACE] Make sure client sends full server names from /api/server-names endpoint.');
          blockedServers.forEach((blockedName, i) => {
            const exactMatch = blockedName === serverName;
            console.log(`  [${i}] "${blockedName}" === "${serverName}" ? ${exactMatch}`);
          });
        }
        
        if (isBlocked) {
          console.log(`💡 [MCP TRACE] Skipping blocked server: ${serverName}`);
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
            
            console.log(`🔧 [TOOL-REGISTRATION] Server: "${serverName}", Tool: "${tool.name}"`);
            console.log(`🔧 [TOOL-REGISTRATION] Original name: "${originalName}"`);
            console.log(`🔧 [TOOL-REGISTRATION] Anthropic name: "${anthropicName}"`);
            console.log(`🔧 [TOOL-REGISTRATION] Mapping: "${anthropicName}" → "${originalName}"`);
            
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
    
    // Log allowed servers summary
    const allServerNames = Array.from(this.mcpClients.keys());
    const blockedServerNames = allServerNames.filter(name => 
      Array.isArray(blockedServers) && blockedServers.some(blockedName => name === blockedName)
    );
    const allowedServerNames = allServerNames.filter(name => 
      !blockedServerNames.includes(name)
    );
    
    console.log('\n=== Server Availability Summary ===');
    console.log(`Total servers: ${allServerNames.length}`);
    console.log(`Blocked servers: ${blockedServerNames.length} - ${JSON.stringify(blockedServerNames)}`);
    console.log(`Allowed servers: ${allowedServerNames.length} - ${JSON.stringify(allowedServerNames)}`);
    
    if (mcpTools.length > 0) {
      console.log('\nAvailable Tools List:');
      mcpTools.forEach(tool => {
        // console.log(`- [${tool.name}] ${tool.description}`);
        console.log(`- ${tool.name}`);
      });
      
      // Group tools by server for better visibility
      console.log('\nTools Grouped By Server:');
      const toolsByServer = new Map<string, string[]>();
      
      mcpTools.forEach(tool => {
        // Extract server name from the tool name (format is usually serverName-toolName)
        const serverName = tool.name.split('-')[0];
        if (!toolsByServer.has(serverName)) {
          toolsByServer.set(serverName, []);
        }
        toolsByServer.get(serverName)?.push(tool.name);
      });
      
      // Print tools grouped by server
      for (const [serverName, tools] of toolsByServer.entries()) {
        console.log(`Server "${serverName}": ${tools.length} tools`);
        tools.forEach(tool => console.log(`  - ${tool}`));
      }
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
    const result = this.toolNameMapping.get(anthropicName);
    
    if (!result) {
      console.log(`🔍 [TOOL-LOOKUP] Tool name not found: "${anthropicName}"`);
      
      // Try to find close matches for debugging
      const possibleMatches = Array.from(this.toolNameMapping.keys()).filter(key => 
        key.includes(anthropicName.split('-')[0]) || key.includes(anthropicName.split('-')[1] || '')
      );
      
      if (possibleMatches.length > 0) {
        console.log(`🔍 [TOOL-LOOKUP] Possible matches: ${possibleMatches.join(', ')}`);
      }
    }
    
    return result;
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

  // Add method to get all server names for logging/debugging
  getServerNames(): Set<string> {
    return new Set(this.mcpClients.keys());
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
    
    // Clean up stderr capture processes
    console.log(`[CLEANUP] Terminating ${this.stderrCapture.size} stderr capture processes`);
    for (const [serverName, process] of this.stderrCapture.entries()) {
      try {
        console.log(`[CLEANUP] Terminating stderr capture for ${serverName}`);
        process.kill('SIGTERM');
      } catch (error) {
        console.error(`[CLEANUP] Error terminating stderr capture for ${serverName}:`, error);
      }
    }
    
    // Clear the maps
    this.mcpProcesses.clear();
    this.stderrCapture.clear();
    
    console.log('[CLEANUP] MCP service shutdown complete');
  }

  // Add a method to send a test log message
  sendTestLogMessage() {
    console.log('\n=== [MCP-TEST] SENDING TEST LOG MESSAGE ===');
    
    const testMessage: MCPLogMessage = {
      level: 'info',
      logger: 'test-logger',
      data: {
        message: '[TEST] This is a test log message',
        timestamp: new Date().toISOString(),
        traceId: randomUUID().split('-')[0],
        source: 'test'
      }
    };
    
    if (this.logHandlers.size > 0) {
      console.log('[MCP-TEST] Log handlers found, sending test message');
      try {
        this.logHandlers.forEach(handler => {
          handler(testMessage);
        });
        console.log('[MCP-TEST] ✅ Test message sent successfully');
      } catch (error) {
        console.error('[MCP-TEST] ❌ Error sending test message:', error);
      }
    } else {
      console.warn('[MCP-TEST] ❌ No log message handlers available');
    }
    
    console.log('=== [MCP-TEST] TEST COMPLETE ===\n');
  }
} 