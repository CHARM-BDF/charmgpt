/**
 * Anthropic Provider for LLM Service
 * 
 * This file implements the LLM provider for Anthropic's Claude models.
 */

import { Anthropic } from '@anthropic-ai/sdk';
import { LLMProvider, LLMProviderOptions, LLMProviderResponse } from '../types';

/**
 * Anthropic provider implementation
 */
export class AnthropicProvider implements LLMProvider {
  /** Anthropic client instance */
  private client: Anthropic;
  /** Default model to use */
  private defaultModel: string;
  
  /**
   * Create a new Anthropic provider
   * @param options Provider configuration options
   */
  constructor(options: LLMProviderOptions = {}) {
    // Get API key from options or environment variables
    const apiKey = options.apiKey || process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('Anthropic API key is required. Set it in options or ANTHROPIC_API_KEY environment variable.');
    }
    
    // Initialize Anthropic client
    this.client = new Anthropic({ apiKey });
    // Set default model
    this.defaultModel = options.model || 'claude-3-5-sonnet-20241022';
    
    console.log(`AnthropicProvider: Initialized with model ${this.defaultModel}`);
  }
  
  /**
   * Send a query to the Anthropic API
   * @param prompt The prompt to send
   * @param options Provider-specific options
   * @returns The processed response
   */
  async query(prompt: string, options: LLMProviderOptions = {}): Promise<LLMProviderResponse> {
    // Get options with defaults
    const model = options.model || this.defaultModel;
    const temperature = options.temperature ?? 0.7;
    const maxTokens = options.maxTokens || 4000;
    const systemPrompt = options.systemPrompt || '';
    
    try {
      console.log(`AnthropicProvider: Sending query to ${model} (temp: ${temperature})`);
      
      // Make API request
      const response = await this.client.messages.create({
        model,
        max_tokens: maxTokens,
        temperature,
        system: systemPrompt,
        messages: [{ role: 'user', content: prompt }],
      });
      
      // Extract content from the response (handling different content block types)
      let content = '';
      if (response.content && response.content.length > 0) {
        const block = response.content[0];
        if (block.type === 'text') {
          content = block.text;
        } else if (block.type === 'tool_use') {
          // For tool_use blocks, return the input as JSON string
          content = JSON.stringify(block.input);
        } else {
          // Fallback for other content types
          content = JSON.stringify(block);
        }
      }
      
      // Format the response
      return {
        content,
        rawResponse: response,
        usage: {
          promptTokens: response.usage.input_tokens,
          completionTokens: response.usage.output_tokens,
          totalTokens: response.usage.input_tokens + response.usage.output_tokens
        }
      };
    } catch (error) {
      console.error('Anthropic query error:', error);
      throw new Error(`Anthropic query failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
} 