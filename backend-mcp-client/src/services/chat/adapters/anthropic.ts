/**
 * Anthropic (Claude) Tool Adapter
 * 
 * Handles Claude's tool calling format:
 * - Tools are defined with input_schema directly on the tool object
 * - Tool calls come as 'tool_use' content blocks
 * - Tool results are sent as 'tool_result' in user messages
 * - Tool choice must be specified as { type: "tool", name: "tool_name" }
 */

import { AnthropicTool } from '../../mcp';
import { ToolCall, ToolCallAdapter, ToolResult } from './types';

// Define type for Claude's tool use content block
interface ClaudeToolUseBlock {
  type: string;
  id: string;
  name: string;
  input: any;
}

// Define type for Claude's tool choice
interface ClaudeToolChoice {
  type: 'tool';
  name: string;
}

// Define type for Claude's tool format
interface ClaudeTool {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

export class AnthropicToolAdapter implements ToolCallAdapter {
  /**
   * Convert MCP tools to Claude's format and specify tool choice
   * @param tools MCP tools to convert
   * @returns Tools in Claude format and tool choice if specified
   */
  convertToolDefinitions(tools: AnthropicTool[]): ClaudeTool[] {
    console.log('🔵 [ADAPTER: ANTHROPIC/CLAUDE] Converting tool definitions');
    console.log('🔵 [ADAPTER: ANTHROPIC/CLAUDE] Input tools:', JSON.stringify(tools, null, 2));
    
    // Convert tools to Claude format
    const claudeTools = tools.map(tool => {
      // Ensure we have a valid input_schema
      if (!tool.input_schema) {
        console.log(`🔵 [ADAPTER: ANTHROPIC/CLAUDE] Warning: Tool ${tool.name} missing input_schema, creating default`);
        tool.input_schema = {
          type: 'object',
          properties: {},
          required: []
        };
      }

      // Ensure properties exists
      if (!tool.input_schema.properties) {
        console.log(`🔵 [ADAPTER: ANTHROPIC/CLAUDE] Warning: Tool ${tool.name} missing properties, creating empty object`);
        tool.input_schema.properties = {};
      }

      const convertedTool: ClaudeTool = {
        name: tool.name || 'unknown-tool',
        description: tool.description || 'No description provided',
        input_schema: {
          type: 'object',
          properties: tool.input_schema.properties,
          required: tool.input_schema.required || []
        }
      };
      
      console.log(`🔵 [ADAPTER: ANTHROPIC/CLAUDE] Converted tool ${tool.name}:`, JSON.stringify(convertedTool, null, 2));
      return convertedTool;
    });
    
    return claudeTools;
  }
  
  /**
   * Extract tool calls from Claude's response
   * @param response The Claude response
   * @returns Extracted tool calls
   */
  extractToolCalls(response: any): ToolCall[] {
    console.log('🔵 [ADAPTER: ANTHROPIC/CLAUDE] Extracting tool calls from response');
    console.log('🔵 [ADAPTER: ANTHROPIC/CLAUDE] Raw response:', JSON.stringify(response, null, 2));
    
    // Check if response has expected format
    if (!response || !response.content || !Array.isArray(response.content)) {
      console.log('🔵 [ADAPTER: ANTHROPIC/CLAUDE] Invalid response format');
      return [];
    }
    
    // Filter for tool_use blocks
    const toolCalls = response.content
      .filter((block: any) => block && block.type === 'tool_use')
      .map((block: ClaudeToolUseBlock) => ({
        name: block.name,
        input: block.input,
        toolUseId: block.id // Claude uses this ID in tool_result
      }));
    
    console.log('🔵 [ADAPTER: ANTHROPIC/CLAUDE] Extracted tool calls:', JSON.stringify(toolCalls, null, 2));
    return toolCalls;
  }
  
  /**
   * Format tool results for Claude
   * @param results Tool results to format
   * @returns Results in Claude's format
   */
  formatToolResults(results: ToolResult[]): any {
    console.log('🔵 [ADAPTER: ANTHROPIC/CLAUDE] Formatting tool results');
    console.log('🔵 [ADAPTER: ANTHROPIC/CLAUDE] Input results:', JSON.stringify(results, null, 2));
    
    // Claude expects tool results in user messages with content blocks
    const formattedResults = {
      role: 'user',
      content: results.map(result => ({
        type: 'tool_result',
        tool_use_id: result.toolCallId,
        content: typeof result.content === 'string' 
          ? result.content 
          : JSON.stringify(result.content)
      }))
    };
    
    console.log('🔵 [ADAPTER: ANTHROPIC/CLAUDE] Formatted results:', JSON.stringify(formattedResults, null, 2));
    return formattedResults;
  }
} 