import express, { Request, Response } from 'express';
import { Ollama } from 'ollama';
import { inspect } from 'node:util';
import { Agent } from 'undici';
import { MCPService } from '../services/mcp';
import { LoggingService } from '../services/logging';

const router = express.Router();

// Add toolNameMapping before the types
const toolNameMapping = new Map<string, string>();

// Define types for MCP tools
interface MCPTool {
  name: string;
  description?: string;
  input_schema: {
    type: string;
    properties?: Record<string, unknown>;
    required?: string[];
  };
}

interface MCPToolResponse {
  tools: MCPTool[];
}

interface ParameterProperty {
  type: string;
  description: string;
  enum?: string[];
}

interface OllamaFunction {
  name: string;
  description: string;
  parameters: {
    type: string;
    required: string[];
    properties: {
      [key: string]: ParameterProperty;
    };
  };
}

interface OllamaTool {
  type: 'function';
  function: OllamaFunction;
}

const noTimeoutFetch = (input: any, init?: any) => {
  const someInit = init || {};
  return fetch(input, {
    ...someInit,
    dispatcher: new Agent({ headersTimeout: 2700000 }),
  });
};

// Build Ollama connection URL from environment variables
const ollamaBase = process.env.OLLAMA_BASE || 'http://localhost';
const ollamaPort = process.env.OLLAMA_PORT || '11434';
const REMOTE_HOST = `${ollamaBase}:${ollamaPort}`;
const ollama = new Ollama({ host: REMOTE_HOST, fetch: noTimeoutFetch });

// Make responses more deterministic
const ollamaOptions = {
  temperature: 0.2,
};

const verbose = true;
const log = function (message: any) {
  if (verbose) {
    console.log('\n=== OLLAMA DEBUG ===\n', message, '\n==================\n');
  }
};

// Convert MCP tools to Ollama format
const convertToolsToOllamaFormat = (mcpTools: MCPToolResponse): OllamaTool[] => {
  return mcpTools.tools.map(tool => {
    // Ensure properties match the required format
    const properties: { [key: string]: ParameterProperty } = {};
    const required: string[] = [];

    // Convert properties to the correct format
    if (tool.input_schema.properties) {
      Object.entries(tool.input_schema.properties).forEach(([key, value]) => {
        if (typeof value === 'object' && value !== null) {
          properties[key] = {
            type: (value as any).type || 'string',
            description: (value as any).description || key,
          };
          // Assume all properties are required for now
          required.push(key);
        }
      });
    }

    return {
      type: 'function' as const,
      function: {
        name: tool.name, // Keep original name
        description: tool.description || tool.name,
        parameters: {
          type: 'object',
          required,
          properties
        }
      }
    };
  });
};

// Handle responses which may include a request to run a function
async function handleResponse(
  mcpService: MCPService,
  loggingService: LoggingService,
  messages: any[], 
  response: any, 
  tools: OllamaTool[]
) {
  loggingService.log('info', '=== Processing Ollama Response ===');
  loggingService.log('debug', 'Response content:', response.message);
  
  // push the models response to the chat
  messages.push(response.message);

  // Try to parse tool calls from the response
  let toolCalls = [];
  
  // Check if response contains tool calls in the expected format
  if (response.message.tool_calls && response.message.tool_calls.length > 0) {
    toolCalls = response.message.tool_calls;
  } else if (response.message.content) {
    // Try to parse tool call from content if it's a JSON string
    try {
      const parsedContent = JSON.parse(response.message.content);
      if (parsedContent.terms || parsedContent.arguments) {
        // Find the pubmed-search tool
        const pubmedTool = tools.find(t => t.function.name.includes('pubmed:search'));
        if (pubmedTool) {
          toolCalls = [{
            function: {
              name: pubmedTool.function.name,
              arguments: parsedContent
            }
          }];
          loggingService.log('debug', `Created tool call for ${pubmedTool.function.name} with arguments:`, parsedContent);
        }
      }
    } catch (e) {
      loggingService.log('debug', 'Content is not a JSON tool call');
    }
  }

  if (toolCalls.length > 0) {
    for (const tool of toolCalls) {
      loggingService.log('info', '=== Tool Call Detected ===');
      loggingService.log('debug', 'Tool details:', {
        name: tool.function.name,
        arguments: tool.function.arguments
      });

      try {
        const [serverName, toolName] = tool.function.name.split(':');
        loggingService.log('debug', `Executing tool on server: ${serverName}, tool: ${toolName}`);

        // Ensure arguments is an object
        const args = typeof tool.function.arguments === 'string' 
          ? JSON.parse(tool.function.arguments)
          : tool.function.arguments;

        const funcResponse = await mcpService.callTool(serverName, toolName, args);
        loggingService.log('debug', 'Tool execution response:', funcResponse);

        if (Array.isArray(funcResponse.content)) {
          for (const content of funcResponse.content) {
            if ('text' in content) {
              messages.push({
                role: 'tool',
                content: content.text,
              });
              loggingService.log('debug', 'Added tool response to messages:', content.text);
            }
          }
        }
      } catch (e) {
        loggingService.logError(e as Error);
        messages.push({ role: 'tool', content: `tool call failed: ${e}` });
      }

    }

    loggingService.log('info', '=== Making Follow-up Ollama Call ===');
    return handleResponse(
      mcpService,
      loggingService,
      messages,
      await ollama.chat({
        model: 'llama3.2',
        messages: messages,
        tools: tools,
        options: ollamaOptions,
      }),
      tools
    );
  } else {
    loggingService.log('info', '=== Completed Processing Response ===');
    return response;
  }
}

// Chat endpoint that matches the format expected by chatStore
router.post('/', async (req: Request<{}, {}, { 
  message: string; 
  history: Array<{ role: 'user' | 'assistant'; content: string }>;
  blockedServers?: string[];
}>, res: Response) => {
  const loggingService = req.app.locals.loggingService as LoggingService;
  
  try {
    loggingService.log('info', '=== New Ollama Chat Request ===');
    loggingService.logRequest(req);

    const { message, history, blockedServers = [] } = req.body;
    
    // Get MCPService from app locals
    const mcpService = req.app.locals.mcpService as MCPService;
    if (!mcpService) {
      throw new Error('MCPService not initialized');
    }

    // Get available tools from MCPService and convert to MCPToolResponse format
    loggingService.log('info', '=== Retrieving Available Tools ===');
    const availableTools = await mcpService.getAllAvailableTools(blockedServers);
    const mcpToolsResponse = { 
      tools: availableTools.map(tool => ({
        name: tool.name,
        description: tool.description,
        input_schema: tool.input_schema
      }))
    };
    
    loggingService.log('debug', 'Available MCP tool names:', mcpToolsResponse.tools.map(t => t.name));

    // Convert tools to Ollama format
    const tools = convertToolsToOllamaFormat(mcpToolsResponse);
    loggingService.log('debug', 'Converted Ollama tool names:', tools.map(t => t.function.name));

    // Set up messages with system prompts
    const messages = [
      {
        role: 'system',
        content: 'You are a helpful AI assistant that can use various tools to help users accomplish their tasks.',
      },
      {
        role: 'system',
        content: 'When a task requires using a tool, use the most appropriate one available.',
      },
      { role: 'system', content: 'Never mention tools or calling a tool' },
      { role: 'system', content: 'Give concise answers when possible' },
      ...history,
      { role: 'user', content: message }
    ];

    loggingService.log('info', '=== Making Initial Ollama Request ===');
    // Make the initial chat request
    const response = await ollama.chat({
      model: 'llama3.2',
      messages: messages,
      tools: tools,
      options: ollamaOptions,
    });

    loggingService.log('debug', 'Initial Ollama response:', response);

    // Handle the response and any tool calls
    const finalResponse = await handleResponse(mcpService, loggingService, messages, response, tools);
    loggingService.log('debug', 'Final response:', finalResponse);

    // Format response to match chat store expectations
    const formattedResponse = {
      response: {
        conversation: finalResponse.message.content,
        thinking: null, // Ollama doesn't support thinking output
      }
    };

    loggingService.log('info', '=== Completing Request ===');
    loggingService.logResponse(res);

    res.json(formattedResponse);

  } catch (error) {
    loggingService.logError(error as Error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Unknown error in Ollama chat'
    });
  }
});

// Test endpoint to verify tool integration
router.post('/test', async (req: Request, res: Response) => {
  const loggingService = req.app.locals.loggingService as LoggingService;
  
  try {
    loggingService.log('info', '=== Starting Ollama Test ===');
    loggingService.logRequest(req);

    // Get MCPService from app locals
    const mcpService = req.app.locals.mcpService as MCPService;
    if (!mcpService) {
      throw new Error('MCPService not initialized');
    }

    // Get available tools and convert to MCPToolResponse format
    loggingService.log('info', '=== Retrieving Test Tools ===');
    const availableTools = await mcpService.getAllAvailableTools([]);
    const mcpToolsResponse = { 
      tools: availableTools.map(tool => ({
        name: tool.name,
        description: tool.description,
        input_schema: tool.input_schema
      }))
    };
    loggingService.log('debug', 'Available MCP tool names:', mcpToolsResponse.tools.map(t => t.name));

    // Convert to Ollama format
    const tools = convertToolsToOllamaFormat(mcpToolsResponse);
    loggingService.log('debug', 'Converted Ollama tool names:', tools.map(t => t.function.name));

    // Make a test query
    const messages = [
      {
        role: 'system',
        content: 'You are a helpful AI assistant that can use various tools to help users accomplish their tasks.',
      },
      {
        role: 'user',
        content: req.body.message || 'What tools are available to me?'
      }
    ];

    loggingService.log('info', '=== Making Test Ollama Request ===');
    const response = await ollama.chat({
      model: 'llama3.2',
      messages: messages,
      tools: tools,
      options: ollamaOptions,
    });

    loggingService.log('debug', 'Initial test response:', response);

    // Handle any tool calls
    const finalResponse = await handleResponse(mcpService, loggingService, messages, response, tools);
    loggingService.log('debug', 'Final test response:', finalResponse);

    const testResults = {
      availableTools: mcpToolsResponse.tools.map(t => t.name),
      convertedTools: tools.map(t => t.function.name),
      initialResponse: response,
      finalResponse: finalResponse
    };

    loggingService.log('info', '=== Completing Test ===');
    loggingService.logResponse(res);

    res.json(testResults);

  } catch (error) {
    loggingService.logError(error as Error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error in Ollama test'
    });
  }
});

export default router;export default router;
