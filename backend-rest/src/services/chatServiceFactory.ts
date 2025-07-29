/**
 * Chat Service Factory
 * 
 * This file provides a factory function to create and configure the ChatService
 * with all required dependencies.
 */

import { Application } from 'express';
import { ChatService } from './chat';
import { LLMService } from './llm';
import { MCPService } from './mcp';
import { MessageService } from './message';
import { ArtifactService } from './artifact';

/**
 * Create a fully configured ChatService instance with all dependencies
 * 
 * @param app The Express application with locals containing required services
 * @returns A configured ChatService instance
 */
export function createChatService(app: Application): ChatService {
  // Get or create services from app locals
  const llmService = app.locals.llmService || new LLMService();
  const mcpService = app.locals.mcpService;
  const messageService = new MessageService();
  const artifactService = new ArtifactService();
  
  if (!mcpService) {
    console.warn('Warning: MCPService not available, tool execution will not be possible');
  }
  
  // Create the ChatService with all dependencies
  const chatService = new ChatService(
    llmService,
    mcpService,
    messageService,
    artifactService
  );
  
  console.log('ChatService: Created and configured through factory');
  return chatService;
} 