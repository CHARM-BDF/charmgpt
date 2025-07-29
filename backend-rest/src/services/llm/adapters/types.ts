/**
 * Tool Call Adapter Interfaces
 * 
 * This file defines the interfaces for adapters that handle different
 * LLM provider tool calling formats.
 */

/**
 * Represents a tool call from an LLM
 */
export interface ToolCall {
  /** Unique ID for the tool call */
  id: string;
  /** Name of the tool to call */
  name: string;
  /** Input parameters for the tool */
  input: Record<string, any>;
}

/**
 * Represents a tool result to be sent back to the LLM
 */
export interface ToolResult {
  /** ID of the original tool call */
  toolCallId: string;
  /** Name of the tool that was called */
  toolName: string;
  /** Result from the tool execution */
  content: string | Record<string, any>;
}

/**
 * Common interface for MCP tools
 */
export interface MCPTool {
  /** Name of the tool */
  name: string;
  /** Original server name for the tool */
  serverName?: string;
  /** Description of what the tool does */
  description: string;
  /** Schema definition for the tool parameters */
  schema: Record<string, any>;
}

/**
 * Interface for tool call adapters
 * 
 * Tool call adapters handle the conversion between the MCP tool format
 * and the provider-specific tool formats, as well as extracting and
 * formatting tool calls and results.
 */
export interface ToolCallAdapter {
  /**
   * Convert MCP tools to the provider-specific format
   * @param tools MCP tools to convert
   * @returns Tools in the provider-specific format
   */
  convertToolDefinitions(tools: MCPTool[]): any;
  
  /**
   * Extract tool calls from a provider response
   * @param response The provider response
   * @returns Array of standardized tool calls
   */
  extractToolCalls(response: any): ToolCall[];
  
  /**
   * Format tool results for the provider
   * @param toolResults The tool results to format
   * @returns Tool results in the provider-specific format
   */
  formatToolResults(toolResults: ToolResult[]): any;
} 