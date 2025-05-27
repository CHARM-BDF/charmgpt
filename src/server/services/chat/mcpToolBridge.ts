/**
 * MCP Tool Bridge for LangGraph
 * 
 * This bridge converts existing MCP tools to LangGraph-compatible tools,
 * allowing the React agent to use the existing MCP service.
 */

import { Tool } from '@langchain/core/tools';
import { MCPService, AnthropicTool } from '../mcp';

/**
 * Bridge tool that wraps an MCP tool for use with LangGraph
 */
export class MCPToolBridge extends Tool {
  name: string;
  description: string;
  private mcpService: MCPService;
  private serverName: string;
  private originalToolName: string;

  constructor(
    mcpService: MCPService,
    serverName: string,
    tool: AnthropicTool
  ) {
    super();
    this.name = `${serverName}_${tool.name}`.replace(/[^a-zA-Z0-9_]/g, '_');
    this.description = tool.description;
    this.mcpService = mcpService;
    this.serverName = serverName;
    
    // The tool.name might be in format "serverName:toolName", we need just the toolName part
    if (tool.name.includes(':')) {
      this.originalToolName = tool.name.split(':')[1];
    } else {
      this.originalToolName = tool.name;
    }
    
    console.log(`🔧 MCPToolBridge: Created bridge tool - LangGraph name: "${this.name}", MCP server: "${serverName}", MCP tool: "${this.originalToolName}"`);
  }

  /**
   * Execute the MCP tool
   */
  async _call(input: string): Promise<string> {
    console.log(`🔧 MCPToolBridge: TOOL EXECUTION STARTED - ${this.serverName}.${this.originalToolName}`);
    console.log(`🔧 MCPToolBridge: Input received:`, input);
    
    try {
      // Parse input if it's JSON, otherwise use as-is
      let args: Record<string, unknown>;
      try {
        args = JSON.parse(input);
        console.log(`🔧 MCPToolBridge: Parsed JSON args:`, args);
      } catch {
        // If not JSON, create a simple object
        // For Python tools, use 'code' parameter instead of 'input'
        if (this.originalToolName === 'execute_python') {
          args = { code: input };
          console.log(`🔧 MCPToolBridge: Using raw input as 'code' parameter for Python tool:`, args);
        } else {
          args = { input };
          console.log(`🔧 MCPToolBridge: Using raw input as 'input' parameter:`, args);
        }
      }

      console.log(`🔧 MCPToolBridge: Calling ${this.serverName}.${this.originalToolName} with args:`, args);

      // Call the MCP tool through the existing service
      // The tool name should be in format "serverName:toolName" not "serverName.toolName"
      const mcpToolName = `${this.serverName}:${this.originalToolName}`;
      console.log(`🔧 MCPToolBridge: Using MCP tool name: "${mcpToolName}"`);
      
      const result = await this.mcpService.callTool(this.serverName, this.originalToolName, args);
      
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
      console.error(`❌ MCPToolBridge: Error calling ${this.serverName}.${this.originalToolName}:`, error);
      const errorMessage = `Error executing tool: ${error instanceof Error ? error.message : String(error)}`;
      console.log(`🔧 MCPToolBridge: Returning error message:`, errorMessage);
      return errorMessage;
    }
  }
}

/**
 * Create LangGraph-compatible tools from existing MCP service
 */
export async function createMCPToolsForLangGraph(
  mcpService: MCPService,
  blockedServers: string[] = []
): Promise<MCPToolBridge[]> {
  try {
    // Get all available tools from MCP service
    const availableTools = await mcpService.getAllAvailableTools(blockedServers);
    
    const tools: MCPToolBridge[] = [];
    
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
        // The tool name might be prefixed with server name
        const originalName = mcpService.getOriginalToolName(tool.name);
        const belongsToServer = originalName !== undefined;
        console.log(`🔧 MCPToolBridge: Tool "${tool.name}" -> original: "${originalName}", belongs to server: ${belongsToServer}`);
        return belongsToServer;
      });
      
      console.log(`🔧 MCPToolBridge: Found ${serverTools.length} tools for server ${serverName}`);
      
      // Create bridge tools
      for (const tool of serverTools) {
        const originalName = mcpService.getOriginalToolName(tool.name);
        console.log(`🔧 MCPToolBridge: Processing tool - Anthropic name: "${tool.name}", Original name: "${originalName}", Server: "${serverName}"`);
        
        if (originalName) {
          const bridgeTool = new MCPToolBridge(mcpService, serverName, {
            name: originalName,
            description: tool.description,
            input_schema: tool.input_schema
          });
          tools.push(bridgeTool);
        } else {
          console.warn(`🔧 MCPToolBridge: Could not get original name for tool: ${tool.name}`);
        }
      }
    }
    
    console.log(`MCPToolBridge: Created ${tools.length} bridge tools for LangGraph`);
    return tools;
  } catch (error) {
    console.error('MCPToolBridge: Error creating tools:', error);
    return [];
  }
} 