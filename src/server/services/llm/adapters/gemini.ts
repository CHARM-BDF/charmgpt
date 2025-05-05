/**
 * Google Gemini Tool Call Adapter
 * 
 * This adapter handles the conversion between MCP tool format and
 * Google's Gemini function calling format.
 */

import { ToolCallAdapter, MCPTool, ToolCall, ToolResult } from './types';

export class GeminiToolAdapter implements ToolCallAdapter {
  /**
   * Convert MCP tools to Gemini format
   * @param tools MCP tools to convert
   * @returns Tools in Gemini format
   */
  convertToolDefinitions(tools: MCPTool[]): any {
    return [{
      functionDeclarations: tools.map(tool => ({
        name: tool.name,
        description: tool.description,
        parameters: tool.schema
      }))
    }];
  }
  
  /**
   * Extract tool calls from a Gemini response
   * @param response The Gemini response
   * @returns Array of standardized tool calls
   */
  extractToolCalls(response: any): ToolCall[] {
    if (!response || !response.response) {
      return [];
    }
    
    try {
      const functionCalls = response.response.functionCalls();
      if (!functionCalls || functionCalls.length === 0) {
        return [];
      }
      
      return functionCalls.map((functionCall: any, index: number) => ({
        // Gemini doesn't provide unique IDs for function calls, so we generate one
        id: `gemini_function_${index}_${Date.now()}`,
        name: functionCall.name,
        input: functionCall.args || {}
      }));
    } catch (error) {
      console.error('Failed to extract Gemini function calls:', error);
      return [];
    }
  }
  
  /**
   * Format tool results for Gemini
   * @param toolResults The tool results to format
   * @returns Tool results in Gemini format
   */
  formatToolResults(toolResults: ToolResult[]): any {
    if (!toolResults || toolResults.length === 0) {
      return null;
    }
    
    // Gemini can only handle one function result at a time in the current API
    const result = toolResults[0];
    
    return {
      functionResponse: {
        name: result.toolName,
        response: {
          result: typeof result.content === 'string' 
            ? result.content 
            : result.content
        }
      }
    };
  }
  
  /**
   * Check if the response contains function calls
   * @param response The Gemini response
   * @returns Whether the response has function calls
   */
  hasFunctionCalls(response: any): boolean {
    if (!response || !response.response) {
      return false;
    }
    
    try {
      const functionCalls = response.response.functionCalls();
      return Array.isArray(functionCalls) && functionCalls.length > 0;
    } catch (error) {
      return false;
    }
  }
} 