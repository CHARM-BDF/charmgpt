import express, { Request, Response } from 'express';
import cors from 'cors';
import { Anthropic } from '@anthropic-ai/sdk';
import dotenv from 'dotenv';
import { parseString } from 'xml2js';
import { promisify } from 'util';
import path from 'path';
import { fileURLToPath } from 'url';
import MCPServerManager from '../utils/mcpServerManager';
import { systemPrompt } from './systemPrompt';
// import fs from 'fs/promises';

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

// First, get the tools and format them for Anthropic
interface AnthropicTool {
    name: string;
    description: string;
    input_schema: {
        type: "object";
        properties: Record<string, unknown>;
        required?: string[];
    };
}

// Add new interface for server tool
interface ServerTool {
    name: string;
    description?: string;
    inputSchema?: {
        type: string;
        properties?: Record<string, unknown>;
        required?: string[];  // Add this line
    };
}


// Add new interface for server status response
interface ServerStatus {
    name: string;
    isRunning: boolean;
    tools: ServerTool[];
}

// Add interface for tool response
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

type MessageContent = string | Array<{
    type: string;
    text?: string;
    tool_use_id?: string;
    content?: Array<{ type: string; text: string; }>;
    name?: string;
    input?: Record<string, unknown>;
}>;

interface ChatMessage {
    role: 'user' | 'assistant';
    content: MessageContent;
}


dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Initialize Anthropic client
const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
});

// Initialize MCP Server Manager
const mcpConfigPath = path.join(__dirname, '../config/mcp_server_config.json');
const mcpManager = new MCPServerManager(mcpConfigPath);

interface ChatRequest {
    message: string;
    history: Array<{ role: 'user' | 'assistant'; content: string; }>;
}

app.use(cors());
app.use(express.json());

// Add XML validation helper
async function isValidXMLResponse(response: string): Promise<boolean> {
    console.log('[SERVER] XML Validation - Input length:', response.length);
    try {
        // If response doesn't have XML tags, wrap it in proper XML structure
        if (!response.includes('<response>')) {
            console.log('[SERVER] XML Validation - No XML structure found, wrapping response');
            response = `<response>\n<conversation>\n${response}\n</conversation>\n</response>`;
        }

        console.log('[SERVER] XML Validation - Attempting to parse...');
        try {
            const result = await parseXML(response) as XMLResponse;

            // Check for required elements
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

// Add function to get all available tools
async function getAllAvailableTools(): Promise<Record<string, ServerTool[]>> {
    const serverNames = mcpManager.getServerNames();
    const toolsByServer: Record<string, ServerTool[]> = {};

    await Promise.all(
        serverNames.map(async serverName => {
            if (mcpManager.isServerRunning(serverName)) {
                const tools = await mcpManager.fetchServerTools(serverName);
                if (tools && tools.length > 0) {
                    toolsByServer[serverName] = tools;
                }
            }
        })
    );
    // console.log('[SERVER] Available MCP Tools:', toolsByServer);
    return toolsByServer;
}

// Format the tools for Anthropic
function formatToolsForAnthropic(mcpTools: Record<string, ServerTool[]>): AnthropicTool[] {
    return Object.values(mcpTools)
        .flat()
        .map(tool => ({
            name: tool.name,
            description: tool.description || `Tool for ${tool.name}`,
            input_schema: {
                type: "object",
                properties: tool.inputSchema?.properties || {},
                required: tool.inputSchema?.required || [] // Keep original required fields if they exist
            }
        }));
}

// Add function to strip CDATA tags from XML
function stripCDATATags(xml: string): string {
    return xml.replace(/<!\[CDATA\[(.*?)\]\]>/gs, '$1');
}

app.post('/api/chat', async (req: Request<{}, {}, ChatRequest>, res: Response) => {
    try {
        const { message, history } = req.body;

        // Get available tools from MCP servers
        const mcpTools = await getAllAvailableTools();

        // Format the tools for Anthropic
        const formattedTools = formatToolsForAnthropic(mcpTools);

        // Create messages array with history and current message
        const messages: ChatMessage[] = [
            ...history,
            { role: 'user' as const, content: message }
        ];

        const toolSelectionResponse = await anthropic.messages.create({
            model: 'claude-3-5-sonnet-20241022',
            max_tokens: 4000,
            messages: messages,
            temperature: 0.7,
            tools: formattedTools,
        });

        // Check for tool usage in Claude's response
        for (const content of toolSelectionResponse.content) {
            if (content.type === 'tool_use') {

                // Execute the tool
                const [serverName, toolName] = content.name.split(':');
                const toolResult = await mcpManager.callTool(
                    serverName,
                    toolName,
                    content.input as Record<string, unknown>
                );

                messages.push({
                    role: 'assistant',
                    content: [{
                        type: 'tool_use',
                        name: content.name,
                        input: content.input
                    }]
                });
                messages.push({
                    role: 'user',
                    content: [{
                        type: 'tool_result',
                        tool_use_id: content.id,  // Need to include the tool call ID
                        content: JSON.stringify(toolResult)
                    }]
                });
            }
        }

        // Proceed with the existing response formatter call
        // Log the request to Claude
        console.log('[SERVER] Sending request to Claude:', {
            model: 'claude-3-5-sonnet-20241022',
            messages: messages,
            systemPrompt: 'main prompt',
            tool_choice: { type: "tool", name: "response_formatter" }
        });

        const response = await anthropic.messages.create({
            model: 'claude-3-5-sonnet-20241022',
            max_tokens: 4000,
            messages: messages,
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
                                        description: "For type 'text': markdown formatted text content"
                                    },
                                    artifact: {
                                        type: "object",
                                        description: "For type 'artifact': artifact details",
                                        properties: {
                                            type: {
                                                type: "string",
                                                enum: [
                                                    "text/markdown",
                                                    "application/vnd.ant.code",
                                                    "image/svg+xml",
                                                    "application/vnd.mermaid",
                                                    "text/html",
                                                    "application/vnd.react"
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

        // Log the raw response from Claude
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

        // Log the tool response
        console.log('[SERVER] Tool response input:', JSON.stringify(toolResponse.input, null, 2));

        // Use the tool response input as our JSON response
        const jsonResponse = toolResponse.input as FormatterInput;

        // Log the parsed response
        console.log('[SERVER] Parsed JSON response:', JSON.stringify(jsonResponse, null, 2));

        // Convert the JSON response to XML format for backward compatibility
        const xmlResponseWithCDATA = convertJsonToXml(jsonResponse);

        // Log the XML before validation
        console.log('[SERVER] Generated XML before validation:', xmlResponseWithCDATA);

        // Validate the XML response (with CDATA)
        const isValid = await isValidXMLResponse(xmlResponseWithCDATA);
        console.log('[SERVER] XML validation result:', isValid);

        if (!isValid) {
            throw new Error('Generated XML response is invalid');
        }

        // Strip CDATA tags before sending to client
        const xmlResponse = stripCDATATags(xmlResponseWithCDATA);

        // Log the final XML being sent
        console.log('[SERVER] Final XML being sent to client:', xmlResponse);

        // Send the XML response
        res.json({ response: xmlResponse });

    } catch (error) {
        console.error('Error processing request:', error);
        res.status(500).json({
            error: 'Failed to process chat message',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

// Add function to convert JSON response to XML format
function convertJsonToXml(jsonResponse: FormatterInput): string {
    let xml = '<response>\n';

    // Add thinking section if present
    if (jsonResponse.thinking) {
        xml += '    <thinking>\n';
        xml += `        <![CDATA[${jsonResponse.thinking}]]>\n`;
        xml += '    </thinking>\n';
    }

    // Add conversation section
    xml += '    <conversation>\n';

    // Process each conversation segment
    for (const segment of jsonResponse.conversation) {
        if (segment.type === 'text' && segment.content) {
            xml += `        <![CDATA[${segment.content}]]>\n`;
        } else if (segment.type === 'artifact' && segment.artifact) {
            const artifact = segment.artifact;
            xml += '\n';  // Add line break before artifact
            xml += `        <artifact type="${artifact.type}" id="${artifact.id}" title="${artifact.title}"${artifact.language ? ` language="${artifact.language}"` : ''}>\n`;
            xml += `            <![CDATA[${artifact.content}]]>\n`;
            xml += '        </artifact>\n';
            xml += '\n';  // Add line break after artifact
        }
    }

    xml += '    </conversation>\n';
    xml += '</response>';

    return xml;
}

// Add new endpoint for server status
app.get('/api/server-status', async (_req: Request, res: Response) => {
    try {
        const serverNames = mcpManager.getServerNames();
        const serverStatuses: ServerStatus[] = await Promise.all(
            serverNames.map(async serverName => {
                const isRunning = mcpManager.isServerRunning(serverName);
                let tools = [];
                if (isRunning) {
                    tools = await mcpManager.fetchServerTools(serverName) || [];
                }
                return {
                    name: serverName,
                    isRunning,
                    tools
                };
            })
        );

        res.json({ servers: serverStatuses });
    } catch (error) {
        console.error('Failed to get server status:', error);
        res.status(500).json({
            error: 'Failed to get server status',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

app.listen(port, async () => {
    try {
        // Start all MCP servers
        await mcpManager.startAllServers();

        const now = new Date();
        const timestamp = now.toLocaleString();
        console.log(`Hot reload at: ${timestamp}`);
        console.log(`Server running at http://localhost:${port}`);
    } catch (error) {
        console.error('Failed to start MCP servers:', error);
        process.exit(1);
    }
});