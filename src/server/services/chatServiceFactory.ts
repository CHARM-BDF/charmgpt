/**
 * Chat Service Factory
 * 
 * This file provides a factory function to create and configure the LangGraph ChatService
 * with all required dependencies.
 */

import { Application } from 'express';
import { LangGraphChatService } from './chat/langgraph';
import { MessageService } from './message';
import { ArtifactService } from './artifact';

/**
 * Create a fully configured LangGraph ChatService instance with all dependencies
 * 
 * @param app The Express application with locals containing required services
 * @returns A configured LangGraph ChatService instance
 */
export function createChatService(app: Application): LangGraphChatService {
  // Get services from app locals
  const mcpService = app.locals.mcpService;
  const messageService = new MessageService();
  const artifactService = new ArtifactService();
  
  if (!mcpService) {
    console.warn('Warning: MCPService not available, tool execution will not be possible');
  }
  
  // Create the LangGraph ChatService with all dependencies
  const chatService = new LangGraphChatService(
    mcpService,
    messageService,
    artifactService
  );
  
  console.log('LangGraph ChatService: Created and configured through factory');
  return chatService;
} 