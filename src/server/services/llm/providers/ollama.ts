/**
 * Ollama API Provider
 * 
 * This implements the LLMProvider interface for Ollama
 * Local API endpoint: http://localhost:11434/api
 */

import { LLMProvider, LLMProviderOptions, LLMProviderResponse } from '../types';
import { OllamaToolAdapter } from '../../chat/adapters/ollama';

/**
 * Extend LLMProviderOptions for Ollama-specific options
 */
interface OllamaProviderOptions extends LLMProviderOptions {
  apiUrl?: string;
  top_p?: number;
  top_k?: number;
  repeat_penalty?: number;
}

/**
 * Define the basic structure of an Ollama chat message
 */
interface OllamaChatMessage {
  role: string;
  content: string;
  tool_calls?: Array<{
    function: {
      name: string;
      arguments: any;
    };
  }>;
}

/**
 * Define the structure of an Ollama chat response
 */
interface OllamaChatResponse {
  model: string;
  created_at: string;
  message: OllamaChatMessage;
  done_reason: string;
  done: boolean;
  total_duration: number;
}

/**
 * Ollama Provider implements the LLMProvider interface for Ollama models
 */
export class OllamaProvider implements LLMProvider {
  private model: string;
  private apiUrl: string;
  private toolAdapter: OllamaToolAdapter;
  
  /**
   * Create a new Ollama provider instance
   * @param options Provider options
   */
  constructor(options: OllamaProviderOptions = {}) {
    this.model = options.model || 'llama3.2:latest';
    
    // Build API URL from environment variables or use provided apiUrl
    if (options.apiUrl) {
      this.apiUrl = options.apiUrl;
    } else {
      const ollamaBase = process.env.OLLAMA_BASE || 'http://localhost';
      const ollamaPort = process.env.OLLAMA_PORT || '11434';
      this.apiUrl = `${ollamaBase}:${ollamaPort}/api`;
    }
    
    this.toolAdapter = new OllamaToolAdapter();
    
    console.log(`🟤 OllamaProvider: Initialized with model ${this.model} at ${this.apiUrl}`);
  }
  
  /**
   * Check if Ollama API is available
   * @returns True if API is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.apiUrl}/tags`, {
        method: 'GET',
        // Using standard fetch options without dispatcher
        headers: {
          'Content-Type': 'application/json',
        },
        // Add a signal with timeout 
        signal: AbortSignal.timeout(10000),
      });
      
      if (!response.ok) {
        console.error(`🟤 OllamaProvider: API health check failed with status ${response.status}`);
        return false;
      }
      
      const data = await response.json();
      
      // Check if our model is available
      const modelExists = data.models && data.models.some((m: any) => 
        m.name === this.model || m.model === this.model
      );
      
      if (!modelExists) {
        console.warn(`🟤 OllamaProvider: Model ${this.model} not found in available models`);
        return false;
      }
      
      return true;
    } catch (error) {
      console.error(`🟤 OllamaProvider: API health check error:`, error);
      return false;
    }
  }
  
  /**
   * Query the Ollama API with a prompt
   * @param prompt The prompt to send
   * @param options Additional options for the query
   * @returns Processed response from Ollama
   */
  async query(prompt: string, options: LLMProviderOptions = {}): Promise<LLMProviderResponse> {
    console.log(`🟤 OllamaProvider: Sending query to ${this.model} (temp: ${options.temperature || 0.7})`);
    
    try {
      // Format messages with system prompt
      const messages: OllamaChatMessage[] = [];
      
      // Add system prompt if provided
      if (options.systemPrompt) {
        messages.push({
          role: 'system',
          content: options.systemPrompt
        });
      }
      
      // Add user prompt
      messages.push({
        role: 'user',
        content: prompt
      });
      
      // Check if this is a response formatter request
      const isResponseFormatterRequest = options.tools?.some(tool => 
        tool.name === 'response_formatter' || 
        (tool as any).function?.name === 'response_formatter'
      ) && options.toolChoice;
      
      if (isResponseFormatterRequest) {
        console.log(`🟤 OllamaProvider: Detected response formatter request - using structured outputs instead of tool calling`);
        
        // Use structured outputs for response formatting
        const formatSchema = {
          type: "object",
          properties: {
            thinking: {
              type: "string",
              description: "Optional internal reasoning process, formatted in markdown"
            },
            conversation: {
              type: "array",
              description: "Array of conversation segments and artifacts in order of appearance",
              items: {
                type: "object",
                properties: {
                  type: {
                    type: "string",
                    enum: ["text", "artifact"],
                    description: "Type of conversation segment"
                  },
                  content: {
                    type: "string",
                    description: "Markdown formatted text content"
                  },
                  artifact: {
                    type: "object",
                    description: "Artifact details",
                    properties: {
                      type: {
                        type: "string",
                        enum: [
                          "text/markdown",
                          "application/vnd.ant.code",
                          "image/svg+xml",
                          "application/vnd.mermaid",
                          "text/html",
                          "application/vnd.react",
                          "application/vnd.bibliography",
                          "application/vnd.knowledge-graph"
                        ]
                      },
                      title: { type: "string" },
                      content: { type: "string" },
                      language: { type: "string" }
                    },
                    required: ["type", "title", "content"]
                  }
                },
                required: ["type"]
              }
            }
          },
          required: ["conversation"]
        };
        
        // Cast options to OllamaProviderOptions to access Ollama-specific properties
        const ollamaOptions = options as OllamaProviderOptions;
        
        // Build request payload with structured output format
        const payload: any = {
          model: this.model,
          messages: messages,
          stream: false,
          format: formatSchema, // Use structured outputs instead of tools
          options: {
            temperature: options.temperature || 0.7,
            top_p: ollamaOptions.top_p || 0.9,
            top_k: ollamaOptions.top_k || 40,
            num_predict: options.maxTokens || 1024,
            repeat_penalty: ollamaOptions.repeat_penalty || 1.1
          }
        };
        
        console.log(`🟤 OllamaProvider: Using structured output format for response formatting`);
        
        // Make the API call
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 300000);
        
        const response = await fetch(`${this.apiUrl}/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload),
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Ollama API returned ${response.status}: ${errorText}`);
        }
        
        const data: OllamaChatResponse = await response.json();
        
        console.log(`🟤 OllamaProvider: Structured output response received (${data.message.content?.length || 0} chars)`);
        
        // For structured outputs, the content should be valid JSON matching our schema
        // We'll create a fake tool call response to maintain compatibility with the formatter
        const structuredResponse = {
          ...data,
          message: {
            ...data.message,
            tool_calls: [{
              function: {
                name: 'response_formatter',
                arguments: data.message.content // This should be valid JSON from structured output
              }
            }]
          }
        };
        
        return {
          content: data.message.content || '',
          rawResponse: structuredResponse, // Return the modified response with fake tool call
          usage: {
            promptTokens: data.total_duration ? Math.floor(data.total_duration / 1000) : 0,
            completionTokens: 0,
            totalTokens: 0
          }
        };
      }
      
      // Regular tool calling path for non-formatter requests
      // Convert MCP tools to Ollama format if provided
      let toolsForOllama: any[] = [];
      if (options.tools && Array.isArray(options.tools) && options.tools.length > 0) {
        console.log(`🟤 OllamaProvider: Processing ${options.tools.length} tools`);
        toolsForOllama = this.toolAdapter.convertToolDefinitions(options.tools);
        console.log(`🟤 OllamaProvider: Converted to ${toolsForOllama.length} Ollama format tools`);
      }
      
      // Cast options to OllamaProviderOptions to access Ollama-specific properties
      const ollamaOptions = options as OllamaProviderOptions;
      
      // Build request payload
      const payload: any = {
        model: this.model,
        messages: messages,
        stream: false, // Set to false initially for simpler implementation
        options: {
          temperature: options.temperature || 0.7,
          top_p: ollamaOptions.top_p || 0.9,
          top_k: ollamaOptions.top_k || 40,
          num_predict: options.maxTokens || 1024,
          repeat_penalty: ollamaOptions.repeat_penalty || 1.1
        }
      };
      
      // Add tools if available
      if (toolsForOllama.length > 0) {
        payload.tools = toolsForOllama;
        
        // Log the tool names for debugging
        const toolNames = toolsForOllama.map((t: any) => t.function?.name).filter(Boolean);
        console.log(`🟤 OllamaProvider: Added tools to payload: ${toolNames.join(', ')}`);
        
        // IMPORTANT: Ollama doesn't support tool_choice parameter properly
        // When tool_choice is specified, Ollama returns malformed text instead of proper tool calls
        // So we intentionally ignore tool_choice for Ollama and let it decide naturally
        if (options.toolChoice) {
          console.log(`🟤 OllamaProvider: Tool choice specified but IGNORED for Ollama compatibility: ${JSON.stringify(options.toolChoice)}`);
          console.log(`🟤 OllamaProvider: Ollama will use tools naturally without forced choice`);
          // Do NOT add tool_choice to payload - Ollama works better without it
        } else {
          console.log(`🟤 OllamaProvider: No tool choice specified - Ollama will decide tool usage naturally`);
        }
      }
      
      // Log the request (sanitized)
      console.log(`🟤 OllamaProvider: Request to ${this.apiUrl}/chat (${payload.messages.length} messages, ${payload.tools?.length || 0} tools)`);
      
      // Make the API call with extended timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 300000); // 5 minute timeout
      
      const response = await fetch(`${this.apiUrl}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId); // Clear the timeout
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Ollama API returned ${response.status}: ${errorText}`);
      }
      
      const data: OllamaChatResponse = await response.json();
      
      // Extract content and tool calls
      const content = data.message.content || '';
      const toolCalls = this.toolAdapter.extractToolCalls(data);
      
      // Enhanced logging for debugging tool calls
      if (toolCalls && toolCalls.length > 0) {
        console.log(`🟤 OllamaProvider: Extracted ${toolCalls.length} tool calls:`);
        toolCalls.forEach((call, index) => {
          // Use type assertion to access properties that may not be in the interface
          const anyCall = call as any;
          console.log(`🟤 OllamaProvider: Tool call #${index + 1}: ${call.name}${anyCall.operation ? '/' + anyCall.operation : ''}`);
          console.log(`🟤 OllamaProvider: Arguments: ${JSON.stringify(anyCall.arguments || {}).substring(0, 200)}`);
        });
      }
      
      console.log(`🟤 OllamaProvider: Response received (${content.length} chars${toolCalls.length ? ', ' + toolCalls.length + ' tool calls' : ''})`);
      
      // Return standardized response format matching the LLMProviderResponse interface
      return {
        content: content,
        rawResponse: data, // This is required in LLMProviderResponse
        usage: {
          promptTokens: data.total_duration ? Math.floor(data.total_duration / 1000) : 0,
          completionTokens: 0, // Ollama doesn't provide this directly
          totalTokens: 0 // Ollama doesn't provide this directly
        }
      };
    } catch (error) {
      console.error(`🟤 OllamaProvider: Query error:`, error);
      throw new Error(`Ollama query failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
} 