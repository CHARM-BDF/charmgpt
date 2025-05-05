/**
 * Anthropic (Claude) Tool Adapter
 * 
 * Handles Claude's tool calling format:
 * - Tools are defined with 'input_schema'
 * - Tool calls come as 'tool_use' content blocks
 * - Tool results are sent as 'tool_result' in user messages
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

export class AnthropicToolAdapter implements ToolCallAdapter {
  /**
   * Convert MCP tools to Claude's format
   * @param tools MCP tools to convert
   * @returns Tools in Claude format
   */
  convertToolDefinitions(tools: AnthropicTool[]): AnthropicTool[] {
    console.log('🔵 [ADAPTER: ANTHROPIC/CLAUDE] Converting tool definitions');
    // Claude tool format is the same as AnthropicTool, so no conversion needed
    return tools;
  }
  
  /**
   * Extract tool calls from Claude's response
   * @param response The Claude response
   * @returns Extracted tool calls
   */
  extractToolCalls(response: any): ToolCall[] {
    console.log('🔵 [ADAPTER: ANTHROPIC/CLAUDE] Extracting tool calls from response');
    // Check if response has expected format
    if (!response || !response.content || !Array.isArray(response.content)) {
      return [];
    }
    
    // Filter for tool_use blocks
    return response.content
      .filter((block: any) => block && block.type === 'tool_use')
      .map((block: ClaudeToolUseBlock) => ({
        name: block.name,
        input: block.input,
        toolUseId: block.id // Claude uses this ID in tool_result
      }));
  }
  
  /**
   * Format tool results for Claude
   * @param results Tool results to format
   * @returns Results in Claude's format
   */
  formatToolResults(results: ToolResult[]): any {
    console.log('🔵 [ADAPTER: ANTHROPIC/CLAUDE] Formatting tool results');
    // Claude expects tool results in user messages with content blocks
    return {
      role: 'user',
      content: results.map(result => ({
        type: 'tool_result',
        tool_use_id: result.toolCallId,
        content: typeof result.content === 'string' 
          ? result.content 
          : JSON.stringify(result.content)
      }))
    };
  }
} 