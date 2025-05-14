/**
 * Anthropic Provider for LLM Service
 * 
 * This file implements the LLM provider for Anthropic's Claude models.
 */

import { Anthropic } from '@anthropic-ai/sdk';
import { LLMProvider, LLMProviderOptions, LLMProviderResponse } from '../types';

interface AnthropicToolChoice {
  type: 'tool';
  name: string;
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
          console.log('🔵 [ANTHROPIC-PROVIDER] Processing tool:', JSON.stringify(tool, null, 2));
          
          // If tool is already in Claude format, validate and ensure correct structure
          if ('input_schema' in tool) {
            console.log('🔵 [ANTHROPIC-PROVIDER] Tool already in Claude format');
            const claudeTool = tool as ClaudeTool;
            
            // Ensure input_schema has all required fields
            if (!claudeTool.input_schema) {
              console.log('🔵 [ANTHROPIC-PROVIDER] Missing input_schema in Claude format tool');
              claudeTool.input_schema = {
                type: "object",
                properties: {},
                required: []
              };
            }
            
            // Ensure type is "object"
            if (claudeTool.input_schema.type !== "object") {
              console.log('🔵 [ANTHROPIC-PROVIDER] Fixing input_schema type to be "object"');
              claudeTool.input_schema.type = "object";
            }
            
            // Ensure properties exists
            if (!claudeTool.input_schema.properties) {
              console.log('🔵 [ANTHROPIC-PROVIDER] Adding empty properties object');
              claudeTool.input_schema.properties = {};
            }
            
            return claudeTool;
          }
          
          // Handle old format with custom.input_schema
          if ('custom' in tool && 'input_schema' in (tool.custom || {})) {
            console.log('🔵 [ANTHROPIC-PROVIDER] Converting from custom.input_schema format to direct input_schema');
            const oldFormatTool = tool as any;
            return {
              name: oldFormatTool.name,
              description: oldFormatTool.description || '',
              input_schema: oldFormatTool.custom.input_schema
            };
          }
          
          // For non-Claude format, create proper structure
          console.log('🔵 [ANTHROPIC-PROVIDER] Converting tool to Claude format');
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
          
          console.log('🔵 [ANTHROPIC-PROVIDER] Converted tool:', JSON.stringify(convertedTool, null, 2));
          return convertedTool;
        });
        
        // Log the final tool format being sent
        console.log('🔵 [ANTHROPIC-PROVIDER] Final tool format:', JSON.stringify(requestOptions.tools, null, 2));
        
        // If toolChoice is specified, add it to the request
        if (options.toolChoice) {
          // Ensure tool choice has the correct format
          const toolChoice = typeof options.toolChoice === 'string' 
            ? { type: 'tool' as const, name: options.toolChoice }
            : options.toolChoice;
            
          requestOptions.tool_choice = toolChoice;
          console.log('🔵 [ANTHROPIC-PROVIDER] Tool choice:', JSON.stringify(toolChoice, null, 2));
        }
      }
      
      // Make API request
      const response = await this.client.messages.create(requestOptions);
      
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