/**
 * Chat Service Implementation
 * 
 * This file implements the main Chat Service that provides a unified interface
 * for interacting with different LLM providers.
 */

import { LLMService } from '../llm';
import { ReadableStream } from 'stream/web';

// Importing types
type ModelType = 'anthropic' | 'ollama' | 'openai' | 'gemini';

// Basic chat message type
interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string | any[];
}

/**
 * Main Chat Service implementation
 * Provides a unified interface for chat interactions across different LLM providers
 */
export class ChatService {
  /** LLM service for provider interactions */
  private llmService: LLMService;
  
  /**
   * Create a new Chat Service
   * @param llmService The LLM service to use for provider interactions
   */
  constructor(llmService: LLMService) {
    this.llmService = llmService;
    console.log('ChatService: Initialization complete');
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
    console.log(`ChatService: Using provider ${providerName}`);
    
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
   * Temporary implementation of streaming completion
   * This will be moved to the provider interfaces in later milestones
   */
  private async streamChatCompletion(
    message: string,
    history: any[]
  ): Promise<ReadableStream> {
    // For now, we'll use a simple ReadableStream implementation
    // In the real implementation, this would call the provider's streaming API
    return new ReadableStream({
      start(controller) {
        controller.enqueue(JSON.stringify({
          type: 'content',
          content: `This is a placeholder response from the chat service. The real implementation will connect to the provider's API.`,
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
   * This simple version works for all providers but can be enhanced
   * in later milestones for provider-specific formatting
   * 
   * @param history The chat history
   * @param providerType The provider type
   * @returns Formatted history for the provider
   */
  private formatMessageHistory(
    history: ChatMessage[],
    providerType: ModelType
  ): any[] {
    // Basic history formatting for each provider
    // This simple implementation just passes through the history
    // Later implementations will adapt for provider-specific formats
    return history.map(msg => ({
      role: msg.role,
      content: msg.content
    }));
  }
  
  /**
   * Get the current provider type
   * @returns The current provider type
   */
  getCurrentProvider(): string {
    return this.llmService.getProvider();
  }
} 