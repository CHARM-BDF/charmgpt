/**
 * Tool Adapter Factory
 * 
 * This file exports the factory function for getting the right
 * adapter for each provider.
 */

import { ToolCallAdapter, ToolAdapterType } from './types';
import { AnthropicToolAdapter } from './anthropic';
import { OpenAIToolAdapter } from './openai';
import { GeminiToolAdapter } from './gemini';
import { OllamaToolAdapter } from './ollama';

// Cache the adapters to avoid creating new instances
const adapters: Record<ToolAdapterType, ToolCallAdapter> = {
  anthropic: new AnthropicToolAdapter(),
  openai: new OpenAIToolAdapter(),
  gemini: new GeminiToolAdapter(),
  ollama: new OllamaToolAdapter()
};

/**
 * Get the appropriate tool call adapter for the given provider
 * @param provider The provider to get an adapter for
 * @returns The tool call adapter for the provider
 */
export function getToolCallAdapter(provider: ToolAdapterType): ToolCallAdapter {
  if (!adapters[provider]) {
    throw new Error(`No tool adapter available for provider: ${provider}`);
  }
  
  return adapters[provider];
}

export * from './types';
export * from './anthropic';
export * from './openai';
export * from './gemini';
export * from './ollama'; 