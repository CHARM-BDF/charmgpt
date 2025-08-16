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
    console.log(`🟢 [ADAPTER: OPENAI] Converting ${tools.length} tool definitions`);
    
    // Convert from MCP/Anthropic format to OpenAI format
    return tools.map(tool => {
      // Log the tool structure for debugging
      if (!tool.name || !tool.input_schema) {
        console.error(`❌ [ADAPTER: OPENAI] Invalid tool format for: ${JSON.stringify(tool).substring(0, 100)}...`);
      }
      
      return {
        type: 'function',
        function: {
          name: tool.name || 'unknown-tool',
          description: tool.description || 'No description provided',
          // OpenAI uses 'parameters' instead of 'input_schema'
          parameters: tool.input_schema || { type: "object", properties: {} }
        }
      };
    });
  }
  
  /**
   * Extract tool calls from OpenAI's response
   * @param response The OpenAI response
   * @returns Extracted tool calls
   */
  extractToolCalls(response: any): ToolCall[] {
    console.log('🟢 [ADAPTER: OPENAI] Extracting tool calls from response');
    
    // Log the response structure for debugging
    console.log(`🔍 [ADAPTER: OPENAI] Response structure: ${JSON.stringify({
      hasChoices: !!response?.choices,
      choicesLength: response?.choices?.length || 0,
      hasMessage: !!response?.choices?.[0]?.message,
      hasToolCalls: !!response?.choices?.[0]?.message?.tool_calls,
      toolCallsLength: response?.choices?.[0]?.message?.tool_calls?.length || 0
    })}`);
    
    // Check if response has the expected OpenAI format with tool calls in choices[0].message
    const toolCalls = response?.choices?.[0]?.message?.tool_calls;
    if (!toolCalls || !Array.isArray(toolCalls) || toolCalls.length === 0) {
      // Also check the direct format as a fallback (for compatibility)
      if (response?.tool_calls && Array.isArray(response.tool_calls) && response.tool_calls.length > 0) {
        console.log('🟢 [ADAPTER: OPENAI] Found tool calls directly on response object');
        return this.processToolCalls(response.tool_calls);
      }
      console.log('🟢 [ADAPTER: OPENAI] No tool calls found in response');
      return [];
    }
    
    console.log(`🟢 [ADAPTER: OPENAI] Found ${toolCalls.length} tool calls in response`);
    return this.processToolCalls(toolCalls);
  }
  
  /**
   * Process tool calls into the standardized format
   * @param toolCalls The tool calls from the OpenAI response
   * @returns Processed tool calls
   */
  private processToolCalls(toolCalls: OpenAIToolCall[]): ToolCall[] {
    return toolCalls.map((call: OpenAIToolCall) => {
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