/**
 * MCP (Model Context Protocol) Server Implementation for Ollama
 * This server acts as a bridge between the client application and various MCP-compatible model servers,
 * using Ollama as the LLM provider.
 * 
 * Data Type Boundaries:
 * 1. Input (ServerInputRequest):
 *    - message: string
 *    - history: Array<{role: 'user' | 'assistant', content: string}>
 *    - blockedServers?: string[]
 *    - modelSettings?: {temperature?: number, maxTokens?: number, [key: string]: any}
 * 
 * 2. Internal Processing (ParsedServerRequest):
 *    - message: {content: string, role: 'user' | 'assistant'}
 *    - history: ChatMessage[]
 *    - modelConfig?: ModelConfig
 *    - blockedServers: string[]
 * 
 * 3. Output (ServerResponse):
 *    - response: {
 *        thinking?: string
 *        conversation: string
 *        artifacts?: Array<{
 *          id: string
 *          type: string
 *          title: string
 *          content: string
 *          position: number
 *          language?: string
 *        }>
 *      }
 *    - error?: {message: string, details?: any}
 * 
 * Special Response Types:
 * - BinaryOutputResponse: Includes base64 encoded data and metadata
 * - BibliographyResponse: Includes structured reference data
 */

import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { systemPrompt } from '../systemPrompt';
import { Client as McpClient } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

// Type definitions
interface MCPServerConfig {
  command: string;
  args: string[];
  env?: Record<string, string>;
}

interface MCPServersConfig {
  mcpServers: Record<string, MCPServerConfig>;
}

interface OllamaTool {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string | Array<{ type: string; text: string }>;
}

interface ToolResponse {
  type: 'tool_use';
  name: string;
  input: {
    thinking?: string;
    conversation: Array<{
      type: 'text' | 'artifact';
      content?: string;
      metadata?: {
        hasBinaryOutput?: boolean;
        binaryType?: string;
        [key: string]: any;
      };
      artifact?: {
        type: string;
        id: string;
        title: string;
        content: string;
        language?: string;
      };
    }>;
  };
  binaryOutput?: {
    type: string;
    data: string;
    metadata: {
      size?: number;
      sourceCode?: string;
      [key: string]: any;
    };
  };
}

interface OllamaToolUseContent {
  type: 'tool_use';
  name: string;
  input: any;
}

interface OllamaTextContent {
  type: 'text';
  text: string;
}

type OllamaContent = OllamaToolUseContent | OllamaTextContent;

dotenv.config();

// Ollama API configuration
const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'mistral'; // Default to mistral if not specified

/**
 * Express Server Setup
 * Initialize the main Express application server with necessary middleware
 */
const app = express();
const port = process.env.OLLAMA_PORT || 3001; // Use different port from main server

app.use(cors());
app.use(express.json());

// Initialize logging
const logDir = '/Users/andycrouse/Documents/GitHub/charm-mcp/logs/ollamaserverlog';

// Ensure log directory exists
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
  console.log(`Created log directory at: ${logDir}`);
}

// Add missing ES Module dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Ollama API Client
 * Simple fetch-based client for Ollama API
 */
class OllamaClient {
  private baseUrl: string;
  private model: string;

  constructor(baseUrl: string, model: string) {
    this.baseUrl = baseUrl;
    this.model = model;
  }

  async generateCompletion(messages: any[], tools?: any[]): Promise<{ content: OllamaContent[] }> {
    try {
      console.log('\n=== OLLAMA REQUEST DETAILS ===');
      console.log('Model:', this.model);
      console.log('Number of messages:', messages.length);

      // Convert messages to Ollama chat format
      const chatMessages = [
        { role: 'system', content: systemPrompt },
        ...messages.map(msg => ({
          role: msg.role === 'assistant' ? 'assistant' : 'user',
          content: typeof msg.content === 'string' ? msg.content : msg.content.map((c: any) => c.text).join('\n')
        }))
      ];

      // First call: Get basic response
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          messages: chatMessages,
          stream: false
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Ollama API error:', {
          status: response.status,
          statusText: response.statusText,
          error: errorText
        });
        throw new Error(`Ollama API error: ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();
      console.log('\n=== OLLAMA INITIAL RESPONSE ===');
      console.log('Raw response:', JSON.stringify(data, null, 2));

      // Second call: Format the response
      const formattingMessages = [
        { role: 'system', content: 'Format the following response in a structured way.' },
        { role: 'user', content: `Please format this response as a JSON object with a conversation array: ${data.message.content}` }
      ];

      const formattingResponse = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          messages: formattingMessages,
          stream: false,
          format: {
            type: "object",
            properties: {
              thinking: {
                type: "string",
                description: "Optional internal reasoning process"
              },
              conversation: {
                type: "array",
                description: "Array of conversation segments and artifacts",
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
                      description: "Text content if type is text"
                    }
                  }
                }
              }
            },
            required: ["conversation"]
          }
        }),
      });

      if (!formattingResponse.ok) {
        throw new Error('Failed to format response');
      }

      const formattedData = await formattingResponse.json();
      console.log('\n=== FORMATTED RESPONSE ===');
      console.log('Formatted data:', JSON.stringify(formattedData, null, 2));
      
      return this.parseOllamaResponse(formattedData);
    } catch (error) {
      console.error('Error in generateCompletion:', error);
      throw error;
    }
  }

  private formatPrompt(systemMessage: string, messages: any[]): string {
    let prompt = `<system>${systemMessage}</system>\n\n`;
    
    messages.forEach(msg => {
      const role = msg.role === 'assistant' ? 'Assistant' : 'Human';
      const content = typeof msg.content === 'string' 
        ? msg.content 
        : msg.content.map((c: any) => c.text).join('\n');
      
      prompt += `<${role}>${content}</${role}>\n\n`;
    });

    prompt += '<Assistant>';
    console.log('\n=== FORMATTED PROMPT ===');
    console.log(prompt);
    return prompt;
  }

  private parseOllamaResponse(data: any): { content: OllamaContent[] } {
    try {
      if (!data || !data.message) {
        console.error('Invalid response from Ollama:', data);
        throw new Error('Invalid response from Ollama API');
      }

      console.log('\n=== PARSING OLLAMA RESPONSE ===');
      const response = data.message.content;
      console.log('Raw response text:', response);
      
      // Try to parse as JSON
      try {
        const jsonResponse = JSON.parse(response);
        console.log('Successfully parsed response as JSON:', jsonResponse);
        
        // If it has our expected format
        if (jsonResponse.conversation) {
          return {
            content: [{
              type: 'tool_use',
              name: 'response_formatter',
              input: {
                thinking: jsonResponse.thinking,
                conversation: jsonResponse.conversation.map((item: any) => ({
                  type: 'text',
                  content: item.content
                }))
              }
            }]
          };
        }
      } catch (e) {
        console.log('Response is not JSON, using as plain text');
      }

      // If parsing fails or response doesn't match expected format, return as text
      return {
        content: [{
          type: 'text',
          text: response
        }]
      };
    } catch (error) {
      console.error('Error in parseOllamaResponse:', error);
      throw error;
    }
  }
}

// Initialize Ollama client
const ollama = new OllamaClient(OLLAMA_HOST, OLLAMA_MODEL);

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
            // console.log(`\nServer: ${serverName}`);
            // console.log(`Status: ${blockedServers.includes(serverName) ? 'BLOCKED' : 'AVAILABLE'}`);
            
            // if (blockedServers.includes(serverName)) {
            //     console.log('Skipping blocked server');
            //     continue;
            // }

            const toolsResult = await client.listTools();

            console.log('OLLAMA TOOLS - toolsResult', toolsResult);
            if (toolsResult.tools) {
                console.log(`Available tools: ${toolsResult.tools.length}`);
                const toolsWithPrefix = toolsResult.tools.map(tool => {
                    // console.log(`- ${tool.name}: ${tool.description || 'No description'}`);
                    
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

// Add validateArtifactType function
function validateArtifactType(type: string): string {
  const validTypes = [
    'code',
    'html',
    'image/svg+xml',
    'image/png',
    'text',
    'application/vnd.ant.mermaid',
    'text/markdown',
    'application/python',
    'application/javascript',
    'application/vnd.react',
    'application/vnd.bibliography',
    'application/vnd.ant.python'
  ];

  // Handle application/vnd.ant.code type
  if (type?.startsWith('application/vnd.ant.code')) {
    return 'code';
  }

  // Handle code snippets with language attribute
  if (type?.startsWith('code/')) {
    return 'code';
  }

  // Handle binary types explicitly
  if (type === 'image/png') {
    return 'image/png';
  }

  // If no type is specified or type is 'text', default to text/markdown
  if (!type || type === 'text') {
    return 'text/markdown';
  }

  const normalizedType = type;

  if (validTypes.includes(normalizedType)) {
    return normalizedType;
  }

  // Default to text/markdown for unknown types
  return 'text/markdown';
}

// Update convertToStoreFormat function
function convertToStoreFormat(toolResponse: ToolResponse): {
  thinking?: string;
  conversation: string;
  artifacts?: Array<{
    id: string;
    artifactId?: string;
    type: string;
    title: string;
    content: string;
    position: number;
    language?: string;
  }>;
} {
  const conversation: string[] = [];
  const artifacts: Array<any> = [];
  let position = 0;

  // console.log('DEBUG - toolResponse.input.conversation:', JSON.stringify(toolResponse.input.conversation, null, 2));

  // Check if conversation is an array before processing
  if (Array.isArray(toolResponse.input.conversation)) {
    toolResponse.input.conversation.forEach((item: any) => {
      if (item.type === 'text' && item.content) {
        conversation.push(item.content);
        
        // Check for binary output metadata in the text content
        if (item.metadata?.hasBinaryOutput && toolResponse.binaryOutput) {
          const binaryId = crypto.randomUUID();
          const sourceCodeId = crypto.randomUUID();
          
          // Add the binary artifact (e.g., PNG)
          artifacts.push({
            id: binaryId,
            artifactId: binaryId,
            type: toolResponse.binaryOutput.type,
            title: `Generated ${toolResponse.binaryOutput.type.split('/')[1].toUpperCase()}`,
            content: toolResponse.binaryOutput.data,
            position: position++,
          });

          // Add source code as a separate artifact
          if (toolResponse.binaryOutput.metadata?.sourceCode) {
            artifacts.push({
              id: sourceCodeId,
              artifactId: sourceCodeId,
              type: 'application/vnd.ant.python',  // Use consistent type for Python code
              title: 'Source Code',
              content: toolResponse.binaryOutput.metadata.sourceCode,
              language: 'python',  // Explicitly set language
              position: position++
            });
          }

          // Add formatted buttons for both artifacts
          conversation.push(`<button class="artifact-button text-sm text-blue-600 dark:text-blue-400 hover:underline" data-artifact-id="${binaryId}" data-artifact-type="${toolResponse.binaryOutput.type}" style="cursor: pointer; background: none; border: none; padding: 0;">📎 Generated ${toolResponse.binaryOutput.type.split('/')[1].toUpperCase()}</button>`);
          
          if (toolResponse.binaryOutput.metadata?.sourceCode) {
            conversation.push(`<button class="artifact-button text-sm text-blue-600 dark:text-blue-400 hover:underline" data-artifact-id="${sourceCodeId}" data-artifact-type="application/vnd.ant.python" style="cursor: pointer; background: none; border: none; padding: 0;">📎 Source Code</button>`);
          }
        }
      } 
      else if (item.type === 'artifact' && item.artifact) {
        const uniqueId = crypto.randomUUID();
        const validatedType = validateArtifactType(item.artifact.type);
        
        // Add artifact to collection
        artifacts.push({
          id: uniqueId,
          artifactId: uniqueId,
          type: validatedType,
          title: item.artifact.title,
          content: item.artifact.content,
          position: position++,
          language: item.artifact.language || (validatedType === 'application/vnd.ant.python' ? 'python' : undefined)
        });

        // Add formatted button HTML to conversation
        const buttonHtml = `<button class="artifact-button text-sm text-blue-600 dark:text-blue-400 hover:underline" data-artifact-id="${uniqueId}" data-artifact-type="${validatedType}" style="cursor: pointer; background: none; border: none; padding: 0;">📎 ${item.artifact.title}</button>`;
        conversation.push(buttonHtml);
      }
    });
  } else if (typeof toolResponse.input.conversation === 'string') {
    conversation.push(toolResponse.input.conversation);
  }

  return {
    thinking: toolResponse.input.thinking,
    conversation: conversation.join('\n\n'),
    artifacts: artifacts
  };
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
  const requestTime = new Date();
  const requestId = crypto.randomUUID();
  
  console.log(`\n=== Ollama Request [${requestId}] Started at ${requestTime.toISOString()} ===`);
  console.log('Request Details:');
  console.log('- Message:', req.body.message);
  console.log('- History Length:', req.body.history.length);
  console.log('- Blocked Servers:', req.body.blockedServers || []);
  
  // Log the full conversation history in a readable format
  console.log('\nConversation History:');
  req.body.history.forEach((msg, index) => {
    console.log(`[${index + 1}] ${msg.role.toUpperCase()}: ${msg.content.substring(0, 100)}${msg.content.length > 100 ? '...' : ''}`);
  });

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
  };

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

    // First phase: Sequential thinking and tool usage
    while (!isSequentialThinkingComplete) {
      // Get available tools (but exclude response_formatter for now)
      const formattedTools = await getAllAvailableTools(blockedServers);
      
      // Make Ollama call for next thought/tool use
      const toolResponse = await ollama.generateCompletion(messages, formattedTools);

      // Process tool usage
      for (const content of toolResponse.content) {
        if (content.type === 'tool_use' && 'name' in content && 'input' in content) {
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
              const binaryOutput = toolResult.binaryOutput as {
                type: string;
                data: string;
                metadata: Record<string, any>;
              };
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
      if (!toolResponse.content.some((c) => {
        return c.type === 'tool_use' && 'name' in c && 'input' in c;
      })) {
        isSequentialThinkingComplete = true;
      }
    }

    // Final phase: Response formatting
    console.log('\n=== PREPARING FINAL RESPONSE ===');
    const response = await ollama.generateCompletion(messages, [{
      name: "response_formatter",
      description: "Format all responses in a consistent JSON structure",
      parameters: {
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
    }]);

    console.log('\n=== OLLAMA FINAL RESPONSE ===');
    console.log('Response received from Ollama');
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
        const firstContent = response.content[0];
        if (firstContent.type !== 'tool_use' || !('name' in firstContent) || !('input' in firstContent)) {
            throw new Error('Expected tool_use response from Ollama');
        }

        if (firstContent.name !== 'response_formatter') {
            throw new Error('Expected response_formatter tool response');
        }

        // Convert to store format
        const formattedResponse: ToolResponse = {
            type: 'tool_use',
            name: firstContent.name,
            input: firstContent.input
        };

        const storeResponse = convertToStoreFormat(formattedResponse);
        
        // Add bibliography if present
        if ((messages as any).bibliography) {
            const bibliographyId = crypto.randomUUID();
            storeResponse.artifacts = storeResponse.artifacts || [];
            storeResponse.artifacts.push({
                id: bibliographyId,
                artifactId: bibliographyId,
                type: "application/vnd.bibliography",
                title: "Article References",
                content: JSON.stringify((messages as any).bibliography),
                position: storeResponse.artifacts.length
            });
        }

        // Add binary outputs if present
        if ((messages as any).binaryOutputs) {
            let additionalButtons: string[] = [];
            storeResponse.artifacts = storeResponse.artifacts || [];
            
            for (const binaryOutput of (messages as any).binaryOutputs) {
                const binaryId = crypto.randomUUID();
                const codeId = crypto.randomUUID();
                
                // Add the binary artifact
                storeResponse.artifacts.push({
                    id: binaryId,
                    artifactId: binaryId,
                    type: binaryOutput.type,
                    title: `Generated ${binaryOutput.type.split('/')[1].toUpperCase()}`,
                    content: binaryOutput.data,
                    position: storeResponse.artifacts.length
                });
                
                // Add source code if present
                if (binaryOutput.metadata?.sourceCode) {
                    storeResponse.artifacts.push({
                        id: codeId,
                        artifactId: codeId,
                        type: "application/vnd.ant.python",
                        title: "Source Code",
                        content: binaryOutput.metadata.sourceCode,
                        language: "python",
                        position: storeResponse.artifacts.length
                    });
                }

                // Create buttons for artifacts not already in conversation
                const conversationText = storeResponse.conversation.toLowerCase();
                if (!conversationText.includes(binaryId.toLowerCase())) {
                    additionalButtons.push(`<button class="artifact-button text-sm text-blue-600 dark:text-blue-400 hover:underline" data-artifact-id="${binaryId}" data-artifact-type="${binaryOutput.type}" style="cursor: pointer; background: none; border: none; padding: 0;">📎 Generated ${binaryOutput.type.split('/')[1].toUpperCase()}</button>`);
                    
                    if (binaryOutput.metadata?.sourceCode && !conversationText.includes(codeId.toLowerCase())) {
                        additionalButtons.push(`<button class="artifact-button text-sm text-blue-600 dark:text-blue-400 hover:underline" data-artifact-id="${codeId}" data-artifact-type="application/vnd.ant.python" style="cursor: pointer; background: none; border: none; padding: 0;">📎 Source Code</button>`);
                    }
                }
            }

            // Add any missing artifact buttons to the end of the conversation
            if (additionalButtons.length > 0) {
                storeResponse.conversation += '\n\nAdditional outputs:\n' + additionalButtons.join('\n');
            }
        }

        // Before sending the response, log the results
        console.log(`\n=== Ollama Response [${requestId}] ===`);
        if (storeResponse) {
          console.log('Response Details:');
          console.log('- Thinking:', storeResponse.thinking ? 'Present' : 'None');
          console.log('- Conversation Length:', storeResponse.conversation.length);
          console.log('- Number of Artifacts:', storeResponse.artifacts?.length || 0);
          
          if (storeResponse.artifacts?.length) {
            console.log('\nArtifacts Generated:');
            storeResponse.artifacts.forEach((artifact, index) => {
              console.log(`[${index + 1}] ${artifact.title} (${artifact.type})`);
            });
          }
        }

        const responseTime = new Date();
        const processingTime = responseTime.getTime() - requestTime.getTime();
        console.log(`\nRequest completed in ${processingTime}ms`);
        console.log(`=== End Request [${requestId}] ===\n`);

        // Send response
        res.json({ response: storeResponse });

    } catch (error) {
        console.error(`\n=== Error in Request [${requestId}] ===`);
        console.error('Error Details:', error instanceof Error ? error.message : 'Unknown error');
        console.error('Stack:', error instanceof Error ? error.stack : 'No stack trace');
        console.error(`=== End Error [${requestId}] ===\n`);

        res.status(500).json({
          error: 'Failed to process chat message',
          details: error instanceof Error ? error.message : 'Unknown error'
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

// Keep necessary interfaces
interface AnthropicTool {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}

interface ServerTool {
  name: string;
  description?: string;
  inputSchema?: {
    type: string;
    properties?: Record<string, unknown>;
    required?: string[];
  };
}

interface ServerStatus {
  name: string;
  isRunning: boolean;
  tools?: ServerTool[];
}
