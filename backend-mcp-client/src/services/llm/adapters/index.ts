/**
 * Tool Call Adapter Factory
 * 
 * This file provides a factory for creating appropriate tool call adapters
 * based on the LLM provider.
 */

import { ToolCallAdapter } from './types';
import { ClaudeToolAdapter } from './claude';
import { OpenAIToolAdapter } from './openai';
import { GeminiToolAdapter } from './gemini';

// Singleton instances for each adapter type
const claudeAdapter = new ClaudeToolAdapter();
const openaiAdapter = new OpenAIToolAdapter();
const geminiAdapter = new GeminiToolAdapter();

/**
 * Get the appropriate adapter for the given provider
 * @param provider The LLM provider name
 * @returns The appropriate tool call adapter
 */
export function getToolCallAdapter(provider: string): ToolCallAdapter {
  switch (provider.toLowerCase()) {
    case 'anthropic':
    case 'claude':
      return claudeAdapter;
    
    case 'openai':
    case 'gpt':
      return openaiAdapter;
    
    case 'gemini':
    case 'google':
      return geminiAdapter;
    
    default:
      console.warn(`No specific adapter found for provider: ${provider}, using Claude adapter as default`);
      return claudeAdapter;
  }
}

// Export all adapters for direct access if needed
export { ClaudeToolAdapter, OpenAIToolAdapter, GeminiToolAdapter }; 