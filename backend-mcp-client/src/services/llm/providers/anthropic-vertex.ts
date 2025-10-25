/**
 * Anthropic Provider for LLM Service using Google Vertex AI
 * 
 * This file implements the LLM provider for Anthropic's Claude models via Google Vertex AI.
 * It will be used when GOOGLE_CLOUD_PROJECT environment variable is set.
 */

import { AnthropicVertex } from '@anthropic-ai/vertex-sdk';
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
          console.log(`🔄 AnthropicVertexProvider: Rate limited, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries + 1})`);
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

interface ClaudeTool {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}

/**
 * Anthropic provider implementation using Google Vertex AI
 */
export class AnthropicVertexProvider implements LLMProvider {
  /** Anthropic client instance */
  private client: AnthropicVertex;
  /** Default model to use */
  private defaultModel: string;
  /** Google Cloud Project ID */
  private projectId: string;
  /** Google Cloud Region */
  private region: string;
  
  /**
   * Create a new Anthropic provider using Vertex AI
   * @param options Provider configuration options
   */
  constructor(options: LLMProviderOptions = {}) {
    // Get Google Cloud Project ID from environment
    const projectId = process.env.GOOGLE_CLOUD_PROJECT;
    if (!projectId) {
      throw new Error('GOOGLE_CLOUD_PROJECT environment variable is required for Vertex AI.');
    }
    this.projectId = projectId;
    this.region = process.env.GOOGLE_CLOUD_LOCATION || 'us-east5';
    
    // For Vertex AI, we use the AnthropicVertex client
    // The SDK will automatically use Application Default Credentials (ADC)
    this.client = new AnthropicVertex({
      projectId: this.projectId,
      region: this.region,
    });
    
    // Set default model - use Vertex AI model names
    this.defaultModel = options.model || 'claude-sonnet-4-5';
    
    // Override the incoming model parameter if it's a non-Claude model
    let modelToUse = options.model;
    
    // If no model specified or it's not a Claude model, use the default
    if (!modelToUse || modelToUse.includes('gpt') || modelToUse.includes('gemini')) {
      modelToUse = 'claude-sonnet-4-5';
      console.log(`AnthropicVertexProvider: Overriding non-Claude model with default: ${modelToUse}`);
    }
    
    // Set default model
    this.defaultModel = modelToUse;
    
    console.log(`AnthropicVertexProvider: Initialized with model ${this.defaultModel} in project ${this.projectId}, region ${this.region}`);
  }
  
  /**
   * Send a query to the Anthropic API via Vertex AI
   * @param prompt The prompt to send
   * @param options Provider-specific options
   * @returns The processed response
   */
  async query(prompt: string, options: LLMProviderOptions = {}): Promise<LLMProviderResponse> {
    // Get options with defaults
    const model = options.model || this.defaultModel;
    const temperature = options.temperature ?? 0.2;
    const maxTokens = options.maxTokens || 4000;
    const systemPrompt = options.systemPrompt || '';
    
    try {
      console.log(`AnthropicVertexProvider: Sending query to ${model} (temp: ${temperature})`);
      
      // Prepare request options
      const requestOptions: any = {
        model,
        max_tokens: maxTokens,
        temperature,
        system: systemPrompt,
        messages: [{ role: 'user', content: prompt }],
      };

      // Add tools and tool choice if provided
      if (options.tools) {
        // Ensure tools are in the correct format with custom wrapper
        const tools = Array.isArray(options.tools) ? options.tools : [options.tools];
        requestOptions.tools = tools.map(tool => {
          console.log('🔵 [ANTHROPIC-VERTEX-PROVIDER] Processing tool:', JSON.stringify(tool, null, 2));
          
          // If tool is already in Claude format, validate and ensure correct structure
          if ('input_schema' in tool) {
            console.log('🔵 [ANTHROPIC-VERTEX-PROVIDER] Tool already in Claude format');
            const claudeTool = tool as ClaudeTool;
            
            // Ensure input_schema has all required fields
            if (!claudeTool.input_schema) {
              console.log('🔵 [ANTHROPIC-VERTEX-PROVIDER] Missing input_schema in Claude format tool');
              claudeTool.input_schema = {
                type: "object",
                properties: {},
                required: []
              };
            }
            
            // Ensure type is "object"
            if (claudeTool.input_schema.type !== "object") {
              console.log('🔵 [ANTHROPIC-VERTEX-PROVIDER] Fixing input_schema type to be "object"');
              claudeTool.input_schema.type = "object";
            }
            
            // Ensure properties exists
            if (!claudeTool.input_schema.properties) {
              console.log('🔵 [ANTHROPIC-VERTEX-PROVIDER] Adding empty properties object');
              claudeTool.input_schema.properties = {};
            }
            
            return claudeTool;
          }
          
          // Handle old format with custom.input_schema
          if ('custom' in tool && 'input_schema' in (tool.custom || {})) {
            console.log('🔵 [ANTHROPIC-VERTEX-PROVIDER] Converting from custom.input_schema format to direct input_schema');
            const oldFormatTool = tool as Record<string, unknown>;
            return {
              name: oldFormatTool.name,
              description: oldFormatTool.description || '',
              input_schema: oldFormatTool.custom.input_schema
            };
          }
          
          // For non-Claude format, create proper structure
          console.log('🔵 [ANTHROPIC-VERTEX-PROVIDER] Converting tool to Claude format');
          const input_schema = tool.input_schema || tool.parameters || {
            type: "object",
            properties: {},
            required: []
          };
          
          // Ensure input_schema has correct structure
          if (typeof input_schema === 'object') {
            input_schema.type = "object";
            input_schema.properties = input_schema.properties || {};
            input_schema.required = input_schema.required || [];
          }
          
          const convertedTool: ClaudeTool = {
            name: tool.name,
            description: tool.description || '',
            input_schema: input_schema
          };
          
          console.log('🔵 [ANTHROPIC-VERTEX-PROVIDER] Converted tool:', JSON.stringify(convertedTool, null, 2));
          return convertedTool;
        });
        
        // Log the final tool format being sent
        console.log('🔵 [ANTHROPIC-VERTEX-PROVIDER] Final tool format:', JSON.stringify(requestOptions.tools, null, 2));
        
        // If toolChoice is specified, add it to the request
        if (options.toolChoice) {
          // Ensure tool choice has the correct format
          const toolChoice = typeof options.toolChoice === 'string' 
            ? { type: 'tool' as const, name: options.toolChoice }
            : options.toolChoice;
            
          requestOptions.tool_choice = toolChoice;
          console.log('🔵 [ANTHROPIC-VERTEX-PROVIDER] Tool choice:', JSON.stringify(toolChoice, null, 2));
        }
      }
      
      // Make API request
      const response = await retryWithBackoff(() => this.client.messages.create(requestOptions));
      
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
      console.error('Anthropic Vertex AI query error:', error);
      throw new Error(`Anthropic Vertex AI query failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
} 