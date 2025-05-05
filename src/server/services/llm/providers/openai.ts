/**
 * OpenAI LLM Provider
 * 
 * This file implements the OpenAI provider for the LLM Service.
 */

import OpenAI from 'openai';
import { LLMProvider, LLMProviderOptions, LLMProviderResponse } from '../types';

export class OpenAIProvider implements LLMProvider {
  private client: OpenAI;
  private defaultModel: string;
  
  constructor(options: LLMProviderOptions = {}) {
    // Initialize OpenAI client
    const apiKey = options.apiKey || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OpenAI API key is required. Set it in options or OPENAI_API_KEY environment variable.');
    }
    
    this.client = new OpenAI({ apiKey });
    // Override the incoming model parameter if it's a Claude model
    let modelToUse = options.model;
    
    // If no model specified or it contains 'claude', use the default OpenAI model
    if (!modelToUse || modelToUse.includes('claude')) {
      modelToUse = 'gpt-4-turbo-preview';
      console.log(`OpenAIProvider: Overriding Claude model with default OpenAI model: ${modelToUse}`);
    }
    
    // Set default model (GPT-4 Turbo is a good default)
    this.defaultModel = modelToUse;
    
    console.log(`OpenAIProvider: Initialized with model ${this.defaultModel}`);
  }
  
  async query(prompt: string, options: LLMProviderOptions = {}): Promise<LLMProviderResponse> {
    // Get options with defaults
    const model = options.model || this.defaultModel;
    const temperature = options.temperature ?? 0.7;
    const maxTokens = options.maxTokens || 4000;
    const systemPrompt = options.systemPrompt || '';
    
    try {
      console.log(`OpenAIProvider: Sending query to ${model} (temp: ${temperature})`);
      
      // Make API request
      const response = await this.client.chat.completions.create({
        model,
        max_tokens: maxTokens,
        temperature,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ],
      });
      
      // Extract content from the response
      const content = response.choices[0]?.message?.content || '';
      
      // Format the response
      return {
        content,
        rawResponse: response,
        usage: {
          promptTokens: response.usage?.prompt_tokens || 0,
          completionTokens: response.usage?.completion_tokens || 0,
          totalTokens: response.usage?.total_tokens || 0
        }
      };
    } catch (error) {
      console.error('OpenAI query error:', error);
      throw new Error(`OpenAI query failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
} 