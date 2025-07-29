/**
 * Tool Adapter Types
 * 
 * This file defines the interfaces for the tool adapter pattern,
 * which handles the differences between providers' tool calling formats.
 */

// Import MCP tool types
import { AnthropicTool } from '../../mcp';

/**
 * Common tool call interface that's provider-agnostic
 */
export interface ToolCall {
  name: string;         // Name of the tool being called
  input: any;           // Input arguments for the tool
  toolUseId?: string;   // Unique ID for the tool call (provider-specific)
}

/**
 * Common tool result interface that's provider-agnostic
 */
export interface ToolResult {
  toolCallId: string;   // ID of the tool call this result is for
  content: any;         // Content of the tool result
  name?: string;        // Optional name of the tool (required by some providers)
}

/**
 * Tool call adapter interface for converting between
 * different LLM providers' tool formats
 */
export interface ToolCallAdapter {
  /**
   * Convert MCP tools to the provider's tool definition format
   * @param tools The MCP tools to convert
   * @returns The provider-specific tool definitions
   */
  convertToolDefinitions(tools: AnthropicTool[]): any;
  
  /**
   * Extract tool calls from the provider's response
   * @param response The provider's response containing tool calls
   * @returns The extracted tool calls in a provider-agnostic format
   */
  extractToolCalls(response: any): ToolCall[];
  
  /**
   * Format tool results for sending back to the provider
   * @param results The tool results to format
   * @returns The provider-specific format for tool results
   */
  formatToolResults(results: ToolResult[]): any;
}

/**
 * Provider types for tool adapters
 */
export type ToolAdapterType = 'anthropic' | 'openai' | 'gemini' | 'ollama'; 