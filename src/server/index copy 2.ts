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
import { testSystemPrompt } from './testSystemPrompt';
import fs from 'fs/promises';

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

// Add new interface for server tool
interface ServerTool {
    name: string;
    description?: string;
    inputSchema?: {
        type: string;
        properties?: Record<string, unknown>;
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
    useTestPrompt?: boolean;
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
    console.log('[SERVER] Available MCP Tools:', toolsByServer);
    return toolsByServer;
}

// Add logging function
async function logValidationResult(responseText: string, isValid: boolean, repairAttempts: number = 0) {
    const timestamp = new Date().toISOString();
    const logDir = path.join(path.dirname(__dirname), '../logs/production');
    const logFile = path.join(logDir, 'validation_results.txt');
    
    try {
        // Ensure log directory exists
        await fs.mkdir(logDir, { recursive: true });

        // Create log entry with full response
        const logEntry = `
=== Validation Result ${timestamp} ===
Success: ${isValid}
Repair Attempts: ${repairAttempts}
Full Response:
${responseText}

=== End Response ===

`;

        // Append to log file
        await fs.appendFile(logFile, logEntry);

        // If validation failed, save full response
        if (!isValid) {
            const failuresDir = path.join(logDir, 'failures');
            await fs.mkdir(failuresDir, { recursive: true });
            const failureFile = path.join(failuresDir, `failed_response_${timestamp.replace(/[:.]/g, '-')}.txt`);
            await fs.writeFile(failureFile, responseText);
        }
    } catch (error) {
        console.error('Failed to write validation log:', error);
    }
}

// Add logging function for tool usage
async function logToolUsage(serverName: string, toolName: string, args: Record<string, unknown>, result: any, userMessage: string, error?: Error) {
    const timestamp = new Date().toISOString();
    const logDir = path.join(path.dirname(__dirname), '../logs/production');
    const toolLogFile = path.join(logDir, 'tool_usage.txt');
    
    try {
        // Ensure log directory exists
        await fs.mkdir(logDir, { recursive: true });

        // Create log entry
        const logEntry = `
=== Tool Usage ${timestamp} ===
User Message: ${userMessage}
Server: ${serverName}
Tool: ${toolName}
Arguments: ${JSON.stringify(args, null, 2)}
${error ? `Error: ${error.message}` : `Result: ${JSON.stringify(result, null, 2)}`}
=== End Tool Usage ===

`;

        // Append to log file
        await fs.appendFile(toolLogFile, logEntry);
    } catch (error) {
        console.error('Failed to write tool usage log:', error);
    }
}

// Add detailed logging function
let currentLogFile: string | null = null;

async function logDetailedStep(step: string, data: any) {
    const timestamp = new Date().toISOString();
    const logDir = '/Users/andycrouse/Documents/GitHub/charm-mcp/logs/detailedserverlog';
    
    try {
        // Ensure log directory exists
        await fs.mkdir(logDir, { recursive: true });

        // Create new log file if none exists for this session
        if (!currentLogFile) {
            const date = new Date();
            const fileName = `detaillog_${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}_${date.getHours().toString().padStart(2, '0')}-${date.getMinutes().toString().padStart(2, '0')}-${date.getSeconds().toString().padStart(2, '0')}.txt`;
            currentLogFile = path.join(logDir, fileName);
        }

        // Format the log entry with type information
        const logEntry = `
=== ${step} at ${timestamp} ===
Data Type: ${typeof data}
Is String: ${typeof data === 'string'}
Raw Length: ${typeof data === 'string' ? data.length : JSON.stringify(data).length}

Content:
${typeof data === 'string' ? data : JSON.stringify(data, null, 2)}

Parsed Content (if string containing JSON):
${typeof data === 'string' && data.trim().startsWith('{') ? 
    JSON.stringify(JSON.parse(data), null, 2) : 
    'Not a JSON string'}
=== End ${step} ===

`;

        // Append to the current session's log file
        await fs.appendFile(currentLogFile, logEntry);
    } catch (error) {
        console.error('Failed to write detailed log:', error);
    }
}

// Add function to strip CDATA tags from XML
function stripCDATATags(xml: string): string {
    return xml.replace(/<!\[CDATA\[(.*?)\]\]>/gs, '$1');
}

app.post('/api/chat', async (req: Request<{}, {}, ChatRequest>, res: Response) => {
    try {
        // Reset the log file at the start of each new chat request
        currentLogFile = null;
        
        await logDetailedStep('Incoming Request', {
            message: req.body.message,
            historyLength: req.body.history.length,
            useTestPrompt: req.body.useTestPrompt
        });

        const { message, history, useTestPrompt } = req.body;

        // Get available tools from MCP servers
        const mcpTools = await getAllAvailableTools();
        await logDetailedStep('Available MCP Tools', mcpTools);

        // Create messages array with history and current message
        const messages = [
            ...history,
            { role: 'user' as const, content: message }
        ];

        // First, ask Claude which tools to use
        await logDetailedStep('Tool Selection Request', {
            message: "Determining which tools to use for the request"
        });

        const toolSelectionResponse = await anthropic.messages.create({
            model: 'claude-3-5-sonnet-20241022',
            max_tokens: 4000,
            messages: [
                ...messages,
                {
                    role: 'user' as const,
                    content: `Given the following available tools from MCP servers:
${JSON.stringify(mcpTools, null, 2)}

And my request: "${message}"

Please analyze which tools would be most appropriate to use for this request. Respond in JSON format with:
1. The tools you recommend using
2. The order they should be used in
3. A brief explanation for each tool
4. The parameters you would use for each tool

Format your response as a JSON object with this structure:
{
    "recommended_tools": [
        {
            "server": "server_name",
            "tool": "tool_name",
            "explanation": "why this tool is needed",
            "parameters": {}
        }
    ]
}`
                }
            ],
            temperature: 0.7
        });

        if (toolSelectionResponse.content[0].type !== 'text') {
            throw new Error('Expected text response for tool selection');
        }

        const toolSelectionText = toolSelectionResponse.content[0].text;
        await logDetailedStep('Tool Selection Response', toolSelectionText);

        // Parse the tool selection response
        let selectedTools;
        try {
            selectedTools = JSON.parse(toolSelectionText);
            await logDetailedStep('Parsed Tool Selection', selectedTools);
        } catch (error) {
            console.error('Failed to parse tool selection response:', error);
            await logDetailedStep('Tool Selection Parse Error', {
                error: error instanceof Error ? error.message : 'Unknown error',
                response: toolSelectionText
            });
        }

        // Proceed with the existing response formatter call
        // Log the request to Claude
        console.log('[SERVER] Sending request to Claude:', {
            model: 'claude-3-5-sonnet-20241022',
            messages: messages,
            systemPrompt: useTestPrompt ? 'test prompt' : 'main prompt',
            tool_choice: { type: "tool", name: "response_formatter" }
        });

        const response = await anthropic.messages.create({
            model: 'claude-3-5-sonnet-20241022',
            max_tokens: 4000,
            messages: messages,
            system: useTestPrompt ? testSystemPrompt : systemPrompt,
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
        await logDetailedStep('Request Error', error instanceof Error ? error.message : 'Unknown error');
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