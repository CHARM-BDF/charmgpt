/**
 * Response Formatter Adapter Types
 * 
 * This file defines interfaces for the response formatter adapter pattern,
 * which standardizes the structured response format across different LLM providers.
 */

import { StoreFormat } from '../../message';

/**
 * Type for supported formatter adapter providers
 */
export type FormatterAdapterType = 'anthropic' | 'openai' | 'gemini' | 'ollama';

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
 * Interface for the formatter output structure
 */
export interface FormatterOutput {
  /**
   * Optional internal reasoning process
   */
  thinking?: string;
  
  /**
   * Array of conversation segments and artifacts
   */
  conversation: Array<{
    /**
     * Type of conversation segment
     */
    type: 'text' | 'artifact';
    
    /**
     * Markdown formatted text content
     */
    content?: string;
    
    /**
     * Artifact details
     */
    artifact?: {
      /**
       * Artifact type
       */
      type: string;
      
      /**
       * Artifact title
       */
      title: string;
      
      /**
       * Artifact content
       */
      content: string;
      
      /**
       * Optional language for code artifacts
       */
      language?: string;
    };
  }>;
} 