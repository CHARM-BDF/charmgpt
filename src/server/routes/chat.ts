import express, { Request, Response } from 'express';
import { Anthropic } from '@anthropic-ai/sdk';
import { systemPrompt } from '../systemPrompt';
import { MCPService } from '../services/mcp';
import { MessageService, ChatMessage } from '../services/message';
import { ArtifactService, BinaryOutput } from '../services/artifact';
import { LoggingService } from '../services/logging';
import path from 'path';

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
}>, res: Response) => {
  const loggingService = req.app.locals.loggingService as LoggingService;
  
  try {
    // Log the incoming request (this will create a new chat log session)
    loggingService.logRequest(req);

    const { message, history, blockedServers = [] } = req.body;
    let messages: ChatMessage[] = [...history, { role: 'user', content: message }];
    let isSequentialThinkingComplete = false;

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
          
          console.log('\n=== TOOL EXECUTION DETAILS ===');
          console.log(`Tool Selected: ${content.name} (Original name: ${originalToolName})`);
          console.log('Tool Input:', JSON.stringify(content.input, null, 2));

          // Execute tool
          const toolResult = await mcpService.callTool(serverName, toolName, content.input as Record<string, unknown>);

          console.log('\n=== TOOL EXECUTION RESPONSE ===');
          console.log('Raw Tool Result:', JSON.stringify(toolResult, null, 2));

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
              console.log('\n=== PROCESSED TOOL RESULT ===');
              console.log('Text Content Found:', textContent.text);

              messages.push({
                role: 'user',
                content: [{ type: 'text', text: textContent.text }]
              });

              // Check if this was sequential thinking tool
              if (content.name.includes('sequential-thinking')) {
                try {
                  const result = JSON.parse(textContent.text);
                  isSequentialThinkingComplete = !result.nextThoughtNeeded;
                  console.log('\n=== SEQUENTIAL THINKING STATUS ===');
                  console.log('Next thought needed:', result.nextThoughtNeeded);
                  console.log('Current thought number:', result.thoughtNumber);
                  console.log('Total thoughts planned:', result.totalThoughts);
                } catch (error) {
                  console.error('Error parsing sequential thinking result:', error);
                  isSequentialThinkingComplete = true;
                }
              }
            }

            // Handle bibliography if present
            if ('bibliography' in toolResult && toolResult.bibliography) {
              console.log('\n=== BIBLIOGRAPHY DATA ===');
              console.log(JSON.stringify(toolResult.bibliography, null, 2));
              
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

            // Handle binary output if present
            if ('binaryOutput' in toolResult && toolResult.binaryOutput) {
              console.log('\n=== BINARY OUTPUT DATA ===');
              const binaryOutput = toolResult.binaryOutput as BinaryOutput;
              console.log('Type:', binaryOutput.type);
              console.log('Metadata:', JSON.stringify(binaryOutput.metadata, null, 2));
              
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
    console.log('\n=== PREPARING FINAL RESPONSE ===');
    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 4000,
      messages: messageService.convertChatMessages(messages) as any,
      system: systemPrompt,
      temperature: 0.7,
      tools: [{
        name: "response_formatter",
        description: "Format all responses in a consistent JSON structure",
        input_schema: {
          type: "object",
          properties: {
            thinking: {
              type: "string",
              description: "Optional internal reasoning process, formatted in markdown"
            },
            conversation: {
              type: "array",
              description: "Array of conversation segments and artifacts in order of appearance",
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
                          "application/vnd.bibliography"
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
    let storeResponse = messageService.convertToStoreFormat(toolResponse as any);
    
    // Add bibliography if present
    if ((messages as any).bibliography) {
      storeResponse = messageService.formatResponseWithBibliography(
        storeResponse, 
        (messages as any).bibliography
      );
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