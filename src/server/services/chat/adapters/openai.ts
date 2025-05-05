/**
 * OpenAI Tool Adapter
 * 
 * Handles OpenAI's function calling format:
 * - Tools are defined as 'functions' with 'parameters'
 * - Tool calls come in the 'tool_calls' array with 'function' objects
 * - Tool results are sent as messages with role 'tool'
 */

import { AnthropicTool } from '../../mcp';
import { ToolCall, ToolCallAdapter, ToolResult } from './types';

// Define OpenAI-specific types
interface OpenAIFunction {
  type: string;
  function: {
    name: string;
    description: string;
    parameters: any;
  };
}

interface OpenAIToolCall {
  id: string;
  type: string;
  function: {
    name: string;
    arguments: string;
  };
}

export class OpenAIToolAdapter implements ToolCallAdapter {
  /**
   * Convert MCP tools to OpenAI's format
   * @param tools MCP tools to convert
   * @returns Tools in OpenAI format
   */
  convertToolDefinitions(tools: AnthropicTool[]): OpenAIFunction[] {
    console.log('🟢 [ADAPTER: OPENAI] Converting tool definitions');
    // Convert from MCP/Anthropic format to OpenAI format
    return tools.map(tool => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        // OpenAI uses 'parameters' instead of 'input_schema'
        parameters: tool.input_schema
      }
    }));
  }
  
  /**
   * Extract tool calls from OpenAI's response
   * @param response The OpenAI response
   * @returns Extracted tool calls
   */
  extractToolCalls(response: any): ToolCall[] {
    console.log('🟢 [ADAPTER: OPENAI] Extracting tool calls from response');
    // Check if response has expected format
    if (!response || !response.tool_calls || !Array.isArray(response.tool_calls)) {
      return [];
    }
    
    // Process the tool_calls array
    return response.tool_calls.map((call: OpenAIToolCall) => {
      let input;
      
      // Parse the arguments from JSON string
      try {
        input = JSON.parse(call.function.arguments);
      } catch (error) {
        console.error('Error parsing OpenAI tool arguments:', error);
        input = {}; // Fallback to empty object
      }
      
      return {
        name: call.function.name,
        input,
        toolUseId: call.id // OpenAI uses this ID for tool results
      };
    });
  }
  
  /**
   * Format tool results for OpenAI
   * @param results Tool results to format
   * @returns Results in OpenAI's format
   */
  formatToolResults(results: ToolResult[]): any[] {
    console.log('🟢 [ADAPTER: OPENAI] Formatting tool results');
    // OpenAI uses a different format for tool results
    return results.map(result => ({
      role: 'tool',
      tool_call_id: result.toolCallId,
      content: typeof result.content === 'string' 
        ? result.content 
        : JSON.stringify(result.content)
    }));
  }
} 