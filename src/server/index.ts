/**
 * MCP (Model Context Protocol) Server Implementation
 * This server acts as a bridge between the client application and various MCP-compatible model servers.
 * It handles communication with Anthropic's Claude model and manages multiple MCP server instances.
 */

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

/**
 * Type Definitions
 * These interfaces define the structure of data flowing through the system
 */

// Structure for parsed XML responses from the model
interface XMLResponse {
  response: {
    error?: string[];         // Optional error messages
    thinking?: string[];      // Optional internal reasoning process
    conversation: string[];   // Required conversation elements
    artifact?: Array<{       // Optional artifacts (code, images, etc.)
      $: {
        type: string;        // Type of artifact (code, image, etc.)
        id: string;          // Unique identifier
        title: string;       // Display title
      };
      _: string;            // Artifact content
    }>;
  };
}

// Definition for tools that can be used with Anthropic's API
interface AnthropicTool {
  name: string;               // Tool identifier
  description: string;        // Tool description
  input_schema: {            // Schema defining tool inputs
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}

// Definition for tools provided by MCP servers
interface ServerTool {
  name: string;
  description?: string;
  inputSchema?: {
    type: string;
    properties?: Record<string, unknown>;
    required?: string[];
  };
}

// Structure for formatting model responses
interface FormatterInput {
  thinking?: string;          // Optional reasoning process
  error?: string;            // Optional error message
  conversation: Array<{
    type: 'text' | 'artifact';
    content?: string;
    artifact?: {
      type: string;          // Artifact type (markdown, code, etc.)
      id: string;            // Unique identifier
      title: string;         // Display title
      content: string;       // Artifact content
      language?: string;     // Optional language specification
    };
  }>;
}

// Structure for chat messages in the application
interface ChatMessage {
  role: 'user' | 'assistant';
  content: string | Array<{ type: string; text: string }>;
}

// Server status tracking interface
interface ServerStatus {
    name: string;            // Server identifier
    isRunning: boolean;      // Operational status
    tools?: ServerTool[];    // Available tools on this server
}

// Configuration structure for MCP servers
interface MCPServerConfig {
  command: string;           // Command to start the server
  args: string[];           // Command arguments
  env?: Record<string, string>; // Optional environment variables
}

// Overall servers configuration structure
interface MCPServersConfig {
  mcpServers: Record<string, MCPServerConfig>;
}

dotenv.config();

/**
 * Express Server Setup
 * Initialize the main Express application server with necessary middleware
 */
const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Initialize Anthropic client for LLM interactions
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

/**
 * Global State Management
 * These maps and variables maintain the server's operational state
 */
// Store MCP clients for each server instance
const mcpClients = new Map<string, McpClient>();

// Maintain mapping between Anthropic-friendly tool names and original MCP tool names
const toolNameMapping = new Map<string, string>();

/**
 * Logging System Setup
 * Preserve original console methods and implement file-based logging
 */
// Store original console methods for fallback
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

/**
 * Enhanced Logging Function
 * Writes logs to both console and file with timestamps in Central Time
 * @param message - The message to log
 * @param type - Log level (info, error, or debug)
 */
function logToFile(message: string, type: 'info' | 'error' | 'debug' = 'info') {
  const now = new Date();
  // Format timestamp in Central Time
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
  
  try {
    // Ensure log directory exists
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
      originalConsoleLog(`Created log directory at: ${logDir}`);
    }
    
    const fileName = `detaillog_${centralTime.replace(/[\/:]/g, '-')}.log`;
    const logPath = path.join(logDir, fileName);
    const logEntry = `[${centralTime}] [${type.toUpperCase()}] ${message}\n`;
    
    // Write to log file and console
    fs.appendFileSync(logPath, logEntry);
    originalConsoleLog(logEntry);
  } catch (error) {
    originalConsoleError('Error writing to log file:', error);
  }
}

/**
 * Console Method Overrides
 * Enhance console methods to include file logging while maintaining original functionality
 */
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

/**
 * Server Initialization
 * Initialize MCP servers and establish connections based on configuration
 */
try {
  console.log('\n=== Starting MCP Server Initialization ===');
  
  // Load MCP server configuration from JSON file
  const mcpConfigPath = path.join(__dirname, '../config/mcp_server_config.json');
  const configContent = fs.readFileSync(mcpConfigPath, 'utf-8');
  const config = JSON.parse(configContent) as MCPServersConfig;
  
  // Track operational status of each server
  const serverStatuses: Record<string, boolean> = {};
  
  // Initialize each configured MCP server
  for (const [serverName, serverConfig] of Object.entries(config.mcpServers)) {
    try {
      // Create new MCP client instance for this server
      const client = new McpClient(
        { name: `${serverName}-client`, version: '1.0.0' },
        { capabilities: { tools: {} } }
      );
      
      // Adjust paths for node_modules if needed
      const modifiedArgs = serverConfig.args.map(arg => {
        if (arg.startsWith('./node_modules/')) {
          return arg.replace('./', '');
        }
        return arg;
      });

      // Connect client using StdioClientTransport
      await client.connect(new StdioClientTransport({ 
        command: serverConfig.command,
        args: modifiedArgs,
        env: {
          ...serverConfig.env,  // Base environment from config
          ...Object.fromEntries(  // Override with process.env values
            Object.entries(process.env).filter(([_, v]) => v !== undefined)
          ) as Record<string, string>
        }
      }));

      // Store client instance for future use
      mcpClients.set(serverName, client);

      // Verify server functionality by listing available tools
      const tools = await client.listTools();
      
      // Process and validate tool list
      const toolsList = (tools.tools || []) as unknown[];
      const serverTools = toolsList
        .filter((tool: unknown) => {
          if (!tool || typeof tool !== 'object') return false;
          const t = tool as { name: string };
          if (!t.name || typeof t.name !== 'string') return false;
          // Accept tools prefixed with serverName or without prefix
          return t.name.startsWith(`${serverName}:`) || !t.name.includes(':');
        })
        .map((tool: unknown) => (tool as { name: string }).name);

      // Update server status based on tool availability
      if (serverTools.length > 0) {
        serverStatuses[serverName] = true;
      } else {
        serverStatuses[serverName] = false;
      }
    } catch (error) {
      console.error(`[${serverName}] ❌ Failed to start:`, error);
      serverStatuses[serverName] = false;
    }
  }
  
  /**
   * Express Server Startup
   * Start the Express server and log initialization status
   */
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

/**
 * Message Conversion Utilities
 * Functions for converting between different message formats used in the system
 */

/**
 * Convert ChatMessage array to Anthropic's message format
 * Handles both string content and structured message blocks
 * @param messages - Array of chat messages to convert
 * @returns Array of messages in Anthropic's format
 */
function convertChatMessages(messages: ChatMessage[]): { role: string; content: string | { type: "text"; text: string }[] }[] {
  return messages.map(m => {
    if (typeof m.content === 'string') {
      return { role: m.role, content: m.content };
    } else {
      // Convert each block to Anthropic's expected format
      return { role: m.role, content: m.content.map(block => ({ type: "text", text: block.text })) };
    }
  });
}

/**
 * Schema Reference Resolution
 * Recursively resolves references in JSON schemas to their full definitions
 * @param schema - The schema object to resolve
 * @param definitions - Map of available schema definitions
 * @returns Resolved schema with all references replaced with their full definitions
 */
function resolveSchemaRefs(schema: any, definitions: Record<string, any> = {}): any {
  if (!schema || typeof schema !== 'object') return schema;

  // Handle direct references
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

  // Handle arrays
  if (Array.isArray(schema)) {
    return schema.map(item => resolveSchemaRefs(item, definitions));
  }

  // Handle nested objects and special cases
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

/**
 * Tool Management
 * Functions for managing and converting between different tool formats
 */

/**
 * Retrieve and format all available tools from connected MCP servers
 * Converts MCP tool formats to Anthropic-compatible format
 * @returns Promise<AnthropicTool[]> Array of tools in Anthropic's format
 */
async function getAllAvailableTools(): Promise<AnthropicTool[]> {
  let mcpTools: AnthropicTool[] = [];
  
  toolNameMapping.clear();
  
  for (const [serverName, client] of mcpClients.entries()) {
    try {
      const toolsResult = await client.listTools();
      
      if (toolsResult.tools) {
        const toolsWithPrefix = toolsResult.tools.map(tool => {
          // Create Anthropic-friendly tool name and store mapping
          const originalName = `${serverName}:${tool.name}`;
          const anthropicName = `${serverName}-${tool.name}`.replace(/[^a-zA-Z0-9_-]/g, '-');
          toolNameMapping.set(anthropicName, originalName);
          
          // Extract and process schema definitions
          const definitions = tool.inputSchema.$defs || {};
          
          // Create complete schema with all properties
          const completeSchema = {
            ...tool.inputSchema,
            properties: tool.inputSchema.properties || {}
          };

          // Resolve all schema references
          const resolvedSchema = resolveSchemaRefs(completeSchema, definitions);
          
          // Format tool for Anthropic's API
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

/**
 * Response Formatting
 * Functions for converting between JSON and XML formats for client communication
 */

/**
 * Convert JSON response to XML format
 * Transforms the structured JSON response into an XML string with CDATA sections
 * @param jsonResponse - Structured response data
 * @returns XML string representation of the response
 */
function convertJsonToXml(jsonResponse: FormatterInput): string {
  let xml = '<response>\n';
  
  // Add error section if present
  if (jsonResponse.error) {
    xml += '    <error>\n';
    xml += `        <![CDATA[${jsonResponse.error}]]>\n`;
    xml += '    </error>\n';
  }
  
  // Add thinking section if present
  if (jsonResponse.thinking) {
    xml += '    <thinking>\n';
    xml += `        <![CDATA[${jsonResponse.thinking}]]>\n`;
    xml += '    </thinking>\n';
  }
  
  // Add conversation elements
  xml += '    <conversation>\n';
  for (const segment of jsonResponse.conversation) {
    if (segment.type === 'text' && segment.content) {
      // Handle text segments
      xml += `        <![CDATA[${segment.content}]]>\n`;
    } else if (segment.type === 'artifact' && segment.artifact) {
      // Handle artifacts with their attributes
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

/**
 * XML Response Validation
 * Validates the structure and content of XML responses
 * @param response - XML string to validate
 * @returns Promise<boolean> indicating if the XML is valid
 */
async function isValidXMLResponse(response: string): Promise<boolean> {
  try {
    // Ensure basic XML structure exists
    if (!response.includes('<response>')) {
      response = `<response>\n<conversation>\n${response}\n</conversation>\n</response>`;
    }

    try {
      // Parse and validate XML structure
      const result = (await parseXML(response)) as XMLResponse;
      
      // Check for required elements
      const hasResponse = result && 'response' in result;
      const hasConversation = hasResponse && Array.isArray(result.response.conversation);
      
      // Allow error messages in the response
      const hasValidError = !result.response.error || Array.isArray(result.response.error);
      
      return hasResponse && hasConversation && hasValidError;
    } catch (parseError) {
      return false;
    }
  } catch (error) {
    console.error('[SERVER] XML Validation - Error during validation:', error);
    return false;
  }
}

/**
 * CDATA Processing
 * Removes CDATA tags from XML for cleaner processing
 * @param xml - XML string containing CDATA sections
 * @returns XML string with CDATA tags removed
 */
function stripCDATATags(xml: string): string {
  return xml.replace(/<!\[CDATA\[(.*?)\]\]>/gs, '$1');
}

/**
 * API Endpoints
 * Express routes for handling client requests
 */

/**
 * Chat API Endpoint
 * Handles chat interactions between client and AI model
 * POST /api/chat
 */
app.post('/api/chat', async (req: Request<{}, {}, { message: string; history: Array<{ role: 'user' | 'assistant'; content: string }> }>, res: Response) => {
  try {
    const { message, history } = req.body;

    // Get available tools from all connected MCP servers
    const formattedTools = await getAllAvailableTools();
    console.log('\n[DEBUG] === CHECKING TOOLS FOR ISSUES ===');
    formattedTools.forEach((tool, index) => {
      try {
        // Validate tool schema structure
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

    // Prepare conversation history
    const messages: ChatMessage[] = [
      ...history,
      { role: 'user', content: message }
    ];
    const anthMessages = convertChatMessages(messages);

    // First Anthropic call: Tool selection and execution
    const toolSelectionResponse = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 4000,
      messages: anthMessages as any,
      temperature: 0.7,
      tools: formattedTools,
    });

    // Process tool usage from response
    for (const content of toolSelectionResponse.content) {
      if (content.type === 'tool_use') {
        // Map Anthropic tool name to original MCP tool name
        const originalToolName = toolNameMapping.get(content.name);
        if (!originalToolName) {
          console.error(`No mapping found for tool name: ${content.name}`);
          continue;
        }

        const [serverName, toolName] = originalToolName.split(':');
        const client = mcpClients.get(serverName);
        if (!client) {
          console.error(`No client found for server ${serverName}`);
          continue;
        }

        try {
          // Execute tool and process result
          const toolResult = await client.callTool({
            name: toolName,
            arguments: content.input ? content.input as Record<string, unknown> : {}
          });

          // Add tool usage to conversation
          messages.push({
            role: 'assistant',
            content: [{ type: 'text', text: `Tool used: ${content.name}\nArguments: ${JSON.stringify(content.input)}` }]
          });

          // Process and add tool result to conversation
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

            // Handle bibliography if present
            if ('bibliography' in toolResult && toolResult.bibliography) {
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
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          const detailedError = error instanceof Error && error.stack ? `\nDetails: ${error.stack}` : '';
          messages.push({
            role: 'assistant',
            content: [{ 
              type: 'text', 
              text: `Error executing tool ${content.name}:\n${errorMessage}${detailedError}\n\nPlease try again or rephrase your request.` 
            }]
          });
        }
      }
    }

    // Second Anthropic call: Generate final response
    const updatedAnthMessages = convertChatMessages(messages);
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

    // Process and validate response
    if (response.content[0].type !== 'tool_use') {
      throw new Error('Expected tool_use response from Claude');
    }

    const toolResponse = response.content[0];
    if (toolResponse.type !== 'tool_use' || toolResponse.name !== 'response_formatter') {
      throw new Error('Expected response_formatter tool response');
    }

    // Format response with bibliography if present
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

    // Convert to XML and validate
    const xmlResponseWithCDATA = convertJsonToXml(jsonResponse);
    const isValid = await isValidXMLResponse(xmlResponseWithCDATA);
    if (!isValid) {
      throw new Error('Generated XML response is invalid');
    }

    // Strip CDATA tags and send response
    const xmlResponse = stripCDATATags(xmlResponseWithCDATA);
    res.json({ response: xmlResponse });

  } catch (error) {
    console.error('Error processing request:', error);
    res.status(500).json({
      error: 'Failed to process chat message',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Server Status Endpoint
 * Returns the operational status and available tools for each MCP server
 * GET /api/server-status
 */
app.get('/api/server-status', async (_req: Request, res: Response) => {
    try {
        const serverStatuses: ServerStatus[] = [];
        
        // Load server configuration
        const mcpConfigPath = path.join(__dirname, '../config/mcp_server_config.json');
        const configContent = fs.readFileSync(mcpConfigPath, 'utf-8');
        const config = JSON.parse(configContent) as MCPServersConfig;
        
        // Check status of each configured server
        for (const [serverName, _] of Object.entries(config.mcpServers)) {
            try {
                const client = mcpClients.get(serverName);
                if (!client) {
                    throw new Error('Client not found');
                }

                // Get available tools for this server
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
