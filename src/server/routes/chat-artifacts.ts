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
  
  // Log the incoming request
  console.log(`🔍 DEBUG-CHAT-ROUTE: Received chat-artifacts request with provider: ${req.body.modelProvider || 'default'}`);
  console.log(`🔍 DEBUG-CHAT-ROUTE: Message: "${req.body.message?.substring(0, 50)}${req.body.message?.length > 50 ? '...' : ''}"`);
  console.log(`🔍 DEBUG-CHAT-ROUTE: History length: ${req.body.history?.length || 0}`);
  
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
    
    // Add detailed logging for blocked servers
    console.log('\n🔍 [CHAT-ARTIFACTS] === BLOCKED SERVERS DEBUG ===');
    console.log('🔍 [CHAT-ARTIFACTS] Raw blockedServers from request:', JSON.stringify(blockedServers));
    console.log('🔍 [CHAT-ARTIFACTS] Type of blockedServers:', Array.isArray(blockedServers) ? 'Array' : typeof blockedServers);
    console.log('🔍 [CHAT-ARTIFACTS] BlockedServers length:', Array.isArray(blockedServers) ? blockedServers.length : 0);
    
    if (Array.isArray(blockedServers) && blockedServers.length > 0) {
      console.log('🔍 [CHAT-ARTIFACTS] Individual blocked servers:');
      blockedServers.forEach((server, index) => {
        console.log(`  [${index}] "${server}" (type: ${typeof server})`);
      });
      
      // Test if these server names actually exist in our system
      try {
        const mcpService = req.app.locals.mcpService;
        if (mcpService && typeof mcpService.getServerNames === 'function') {
          const actualServerNames = Array.from(mcpService.getServerNames());
          console.log('\n🔍 [CHAT-ARTIFACTS] === BLOCKED SERVERS VALIDATION ===');
          console.log('🔍 [CHAT-ARTIFACTS] Actual server names from MCP service:', JSON.stringify(actualServerNames));
          
          // Check if blocked servers exist in actual server names
          const validBlocked = blockedServers.filter(blocked => actualServerNames.includes(blocked));
          const invalidBlocked = blockedServers.filter(blocked => !actualServerNames.includes(blocked));
          
          console.log('🔍 [CHAT-ARTIFACTS] Valid blocked servers:', JSON.stringify(validBlocked));
          console.log('🔍 [CHAT-ARTIFACTS] Invalid/unknown blocked servers:', JSON.stringify(invalidBlocked));
          
          if (invalidBlocked.length > 0) {
            console.log('⚠️ [CHAT-ARTIFACTS] WARNING: Some blocked servers do not exist in MCP service!');
          }
          console.log('🔍 [CHAT-ARTIFACTS] === END BLOCKED SERVERS VALIDATION ===\n');
        }
      } catch (err) {
        console.error('Error validating blocked servers:', err);
      }
    }
    
    // Get available servers info for comparison
    try {
      const mcpService = req.app.locals.mcpService;
      if (mcpService) {
        const allMcpServers = Array.from(mcpService.getServerNames?.() || []);
        
        if (allMcpServers.length > 0) {
          console.log('\n🔍 [CHAT-ARTIFACTS] === SERVER AVAILABILITY PREDICTION ===');
          console.log(`🔍 [CHAT-ARTIFACTS] Total MCP servers: ${allMcpServers.length}`);
          
          // Predict which servers should be blocked
          const predictedBlocked = allMcpServers.filter(serverName => 
            Array.isArray(blockedServers) && 
            blockedServers.some(blockedName => serverName === blockedName)
          );
          
          // Predict which servers should be allowed
          const predictedAllowed = allMcpServers.filter(serverName => 
            !predictedBlocked.includes(serverName)
          );
          
          console.log(`🔍 [CHAT-ARTIFACTS] Predicted BLOCKED servers (${predictedBlocked.length}): ${JSON.stringify(predictedBlocked)}`);
          console.log(`🔍 [CHAT-ARTIFACTS] Predicted ALLOWED servers (${predictedAllowed.length}): ${JSON.stringify(predictedAllowed)}`);
          console.log('🔍 [CHAT-ARTIFACTS] === END SERVER AVAILABILITY PREDICTION ===\n');
        } else {
          console.log('🔍 [CHAT-ARTIFACTS] Unable to get list of all MCP servers');
        }
      } else {
        console.log('🔍 [CHAT-ARTIFACTS] No MCP service available for server prediction');
      }
    } catch (err) {
      console.log('🔍 [CHAT-ARTIFACTS] Error predicting server availability:', err);
    }
    
    console.log('🔍 [CHAT-ARTIFACTS] === END BLOCKED SERVERS DEBUG ===\n');
    
    // Initial status update
    sendStatusUpdate('Processing request...');
    sendStatusUpdate(`Using model provider: ${modelProvider}`);
    
    // Process the chat with the ChatService
    console.log('🔍 [CHAT-ARTIFACTS] Calling chatService.processChat with options:');
    console.log('🔍 [CHAT-ARTIFACTS] - modelProvider:', modelProvider);
    console.log('🔍 [CHAT-ARTIFACTS] - blockedServers:', JSON.stringify(blockedServers));
    console.log('🔍 [CHAT-ARTIFACTS] - temperature:', temperature);
    console.log('🔍 [CHAT-ARTIFACTS] - maxTokens:', maxTokens);
    
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
    
    // Log the response structure
    console.log(`🔍 DEBUG-CHAT-ROUTE: Response structure:`, JSON.stringify({
      hasThinking: !!response.thinking,
      conversationType: typeof response.conversation,
      isConversationArray: Array.isArray(response.conversation),
      conversationLength: Array.isArray(response.conversation) ? response.conversation.length : 
                         (typeof response.conversation === 'string' ? 'string with length ' + response.conversation.length : 'unknown'),
      artifactsCount: response.artifacts?.length || 0
    }));
    
    // Stream each part of the response
    if (response.thinking) {
      console.log(`🔍 DEBUG-CHAT-ROUTE: Sending thinking section`);
      res.write(JSON.stringify({
        type: 'thinking',
        content: response.thinking,
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString()
      }) + '\n');
    }
    
    // Handle conversation based on its type (array or string)
    if (response.conversation) {
      if (Array.isArray(response.conversation)) {
        console.log(`🔍 DEBUG-CHAT-ROUTE: Processing array conversation with ${response.conversation.length} items`);
        
        // Process each item in the conversation array
        for (const item of response.conversation) {
          if (typeof item === 'object' && item !== null) {
            if (item.type === 'text' && item.content) {
              console.log(`🔍 DEBUG-CHAT-ROUTE: Sending text content`);
              const responseData = {
                type: 'content',
                content: item.content,
                id: crypto.randomUUID(),
                timestamp: new Date().toISOString()
              };
              console.log(`📤 DEBUG-CHAT-ROUTE: Text Response: ${JSON.stringify(responseData).substring(0, 200)}${JSON.stringify(responseData).length > 200 ? '...' : ''}`);
              res.write(JSON.stringify(responseData) + '\n');
            } else if (item.type === 'artifact' && item.artifact) {
              console.log(`🔍 DEBUG-CHAT-ROUTE: Sending artifact of type ${item.artifact.type}`);
              const responseData = {
                type: 'artifact',
                artifact: item.artifact,
                id: crypto.randomUUID(),
                timestamp: new Date().toISOString()
              };
              console.log(`📤 DEBUG-CHAT-ROUTE: Artifact Response: ${JSON.stringify({
                id: responseData.id,
                type: responseData.type,
                artifactType: item.artifact.type,
                artifactTitle: item.artifact.title,
                contentLength: item.artifact.content ? item.artifact.content.length : 0
              })}`);
              res.write(JSON.stringify(responseData) + '\n');
            } else {
              console.log(`🔍 DEBUG-CHAT-ROUTE: Unknown conversation item type: ${item.type}`);
            }
          }
        }
      } else if (typeof response.conversation === 'string') {
        // Handle string conversation format (legacy or fallback format)
        console.log(`🔍 DEBUG-CHAT-ROUTE: Processing string conversation (length: ${response.conversation.length})`);
        const responseData = {
          type: 'content',
          content: response.conversation,
          id: crypto.randomUUID(),
          timestamp: new Date().toISOString()
        };
        console.log(`📤 DEBUG-CHAT-ROUTE: String Response: ${JSON.stringify(responseData).substring(0, 200)}${JSON.stringify(responseData).length > 200 ? '...' : ''}`);
        res.write(JSON.stringify(responseData) + '\n');
        
        // If there are artifacts, send them separately
        if (response.artifacts && Array.isArray(response.artifacts)) {
          console.log(`🔍 DEBUG-CHAT-ROUTE: Sending ${response.artifacts.length} artifacts from artifacts array`);
          for (const artifact of response.artifacts) {
            const artifactData = {
              type: 'artifact',
              artifact,
              id: crypto.randomUUID(),
              timestamp: new Date().toISOString()
            };
            console.log(`📤 DEBUG-CHAT-ROUTE: Artifact Response: ${JSON.stringify({
              id: artifactData.id,
              type: artifactData.type,
              artifactType: artifact.type,
              artifactTitle: artifact.title,
              contentLength: artifact.content ? artifact.content.length : 0
            })}`);
            res.write(JSON.stringify(artifactData) + '\n');
          }
        }
      } else {
        console.log(`❌ DEBUG-CHAT-ROUTE: No valid conversation content found in response`);
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
    console.error(`🔍 ERROR-CHAT-ROUTE: Error processing chat-artifacts request`, error);
    
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