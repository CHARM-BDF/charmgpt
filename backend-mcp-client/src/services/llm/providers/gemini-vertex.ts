/**
 * Google Gemini LLM Provider using Google Vertex AI
 * 
 * This file implements the Google Gemini provider for the LLM Service via Vertex AI.
 * It will be used when GOOGLE_CLOUD_PROJECT environment variable is set.
 */

import { GoogleGenAI } from '@google/genai';
import { LLMProvider, LLMProviderOptions, LLMProviderResponse } from '../types';

// Retry configuration for rate limiting
const RETRY_CONFIG = {
  maxRetries: 3,
  baseDelay: 1000, // 1 second
  maxDelay: 10000,  // 10 seconds
};

/**
 * Exponential backoff retry function
 */
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = RETRY_CONFIG.maxRetries,
  baseDelay: number = RETRY_CONFIG.baseDelay
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      // Only retry on 429 errors
      if (error instanceof Error && error.message.includes('429')) {
        if (attempt < maxRetries) {
          const delay = Math.min(baseDelay * Math.pow(2, attempt), RETRY_CONFIG.maxDelay);
          console.log(`🔄 GeminiVertexProvider: Rate limited, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries + 1})`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
      }
      
      // For non-429 errors or after max retries, throw the error
      throw error;
    }
  }
  
  throw lastError!;
}

export class GeminiVertexProvider implements LLMProvider {
  private client: GoogleGenAI;
  private defaultModel: string;
  private projectId: string;
  private location: string;
  
  constructor(options: LLMProviderOptions = {}) {
    // Get Google Cloud Project ID from environment
    const projectId = process.env.GOOGLE_CLOUD_PROJECT;
    if (!projectId) {
      throw new Error('GOOGLE_CLOUD_PROJECT environment variable is required for Vertex AI.');
    }
    this.projectId = projectId;
    this.location = process.env.GOOGLE_CLOUD_LOCATION || 'us-central1';
    
    // For Vertex AI, we use the GoogleGenAI client with vertexai: true
    // The SDK will automatically use Application Default Credentials (ADC)
    this.client = new GoogleGenAI({
      vertexai: true,
      project: this.projectId,
      location: this.location,
    });
    
    // Override the incoming model parameter if it's a non-Gemini model
    let modelToUse = options.model;
    
    // If no model specified or it's not a Gemini model, use the default
    if (!modelToUse || modelToUse.includes('claude') || modelToUse.includes('gpt')) {
      modelToUse = 'gemini-2.0-flash-exp';
      console.log(`GeminiVertexProvider: Overriding non-Gemini model with default: ${modelToUse}`);
    }
    
    // Set default model
    this.defaultModel = modelToUse;
    
    console.log(`GeminiVertexProvider: Initialized with model ${this.defaultModel} in project ${this.projectId}`);
  }
  
  async query(prompt: string, options: LLMProviderOptions = {}): Promise<LLMProviderResponse> {
    // Get options with defaults
    const modelName = options.model || this.defaultModel;
    const temperature = options.temperature ?? 0.2;
    const maxTokens = options.maxTokens || 4000;
    const systemPrompt = options.systemPrompt || '';
    
    try {
      console.log(`GeminiVertexProvider: Sending query to ${modelName} (temp: ${temperature})`);
      
      // Prepare message content
      const contents = [];
      
      // Add system prompt if provided
      if (systemPrompt) {
        contents.push({
          role: 'user',
          parts: [{ text: `[System instruction] ${systemPrompt}` }]
        });
        
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
      
      // Prepare request
      const request: any = {
        model: modelName,
        contents,
        config: {
          generationConfig: {
            temperature,
            maxOutputTokens: maxTokens,
          }
        }
      };
      
      // Add tools and function calling config if tools are provided
      if (options.tools) {
        // Add tools configuration
        request.config.tools = options.tools;
        
        // Extract function names for allowed function list
        const functionNames: string[] = [];
        if (Array.isArray(options.tools)) {
          for (const tool of options.tools) {
            if (tool.functionDeclarations) {
              for (const func of tool.functionDeclarations) {
                if (func.name) functionNames.push(func.name);
              }
            }
          }
        } else if (options.tools && 'tools' in options.tools) {
          const nestedTools = (options.tools as any).tools;
          if (Array.isArray(nestedTools)) {
            for (const tool of nestedTools) {
              if (tool.functionDeclarations) {
                for (const func of tool.functionDeclarations) {
                  if (func.name) functionNames.push(func.name);
                }
              }
            }
          }
        }
        
        // Add function calling configuration
        request.config.toolConfig = {
          functionCallingConfig: {
            mode: 'ANY',
            allowedFunctionNames: functionNames.length > 0 ? functionNames : undefined
          }
        };
        
        console.log(`GeminiVertexProvider: Added function calling config with ${functionNames.length} functions: ${functionNames.join(', ')}`);
      }
      
      // Handle specific tool choice if provided
      if (options.toolChoice && typeof options.toolChoice === 'object' && 'name' in options.toolChoice) {
        request.config.toolConfig = request.config.toolConfig || {};
        request.config.toolConfig.functionCallingConfig = request.config.toolConfig.functionCallingConfig || 
          { mode: 'ANY' };
          
        request.config.toolConfig.functionCallingConfig.allowedFunctionNames = [options.toolChoice.name];
        console.log(`GeminiVertexProvider: Set allowed function to: ${options.toolChoice.name}`);
      }
      
      // Log the configuration
      console.log(`GeminiVertexProvider: Config: ${JSON.stringify({
        hasTools: !!request.config.tools,
        hasToolConfig: !!request.config.toolConfig,
        temperature
      })}`);
      
      // Make API request
      const response = await retryWithBackoff(() => this.client.models.generateContent(request));
      
      // Extract text from response - text is a property getter, not a method
      const responseText = response?.text || '';
      
      // Format the response - Gemini doesn't provide token counts directly
      // so we make an approximation based on content length
      const estimatedTokens = Math.ceil(prompt.length / 4) + Math.ceil(responseText.length / 4);
      
      return {
        content: responseText,
        rawResponse: response,
        usage: {
          promptTokens: Math.ceil(prompt.length / 4),
          completionTokens: Math.ceil(responseText.length / 4),
          totalTokens: estimatedTokens
        }
      };
    } catch (error) {
      console.error('Gemini Vertex AI query error:', error);
      throw new Error(`Gemini Vertex AI query failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
} 