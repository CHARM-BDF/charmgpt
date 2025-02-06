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
// import { 
//   TextContentSchema
// } from '@modelcontextprotocol/sdk/types.js';
// import { z } from 'zod';  // Keep Zod import as it's used for type inference


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

interface ToolResponse {
    type: 'tool_use';
    name: string;
    input: {
        thinking?: string;
        conversation: string | FormatterInput['conversation'];
    };
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

// Import and mount API routes
import apiRouter from './api';
app.use('/api', apiRouter);

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

// Store original console methods for fallback
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

const logDir = '/Users/andycrouse/Documents/GitHub/charm-mcp/logs/detailedserverlog';

// Ensure log directory exists
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
  originalConsoleLog(`Created log directory at: ${logDir}`);
}

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
async function getAllAvailableTools(blockedServers: string[] = []): Promise<AnthropicTool[]> {
    let mcpTools: AnthropicTool[] = [];
    
    console.log('\n=== Tool Selection Process ===');
    console.log('Checking available servers and their tools...');
    console.log('Blocked servers:', blockedServers);
    
    toolNameMapping.clear();
    
    for (const [serverName, client] of mcpClients.entries()) {
        try {
            console.log(`\nServer: ${serverName}`);
            console.log(`Status: ${blockedServers.includes(serverName) ? 'BLOCKED' : 'AVAILABLE'}`);
            
            if (blockedServers.includes(serverName)) {
                console.log('Skipping blocked server');
                continue;
            }

            const toolsResult = await client.listTools();
            
            if (toolsResult.tools) {
                console.log(`Available tools: ${toolsResult.tools.length}`);
                const toolsWithPrefix = toolsResult.tools.map(tool => {
                    console.log(`- ${tool.name}: ${tool.description || 'No description'}`);
                    
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
            } else {
                console.log('No tools available');
            }
        } catch (error) {
            console.error(`Failed to get tools from server ${serverName}:`, error);
        }
    }
    
    console.log('\n=== Tool Selection Summary ===');
    console.log(`Total tools available to LLM: ${mcpTools.length}`);
    if (mcpTools.length > 0) {
        console.log('\nAvailable Tools List:');
        mcpTools.forEach(tool => {
            console.log(`- [${tool.name}] ${tool.description}`);
        });
    }
    console.log('=============================\n');
    
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
app.post('/api/chat', async (req: Request<{}, {}, { 
    message: string; 
    history: Array<{ role: 'user' | 'assistant'; content: string }>;
    blockedServers?: string[];
}>, res: Response) => {
  const promptTime = new Date();
  const promptLogFileName = promptTime.toLocaleString('en-US', {
    timeZone: 'America/Chicago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).replace(/[\/:]/g, '-') + '.log';

  const promptLogPath = path.join(logDir, promptLogFileName);
  fs.writeFileSync(promptLogPath, `=== Prompt Started: ${promptTime.toISOString()} ===\n\n`);

  function logToFile(message: string, type: 'info' | 'error' | 'debug' = 'info') {
    const now = new Date();
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
    
    try {
      const logEntry = `[${centralTime}] [${type.toUpperCase()}] ${message}\n`;
      fs.appendFileSync(promptLogPath, logEntry);
      originalConsoleLog(logEntry);
    } catch (error) {
      originalConsoleError('Error writing to log file:', error);
    }
  }

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
    const { message, history, blockedServers = [] } = req.body;
    let messages: ChatMessage[] = [...history, { role: 'user', content: message }];
    let isSequentialThinkingComplete = false;
    // let cumulativeBibliography: any[] = [];  // Add at the start of the chat endpoint handler

    // First phase: Sequential thinking and tool usage
    while (!isSequentialThinkingComplete) {
      // Get available tools (but exclude response_formatter for now)
      const formattedTools = await getAllAvailableTools(blockedServers);
      
      // Make Anthropic call for next thought/tool use
      const toolResponse = await anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 4000,
        messages: convertChatMessages(messages) as any,
        temperature: 0.7,
        tools: formattedTools,
      });

      // Process tool usage
      for (const content of toolResponse.content) {
        if (content.type === 'tool_use') {
          const originalToolName = toolNameMapping.get(content.name);
          if (!originalToolName) continue;

          const [serverName, toolName] = originalToolName.split(':');
          const client = mcpClients.get(serverName);
          if (!client) continue;

          console.log('\n=== TOOL EXECUTION DETAILS ===');
          console.log(`Tool Selected: ${content.name} (Original name: ${originalToolName})`);
          console.log('Tool Input:', JSON.stringify(content.input, null, 2));

          // Execute tool
          const toolResult = await client.callTool({
            name: toolName,
            arguments: content.input as Record<string, unknown>
          });

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
                
                console.log('Bibliography merge results:', {
                    currentCount: currentBibliography.length,
                    newEntriesCount: newBibliography.length,
                    uniqueNewCount: uniqueNewEntries.length,
                    skippedDuplicates: newBibliography.length - uniqueNewEntries.length
                });

                // Merge unique new entries with existing bibliography
                (messages as any).bibliography = [...currentBibliography, ...uniqueNewEntries];
              } else {
                // First bibliography, just set it
                (messages as any).bibliography = toolResult.bibliography;
              }
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
      messages: convertChatMessages(messages) as any,
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

    console.log('\n=== ANTHROPIC FINAL RESPONSE ===');
    console.log('Response received from Anthropic');
    console.log('Content types:', response.content.map(c => c.type).join(', '));
    console.log('Number of content blocks:', response.content.length);
    if (response.content[0].type === 'tool_use') {
        console.log('Tool used:', response.content[0].name);
        console.log('\n=== RAW TOOL RESPONSE ===');
        console.log('Input type:', typeof response.content[0].input);
        if (typeof response.content[0].input === 'object' && response.content[0].input !== null) {
            const input = response.content[0].input as any;
            console.log('Conversation type:', typeof input.conversation);
            console.log('Is array?', Array.isArray(input.conversation));
            console.log('Raw conversation value:', JSON.stringify(input.conversation, null, 2));
        }
    }
    console.log('================================\n');

    // Process and validate response
    try {
        console.log('\n=== PROCESSING ANTHROPIC RESPONSE ===');
        if (response.content[0].type !== 'tool_use') {
            console.error('Unexpected response type:', response.content[0].type);
            throw new Error('Expected tool_use response from Claude');
        }

        const toolResponse = response.content[0];
        console.log('Tool response type:', toolResponse.type);
        console.log('Tool response name:', toolResponse.name);
        
        if (toolResponse.type !== 'tool_use' || toolResponse.name !== 'response_formatter') {
            console.error('Invalid tool response:', JSON.stringify(toolResponse, null, 2));
            throw new Error('Expected response_formatter tool response');
        }

        // Format response with bibliography if present
        console.log('\n=== FORMATTING RESPONSE ===');
        let jsonResponse: FormatterInput;
        
        try {
            const toolResp = toolResponse as ToolResponse;
            const input = toolResp.input;
            
            // Parse the conversation if it's a string
            if (typeof input.conversation === 'string') {
                const parsed = JSON.parse(input.conversation);
                jsonResponse = {
                    thinking: input.thinking,
                    conversation: parsed.conversation || []
                };
            } else {
                jsonResponse = {
                    thinking: input.thinking,
                    conversation: input.conversation
                };
            }

            // Now we can safely push to the array
            console.log('Adding bibliography artifact to conversation array');
            if ((messages as any).bibliography) {
                const bibliographyId = crypto.randomUUID();
                jsonResponse.conversation.push({
                    type: "artifact",
                    artifact: {
                        type: "application/vnd.bibliography",
                        id: bibliographyId,
                        title: "Article References",
                        content: JSON.stringify((messages as any).bibliography)
                    }
                });
            }
        } catch (parseError) {
            console.error('\n=== RESPONSE PARSING ERROR ===');
            console.error('Failed to parse response:', parseError);
            console.error('Tool response input:', toolResponse);
            throw new Error('Failed to parse response format');
        }

        // Convert to XML and validate
        console.log('\n=== CONVERTING TO XML ===');
        let xmlResponseWithCDATA: string;
        try {
            xmlResponseWithCDATA = convertJsonToXml(jsonResponse);
            console.log('XML conversion complete, validating...');
        } catch (xmlError) {
            console.error('\n=== XML CONVERSION ERROR ===');
            console.error('Failed to convert to XML. State at failure:');
            console.error('JSON Response:', JSON.stringify(jsonResponse, null, 2));
            console.error('Error details:', xmlError);
            throw xmlError;
        }
        
        let isValid: boolean;
        try {
            isValid = await isValidXMLResponse(xmlResponseWithCDATA);
            if (!isValid) {
                console.error('\n=== XML VALIDATION ERROR ===');
                console.error('XML Validation failed. State at failure:');
                console.error('XML content:', xmlResponseWithCDATA);
                console.error('Original JSON:', JSON.stringify(jsonResponse, null, 2));
                throw new Error('Generated XML response is invalid');
            }
        } catch (validationError) {
            console.error('\n=== XML VALIDATION ERROR ===');
            console.error('Failed to validate XML. State at failure:');
            console.error('XML content:', xmlResponseWithCDATA);
            console.error('Original JSON:', JSON.stringify(jsonResponse, null, 2));
            console.error('Error details:', validationError);
            throw validationError;
        }

        // Strip CDATA tags and send response
        console.log('\n=== PREPARING FINAL RESPONSE ===');
        let xmlResponse: string;
        try {
            xmlResponse = stripCDATATags(xmlResponseWithCDATA);
            res.json({ response: xmlResponse });
            console.log('Response sent successfully');
        } catch (stripError) {
            console.error('\n=== CDATA STRIPPING ERROR ===');
            console.error('Failed to strip CDATA tags. State at failure:');
            console.error('XML with CDATA:', xmlResponseWithCDATA);
            console.error('Error details:', stripError);
            throw stripError;
        }
    } catch (error) {
        console.error('\n=== RESPONSE PROCESSING ERROR ===');
        console.error('Error details:', {
            message: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined,
            responseContent: response.content,
            toolResponseType: response.content[0]?.type
        });
        res.status(500).json({
            error: 'Failed to process response',
            details: error instanceof Error ? error.message : 'Unknown error',
            state: {
                responseType: response.content[0]?.type,
                toolResponse: response.content[0],
                bibliography: (messages as any).bibliography ? 'Present' : 'Not present'
            }
        });
    }

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
