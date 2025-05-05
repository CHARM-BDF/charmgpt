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
    const functionDeclarations = tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      parameters: {
        ...tool.input_schema,
        properties: tool.input_schema.properties || {},
        required: tool.input_schema.required || []
      }
    }));
    
    // Gemini expects tools wrapped in a specific structure
    return {
      tools: [
        {
          functionDeclarations
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
  formatToolResults(results: ToolResult[]): any[] {
    // Gemini expects tool results in a functionResponse object
    return results.map(result => ({
      functionResponse: {
        name: result.name, // Gemini requires the name
        response: {
          result: typeof result.content === 'string'
            ? result.content
            : result.content
        }
      }
    }));
  }
} 