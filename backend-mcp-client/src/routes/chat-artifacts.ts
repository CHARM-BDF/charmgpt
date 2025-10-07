/**
 * Chat Artifacts Route
 * 
 * Provides a route for chat interactions with artifact generation.
 * This uses the new ChatService with response formatter adapters.
 */

import express, { Request, Response } from 'express';
import { ChatService } from '../services/chat';
import { MCPService, MCPLogMessage } from '../services/mcp';
import { FileAttachment } from '@charm-mcp/shared';
import crypto from 'crypto';

const router = express.Router();

router.post('/', async (req: Request<{}, {}, { 
  message: string; 
  history: Array<{ role: 'user' | 'assistant' | 'system'; content: string | any[] }>;
  conversationId?: string;
  modelProvider?: 'anthropic' | 'ollama' | 'openai' | 'gemini';
  blockedServers?: string[];
  enabledTools?: Record<string, string[]>;
  pinnedArtifacts?: Array<{
    id: string;
    type: string;
    title: string;
    content: string;
  }>;
  attachments?: FileAttachment[];
  temperature?: number;
  maxTokens?: number;
}>, res: Response) => {
  // Extract or generate conversation ID
  const conversationId = req.body.conversationId || crypto.randomUUID();
  console.log('🔥 [CHAT-ARTIFACTS] Request body conversationId:', req.body.conversationId);
  console.log('🔥 [CHAT-ARTIFACTS] Using conversation ID:', conversationId);
  console.log('🔥 [CHAT-ARTIFACTS] Was ID from request body?', !!req.body.conversationId);
  
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

  // Helper function to send MCP log messages as status updates
  const sendMCPLogMessage = (message: MCPLogMessage) => {
    const timestamp = new Date().toISOString();
    const traceId = message.data?.traceId || crypto.randomUUID().split('-')[0];
    
    console.log(`\n🔍 [CHAT-DEBUG:${traceId}] ===== CHAT LOG FLOW START =====`);
    console.log(`🔍 [CHAT-DEBUG:${traceId}] 1. Received MCP log message:`);
    console.log(`🔍 [CHAT-DEBUG:${traceId}]`, JSON.stringify(message, null, 2));
    
    // Format message for both console and UI
    const formattedMessage = `[${message.logger || 'MCP'}:${traceId}] ${message.data?.message || JSON.stringify(message.data)}`;
    console.log(`🔍 [CHAT-DEBUG:${traceId}] 2. Formatted message: ${formattedMessage}`);
    
    try {
      // Send to UI with trace ID
      console.log(`🔍 [CHAT-DEBUG:${traceId}] 3. Attempting to send to UI via sendStatusUpdate`);
      sendStatusUpdate(formattedMessage);
      console.log(`🔍 [CHAT-DEBUG:${traceId}] ✅ Status update sent successfully`);
    } catch (error) {
      console.error(`🔍 [CHAT-DEBUG:${traceId}] ❌ Error sending status update:`, error);
    }
    
    console.log(`🔍 [CHAT-DEBUG:${traceId}] ===== CHAT LOG FLOW END =====\n`);
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
      enabledTools = {},
      pinnedArtifacts,
      attachments,
      temperature = 0.2,
      maxTokens = 4000
    } = req.body;
    
    // Add detailed logging for blocked servers
    console.log('\n🔍 [CHAT-ARTIFACTS] === BLOCKED SERVERS DEBUG ===');
    console.log('🔍 [CHAT-ARTIFACTS] Raw blockedServers from request:', JSON.stringify(blockedServers));
    console.log('🔍 [CHAT-ARTIFACTS] Type of blockedServers:', Array.isArray(blockedServers) ? 'Array' : typeof blockedServers);
    console.log('🔍 [CHAT-ARTIFACTS] BlockedServers length:', Array.isArray(blockedServers) ? blockedServers.length : 0);
    
    // Add debugging for pinned artifacts
    console.log('\n🔍 [CHAT-ARTIFACTS] === PINNED ARTIFACTS DEBUG ===');
    console.log('🔍 [CHAT-ARTIFACTS] Raw pinnedArtifacts from request:', JSON.stringify(pinnedArtifacts));
    console.log('🔍 [CHAT-ARTIFACTS] Type of pinnedArtifacts:', Array.isArray(pinnedArtifacts) ? 'Array' : typeof pinnedArtifacts);
    console.log('🔍 [CHAT-ARTIFACTS] PinnedArtifacts length:', Array.isArray(pinnedArtifacts) ? pinnedArtifacts.length : 0);
    if (Array.isArray(pinnedArtifacts) && pinnedArtifacts.length > 0) {
      console.log('🔍 [CHAT-ARTIFACTS] Individual pinned artifacts:');
      pinnedArtifacts.forEach((artifact, index) => {
        console.log(`  [${index}] "${artifact.title}" (type: ${artifact.type}, id: ${artifact.id})`);
      });
    }
    console.log('🔍 [CHAT-ARTIFACTS] === END PINNED ARTIFACTS DEBUG ===\n');
    
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
    
    // Set MCP log message handler for this request
    const mcpService = req.app.locals.mcpService as MCPService;
    if (mcpService) {
      console.log('\n�� [CHAT-DEBUG] ===== LOG HANDLER REGISTRATION =====');
      console.log('🔍 [CHAT-DEBUG] 1. Adding request-specific MCP log handler');
      
      // Add our chat-specific handler (this won't remove the global handler)
      mcpService.addLogHandler(sendMCPLogMessage);
      console.log('🔍 [CHAT-DEBUG] 2. Log handler added successfully');
      sendStatusUpdate('MCP log handler enabled - you will receive server logs in this session');
      
      // Remove our handler when the request is complete
      res.on('close', () => {
        console.log('🔍 [CHAT-DEBUG] 3. Request closed, removing chat-specific MCP log handler');
        mcpService.removeLogHandler(sendMCPLogMessage);
        console.log('🔍 [CHAT-DEBUG] 4. Log handler removed successfully');
      });
      console.log('🔍 [CHAT-DEBUG] ===== LOG HANDLER REGISTRATION COMPLETE =====\n');
    }

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
        conversationId,  // Pass conversation ID to ChatService for Graph Mode
        modelProvider,
        blockedServers,
        enabledTools,
        pinnedArtifacts,
        attachments,
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
              // Create artifact data
              const artifactData = {
                type: 'artifact',
                artifact: item.artifact,
                id: crypto.randomUUID(),
                timestamp: new Date().toISOString()
              };
              console.log(`📤 DEBUG-CHAT-ROUTE: Artifact Response: ${JSON.stringify({
                id: artifactData.id,
                type: artifactData.type,
                artifactType: item.artifact.type,
                artifactTitle: item.artifact.title,
                contentLength: item.artifact.content ? item.artifact.content.length : 0
              })}`);
              res.write(JSON.stringify(artifactData) + '\n');
              
              // For Claude compatibility, also send an artifact button reference
              // This ensures the UI shows links to artifacts even in array format
              const uniqueId = item.artifact.id || artifactData.id;
              const buttonHtml = `<button class="artifact-button text-sm text-blue-600 dark:text-blue-400 hover:underline" data-artifact-id="${uniqueId}" data-artifact-type="${item.artifact.type}" style="cursor: pointer; background: none; border: none; padding: 0;">📎 ${item.artifact.title}</button>`;
              const buttonData = {
                type: 'content',
                content: buttonHtml,
                id: crypto.randomUUID(),
                timestamp: new Date().toISOString()
              };
              console.log(`📤 DEBUG-CHAT-ROUTE: Adding artifact button reference for UI compatibility`);
              res.write(JSON.stringify(buttonData) + '\n');
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
      } else if (typeof response.conversation === 'object') {
        // Handle object conversation format (possible Claude custom format)
        console.log(`🔍 DEBUG-CHAT-ROUTE: Processing object conversation (special case)`);
        // Convert object to string or extract content if possible
        let content = "The model provided a response in an unexpected format.";
        
        // Use type assertion to handle the unknown object structure
        const conversationObj = response.conversation as Record<string, any>;
        
        if (conversationObj && typeof conversationObj.content === 'string') {
          content = conversationObj.content;
        } else {
          try {
            content = JSON.stringify(conversationObj);
          } catch (err) {
            console.error('Error stringifying response object:', err);
          }
        }
        
        const responseData = {
          type: 'content',
          content,
          id: crypto.randomUUID(),
          timestamp: new Date().toISOString()
        };
        console.log(`📤 DEBUG-CHAT-ROUTE: Object Response converted to: ${JSON.stringify(responseData).substring(0, 200)}${JSON.stringify(responseData).length > 200 ? '...' : ''}`);
        res.write(JSON.stringify(responseData) + '\n');
        
        // Process artifacts same as string case
        if (response.artifacts && Array.isArray(response.artifacts)) {
          console.log(`🔍 DEBUG-CHAT-ROUTE: Sending ${response.artifacts.length} artifacts from artifacts array`);
          for (const artifact of response.artifacts) {
            const artifactData = {
              type: 'artifact',
              artifact,
              id: crypto.randomUUID(),
              timestamp: new Date().toISOString()
            };
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
  } catch (error: unknown) {
    console.error(`🔍 ERROR-CHAT-ROUTE: Error processing chat-artifacts request`, error);
    
    // Enhanced error logging for better debugging
    console.error(`❌ [CHAT-ARTIFACTS-ERROR] === DETAILED ERROR INFORMATION ===`);
    console.error(`❌ [CHAT-ARTIFACTS-ERROR] Error type: ${error instanceof Error ? error.constructor.name : typeof error}`);
    console.error(`❌ [CHAT-ARTIFACTS-ERROR] Error message: ${error instanceof Error ? error.message : String(error)}`);
    
    // Check for API response error information
    if (error instanceof Error && 'response' in error) {
      const errorWithResponse = error as any; // cast to any to access non-standard property
      console.error(`❌ [CHAT-ARTIFACTS-ERROR] API response error: ${JSON.stringify(errorWithResponse.response || {}).substring(0, 1000)}`);
    }
    
    // Log the stack trace for better debugging
    if (error instanceof Error) {
      console.error(`❌ [CHAT-ARTIFACTS-ERROR] Stack trace: ${error.stack}`);
      
      // Check for additional Gemini-specific error properties
      const errorObj = error as any;
      if (errorObj.code) {
        console.error(`❌ [CHAT-ARTIFACTS-ERROR] Error code: ${errorObj.code}`);
      }
      if (errorObj.status) {
        console.error(`❌ [CHAT-ARTIFACTS-ERROR] Error status: ${errorObj.status}`);
      }
      if (errorObj.details) {
        console.error(`❌ [CHAT-ARTIFACTS-ERROR] Error details: ${JSON.stringify(errorObj.details)}`);
      }
    }
    console.error(`❌ [CHAT-ARTIFACTS-ERROR] === END DETAILED ERROR INFORMATION ===`);
    
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