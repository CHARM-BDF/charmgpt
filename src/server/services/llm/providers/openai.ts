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
    
    // Log toolChoice if present
    if (options.toolChoice) {
      console.log(`🔍 DEBUG-TOOLCHOICE: OpenAI provider received toolChoice:`, JSON.stringify(options.toolChoice));
    } else {
      console.log(`🔍 DEBUG-TOOLCHOICE: OpenAI provider did NOT receive toolChoice parameter`);
    }
    
    // Log tools if present
    if (options.tools && Array.isArray(options.tools) && options.tools.length > 0) {
      console.log(`🔍 DEBUG-TOOLS: OpenAI provider received ${options.tools.length} tools`);
      console.log(`🔍 DEBUG-TOOLS: First tool name: ${options.tools[0].function?.name || 'unknown'}`);
    } else {
      console.log(`🔍 DEBUG-TOOLS: OpenAI provider did NOT receive tools parameter`);
    }
    
    try {
      console.log(`OpenAIProvider: Sending query to ${model} (temp: ${temperature})`);
      
      // Prepare the request parameters
      const requestParams: any = {
        model,
        max_tokens: maxTokens,
        temperature,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ],
      };
      
      // Add tools if provided
      if (options.tools && Array.isArray(options.tools) && options.tools.length > 0) {
        requestParams.tools = options.tools;
        console.log(`🔧 DEBUG-API-PARAMS: Adding ${options.tools.length} tools to OpenAI request`);
      }
      
      // Add tool_choice if provided
      if (options.toolChoice) {
        // Format toolChoice according to OpenAI's expected format
        if (typeof options.toolChoice === 'object' && options.toolChoice.name) {
          requestParams.tool_choice = {
            type: "function",
            function: { name: options.toolChoice.name }
          };
        } else {
          // Pass it as-is if it's already in the expected format
          requestParams.tool_choice = options.toolChoice;
        }
        console.log(`🔧 DEBUG-API-PARAMS: Adding tool_choice to OpenAI request:`, JSON.stringify(requestParams.tool_choice));
      }
      
      // Log the final request parameters (without the full messages for brevity)
      const debugParams = {...requestParams};
      if (debugParams.messages) {
        debugParams.messages = `[${debugParams.messages.length} messages]`;
      }
      // Truncate tools array to prevent excessive logging
      if (debugParams.tools && Array.isArray(debugParams.tools)) {
        const toolCount = debugParams.tools.length;
        debugParams.tools = debugParams.tools.length > 0 
          ? [`${toolCount} tools (first: ${debugParams.tools[0]?.function?.name || 'unknown'})`] 
          : [];
      }
      console.log(`🔧 DEBUG-API-PARAMS: Final OpenAI request params:`, JSON.stringify(debugParams));
      
      // Make API request
      const response = await this.client.chat.completions.create(requestParams);
      
      // Log if tool calls were returned
      if (response.choices[0]?.message?.tool_calls) {
        const toolCalls = response.choices[0].message.tool_calls;
        console.log(`✅ DEBUG-RESPONSE: OpenAI returned ${toolCalls.length} tool calls`);
        console.log(`✅ DEBUG-RESPONSE: First tool call name: ${toolCalls[0]?.function?.name || 'unknown'}`);
      } else {
        console.log(`❌ DEBUG-RESPONSE: OpenAI did NOT return any tool calls`);
      }
      
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
      console.error('❌ DEBUG-ERROR: OpenAI query error:', error);
      throw new Error(`OpenAI query failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
} 