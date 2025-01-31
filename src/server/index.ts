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

// Define repair strategies
const repairStrategies = [
    // Strategy 1: Original CDATA wrapping
    (input: string) => input.replace(
        /(<(thinking|conversation|artifact)(?:\s+[^>]*)?>)([\s\S]*?)(<\/\2>)/g,
        (_match, openTag, _tagName, content, closeTag) => {
            return `${openTag}<![CDATA[${content}]]>${closeTag}`;
        }
    ),
    // Strategy 2: More aggressive CDATA wrapping including codesnip
    (input: string) => input.replace(
        /(<(thinking|conversation|artifact|codesnip)(?:\s+[^>]*)?>)([\s\S]*?)(<\/\2>)/g,
        (_match, openTag, _tagName, content, closeTag) => {
            return `${openTag}<![CDATA[${content}]]>${closeTag}`;
        }
    ),
    // Strategy 3: Fix potential XML special characters in attributes
    (input: string) => input.replace(
        /(<[^>]+)(["'])(.*?)\2([^>]*>)/g,
        (_match, start, quote, content, end) => {
            const escaped = content.replace(/[<>&'"]/g, (char: string) => {
                switch (char) {
                    case '<': return '&lt;';
                    case '>': return '&gt;';
                    case '&': return '&amp;';
                    case "'": return '&apos;';
                    case '"': return '&quot;';
                    default: return char;
                }
            });
            return `${start}${quote}${escaped}${quote}${end}`;
        }
    )
];

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
// async function logToolUsage(serverName: string, toolName: string, args: Record<string, unknown>, result: any, userMessage: string, error?: Error) {
//     const timestamp = new Date().toISOString();
//     const logDir = path.join(path.dirname(__dirname), '../logs/production');
//     const toolLogFile = path.join(logDir, 'tool_usage.txt');
    
//     try {
//         // Ensure log directory exists
//         await fs.mkdir(logDir, { recursive: true });

//         // Create log entry
//         const logEntry = `
// === Tool Usage ${timestamp} ===
// User Message: ${userMessage}
// Server: ${serverName}
// Tool: ${toolName}
// Arguments: ${JSON.stringify(args, null, 2)}
// ${error ? `Error: ${error.message}` : `Result: ${JSON.stringify(result, null, 2)}`}
// === End Tool Usage ===

// `;

//         // Append to log file
//         await fs.appendFile(toolLogFile, logEntry);
//     } catch (error) {
//         console.error('Failed to write tool usage log:', error);
//     }
// }

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

        // Format the log entry
        const logEntry = `
=== ${step} at ${timestamp} ===
${typeof data === 'string' ? data : JSON.stringify(data, null, 2)}
=== End ${step} ===

`;

        // Append to the current session's log file
        await fs.appendFile(currentLogFile, logEntry);
    } catch (error) {
        console.error('Failed to write detailed log:', error);
    }
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

        console.log('[SERVER] Processing chat request...');
        
        // Log the incoming request body length
        console.log('[SERVER] Request body length:', JSON.stringify(req.body).length);

        const { message, history, useTestPrompt } = req.body;
        // insert line return
        console.log('\n ------------------------------');
        console.log('Processing chat request...');

        // Get available tools to include in the system prompt
        console.log('Fetching available tools...');
        const availableTools = await getAllAvailableTools();

        // Add logging for available tools
        Object.entries(availableTools).forEach(([serverName, tools]) => {
            console.log(`Server ${serverName} has ${tools.length} tools available`);
        });

        const toolsDescription = Object.entries(availableTools)
            .map(([serverName, tools]) => `
                Server: ${serverName}
                Available Tools:
                ${tools.map(tool => `- ${tool.name}: ${tool.description || 'No description'}`).join('\n')}
            `).join('\n');

        // Create messages array with history and current message
        const messages = [
            ...history,
            { role: 'user' as const, content: message }
        ];

        // Enhance system prompt with tools information
        const enhancedSystemPrompt = `${useTestPrompt ? testSystemPrompt : systemPrompt}

Available MCP Tools:
${toolsDescription}

To use a tool, format your response like this:
<tool_call server="server_name" tool="tool_name">
{
    "param1": "value1",
    "param2": "value2"
}
</tool_call>

The tool result will be provided back to you to include in your response.`;

        // Before sending to Claude
        await logDetailedStep('Request to Claude', {
            messages,
            systemPrompt: enhancedSystemPrompt
        });

        const response = await anthropic.messages.create({
            model: 'claude-3-5-sonnet-20241022',
            max_tokens: 4000,
            messages: messages,
            system: enhancedSystemPrompt,
            temperature: 0.7,
        });

        if (response.content[0].type !== 'text') {
            throw new Error('Expected text response from Claude');
        }

        await logDetailedStep('Response from Claude', response.content[0].text);

        let responseText = response.content[0].text;

        // Extract and log tool usage from the response
        const toolCallMatches = responseText.match(/<tool_call[^>]*>[\s\S]*?<\/tool_call>/g);
        if (toolCallMatches) {
            await logDetailedStep('Tool Calls Found', toolCallMatches);
            
            for (const toolCallMatch of toolCallMatches) {
                try {
                    const serverMatch = toolCallMatch.match(/server="([^"]+)"/);
                    const toolMatch = toolCallMatch.match(/tool="([^"]+)"/);
                    const argsMatch = toolCallMatch.match(/\{[\s\S]*?\}(?=\s*<\/tool_call>)/);
                    
                    if (serverMatch && toolMatch && argsMatch) {
                        const serverName = serverMatch[1];
                        const toolName = toolMatch[1];
                        
                        await logDetailedStep('Tool Call Details', {
                            server: serverName,
                            tool: toolName,
                            args: argsMatch[0]
                        });

                        try {
                            const args = JSON.parse(argsMatch[0]);
                            const result = await mcpManager.callTool(serverName, toolName, args);
                            await logDetailedStep('Tool Call Result', {
                                server: serverName,
                                tool: toolName,
                                result: result
                            });
                        } catch (error) {
                            await logDetailedStep('Tool Call Error', {
                                server: serverName,
                                tool: toolName,
                                error: error instanceof Error ? error.message : 'Unknown error'
                            });
                        }
                    }
                } catch (error) {
                    await logDetailedStep('Tool Call Processing Error', error);
                }
            }
        }

        // Log before XML validation
        await logDetailedStep('Pre-XML Validation', responseText);

        const isValid = await isValidXMLResponse(responseText);
        await logDetailedStep('XML Validation Result', {
            isValid,
            responseLength: responseText.length
        });

        if (!isValid) {
            await logDetailedStep('Starting Repair Attempts', 'XML validation failed, attempting repairs');
            console.log('XML validation failed, attempting repairs...');

            // Try repair strategies
            let repairAttempts = 0;
            for (const repair of repairStrategies) {
                repairAttempts++;
                console.log(`Attempting repair strategy ${repairAttempts}...`);
                try {
                    const repairedText = repair(responseText);
                    const isRepairedValid = await isValidXMLResponse(repairedText);
                    if (isRepairedValid) {
                        console.log('XML repair successful');
                        // Log successful repair
                        await logValidationResult(repairedText, true, repairAttempts);
                        console.log('Sending repaired response...');
                        res.json({ response: repairedText });
                        return;
                    }
                } catch (error) {
                    console.log(`Repair strategy ${repairAttempts} failed:`, error);
                }
            }

            // If repairs fail, try LLM reformatting
            console.log('Attempting LLM reformatting...');
            repairAttempts++;

            const reformatResponse = await anthropic.messages.create({
                model: 'claude-3-5-sonnet-20241022',
                max_tokens: 4000,
                messages: [
                    ...history,
                    { role: 'assistant', content: responseText },
                    { role: 'user', content: 'Please reformat your last response as valid XML following the required structure with <response>, <thinking>, <conversation>, and optional <artifact> tags. Use markdown formatting for all text content.' }
                ],
                system: systemPrompt,
                temperature: 0.7,
            });

            if (reformatResponse.content[0].type !== 'text') {
                throw new Error('Expected text response from Claude');
            }

            const reformattedText = reformatResponse.content[0].text;
            console.log('Validating reformatted response...');
            const isReformattedValid = await isValidXMLResponse(reformattedText);
            
            // Log reformatting result
            await logValidationResult(reformattedText, isReformattedValid, repairAttempts);

            if (isReformattedValid) {
                console.log('LLM reformatting successful, sending response...');
                res.json({ response: reformattedText });
                return;
            }

            console.log('All repair attempts failed, sending wrapped error response...');
            // If all attempts fail, wrap in error response
            const wrappedResponse = `<response>
          <conversation>
          # Error: Response Formatting Issue
          
          I apologize, but I had trouble formatting the response properly. Here is the raw response:

          ---
          ${responseText}
          </conversation>
        </response>`;
            
            // Log final fallback
            await logValidationResult(wrappedResponse, true, repairAttempts);
            res.json({ response: wrappedResponse });
            return;
        } else {
            // Check for bibliography in tool results
            const toolCallMatches = responseText.match(/<tool_call[^>]*>[\s\S]*?<\/tool_call>/g);
            if (toolCallMatches) {
                console.log('Found tool calls:', toolCallMatches.length);
                for (const toolCallMatch of toolCallMatches) {
                    try {
                        const argsMatch = toolCallMatch.match(/{[\s\S]*?}/);
                        if (argsMatch) {
                            console.log('Processing tool call args:', argsMatch[0]);
                            const result = JSON.parse(argsMatch[0]);
                            if (result.bibliography) {
                                console.log('Found bibliography, length:', result.bibliography.length);
                                // Add bibliography artifact to the conversation
                                const originalLength = responseText.length;
                                responseText = responseText.replace(
                                    '</conversation>',
                                    `<artifact type="bibliography" id="bibliography" title="Bibliography">\n${result.bibliography}\n</artifact>\n</conversation>`
                                );
                                console.log('Added bibliography artifact. Response length change:', responseText.length - originalLength);
                            } else {
                                console.log('No bibliography found in tool result');
                            }
                        }
                    } catch (error) {
                        console.error('Error processing tool call:', error);
                    }
                }
            } else {
                console.log('No tool calls found in response');
            }

            console.log('Sending final response, length:', responseText.length);
            res.json({ response: responseText });
        }

        // Log final response
        await logDetailedStep('Final Response', responseText);

    } catch (error) {
        await logDetailedStep('Request Error', error instanceof Error ? error.message : 'Unknown error');
        console.error('Error processing request:', error);
        res.status(500).json({
            error: 'Failed to process chat message',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

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