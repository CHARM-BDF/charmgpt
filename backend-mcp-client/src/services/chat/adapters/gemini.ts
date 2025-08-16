/**
 * Google Gemini Tool Adapter
 * 
 * Handles Gemini's function calling format:
 * - Tools are defined under a 'functionDeclarations' array
 * - Tool calls can be found in either candidates[0].content.parts (Gemini 2.0) or via functionCalls() method (1.5)
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
    console.log('\n=== GEMINI TOOL DEFINITION CONVERSION ===');
    console.log('Input MCP tools:', JSON.stringify(tools, null, 2));
    
    // Gemini expects tools in a specific format under 'functionDeclarations'
    const convertedTools = {
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
    
    console.log('Converted Gemini format:', JSON.stringify(convertedTools, null, 2));
    console.log('=== END GEMINI TOOL DEFINITION CONVERSION ===\n');
    
    return convertedTools;
  }
  
  /**
   * Extract tool calls from Gemini's response
   * @param response The Gemini response
   * @returns Extracted tool calls
   */
  extractToolCalls(response: any): ToolCall[] {
    console.log('\n=== GEMINI TOOL CALL EXTRACTION ===');
    console.log('Raw response:', JSON.stringify(response, null, 2));
    
    try {
      let functionCalls: GeminiFunctionCall[] = [];
      
      // Check for Gemini 2.0 structure first
      if (response && 
          response.candidates && 
          Array.isArray(response.candidates) && 
          response.candidates.length > 0 &&
          response.candidates[0].content &&
          response.candidates[0].content.parts) {
          
        // Extract function calls from parts
        const parts = response.candidates[0].content.parts;
        if (Array.isArray(parts)) {
          for (const part of parts) {
            if (part.functionCall) {
              functionCalls.push({
                name: part.functionCall.name,
                args: part.functionCall.args || {}
              });
            }
          }
        }
        
        if (functionCalls.length > 0) {
          console.log('Extracted function calls from Gemini 2.0 structure:', JSON.stringify(functionCalls, null, 2));
        }
      }
      
      // If we didn't find any function calls in the Gemini 2.0 structure, try the legacy approach
      if (functionCalls.length === 0) {
        if (response && typeof response.functionCalls === 'function') {
          try {
            const legacyFunctionCalls = response.functionCalls();
            if (Array.isArray(legacyFunctionCalls) && legacyFunctionCalls.length > 0) {
              functionCalls = legacyFunctionCalls;
              console.log('Extracted function calls from legacy method:', JSON.stringify(functionCalls, null, 2));
            }
          } catch (error) {
            console.log('Error accessing functionCalls() method:', error);
          }
        } else if (response && Array.isArray(response.functionCalls)) {
          // Direct property access
          functionCalls = response.functionCalls;
          console.log('Extracted function calls from direct property:', JSON.stringify(functionCalls, null, 2));
        } else {
          console.log('No functionCalls method or property available in response');
        }
      }
      
      if (functionCalls.length === 0) {
        console.log('No function calls found in response');
        console.log('=== END GEMINI TOOL CALL EXTRACTION ===\n');
        return [];
      }
      
      const toolCalls = functionCalls.map((call: GeminiFunctionCall, index: number) => ({
        name: call.name,
        input: call.args,
        // Gemini doesn't provide IDs, so we generate one
        toolUseId: `gemini-call-${index}-${Date.now()}`
      }));
      
      console.log('Converted tool calls:', JSON.stringify(toolCalls, null, 2));
      console.log('=== END GEMINI TOOL CALL EXTRACTION ===\n');
      
      return toolCalls;
    } catch (error) {
      console.error('Error extracting function calls from Gemini response:', error);
      console.log('=== END GEMINI TOOL CALL EXTRACTION ===\n');
      return [];
    }
  }
  
  /**
   * Format tool results for Gemini
   * @param results Tool results to format
   * @returns Results in Gemini's format
   */
  formatToolResults(results: ToolResult[]): any {
    console.log('\n=== GEMINI TOOL RESULT FORMATTING ===');
    console.log('Input tool results:', JSON.stringify(results, null, 2));
    
    // Gemini wants a specific format for function results
    if (results.length === 0) {
      console.log('No tool results to format');
      console.log('=== END GEMINI TOOL RESULT FORMATTING ===\n');
      return {};
    }
    
    // Only use the first result for now
    const result = results[0];
    
    const formattedResult = {
      functionResponse: {
        name: result.name,
        response: {
          result: result.content
        }
      }
    };
    
    console.log('Formatted result:', JSON.stringify(formattedResult, null, 2));
    console.log('=== END GEMINI TOOL RESULT FORMATTING ===\n');
    
    return formattedResult;
  }
} 