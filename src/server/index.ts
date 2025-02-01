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
    properties: Record<string, unknown>;
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

// Add ServerStatus interface with correct typing
interface ServerStatus {
    name: string;
    isRunning: boolean;
    tools: string[];
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

// ----- MCP Client Initialization using the official SDK -----
const mcpClient = new McpClient(
  { name: 'mcp-backend-client', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

try {
  console.log('Starting server initialization...');
  const mcpConfigPath = path.join(__dirname, '../config/mcp_server_config.json');
  const configContent = fs.readFileSync(mcpConfigPath, 'utf-8');
  const config = JSON.parse(configContent) as MCPServersConfig;
  
  console.log('Found MCP servers in config:', Object.keys(config.mcpServers));
  
  // Start each MCP server
  for (const [serverName, serverConfig] of Object.entries(config.mcpServers)) {
    console.log(`Starting MCP server: ${serverName}`);
    const { command, args = [], env = {} } = serverConfig;
    
    // Modify paths to be relative to project root if needed
    const modifiedArgs = args.map(arg => {
      if (arg.startsWith('./node_modules/')) {
        return arg.replace('./', '');
      }
      return arg;
    });

    // Now connect the MCP client
    console.log(`Connecting to MCP server: ${serverName}`);
    await mcpClient.connect(new StdioClientTransport({ 
      command,
      args: modifiedArgs,
      env: {
        ...Object.fromEntries(
          Object.entries(process.env).filter(([_, v]) => v !== undefined)
        ) as Record<string, string>,
        ...env
      }
    }));
  }
  
  app.listen(port, async () => {
    try {
      // Check MCP server status
      // const tools = await mcpClient.listTools();
      // console.log('\nMCP Server Status:');
      // console.log('- MCP Client connected and initialized successfully');
      // console.log('\n[DEBUG] INITIAL MCP TOOLS:', JSON.stringify(tools, null, 2));
      // if (Object.values(tools).length > 0) {
      //   console.log(`- Available tools: ${Object.values(tools).map((tool: unknown) => (tool as ServerTool).name).join(', ')}`);
      // } else {
      //   console.log('- No tools available');
      // }

      const now = new Date();
      const timestamp = now.toLocaleString();
      console.log(`\nHot reload at: ${timestamp}`);
      console.log(`Server running at http://localhost:${port}`);
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

// Get available tools from MCP using the MCP client
async function getAllAvailableTools(): Promise<AnthropicTool[]> {
  // Get tools from MCP client
  const rawTools = await mcpClient.listTools();
  
  // console.log('\n[DEBUG] RAW TOOLS TYPE:', typeof rawTools, Array.isArray(rawTools));
  // console.log('\n[DEBUG] RAW TOOLS STRUCTURE:', JSON.stringify(rawTools, null, 2));
  
  // Handle the tools response structure
  let mcpTools: ServerTool[] = [];
  if (typeof rawTools === 'object' && rawTools !== null) {
    // If it's an array, use it directly
    if (Array.isArray(rawTools)) {
      mcpTools = rawTools as unknown as ServerTool[];
    }
    // If it has a tools property that's an array, use that
    else if ('tools' in rawTools && Array.isArray(rawTools.tools)) {
      mcpTools = rawTools.tools as unknown as ServerTool[];
    }
    // If it's an object with tool entries, use Object.values
    else {
      mcpTools = Object.values(rawTools) as unknown as ServerTool[];
    }
  } else {
    console.log('\n[DEBUG] WARNING: Unexpected tools format:', typeof rawTools);
    return [];
  }
  
  // console.log('\n[DEBUG] PROCESSED MCP TOOLS:', JSON.stringify(mcpTools, null, 2));
  // just console a list of the tool names
  console.log('\n[DEBUG] MCP TOOL NAMES:', mcpTools.map((tool: ServerTool) => tool.name));
  
  // Format tools for Anthropic API
  const formattedTools = mcpTools.map((tool: ServerTool) => {
    // console.log('\n[DEBUG] PROCESSING TOOL:', tool.name);
    
    // Ensure we have all required fields
    if (!tool.name || !tool.inputSchema) {
      console.log('\n[DEBUG] WARNING: Tool missing required fields:', JSON.stringify(tool, null, 2));
      return null;
    }
    
    const formattedTool: AnthropicTool = {
      name: tool.name,
      description: tool.description || `Tool for ${tool.name}`,
      input_schema: {
        type: "object",
        properties: tool.inputSchema.properties || {},
        required: tool.inputSchema.required || []
      }
    };
    
    // console.log('\n[DEBUG] SINGLE FORMATTED TOOL:', JSON.stringify(formattedTool, null, 2));
    return formattedTool;
  }).filter((tool): tool is AnthropicTool => tool !== null);
  
  // console.log('\n[DEBUG] FORMATTED TOOLS FOR ANTHROPIC:', JSON.stringify(formattedTools, null, 2));
  
  if (!formattedTools.length) {
    console.log('\n[DEBUG] WARNING: No tools were formatted!');
  }
  
  return formattedTools;
}

// Strip CDATA tags from XML (for backward compatibility)
function stripCDATATags(xml: string): string {
  return xml.replace(/<!\[CDATA\[(.*?)\]\]>/gs, '$1');
}

app.post('/api/chat', async (req: Request<{}, {}, { message: string; history: Array<{ role: 'user' | 'assistant'; content: string }> }>, res: Response) => {
  try {
    const { message, history } = req.body;

    // Get available tools from MCP, formatted for Anthropic.
    const formattedTools = await getAllAvailableTools();
    // console.log('\n[DEBUG] TOOLS BEING SENT TO ANTHROPIC:', JSON.stringify(formattedTools, null, 2));

    // Create conversation array from history and the new message.
    const messages: ChatMessage[] = [
      ...history,
      { role: 'user', content: message }
    ];
    const anthMessages = convertChatMessages(messages);

    // First call to Anthropic including tool definitions.
    const toolSelectionResponse = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 4000,
      messages: anthMessages as any,
      temperature: 0.7,
      tools: formattedTools,
    });

    // Check for tool-use blocks in Claude's response.
    for (const content of toolSelectionResponse.content) {
      if (content.type === 'tool_use') {
        // If the tool name is formatted as "serverName:toolName", extract toolName.
        const toolName = content.name.includes(':') ? content.name.split(':')[1] : content.name;
        // Call the tool via the MCP client. The callTool method expects a single object parameter.
        console.log('\n[DEBUG] Calling MCP tool:', {
          toolName,
          arguments: content.input
        });
        const toolResult = await mcpClient.callTool({
          name: toolName,
          arguments: (content.input ? content.input as Record<string, unknown> : {})
        });
        
        // console.log('\n[DEBUG] MCP tool result:', JSON.stringify(toolResult, null, 2));
        
        // Add debug log for bibliography
        if ('bibliography' in toolResult) {
          console.log('\n[DEBUG] Raw bibliography data:', JSON.stringify(toolResult.bibliography, null, 2));
        }

        // Append the tool-use block and its result to the conversation.
        messages.push({
          role: 'assistant',
          content: [{ type: 'text', text: `Tool used: ${content.name}\nArguments: ${JSON.stringify(content.input)}` }]
        });
        
        // If the tool result has content array with markdown text, use it directly
        if (toolResult && 'content' in toolResult && Array.isArray(toolResult.content)) {
          const textContent = toolResult.content.find(item => item.type === 'text')?.text;
          // Store bibliography separately if it exists
          const bibliography = 'bibliography' in toolResult ? toolResult.bibliography : null;
          
          if (textContent) {
            messages.push({
              role: 'user',
              content: [{ type: 'text', text: typeof textContent === 'string' ? textContent : JSON.stringify(textContent) }]
            });
            // Store bibliography in a way that persists through the conversation
            if (bibliography) {
              (messages as any).bibliography = bibliography;
            }
          }
        } else {
          messages.push({
            role: 'user',
            content: [{ type: 'text', text: JSON.stringify(toolResult) }]
          });
        }
      }
    }

    const updatedAnthMessages = convertChatMessages(messages);
    console.log('[SERVER] Sending updated conversation to Claude:', {
      model: 'claude-3-5-sonnet-20241022',
      messages: updatedAnthMessages,
      systemPrompt: 'main prompt',
      tool_choice: { type: "tool", name: "response_formatter" }
    });

    // Call Anthropic API again with the updated conversation and a response_formatter tool.
    console.log('\n[DEBUG] Sending conversation to Claude with tool results:', JSON.stringify(messages, null, 2));
    
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

    console.log('[SERVER] Raw response from Claude:', {
      type: response.content[0].type,
      content: response.content[0]
    });

    if (response.content[0].type !== 'tool_use') {
      console.log('[SERVER] Unexpected response type:', response.content[0].type);
      throw new Error('Expected tool_use response from Claude');
    }

    const toolResponse = response.content[0];
    if (toolResponse.type !== 'tool_use' || toolResponse.name !== 'response_formatter') {
      throw new Error('Expected response_formatter tool response');
    }

    console.log('[SERVER] Tool response input:', JSON.stringify(toolResponse.input, null, 2));
    const jsonResponse = toolResponse.input as FormatterInput;

    // Add bibliography as an artifact if it exists
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

    console.log('[SERVER] Parsed JSON response:', JSON.stringify(jsonResponse, null, 2));

    // Convert JSON response to XML for backward compatibility.
    const xmlResponseWithCDATA = convertJsonToXml(jsonResponse);
    console.log('[SERVER] Generated XML before validation:', xmlResponseWithCDATA);

    const isValid = await isValidXMLResponse(xmlResponseWithCDATA);
    console.log('[SERVER] XML validation result:', isValid);
    if (!isValid) {
      throw new Error('Generated XML response is invalid');
    }

    const xmlResponse = stripCDATATags(xmlResponseWithCDATA);
    console.log('[SERVER] Final XML being sent to client:', xmlResponse);

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
  console.log('[SERVER] XML Validation - Input length:', response.length);
  try {
    if (!response.includes('<response>')) {
      console.log('[SERVER] XML Validation - No XML structure found, wrapping response');
      response = `<response>\n<conversation>\n${response}\n</conversation>\n</response>`;
    }
    console.log('[SERVER] XML Validation - Attempting to parse...');
    try {
      const result = (await parseXML(response)) as XMLResponse;
      const hasResponse = result && 'response' in result;
      const hasConversation = hasResponse && Array.isArray(result.response.conversation);
      console.log('[SERVER] XML Validation - Structure check results:', {
        hasResponse,
        hasConversation
      });
      return hasResponse && hasConversation;
    } catch (parseError) {
      console.log('[SERVER] XML Validation - Parse error:', parseError);
      return false;
    }
  } catch (error) {
    console.error('[SERVER] XML Validation - Error during validation:', error);
    return false;
  }
}

// Update server-status endpoint
app.get('/api/server-status', async (_req: Request, res: Response) => {
  try {
    let serverStatus: ServerStatus[] = [];
    
    try {
      const tools = await mcpClient.listTools();
      serverStatus.push({
        name: 'mcp-backend-client',
        isRunning: true,
        tools: Object.values(tools).map((tool: unknown) => (tool as ServerTool).name)
      });
    } catch (error) {
      console.error('Failed to list tools:', error);
      serverStatus.push({
        name: 'mcp-backend-client',
        isRunning: false,
        tools: []
      });
    }

    res.json({ servers: serverStatus });
  } catch (error) {
    console.error('Failed to get server status:', error);
    res.status(500).json({
      error: 'Failed to get server status',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});
