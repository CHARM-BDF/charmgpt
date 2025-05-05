/**
 * Response Formatter Adapter Types
 * 
 * This file defines interfaces for the response formatter adapter pattern,
 * which standardizes the structured response format across different LLM providers.
 */

import { StoreFormat } from '../../message';

/**
 * Interface for provider-specific response formatter adapters
 */
export interface ResponseFormatterAdapter {
  /**
   * Get tool definition for the response formatter in provider-specific format
   * @returns The provider-specific tool definition
   */
  getResponseFormatterToolDefinition(): any;
  
  /**
   * Extract formatter output from provider-specific response
   * @param response The provider's response containing formatter output
   * @returns The extracted formatter output
   */
  extractFormatterOutput(response: any): any;
  
  /**
   * Convert the formatter output to the standard store format
   * @param formatterOutput The formatter output from the provider
   * @returns The standardized store format
   */
  convertToStoreFormat(formatterOutput: any): StoreFormat;
}

/**
 * Provider types for response formatter adapters
 */
export type FormatterAdapterType = 'anthropic' | 'openai' | 'gemini' | 'ollama';

/**
 * Standard formatter output structure
 */
export interface FormatterOutput {
  thinking?: string;
  conversation: Array<{
    type: 'text' | 'artifact';
    content?: string;
    artifact?: {
      type: string;
      id?: string;
      title: string;
      content: string;
      language?: string;
    };
  }>;
} 