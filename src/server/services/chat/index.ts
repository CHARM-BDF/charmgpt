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
import { isValidKnowledgeGraph, mergeKnowledgeGraphs, KnowledgeGraph } from '../../../utils/knowledgeGraphUtils';
import { systemPrompt } from './systemPrompt';
import { toolCallingSystemPrompt } from './systemPrompt_tools';

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

// Extended chat message with metadata for artifact storage
interface EnhancedChatMessage extends ChatMessage {
  bibliography?: any[];
  knowledgeGraph?: KnowledgeGraph;
  directArtifacts?: any[];
  binaryOutputs?: any[];
  grantMarkdown?: string;
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
    console.log('ChatService: Initialization complete with enhanced artifact handling');
  }
  
  /**
   * Process a chat with full artifact support
   * This method processes a chat message with sequential thinking and returns a structured response
   * 
   * @param message The user message
   * @param history Previous chat history
   * @param options Chat options including model provider, blocked servers, and pinned artifacts
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
    
    // Track tool executions
    const toolExecutions: Array<{name: string; description: string}> = [];
    
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
      statusHandler,
      toolExecutions // Pass toolExecutions array to track usage
    );
    
    // Get the appropriate response formatter adapter
    const formatterAdapter = getResponseFormatterAdapter(options.modelProvider as FormatterAdapterType);
    const formatterToolDefinition = formatterAdapter.getResponseFormatterToolDefinition();
    
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
    
    // Create structured prompt for formatter using sequential thinking data
    const structuredPrompt = this.formatSequentialThinkingData(
      message, // Original query
      processedHistory, // All processed messages
      toolExecutions // Tool execution history
    );
    
    // Build the system prompt for formatter
    const formatterSystemPrompt = this.buildSystemPromptWithContext(formattedHistory, [formatterToolDefinition], toolChoice);
    
    // Log detailed information about what's being sent to the formatter LLM
    console.log(`🔍 [FORMATTER INPUT] === BEGIN FORMATTER INPUT LOG ===`);
    console.log(`🔍 [FORMATTER INPUT] Provider: ${options.modelProvider}`);
    console.log(`🔍 [FORMATTER INPUT] Tool Choice: ${JSON.stringify(toolChoice)}`);
    console.log(`🔍 [FORMATTER INPUT] Structured Prompt: ${structuredPrompt.substring(0, 1000)}${structuredPrompt.length > 1000 ? '...' : ''}`);
    console.log(`🔍 [FORMATTER INPUT] System Prompt: ${formatterSystemPrompt.substring(0, 1000)}${formatterSystemPrompt.length > 1000 ? '...' : ''}`);
    console.log(`🔍 [FORMATTER INPUT] === END FORMATTER INPUT LOG ===`);
    
    // Get the LLM response with formatter
    statusHandler?.(`Getting formatted response from ${options.modelProvider}...`);
    const llmResponse = await this.llmService.query({
      prompt: structuredPrompt, // Use structured prompt instead of just latestMessage
      options: {
        temperature: options.temperature || 0.2,
        maxTokens: options.maxTokens || 4000,
        toolChoice: toolChoice as any,
        tools: [formatterToolDefinition]
      } as any,
      systemPrompt: formatterSystemPrompt
    });
    
    // Log the response
    console.log(`🔍 DEBUG-CHAT-SERVICE: Received raw response from LLM service`);
    console.log(`🔍 DEBUG-CHAT-SERVICE: Response has tool calls:`, 
      llmResponse.rawResponse?.choices?.[0]?.message?.tool_calls ? 'Yes' : 'No');
    
    // Extract the formatter output using the adapter
    statusHandler?.('Processing formatter output...');
    const formatterOutput = formatterAdapter.extractFormatterOutput(llmResponse.rawResponse);
    
    // Log the extracted formatter output
    console.log(`🔍 [FORMATTER OUTPUT] === BEGIN FORMATTER OUTPUT LOG ===`);
    console.log(`🔍 [FORMATTER OUTPUT] Raw formatter output:`, JSON.stringify(formatterOutput, null, 2));
    console.log(`🔍 [FORMATTER-RESPONSE] Output: ${JSON.stringify(formatterOutput)}`);
    console.log(`🔍 [FORMATTER OUTPUT] === END FORMATTER OUTPUT LOG ===`);
    
    let storeFormat = formatterAdapter.convertToStoreFormat(formatterOutput);
    
    // ===== ARTIFACT COLLECTION PHASE =====
    // This mirrors the artifact collection approach from chat.ts
    statusHandler?.('Collecting artifacts from tool results...');
    console.log(`🔍 ARTIFACT-COLLECTION: Beginning unified artifact collection phase`);
    
    // Initialize artifacts collection array
    let artifactsToAdd = [];
    
    // Add any pinned graph if provided in options
    if (options.pinnedGraph) {
      console.log(`🔍 ARTIFACT-COLLECTION: Adding pinned graph from options`);
      artifactsToAdd.push(options.pinnedGraph);
    }
    
    // Handle bibliography if present in processed history
    if ((processedHistory as any).bibliography) {
      console.log(`🔍 ARTIFACT-COLLECTION: Found bibliography with ${(processedHistory as any).bibliography.length} entries`);
      artifactsToAdd.push({
        type: 'application/vnd.bibliography',
        title: 'Bibliography',
        content: (processedHistory as any).bibliography
      });
    }
    
    // Handle knowledge graph if present
    if ((processedHistory as any).knowledgeGraph) {
      console.log(`🔍 ARTIFACT-COLLECTION: Found knowledge graph`);
      artifactsToAdd.push({
        type: 'application/vnd.knowledge-graph',
        title: 'Knowledge Graph',
        content: (processedHistory as any).knowledgeGraph
      });
    }
    
    // Handle direct artifacts if present
    if ((processedHistory as any).directArtifacts) {
      console.log(`🔍 ARTIFACT-COLLECTION: Processing ${(processedHistory as any).directArtifacts.length} direct artifacts`);
      
      for (const artifact of (processedHistory as any).directArtifacts) {
        console.log(`🔍 ARTIFACT-COLLECTION: Adding direct artifact of type: ${artifact.type}`);
        artifactsToAdd.push(artifact);
      }
    }
    
    // Handle binary outputs if present
    if ((processedHistory as any).binaryOutputs) {
      console.log(`🔍 ARTIFACT-COLLECTION: Processing ${(processedHistory as any).binaryOutputs.length} binary outputs`);
      
      for (const binaryOutput of (processedHistory as any).binaryOutputs) {
        // Use artifact service to process binary outputs
        const processedArtifacts = this.artifactService.processBinaryOutput(binaryOutput, 0);
        console.log(`🔍 ARTIFACT-COLLECTION: Processed ${processedArtifacts.length} artifacts from binary output`);
        
        // Add each processed artifact to the collection
        for (const artifact of processedArtifacts) {
          artifactsToAdd.push({
            type: artifact.type,
            title: artifact.title,
            content: artifact.content,
            language: artifact.language
          });
        }
      }
    }
    
    // Handle grant markdown if present
    if ((processedHistory as any).grantMarkdown) {
      console.log(`🔍 ARTIFACT-COLLECTION: Found grant markdown data`);
      artifactsToAdd.push({
        type: 'text/markdown',
        title: 'Grant Proposal',
        content: (processedHistory as any).grantMarkdown,
        language: 'markdown'
      });
    }
    
    // Apply all artifacts to the response
    if (artifactsToAdd.length > 0) {
      console.log(`🔍 ARTIFACT-COLLECTION: Enhancing response with ${artifactsToAdd.length} artifacts`);
      storeFormat = this.messageService.enhanceResponseWithArtifacts(
        storeFormat,
        artifactsToAdd
      );
    } else {
      console.log(`🔍 ARTIFACT-COLLECTION: No artifacts to add to response`);
    }
    
    // Log the final store format that will be returned
    console.log(`🔍 [STORE FORMAT] === BEGIN STORE FORMAT LOG ===`);
    console.log(`🔍 [STORE FORMAT] Final store format conversation:`, typeof storeFormat.conversation === 'string' 
      ? storeFormat.conversation.substring(0, 500) + (storeFormat.conversation.length > 500 ? '...' : '')
      : JSON.stringify(storeFormat.conversation).substring(0, 500) + '...');
    console.log(`🔍 [STORE FORMAT] Artifacts count:`, storeFormat.artifacts ? storeFormat.artifacts.length : 0);
    if (storeFormat.artifacts && storeFormat.artifacts.length > 0) {
      storeFormat.artifacts.forEach((artifact, index) => {
        console.log(`🔍 [STORE FORMAT] Artifact #${index+1} type:`, artifact.type);
        console.log(`🔍 [STORE FORMAT] Artifact #${index+1} title:`, artifact.title);
      });
    }
    console.log(`🔍 [STORE FORMAT] === END STORE FORMAT LOG ===`);
    
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
    // Use the toolCallingSystemPrompt for the tool-calling phase
    let updatedSystemPrompt = toolCallingSystemPrompt;

    // Add message history
    if (history.length > 0) {
      updatedSystemPrompt += '\n\n# Conversation History\n\n';
      history.forEach(msg => {
        updatedSystemPrompt += `${msg.role.toUpperCase()}: ${
          typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)
        }\n\n`;
      });
    }

    // Add tools if provided
    if (tools.length > 0) {
      updatedSystemPrompt += '\n\n# Available Tools\n\n';
      updatedSystemPrompt += 'You have access to the following tools. USE THESE TOOLS WHEN APPROPRIATE to provide the best response.\n';
      updatedSystemPrompt += 'IMPORTANT: When users ask you to perform searches, retrieve data, or access external information, you MUST use the appropriate tool rather than making up a response.\n';
      updatedSystemPrompt += 'For example:\n';
      updatedSystemPrompt += '- If asked about PubMed or academic papers, use the pubmed-search tool\n';
      updatedSystemPrompt += '- If asked to create visualizations, use the appropriate visualization tool\n';
      updatedSystemPrompt += '- If asked about proteins or genes, use the appropriate biology tools\n\n';
      
      // Find tools with description to showcase
      let describedTools = 0;
      const MAX_TOOL_DESCRIPTIONS = 15; // Limit number of tools to describe
      
      tools.forEach(tool => {
        // Get tool name and description based on format
        const toolName = tool.function?.name || tool.name || 'unknown';
        const toolDescription = tool.function?.description || tool.description || 'No description provided';
        
        // Prioritize describing important tools first
        const isPriorityTool = toolName.includes('pubmed') || 
                              toolName.includes('python') ||
                              toolName.includes('graph');
                              
        if (isPriorityTool || describedTools < MAX_TOOL_DESCRIPTIONS) {
          updatedSystemPrompt += `Tool: ${toolName}\n`;
          updatedSystemPrompt += `Description: ${toolDescription}\n\n`;
          describedTools++;
        }
      });
      
      // If there are more tools than we've described, mention that
      if (describedTools < tools.length) {
        updatedSystemPrompt += `... and ${tools.length - describedTools} more tools available.\n\n`;
      }
      
      // Add tool choice if specified
      if (toolChoice) {
        updatedSystemPrompt += `# Required Action\n\nYou MUST use the ${toolChoice.name} tool to format your response. Do not respond directly with text, only use the ${toolChoice.name} tool.\n`;
      }
    }
    
    // Use the systemPrompt for the formatting phase
    if (toolChoice?.name === 'response_formatter') {
      updatedSystemPrompt = systemPrompt;
    }
    
    return updatedSystemPrompt;
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
    
    // Convert MCP tools to provider-specific format
    const providerTools = toolAdapter.convertToolDefinitions(mcpTools);
    
    // Add detailed logging for tools
    console.log(`🔎 TOOLS-DEBUG: Received ${mcpTools.length} MCP tools`);
    
    // Check if pubmed-search tool is present
    const hasPubmedTool = mcpTools.some(tool => tool.name.includes('pubmed-search'));
    console.log(`🔎 TOOLS-DEBUG: PubMed search tool present: ${hasPubmedTool}`);
    
    // Log the number of provider tools after conversion
    console.log(`🔎 TOOLS-DEBUG: Converted to ${providerTools.length} provider tools`);
    
    // Log tool names for debugging
    const toolNames = mcpTools.map(tool => tool.name).slice(0, 5);
    console.log(`🔎 TOOLS-DEBUG: First 5 tool names: ${toolNames.join(', ')}`);
    
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
    statusHandler?: (status: string) => void,
    toolExecutions: Array<{name: string; description: string}> = []
  ): Promise<any[]> {
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
      console.log(`🔍 DEBUG-SEQUENTIAL-THINKING: Sending query to LLM at line 673`);
      console.log(`🔎 TOOLS-DEBUG: Sending ${providerTools.length} tools to sequential thinking query`);
      console.log(`🔍 [TOOL-CALLER-INPUT] Query: ${latestMessage}`);
      
      // Print the toolChoice parameter
      const toolChoiceValue = modelProvider === 'openai' ? 'auto' : undefined;
      console.log(`🔎 TOOLS-DEBUG: Using toolChoice: ${JSON.stringify(toolChoiceValue)}`);
      
      // Log if we're including a PubMed tool
      const includesPubmed = providerTools.some((tool: any) => 
        typeof tool === 'object' && 
        ((tool.function?.name && tool.function.name.includes('pubmed')) || 
         (tool.name && tool.name.includes('pubmed')))
      );
      console.log(`🔎 TOOLS-DEBUG: Provider tools includes PubMed: ${includesPubmed}`);
      
      // Generate system prompt
      const systemPrompt = this.buildSystemPromptWithContext(formattedHistory, providerTools);
      
      // Log first 500 chars of system prompt
      console.log(`🔎 TOOLS-DEBUG: System prompt start: ${systemPrompt.substring(0, 500)}...`);
      
      // Inside runSequentialThinking method, before the LLM query
      console.log(`🔍 [TOOL-CALLER-INPUT] Sending to tool caller:`, JSON.stringify({
        message: latestMessage,
        tools: providerTools.map((tool: { function?: { name?: string; description?: string }; name?: string; description?: string }) => ({
          name: tool.function?.name || tool.name,
          description: tool.function?.description || tool.description
        }))
      }));
      
      const response = await this.llmService.query({
        prompt: latestMessage,
        options: {
          temperature: options.temperature || 0.2,
          maxTokens: options.maxTokens || 4000,
          // Add tools and toolChoice for OpenAI - using 'auto' encourages the model to use tools when appropriate
          tools: providerTools,
          toolChoice: toolChoiceValue
        } as any, // Use type assertion to bypass type checking
        systemPrompt: systemPrompt
      });
      
      // After the LLM response
      console.log(`🔍 [TOOL-CALLER-RESPONSE] Received from tool caller:`, JSON.stringify(response.rawResponse));
      
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
        
        console.log(`🔍 TOOL-EXECUTION: Executing tool ${toolCall.name} (${serverName}:${toolName})`);
        console.log(`🔍 TOOL-EXECUTION: Input: ${JSON.stringify(toolCall.input)}`);
        console.log(`🔍 [MCP-REQUEST] Server: ${serverName}, Tool: ${toolName}, Input: ${JSON.stringify(toolCall.input)}`);
        
        // Track tool execution
        toolExecutions.push({
          name: toolCall.name,
          description: `Used ${toolName} on ${serverName} server with input: ${JSON.stringify(toolCall.input)}`
        });
        
        // Execute the tool call
        const toolResult = await this.mcpService.callTool(
          serverName,
          toolName,
          toolCall.input
        );
        
        // Log detailed information about the tool result
        console.log(`🔍 TOOL-EXECUTION: Raw result received from tool: ${JSON.stringify(toolResult, null, 2).substring(0, 1000)}...`);
        console.log(`🔍 TOOL-EXECUTION: Result type: ${typeof toolResult}`);
        console.log(`🔍 [MCP-RESPONSE] Result: ${JSON.stringify(toolResult)}`);
        
        if (toolResult && typeof toolResult === 'object') {
          console.log(`🔍 TOOL-EXECUTION: Result has 'content' property: ${Object.hasOwnProperty.call(toolResult, 'content')}`);
          
          if ('content' in toolResult) {
            console.log(`🔍 TOOL-EXECUTION: Content type: ${typeof toolResult.content}`);
          }
        }
        
        // Add tool usage to conversation
        console.log(`🔍 TOOL-EXECUTION: Adding tool usage to conversation: ${toolCall.name}`);
        workingMessages.push({
          role: 'assistant',
          content: `Used tool: ${toolCall.name}\nArguments: ${JSON.stringify(toolCall.input)}`
        });
        
        // Process tool result based on chat.ts implementation
        if (toolResult && typeof toolResult === 'object') {
          // Handle text content for conversation
          if ('content' in toolResult) {
            const textContent = Array.isArray(toolResult.content) 
              ? toolResult.content.find((item: any) => item.type === 'text')?.text 
              : toolResult.content;
            
            if (textContent) {
              console.log(`🔍 TOOL-EXECUTION: Adding text content to conversation`);
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
            } else {
              console.log(`🔍 TOOL-EXECUTION: No text content found in tool result`);
            }
          }
          
          // Handle bibliography if present
          // if ('bibliography' in toolResult && toolResult.bibliography) {
          //   console.log(`🔍 TOOL-EXECUTION: Bibliography data found in tool result`);
            
          //   // Initialize bibliography array if it doesn't exist
          //   if (!(workingMessages as any).bibliography) {
          //     (workingMessages as any).bibliography = [];
          //     console.log(`🔍 TOOL-EXECUTION: Initialized bibliography array`);
          //   }
            
          //   // Merge and deduplicate bibliography entries based on PMID
          //   const currentBibliography = (workingMessages as any).bibliography;
          //   const newBibliography = toolResult.bibliography as any[];
            
          //   // Create a map of existing PMIDs
          //   const existingPmids = new Set(currentBibliography.map((entry: any) => entry.pmid));
            
          //   // Only add entries with new PMIDs
          //   const uniqueNewEntries = newBibliography.filter((entry: any) => !existingPmids.has(entry.pmid));
            
          //   // Merge unique new entries with existing bibliography
          //   (workingMessages as any).bibliography = [...currentBibliography, ...uniqueNewEntries];
          //   console.log(`🔍 TOOL-EXECUTION: Added ${uniqueNewEntries.length} new bibliography entries`);
          // }
          
          // Handle knowledge graph artifacts if present
          if ('artifacts' in toolResult && Array.isArray(toolResult.artifacts)) {
            console.log(`🔍 TOOL-EXECUTION: Found artifacts array in tool result with ${toolResult.artifacts.length} items`);
            
            // Check for knowledge graph artifacts
            const knowledgeGraphArtifact = toolResult.artifacts.find((a: any) => 
              a.type === 'application/vnd.knowledge-graph' && typeof a.content === 'string'
            );
            
            if (knowledgeGraphArtifact) {
              console.log(`🔍 TOOL-EXECUTION: Found knowledge graph artifact: ${knowledgeGraphArtifact.title || 'untitled'}`);
              
              try {
                // Parse the knowledge graph content
                const newGraph = JSON.parse(knowledgeGraphArtifact.content);
                
                // Check if knowledge graph exists and merge if it does
                if ((workingMessages as any).knowledgeGraph) {
                  console.log(`🔍 TOOL-EXECUTION: Merging with existing knowledge graph`);
                  
                  // Use utility function if available or simple assignment
                  if (typeof mergeKnowledgeGraphs === 'function') {
                    (workingMessages as any).knowledgeGraph = mergeKnowledgeGraphs(
                      (workingMessages as any).knowledgeGraph, 
                      newGraph
                    );
                  } else {
                    // Simple merge logic (placeholder)
                    (workingMessages as any).knowledgeGraph = {
                      nodes: [...(workingMessages as any).knowledgeGraph.nodes, ...newGraph.nodes],
                      links: [...(workingMessages as any).knowledgeGraph.links, ...newGraph.links]
                    };
                  }
                } else {
                  // First knowledge graph, just set it
                  console.log(`🔍 TOOL-EXECUTION: Setting initial knowledge graph`);
                  (workingMessages as any).knowledgeGraph = newGraph;
                }
              } catch (error) {
                console.error('Error processing knowledge graph:', error);
              }
            }
            
            // Store all artifacts for later processing
            if (!(workingMessages as any).directArtifacts) {
              (workingMessages as any).directArtifacts = [];
            }
            
            for (const artifact of toolResult.artifacts) {
              console.log(`🔍 TOOL-EXECUTION: Storing artifact of type ${artifact.type}: ${artifact.title || 'untitled'}`);
              (workingMessages as any).directArtifacts.push(artifact);
            }
          }
          
          // Handle binary output if present
          if ('binaryOutput' in toolResult && toolResult.binaryOutput) {
            console.log(`🔍 TOOL-EXECUTION: Found binary output in tool result`);
            
            // Initialize binaryOutputs array if it doesn't exist
            if (!(workingMessages as any).binaryOutputs) {
              (workingMessages as any).binaryOutputs = [];
            }
            
            // Add binary output to the collection
            (workingMessages as any).binaryOutputs.push(toolResult.binaryOutput);
          }
          
          // Handle grant markdown if present
          if ('grantMarkdown' in toolResult && toolResult.grantMarkdown) {
            console.log(`🔍 TOOL-EXECUTION: Found grant markdown in tool result`);
            (workingMessages as any).grantMarkdown = toolResult.grantMarkdown;
          }
        } else {
          console.log(`🔍 TOOL-EXECUTION: Tool result not in expected format, unable to process fully`);
        }
      }
    }
    
    // Add the original user message for the final response
    if (isSequentialThinkingComplete) {
      console.log(`🔍 SEQUENTIAL-THINKING: Adding original message to working messages for final response: "${message}"`);
      workingMessages.push({
        role: 'user',
        content: message
      });
    }
    
    console.log(`🔍 SEQUENTIAL-THINKING: Final working messages: ${workingMessages.length} messages`);
    console.log(`🔍 SEQUENTIAL-THINKING: Message roles: ${workingMessages.map(msg => msg.role).join(', ')}`);
    console.log(`🔍 SEQUENTIAL-THINKING: Additional data collected:`, JSON.stringify({
      hasBibliography: !!(workingMessages as any).bibliography,
      bibliographyEntries: (workingMessages as any).bibliography?.length || 0,
      hasKnowledgeGraph: !!(workingMessages as any).knowledgeGraph,
      hasDirectArtifacts: !!(workingMessages as any).directArtifacts,
      directArtifactsCount: (workingMessages as any).directArtifacts?.length || 0,
      hasBinaryOutputs: !!(workingMessages as any).binaryOutputs,
      binaryOutputsCount: (workingMessages as any).binaryOutputs?.length || 0,
      hasGrantMarkdown: !!(workingMessages as any).grantMarkdown
    }));
    
    statusHandler?.(`Sequential thinking completed in ${thinkingSteps} steps.`);
    return workingMessages;
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
        content: `# Response from ${provider.toUpperCase()}\n\nThis is a demonstration artifact generated for your message: "${message}"\n\nIn a full implementation, this would be generated by the LLM.`      });
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

  /**
   * Format sequential thinking data into a structured prompt for the formatter
   */
  private formatSequentialThinkingData(
    originalQuery: string,
    processedMessages: any[],
    toolExecutions: any[] = []
  ): string {
    let prompt = `<SYSTEM>
You are an AI assistant tasked with creating comprehensive, accurate responses based on information gathered through tools. The information below has already been collected in response to the user's query. Your job is to synthesize this information into a helpful response.
</SYSTEM>

<ORIGINAL_QUERY>
${originalQuery}
</ORIGINAL_QUERY>

<TOOL_EXECUTION_SUMMARY>
The following tools were executed to gather information:
${toolExecutions.map((tool, index) => `${index + 1}. ${tool.name}: ${tool.description}`).join('\n')}
</TOOL_EXECUTION_SUMMARY>

<GATHERED_DATA>
${processedMessages.filter(msg => msg.role === 'user' && msg.content !== originalQuery)
  .map(msg => msg.content)
  .join('\n\n')}
</GATHERED_DATA>`;

  // Add bibliography if present
  if ((processedMessages as any).bibliography) {
    prompt += `\n\n<BIBLIOGRAPHY>\n${JSON.stringify((processedMessages as any).bibliography, null, 2)}\n</BIBLIOGRAPHY>`;
  }

  prompt += `\n\n<RESPONSE_REQUIREMENTS>
1. Provide a concise summary of the gathered information
2. Highlight key findings or innovations
3. Identify common themes or connections
4. Format your response in clear, readable sections
5. THIS INFORMATION IS NEW TO THE USER - they have not seen this data yet
</RESPONSE_REQUIREMENTS>

<STATE_INFORMATION>
- Data gathering phase: COMPLETE
- Information presented to user: NONE
- Response type needed: FULL SUMMARY OF FINDINGS
</STATE_INFORMATION>`;

  return prompt;
}
} 
