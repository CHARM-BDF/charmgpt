/**
 * MCP Tool Bridge for LangGraph
 * 
 * This bridge converts existing MCP tools to LangGraph-compatible tools,
 * allowing the React agent to use the existing MCP service.
 */

import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { MCPService, AnthropicTool } from '../mcp';

/**
 * Convert JSON schema to Zod schema for LangChain tools
 */
function jsonSchemaToZod(schema: any): z.ZodSchema {
  if (!schema || !schema.properties) {
    return z.object({});
  }

  const zodFields: Record<string, z.ZodSchema> = {};
  
  for (const [key, prop] of Object.entries(schema.properties)) {
    const property = prop as any;
    let zodType: z.ZodSchema;
    
    switch (property.type) {
      case 'string':
        zodType = z.string();
        break;
      case 'number':
        zodType = z.number();
        break;
      case 'integer':
        zodType = z.number().int();
        break;
      case 'boolean':
        zodType = z.boolean();
        break;
      case 'array':
        // Handle array with proper items schema
        if (property.items) {
          const itemsSchema = convertJsonSchemaPropertyToZod(property.items);
          zodType = z.array(itemsSchema);
          
          // Add array constraints if specified
          if (property.minItems !== undefined) {
            zodType = zodType.min(property.minItems);
          }
          if (property.maxItems !== undefined) {
            zodType = zodType.max(property.maxItems);
          }
        } else {
          zodType = z.array(z.any());
        }
        break;
      case 'object':
        // Handle nested objects
        if (property.properties) {
          zodType = jsonSchemaToZod(property);
        } else {
          zodType = z.object({});
        }
        break;
      default:
        zodType = z.any();
    }
    
    // Add description if available
    if (property.description) {
      zodType = zodType.describe(property.description);
    }
    
    // Make optional if not required
    if (!schema.required?.includes(key)) {
      zodType = zodType.optional();
    }
    
    zodFields[key] = zodType;
  }
  
  return z.object(zodFields);
}

/**
 * Convert a single JSON schema property to Zod schema (helper for recursive conversion)
 */
function convertJsonSchemaPropertyToZod(property: any): z.ZodSchema {
  switch (property.type) {
    case 'string': {
      if (property.enum && Array.isArray(property.enum) && property.enum.length > 0) {
        return z.enum(property.enum as [string, ...string[]]);
      }
      return z.string();
    }
    case 'number':
      return z.number();
    case 'integer':
      return z.number().int();
    case 'boolean':
      return z.boolean();
          case 'array': {
        if (property.items) {
          const itemsSchema = convertJsonSchemaPropertyToZod(property.items);
          let arraySchema = z.array(itemsSchema);
          if (typeof property.minItems === 'number') {
            arraySchema = arraySchema.min(property.minItems);
          }
          if (typeof property.maxItems === 'number') {
            arraySchema = arraySchema.max(property.maxItems);
          }
          return arraySchema;
        } else {
          return z.array(z.any());
        }
      }
    case 'object':
      if (property.properties) {
        return jsonSchemaToZod(property);
      } else {
        return z.object({});
      }
    default:
      return z.any();
  }
}

/**
 * Create a bridge tool that wraps an MCP tool for use with LangGraph
 */
export function createMCPToolBridge(
  mcpService: MCPService,
  serverName: string,
  mcpTool: AnthropicTool
) {
  // The tool.name might be in format "serverName:toolName" or already be just the toolName
  let originalToolName: string;
  if (mcpTool.name.includes(':')) {
    originalToolName = mcpTool.name.split(':')[1];
  } else {
    originalToolName = mcpTool.name;
  }
  
  // Create a shorter, sanitized name that fits within 64 character limit
  let baseName = `${serverName}_${originalToolName}`.replace(/[^a-zA-Z0-9_]/g, '_');
  
  // Truncate if too long, keeping it under 64 characters
  if (baseName.length > 63) {
    // Try to keep the tool name part if possible
    const maxServerNameLength = 20;
    const truncatedServerName = serverName.length > maxServerNameLength 
      ? serverName.substring(0, maxServerNameLength) 
      : serverName;
    
    const remainingLength = 63 - truncatedServerName.length - 1; // -1 for underscore
    const truncatedToolName = originalToolName.length > remainingLength
      ? originalToolName.substring(0, remainingLength)
      : originalToolName;
    
    baseName = `${truncatedServerName}_${truncatedToolName}`.replace(/[^a-zA-Z0-9_]/g, '_');
  }

  // Convert JSON schema to Zod schema
  const zodSchema = jsonSchemaToZod(mcpTool.input_schema);
  
  console.log(`🔧 MCPToolBridge: Creating bridge tool - LangGraph name: "${baseName}" (${baseName.length} chars), MCP server: "${serverName}", MCP tool: "${originalToolName}"`);
  console.log(`🔧 MCPToolBridge: Tool description: "${mcpTool.description}"`);
  console.log(`🔧 MCPToolBridge: Tool input schema:`, JSON.stringify(mcpTool.input_schema, null, 2));
  
  return tool(
    async (args: any) => {
      console.log(`🔧 MCPToolBridge: TOOL EXECUTION STARTED - ${serverName}.${originalToolName}`);
      console.log(`🔧 MCPToolBridge: Input received:`, args);
      
      try {
        console.log(`🔧 MCPToolBridge: Calling ${serverName}.${originalToolName} with args:`, args);

        // Call the MCP tool through the existing service
        const result = await mcpService.callTool(serverName, originalToolName, args);
        
        console.log(`🔧 MCPToolBridge: Tool execution completed. Result type:`, typeof result);
        console.log(`🔧 MCPToolBridge: Tool result:`, JSON.stringify(result, null, 2));
        
        // Convert result to string
        let stringResult: string;
        if (typeof result === 'string') {
          stringResult = result;
        } else {
          stringResult = JSON.stringify(result, null, 2);
        }
        
        console.log(`🔧 MCPToolBridge: Returning string result (length: ${stringResult.length})`);
        return stringResult;
      } catch (error) {
        console.error(`❌ MCPToolBridge: Error calling ${serverName}.${originalToolName}:`, error);
        const errorMessage = `Error executing tool: ${error instanceof Error ? error.message : String(error)}`;
        console.log(`🔧 MCPToolBridge: Returning error message:`, errorMessage);
        return errorMessage;
      }
    },
    {
      name: baseName,
      description: mcpTool.description,
      schema: zodSchema,
    }
  );
}



/**
 * Create LangGraph-compatible tools from existing MCP service
 */
export async function createMCPToolsForLangGraph(
  mcpService: MCPService,
  blockedServers: string[] = []
) {
  try {
    // Get all available tools from MCP service
    const availableTools = await mcpService.getAllAvailableTools(blockedServers);
    
    const tools: any[] = [];
    
    // Group tools by server to get server names
    const serverNames = Array.from(mcpService.getServerNames());
    console.log(`🔧 MCPToolBridge: Available server names:`, serverNames);
    console.log(`🔧 MCPToolBridge: Available tools:`, availableTools.map(t => t.name));
    
    for (const serverName of serverNames) {
      if (blockedServers.includes(serverName)) {
        console.log(`🔧 MCPToolBridge: Skipping blocked server: ${serverName}`);
        continue;
      }
      
      console.log(`🔧 MCPToolBridge: Processing server: ${serverName}`);
      
      // Get tools for this server
      const serverTools = availableTools.filter(tool => {
        // Check if the tool name starts with this server name (handle both : and - formats)
        const belongsToServer = tool.name.startsWith(`${serverName}:`) || tool.name.startsWith(`${serverName}-`);
        console.log(`🔧 MCPToolBridge: Tool "${tool.name}" belongs to server "${serverName}": ${belongsToServer}`);
        return belongsToServer;
      });
      
      console.log(`🔧 MCPToolBridge: Found ${serverTools.length} tools for server ${serverName}`);
      
      // Create bridge tools
      for (const tool of serverTools) {
        // Extract the tool name from "serverName:toolName" or "serverName-toolName" format
        let originalName: string;
        if (tool.name.includes(':')) {
          originalName = tool.name.split(':')[1];
        } else if (tool.name.startsWith(`${serverName}-`)) {
          originalName = tool.name.substring(serverName.length + 1); // +1 for the hyphen
        } else {
          originalName = tool.name;
        }
        
        console.log(`🔧 MCPToolBridge: Processing tool - Anthropic name: "${tool.name}", Original name: "${originalName}", Server: "${serverName}"`);
        
        const bridgeTool = createMCPToolBridge(mcpService, serverName, {
          name: originalName,
          description: tool.description,
          input_schema: tool.input_schema
        });
        tools.push(bridgeTool);
      }
    }
    
    console.log(`MCPToolBridge: Created ${tools.length} bridge tools for LangGraph`);
    return tools;
  } catch (error) {
    console.error('MCPToolBridge: Error creating tools:', error);
    return [];
  }
} 