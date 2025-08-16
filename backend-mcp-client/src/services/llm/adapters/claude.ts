/**
 * Claude (Anthropic) Tool Call Adapter
 * 
 * This adapter handles the conversion between MCP tool format and
 * Anthropic's Claude tool calling format.
 */

import { ToolCallAdapter, MCPTool, ToolCall, ToolResult } from './types';

export class ClaudeToolAdapter implements ToolCallAdapter {
  /**
   * Convert MCP tools to Claude format
   * @param tools MCP tools to convert
   * @returns Tools in Claude format
   */
  convertToolDefinitions(tools: MCPTool[]): any {
    return tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.schema
    }));
  }
  
  /**
   * Extract tool calls from a Claude response
   * @param response The Claude response
   * @returns Array of standardized tool calls
   */
  extractToolCalls(response: any): ToolCall[] {
    if (!response || !response.content) {
      return [];
    }
    
    const toolCalls: ToolCall[] = [];
    
    for (const content of response.content) {
      if (content.type === 'tool_use') {
        toolCalls.push({
          id: content.id,
          name: content.name,
          input: content.input
        });
      }
    }
    
    return toolCalls;
  }
  
  /**
   * Format tool results for Claude
   * @param toolResults The tool results to format
   * @returns Tool results in Claude format
   */
  formatToolResults(toolResults: ToolResult[]): any {
    if (!toolResults || toolResults.length === 0) {
      return [];
    }
    
    return toolResults.map(result => ({
      type: 'tool_result',
      tool_use_id: result.toolCallId,
      content: typeof result.content === 'string' 
        ? result.content 
        : JSON.stringify(result.content)
    }));
  }
  
  /**
   * Format a complete user message with tool results for Claude
   * @param toolResults The tool results to include
   * @returns A complete user message object
   */
  formatToolResultsMessage(toolResults: ToolResult[]): any {
    return {
      role: 'user',
      content: this.formatToolResults(toolResults)
    };
  }
} 