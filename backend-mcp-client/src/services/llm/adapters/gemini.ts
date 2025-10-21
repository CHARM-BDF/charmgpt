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
    console.log('\n=== GEMINI LLM TOOL DEFINITION CONVERSION ===');
    // console.log('Input MCP tools:', JSON.stringify(tools, null, 2));
    
    const convertedTools = [{
      functionDeclarations: tools.map(tool => ({
        name: tool.name,
        description: tool.description,
        parameters: tool.schema
      }))
    }];
    
    // console.log('Converted Gemini format:', JSON.stringify(convertedTools, null, 2));
    console.log('=== END GEMINI LLM TOOL DEFINITION CONVERSION ===\n');
    
    return convertedTools;
  }
  
  /**
   * Extract tool calls from a Gemini response
   * @param response The Gemini response
   * @returns Array of standardized tool calls
   */
  extractToolCalls(response: any): ToolCall[] {
    console.log('\n=== GEMINI LLM TOOL CALL EXTRACTION ===');
    // console.log('Raw response:', JSON.stringify(response, null, 2));
    
    if (!response) {
      console.log('No response found');
      console.log('=== END GEMINI LLM TOOL CALL EXTRACTION ===\n');
      return [];
    }
    
    try {
      let functionCalls = [];
      
      // Try the new Gemini 2.0 structure
      if (response.candidates && 
          response.candidates[0] && 
          response.candidates[0].content && 
          response.candidates[0].content.parts) {
        
        // Look for function calls in all parts
        for (const part of response.candidates[0].content.parts) {
          if (part.functionCall) {
            functionCalls.push({
              name: part.functionCall.name,
              args: part.functionCall.args
            });
          }
        }
      } 
      // Fallback to older structure if available
      else if (response.response && typeof response.response.functionCalls === 'function') {
        try {
          functionCalls = response.response.functionCalls() || [];
        } catch (e) {
          console.log('Error calling functionCalls():', e);
        }
      }
      // Direct functionCalls property
      else if (response.functionCalls) {
        functionCalls = response.functionCalls;
      }
      
      // console.log('Extracted function calls:', JSON.stringify(functionCalls, null, 2));
      
      if (!functionCalls || functionCalls.length === 0) {
        console.log('No function calls found in response');
        console.log('=== END GEMINI LLM TOOL CALL EXTRACTION ===\n');
        return [];
      }
      
      const toolCalls = functionCalls.map((functionCall: any, index: number) => ({
        id: `gemini_function_${index}_${Date.now()}`,
        name: functionCall.name,
        input: functionCall.args || {}
      }));
      
      // console.log('Converted tool calls:', JSON.stringify(toolCalls, null, 2));
      console.log('=== END GEMINI LLM TOOL CALL EXTRACTION ===\n');
      
      return toolCalls;
    } catch (error) {
      console.error('Failed to extract Gemini function calls:', error);
      console.log('=== END GEMINI LLM TOOL CALL EXTRACTION ===\n');
      return [];
    }
  }
  
  /**
   * Format tool results for Gemini
   * @param toolResults The tool results to format
   * @returns Tool results in Gemini format
   */
  formatToolResults(toolResults: ToolResult[]): any {
    console.log('\n=== GEMINI LLM TOOL RESULT FORMATTING ===');
    // console.log('Input tool results:', JSON.stringify(toolResults, null, 2));
    
    if (!toolResults || toolResults.length === 0) {
      console.log('No tool results to format');
      console.log('=== END GEMINI LLM TOOL RESULT FORMATTING ===\n');
      return null;
    }
    
    // Gemini can only handle one function result at a time in the current API
    const result = toolResults[0];
    
    const formattedResult = {
      functionResponse: {
        name: result.toolName,
        response: {
          result: typeof result.content === 'string' 
            ? result.content 
            : result.content
        }
      }
    };
    
    // console.log('Formatted result:', JSON.stringify(formattedResult, null, 2));
    console.log('=== END GEMINI LLM TOOL RESULT FORMATTING ===\n');
    
    return formattedResult;
  }
  
  /**
   * Check if the response contains function calls
   * @param response The Gemini response
   * @returns Whether the response has function calls
   */
  hasFunctionCalls(response: any): boolean {
    console.log('\n=== GEMINI LLM FUNCTION CALL CHECK ===');
    // console.log('Checking response for function calls:', JSON.stringify(response, null, 2));
    
    if (!response) {
      console.log('No response found');
      console.log('=== END GEMINI LLM FUNCTION CALL CHECK ===\n');
      return false;
    }
    
    try {
      let hasCalls = false;
      
      // Try the new Gemini 2.0 structure
      if (response.candidates && 
          response.candidates[0] && 
          response.candidates[0].content && 
          response.candidates[0].content.parts) {
        
        // Look for function calls in any part
        hasCalls = response.candidates[0].content.parts.some((part: any) => part.functionCall);
      } 
      // Fallback to older structure if available
      else if (response.response && typeof response.response.functionCalls === 'function') {
        try {
          const functionCalls = response.response.functionCalls();
          hasCalls = Array.isArray(functionCalls) && functionCalls.length > 0;
        } catch (e) {
          console.log('Error calling functionCalls():', e);
        }
      }
      // Direct functionCalls property
      else if (response.functionCalls) {
        hasCalls = Array.isArray(response.functionCalls) && response.functionCalls.length > 0;
      }
      
      console.log('Function calls found:', hasCalls);
      console.log('=== END GEMINI LLM FUNCTION CALL CHECK ===\n');
      return hasCalls;
    } catch (error) {
      console.error('Error checking for function calls:', error);
      console.log('=== END GEMINI LLM FUNCTION CALL CHECK ===\n');
      return false;
    }
  }
} 