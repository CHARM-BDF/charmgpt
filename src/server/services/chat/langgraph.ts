/**
 * LangGraph Chat Service Implementation
 * 
 * This service provides a unified chat interface using LangGraph React agents
 * with MCP integration, replacing individual provider implementations.
 */

import { LangGraphProvider } from '../llm/providers/langgraph';
import { MCPService } from '../mcp';
import { MessageService, StoreFormat } from '../message';
import { ArtifactService } from '../artifact';
import { ReadableStream } from 'stream/web';
import { createMCPToolsForLangGraph } from './mcpToolBridge';

// Basic chat message type
interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

// Provider types
type ModelType = 'anthropic' | 'ollama' | 'openai' | 'gemini';

/**
 * LangGraph Chat Service implementation
 * Provides a unified interface for chat interactions using LangGraph React agents
 */
export class LangGraphChatService {
  /** LangGraph provider for agent interactions */
  private langGraphProvider: LangGraphProvider;
  /** MCP service for tool execution */
  private mcpService?: MCPService;
  /** Message service for response formatting */
  private messageService: MessageService;
  /** Artifact service for artifact processing */
  private artifactService: ArtifactService;
  /** Current provider type */
  private currentProvider: ModelType;
  
  /**
   * Create a new LangGraph Chat Service
   * @param mcpService Optional MCP service for tool execution
   * @param messageService Optional message service for response formatting
   * @param artifactService Optional artifact service for artifact processing
   */
  constructor(
    mcpService?: MCPService,
    messageService?: MessageService,
    artifactService?: ArtifactService
  ) {
    this.mcpService = mcpService;
    this.messageService = messageService || new MessageService();
    this.artifactService = artifactService || new ArtifactService();
    this.currentProvider = 'anthropic'; // Default provider
    
    // Initialize LangGraph provider with default settings
    this.langGraphProvider = new LangGraphProvider({
      provider: this.currentProvider,
      model: 'claude-3-5-sonnet-20241022',
      temperature: 0.7,
      maxTokens: 4000
    });
    
    console.log('LangGraphChatService: Initialization complete with React agent');
  }
  
  /**
   * Process a chat with LangGraph React agent
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
      pinnedGraph?: unknown;
      temperature?: number;
      maxTokens?: number;
    },
    statusHandler?: (status: string) => void
  ): Promise<StoreFormat> {
    statusHandler?.('Initializing LangGraph React agent...');
    
    // Switch provider if needed
    if (options.modelProvider !== this.currentProvider) {
      await this.switchProvider(options.modelProvider, {
        temperature: options.temperature,
        maxTokens: options.maxTokens
      });
    }
    
    // Get available MCP tools and pass them to LangGraph
    if (this.mcpService) {
      statusHandler?.('Loading MCP tools...');
      try {
        console.log('🔧 LangGraphChatService: Starting MCP tool bridge creation...');
        
        // First, let's see what tools are available from the MCP service
        const availableTools = await this.mcpService.getAllAvailableTools(options.blockedServers || []);
        console.log(`🔧 LangGraphChatService: MCP service returned ${availableTools.length} tools`);
        availableTools.forEach(tool => {
          console.log(`🔧 LangGraphChatService: Available tool: "${tool.name}" - ${tool.description}`);
        });
        
        // Create bridge tools that connect existing MCP service to LangGraph
        const bridgeTools = await createMCPToolsForLangGraph(this.mcpService, options.blockedServers || []);
        console.log(`🔧 LangGraphChatService: Created ${bridgeTools.length} bridge tools for LangGraph`);
        
        // Log each bridge tool
        bridgeTools.forEach(tool => {
          console.log(`🔧 LangGraphChatService: Bridge tool created: "${tool.name}" - ${tool.description}`);
        });
        
        // Update the LangGraph provider with the bridge tools
        if (bridgeTools.length > 0) {
          await this.langGraphProvider.updateAgentWithTools(bridgeTools);
          console.log('🔧 LangGraphChatService: Updated LangGraph agent with MCP tools');
        } else {
          console.warn('🔧 LangGraphChatService: No bridge tools created - agent will have no tools!');
        }
      } catch (error) {
        console.error('❌ LangGraphChatService: Error loading MCP tools:', error);
      }
    } else {
      console.warn('🔧 LangGraphChatService: No MCP service available - agent will have no tools!');
    }
    
    // Build conversation context
    statusHandler?.('Processing conversation with React agent...');
    const conversationHistory = history.map(msg => msg.content).join('\n');
    const fullPrompt = conversationHistory ? `${conversationHistory}\n\nUser: ${message}` : message;
    
    // Query the LangGraph React agent
    const response = await this.langGraphProvider.query(fullPrompt, {
      temperature: options.temperature || 0.7,
      maxTokens: options.maxTokens || 4000,
      maxIterations: 10, // Allow up to 10 tool calls
      systemPrompt: this.buildSystemPrompt(options.pinnedGraph)
    });
    
    // Format the response as StoreFormat
    statusHandler?.('Formatting response...');
    const storeFormat: StoreFormat = {
      conversation: response.content,
      artifacts: [] // LangGraph responses don't have artifacts by default
    };
    
    statusHandler?.('Chat processing complete');
    return storeFormat;
  }
  
  /**
   * Switch the underlying LLM provider
   * @param provider The new provider to use
   * @param options Additional options for the provider
   */
  async switchProvider(
    provider: ModelType, 
    options: { temperature?: number; maxTokens?: number } = {}
  ): Promise<void> {
    console.log(`LangGraphChatService: Switching to ${provider}`);
    
    await this.langGraphProvider.switchProvider(provider, {
      temperature: options.temperature || 0.7,
      maxTokens: options.maxTokens || 4000
    });
    
    this.currentProvider = provider;
    console.log(`LangGraphChatService: Successfully switched to ${provider}`);
  }
  
  /**
   * Get available tools from MCP servers
   * @returns Array of available tools
   */
  async getAvailableTools(): Promise<unknown[]> {
    return await this.langGraphProvider.getAvailableTools();
  }
  
  /**
   * Get available MCP tools from the MCP service
   * @param blockedServers Optional list of servers to exclude
   * @returns Array of available tools
   */
  async getAvailableMCPTools(blockedServers: string[] = []): Promise<unknown[]> {
    if (!this.mcpService) {
      return [];
    }
    
    try {
      return await this.mcpService.getAllAvailableTools(blockedServers);
    } catch (error) {
      console.error('LangGraphChatService: Error getting MCP tools:', error);
      return [];
    }
  }
  
  /**
   * Build system prompt with context
   * @param pinnedGraph Optional pinned graph context
   * @returns System prompt string
   */
  private buildSystemPrompt(pinnedGraph?: unknown): string {
    let systemPrompt = `You are a helpful AI assistant powered by a LangGraph React agent. You have access to various tools through MCP (Model Context Protocol) servers.

When you need to use tools:
1. Think step by step about what information you need
2. Use the appropriate tools to gather information
3. Synthesize the results into a helpful response

You can perform multiple tool calls in sequence to accomplish complex tasks.`;

    if (pinnedGraph) {
      systemPrompt += `\n\nYou have access to a pinned knowledge graph that contains relevant context for this conversation. Use this information to provide more informed responses.`;
    }

    return systemPrompt;
  }
  
  /**
   * Stream a chat response (for real-time updates)
   * @param message The user message
   * @param history Previous chat history
   * @param options Chat options
   * @returns ReadableStream of response chunks
   */
  async streamChat(
    message: string,
    history: ChatMessage[],
    options: {
      modelProvider: ModelType;
      blockedServers?: string[];
      temperature?: number;
      maxTokens?: number;
    }
  ): Promise<ReadableStream> {
    // For now, we'll process the full response and stream it
    // In the future, this could be enhanced with actual streaming from LangGraph
    const result = await this.processChat(message, history, options);
    
    return new ReadableStream({
      start(controller) {
        // Stream the response in chunks
        const content = JSON.stringify(result);
        const chunks = content.match(/.{1,100}/g) || [content];
        
        let index = 0;
        const interval = setInterval(() => {
          if (index < chunks.length) {
            controller.enqueue(new TextEncoder().encode(chunks[index]));
            index++;
          } else {
            clearInterval(interval);
            controller.close();
          }
        }, 50); // 50ms delay between chunks
      }
    });
  }
  
  /**
   * Get current provider information
   * @returns Current provider type
   */
  getCurrentProvider(): ModelType {
    return this.currentProvider;
  }
  
  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    await this.langGraphProvider.cleanup();
  }
} 