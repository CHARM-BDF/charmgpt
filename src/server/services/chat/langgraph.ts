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
    
    // Format the response as StoreFormat and extract artifacts
    statusHandler?.('Formatting response...');
    
    // Extract artifacts from tool execution results in the conversation
    const artifacts: any[] = [];
    let conversationContent = response.content;
    
    // Check if there are tool execution results that contain artifacts
    if (response.rawResponse && response.rawResponse.messages) {
      console.log('🎨 LangGraphChatService: Processing messages for artifacts...');
      
      response.rawResponse.messages.forEach((msg: any, index: number) => {
        console.log(`🎨 LangGraphChatService: Message ${index} type: ${msg.constructor.name}`);
        
        // Look for ToolMessage responses that might contain artifacts
        if (msg.constructor.name === 'ToolMessage' && msg.content) {
          console.log(`🎨 LangGraphChatService: Found ToolMessage content:`, JSON.stringify(msg.content, null, 2));
          
          try {
            // Parse the tool result if it's a string
            let toolResult = msg.content;
            if (typeof msg.content === 'string') {
              try {
                toolResult = JSON.parse(msg.content);
              } catch {
                // Not JSON, keep as string
              }
            }
            
                         // Check if the tool result has artifacts or binary outputs
             if (toolResult && typeof toolResult === 'object') {
               console.log('🎨 LangGraphChatService: Checking tool result for artifacts...');
               console.log('🎨 LangGraphChatService: Tool result keys:', Object.keys(toolResult));
               
               // Look for binary outputs or file references
               if (toolResult.binaryOutput) {
                 console.log('🎨 LangGraphChatService: Found binary output in tool result');
                 const artifactId = `artifact_${Date.now()}_${artifacts.length}`;
                 artifacts.push({
                   id: artifactId,
                   artifactId: artifactId,
                   type: toolResult.binaryOutput.type || 'image/png',
                   title: toolResult.binaryOutput.title || 'Generated Output',
                   content: toolResult.binaryOutput.data,
                   position: artifacts.length
                 });
               }
               
               // Check for artifacts in the tool result
               if (toolResult.artifacts && Array.isArray(toolResult.artifacts)) {
                 console.log('🎨 LangGraphChatService: Found artifacts array in tool result:', toolResult.artifacts.length);
                 
                 toolResult.artifacts.forEach((artifact: any, artifactIndex: number) => {
                   console.log(`🎨 LangGraphChatService: Processing artifact ${artifactIndex}:`);
                   console.log(`🎨 LangGraphChatService: Artifact keys:`, Object.keys(artifact));
                   console.log(`🎨 LangGraphChatService: Artifact type:`, artifact.type);
                   console.log(`🎨 LangGraphChatService: Has data field:`, 'data' in artifact);
                   console.log(`🎨 LangGraphChatService: Data field type:`, typeof artifact.data);
                   console.log(`🎨 LangGraphChatService: Data field length:`, artifact.data?.length);
                   console.log(`🎨 LangGraphChatService: Filename:`, artifact.metadata?.filename);
                   
                   // Check if data exists in any form
                   const dataContent = artifact.data || artifact.content || artifact.base64 || artifact.binary;
                   
                   if (dataContent) {
                     const artifactId = `artifact_${Date.now()}_${artifacts.length}`;
                     artifacts.push({
                       id: artifactId,
                       artifactId: artifactId,
                       type: artifact.type || 'image/png',
                       title: artifact.metadata?.filename || `Generated Output ${artifactIndex + 1}`,
                       content: dataContent,
                       position: artifacts.length,
                       metadata: artifact.metadata
                     });
                     console.log('🎨 LangGraphChatService: Added artifact:', artifactId);
                   } else {
                     console.log('🎨 LangGraphChatService: No data content found in artifact');
                   }
                 });
               }
               
               // Check if metadata indicates binary output but it's stored elsewhere
               if (toolResult.metadata && toolResult.metadata.hasBinaryOutput && !toolResult.binaryOutput && !toolResult.artifacts) {
                 console.log('🎨 LangGraphChatService: Metadata indicates binary output, looking for data...');
                 
                 // Check if binary data is in a different field
                 if (toolResult.data || toolResult.output || toolResult.result) {
                   const binaryData = toolResult.data || toolResult.output || toolResult.result;
                   console.log('🎨 LangGraphChatService: Found binary data in alternate field');
                   
                   const artifactId = `artifact_${Date.now()}_${artifacts.length}`;
                   artifacts.push({
                     id: artifactId,
                     artifactId: artifactId,
                     type: toolResult.metadata.binaryType || 'image/png',
                     title: 'Generated Plot',
                     content: binaryData,
                     position: artifacts.length
                   });
                   console.log('🎨 LangGraphChatService: Added artifact from binary data:', artifactId);
                 } else {
                   console.log('🎨 LangGraphChatService: Binary output indicated but no data found in expected fields');
                   console.log('🎨 LangGraphChatService: Available fields:', Object.keys(toolResult));
                 }
               }
               
               // Check metadata for file outputs
               if (toolResult.metadata && typeof toolResult.metadata === 'object') {
                 console.log('🎨 LangGraphChatService: Found metadata:', JSON.stringify(toolResult.metadata, null, 2));
                 
                 // Look for file outputs in metadata
                 if (toolResult.metadata.files || toolResult.metadata.outputs) {
                   const files = toolResult.metadata.files || toolResult.metadata.outputs;
                   console.log('🎨 LangGraphChatService: Found files in metadata:', files);
                   
                   if (Array.isArray(files)) {
                     files.forEach((file: any, fileIndex: number) => {
                       if (file.path && file.data) {
                         const artifactId = `artifact_${Date.now()}_${artifacts.length}`;
                         artifacts.push({
                           id: artifactId,
                           artifactId: artifactId,
                           type: file.type || 'image/png',
                           title: file.name || `Generated File ${fileIndex + 1}`,
                           content: file.data,
                           position: artifacts.length
                         });
                         console.log('🎨 LangGraphChatService: Added artifact from metadata file:', artifactId);
                       }
                     });
                   }
                 }
               }
               
               // Look for file outputs in the content
               if (toolResult.content && Array.isArray(toolResult.content)) {
                 toolResult.content.forEach((item: any) => {
                   if (item.type === 'text' && item.text) {
                     // Check if the text mentions file outputs
                     const fileMatches = item.text.match(/Saved (\w+) to: (.+)/g);
                     if (fileMatches) {
                       console.log('🎨 LangGraphChatService: Found file output references:', fileMatches);
                       // We would need to read the actual files here
                       // For now, just log that we found file references
                     }
                   }
                   
                   // Check if the item itself is a file/artifact
                   if (item.type === 'image' || item.type === 'file') {
                     console.log('🎨 LangGraphChatService: Found file/image item in content:', item);
                     const artifactId = `artifact_${Date.now()}_${artifacts.length}`;
                     artifacts.push({
                       id: artifactId,
                       artifactId: artifactId,
                       type: item.mimeType || item.type || 'image/png',
                       title: item.name || item.title || 'Generated Output',
                       content: item.data || item.content,
                       position: artifacts.length
                     });
                     console.log('🎨 LangGraphChatService: Added artifact from content item:', artifactId);
                   }
                 });
               }
             }
          } catch (error) {
            console.error('🎨 LangGraphChatService: Error processing tool result for artifacts:', error);
          }
        }
      });
    }
    
    const storeFormat: StoreFormat = {
      conversation: conversationContent,
      artifacts: artifacts.length > 0 ? artifacts : undefined
    };
    
    console.log(`🎨 LangGraphChatService: Final response - conversation length: ${conversationContent.length}, artifacts: ${artifacts.length}`);
    
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

You can perform multiple tool calls in sequence to accomplish complex tasks.

IMPORTANT: When using Python for plotting or generating visual content:
- NEVER use plt.show() as it doesn't work in this environment
- ALWAYS save plots to files using plt.savefig()
- ALWAYS use os.environ['OUTPUT_DIR'] for file paths
- Example: plt.savefig(os.path.join(os.environ['OUTPUT_DIR'], 'plot.png'))
- The system will automatically detect and display saved files as artifacts`;

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