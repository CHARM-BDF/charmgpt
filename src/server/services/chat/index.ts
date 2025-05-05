/**
 * Chat Service Implementation
 * 
 * This file implements the main Chat Service that provides a unified interface
 * for interacting with different LLM providers.
 */

import { LLMService } from '../llm';
import { MCPService, AnthropicTool } from '../mcp';
import { MessageService, StoreFormat } from '../message';
import { ArtifactService } from '../artifact';
import { ReadableStream } from 'stream/web';
import { getToolCallAdapter, ToolCall, ToolResult } from './adapters';
import { getResponseFormatterAdapter, FormatterAdapterType } from './formatters';
import { ResponseFormatterAdapter } from './formatters/types';

// Importing types
type ModelType = 'anthropic' | 'ollama' | 'openai' | 'gemini';

// Basic chat message type with union of valid roles
interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string | any[];
}

// Extended chat message with any role for provider-specific formatting
interface ProviderChatMessage {
  role: string;
  content: string | any[];
}

/**
 * Main Chat Service implementation
 * Provides a unified interface for chat interactions across different LLM providers
 */
export class ChatService {
  /** LLM service for provider interactions */
  private llmService: LLMService;
  /** MCP service for tool execution */
  private mcpService?: MCPService;
  /** Message service for response formatting */
  private messageService: MessageService;
  /** Artifact service for artifact processing */
  private artifactService: ArtifactService;
  
  /**
   * Create a new Chat Service
   * @param llmService The LLM service to use for provider interactions
   * @param mcpService Optional MCP service for tool execution
   * @param messageService Optional message service for response formatting
   * @param artifactService Optional artifact service for artifact processing
   */
  constructor(
    llmService: LLMService, 
    mcpService?: MCPService,
    messageService?: MessageService,
    artifactService?: ArtifactService
  ) {
    this.llmService = llmService;
    this.mcpService = mcpService;
    this.messageService = messageService || new MessageService();
    this.artifactService = artifactService || new ArtifactService();
    console.log('ChatService: Initialization complete');
  }
  
  /**
   * Process a chat message with full provider-agnostic support
   * This method uses response formatter adapters to ensure consistent output format
   * 
   * @param message The user message
   * @param history Previous chat history
   * @param options Chat options including model provider, blocked servers, and pinned graph
   * @param statusHandler Optional callback for status updates
   * @returns A StoreFormat object with the processed response
   */
  async processChat(
    message: string,
    history: ChatMessage[],
    options: {
      modelProvider: ModelType;
      blockedServers?: string[];
      pinnedGraph?: any;
      temperature?: number;
      maxTokens?: number;
    },
    statusHandler?: (status: string) => void
  ): Promise<StoreFormat> {
    // Notify status if handler provided
    statusHandler?.('Initializing chat processing...');
    
    // Set the LLM provider
    this.llmService.setProvider({
      provider: options.modelProvider as any,
      temperature: options.temperature || 0.2,
      maxTokens: options.maxTokens || 4000
    });
    
    // Get available MCP tools
    let mcpTools: AnthropicTool[] = [];
    if (this.mcpService) {
      statusHandler?.('Retrieving available tools...');
      mcpTools = await this.mcpService.getAllAvailableTools(options.blockedServers);
    }
    
    // Run sequential thinking with tools if needed
    statusHandler?.('Processing with sequential thinking...');
    const processedHistory = await this.runSequentialThinking(
      message,
      history,
      mcpTools,
      options.modelProvider,
      {
        temperature: options.temperature,
        maxTokens: options.maxTokens
      },
      statusHandler
    );
    
    // Get the appropriate response formatter adapter
    const formatterAdapter = getResponseFormatterAdapter(options.modelProvider as FormatterAdapterType);
    const formatterToolDefinition = formatterAdapter.getResponseFormatterToolDefinition();
    
    // Get the latest message (should be the original user message added after thinking)
    const latestMessage = processedHistory[processedHistory.length - 1].content as string;
    
    // Format history for provider
    const formattedHistory = this.formatMessageHistory(
      processedHistory.slice(0, -1), // Exclude the latest message
      options.modelProvider
    );
    
    // Handle provider-specific tool choice configurations
    let toolChoice: any = { type: 'tool', name: 'response_formatter' };
    
    // For Anthropic, toolChoice is handled differently
    if (options.modelProvider === 'anthropic') {
      toolChoice = { name: 'response_formatter' };
    }
    
    // Log what we're sending to LLMService
    console.log(`🔍 DEBUG-CHAT-SERVICE: Provider: ${options.modelProvider}`);
    console.log(`🔍 DEBUG-CHAT-SERVICE: Sending toolChoice:`, JSON.stringify(toolChoice));
    console.log(`🔍 DEBUG-CHAT-SERVICE: Formatter tool definition:`, JSON.stringify(formatterToolDefinition).substring(0, 100) + '...');
    
    // Get the LLM response with formatter
    statusHandler?.(`Getting formatted response from ${options.modelProvider}...`);
    const llmResponse = await this.llmService.query({
      prompt: latestMessage,
      options: {
        temperature: options.temperature || 0.2,
        maxTokens: options.maxTokens || 4000,
        toolChoice: toolChoice as any,  // Use type assertion to bypass type checking
        tools: [formatterToolDefinition]  // Add tools parameter with formatter tool
      } as any, // Cast the entire options object to bypass type checking
      systemPrompt: this.buildSystemPromptWithContext(formattedHistory, [formatterToolDefinition], toolChoice)
    });
    
    // Log the response
    console.log(`🔍 DEBUG-CHAT-SERVICE: Received raw response from LLM service`);
    console.log(`🔍 DEBUG-CHAT-SERVICE: Response has tool calls:`, 
      llmResponse.rawResponse?.choices?.[0]?.message?.tool_calls ? 'Yes' : 'No');
    
    // Extract the formatter output using the adapter
    statusHandler?.('Processing formatter output...');
    const formatterOutput = formatterAdapter.extractFormatterOutput(llmResponse.rawResponse);
    let storeFormat = formatterAdapter.convertToStoreFormat(formatterOutput);
    
    // Enhance with additional artifacts if needed
    if (options.pinnedGraph) {
      storeFormat = this.messageService.enhanceResponseWithArtifacts(
        storeFormat,
        [options.pinnedGraph]
      );
    }
    
    return storeFormat;
  }
  
  /**
   * Build a system prompt that includes the message history and tools
   * This is a helper to work around the lack of direct history/tools support in the LLMService
   * 
   * @param history The message history
   * @param tools The tools to include
   * @param toolChoice Optional tool choice specification
   * @returns A system prompt with the context
   */
  private buildSystemPromptWithContext(
    history: ProviderChatMessage[],
    tools: any[] = [],
    toolChoice?: { type?: string; name: string }
  ): string {
    // Create a system prompt that includes the history and tools
    let systemPrompt = 'You are a helpful assistant.\n\n';
    
    // Add message history
    if (history.length > 0) {
      systemPrompt += '# Conversation History\n\n';
      history.forEach(msg => {
        systemPrompt += `${msg.role.toUpperCase()}: ${
          typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)
        }\n\n`;
      });
    }
    
    // Add tools if provided
    if (tools.length > 0) {
      systemPrompt += '# Available Tools\n\n';
      systemPrompt += 'You have access to the following tools. USE THESE TOOLS WHEN APPROPRIATE to provide the best response.\n';
      systemPrompt += 'You should prefer using tools over generating fictional information. For example, if asked about specific data that requires a tool, use the tool rather than making up an answer.\n\n';
      
      tools.forEach(tool => {
        systemPrompt += `Tool: ${tool.name}\n`;
        systemPrompt += `Description: ${tool.description || 'No description provided'}\n\n`;
      });
      
      // Add tool choice if specified
      if (toolChoice) {
        systemPrompt += `# Required Action\n\nYou MUST use the ${toolChoice.name} tool to format your response. Do not respond directly with text, only use the ${toolChoice.name} tool.\n`;
      }
    }
    
    return systemPrompt;
  }
  
  /**
   * Send a basic message to the LLM provider
   * This is a simplified version that doesn't include tools or sequential thinking
   * 
   * @param message The user message
   * @param history Previous chat history
   * @param options Chat options including model provider
   * @param statusHandler Optional callback for status updates
   * @returns A readable stream of the response
   */
  async sendBasicMessage(
    message: string,
    history: ChatMessage[],
    options: {
      modelProvider: ModelType;
      temperature?: number;
      maxTokens?: number;
    },
    statusHandler?: (status: string) => void
  ): Promise<ReadableStream> {
    // Notify status if handler provided
    statusHandler?.('Sending message to LLM provider...');
    
    // Set the LLM provider
    this.llmService.setProvider({
      provider: options.modelProvider as any,
      temperature: options.temperature || 0.2,
      maxTokens: options.maxTokens || 4000
    });
    
    // Format history appropriately for the provider
    const formattedHistory = this.formatMessageHistory(history, options.modelProvider);
    
    // Get the current provider name for logging
    const providerName = this.llmService.getProvider();
    console.log(`📣 ChatService: Using provider ${providerName.toUpperCase()}`);
    
    // Basic message sending without tools or sequential thinking
    statusHandler?.(`Getting response from ${options.modelProvider}...`);
    
    try {
      // Access the provider instance directly from the LLM service
      // The provider interface will need to be extended to support streaming
      // For now, this is a placeholder that will be implemented in the LLMProvider classes
      const stream = await this.streamChatCompletion(
        message,
        formattedHistory
      );
      
      statusHandler?.('Response received, streaming content...');
      return stream;
    } catch (error) {
      console.error('ChatService: Error sending message:', error);
      throw new Error(`Error getting response from ${options.modelProvider}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Send a message to the LLM provider with tools
   * 
   * @param message The user message
   * @param history Previous chat history
   * @param options Chat options including model provider and blocked servers
   * @param statusHandler Optional callback for status updates
   * @returns A readable stream of the response
   */
  async sendMessageWithTools(
    message: string,
    history: ChatMessage[],
    options: {
      modelProvider: ModelType;
      blockedServers?: string[];
      temperature?: number;
      maxTokens?: number;
    },
    statusHandler?: (status: string) => void
  ): Promise<ReadableStream> {
    // Ensure we have an MCP service for tool execution
    if (!this.mcpService) {
      throw new Error('MCPService not available. Tool execution is not possible.');
    }
    
    // Notify status if handler provided
    statusHandler?.('Initializing chat with tools...');
    
    // Set the LLM provider
    this.llmService.setProvider({
      provider: options.modelProvider as any,
      temperature: options.temperature || 0.2,
      maxTokens: options.maxTokens || 4000
    });
    
    // Get available tools from MCP
    statusHandler?.('Retrieving available tools...');
    const mcpTools = await this.mcpService.getAllAvailableTools(options.blockedServers);
    
    // Get the appropriate tool adapter
    const toolAdapter = getToolCallAdapter(options.modelProvider);
    
    // Convert tools to provider-specific format
    const providerTools = toolAdapter.convertToolDefinitions(mcpTools);
    
    // Format history appropriately for the provider
    const formattedHistory = this.formatMessageHistory(history, options.modelProvider);
    
    statusHandler?.(`Sending message to ${options.modelProvider} with ${mcpTools.length} tools...`);
    
    try {
      // For now, use the placeholder streaming method
      // This will be replaced with actual provider implementations in the next milestone
      const stream = await this.streamChatWithTools(
        message,
        formattedHistory,
        providerTools
      );
      
      statusHandler?.('Response received, streaming content...');
      return stream;
    } catch (error) {
      console.error('ChatService: Error sending message with tools:', error);
      throw new Error(`Error getting response from ${options.modelProvider}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Process a chat message using sequential thinking with tools
   * 
   * @param message The user message
   * @param history Previous chat history
   * @param options Chat options including model provider and blocked servers
   * @param statusHandler Optional callback for status updates
   * @returns A readable stream of the final response
   */
  async processChatWithSequentialThinking(
    message: string,
    history: ChatMessage[],
    options: {
      modelProvider: ModelType;
      blockedServers?: string[];
      temperature?: number;
      maxTokens?: number;
    },
    statusHandler?: (status: string) => void
  ): Promise<ReadableStream> {
    // Ensure we have an MCP service for tool execution
    if (!this.mcpService) {
      throw new Error('MCPService not available. Tool execution is not possible.');
    }
    
    // Notify status if handler provided
    statusHandler?.('Initializing sequential thinking process...');
    
    // Set the LLM provider
    this.llmService.setProvider({
      provider: options.modelProvider as any,
      temperature: options.temperature || 0.2,
      maxTokens: options.maxTokens || 4000
    });
    
    // Get available tools from MCP
    statusHandler?.('Retrieving available tools...');
    const mcpTools = await this.mcpService.getAllAvailableTools(options.blockedServers);
    
    // Get the appropriate tool adapter
    const toolAdapter = getToolCallAdapter(options.modelProvider);
    
    // Convert tools to provider-specific format
    const providerTools = toolAdapter.convertToolDefinitions(mcpTools);
    
    // Run the sequential thinking process
    statusHandler?.('Starting sequential thinking process...');
    const processedMessages = await this.runSequentialThinking(
      message,
      history,
      mcpTools,
      options.modelProvider,
      {
        temperature: options.temperature,
        maxTokens: options.maxTokens
      },
      statusHandler
    );
    
    // Generate the final response
    statusHandler?.('Sequential thinking complete, generating final response...');
    return this.streamChatCompletion(
      processedMessages[processedMessages.length - 1].content as string,
      processedMessages.slice(0, -1)
    );
  }
  
  /**
   * Run the sequential thinking process with provider-agnostic implementation
   * 
   * @param message User message
   * @param history Message history
   * @param mcpTools MCP tools in their original format
   * @param modelProvider The model provider to use
   * @param options Additional options like temperature and maxTokens
   * @param statusHandler Optional status update handler
   * @returns Processed messages with thinking steps
   */
  private async runSequentialThinking(
    message: string,
    history: ChatMessage[],
    mcpTools: AnthropicTool[],
    modelProvider: ModelType,
    options: {
      temperature?: number;
      maxTokens?: number;
    } = {},
    statusHandler?: (status: string) => void
  ): Promise<ChatMessage[]> {
    // Start with a safe cast to any for type compatibility
    const workingMessages: any[] = [
      ...this.formatMessageHistory(history, modelProvider),
      { role: 'user', content: message }
    ];
    
    // Get the tool adapter for this provider
    const toolAdapter = getToolCallAdapter(modelProvider);
    
    // Convert MCP tools to provider-specific format
    const providerTools = toolAdapter.convertToolDefinitions(mcpTools);
    
    // Add a sequential-thinking tool if not already present
    const hasSequentialThinkingTool = mcpTools.some(tool => 
      tool.name.includes('sequential-thinking'));
      
    // If we don't have a sequential thinking tool, we'll simulate one
    if (!hasSequentialThinkingTool) {
      statusHandler?.('Adding sequential thinking tool...');
      // In the future, add a standard sequential thinking tool implementation
    }
    
    // Flag to control the sequential thinking loop
    let isSequentialThinkingComplete = false;
    let thinkingSteps = 0;
    const MAX_THINKING_STEPS = 5; // Safety limit
    
    // Sequential thinking loop
    while (!isSequentialThinkingComplete && thinkingSteps < MAX_THINKING_STEPS) {
      thinkingSteps++;
      statusHandler?.(`Running thinking step ${thinkingSteps}...`);
      
      // Get the latest message to send to the LLM
      const latestMessage = workingMessages[workingMessages.length - 1].content as string;
      
      // Format history for the provider, excluding the latest message
      const formattedHistory = this.formatMessageHistory(
        workingMessages.slice(0, -1),
        modelProvider
      );
      
      // Get response from the LLM with tools
      console.log(`🔍 DEBUG-SEQUENTIAL-THINKING: Sending query to LLM at line ${new Error().stack?.split('\n')[1]?.match(/(\d+):\d+\)$/)?.[1] || 'unknown'}`);
      const response = await this.llmService.query({
        prompt: latestMessage,
        options: {
          temperature: options.temperature || 0.2,
          maxTokens: options.maxTokens || 4000,
          // Add tools and toolChoice for OpenAI - using 'auto' encourages the model to use tools when appropriate
          tools: providerTools,
          toolChoice: modelProvider === 'openai' ? 'auto' : undefined
        } as any, // Use type assertion to bypass type checking
        systemPrompt: this.buildSystemPromptWithContext(formattedHistory, providerTools)
      });
      
      // Extract tool calls using the adapter
      const toolCalls = toolAdapter.extractToolCalls(response.rawResponse);
      
      if (toolCalls.length === 0) {
        // No tool calls, so we're done with sequential thinking
        isSequentialThinkingComplete = true;
        statusHandler?.('No tool calls found, sequential thinking complete.');
        continue;
      }
      
      // Execute each tool and update conversation
      for (const toolCall of toolCalls) {
        statusHandler?.(`Executing tool: ${toolCall.name}...`);
        
        if (!this.mcpService) {
          throw new Error('MCPService not available. Tool execution is not possible.');
        }
        
        // Get the original tool name from the MCP service
        const originalToolName = this.mcpService.getOriginalToolName(toolCall.name);
        
        if (!originalToolName) {
          statusHandler?.(`Unknown tool: ${toolCall.name}, skipping.`);
          continue;
        }
        
        // Split into server and tool name
        const [serverName, toolName] = originalToolName.split(':');
        
        // Execute the tool call
        const toolResult = await this.mcpService.callTool(
          serverName,
          toolName,
          toolCall.input
        );
        
        // Add tool usage to conversation
        workingMessages.push({
          role: 'assistant',
          content: `Used tool: ${toolCall.name}\nArguments: ${JSON.stringify(toolCall.input)}`
        });
        
        // Process tool result
        if (toolResult && typeof toolResult === 'object' && 'content' in toolResult) {
          const textContent = Array.isArray(toolResult.content) 
            ? toolResult.content.find((item: any) => item.type === 'text')?.text 
            : toolResult.content;
          
          if (textContent) {
            workingMessages.push({
              role: 'user',
              content: textContent
            });
            
            // Check if this was sequential thinking tool
            if (toolCall.name.includes('sequential-thinking')) {
              try {
                const result = JSON.parse(typeof textContent === 'string' ? textContent : JSON.stringify(textContent));
                isSequentialThinkingComplete = !result.nextThoughtNeeded;
                statusHandler?.(`Sequential thinking status: ${isSequentialThinkingComplete ? 'Complete' : 'Continuing'}`);
              } catch (error) {
                console.error('Error parsing sequential thinking result:', error);
                isSequentialThinkingComplete = true;
                statusHandler?.('Error in sequential thinking, marking as complete.');
              }
            }
          }
        }
      }
    }
    
    // Add the original user message for the final response
    if (isSequentialThinkingComplete) {
      workingMessages.push({
        role: 'user',
        content: message
      });
    }
    
    statusHandler?.(`Sequential thinking completed in ${thinkingSteps} steps.`);
    return workingMessages as ChatMessage[];
  }
  
  /**
   * Execute a tool call using the MCP service
   * 
   * @param toolCall The tool call to execute
   * @returns The result of the tool execution
   */
  async executeToolCall(toolCall: ToolCall): Promise<ToolResult> {
    if (!this.mcpService) {
      throw new Error('MCPService not available. Tool execution is not possible.');
    }
    
    // Get the original tool name from the MCP service
    const originalToolName = this.mcpService.getOriginalToolName(toolCall.name);
    
    if (!originalToolName) {
      throw new Error(`Unknown tool: ${toolCall.name}`);
    }
    
    // Split into server and tool name
    const [serverName, toolName] = originalToolName.split(':');
    
    // Execute the tool call
    const result = await this.mcpService.callTool(
      serverName,
      toolName,
      toolCall.input
    );
    
    // Format the result for the tool
    return {
      toolCallId: toolCall.toolUseId || 'unknown-id',
      name: toolCall.name,
      content: result
    };
  }
  
  /**
   * Temporary implementation of streaming completion
   * This will be moved to the provider interfaces in later milestones
   */
  private async streamChatCompletion(
    message: string,
    history: any[]
  ): Promise<ReadableStream> {
    // Get the current provider to generate a provider-specific response
    const provider = this.llmService.getProvider();
    
    // Create a model-specific response for demonstration purposes
    const modelResponses = {
      'anthropic': `I'm Claude, an AI assistant by Anthropic, and I'm responding to your message: "${message}". In a full implementation, this would be a streaming response from the Claude API.`,
      'openai': `This is ChatGPT responding to your message: "${message}". In a complete implementation, this would be streaming from the OpenAI API.`,
      'gemini': `Gemini by Google here. You said: "${message}". In the final implementation, this would be a streaming response from the Gemini API.`,
      'ollama': `Ollama model responding to: "${message}". When fully implemented, this would stream from your local Ollama instance.`
    };
    
    const responseContent = modelResponses[provider as keyof typeof modelResponses] || 
      `Response from ${provider} to your message: "${message}"`;
    
    // Log which provider generated this response
    console.log(`📝 [CHAT-COMPLETION] Generating response for provider: ${provider.toUpperCase()}`);
    
    // Create a readable stream with the model-specific response
    return new ReadableStream({
      start(controller) {
        controller.enqueue(JSON.stringify({
          type: 'content',
          content: responseContent,
          id: crypto.randomUUID(),
          timestamp: new Date().toISOString()
        }) + '\n');
        
        // Close the stream to simulate completion
        controller.close();
      }
    });
  }
  
  /**
   * Temporary implementation of streaming completion with tools
   * This will be moved to the provider interfaces in later milestones
   */
  private async streamChatWithTools(
    message: string,
    history: any[],
    tools: any
  ): Promise<ReadableStream> {
    // Get the current provider to generate a provider-specific response
    const provider = this.llmService.getProvider();
    
    // Create a model-specific response for demonstration purposes
    const modelResponses = {
      'anthropic': `I'm Claude, and I see you're asking about: "${message}". I have access to ${Array.isArray(tools) ? tools.length : 'several'} tools to help you with this.`,
      'openai': `This is ChatGPT. You asked: "${message}". I have access to tools that can help me address your query more effectively.`,
      'gemini': `Gemini here. Regarding your message: "${message}", I can use various tools to provide a more helpful response.`,
      'ollama': `Ollama responding to: "${message}". Tool usage is limited but I'll do my best to help.`
    };
    
    const responseContent = modelResponses[provider as keyof typeof modelResponses] || 
      `Response from ${provider} to your message: "${message}" with tools support`;
    
    // Log which provider generated this response
    console.log(`🛠️ [CHAT-WITH-TOOLS] Generating tooled response for provider: ${provider.toUpperCase()}`);
    
    return new ReadableStream({
      start(controller) {
        controller.enqueue(JSON.stringify({
          type: 'content',
          content: responseContent,
          id: crypto.randomUUID(),
          timestamp: new Date().toISOString()
        }) + '\n');
        
        // Close the stream to simulate completion
        controller.close();
      }
    });
  }
  
  /**
   * Format chat history based on the provider's requirements
   * This handles provider-specific formatting requirements
   * 
   * @param history The chat history
   * @param providerType The provider type
   * @returns Formatted history for the provider
   */
  private formatMessageHistory(
    history: ChatMessage[],
    providerType: ModelType
  ): ProviderChatMessage[] {
    // Provider-specific message formatting
    switch (providerType) {
      case 'openai':
        // OpenAI separates system messages from user/assistant
        return history.map(msg => ({
          role: msg.role,
          content: msg.content
        }));
        
      case 'anthropic':
        // Anthropic has different content structure
        return history.map(msg => ({
          role: msg.role,
          content: msg.content
        }));
        
      case 'gemini':
        // Gemini uses a different structure with parts
        return history.map(msg => ({
          role: msg.role === 'system' ? 'user' : msg.role, // Gemini doesn't have system role
          content: msg.content
        }));
        
      case 'ollama':
        // Ollama is similar to OpenAI
        return history.map(msg => ({
          role: msg.role,
          content: msg.content
        }));
        
      default:
        // Default formatting
        return history.map(msg => ({
          role: msg.role,
          content: msg.content
        }));
    }
  }
  
  /**
   * Get the current provider type
   * @returns The current provider type
   */
  getCurrentProvider(): string {
    return this.llmService.getProvider();
  }
  
  /**
   * Process a chat with full artifact support
   * This combines all the previous functionality with artifact processing
   * 
   * @param message The user message
   * @param history Previous chat history
   * @param options Chat options including model provider, blocked servers, and pinned artifacts
   * @param statusHandler Optional callback for status updates
   * @returns A readable stream of the final response with artifacts
   */
  async processChatWithArtifacts(
    message: string,
    history: ChatMessage[],
    options: {
      modelProvider: ModelType;
      blockedServers?: string[];
      pinnedGraph?: any;
      temperature?: number;
      maxTokens?: number;
      pinnedArtifacts?: Array<{
        id: string;
        type: string;
        title: string;
        content: string;
      }>;
    },
    statusHandler?: (status: string) => void
  ): Promise<ReadableStream> {
    // Ensure we have an MCP service for tool execution
    if (!this.mcpService) {
      throw new Error('MCPService not available. Tool execution is not possible.');
    }
    
    // Notify status if handler provided
    statusHandler?.('Initializing chat with artifacts...');
    
    // Set the LLM provider
    this.llmService.setProvider({
      provider: options.modelProvider as any,
      temperature: options.temperature || 0.2,
      maxTokens: options.maxTokens || 4000
    });
    
    // Run sequential thinking to prepare the response
    statusHandler?.('Starting sequential thinking process...');
    const processedMessages = await this.runSequentialThinking(
      message,
      history,
      [],  // We'll retrieve the MCP tools inside the method
      options.modelProvider,  // Use the correct model provider from options
      options,
      statusHandler
    );
    
    // Get provider-specific response
    const provider = this.llmService.getProvider();
    
    // Create model-specific responses
    const modelResponses = {
      'anthropic': `I'm Claude by Anthropic. You asked: "${message}"\n\nHere's my response after considering your question carefully.`,
      'openai': `As ChatGPT, I've analyzed your message: "${message}"\n\nHere's what I've found...`,
      'gemini': `Gemini here. Regarding your inquiry: "${message}"\n\nI can provide the following information...`,
      'ollama': `Ollama model response to: "${message}"\n\nBased on my analysis...`
    };
    
    const responseContent = modelResponses[provider as keyof typeof modelResponses] || 
      `Response from ${provider} to your message: "${message}"`;
    
    // Create a base response to enhance with artifacts
    statusHandler?.('Preparing final response with artifacts...');
    const baseResponse: StoreFormat = {
      thinking: 'This is simulated thinking from the sequential thinking process',
      conversation: responseContent,
      artifacts: []
    };
    
    // Collect artifacts
    const collectedArtifacts = [];
    
    // Add pinned graph if provided
    if (options.pinnedGraph) {
      statusHandler?.('Adding pinned knowledge graph...');
      collectedArtifacts.push({
        type: 'application/vnd.knowledge-graph',
        title: options.pinnedGraph.title || 'Knowledge Graph',
        content: options.pinnedGraph.content
      });
    }
    
    // Add any other pinned artifacts
    if (options.pinnedArtifacts && options.pinnedArtifacts.length > 0) {
      statusHandler?.(`Adding ${options.pinnedArtifacts.length} pinned artifacts...`);
      for (const artifact of options.pinnedArtifacts) {
        collectedArtifacts.push({
          type: artifact.type,
          title: artifact.title,
          content: artifact.content
        });
      }
    }
    
    // Create a demo artifact if none were provided
    if (collectedArtifacts.length === 0) {
      statusHandler?.('Creating a demo artifact...');
      collectedArtifacts.push({
        type: 'text/markdown',
        title: `${provider.charAt(0).toUpperCase() + provider.slice(1)} Demo Artifact`,
        content: `# Response from ${provider.toUpperCase()}\n\nThis is a demonstration artifact generated for your message: "${message}"\n\nIn a full implementation, this would be generated by the LLM.`
      });
    }
    
    // Enhance the response with collected artifacts
    const enhancedResponse = this.messageService.enhanceResponseWithArtifacts(
      baseResponse,
      collectedArtifacts
    );
    
    // For now, use the placeholder streaming method
    statusHandler?.('Streaming final response...');
    return this.streamEnhancedResponse(enhancedResponse);
  }
  
  /**
   * Stream an enhanced response to the client
   * This is a temporary implementation that will be replaced with actual streaming
   * 
   * @param response The enhanced response to stream
   * @returns A readable stream of the response
   */
  private streamEnhancedResponse(response: StoreFormat): ReadableStream {
    // Log the response being streamed
    console.log(`🎨 [ENHANCED-RESPONSE] Streaming response with ${response.artifacts?.length || 0} artifacts`);
    
    // In a real implementation, we would stream the response chunks appropriately
    return new ReadableStream({
      start(controller) {
        // Send the main content first
        controller.enqueue(JSON.stringify({
          type: 'content',
          content: response.conversation || 'No content available',
          id: crypto.randomUUID(),
          timestamp: new Date().toISOString()
        }) + '\n');
        
        // Small delay to simulate streaming
        setTimeout(() => {
          // Send artifacts if available
          if (response.artifacts && response.artifacts.length > 0) {
            console.log(`📦 [ARTIFACTS] Streaming ${response.artifacts.length} artifacts`);
            
            for (const artifact of response.artifacts) {
              controller.enqueue(JSON.stringify({
                type: 'artifact',
                artifact: {
                  id: artifact.id,
                  type: artifact.type,
                  title: artifact.title,
                  content: artifact.content,
                  position: artifact.position,
                  language: artifact.language
                },
                id: crypto.randomUUID(),
                timestamp: new Date().toISOString()
              }) + '\n');
            }
          } else {
            console.log('📦 [ARTIFACTS] No artifacts to stream');
          }
          
          // Close the stream when done
          controller.close();
        }, 100); // Small delay for more realistic streaming
      }
    });
  }
} 