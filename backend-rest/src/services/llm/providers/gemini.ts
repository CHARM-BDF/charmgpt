/**
 * Google Gemini LLM Provider using the new @google/genai SDK
 * 
 * This file implements the Google Gemini provider for the LLM Service.
 */

import { GoogleGenAI, FunctionCallingConfigMode } from '@google/genai';
import { LLMProvider, LLMProviderOptions, LLMProviderResponse } from '../types';

export class GeminiProvider implements LLMProvider {
  private client: GoogleGenAI;
  private defaultModel: string;
  
  constructor(options: LLMProviderOptions = {}) {
    // Initialize Gemini client
    const apiKey = options.apiKey || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('Gemini API key is required. Set it in options or GEMINI_API_KEY environment variable.');
    }
    
    this.client = new GoogleGenAI({ apiKey });
    
    // Override the incoming model parameter if it's a non-Gemini model
    let modelToUse = options.model;
    
    // If no model specified or it's not a Gemini model, use the default
    if (!modelToUse || modelToUse.includes('claude') || modelToUse.includes('gpt')) {
      modelToUse = 'gemini-2.5-flash';
      console.log(`GeminiProvider: Overriding non-Gemini model with default: ${modelToUse}`);
    }
    
    // Set default model
    this.defaultModel = modelToUse;
    
    console.log(`GeminiProvider: Initialized with model ${this.defaultModel}`);
  }
  
  async query(prompt: string, options: LLMProviderOptions = {}): Promise<LLMProviderResponse> {
    // Get options with defaults
    const modelName = options.model || this.defaultModel;
    const temperature = options.temperature ?? 0.2;
    const maxTokens = options.maxTokens || 4000;
    const systemPrompt = options.systemPrompt || '';
    
    try {
      console.log(`GeminiProvider: Sending query to ${modelName} (temp: ${temperature})`);
      
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
            mode: FunctionCallingConfigMode.ANY,
            allowedFunctionNames: functionNames.length > 0 ? functionNames : undefined
          }
        };
        
        console.log(`GeminiProvider: Added function calling config with ${functionNames.length} functions: ${functionNames.join(', ')}`);
      }
      
      // Handle specific tool choice if provided
      if (options.toolChoice && typeof options.toolChoice === 'object' && 'name' in options.toolChoice) {
        request.config.toolConfig = request.config.toolConfig || {};
        request.config.toolConfig.functionCallingConfig = request.config.toolConfig.functionCallingConfig || 
          { mode: FunctionCallingConfigMode.ANY };
          
        request.config.toolConfig.functionCallingConfig.allowedFunctionNames = [options.toolChoice.name];
        console.log(`GeminiProvider: Set allowed function to: ${options.toolChoice.name}`);
      }
      
      // Log the configuration
      console.log(`GeminiProvider: Config: ${JSON.stringify({
        hasTools: !!request.config.tools,
        hasToolConfig: !!request.config.toolConfig,
        temperature
      })}`);
      
      // Make API request
      const response = await this.client.models.generateContent(request);
      
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
      console.error('Gemini query error:', error);
      throw new Error(`Gemini query failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
} 