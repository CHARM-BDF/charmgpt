/**
 * Response Formatter Adapters
 * 
 * This file exports all response formatter adapters and provides
 * a factory function to get the appropriate adapter for a provider.
 */

import { FormatterAdapterType, ResponseFormatterAdapter } from './types';
import { AnthropicResponseFormatterAdapter } from './anthropic';
import { OpenAIResponseFormatterAdapter } from './openai';
import { GeminiResponseFormatterAdapter } from './gemini';
import { OllamaResponseFormatterAdapter } from './ollama';

// Export all formatter adapters
export * from './types';
export * from './anthropic';
export * from './openai';
export * from './gemini';
export * from './ollama';

/**
 * Factory function to get the response formatter adapter for a provider
 * @param provider The provider type
 * @returns The appropriate response formatter adapter
 */
export function getResponseFormatterAdapter(provider: FormatterAdapterType): ResponseFormatterAdapter {
  switch (provider) {
    case 'anthropic':
      return new AnthropicResponseFormatterAdapter();
    case 'openai':
      return new OpenAIResponseFormatterAdapter();
    case 'gemini':
      return new GeminiResponseFormatterAdapter();
    case 'ollama':
      // Use the dedicated Ollama formatter adapter
      return new OllamaResponseFormatterAdapter();
    default:
      throw new Error(`Unsupported provider for response formatting: ${provider}`);
  }
}

/**
 * Generate response formatter configuration with mode settings for the provider
 * This configures if/how to use the response formatter
 * 
 * @param provider The provider type
 * @returns The appropriate formatter configuration
 */
export function getResponseFormatterConfig(provider: FormatterAdapterType): any {
  switch (provider) {
    case 'anthropic':
      return {
        tool_choice: { name: "response_formatter" }
      };
    case 'openai':
      return {
        tool_choice: { type: "function", function: { name: "response_formatter" } }
      };
    case 'gemini':
      return {
        toolConfig: {
          functionCallingConfig: {
            mode: "ANY",
            allowedFunctionNames: ["response_formatter"]
          }
        }
      };
    case 'ollama':
      // Ollama doesn't support tool choice configuration
      return {};
    default:
      return {};
  }
} 