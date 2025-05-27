/**
 * LangGraph React Agent Provider with MCP Integration
 * 
 * This provider implements a unified LangGraph React agent that can work with
 * multiple LLM providers (Anthropic, OpenAI, Gemini, Ollama) through MCP adapters.
 */

import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { ChatAnthropic } from '@langchain/anthropic';
import { ChatOpenAI } from '@langchain/openai';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { ChatOllama } from '@langchain/ollama';
import { MultiServerMCPClient } from '@langchain/mcp-adapters';
import { LLMProvider, LLMProviderOptions, LLMProviderResponse } from '../types';
import { HumanMessage, AIMessage, SystemMessage } from '@langchain/core/messages';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { StructuredToolInterface } from '@langchain/core/tools';

interface MCPServerConfig {
  command?: string;
  args?: string[];
  transport?: string;
  url?: string;
  type?: string;
  env?: Record<string, string>;
  encoding?: string;
  stderr?: string;
  cwd?: string;
  restart?: Record<string, unknown>;
}

interface MCPClientConfig {
  mcpServers: Record<string, MCPServerConfig>;
}

interface LangGraphAgentOptions extends LLMProviderOptions {
  mcpServers?: Record<string, MCPServerConfig>;
  maxIterations?: number;
  recursionLimit?: number;
  baseUrl?: string; // For Ollama
}

/**
 * LangGraph React Agent provider implementation
 */
export class LangGraphProvider implements LLMProvider {
  /** The underlying chat model */
  private model: BaseChatModel;
  /** MCP client for tool integration */
  private mcpClient?: MultiServerMCPClient;
  /** The React agent instance */
  private agent: ReturnType<typeof createReactAgent> | null = null;
  /** Provider type */
  private providerType: string;
  /** Default model configuration */
  private defaultModel: string;
  
  /**
   * Create a new LangGraph provider
   * @param options Provider configuration options
   */
  constructor(options: LangGraphAgentOptions = {}) {
    this.providerType = options.provider || 'anthropic';
    this.defaultModel = options.model || this.getDefaultModel(this.providerType);
    
    // Initialize the appropriate chat model based on provider
    this.model = this.initializeChatModel(this.providerType, options);
    
    console.log(`LangGraphProvider: Initialized with ${this.providerType} model ${this.defaultModel}`);
    
    // Initialize MCP client if servers are provided
    if (options.mcpServers) {
      this.initializeMCPClient(options.mcpServers);
    }
    
    // Initialize the React agent
    this.initializeAgent();
  }
  
  /**
   * Get default model for a provider
   */
  private getDefaultModel(provider: string): string {
    switch (provider) {
      case 'anthropic':
        return 'claude-3-5-sonnet-20241022';
      case 'openai':
        return 'gpt-4-turbo-preview';
      case 'gemini':
        return 'gemini-2.0-flash';
      case 'ollama':
        return 'llama3.2:latest';
      default:
        return 'claude-3-5-sonnet-20241022';
    }
  }
  
  /**
   * Initialize the appropriate chat model based on provider
   */
  private initializeChatModel(provider: string, options: LangGraphAgentOptions): BaseChatModel {
    const temperature = options.temperature ?? 0.7;
    const maxTokens = options.maxTokens || 4000;
    
    switch (provider) {
      case 'anthropic': {
        const anthropicApiKey = options.apiKey || process.env.ANTHROPIC_API_KEY;
        if (!anthropicApiKey) {
          throw new Error('Anthropic API key is required. Set it in options or ANTHROPIC_API_KEY environment variable.');
        }
        return new ChatAnthropic({
          apiKey: anthropicApiKey,
          model: options.model || this.defaultModel,
          temperature,
          maxTokens,
        });
      }
        
      case 'openai': {
        const openaiApiKey = options.apiKey || process.env.OPENAI_API_KEY;
        if (!openaiApiKey) {
          throw new Error('OpenAI API key is required. Set it in options or OPENAI_API_KEY environment variable.');
        }
        return new ChatOpenAI({
          apiKey: openaiApiKey,
          model: options.model || this.defaultModel,
          temperature,
          maxTokens,
        });
      }
        
      case 'gemini': {
        const geminiApiKey = options.apiKey || process.env.GOOGLE_API_KEY;
        if (!geminiApiKey) {
          throw new Error('Google API key is required. Set it in options or GOOGLE_API_KEY environment variable.');
        }
        return new ChatGoogleGenerativeAI({
          apiKey: geminiApiKey,
          model: options.model || this.defaultModel,
          temperature,
          // Note: Gemini doesn't use maxTokens in the same way
        });
      }
        
      case 'ollama':
        return new ChatOllama({
          model: options.model || this.defaultModel,
          temperature,
          baseUrl: options.baseUrl || process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
        });
        
      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }
  }
  
  /**
   * Initialize MCP client with configured servers
   */
  private async initializeMCPClient(mcpServers: Record<string, MCPServerConfig>): Promise<void> {
    try {
      // Create proper configuration object
      const config: MCPClientConfig = { mcpServers };
      this.mcpClient = new MultiServerMCPClient(config as Parameters<typeof MultiServerMCPClient>[0]);
      await this.mcpClient.initializeConnections();
      console.log(`LangGraphProvider: MCP client initialized with ${Object.keys(mcpServers).length} servers`);
    } catch (error) {
      console.error('LangGraphProvider: Failed to initialize MCP client:', error);
      // Continue without MCP if initialization fails
      this.mcpClient = undefined;
    }
  }
  
  /**
   * Initialize the React agent
   */
  private async initializeAgent(tools: StructuredToolInterface[] = []): Promise<void> {
    try {
      // Create the React agent with provided tools
      this.agent = createReactAgent({
        llm: this.model,
        tools,
      });
      
      console.log(`LangGraphProvider: React agent initialized with ${tools.length} tools`);
    } catch (error) {
      console.error('LangGraphProvider: Failed to initialize React agent:', error);
      throw error;
    }
  }
  
  /**
   * Send a query to the LangGraph React agent
   * @param prompt The prompt to send
   * @param options Provider-specific options
   * @returns The processed response
   */
  async query(prompt: string, options: LangGraphAgentOptions = {}): Promise<LLMProviderResponse> {
    if (!this.agent) {
      throw new Error('LangGraph agent not initialized');
    }
    
    try {
      console.log(`LangGraphProvider: Sending query to ${this.providerType} React agent`);
      
      // Prepare messages for the agent
      const messages = [];
      
      // Add system prompt if provided
      if (options.systemPrompt) {
        messages.push(new SystemMessage(options.systemPrompt));
      }
      
      // Add the user message
      messages.push(new HumanMessage(prompt));
      
      // Configure recursion limit for this specific query
      const recursionLimit = options.recursionLimit || options.maxIterations ? 
        (options.maxIterations ? 2 * options.maxIterations + 1 : 20) : 20;
      
      // Invoke the agent
      console.log(`🤖 LangGraphProvider: Invoking agent with recursionLimit: ${recursionLimit}`);
      console.log(`🤖 LangGraphProvider: Messages count: ${messages.length}`);
      
      const response = await this.agent.invoke(
        { messages },
        { recursionLimit }
      );
      
      console.log(`🤖 LangGraphProvider: Agent execution completed`);
      console.log(`🤖 LangGraphProvider: Response messages count: ${response.messages?.length || 0}`);
      
      // Log all messages in the response to see the full conversation
      if (response.messages) {
        response.messages.forEach((msg: any, index: number) => {
          console.log(`🤖 LangGraphProvider: Message ${index}: ${msg.constructor.name}`);
          if (msg.content) {
            const contentPreview = typeof msg.content === 'string' 
              ? msg.content.substring(0, 200) 
              : JSON.stringify(msg.content).substring(0, 200);
            console.log(`🤖 LangGraphProvider: Content preview: ${contentPreview}...`);
          }
        });
      }
      
      // Extract the final message content
      let content = '';
      if (response.messages && response.messages.length > 0) {
        const lastMessage = response.messages[response.messages.length - 1];
        console.log(`🤖 LangGraphProvider: Last message type: ${lastMessage.constructor.name}`);
        
        if (lastMessage instanceof AIMessage) {
          content = typeof lastMessage.content === 'string' 
            ? lastMessage.content 
            : JSON.stringify(lastMessage.content);
        } else if (typeof lastMessage.content === 'string') {
          content = lastMessage.content;
        } else {
          content = JSON.stringify(lastMessage.content);
        }
        
        console.log(`🤖 LangGraphProvider: Final content length: ${content.length}`);
      }
      
      // Format the response
      return {
        content,
        rawResponse: response,
        usage: {
          // LangGraph doesn't provide token usage directly, so we estimate
          promptTokens: Math.ceil(prompt.length / 4),
          completionTokens: Math.ceil(content.length / 4),
          totalTokens: Math.ceil((prompt.length + content.length) / 4)
        }
      };
    } catch (error) {
      console.error('LangGraphProvider query error:', error);
      throw new Error(`LangGraph query failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Update MCP servers configuration
   */
  async updateMCPServers(mcpServers: Record<string, MCPServerConfig>): Promise<void> {
    // Close existing client if any
    if (this.mcpClient) {
      await this.mcpClient.close();
    }
    
    // Initialize new MCP client
    await this.initializeMCPClient(mcpServers);
    
    // Reinitialize agent with new tools
    await this.initializeAgent();
  }
  
  /**
   * Get available tools from MCP servers
   */
  async getAvailableTools(): Promise<StructuredToolInterface[]> {
    if (!this.mcpClient) {
      return [];
    }
    
    try {
      return await this.mcpClient.getTools();
    } catch (error) {
      console.error('LangGraphProvider: Failed to get tools:', error);
      return [];
    }
  }
  
  /**
   * Switch the underlying LLM provider
   */
  async switchProvider(provider: string, options: LangGraphAgentOptions = {}): Promise<void> {
    this.providerType = provider;
    this.defaultModel = options.model || this.getDefaultModel(provider);
    
    // Initialize new chat model
    this.model = this.initializeChatModel(provider, options);
    
    // Reinitialize agent with new model (no tools for now)
    await this.initializeAgent();
    
    console.log(`LangGraphProvider: Switched to ${provider} with model ${this.defaultModel}`);
  }
  
  /**
   * Update the agent with new tools
   */
  async updateAgentWithTools(tools: StructuredToolInterface[]): Promise<void> {
    try {
      // Reinitialize agent with new tools
      await this.initializeAgent(tools);
      console.log(`LangGraphProvider: Updated agent with ${tools.length} tools`);
    } catch (error) {
      console.error('LangGraphProvider: Failed to update agent with tools:', error);
      throw error;
    }
  }
  
  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    if (this.mcpClient) {
      await this.mcpClient.close();
    }
  }
} 