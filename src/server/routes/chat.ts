import express, { Request, Response } from 'express';
import { Anthropic } from '@anthropic-ai/sdk';
import { systemPrompt } from '../systemPrompt';
import { MCPService } from '../services/mcp';
import { MessageService, ChatMessage, StoreFormat } from '../services/message';
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
  
  try {
    // Log the incoming request (this will create a new chat log session)
    loggingService.logRequest(req);

    const { message, history, blockedServers = [], pinnedGraph } = req.body;
    let messages: ChatMessage[] = [...history, { role: 'user', content: message }];
    let isSequentialThinkingComplete = false;

    // If there's a pinned graph, add it to the context
    if (pinnedGraph) {
      console.log('\n=== PINNED GRAPH DETECTED ===');
      console.log('Graph ID:', pinnedGraph.id);
      console.log('Graph Title:', pinnedGraph.title);
      
      // Add an assistant message about the pinned graph instead of a system message
      messages.push({
        role: 'assistant',
        content: `I notice you've pinned a knowledge graph titled "${pinnedGraph.title}". I'll reference this graph in my responses.`
      });
      
      // Add the graph content as a user message
      messages.push({
        role: 'user',
        content: `Here is the knowledge graph I've pinned for reference:\n\`\`\`json\n${
          typeof pinnedGraph.content === 'string' 
            ? pinnedGraph.content 
            : JSON.stringify(pinnedGraph.content, null, 2)
        }\n\`\`\``
      });
    }

    // First phase: Sequential thinking and tool usage
    while (!isSequentialThinkingComplete) {
      // Get MCP tools if available
      let tools = [];
      if (req.app.locals.mcpService) {
        tools = await req.app.locals.mcpService.getAllAvailableTools(blockedServers);
      }

      // Make Anthropic call for next thought/tool use
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
          
          // console.log('\n=== TOOL EXECUTION DETAILS ===');
          // console.log(`Tool Selected: ${content.name} (Original name: ${originalToolName})`);
          // console.log('Tool Input:', JSON.stringify(content.input, null, 2));

          // Execute tool
          const toolResult = await mcpService.callTool(serverName, toolName, content.input as Record<string, unknown>);

          // console.log('\n=== TOOL EXECUTION RESPONSE ===');
          // console.log('Raw Tool Result:', JSON.stringify(toolResult, null, 2));

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
              // console.log('\n=== PROCESSED TOOL RESULT ===');
              // console.log('Text Content Found:', textContent.text);

              messages.push({
                role: 'user',
                content: [{ type: 'text', text: textContent.text }]
              });

              // Check if this was sequential thinking tool
              if (content.name.includes('sequential-thinking')) {
                try {
                  const result = JSON.parse(textContent.text);
                  isSequentialThinkingComplete = !result.nextThoughtNeeded;
                  // console.log('\n=== SEQUENTIAL THINKING STATUS ===');
                  // console.log('Next thought needed:', result.nextThoughtNeeded);
                  // console.log('Current thought number:', result.thoughtNumber);
                  // console.log('Total thoughts planned:', result.totalThoughts);
                } catch (error) {
                  console.error('Error parsing sequential thinking result:', error);
                  isSequentialThinkingComplete = true;
                }
              }
            }

            // Handle bibliography if present
            if ('bibliography' in toolResult && toolResult.bibliography) {
              // console.log('\n=== BIBLIOGRAPHY DATA ===');
              // console.log(JSON.stringify(toolResult.bibliography, null, 2));
              
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
              // Add this logging
              // console.log('\n=== CHECKING FOR KNOWLEDGE GRAPH ARTIFACTS ===');
              // console.log(`Tool has ${toolResult.artifacts.length} artifacts`);
              // toolResult.artifacts.forEach((a, i) => {
              //   console.log(`Artifact ${i+1} type: ${a.type}`);
              // });
              
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
              // console.log('\n=== BINARY OUTPUT DATA ===');
              const binaryOutput = toolResult.binaryOutput as BinaryOutput;
              // console.log('Type:', binaryOutput.type);
              // console.log('Metadata:', JSON.stringify(binaryOutput.metadata, null, 2));
              
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
    // console.log('\n=== PREPARING FINAL RESPONSE ===');
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

    // Log the response formatting results
    // console.log('\n=== RESPONSE FORMATTING RESULTS ===');
    // console.log('Raw Response:', response);
    // console.log('stringify Raw Response:', JSON.stringify(response, null, 2));

    // Process and validate response
    if (response.content[0].type !== 'tool_use') {
      throw new Error('Expected tool_use response from Claude');
    }

    const toolResponse = response.content[0];
    if (toolResponse.type !== 'tool_use' || toolResponse.name !== 'response_formatter') {
      throw new Error('Expected response_formatter tool response');
    }

    // Log the formatted response
    // console.log('\n=== FORMATTED RESPONSE ===');
    // console.log('Tool Response:', JSON.stringify(toolResponse, null, 2));

    // Convert to store format
    let storeResponse = messageService.convertToStoreFormat(toolResponse as any);
    
    // Log the store format
    // console.log('\n=== STORE FORMAT ===');
    // console.log('Store Response:', JSON.stringify(storeResponse, null, 2));

    // Add bibliography if present
    if ((messages as any).bibliography) {
      storeResponse = messageService.formatResponseWithBibliography(
        storeResponse, 
        (messages as any).bibliography
      );
    }

    // Add knowledge graph if present
    if ((messages as any).knowledgeGraph) {
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
    } else {
      // console.log('\n=== NO KNOWLEDGE GRAPH TO ADD ===');
      // console.log('messages.knowledgeGraph is not present');
    }

    // Add binary outputs if present
    if ((messages as any).binaryOutputs) {
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

    // Add this logging before processing tool results
    // console.log('\n=== TOOL RESULTS OVERVIEW ===');
    // console.log(`Tool results available: ${storeResponse.artifacts ? storeResponse.artifacts.length : 0}`);
    // if (storeResponse.artifacts && storeResponse.artifacts.length > 0) {
    //   storeResponse.artifacts.forEach((artifact, index) => {
    //     console.log(`Artifact ${index + 1}:`);
    //     console.log(`- ID: ${artifact.id}`);
    //     console.log(`- Type: ${artifact.type}`);
    //     console.log(`- Title: ${artifact.title || 'untitled'}`);
    //     console.log(`- Has artifactId: ${!!artifact.artifactId}`);
    //   });
    // }

    // Find where the final response is being prepared
    // Add before returning the response:
    // console.log('\n=== FINAL RESPONSE ARTIFACTS ===');
    // if (storeResponse.artifacts) {
    //   console.log(`Total artifacts: ${storeResponse.artifacts.length}`);
    //   storeResponse.artifacts.forEach((artifact, index) => {
    //     console.log(`Artifact ${index + 1}:`);
    //     console.log(`- ID: ${artifact.id}`);
    //     console.log(`- Type: ${artifact.type}`);
    //     console.log(`- Title: ${artifact.title || 'untitled'}`);
    //     console.log(`- Has artifactId: ${!!artifact.artifactId}`);
    //   });
    // }

    // Send response
    res.json({ response: storeResponse });

  } catch (error) {
    loggingService.logError(error as Error);
    res.status(500).json({
      error: 'Failed to process chat message',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router; 