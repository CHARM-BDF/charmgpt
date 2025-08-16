/**
 * Basic Chat Route
 * 
 * This is a simplified chat endpoint that uses the ChatService
 * for handling basic messages without tools or sequential thinking.
 * This is the first milestone in our multi-provider implementation.
 */

import express, { Request, Response } from 'express';
import { ChatService } from '../services/chat';

const router = express.Router();

// Basic chat endpoint for testing provider switching
router.post('/', async (req: Request<{}, {}, { 
  message: string; 
  history: Array<{ role: 'user' | 'assistant' | 'system'; content: string | any[] }>;
  modelProvider?: 'anthropic' | 'ollama' | 'openai' | 'gemini';
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
    console.log(`[CHAT-BASIC] Status Update: ${status}`);
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
      temperature = 0.2,
      maxTokens = 4000
    } = req.body;
    
    // Initial status update
    sendStatusUpdate('Processing request...');
    sendStatusUpdate(`Using model provider: ${modelProvider}`);
    
    // Process the chat with the ChatService
    const stream = await chatService.sendBasicMessage(
      message,
      history,
      {
        modelProvider,
        temperature,
        maxTokens
      },
      // Pass the status handler to get updates
      sendStatusUpdate
    );
    
    // Stream the response to the client
    const reader = stream.getReader();
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      // Forward the streamed data to the client
      res.write(value);
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
    console.error('Error in chat-basic route:', error);
    
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