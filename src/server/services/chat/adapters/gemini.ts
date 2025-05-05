/**
 * Google Gemini Tool Adapter
 * 
 * Handles Gemini's function calling format:
 * - Tools are defined under a 'functionDeclarations' array
 * - Tool calls are accessed via a special 'functionCalls()' method
 * - Tool results are sent in a 'functionResponse' object
 */

import { AnthropicTool } from '../../mcp';
import { ToolCall, ToolCallAdapter, ToolResult } from './types';

// Define Gemini-specific types
interface GeminiFunctionDeclaration {
  name: string;
  description: string;
  parameters: any;
}

interface GeminiFunctionCall {
  name: string;
  args: Record<string, any>;
}

export class GeminiToolAdapter implements ToolCallAdapter {
  /**
   * Convert MCP tools to Gemini's format
   * @param tools MCP tools to convert
   * @returns Tools in Gemini format
   */
  convertToolDefinitions(tools: AnthropicTool[]): any {
    console.log('🟣 [ADAPTER: GEMINI] Converting tool definitions');
    // Gemini expects tools in a specific format under 'functionDeclarations'
    return {
      tools: [
        {
          functionDeclarations: tools.map(tool => ({
            name: tool.name,
            description: tool.description,
            parameters: tool.input_schema
          }))
        }
      ]
    };
  }
  
  /**
   * Extract tool calls from Gemini's response
   * @param response The Gemini response
   * @returns Extracted tool calls
   */
  extractToolCalls(response: any): ToolCall[] {
    console.log('🟣 [ADAPTER: GEMINI] Extracting tool calls from response');
    // Check if response has function calls available
    if (!response || typeof response.functionCalls !== 'function') {
      return [];
    }
    
    try {
      // Gemini provides a method to get function calls
      const functionCalls = response.functionCalls();
      
      if (!Array.isArray(functionCalls) || functionCalls.length === 0) {
        return [];
      }
      
      return functionCalls.map((call: GeminiFunctionCall, index: number) => ({
        name: call.name,
        input: call.args,
        // Gemini doesn't provide IDs, so we generate one
        toolUseId: `gemini-call-${index}-${Date.now()}`
      }));
    } catch (error) {
      console.error('Error extracting function calls from Gemini response:', error);
      return [];
    }
  }
  
  /**
   * Format tool results for Gemini
   * @param results Tool results to format
   * @returns Results in Gemini's format
   */
  formatToolResults(results: ToolResult[]): any {
    console.log('🟣 [ADAPTER: GEMINI] Formatting tool results');
    // Gemini wants a specific format for function results
    if (results.length === 0) {
      return {};
    }
    
    // Only use the first result for now
    const result = results[0];
    
    return {
      functionResponse: {
        name: result.name,
        response: {
          result: result.content
        }
      }
    };
  }
} 