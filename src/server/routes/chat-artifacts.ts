/**
 * Chat Artifacts Route
 * 
 * Provides a route for chat interactions with artifact generation.
 * This uses the new ChatService with response formatter adapters.
 */

import express, { Request, Response } from 'express';
import { ChatService } from '../services/chat';

const router = express.Router();

// Chat with artifacts endpoint
router.post('/', async (req: Request<{}, {}, { 
  message: string; 
  history: Array<{ role: 'user' | 'assistant' | 'system'; content: string | any[] }>;
  modelProvider?: 'anthropic' | 'ollama' | 'openai' | 'gemini';
  blockedServers?: string[];
  pinnedGraph?: any;
  temperature?: number;
  maxTokens?: number;
}>, res: Response) => {
  // Set headers for streaming
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Transfer-Encoding', 'chunked');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  
  // Helper function to send status updates
  const sendStatusUpdate = (status: string) => {
    const timestamp = new Date().toISOString();
    console.log(`[CHAT-ARTIFACTS] Status Update: ${status}`);
    res.write(JSON.stringify({ 
      type: 'status', 
      message: status,
      id: crypto.randomUUID(),
      timestamp: timestamp
    }) + '\n');
  };
  
  try {
    // Get the chat service from app locals
    const chatService = req.app.locals.chatService as ChatService;
    
    if (!chatService) {
      throw new Error('ChatService not initialized. Check server configuration.');
    }
    
    // Extract request params
    const { 
      message, 
      history, 
      modelProvider = 'anthropic',
      blockedServers = [],
      pinnedGraph,
      temperature = 0.2,
      maxTokens = 4000
    } = req.body;
    
    // Initial status update
    sendStatusUpdate('Processing request...');
    sendStatusUpdate(`Using model provider: ${modelProvider}`);
    
    // Process the chat with the ChatService
    const response = await chatService.processChat(
      message,
      history,
      {
        modelProvider,
        blockedServers,
        pinnedGraph,
        temperature,
        maxTokens
      },
      // Pass the status handler to get updates
      sendStatusUpdate
    );
    
    // Send the processed response
    sendStatusUpdate('Response received, sending content...');
    
    // Stream each part of the response
    if (response.thinking) {
      res.write(JSON.stringify({
        type: 'thinking',
        content: response.thinking,
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString()
      }) + '\n');
    }
    
    if (response.conversation && Array.isArray(response.conversation)) {
      for (const item of response.conversation) {
        if (typeof item === 'object' && item !== null) {
          if (item.type === 'text' && item.content) {
            res.write(JSON.stringify({
              type: 'content',
              content: item.content,
              id: crypto.randomUUID(),
              timestamp: new Date().toISOString()
            }) + '\n');
          } else if (item.type === 'artifact' && item.artifact) {
            res.write(JSON.stringify({
              type: 'artifact',
              artifact: item.artifact,
              id: crypto.randomUUID(),
              timestamp: new Date().toISOString()
            }) + '\n');
          }
        }
      }
    }
    
    // Send a final completion message
    res.write(JSON.stringify({ 
      type: 'status', 
      message: 'Response complete',
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      final: true
    }) + '\n');
    
    // End the response
    res.end();
  } catch (error) {
    console.error('Error in chat-artifacts route:', error);
    
    // Send error as a status update
    res.write(JSON.stringify({ 
      type: 'error',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }) + '\n');
    
    // End the response
    res.end();
  }
});

export default router; 