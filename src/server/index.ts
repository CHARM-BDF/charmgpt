import express, { Request, Response } from 'express';
import cors from 'cors';
import { Anthropic } from '@anthropic-ai/sdk';
import dotenv from 'dotenv';
import { parseString } from 'xml2js';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
// Remove the custom MCPServerManager import
// import MCPServerManager from '../utils/mcpServerManager';
import { systemPrompt } from './systemPrompt';

// Import the official MCP client and a transport from the MCP SDK
import { Client as McpClient } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

// Update type imports from SDK - only keep what we use
import { 
  TextContentSchema
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';  // Keep Zod import as it's used for type inference

const parseXML = promisify(parseString);

// ES Module dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define types for XML structure
interface XMLResponse {
  response: {
    thinking?: string[];
    conversation: string[];
    artifact?: Array<{
      $: {
        type: string;
        id: string;
        title: string;
      };
      _: string;
    }>;
  };
}

// Tool definition types for Anthropic
interface AnthropicTool {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}

// Server tool definition interface (from MCP server)
interface ServerTool {
  name: string;
  description?: string;
  inputSchema?: {
    type: string;
    properties?: Record<string, unknown>;
    required?: string[];
  };
}

// Interface for tool response (used for formatting later)
interface FormatterInput {
  thinking?: string;
  conversation: Array<{
    type: 'text' | 'artifact';
    content?: string;
    artifact?: {
      type: string;
      id: string;
      title: string;
      content: string;
      language?: string;
    };
  }>;
}

// Chat message interface used in our app
interface ChatMessage {
  role: 'user' | 'assistant';
  // We'll store content as either a plain string or as an array of blocks.
  content: string | Array<{ type: string; text: string }>;
}

// Update ServerStatus interface to match store
interface ServerStatus {
    name: string;
    isRunning: boolean;
    tools?: ServerTool[];  // Changed from string[] to ServerTool[]
}

// Add interface for MCP server config
interface MCPServerConfig {
  command: string;
  args: string[];
  env?: Record<string, string>;
}

interface MCPServersConfig {
  mcpServers: Record<string, MCPServerConfig>;
}

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Add a map to store MCP clients for each server
const mcpClients = new Map<string, McpClient>();

// Bidirectional mapping for tool names
const toolNameMapping = new Map<string, string>();

// Store original console methods before any overrides
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
// const originalConsoleDebug = console.debug;

// Add logging utility
function logToFile(message: string, type: 'info' | 'error' | 'debug' = 'info') {
  const now = new Date();
  // Convert to Central Time
  const centralTime = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).format(now);

  const logDir = '/Users/andycrouse/Documents/GitHub/charm-mcp/logs/detailedserverlog';
  
  // Create logs directory if it doesn't exist
  try {
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
      originalConsoleLog(`Created log directory at: ${logDir}`);
    }
    
    const fileName = `detaillog_${centralTime.replace(/[\/:]/g, '-')}.log`;
    const logPath = path.join(logDir, fileName);
    const logEntry = `[${centralTime}] [${type.toUpperCase()}] ${message}\n`;
    
    // Append to log file
    fs.appendFileSync(logPath, logEntry);
    
    // Use the original console.log to avoid recursion
    originalConsoleLog(logEntry);
  } catch (error) {
    // Use original console to report logging errors
    originalConsoleError('Error writing to log file:', error);
  }
}

// Override console methods to also write to file
console.log = (...args: any[]) => {
  const message = args.map(arg => 
    typeof arg === 'object' ? JSON.stringify(arg, null, 2) : arg
  ).join(' ');
  logToFile(message, 'info');
};

console.error = (...args: any[]) => {
  const message = args.map(arg => 
    typeof arg === 'object' ? JSON.stringify(arg, null, 2) : arg
  ).join(' ');
  logToFile(message, 'error');
};

console.debug = (...args: any[]) => {
  const message = args.map(arg => 
    typeof arg === 'object' ? JSON.stringify(arg, null, 2) : arg
  ).join(' ');
  logToFile(message, 'debug');
};

try {
  console.log('\n=== Starting MCP Server Initialization ===');
  const mcpConfigPath = path.join(__dirname, '../config/mcp_server_config.json');
  const configContent = fs.readFileSync(mcpConfigPath, 'utf-8');
  const config = JSON.parse(configContent) as MCPServersConfig;
  
  // console.log('\nFound MCP servers in config:', Object.keys(config.mcpServers));
  
  // Track server statuses
  const serverStatuses: Record<string, boolean> = {};
  
  // Start each MCP server
  for (const [serverName, serverConfig] of Object.entries(config.mcpServers)) {
    // console.log(`\n[${serverName}] Starting server...`);
    const { command, args = [], env = {} } = serverConfig;
    
    try {
      // Create a new MCP client for this server
      const client = new McpClient(
        { name: `${serverName}-client`, version: '1.0.0' },
        { capabilities: { tools: {} } }
      );
      
      // Modify paths to be relative to project root if needed
      const modifiedArgs = args.map(arg => {
        if (arg.startsWith('./node_modules/')) {
          return arg.replace('./', '');
        }
        return arg;
      });

      // console.log(`[${serverName}] Connecting with command:`, command);
      // console.log(`[${serverName}] Using args:`, modifiedArgs);

      // Connect the client for this server
      await client.connect(new StdioClientTransport({ 
        command,
        args: modifiedArgs,
        env: {
          ...env,  // First spread config file values
          ...Object.fromEntries(  // Then spread process.env values to override
            Object.entries(process.env).filter(([_, v]) => v !== undefined)
          ) as Record<string, string>
        }
      }));

      // Store the client
      mcpClients.set(serverName, client);

      // Verify server is operational by listing its tools
      const tools = await client.listTools();
      // console.log(`[${serverName}] Tools response:`, JSON.stringify(tools, null, 2));
      
      // Handle the nested tools structure
      const toolsList = (tools.tools || []) as unknown[];
      const serverTools = toolsList
        .filter((tool: unknown) => {
          if (!tool || typeof tool !== 'object') return false;
          const t = tool as { name: string };
          if (!t.name || typeof t.name !== 'string') return false;
          // Some servers prefix their tools with serverName:
          return t.name.startsWith(`${serverName}:`) || !t.name.includes(':');
        })
        .map((tool: unknown) => (tool as { name: string }).name);

      if (serverTools.length > 0) {
        // console.log(`[${serverName}] ✅ Server started successfully with ${serverTools.length} tools:`, serverTools);
        serverStatuses[serverName] = true;
      } else {
        // console.log(`[${serverName}] ⚠️ Server started but no tools found`);
        serverStatuses[serverName] = false;
      }
    } catch (error) {
      console.error(`[${serverName}] ❌ Failed to start:`, error);
      serverStatuses[serverName] = false;
    }
  }
  
  app.listen(port, async () => {
    try {
      console.log('\n=== MCP Server Status Summary ===');
      Object.entries(serverStatuses).forEach(([name, status]) => {
        console.log(`${status ? '✅' : '❌'} ${name}: ${status ? 'Running' : 'Failed'}`);
      });

      const now = new Date();
      const timestamp = now.toLocaleString();
      console.log(`\nServer started at: ${timestamp}`);
      console.log(`API running at http://localhost:${port}`);
    } catch (error) {
      console.error('Failed to verify MCP server status:', error);
      process.exit(1);
    }
  });
} catch (error) {
  console.error('Failed to start server:', error);
  process.exit(1);
}

// Helper: Convert our ChatMessage[] into Anthropic's expected MessageParam[] format.
function convertChatMessages(messages: ChatMessage[]): { role: string; content: string | { type: "text"; text: string }[] }[] {
  return messages.map(m => {
    if (typeof m.content === 'string') {
      return { role: m.role, content: m.content };
    } else {
      // Ensure each block has type exactly "text"
      return { role: m.role, content: m.content.map(block => ({ type: "text", text: block.text })) };
    }
  });
}

// Add helper function to resolve schema references
function resolveSchemaRefs(schema: any, definitions: Record<string, any> = {}): any {
  if (!schema || typeof schema !== 'object') return schema;

  if ('$ref' in schema) {
    const refPath = schema.$ref.replace(/^#\/components\/schemas\//, '').replace(/^#\/\$defs\//, '');
    const resolved = definitions[refPath];
    if (!resolved) {
      console.error(`Failed to resolve reference: ${schema.$ref}`);
      return schema;
    }
    const { $ref, ...rest } = schema;
    return { ...resolveSchemaRefs(resolved, definitions), ...rest };
  }

  if (Array.isArray(schema)) {
    return schema.map(item => resolveSchemaRefs(item, definitions));
  }

  const result: any = {};
  for (const [key, value] of Object.entries(schema as object)) {
    if (key === 'properties' && typeof value === 'object' && value !== null) {
      result[key] = {};
      for (const [propKey, propValue] of Object.entries(value)) {
        result[key][propKey] = resolveSchemaRefs(propValue, definitions);
      }
    } else if (key === 'items' && typeof value === 'object') {
      result[key] = resolveSchemaRefs(value, definitions);
    } else if (typeof value === 'object') {
      result[key] = resolveSchemaRefs(value, definitions);
    } else {
      result[key] = value;
    }
  }
  return result;
}

// Get available tools from MCP using the MCP clients
async function getAllAvailableTools(): Promise<AnthropicTool[]> {
  let mcpTools: AnthropicTool[] = [];
  
  toolNameMapping.clear();
  
  for (const [serverName, client] of mcpClients.entries()) {
    try {
      const toolsResult = await client.listTools();
      
      if (toolsResult.tools) {
        const toolsWithPrefix = toolsResult.tools.map(tool => {
          const originalName = `${serverName}:${tool.name}`;
          const anthropicName = `${serverName}-${tool.name}`.replace(/[^a-zA-Z0-9_-]/g, '-');
          
          toolNameMapping.set(anthropicName, originalName);
          
          // Extract any schema definitions that might be present
          const definitions = tool.inputSchema.$defs || {};
          
          // Create a complete schema with definitions and properties
          const completeSchema = {
            ...tool.inputSchema,
            properties: tool.inputSchema.properties || {}
          };

          // Resolve any references in the complete schema
          const resolvedSchema = resolveSchemaRefs(completeSchema, definitions);
          
          const formattedTool: AnthropicTool = {
            name: anthropicName,
            description: tool.description || `Tool for ${tool.name} from ${serverName} server`,
            input_schema: {
              type: "object",
              properties: resolvedSchema.properties || {},
              required: Array.isArray(tool.inputSchema.required) ? tool.inputSchema.required : []
            }
          };
          
          return formattedTool;
        });
        mcpTools = mcpTools.concat(toolsWithPrefix);
      }
    } catch (error) {
      console.error(`Failed to get tools from server ${serverName}:`, error);
    }
  }
  
  return mcpTools;
}

// Strip CDATA tags from XML (for backward compatibility)
function stripCDATATags(xml: string): string {
  return xml.replace(/<!\[CDATA\[(.*?)\]\]>/gs, '$1');
}

app.post('/api/chat', async (req: Request<{}, {}, { message: string; history: Array<{ role: 'user' | 'assistant'; content: string }> }>, res: Response) => {
  try {
    const { message, history } = req.body;

    const formattedTools = await getAllAvailableTools();
    console.log('\n[DEBUG] === CHECKING TOOLS FOR ISSUES ===');
    formattedTools.forEach((tool, index) => {
      try {
        // console.log(`\n[DEBUG] Tool ${index}:`, {
        //   name: tool.name,
        //   schema: tool.input_schema,
        //   hasProperties: !!tool.input_schema.properties,
        //   schemaType: tool.input_schema.type,
        //   required: tool.input_schema.required || []
        // });
        
        // Validate schema structure
        if (tool.input_schema.type !== "object") {
          console.error(`[ERROR] Tool ${index} (${tool.name}): Schema type must be "object", got "${tool.input_schema.type}"`);
        }
        if (!tool.input_schema.properties || typeof tool.input_schema.properties !== 'object') {
          console.error(`[ERROR] Tool ${index} (${tool.name}): Missing or invalid properties`);
        }
      } catch (error) {
        console.error(`[ERROR] Tool ${index} validation failed:`, error);
      }
    });

    const messages: ChatMessage[] = [
      ...history,
      { role: 'user', content: message }
    ];
    const anthMessages = convertChatMessages(messages);

    const toolSelectionResponse = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 4000,
      messages: anthMessages as any,
      temperature: 0.7,
      tools: formattedTools,
    });

    for (const content of toolSelectionResponse.content) {
      if (content.type === 'tool_use') {
        const originalToolName = toolNameMapping.get(content.name);
        if (!originalToolName) {
          console.error(`No mapping found for tool name: ${content.name}`);
          continue;
        }

        const [serverName, toolName] = originalToolName.split(':');
        // console.log('\n[DEBUG] Calling MCP tool:', {
        //   anthropicName: content.name,
        //   originalName: originalToolName,
        //   serverName,
        //   toolName,
        //   arguments: content.input
        // });

        const client = mcpClients.get(serverName);
        if (!client) {
          console.error(`No client found for server ${serverName}`);
          continue;
        }

        try {
          const toolResult = await client.callTool({
            name: toolName,
            arguments: content.input ? content.input as Record<string, unknown> : {}
          });

          messages.push({
            role: 'assistant',
            content: [{ type: 'text', text: `Tool used: ${content.name}\nArguments: ${JSON.stringify(content.input)}` }]
          });

          if (toolResult && typeof toolResult === 'object') {
            if ('content' in toolResult && Array.isArray(toolResult.content)) {
              const textContent = toolResult.content.find((item): item is z.infer<typeof TextContentSchema> => 
                item.type === 'text' && typeof item.text === 'string'
              );
              
              if (textContent) {
                messages.push({
                  role: 'user',
                  content: [{ type: 'text', text: textContent.text }]
                });
              }
            } else {
              messages.push({
                role: 'user',
                content: [{ type: 'text', text: JSON.stringify(toolResult) }]
              });
            }

            if ('bibliography' in toolResult && toolResult.bibliography) {
              // console.log('\n[DEBUG] Raw bibliography data:', JSON.stringify(toolResult.bibliography, null, 2));
              (messages as any).bibliography = toolResult.bibliography;
            }
          } else {
            messages.push({
              role: 'user',
              content: [{ type: 'text', text: JSON.stringify(toolResult) }]
            });
          }
        } catch (error) {
          console.error(`Error calling tool ${content.name}:`, error);
          messages.push({
            role: 'user',
            content: [{ type: 'text', text: `Error: Failed to execute tool ${content.name}` }]
          });
        }
      }
    }

    const updatedAnthMessages = convertChatMessages(messages);
    // console.log('[SERVER] Sending updated conversation to Claude:', {
    //   model: 'claude-3-5-sonnet-20241022',
    //   messages: updatedAnthMessages,
    //   systemPrompt: 'main prompt',
    //   tool_choice: { type: "tool", name: "response_formatter" }
    // });

    // console.log('\n[DEBUG] Sending conversation to Claude with tool results:', JSON.stringify(messages, null, 2));
    
    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 4000,
      messages: updatedAnthMessages as any,
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

    // console.log('[SERVER] Raw response from Claude:', {
    //   type: response.content[0].type,
    //   content: response.content[0]
    // });

    if (response.content[0].type !== 'tool_use') {
      // console.log('[SERVER] Unexpected response type:', response.content[0].type);
      throw new Error('Expected tool_use response from Claude');
    }

    const toolResponse = response.content[0];
    if (toolResponse.type !== 'tool_use' || toolResponse.name !== 'response_formatter') {
      throw new Error('Expected response_formatter tool response');
    }

    // console.log('[SERVER] Tool response input:', JSON.stringify(toolResponse.input, null, 2));
    const jsonResponse = toolResponse.input as FormatterInput;

    if ((messages as any).bibliography) {
      jsonResponse.conversation.push({
        type: "artifact",
        artifact: {
          type: "application/vnd.bibliography",
          id: "bibliography",
          title: "Article References",
          content: JSON.stringify((messages as any).bibliography)
        }
      });
    }

    // console.log('[SERVER] Parsed JSON response:', JSON.stringify(jsonResponse, null, 2));

    const xmlResponseWithCDATA = convertJsonToXml(jsonResponse);
    // console.log('[SERVER] Generated XML before validation:', xmlResponseWithCDATA);

    const isValid = await isValidXMLResponse(xmlResponseWithCDATA);
    // console.log('[SERVER] XML validation result:', isValid);
    if (!isValid) {
      throw new Error('Generated XML response is invalid');
    }

    const xmlResponse = stripCDATATags(xmlResponseWithCDATA);
    // console.log('[SERVER] Final XML being sent to client:', xmlResponse);

    res.json({ response: xmlResponse });

  } catch (error) {
    console.error('Error processing request:', error);
    res.status(500).json({
      error: 'Failed to process chat message',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Convert JSON response to XML format (unchanged)
function convertJsonToXml(jsonResponse: FormatterInput): string {
  let xml = '<response>\n';
  if (jsonResponse.thinking) {
    xml += '    <thinking>\n';
    xml += `        <![CDATA[${jsonResponse.thinking}]]>\n`;
    xml += '    </thinking>\n';
  }
  xml += '    <conversation>\n';
  for (const segment of jsonResponse.conversation) {
    if (segment.type === 'text' && segment.content) {
      xml += `        <![CDATA[${segment.content}]]>\n`;
    } else if (segment.type === 'artifact' && segment.artifact) {
      const artifact = segment.artifact;
      xml += `        <artifact type="${artifact.type}" id="${artifact.id}" title="${artifact.title}"${artifact.language ? ` language="${artifact.language}"` : ''}>\n`;
      xml += `            <![CDATA[${artifact.content}]]>\n`;
      xml += '        </artifact>\n';
    }
  }
  xml += '    </conversation>\n';
  xml += '</response>';
  return xml;
}

// Simple XML validation helper (unchanged)
async function isValidXMLResponse(response: string): Promise<boolean> {
  // console.log('[SERVER] XML Validation - Input length:', response.length);
  try {
    if (!response.includes('<response>')) {
      // console.log('[SERVER] XML Validation - No XML structure found, wrapping response');
      response = `<response>\n<conversation>\n${response}\n</conversation>\n</response>`;
    }
    // console.log('[SERVER] XML Validation - Attempting to parse...');
    try {
      const result = (await parseXML(response)) as XMLResponse;
      const hasResponse = result && 'response' in result;
      const hasConversation = hasResponse && Array.isArray(result.response.conversation);
      // console.log('[SERVER] XML Validation - Structure check results:', {
      //   hasResponse,
      //   hasConversation
      // });
      return hasResponse && hasConversation;
    } catch (parseError) {
      // console.log('[SERVER] XML Validation - Parse error:', parseError);
      return false;
    }
  } catch (error) {
    console.error('[SERVER] XML Validation - Error during validation:', error);
    return false;
  }
}

// Update the server-status endpoint to use the correct client for each server
app.get('/api/server-status', async (_req: Request, res: Response) => {
    try {
        const serverStatuses: ServerStatus[] = [];
        
        // Get server names from config
        const mcpConfigPath = path.join(__dirname, '../config/mcp_server_config.json');
        const configContent = fs.readFileSync(mcpConfigPath, 'utf-8');
        const config = JSON.parse(configContent) as MCPServersConfig;
        
        for (const [serverName, _] of Object.entries(config.mcpServers)) {
            try {
                // Get the correct client for this server
                const client = mcpClients.get(serverName);
                if (!client) {
                    throw new Error('Client not found');
                }

                // Get tools for this server
                const tools = await client.listTools();
                const toolsList = (tools.tools || []).map(tool => ({
                    name: tool.name,
                    description: tool.description,
                    inputSchema: {
                        type: tool.inputSchema.type,
                        properties: tool.inputSchema.properties as Record<string, unknown>
                    }
                })) as ServerTool[];

                serverStatuses.push({
                    name: serverName,
                    isRunning: true,
                    tools: toolsList
                });
            } catch (error) {
                console.error(`Failed to get status for server ${serverName}:`, error);
                serverStatuses.push({
                    name: serverName,
                    isRunning: false,
                    tools: []
                });
            }
        }

        res.json({ servers: serverStatuses });
    } catch (error) {
        console.error('Failed to get server status:', error);
        res.status(500).json({
            error: 'Failed to get server status',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
