/**
 * Ollama Tool Adapter
 * 
 * Implements conversion between MCP tool format and Ollama's tool format.
 * Handles Ollama's namespaced tool calling format.
 */

import { AnthropicTool } from '../../mcp';
import { ToolCall, ToolCallAdapter, ToolResult } from './types';
import crypto from 'crypto';

// Helper function to generate unique IDs for tool calls
const generateId = () => crypto.randomUUID();

// Define the structure for a pre-formatted tool
interface PreFormattedTool {
  type: string;
  function: {
    name: string;
    description: string;
    parameters: any;
  }
}

export class OllamaToolAdapter implements ToolCallAdapter {
  /**
   * Convert MCP tools to Ollama format
   * @param tools MCP tools to convert
   * @returns Tools in Ollama format
   */
  convertToolDefinitions(tools: AnthropicTool[]): any[] {
    console.log('🟤 [ADAPTER: OLLAMA] Converting tool definitions');
    console.log(tools)
    console.log('🟤 [ADAPTER: OLLAMA] Input MCP tools:', JSON.stringify(tools, null, 2));
    
    return tools.map(tool => {
      // Make sure tool is defined
      if (!tool) {
        console.error('🟤 [ADAPTER: OLLAMA] Received undefined tool in convertToolDefinitions');
        return null;
      }
      
      // Check if the tool is already in Ollama format (has function property)
      const anyTool = tool as any;
      if (anyTool.type === 'function' && anyTool.function) {
        console.log(`🟤 [ADAPTER: OLLAMA] Tool already in Ollama format: ${anyTool.function.name}`);
        return anyTool;
      }
      
      // Safely extract the tool name
      const toolName = tool.name || '';
      if (!toolName) {
        console.error('🟤 [ADAPTER: OLLAMA] Tool name is undefined:', JSON.stringify(tool).substring(0, 200));
      }
      
      // Standardize tool name: replace hyphens with underscores (safely)
      const standardizedName = toolName.replace ? toolName.replace(/-/g, '_') : toolName;
      
      // Log the conversion
      console.log(`🟤 [ADAPTER: OLLAMA] Converting tool: ${toolName} → ${standardizedName}`);
      
      // Create the function part of the tool
      return {
        type: 'function',
        function: {
          name: standardizedName,
          description: tool.description || '',
          parameters: {
            type: tool.input_schema?.type || 'object',
            properties: tool.input_schema?.properties || {},
            required: tool.input_schema?.required || []
          }
        }
      };
    }).filter(Boolean); // Filter out any null entries
  }
  
  /**
   * Extract tool calls from Ollama's response
   * @param response The Ollama response
   * @returns Array of extracted tool calls
   */
  extractToolCalls(response: any): ToolCall[] {
    console.log('🟤 [ADAPTER: OLLAMA] Extracting tool calls from response');
    
    if (!response || !response.message?.tool_calls?.length) {
      console.log('🟤 [ADAPTER: OLLAMA] No tool calls found in response');
      return [];
    }
    
    return response.message.tool_calls.map((toolCall: any) => {
      // Check if toolCall is properly structured
      if (!toolCall || !toolCall.function) {
        console.error('🟤 [ADAPTER: OLLAMA] Invalid tool call structure:', toolCall);
        return null;
      }
      
      // Log the raw tool call for debugging
      console.log(`🟤 [ADAPTER: OLLAMA] Processing tool call: ${JSON.stringify(toolCall.function.name)}`);
      console.log(`🟤 [ADAPTER: OLLAMA] Tool call arguments: ${JSON.stringify(toolCall.function.arguments)}`);
      
      // Handle namespaced format (tool_name.operation)
      const fullName = toolCall.function.name || '';
      let toolName = fullName;
      let operation = '';
      
      // Split if it's a namespaced format (e.g. "calculator.add")
      if (fullName.includes('.')) {
        const parts = fullName.split('.');
        toolName = parts[0];
        operation = parts.slice(1).join('.');
      }
  
      const normalizedToolName = toolName
        .replace('pubmed_search', 'pubmed-search')
        .replace('_execute_', '-execute_')
        .replace('medik_mcp_run_query', 'medik-mcp-run-query')
        .replace('medik_mcp_get_everything', 'medik-mcp-get-everything');
      
      console.log(`🟤 [ADAPTER: OLLAMA] Original tool name from Ollama: "${toolName}"`);
      
      
      
      console.log(`🟤 [ADAPTER: OLLAMA] Final normalized tool name: "${normalizedToolName}"`);
      
      // Process arguments - ensure it's an object
      let args: Record<string, any> = {};
      try {
        if (typeof toolCall.function.arguments === 'string') {
          // Try to parse as JSON
          try {
            args = JSON.parse(toolCall.function.arguments);
          } catch {
            // If it's not valid JSON, try to extract key-value pairs
            const argStr = toolCall.function.arguments.trim();
            if (argStr.startsWith('{') && argStr.endsWith('}')) {
              // It looks like JSON but failed to parse - try to extract manually
              args = { query: argStr };
            } else {
              // Just use it as a query parameter
              args = { query: argStr };
            }
          }
        } else if (typeof toolCall.function.arguments === 'object') {
          // For pubmed-search, ensure there's a proper terms array
          if (normalizedToolName.includes('pubmed') && normalizedToolName.includes('search')) {
            const argsObj = toolCall.function.arguments as Record<string, any>;
            if (!argsObj.terms) {
              const query = argsObj.query || '';
              args = {
                terms: [{ term: query }]
              };
              console.log(`🟤 [ADAPTER: OLLAMA] Created terms array for pubmed-search: ${JSON.stringify(args)}`);
            } else {
              args = argsObj;
            }
          } else {
            args = toolCall.function.arguments;
          }
        }
      } catch (error) {
        console.error('🟤 [ADAPTER: OLLAMA] Error parsing tool arguments:', error);
        // If parsing fails, use the raw string
        args = { raw: toolCall.function.arguments };
      }
      
      // Special case for pubmed-search - ensure it has the required format
      if (normalizedToolName.includes('pubmed') && normalizedToolName.includes('search') && (!args.terms || !Array.isArray(args.terms))) {
        // If terms exists but is a string that looks like JSON, try to parse it
        if (typeof args.terms === 'string') {
          try {
            const parsedTerms = JSON.parse(args.terms);
            if (Array.isArray(parsedTerms)) {
              args.terms = parsedTerms;
              console.log(`🟤 [ADAPTER: OLLAMA] Parsed string terms into array: ${JSON.stringify(args.terms)}`);
            }
          } catch (error) {
            console.error('🟤 [ADAPTER: OLLAMA] Failed to parse terms string:', error);
          }
        }
        
        // If terms still isn't an array, create a new terms array
        if (!Array.isArray(args.terms)) {
          const searchTerm = typeof args.query === 'string' ? args.query : 
                           (args.raw as string || 'cancer research');
          args = {
            terms: [{ term: searchTerm }]
          };
          console.log(`🟤 [ADAPTER: OLLAMA] Fixed pubmed-search args: ${JSON.stringify(args)}`);
        }
      }
      
      // Fix pubmed-search operator values - ensure they are valid values 
      if (normalizedToolName.includes('pubmed') && normalizedToolName.includes('search') && Array.isArray(args.terms)) {
        // First ensure each object in terms array has a 'term' property
        args.terms = args.terms.filter(term => {
          if (!term || typeof term !== 'object') {
            console.error('🟤 [ADAPTER: OLLAMA] Removing invalid term (not an object):', term);
            return false;
          }
          
          // Ensure term has a 'term' property
          if (!term.term || typeof term.term !== 'string' || term.term.trim() === '') {
            console.error('🟤 [ADAPTER: OLLAMA] Removing term without valid term property:', term);
            return false;
          }
          
          return true;
        });
        
        // If filtering removed all terms, add a default one
        if (args.terms.length === 0) {
          args.terms = [{ term: "cancer research", operator: "AND" }];
          console.log(`🟤 [ADAPTER: OLLAMA] All terms were invalid, added default term: ${JSON.stringify(args.terms)}`);
        }
        
        // Now normalize operators on the valid terms
        args.terms = args.terms.map((term: any, index: number) => {
          // Check if this is the first term or has an empty operator
          if (index === 0 || !term.operator || term.operator === '') {
            // For all terms including first, default to 'AND' if empty or null
            return { ...term, operator: 'AND' };
          }
          return term;
        });
        
        console.log(`🟤 [ADAPTER: OLLAMA] Normalized pubmed-search terms: ${JSON.stringify(args.terms)}`);
      }
      
      // Ensure max_results is a number for pubmed-search
      if (normalizedToolName.includes('pubmed') && normalizedToolName.includes('search') && args.max_results !== undefined) {
        if (typeof args.max_results === 'string') {
          const parsedMaxResults = parseInt(args.max_results, 10);
          if (!isNaN(parsedMaxResults)) {
            args.max_results = parsedMaxResults;
            console.log(`🟤 [ADAPTER: OLLAMA] Converted max_results from string to number: ${args.max_results}`);
          } else {
            // If parsing fails, delete the invalid parameter to use default
            delete args.max_results;
            console.log(`🟤 [ADAPTER: OLLAMA] Deleted invalid max_results parameter`);
          }
        }
      }
      
      // Log the converted tool call
      console.log(`🟤 [ADAPTER: OLLAMA] Converted tool call: ${normalizedToolName}${operation ? '/' + operation : ''}`);
      console.log(`🟤 [ADAPTER: OLLAMA] Final tool arguments: ${JSON.stringify(args)}`);
      
      // IMPORTANT: Create the tool call with BOTH input and arguments properties
      // This ensures compatibility with different parts of the system
      const toolCallResult = {
        id: generateId(),
        name: normalizedToolName, // Use the normalized name that should match toolNameMapping
        operation: operation,
        arguments: args,
        input: args, // Add input property for MCP execution system
        raw: toolCall
      };
      
      console.log(`🟤 [ADAPTER: OLLAMA] ToolCall structure: id=${toolCallResult.id}, name=${toolCallResult.name}`);
      console.log(`🟤 [ADAPTER: OLLAMA] ToolCall input property: ${JSON.stringify(toolCallResult.input).substring(0, 200)}`);
      
      return toolCallResult;
    }).filter(Boolean); // Filter out any null entries
  }
  
  /**
   * Format tool results for Ollama
   * @param results Tool results to format
   * @returns Results in Ollama format
   */
  formatToolResults(results: ToolResult[]): any[] {
    console.log('🟤 [ADAPTER: OLLAMA] Formatting tool results');
    
    return results.map(result => {
      // Format the content for Ollama
      let content = '';
      
      if (typeof result.content === 'string') {
        content = result.content;
      } else if (Array.isArray(result.content)) {
        // Join array content with newlines
        content = result.content.map(item => {
          if (typeof item === 'string') return item;
          if (item && item.text) return item.text;
          return JSON.stringify(item);
        }).join('\n');
      } else if (result.content && typeof result.content === 'object') {
        // Convert object to string
        content = JSON.stringify(result.content, null, 2);
      }
      
      return {
        role: 'tool',
        content: content,
        tool_call_id: result.toolCallId
      };
    });
  }
} 