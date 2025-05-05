/**
 * Ollama Tool Adapter
 * 
 * This is a placeholder implementation for Ollama.
 * Ollama may not fully support tool calling yet, so this
 * implementation is mostly for compatibility.
 */

import { AnthropicTool } from '../../mcp';
import { ToolCall, ToolCallAdapter, ToolResult } from './types';

export class OllamaToolAdapter implements ToolCallAdapter {
  /**
   * Convert MCP tools to Ollama format
   * @param tools MCP tools to convert
   * @returns Tools in Ollama format (or empty array if not supported)
   */
  convertToolDefinitions(tools: AnthropicTool[]): any[] {
    console.log('🟤 [ADAPTER: OLLAMA] Converting tool definitions (limited support)');
    console.warn('Ollama tool calling may not be fully supported');
    // Return a minimal compatible format or empty array
    return [];
  }
  
  /**
   * Extract tool calls from Ollama's response
   * @param response The Ollama response
   * @returns Empty array as Ollama may not support tool calling yet
   */
  extractToolCalls(response: any): ToolCall[] {
    console.log('🟤 [ADAPTER: OLLAMA] Extracting tool calls from response (not supported)');
    // Ollama may not support tool calling yet
    return [];
  }
  
  /**
   * Format tool results for Ollama
   * @param results Tool results to format
   * @returns Results in a basic format
   */
  formatToolResults(results: ToolResult[]): any[] {
    console.log('🟤 [ADAPTER: OLLAMA] Formatting tool results (not supported)');
    // Since Ollama may not support tool calling, we simply return empty
    return [];
  }
} 