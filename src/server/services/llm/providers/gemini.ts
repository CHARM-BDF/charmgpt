/**
 * Google Gemini LLM Provider
 * 
 * This file implements the Google Gemini provider for the LLM Service.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { LLMProvider, LLMProviderOptions, LLMProviderResponse } from '../types';

export class GeminiProvider implements LLMProvider {
  private client: GoogleGenerativeAI;
  private defaultModel: string;
  
  constructor(options: LLMProviderOptions = {}) {
    // Initialize Gemini client
    const apiKey = options.apiKey || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('Gemini API key is required. Set it in options or GEMINI_API_KEY environment variable.');
    }
    
    this.client = new GoogleGenerativeAI(apiKey);
    // Set default model to gemini-1.5-flash instead of gemini-pro
    this.defaultModel = options.model || 'gemini-1.5-flash';
    
    console.log(`GeminiProvider: Initialized with model ${this.defaultModel}`);
  }
  
  async query(prompt: string, options: LLMProviderOptions = {}): Promise<LLMProviderResponse> {
    // Get options with defaults
    const model = options.model || this.defaultModel;
    const temperature = options.temperature ?? 0.7;
    const maxTokens = options.maxTokens || 4000;
    const systemPrompt = options.systemPrompt || '';
    
    try {
      console.log(`GeminiProvider: Sending query to ${model} (temp: ${temperature})`);
      
      // Create model instance
      const geminiModel = this.client.getGenerativeModel({ model });
      
      // Prepare chat history with system prompt if available
      const contents = [];
      
      // Add system prompt if provided
      if (systemPrompt) {
        contents.push({
          role: 'user',
          parts: [{ text: `[System instruction] ${systemPrompt}` }]
        });
        
        // Add model response to acknowledge system instruction
        contents.push({
          role: 'model',
          parts: [{ text: "I'll follow those instructions." }]
        });
      }
      
      // Add user prompt
      contents.push({
        role: 'user',
        parts: [{ text: prompt }]
      });
      
      // Make API request
      const result = await geminiModel.generateContent({
        contents,
        generationConfig: {
          temperature,
          maxOutputTokens: maxTokens,
        },
      });
      
      const response = result.response;
      const content = response.text();
      
      // Format the response - Gemini doesn't provide token counts directly
      // so we make an approximation based on content length
      const estimatedTokens = Math.ceil(prompt.length / 4) + Math.ceil(content.length / 4);
      
      return {
        content,
        rawResponse: response,
        usage: {
          promptTokens: Math.ceil(prompt.length / 4),
          completionTokens: Math.ceil(content.length / 4),
          totalTokens: estimatedTokens
        }
      };
    } catch (error) {
      console.error('Gemini query error:', error);
      throw new Error(`Gemini query failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
} 