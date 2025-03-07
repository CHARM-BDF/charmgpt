import express, { Request, Response } from 'express';
import { Anthropic } from '@anthropic-ai/sdk';
import { systemPrompt } from '../systemPrompt';
import { MCPService, MCPLogMessage } from '../services/mcp';
import { MessageService, ChatMessage } from '../services/message';
import { ArtifactService, BinaryOutput } from '../services/artifact';
import { LoggingService } from '../services/logging';
import { isValidKnowledgeGraph, KnowledgeGraph, mergeKnowledgeGraphs } from '../../utils/knowledgeGraphUtils';
// import path from 'path';

const router = express.Router();

// Initialize services
const messageService = new MessageService();
const artifactService = new ArtifactService();

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Chat endpoint
router.post('/', async (req: Request<{}, {}, { 
  message: string; 
  history: Array<{ role: 'user' | 'assistant'; content: string }>;
  blockedServers?: string[];
  pinnedGraph?: {
    id: string;
    type: string;
    title: string;
    content: string;
  };
}>, res: Response) => {
  const loggingService = req.app.locals.loggingService as LoggingService;
  const mcpService = req.app.locals.mcpService as MCPService;
  
  // Set headers for streaming
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Transfer-Encoding', 'chunked');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  
  // Helper function to send status updates
  const sendStatusUpdate = (status: string) => {
    const timestamp = new Date().toISOString();
    console.log(`[MAIN] Status Update: ${status}`);
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
    const traceId = crypto.randomUUID().split('-')[0]; // Short unique ID for tracing
    
    console.log(`\n=== [MAIN:${traceId}] [CHAT:LOG-STEP-1] MCP LOG MESSAGE RECEIVED IN CHAT ROUTE ===`);
    console.log(`[MAIN:${traceId}] [CHAT:LOG-STEP-1] Timestamp: ${timestamp}`);
    console.log(`[MAIN:${traceId}] [CHAT:LOG-STEP-1] Logger: ${message.logger || 'MCP'}`);
    console.log(`[MAIN:${traceId}] [CHAT:LOG-STEP-1] Level: ${message.level}`);
    console.log(`[MAIN:${traceId}] [CHAT:LOG-STEP-1] Data:`, message.data);
    
    // Format message for both console and UI
    const formattedMessage = `[${message.logger || 'MCP'}:${traceId}] ${message.data?.message || JSON.stringify(message.data)}`;
    console.log(`[MAIN:${traceId}] [CHAT:LOG-STEP-2] Formatted message: ${formattedMessage}`);
    
    try {
      // Send to UI with trace ID
      console.log(`[MAIN:${traceId}] [CHAT:LOG-STEP-3] Sending to client via sendStatusUpdate`);
      sendStatusUpdate(`[TRACE:${traceId}] ${formattedMessage}`);
      console.log(`[MAIN:${traceId}] [CHAT:LOG-STEP-3] ✅ Status update sent successfully`);
    } catch (error) {
      console.error(`[MAIN:${traceId}] [CHAT:LOG-STEP-3] ❌ Error sending status update: ${error}`);
    }
    
    console.log(`[MAIN:${traceId}] [CHAT:LOG-STEP-4] ================================\n`);
  };
  
  try {
    // Initial status update
    sendStatusUpdate('Initializing request...');
    
    // Log the incoming request (this will create a new chat log session)
    loggingService.logRequest(req);

    const { message, history, blockedServers = [], pinnedGraph } = req.body;
    let messages: ChatMessage[] = [...history, { role: 'user', content: message }];
    let isSequentialThinkingComplete = false;

    // Set MCP log message handler for this request
    if (mcpService) {
      console.log('[CHAT-DEBUG] Setting request-specific MCP log handler');
      
      // Store the global handler to restore it later
      const globalLogHandler = req.app.locals.globalLogHandler;
      
      // Set our chat-specific handler
      mcpService.setLogMessageHandler(sendMCPLogMessage);
      sendStatusUpdate('MCP log handler enabled - you will receive server logs in this session');
      
      // Make sure to restore the global handler when the request is complete
      res.on('close', () => {
        console.log('[CHAT-DEBUG] Request closed, restoring global MCP log handler');
        if (globalLogHandler) {
          mcpService.setLogMessageHandler(globalLogHandler);
        }
      });
    }

    // If there's a pinned graph, add it to the context
    if (pinnedGraph) {
      sendStatusUpdate('Processing pinned knowledge graph...');
      console.log('\n=== PINNED GRAPH DETECTED ===');
      console.log('Graph ID:', pinnedGraph.id);
      console.log('Graph Title:', pinnedGraph.title);
      
      // Add an assistant message about the pinned graph instead of a system message
      messages.push({
        role: 'assistant',
        content: `I notice you've pinned a knowledge graph titled "${pinnedGraph.title}". I'll reference this graph in my responses.`
      });
      
      // Parse and store the pinned graph in the knowledgeGraph property
      try {
        const graphContent = typeof pinnedGraph.content === 'string' 
          ? JSON.parse(pinnedGraph.content) 
          : pinnedGraph.content;
        
        if (isValidKnowledgeGraph(graphContent)) {
          console.log(`Pinned knowledge graph contains ${graphContent.nodes.length} nodes and ${graphContent.links.length} links`);
          (messages as any).knowledgeGraph = graphContent;
          console.log('Stored pinned knowledge graph for merging with future graphs');
        } else {
          console.error('Invalid knowledge graph structure in pinned graph');
        }
      } catch (error) {
        console.error('Error processing pinned knowledge graph:', error);
      }
    }

    // First phase: Sequential thinking and tool usage
    while (!isSequentialThinkingComplete) {
      sendStatusUpdate('Analyzing request and planning response...');
      
      // Get MCP tools if available
      let tools = [];
      if (req.app.locals.mcpService) {
        sendStatusUpdate('Retrieving available MCP tools...');
        tools = await req.app.locals.mcpService.getAllAvailableTools(blockedServers);
      }

      // Make Anthropic call for next thought/tool use
      sendStatusUpdate('Determining next steps...');
      const toolResponse = await anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 4000,
        messages: messageService.convertChatMessages(messages) as any,
        temperature: 0.7,
        tools: tools,
      });

      // Process tool usage
      for (const content of toolResponse.content) {
        if (content.type === 'tool_use') {
          const mcpService = req.app.locals.mcpService as MCPService;
          const originalToolName = mcpService.getOriginalToolName(content.name);
          if (!originalToolName) continue;

          const [serverName, toolName] = originalToolName.split(':');
          
          sendStatusUpdate(`Executing tool: ${toolName} on server: ${serverName}...`);
          
          // Add debug logging for MCP tool execution
          console.log('\n=== MCP TOOL EXECUTION DEBUG ===');
          console.log('Server:', serverName);
          console.log('Tool:', toolName);
          console.log('Arguments:', content.input);
          
          // Execute tool
          const toolResult = await mcpService.callTool(serverName, toolName, content.input as Record<string, unknown>);

          // Debug log the tool result
          console.log('\n=== MCP TOOL RESULT DEBUG ===');
          // console.log('Raw tool result:', toolResult);
          console.log('Has content:', 'content' in toolResult);
          console.log('Has logs:', 'logs' in toolResult);
          if ('logs' in toolResult) {
            console.log('Logs structure:', toolResult.logs);
          }
          console.log('================================\n');

          // Add tool usage to conversation
          messages.push({
            role: 'assistant',
            content: [{ type: 'text', text: `Tool used: ${content.name}\nArguments: ${JSON.stringify(content.input)}` }]
          });

          // Process tool result
          if (toolResult && typeof toolResult === 'object' && 'content' in toolResult) {
            const textContent = (toolResult.content as any[]).find((item: any) => 
              item.type === 'text' && typeof item.text === 'string'
            );

            if (textContent) {
              messages.push({
                role: 'user',
                content: [{ type: 'text', text: textContent.text }]
              });

              // Check if this was sequential thinking tool
              if (content.name.includes('sequential-thinking')) {
                try {
                  const result = JSON.parse(textContent.text);
                  isSequentialThinkingComplete = !result.nextThoughtNeeded;
                } catch (error) {
                  console.error('Error parsing sequential thinking result:', error);
                  isSequentialThinkingComplete = true;
                }
              }
            }

            // Handle bibliography if present
            if ('bibliography' in toolResult && toolResult.bibliography) {
              // Check if bibliography exists and merge if it does
              if ((messages as any).bibliography) {
                // Merge and deduplicate based on PMID
                const currentBibliography = (messages as any).bibliography as any[];
                const newBibliography = toolResult.bibliography as any[];
                
                // Create a map of existing PMIDs
                const existingPmids = new Set(currentBibliography.map(entry => entry.pmid));
                
                // Only add entries with new PMIDs
                const uniqueNewEntries = newBibliography.filter(entry => !existingPmids.has(entry.pmid));
                
                // Merge unique new entries with existing bibliography
                (messages as any).bibliography = [...currentBibliography, ...uniqueNewEntries];
              } else {
                // First bibliography, just set it
                (messages as any).bibliography = toolResult.bibliography;
              }
            }

            // Handle knowledge graph artifacts if present
            if ('artifacts' in toolResult && Array.isArray(toolResult.artifacts)) {
              // Find any knowledge graph artifacts in the response
              const knowledgeGraphArtifact = toolResult.artifacts.find((a: any) => 
                a.type === 'application/vnd.knowledge-graph' && typeof a.content === 'string'
              );
              
              if (knowledgeGraphArtifact) {
                console.log('\n=== KNOWLEDGE GRAPH DATA ===');
                console.log(`Knowledge graph artifact found with title: ${knowledgeGraphArtifact.title || 'untitled'}`);
                
                try {
                  // Parse the knowledge graph content from string to object
                  const newGraph = JSON.parse(knowledgeGraphArtifact.content);
                  
                  // Validate the knowledge graph structure
                  if (isValidKnowledgeGraph(newGraph)) {
                    console.log(`Knowledge graph contains ${newGraph.nodes.length} nodes and ${newGraph.links.length} links`);
                    
                    // Check if knowledge graph exists and merge if it does
                    if ((messages as any).knowledgeGraph) {
                      console.log('Merging with existing knowledge graph...');
                      
                      // Merge the knowledge graphs
                      const currentGraph = (messages as any).knowledgeGraph as KnowledgeGraph;
                      const mergedGraph = mergeKnowledgeGraphs(currentGraph, newGraph);
                      
                      // Update the merged graph
                      (messages as any).knowledgeGraph = mergedGraph;
                      
                      console.log(`Merged graph now contains ${mergedGraph.nodes.length} nodes and ${mergedGraph.links.length} links`);
                    } else {
                      // First knowledge graph, just set it
                      console.log('Setting initial knowledge graph');
                      (messages as any).knowledgeGraph = newGraph;
                    }
                  } else {
                    console.error('Invalid knowledge graph structure in artifact');
                  }
                } catch (error) {
                  console.error('Error processing knowledge graph:', error);
                }
              }
            }

            // Handle binary output if present
            if ('binaryOutput' in toolResult && toolResult.binaryOutput) {
              const binaryOutput = toolResult.binaryOutput as BinaryOutput;
              
              // Initialize binaryOutputs array if it doesn't exist
              if (!(messages as any).binaryOutputs) {
                (messages as any).binaryOutputs = [];
              }
              
              // Add binary output to the collection
              (messages as any).binaryOutputs.push(binaryOutput);
            }
          }
        }
      }

      // If no tool was used, end the loop
      if (!toolResponse.content.some(c => c.type === 'tool_use')) {
        isSequentialThinkingComplete = true;
      }
    }

    // Final phase: Response formatting
    sendStatusUpdate('Generating final response...');
    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 4000,
      messages: messageService.convertChatMessages(messages) as any,
      system: systemPrompt,
      temperature: 0.2,
      tools: [{
        name: "response_formatter",
        description: "Format all responses in a consistent JSON structure with direct array values, not string-encoded JSON",
        input_schema: {
          type: "object",
          properties: {
            thinking: {
              type: "string",
              description: "Optional internal reasoning process, formatted in markdown"
            },
            conversation: {
              type: "array",
              description: "Array of conversation segments and artifacts in order of appearance. Return as a direct array, not as a string-encoded JSON.",
              items: {
                type: "object",
                properties: {
                  type: {
                    type: "string",
                    enum: ["text", "artifact"],
                    description: "Type of conversation segment"
                  },
                  content: {
                    type: "string",
                    description: "Markdown formatted text content"
                  },
                  artifact: {
                    type: "object",
                    description: "Artifact details",
                    properties: {
                      type: {
                        type: "string",
                        enum: [
                          "text/markdown",
                          "application/vnd.ant.code",
                          "image/svg+xml",
                          "application/vnd.mermaid",
                          "text/html",
                          "application/vnd.react",
                          "application/vnd.bibliography",
                          "application/vnd.knowledge-graph"
                        ]
                      },
                      id: { type: "string" },
                      title: { type: "string" },
                      content: { type: "string" },
                      language: { type: "string" }
                    },
                    required: ["type", "id", "title", "content"]
                  }
                },
                required: ["type"]
              }
            }
          },
          required: ["conversation"]
        }
      }],
      tool_choice: { type: "tool", name: "response_formatter" }
    });

    // Process and validate response
    if (response.content[0].type !== 'tool_use') {
      throw new Error('Expected tool_use response from Claude');
    }

    const toolResponse = response.content[0];
    if (toolResponse.type !== 'tool_use' || toolResponse.name !== 'response_formatter') {
      throw new Error('Expected response_formatter tool response');
    }

    // Convert to store format
    sendStatusUpdate('Processing response format...');
    let storeResponse = messageService.convertToStoreFormat(toolResponse as any);
    
    // Add bibliography if present
    if ((messages as any).bibliography) {
      sendStatusUpdate('Adding bibliography...');
      storeResponse = messageService.formatResponseWithBibliography(
        storeResponse, 
        (messages as any).bibliography
      );
    }

    // Add knowledge graph if present
    if ((messages as any).knowledgeGraph) {
      sendStatusUpdate('Adding knowledge graph...');
      console.log('\n=== ADDING KNOWLEDGE GRAPH TO RESPONSE ===');
      console.log(`Knowledge graph has ${(messages as any).knowledgeGraph.nodes.length} nodes and ${(messages as any).knowledgeGraph.links.length} links`);
      
      storeResponse = messageService.formatResponseWithKnowledgeGraph(
        storeResponse, 
        (messages as any).knowledgeGraph,
        "Knowledge Graph"
      );
      
      // Add this logging after formatting
      console.log('Knowledge graph added to response');
      if (storeResponse.artifacts) {
        const kgArtifact = storeResponse.artifacts.find(a => a.type === 'application/vnd.knowledge-graph');
        if (kgArtifact) {
          console.log(`Knowledge graph artifact ID: ${kgArtifact.id}`);
          console.log(`Knowledge graph artifact has artifactId: ${!!kgArtifact.artifactId}`);
        } else {
          console.log('WARNING: Knowledge graph artifact not found in response after formatting');
        }
      }
    }

    // Add binary outputs if present
    if ((messages as any).binaryOutputs) {
      sendStatusUpdate('Processing binary outputs...');
      const artifacts = storeResponse.artifacts || [];
      let position = artifacts.length;

      for (const binaryOutput of (messages as any).binaryOutputs) {
        const processedArtifacts = artifactService.processBinaryOutput(binaryOutput, position);
        artifacts.push(...processedArtifacts);
        position += processedArtifacts.length;
      }

      storeResponse.artifacts = artifacts;
    }

    // Log response
    loggingService.logResponse(res);

    sendStatusUpdate('Finalizing response...');

    // Send the final complete response
    res.write(JSON.stringify({ 
      type: 'result',
      response: storeResponse,
      timestamp: new Date().toISOString()
    }) + '\n');

    // End the response
    res.end();

  } catch (error) {
    loggingService.logError(error as Error);
    
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