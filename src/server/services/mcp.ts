import { Client as McpClient } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

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

  constructor() {
    this.mcpClients = new Map();
    this.toolNameMapping = new Map();
    this.serverStatuses = {};
  }

  async initializeServers(config: MCPServersConfig): Promise<void> {
    console.log('\n=== Starting MCP Server Initialization ===');

    for (const [serverName, serverConfig] of Object.entries(config.mcpServers)) {
      try {
        // Create new MCP client instance for this server
        const client = new McpClient(
          { name: `${serverName}-client`, version: '1.0.0' },
          { capabilities: { tools: {} } }
        );
        
        // Adjust paths for node_modules if needed
        const modifiedArgs = serverConfig.args.map(arg => {
          if (arg.startsWith('./node_modules/')) {
            return arg.replace('./', '');
          }
          return arg;
        });

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

        // Store client instance for future use
        this.mcpClients.set(serverName, client);

        // Verify server functionality by listing available tools
        const tools = await client.listTools();
        
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