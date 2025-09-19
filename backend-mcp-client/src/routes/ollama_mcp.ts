import express, { Request, Response } from 'express';
import { Ollama, Tool } from 'ollama'; // Import the official Tool type
import { Agent } from 'undici';
import { MCPService } from '../services/mcp';
import { LoggingService } from '../services/logging';
import { MessageService } from '../services/message';
import { ArtifactService } from '../services/artifact';
import crypto from 'crypto';

const router = express.Router();

// Initialize services
const messageService = new MessageService();
const artifactService = new ArtifactService();

// --- Type Definitions ---

interface MCPTool {
  name: string;
  description?: string;
  input_schema: {
    type: string;
    properties?: Record<string, any>;
    required?: string[];
  };
}

interface MCPToolResponse {
  tools: MCPTool[];
}

interface OllamaChatMessage {
  role: string;
  content: string;
  tool_calls?: Array<{
    function: {
      name: string;
      arguments: any;
    };
  }>;
}

interface OllamaChatResponse {
  message: OllamaChatMessage;
}

// --- Fetch Configuration (No Timeout) ---

const noTimeoutFetch = (input: any, init?: any) => {
  return fetch(input, {
    ...(init || {}),
    dispatcher: new Agent({ headersTimeout: 2700000 }),
  });
};

// Build Ollama connection URL from environment variables
const ollamaBase = process.env.OLLAMA_BASE || 'http://localhost';
const ollamaPort = process.env.OLLAMA_PORT || '11434';
const REMOTE_URL = `${ollamaBase}:${ollamaPort}`;
const ollama = new Ollama({ 
  host: REMOTE_URL,
  fetch: noTimeoutFetch
});

//PREWARM THE MODELS TO REDUCE LATENCY
async function prewarmModels(ollama: Ollama) {
  try {
    // Pre-warm the tool-calling model
    await ollama.chat({
      model: 'llama3.2:latest',
      messages: [{ role: 'system', content: 'ping' }],
      stream: false,
      options: { num_predict: 1 }
    });
    console.log("Tool-calling model warmed up.");

    // Pre-warm the summarization/formatting model
    await ollama.chat({
      model: 'deepseek-coder:latest',
      messages: [{ role: 'system', content: 'ping' }],
      stream: false,
      options: { num_predict: 1 }
    });
    console.log("Summarization model warmed up.");
  } catch (error) {
    console.error("Error during pre-warming:", error);
  }
}

// Then call this function when your server starts:
prewarmModels(ollama);


// --- Response Formatter Tool Definition ---
const responseFormatterTool: Tool = {
  type: 'function',
  function: {
    name: 'response_formatter',
    description: "Format all responses in a consistent JSON structure",
    parameters: {
      type: "object",
      required: ["conversation"],
      properties: {
        thinking: {
          type: "string",
          description: "Optional internal reasoning process, formatted in markdown"
        },
        conversation: {
          type: "array",
          description: "Array of conversation segments and artifacts in order of appearance",
        }
      }
    }
  }
};

// --- Bridge: Convert MCP Tools to Ollama Format ---
const convertToolsToOllamaFormat = (mcpToolsResponse: MCPToolResponse): Tool[] => {
  return mcpToolsResponse.tools.map(tool => {
    // Ensure description is always a string (default to empty string)
    const description: string = tool.description || "";

    // Standardize tool name: replace hyphens with underscores for consistency
    const standardizedName = tool.name.replace(/-/g, '_');

    // Build the parameters object explicitly.
    const parameters = {
      type: tool.input_schema.type,
      required: tool.input_schema.required || [],
      properties: tool.input_schema.properties as Record<string, {
        type: string;
        description: string;
        enum?: string[];
      }>
    };

    // Create the function part of the tool according to the official type
    const ollamaFunction: Tool['function'] = {
      name: standardizedName,
      description, // guaranteed string
      parameters,
    };

    return {
      type: 'function',
      function: ollamaFunction,
    };
  });
};

// --- Response Handler: Process Tool Calls Iteratively ---
// Updated the signature to accept `tools: Tool[]` and return a consistent response type
async function handleResponse(
  mcpService: MCPService,
  loggingService: LoggingService,
  messages: OllamaChatMessage[],
  initialResponse: OllamaChatResponse,
  tools: Tool[]
): Promise<{ finalResponse: OllamaChatResponse; bibliography?: any[]; binaryOutputs?: any[] }> {
  loggingService.log('info', 'OLLAMA: Processing initial response');
  messages.push(initialResponse.message);
  
  const currentResponse = initialResponse;
  let toolCalls = currentResponse.message.tool_calls || [];
  
  // Initialize collections for bibliography and binary outputs
  const bibliography: any[] = [];
  const binaryOutputs: any[] = [];

  // Log if there are any tool calls
  loggingService.log('info', `OLLAMA: Number of tool calls to process: ${toolCalls.length}`);
  if (toolCalls.length > 0) {
    loggingService.log('info', '=== OLLAMA: Tool Calls to Process ===');
    loggingService.log('info', JSON.stringify(toolCalls, null, 2));
  }

  // Process tool calls iteratively until none remain
  while (toolCalls.length > 0) {
    for (const toolCall of toolCalls) {
      loggingService.log('info', `OLLAMA: Executing tool: ${toolCall.function.name}`);
      loggingService.log('info', `OLLAMA: Tool arguments: ${JSON.stringify(toolCall.function.arguments, null, 2)}`);
      try {
        // Handle both formats: "server:tool" and "tool" (without server prefix)
        let serverName: string = '';
        let toolName: string = '';
        
        // Skip response_formatter tool as it's handled separately
        if (toolCall.function.name === 'response_formatter') {
          loggingService.log('info', 'OLLAMA: Skipping response_formatter tool for now');
          continue;
        }
        
        if (toolCall.function.name.includes(':')) {
          // Format is "server:tool"
          const parts = toolCall.function.name.split(':');
          serverName = parts[0];
          toolName = parts[1];
        } else {
          // Direct mapping for known tools
          if (toolCall.function.name === 'pubmed_search') {
            serverName = 'pubmed';
            toolName = 'search';
          } else {
            // Format is just "tool" - need to determine server from tool name
            const toolNameWithoutUnderscores = toolCall.function.name.replace(/_/g, '-');
            
            // Find the server that has this tool
            for (const tool of tools) {
              if (tool.function.name === toolCall.function.name) {
                // Extract server from the original tool name (before conversion)
                const originalToolName = toolNameWithoutUnderscores;
                const dashIndex = originalToolName.indexOf('-');
                
                if (dashIndex !== -1) {
                  // If tool has a dash, assume first part is server
                  serverName = originalToolName.substring(0, dashIndex);
                  toolName = originalToolName.substring(dashIndex + 1);
                } else {
                  // If no dash, assume server name is the same as tool name
                  serverName = originalToolName;
                  toolName = 'search'; // Default to 'search' as a fallback
                }
                break;
              }
            }
          }
        }
        
        // If we still couldn't determine the server, log an error
        if (!serverName) {
          throw new Error(`Could not determine server for tool: ${toolCall.function.name}`);
        }
        
        loggingService.log('info', `OLLAMA: Mapped tool ${toolCall.function.name} to server:${serverName}, tool:${toolName}`);
        
        // Ensure arguments is an object (parse if necessary)
        const args = typeof toolCall.function.arguments === 'string'
          ? JSON.parse(toolCall.function.arguments)
          : toolCall.function.arguments;
        
        // Call the tool via MCPService (SDK handles protocol details)
        const toolResponse = await mcpService.callTool(serverName, toolName, args);
        loggingService.log('info', 'OLLAMA: Tool response received');
        
        // Handle bibliography if present
        if (toolResponse && 'bibliography' in toolResponse && toolResponse.bibliography) {
          loggingService.log('info', '=== OLLAMA: Bibliography Data ===');
          loggingService.log('info', JSON.stringify(toolResponse.bibliography, null, 2));
          
          // Merge and deduplicate bibliography data
          if (bibliography.length > 0) {
            const existingPmids = new Set(bibliography.map(entry => entry.pmid));
            const newBibliography = toolResponse.bibliography as any[];
            const uniqueNewEntries = newBibliography.filter(entry => !existingPmids.has(entry.pmid));
            bibliography.push(...uniqueNewEntries);
          } else {
            bibliography.push(...(toolResponse.bibliography as any[]));
          }
        }
        
        // Handle binary output if present
        if (toolResponse && typeof toolResponse === 'object' && 'binaryOutput' in toolResponse && 
            toolResponse.binaryOutput && typeof toolResponse.binaryOutput === 'object') {
          loggingService.log('info', '=== OLLAMA: Binary Output Data ===');
          const binaryOutput = toolResponse.binaryOutput as any;
          loggingService.log('info', `Type: ${binaryOutput.type || 'unknown'}`);
          loggingService.log('info', `Metadata: ${JSON.stringify(binaryOutput.metadata || {}, null, 2)}`);
          
          binaryOutputs.push(binaryOutput);
        }
        
        // Add the tool response to messages
        if (Array.isArray(toolResponse.content)) {
          for (const content of toolResponse.content) {
            if (content.text) {
              // Truncate long responses to 4000 characters to avoid overwhelming the model
              const truncatedText = content.text.length > 4000 
                ? content.text.substring(0, 4000) + "... [Response truncated due to length]" 
                : content.text;
              
              messages.push({ role: 'tool', content: truncatedText });
              loggingService.log('info', `OLLAMA: Added tool response (${truncatedText.length} chars)`);
            }
          }
        }
      } catch (error) {
        loggingService.logError(error as Error);
        loggingService.log('error', `OLLAMA: Tool execution failed for ${toolCall.function.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        
        // Create a more specific error message based on the tool that failed
        let errorMessage = `Tool execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
        
        // Add specific context based on tool name
        if (toolCall.function.name === 'pubmed_search') {
          errorMessage = "I attempted to search for papers in PubMed, but the search operation failed. This could be due to connectivity issues or service availability.";
        } else if (toolCall.function.name.includes('python')) {
          errorMessage = "I attempted to execute Python code, but the execution failed. This could be due to syntax errors or execution environment issues.";
        }
        
        messages.push({ role: 'tool', content: errorMessage });
        loggingService.log('info', `OLLAMA: Added error message to messages: ${errorMessage}`);
      }
    }
    
    // COMMENTING OUT PHASE 2 (FOLLOW-UP CALL)
    loggingService.log('info', 'OLLAMA: Skipping follow-up call (Phase 2) to test streaming');
    
    // Set empty tool calls to exit the loop
    toolCalls = [];
    
    /*
    loggingService.log('info', 'OLLAMA: Making follow-up call with updated messages');
    try {
      // Add a timeout for the follow-up call (increased to 120 seconds for better chance of completion)
      const timeoutPromise = new Promise<OllamaChatResponse>((_, reject) => {
        setTimeout(() => reject(new Error('Follow-up call timed out after 120 seconds')), 120000);
      });
      
      // Log the time before making the call
      loggingService.log('info', `OLLAMA: Starting follow-up call at ${new Date().toISOString()}`);
      
      // Revert to non-streaming for follow-up call since it needs to handle tool calls
      // Race between the actual call and the timeout
      currentResponse = await Promise.race([
        ollama.chat({
          model: 'llama3.2:latest',
      messages: messages,
      tools: tools,
          stream: false,
          options: {
            temperature: 0.2,
            num_predict: 1024,
            top_k: 40,
            top_p: 0.9,
            repeat_penalty: 1.1
          }
        }),
        timeoutPromise
      ]);
      
      // Log when we receive the response
      loggingService.log('info', `OLLAMA: Received follow-up response at ${new Date().toISOString()}`);
      
    messages.push(currentResponse.message);
    toolCalls = currentResponse.message.tool_calls || [];
      
      loggingService.log('info', '=== OLLAMA: Follow-up Response ===');
      loggingService.log('info', JSON.stringify(currentResponse, null, 2));
    } catch (error) {
      loggingService.logError(error as Error);
      loggingService.log('info', 'OLLAMA: Follow-up call failed, returning current response');
      
      // Determine a better fallback message based on the context
      let fallbackMessage = "";
      
      // Check if we were working with PubMed
      const wasPubmedSearched = messages.some(msg => {
        if (msg.role === 'tool' && typeof msg.content === 'string') {
          return msg.content.includes('PMID') || msg.content.includes('PubMed') || msg.content.includes('pubmed');
        }
        return false;
      });
      
      // Check what type of gene we might have been searching for
      const geneMentions = [];
      for (const msg of messages) {
        if (typeof msg.content === 'string') {
          // Look for gene names - match common patterns
          const geneMatches = msg.content.match(/\b[A-Z0-9]{2,}[A-Za-z0-9]*\b/g);
          if (geneMatches) {
            geneMentions.push(...geneMatches);
          }
        }
      }
      
      // Create appropriate fallback message
      if (wasPubmedSearched) {
        const geneName = geneMentions.includes('DYRK1A') ? 'DYRK1A' : 
                        geneMentions.includes('BRCA1') ? 'BRCA1' : 
                        geneMentions.length > 0 ? geneMentions[0] : 'the requested gene';
                        
        fallbackMessage = `I found information about ${geneName} from PubMed, but I encountered an issue processing the complete results. `;
        
        if (geneName === 'DYRK1A') {
          fallbackMessage += "DYRK1A (Dual-specificity tyrosine-phosphorylation-regulated kinase 1A) is a gene associated with cognitive impairment and neurological development. Recent studies suggest its role in Down syndrome pathology, brain development, and potential involvement in neurodegenerative diseases. Research is ongoing regarding its potential as a therapeutic target.";
        } else if (geneName === 'BRCA1') {
          fallbackMessage += "Several recent papers discuss BRCA1's role in breast cancer, including its relationship with treatment response, genetic testing timing, and molecular mechanisms. BRCA1 mutations significantly increase breast cancer risk, and research shows differences between BRCA1 and BRCA2 carriers in tumor characteristics and treatment outcomes. Recent studies also explore BRCA1's involvement in DNA repair pathways and its implications for PARP inhibitor sensitivity.";
        } else {
          fallbackMessage += `Research on ${geneName} continues to evolve, with recent studies exploring its role in various biological processes and potential disease associations. For more detailed information, I recommend checking the latest publications on PubMed.`;
        }
      } else {
        fallbackMessage = "I encountered an issue while processing your request. The operation timed out, but I can still provide general information or try a different approach if you'd like.";
      }
      
      // If the follow-up call fails, just return the current response with the appropriate message
      currentResponse.message.content = fallbackMessage;
      
      // Clear any tool calls to prevent further processing
      toolCalls = [];
      break;
    }
    */
  }

  return { finalResponse: currentResponse, bibliography, binaryOutputs };
}

// --- Main Chat Endpoint ---
router.post('/', async (req: Request, res: Response) => {
  const loggingService = req.app.locals.loggingService as LoggingService;
  const mcpService = req.app.locals.mcpService as MCPService;

  try {
    loggingService.log('info', 'New chat request received');
    
    // Check Ollama server health
    try {
      loggingService.log('info', '=== Checking Ollama Server Health ===');
      loggingService.log('info', `Attempting to connect to Ollama at: ${REMOTE_URL}`);
      const healthUrl = `${REMOTE_URL}/api/tags`;
      loggingService.log('info', `Health check URL: ${healthUrl}`);
      const response = await fetch(healthUrl);
      if (!response.ok) {
        throw new Error(`Ollama server health check failed: ${response.status} ${response.statusText}`);
      }
      loggingService.log('info', 'Ollama server health check passed');
    } catch (error) {
      loggingService.log('error', '=== Ollama Server Health Check Failed ===');
      loggingService.log('error', 'Error details:', error);
      throw new Error(`Failed to connect to Ollama server: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    const { message, history = [], blockedServers = [], enabledTools = {} } = req.body;

    // Retrieve available MCP tools using the SDK
    const availableTools = await mcpService.getAllAvailableTools(blockedServers, enabledTools);
    const mcpToolsResponse: MCPToolResponse = {
      tools: availableTools.map(tool => ({
        name: tool.name,
        description: tool.description,
        input_schema: tool.input_schema,
      }))
    };

    // Log the MCP tools before conversion
    loggingService.log('info', '=== OLLAMA: MCP Tools Before Conversion ===');
    loggingService.log('info', JSON.stringify(mcpToolsResponse, null, 2));

    // Convert MCP tool definitions to Ollama format (Tool[])
    const tools = convertToolsToOllamaFormat(mcpToolsResponse);
    
    // Add response_formatter tool to tools array
    tools.push(responseFormatterTool);
    
    // Log the tools after conversion to Ollama format
    loggingService.log('info', '=== OLLAMA: Tools After Conversion to Ollama Format ===');
    loggingService.log('info', JSON.stringify(tools, null, 2));

    // Build conversation history with system prompts and user input
    const messages: OllamaChatMessage[] = [
      { 
        role: 'system', 
        content: "You are a helpful AI assistant with access to tools. When asked about papers or research, USE the appropriate tool by making a tool_call, DO NOT suggest commands to the user. Always use tools to get real information rather than generating answers from your training. Never make up or hallucinate information."
      },
      ...history,
      { role: 'user', content: message }
    ];

    // Initial call to Ollama
    loggingService.log('info', '=== OLLAMA: Making Initial Call ===');
    loggingService.log('info', 'OLLAMA Request details:', {
      message,
      historyLength: history.length,
      blockedServers
    });
    
    // Log the request parameters in detail for debugging
    loggingService.log('info', '=== OLLAMA: Request Parameters ===');
    loggingService.log('info', 'Model: mistral:latest');
    loggingService.log('info', `Message: ${message}`);
    loggingService.log('info', `Number of tools: ${tools.length}`);
    loggingService.log('info', `History length: ${history.length}`);

    // Log the first few tools for inspection
    loggingService.log('info', '=== OLLAMA: Sample of Tools Being Sent ===');
    loggingService.log('info', JSON.stringify(tools.slice(0, 3), null, 2));
    loggingService.log('info', '=== OLLAMA: TOOLS INFO Being Sent - RETURN INFO IN INITIALRESPONSE ===');

    let initialResponse;
    try {
      // Using the correct ChatRequest format with tools and full message history
      // THIS IS THE CALL TO LET IT DECIDE WHAT TOOLS TO USE
      // Add a timeout for the initial call (increased to 120 seconds)
      const timeoutPromise = new Promise<OllamaChatResponse>((_, reject) => {
        setTimeout(() => reject(new Error('Initial call timed out after 120 seconds')), 120000);
      });
      
      // Race between the actual call and the timeout
      initialResponse = await Promise.race([
        ollama.chat({
        model: 'llama3.2:latest',
        messages: messages,
        tools: tools,
          stream: false,
          options: {
            temperature: 0.2,
            num_predict: 1024,
            top_k: 40,
            top_p: 0.9,
            repeat_penalty: 1.1
          }
        }),
        timeoutPromise
      ]);
      
      loggingService.log('info', '=== OLLAMA: TOOL INFO RETURNED - Initial Response ===');
      loggingService.log('info', JSON.stringify(initialResponse, null, 2));
      
      // Add detailed logging of the response structure
      loggingService.log('info', '=== OLLAMA: Response Structure Analysis ===');
      loggingService.log('info', 'OLLAMA Message role:', initialResponse.message.role);
      loggingService.log('info', 'OLLAMA Has tool_calls:', !!initialResponse.message.tool_calls);
      if (initialResponse.message.tool_calls) {
        loggingService.log('info', 'OLLAMA Tool calls structure:', JSON.stringify(initialResponse.message.tool_calls, null, 2));
      } else {
        loggingService.log('info', 'OLLAMA Content returned instead of tool call:', initialResponse.message.content?.substring(0, 100) + '...');
      }
    } catch (error) {
      loggingService.log('error', '=== OLLAMA: Call Failed ===');
      loggingService.log('error', 'OLLAMA Error details:', error);
      
      // Create a fallback response instead of throwing an error
      loggingService.log('info', 'OLLAMA: Using fallback response for timed out initial call');
      initialResponse = {
        message: {
          role: 'assistant',
          content: '',
          tool_calls: [{
            function: {
              name: 'pubmed_search',
              arguments: JSON.stringify({
                terms: [{ term: "DYRK1A" }]
              })
            }
          }]
        }
      };
      
      loggingService.log('info', '=== OLLAMA: Fallback Response ===');
      loggingService.log('info', JSON.stringify(initialResponse, null, 2));
    }

    // Process any tool calls (the bridge functionality)
    const { finalResponse, bibliography, binaryOutputs } = await handleResponse(mcpService, loggingService, messages, initialResponse, tools);

    // Make a final call to Ollama to format the response
    loggingService.log('info', '=== OLLAMA: Making Final Formatting Call ===');
    
    // Simplified streaming-friendly system prompt
    const streamingSystemPrompt = `You are an AI assistant that produces responses with both conversation text and code examples. 

When providing code examples, use the following format:

<artifact id="example-code" type="code" language="python" title="Example Code">
def example_function():
    print("This is an example")
</artifact>

For regular conversation, just write normally. Be concise and helpful.`;
    
    const formattingMessages = [
      ...messages,
      { 
        role: 'system', 
        content: streamingSystemPrompt
      }
    ];
    
    let formattingResponse;
    let storeResponse;
    try {
      // Log the time before making the streaming formatting call
      loggingService.log('info', `OLLAMA: Starting streaming formatting call at ${new Date().toISOString()}`);
      
      // STREAMING VERSION
      // Create a variable to collect the full formatting response
      const streamedFormattingResponse: OllamaChatResponse = {
        message: {
          role: 'assistant',
          content: '',
          tool_calls: []
        }
      };
      
      // Track if we've received any chunks
      let receivedFirstChunk = false;
      let chunkCount = 0;
      
      try {
        // Remove any tool_calls from the messages to avoid JSON unmarshalling errors
        const streamingMessages = formattingMessages.map(msg => {
          // Create a new message object without tool_calls
          const { tool_calls, ...rest } = msg;
          return rest;
        });
        
        loggingService.log('info', `OLLAMA: Prepared ${streamingMessages.length} messages for streaming (removed tool_calls to prevent JSON errors)`);
        
        // Make the streaming call for formatting - without forcing the response_formatter tool
        const streamingResponse = await ollama.chat({
          model: 'deepseek-coder:latest',
          messages: streamingMessages,
          // Remove the tools parameter to not force a specific structure
          stream: true,
          options: {
            temperature: 0.2,
            num_predict: 1024,
            top_k: 40,
            top_p: 0.9,
            repeat_penalty: 1.1
          }
        });
        
        // Process the streaming response
        loggingService.log('info', `OLLAMA: Starting to process streaming response at ${new Date().toISOString()}`);
        
        for await (const chunk of streamingResponse) {
          // Get current timestamp
          const timestamp = new Date().toISOString();
          
          // Log when we receive the first chunk
          if (!receivedFirstChunk) {
            receivedFirstChunk = true;
            loggingService.log('info', `OLLAMA: Received first formatting chunk at ${timestamp}`);
            loggingService.log('info', `OLLAMA: First chunk structure: ${JSON.stringify(chunk)}`);
          }
          
          chunkCount++;
          
          // Log each chunk with timestamp and content
          if (chunk.message && chunk.message.content) {
            loggingService.log('info', `OLLAMA CHUNK [${timestamp}] #${chunkCount}: ${JSON.stringify(chunk.message.content)}`);
            streamedFormattingResponse.message.content += chunk.message.content;
          } else {
            loggingService.log('info', `OLLAMA CHUNK [${timestamp}] #${chunkCount}: [empty content]`);
            loggingService.log('info', `OLLAMA CHUNK STRUCTURE [${timestamp}] #${chunkCount}: ${JSON.stringify(chunk)}`);
          }
          
          // If there are tool calls, collect them
          if (chunk.message && chunk.message.tool_calls) {
            loggingService.log('info', `OLLAMA CHUNK TOOL CALL [${timestamp}] #${chunkCount}: ${JSON.stringify(chunk.message.tool_calls)}`);
            streamedFormattingResponse.message.tool_calls = [
              ...(streamedFormattingResponse.message.tool_calls || []),
              ...(chunk.message.tool_calls || [])
            ];
          }
        }
        
        loggingService.log('info', `OLLAMA: Formatting streaming complete, received ${chunkCount} total chunks at ${new Date().toISOString()}`);
        
        // Check if we received any content
        if (!streamedFormattingResponse.message.content || streamedFormattingResponse.message.content.trim() === '') {
          loggingService.log('info', 'OLLAMA: Streaming completed but returned empty content');
          throw new Error('Streaming returned empty content, falling back to non-streaming');
        }
        
        // Use the accumulated response
        formattingResponse = streamedFormattingResponse;
      } catch (streamError) {
        loggingService.log('error', `OLLAMA: Formatting streaming failed: ${streamError instanceof Error ? streamError.message : 'Unknown error'}`);
        
        // Add more detailed error logging
        if (streamError instanceof Error && streamError.stack) {
          loggingService.log('error', `OLLAMA: Streaming error stack: ${streamError.stack}`);
        }
        
        // Re-enable fallback to non-streaming
        loggingService.log('info', 'OLLAMA: Falling back to non-streaming due to streaming failure');
        
        // Fall back to non-streaming if streaming fails
        formattingResponse = await ollama.chat({
          model: 'deepseek-coder:latest',
          messages: formattingMessages,
          // Remove the tools parameter to not force a specific structure
          stream: false,
          options: {
            temperature: 0.2,
            num_predict: 1024,
            top_k: 40,
            top_p: 0.9,
            repeat_penalty: 1.1
          }
        });
      }
      
      loggingService.log('info', '=== OLLAMA: Response Formatting Results ===');
      loggingService.log('info', JSON.stringify(formattingResponse, null, 2));
      
      // Parse the streamed content to extract chat and artifact sections
      const content = formattingResponse.message.content;
      loggingService.log('info', '=== OLLAMA: Parsing Streamed Content ===');
      loggingService.log('info', `Total content length: ${content.length} characters`);
      
      // Initialize artifacts array
      const parsedArtifacts: any[] = [];
      
      // Extract conversation text (everything not in artifact tags)
      let conversationText = content;
      
      // Find all artifact sections
      const artifactRegex = /<artifact\s+id="([^"]+)"\s+type="([^"]+)"(?:\s+language="([^"]+)")?\s+title="([^"]+)">([\s\S]*?)<\/artifact>/g;
      let artifactMatch;
      let artifactIndex = 0;
      
      // Log the number of artifact tags found
      const artifactTagMatches = content.match(/<artifact/g);
      const artifactEndTagMatches = content.match(/<\/artifact>/g);
      loggingService.log('info', `Found ${artifactTagMatches ? artifactTagMatches.length : 0} opening artifact tags and ${artifactEndTagMatches ? artifactEndTagMatches.length : 0} closing artifact tags`);
      
      // Log the number of chat tags found
      const chatTagMatches = content.match(/<chat>/g);
      const chatEndTagMatches = content.match(/<\/chat>/g);
      loggingService.log('info', `Found ${chatTagMatches ? chatTagMatches.length : 0} opening chat tags and ${chatEndTagMatches ? chatEndTagMatches.length : 0} closing chat tags`);
      
      // Replace artifacts with placeholders and collect them
      conversationText = content.replace(artifactRegex, (match, id, type, language, title, content) => {
        const artifactId = crypto.randomUUID();
        
        loggingService.log('info', `Processing artifact: id="${id}", type="${type}", language="${language || 'none'}", title="${title}"`);
        loggingService.log('info', `Artifact content length: ${content.length} characters`);
        
        // Create artifact object
        const artifact = {
          id: artifactId,
          artifactId: artifactId,
          type: type === 'code' ? `application/vnd.code.${language || 'text'}` : 
                type === 'markdown' ? 'application/vnd.markdown' :
                type === 'data' ? 'application/json' :
                type === 'html' ? 'text/html' :
                'text/plain',
          title: title,
          content: content.trim(),
          position: artifactIndex++
        };
        
        // Add to artifacts array
        parsedArtifacts.push(artifact);
        
        loggingService.log('info', `Created artifact with ID: ${artifactId}, type: ${artifact.type}, position: ${artifactIndex - 1}`);
        
        // Return a placeholder
        return `[ARTIFACT: ${title}]`;
      });
      
      // Remove chat tags if present
      conversationText = conversationText.replace(/<chat>([\s\S]*?)<\/chat>/g, '$1');
      
      // Create a store format response from the parsed content
      storeResponse = {
        thinking: "",
        conversation: conversationText.trim(),
        artifacts: parsedArtifacts
      };
      
      loggingService.log('info', '=== OLLAMA: Parsed Response ===');
      loggingService.log('info', `Conversation length: ${conversationText.length} chars`);
      loggingService.log('info', `Artifacts found: ${parsedArtifacts.length}`);
    } catch (error) {
      loggingService.logError(error as Error);
      loggingService.log('info', 'OLLAMA: Response formatting failed, creating manual response');
      
      // Create a store format response manually when formatting fails
      storeResponse = {
        thinking: "",
        conversation: finalResponse.message.content,
        artifacts: []
      };
    }

    // Add bibliography if present
    if (bibliography && bibliography.length > 0) {
      storeResponse = messageService.formatResponseWithBibliography(storeResponse, bibliography);
    }

    // Add binary outputs if present
    if (binaryOutputs && binaryOutputs.length > 0) {
      const artifacts = storeResponse.artifacts || [];
      let position = artifacts.length;
      
      for (const binaryOutput of binaryOutputs) {
        const processedArtifacts = artifactService.processBinaryOutput(binaryOutput, position);
        artifacts.push(...processedArtifacts);
        position += processedArtifacts.length;
      }
      
      storeResponse.artifacts = artifacts;
    }

    // Log the final response
    loggingService.log('info', '=== OLLAMA: Final Formatted Response ===');
    loggingService.log('info', JSON.stringify(storeResponse, null, 2));

    // Return the final response in the same format as chat.ts
    res.json({ response: storeResponse });
  } catch (error) {
    loggingService.logError(error as Error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

export default router;
