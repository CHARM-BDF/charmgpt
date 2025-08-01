/**
 * OpenAI Tool Call Adapter
 * 
 * This adapter handles the conversion between MCP tool format and
 * OpenAI's function calling format.
 */

import { ToolCallAdapter, MCPTool, ToolCall, ToolResult } from './types';

export class OpenAIToolAdapter implements ToolCallAdapter {
  /**
   * Convert MCP tools to OpenAI format
   * @param tools MCP tools to convert
   * @returns Tools in OpenAI format
   */
  convertToolDefinitions(tools: MCPTool[]): any {
    return tools.map(tool => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.schema
      }
    }));
  }
  
  /**
   * Extract tool calls from an OpenAI response
   * @param response The OpenAI response
   * @returns Array of standardized tool calls
   */
  extractToolCalls(response: any): ToolCall[] {
    if (!response || !response.choices || response.choices.length === 0) {
      return [];
    }
    
    const message = response.choices[0].message;
    if (!message || !message.tool_calls || !Array.isArray(message.tool_calls)) {
      return [];
    }
    
    return message.tool_calls.map((toolCall: any) => {
      // Parse the arguments string to an object
      let input = {};
      try {
        input = JSON.parse(toolCall.function.arguments);
      } catch (error) {
        console.error('Failed to parse OpenAI tool arguments:', error);
      }
      
      return {
        id: toolCall.id,
        name: toolCall.function.name,
        input
      };
    });
  }
  
  /**
   * Format tool results for OpenAI
   * @param toolResults The tool results to format
   * @returns Tool results in OpenAI format
   */
  formatToolResults(toolResults: ToolResult[]): any[] {
    if (!toolResults || toolResults.length === 0) {
      return [];
    }
    
    return toolResults.map(result => ({
      role: 'tool',
      tool_call_id: result.toolCallId,
      content: typeof result.content === 'string' 
        ? result.content 
        : JSON.stringify(result.content)
    }));
  }
  
  /**
   * Format a complete message array with tool results for OpenAI
   * @param originalMessage The original user message
   * @param assistantMessage The assistant message with tool calls
   * @param toolResults The tool results to include
   * @returns A complete message array for OpenAI
   */
  formatMessagesWithToolResults(
    originalMessage: any,
    assistantMessage: any,
    toolResults: ToolResult[]
  ): any[] {
    // Start with the original user message
    const messages = [originalMessage];
    
    // Add the assistant message with tool calls
    messages.push(assistantMessage);
    
    // Add each tool result as a separate message
    for (const result of this.formatToolResults(toolResults)) {
      messages.push(result);
    }
    
    return messages;
  }
} 