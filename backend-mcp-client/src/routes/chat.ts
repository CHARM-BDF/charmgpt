import express, { Request, Response } from 'express';
import 'dotenv/config';
import { Anthropic } from '@anthropic-ai/sdk';
import { systemPrompt } from '../systemPrompt';
import { MCPService, MCPLogMessage } from '../services/mcp';
import { MessageService, ChatMessage } from '../services/message';
import { ArtifactService, BinaryOutput } from '../services/artifact';
import { LoggingService } from '../services/logging';
import { isValidKnowledgeGraph, KnowledgeGraph, mergeKnowledgeGraphs } from '../utils/knowledgeGraphUtils';
import { LLMService } from '../services/llm';
import fs from 'fs';
import path from 'path';

// ▼▼▼  SIMPLE DEBUG TOGGLE  ▼▼▼
// Set to true if you want to see all legacy console output from this route.
// When false (default) only [TOOL-LOG] messages will reach the console; all
// other console.log / console.dir output generated in this file is suppressed
// to reduce noise during tool-calling investigations.
const CHAT_ROUTE_VERBOSE = false;

// Preserve original console methods (already wrapped by LoggingService once)
const __chatOriginalConsoleLog = console.log.bind(console);
const __chatOriginalConsoleDir = console.dir.bind(console);

if (!CHAT_ROUTE_VERBOSE) {
  console.log = (...args: any[]) => {
    // Allow our tool-logging lines through
    if (typeof args[0] === 'string' && args[0].startsWith('[TOOL-LOG]')) {
      __chatOriginalConsoleLog(...args);
    }
  };
  console.dir = (...args: any[]) => {
    if (typeof args[0] === 'string' && args[0].startsWith('[TOOL-LOG]')) {
      __chatOriginalConsoleDir(...args);
    }
  };
}

// ▲▲▲  END DEBUG TOGGLE  ▲▲▲

const router = express.Router();

// Initialize services
const messageService = new MessageService();
const artifactService = new ArtifactService();
const llmService = new LLMService();

// Tool calling logger
let toolCallSession = '';
const logToolCall = (section: string, data: any) => {
  try {
    if (!toolCallSession) {
      const now = new Date();
      // Use same timestamp format as working LoggingService
      toolCallSession = `toolcall-${now.toLocaleString('en-US', {
        timeZone: 'America/Chicago',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      }).replace(/[\/:]/g, '-')}`;
    }
    
    const timestamp = new Date().toISOString();
    const logDir = path.join(process.cwd(), 'logs', 'toolcalling');
    const logFile = path.join(logDir, `${toolCallSession}.log`);
    
    // Ensure directory exists (like working LoggingService)
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    
    const message = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
    const logLine = `\n=== ${timestamp} - ${section} ===\n${message}\n`;
    
    // Write to file with error handling (like working LoggingService)
    fs.appendFileSync(logFile, logLine);
    
    // Also log to console for immediate debugging
    console.log(`[TOOL-LOG] ${section}: File written to ${logFile}`);
    
  } catch (error) {
    console.error('[TOOL-LOG] Error writing to tool calling log:', error);
    console.log(`[TOOL-LOG] ${section}:`, data);
  }
};

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Chat endpoint
router.post('/', async (req: Request<{}, {}, { 
  message: string; 
  history: Array<{ role: 'user' | 'assistant'; content: string }>;
  conversationId?: string;
  blockedServers?: string[];
  enabledTools?: Record<string, string[]>;
  modelProvider?: string;
  pinnedGraph?: {
    id: string;
    type: string;
    title: string;
    content: string;
  };
  pinnedArtifacts?: Array<{
    id: string;
    type: string;
    title: string;
    content: string;
  }>;
}>, res: Response) => {
  const loggingService = req.app.locals.loggingService as LoggingService;
  const mcpService = req.app.locals.mcpService as MCPService;
  const llmService = req.app.locals.llmService;
  
  // Extract or generate conversation ID
  console.log('🔥 [CHAT-ROUTE] Request body conversationId:', req.body.conversationId);
  console.log('🔥 [CHAT-ROUTE] Request body keys:', Object.keys(req.body));
  console.log('🔥 [CHAT-ROUTE] Full request body:', JSON.stringify(req.body, null, 2).substring(0, 500));
  
  const conversationId = req.body.conversationId || crypto.randomUUID();
  console.log('🔥 [CHAT-ROUTE] Using conversation ID:', conversationId);
  console.log('🔥 [CHAT-ROUTE] Was ID from request body?', !!req.body.conversationId);
  
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
    
    // Reset tool call session for new request
    toolCallSession = '';
    
    // Log the incoming request (this will create a new chat log session)
    loggingService.logRequest(req);

    const { message, history, blockedServers = [], enabledTools = {}, modelProvider = 'claude', pinnedGraph, pinnedArtifacts } = req.body;
    
    // Test the logging system
    logToolCall('SESSION_START', {
      message: 'New chat request received',
      userMessage: message,
      historyLength: history.length
    });
    
    // Set the LLM provider if one is specified and llmService is available
    if (llmService && modelProvider) {
      sendStatusUpdate(`Using ${modelProvider} as the model provider...`);
      try {
        llmService.setProvider({ provider: modelProvider as any });
      } catch (error) {
        console.error(`Error setting model provider to ${modelProvider}:`, error);
        sendStatusUpdate(`⚠️ Failed to set model provider to ${modelProvider}, using default.`);
      }
    }
    
    // Add detailed logging for blocked servers
    console.log('\n=== SERVER-SIDE BLOCKED SERVERS TRACE ===');
    console.log('1. Raw blocked servers from request body:', req.body.blockedServers);
    
    // 🔍 DETAILED BLOCKED SERVERS LOG FOR DEBUGGING
    console.log('🔍 [CHAT.TS] Blocked servers list as received in route:', JSON.stringify(req.body.blockedServers));
    
    console.log('2. Type of blockedServers:', Array.isArray(req.body.blockedServers) ? 'Array' : typeof req.body.blockedServers);

    const messages: ChatMessage[] = [...history, { role: 'user', content: message }];
    let isSequentialThinkingComplete = false;

    // Set MCP log message handler for this request
    if (mcpService) {
      console.log('[CHAT-DEBUG] Adding request-specific MCP log handler');
      
      // Add our chat-specific handler (this won't remove the global handler)
      mcpService.addLogHandler(sendMCPLogMessage);
      sendStatusUpdate('MCP log handler enabled - you will receive server logs in this session');
      
      // Remove our handler when the request is complete
      res.on('close', () => {
        console.log('[CHAT-DEBUG] Request closed, removing chat-specific MCP log handler');
        mcpService.removeLogHandler(sendMCPLogMessage);
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

    // Process pinned artifacts (new system)
    if (pinnedArtifacts && pinnedArtifacts.length > 0) {
      sendStatusUpdate(`Processing ${pinnedArtifacts.length} pinned artifacts...`);
      console.log('\n=== PINNED ARTIFACTS DETECTED ===');
      console.log(`Found ${pinnedArtifacts.length} pinned artifacts`);
      
      // Add an assistant message about the pinned artifacts
      const artifactTitles = pinnedArtifacts.map(a => `"${a.title}"`).join(', ');
      messages.push({
        role: 'assistant',
        content: `I notice you've pinned ${pinnedArtifacts.length} artifact${pinnedArtifacts.length > 1 ? 's' : ''}: ${artifactTitles}. I'll reference ${pinnedArtifacts.length > 1 ? 'these' : 'this'} in my responses.`
      });
      
      // Add each artifact to the context
      for (const artifact of pinnedArtifacts) {
        console.log(`Processing pinned artifact: ${artifact.title} (${artifact.type})`);
        
        // Handle knowledge graphs specially for merging
        if (artifact.type === 'application/vnd.knowledge-graph' || artifact.type === 'application/vnd.ant.knowledge-graph') {
          try {
            const graphContent = typeof artifact.content === 'string' 
              ? JSON.parse(artifact.content) 
              : artifact.content;
            
            if (isValidKnowledgeGraph(graphContent)) {
              console.log(`Pinned knowledge graph contains ${graphContent.nodes.length} nodes and ${graphContent.links.length} links`);
              (messages as any).knowledgeGraph = graphContent;
              console.log('Stored pinned knowledge graph for merging with future graphs');
            }
          } catch (error) {
            console.error('Error processing pinned knowledge graph:', error);
          }
        } else {
          // Add other artifact types to the context as messages
          messages.push({
            role: 'user',
            content: `Here is the pinned ${artifact.type} titled "${artifact.title}":\n\`\`\`\n${
              typeof artifact.content === 'string' 
                ? artifact.content 
                : JSON.stringify(artifact.content, null, 2)
            }\n\`\`\``
          });
        }
      }
    }

    // First phase: Sequential thinking and tool usage
    while (!isSequentialThinkingComplete) {
      logToolCall('LOOP_START', {
        iteration: 'Starting new tool calling iteration',
        messagesLength: messages.length,
        lastMessage: messages[messages.length - 1],
        isSequentialThinkingComplete
      });
      
      if (messages.length > 0) {
        const lastMsg = messages[messages.length - 1];
        console.log('[TOOL-LOOP] Last conversation message >>>');
        console.dir(lastMsg, { depth: null, colors: false });
      }
      
      // Get MCP tools if available
      let tools = [];
      if (req.app.locals.mcpService) {
        tools = await req.app.locals.mcpService.getAllAvailableTools(blockedServers, enabledTools);
        logToolCall('TOOLS_AVAILABLE', {
          toolCount: tools.length,
          toolNames: tools.map((t: any) => t.name),
          tools: tools
        });
      }
      
      // Make Anthropic call for next thought/tool use
      console.log('[TOOL-LOOP] Calling Claude - just before CALLING_CLAUDE');
             logToolCall('CALLING_CLAUDE', {
         messagesForClaude: messageService.convertChatMessages(messages),
         toolsProvided: tools.map((t: any) => ({ name: t.name, description: t.description })),
         temperature: 0.7
       });
      
      const toolResponse = await anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 4000,
        messages: messageService.convertChatMessages(messages) as any,
        temperature: 0.7,
        tools: tools,
      });

      // Log raw response for diagnostics
      console.log('[TOOL-LOOP] Raw toolResponse.content from Claude:');
      console.dir(toolResponse.content, { depth: null, colors: false });
      
      logToolCall('CLAUDE_RESPONSE', {
        contentBlocks: toolResponse.content.length,
        contentTypes: toolResponse.content.map(c => c.type),
        hasToolUse: toolResponse.content.some(c => c.type === 'tool_use'),
        fullResponse: toolResponse.content
      });

      // Process tool usage
      for (const content of toolResponse.content) {
        if (content.type === 'tool_use') {
          logToolCall('TOOL_CALL_DETECTED', {
            toolName: content.name,
            toolInput: content.input,
            contentType: content.type
          });
          
          const mcpService = req.app.locals.mcpService as MCPService;
          const originalToolName = mcpService.getOriginalToolName(content.name);
          if (!originalToolName) {
            logToolCall('TOOL_MAPPING_FAILED', {
              anthropicName: content.name,
              error: 'No mapping found for tool name'
            });
            continue;
          }

          const [serverName, toolName] = originalToolName.split(':');
          
          logToolCall('TOOL_CALL_MAPPED', {
            anthropicName: content.name,
            originalName: originalToolName,
            serverName,
            toolName,
            arguments: content.input
          });

          // Add debug logging for MCP tool execution
          console.log('\n=== MCP TOOL EXECUTION DEBUG ===');
          console.log('Server:', serverName);
          console.log('Tool:', toolName);
          console.log('Arguments:', content.input);
          
          // Special handling for Graph Mode MCPs - add database context
          let toolArguments = content.input as Record<string, unknown>;
          if (serverName === 'graph-mode-mcp') {
            console.log('🔧 Graph Mode MCP detected - adding database context');
            console.log('🔧 Current conversationId from request:', conversationId);
            console.log('🔧 Request body keys:', Object.keys(req.body));
            console.log('🔧 Original tool arguments:', content.input);
            
            toolArguments = {
              ...toolArguments,
              databaseContext: {
                conversationId: conversationId,
                apiBaseUrl: process.env.API_BASE_URL || 'http://localhost:3001',
                accessToken: process.env.ACCESS_TOKEN
              }
            };
            console.log('🔧 Enhanced arguments with database context:', toolArguments);
            
            // Test the API endpoint directly to verify data exists
            try {
              const testUrl = `http://localhost:3001/api/graph/${conversationId}/state`;
              console.log('🔧 Testing API endpoint directly:', testUrl);
              const testResponse = await fetch(testUrl);
              const testData = await testResponse.json();
              console.log('🔧 Direct API test result:', {
                status: testResponse.status,
                success: testData.success,
                nodeCount: testData.data?.nodes?.length || 0,
                edgeCount: testData.data?.edges?.length || 0,
                conversationId: conversationId
              });
            } catch (testError) {
              console.error('🔧 Direct API test failed:', testError);
            }
          }
          
          console.error(`🔍 [TOOL-EXECUTION] Reached tool execution point for: ${serverName}:${toolName}`);
          
          // Execute tool
          console.error(`🔍 [TOOL-EXECUTION] About to call tool: ${serverName}:${toolName}`);
          console.error(`🔍 [TOOL-EXECUTION] Args:`, JSON.stringify(toolArguments, null, 2));
          
          const toolResult = await mcpService.callTool(serverName, toolName, toolArguments);
          
          console.error(`🔍 [TOOL-EXECUTION] Tool response received:`, JSON.stringify(toolResult, null, 2));

          logToolCall('MCP_RESPONSE', {
            serverName,
            toolName,
            resultType: typeof toolResult,
            hasContent: 'content' in toolResult,
            hasBibliography: 'bibliography' in toolResult,
            hasArtifacts: 'artifacts' in toolResult,
            fullResult: toolResult
          });

          // Add tool usage to conversation (like working version)
          messages.push({
            role: 'assistant',
            content: [{ type: 'text', text: `Tool used: ${content.name}\nArguments: ${JSON.stringify(content.input)}` }]
          });
          
          logToolCall('CONVERSATION_UPDATE_TOOL_USAGE', {
            addedMessage: {
              role: 'assistant',
              content: `Tool used: ${content.name}\nArguments: ${JSON.stringify(content.input)}`
            },
            newMessageCount: messages.length
          });

          // Add detailed logging of MCP tool response
          console.log('\n===== [MCP-OUTPUT] TOOL RESPONSE START =====');
          console.log(`[MCP-OUTPUT] Server: ${serverName}, Tool: ${toolName}`);
          console.log('[MCP-OUTPUT] Full JSON Response:');
          console.log(JSON.stringify(toolResult, null, 2));
          console.log('===== [MCP-OUTPUT] TOOL RESPONSE END =====\n');

          // Debug log the tool result
          console.log('\n=== MCP TOOL RESULT DEBUG ===');
          // console.log('Raw tool result:', toolResult);
          console.log('Has content:', 'content' in toolResult);
          console.log('Has logs:', 'logs' in toolResult);
          if ('logs' in toolResult) {
            console.log('Logs structure:', toolResult.logs);
          }
          console.log('================================\n');

          // Handle bibliography if present
          if ('bibliography' in toolResult && toolResult.bibliography) {
            logToolCall('BIBLIOGRAPHY_FOUND', {
              bibliographyCount: Array.isArray(toolResult.bibliography) ? toolResult.bibliography.length : 'not-array',
              bibliography: toolResult.bibliography
            });
            
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

          // Handle grant markdown if present
          if ('grantMarkdown' in toolResult && toolResult.grantMarkdown) {
            logToolCall('GRANT_MARKDOWN_FOUND', toolResult.grantMarkdown);
            // Store the grant markdown
            (messages as any).grantMarkdown = toolResult.grantMarkdown;
          }

          // Handle knowledge graph artifacts if present
          if ('artifacts' in toolResult && Array.isArray(toolResult.artifacts)) {
            logToolCall('ARTIFACTS_FOUND', {
              artifactCount: toolResult.artifacts.length,
              artifacts: toolResult.artifacts
            });
            
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

          // Handle artifacts array from standardized MCP response format
          if ('artifacts' in toolResult && Array.isArray(toolResult.artifacts) && toolResult.artifacts.length > 0) {
            console.log('[CHAT:TOOL-RESULT] Found artifacts array in MCP response:', toolResult.artifacts.length, 'items');
            
            // Process each artifact
            for (const artifact of toolResult.artifacts) {
              console.log(`[CHAT:TOOL-RESULT] Found artifact of type: ${artifact.type} titled "${artifact.title}"`);
              
              // Store for later processing in the unified artifact collection phase
              if (!(messages as any).directArtifacts) {
                (messages as any).directArtifacts = [];
              }
              (messages as any).directArtifacts.push(artifact);
            }
            
            console.log('[CHAT:TOOL-RESULT] Stored MCP artifacts for later processing');
          }

          // ░░░ Handle the main textual result ░░░
          if (toolResult && typeof toolResult === 'object' && 'content' in toolResult) {
            const textContentItem = Array.isArray((toolResult as any).content)
              ? (toolResult as any).content.find((item: any) => item.type === 'text' && typeof item.text === 'string')
              : undefined;

            if (textContentItem) {
              // 🔍 DETAILED MCP TOOL RESULT LOGGING
              console.error('\n🔍 ===== MCP TOOL RESULT RECEIVED =====');
              console.error(`Tool: ${content.name}`);
              
              // Extract MCP server name from tool name (format: serverName-toolName)
              const toolNameParts = content.name.split('-');
              const mcpServer = toolNameParts.length > 1 ? toolNameParts[0] : 'unknown';
              const toolName = toolNameParts.length > 1 ? toolNameParts.slice(1).join('-') : content.name;
              
              console.error(`MCP Server: ${mcpServer}`);
              console.error(`Tool Name: ${toolName}`);
              console.error(`Content Length: ${textContentItem.text.length} characters`);
              console.error(`Content Preview (first 500 chars):`);
              console.error(textContentItem.text.substring(0, 500));
              if (textContentItem.text.length > 500) {
                console.error('... (truncated)');
              }
              console.error('===== END MCP TOOL RESULT =====\n');
              
              logToolCall('TEXT_CONTENT_FOUND', {
                textContent: textContentItem.text,
                contentLength: textContentItem.text.length
              });
              
              // Log metadata for debugging but don't spam status updates
              if ('metadata' in toolResult && (toolResult as any).metadata?.querySuccess) {
                const md = (toolResult as any).metadata;
                console.log(`Query successful with ${md.nodeCount ?? 0} nodes${md.bothDirectionsSuccessful ? ' (both directions complete)' : ''}`);
              }

              // Add tool result as user message with MCP context (reuse variables from above)
              const toolResultText = `[MCP: ${mcpServer} | Tool: ${toolName}]\n\n${textContentItem.text}`;
              messages.push({
                role: 'user',
                content: [{ type: 'text', text: toolResultText }]
              });
              
              logToolCall('CONVERSATION_UPDATE_TOOL_RESULT', {
                addedMessage: {
                  role: 'user',
                  content: textContentItem.text.substring(0, 200) + (textContentItem.text.length > 200 ? '...' : '')
                },
                newMessageCount: messages.length,
                fullText: textContentItem.text
              });

              // If this is the sequential-thinking planner, decide whether to exit the loop
              if (content.name.includes('sequential-thinking')) {
                try {
                  const parsed = JSON.parse(textContentItem.text);
                  isSequentialThinkingComplete = !parsed.nextThoughtNeeded;
                  logToolCall('SEQUENTIAL_THINKING_CHECK', {
                    parsedResult: parsed,
                    nextThoughtNeeded: parsed.nextThoughtNeeded,
                    willExitLoop: !parsed.nextThoughtNeeded
                  });
                } catch {
                  isSequentialThinkingComplete = true; // fall back to safe exit
                  logToolCall('SEQUENTIAL_THINKING_ERROR', 'Failed to parse sequential thinking result, exiting loop');
                }
              }
            } else {
              logToolCall('NO_TEXT_CONTENT', {
                hasContent: 'content' in toolResult,
                contentStructure: (toolResult as any).content
              });
            }
          } else {
            logToolCall('NO_CONTENT_PROPERTY', {
              toolResultType: typeof toolResult,
              toolResultKeys: Object.keys(toolResult || {})
            });
          }
        }
      }

      // Check exit condition
      const hasToolUse = toolResponse.content.some(c => c.type === 'tool_use');
      logToolCall('LOOP_EXIT_CHECK', {
        hasToolUse,
        willContinue: hasToolUse,
        willExit: !hasToolUse,
        isSequentialThinkingComplete
      });

      // If no tool was used, end the loop
      if (!hasToolUse) {
        isSequentialThinkingComplete = true;
        logToolCall('LOOP_EXITING', 'No tool_use detected in Claude response, exiting loop');
      }
    }

    logToolCall('LOOP_COMPLETED', {
      finalMessageCount: messages.length,
      exitReason: 'isSequentialThinkingComplete = true'
    });

    // Final phase: Response formatting
    sendStatusUpdate('Generating final response...');
    
    // 🔍 LOGGING: What's being passed to the summarizer
    console.error('\n🔍 ===== DATA BEING PASSED TO SUMMARIZER =====');
    console.error(`Total messages: ${messages.length}`);
    console.error('Message breakdown:');
    messages.forEach((msg, index) => {
      console.error(`Message ${index + 1} (${msg.role}):`);
      if (Array.isArray(msg.content)) {
        msg.content.forEach((contentItem, contentIndex) => {
          if (contentItem.type === 'text') {
            console.error(`  Content ${contentIndex + 1} (text): ${contentItem.text.substring(0, 200)}${contentItem.text.length > 200 ? '...' : ''}`);
          } else {
            console.error(`  Content ${contentIndex + 1} (${contentItem.type}): ${JSON.stringify(contentItem).substring(0, 200)}...`);
          }
        });
      } else {
        console.error(`  Content: ${typeof msg.content === 'string' ? msg.content.substring(0, 200) + '...' : JSON.stringify(msg.content).substring(0, 200) + '...'}`);
      }
    });
    console.error('===== END SUMMARIZER INPUT =====\n');
    
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

    // 🔍 LOGGING: Summarizer's response
    console.error('\n🔍 ===== SUMMARIZER RESPONSE RECEIVED =====');
    console.error('Response type:', response.content[0].type);
    if (response.content[0].type === 'tool_use') {
      console.error('Tool used:', response.content[0].name);
      console.error('Tool input preview:');
      const toolInput = response.content[0].input;
      if (toolInput && toolInput.conversation) {
        console.error(`Conversation array length: ${toolInput.conversation.length}`);
        toolInput.conversation.forEach((item, index) => {
          console.error(`  Item ${index + 1} (${item.type}):`);
          if (item.type === 'text') {
            console.error(`    Content: ${item.content.substring(0, 200)}${item.content.length > 200 ? '...' : ''}`);
          } else if (item.type === 'artifact') {
            console.error(`    Artifact: ${item.artifact.type} - ${item.artifact.title}`);
            console.error(`    Content: ${item.artifact.content.substring(0, 200)}${item.artifact.content.length > 200 ? '...' : ''}`);
          }
        });
      }
    }
    console.error('===== END SUMMARIZER RESPONSE =====\n');

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
    
    // Process all artifacts in a unified way
    console.log('\n🟡🟡🟡 CHAT ROUTE: Starting unified artifact collection 🟡🟡🟡');
    const artifactsToAdd = [];
    
    // Handle bibliography if present
    if ((messages as any).bibliography) {
      sendStatusUpdate('Adding bibliography...');
      console.log('🟡🟡🟡 CHAT ROUTE: Found bibliography data with', (messages as any).bibliography.length, 'entries 🟡🟡🟡');
      artifactsToAdd.push({
        type: 'application/vnd.bibliography',
        title: 'Bibliography',
        content: (messages as any).bibliography
      });
    }
    
    // Handle grant markdown if present
    if ((messages as any).grantMarkdown) {
      sendStatusUpdate('Adding grant markdown...');
      console.log('🟡🟡🟡 CHAT ROUTE: Found grant markdown data 🟡🟡🟡');
      artifactsToAdd.push({
        type: 'text/markdown',
        title: 'Grant Proposal',
        content: (messages as any).grantMarkdown,
        language: 'markdown'
      });
    }
    
    // Handle knowledge graph if present
    if ((messages as any).knowledgeGraph) {
      sendStatusUpdate('Adding knowledge graph...');
      console.log('🟡🟡🟡 CHAT ROUTE: Found knowledge graph data 🟡🟡🟡');
      console.log(`[CHAT:ARTIFACTS] Knowledge graph has ${(messages as any).knowledgeGraph.nodes.length} nodes and ${(messages as any).knowledgeGraph.links.length} links`);
      
      // Log full structure of knowledge graph artifact
      console.log('[MCP-OUTPUT] KNOWLEDGE GRAPH ARTIFACT:');
      const knowledgeGraphArtifact = {
        type: 'application/vnd.knowledge-graph',
        title: 'Knowledge Graph',
        content: (messages as any).knowledgeGraph
      };
      console.log(JSON.stringify(knowledgeGraphArtifact, null, 2));
      
      artifactsToAdd.push(knowledgeGraphArtifact);
      
      console.log('[CHAT:ARTIFACTS] Knowledge graph added to artifacts queue');
    }
    
    // Handle direct artifacts from MCP responses
    if ((messages as any).directArtifacts && Array.isArray((messages as any).directArtifacts)) {
      sendStatusUpdate('Processing MCP artifacts...');
      console.log('🟡🟡🟡 CHAT ROUTE: Found direct artifacts with', (messages as any).directArtifacts.length, 'items 🟡🟡🟡');
      
      for (const artifact of (messages as any).directArtifacts) {
        console.log(`[CHAT:ARTIFACTS] Processing direct artifact of type: ${artifact.type}`);
        // Log full structure of direct artifact
        console.log('[MCP-OUTPUT] DIRECT ARTIFACT:');
        console.log(JSON.stringify(artifact, null, 2));
        
        artifactsToAdd.push(artifact);
      }
      
      console.log('[CHAT:ARTIFACTS] Direct artifacts added to processing queue');
    }
    
    // Handle artifact array if present
    if (toolResponse && typeof toolResponse === 'object' && 
        'input' in toolResponse && toolResponse.input && 
        typeof toolResponse.input === 'object' && 
        'artifacts' in toolResponse.input && 
        Array.isArray(toolResponse.input.artifacts)) {
      console.log('🟡🟡🟡 CHAT ROUTE: Found existing artifacts array with', toolResponse.input.artifacts.length, 'items 🟡🟡🟡');
      artifactsToAdd.push(...toolResponse.input.artifacts);
    }
    
    // Handle binary outputs if present
    if ((messages as any).binaryOutputs) {
      sendStatusUpdate('Processing binary outputs...');
      console.log('🟡🟡🟡 CHAT ROUTE: Found binary outputs to process 🟡🟡🟡');
      
      for (const binaryOutput of (messages as any).binaryOutputs) {
        // Use artifact service to get processed artifacts
        const processedArtifacts = artifactService.processBinaryOutput(binaryOutput, 0);
        console.log('[CHAT:ARTIFACTS] Processed', processedArtifacts.length, 'artifacts from binary output');
        
        // Convert each processed artifact to the standard format
        for (const artifact of processedArtifacts) {
          artifactsToAdd.push({
            type: artifact.type,
            title: artifact.title,
            content: artifact.content,
            language: artifact.language
          });
        }
      }
    }
    
    // Apply all artifacts in one operation
    if (artifactsToAdd.length > 0) {
      console.log('🟡🟡🟡 CHAT ROUTE: Applying', artifactsToAdd.length, 'artifacts using unified enhancement function 🟡🟡🟡');
      
      // Log the store response before enhancement
      console.log('[MCP-OUTPUT] STORE RESPONSE BEFORE ENHANCEMENT:');
      console.log(JSON.stringify(storeResponse, null, 2));
      
      storeResponse = messageService.enhanceResponseWithArtifacts(storeResponse, artifactsToAdd);
      
      // Log the store response after enhancement
      console.log('[MCP-OUTPUT] STORE RESPONSE AFTER ENHANCEMENT:');
      console.log(JSON.stringify(storeResponse, null, 2));
      
      console.log('🟡🟡🟡 CHAT ROUTE: Enhancement complete, storeResponse now has', storeResponse.artifacts?.length || 0, 'artifacts 🟡🟡🟡');
    } else {
      console.log('🟡🟡🟡 CHAT ROUTE: No artifacts to add, skipping enhancement 🟡🟡🟡');
    }

    // Log response
    loggingService.logResponse(res);

    sendStatusUpdate('Finalizing response...');
    
    // Final tool calling log
    logToolCall('SESSION_COMPLETE', {
      totalMessages: messages.length,
      finalArtifactCount: storeResponse.artifacts?.length || 0,
      sessionSummary: 'Tool calling session completed successfully'
    });

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
    
    // Log the error in our tool calling log
    logToolCall('ERROR', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString()
    });
    
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