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
export function isValidXMLResponse(text: string): Promise<boolean> {
    // Wrap content inside main container tags in CDATA
    console.log("Validating XML response...");
    const wrappedText = text.replace(
        /(<(thinking|conversation|artifact)(?:\s+[^>]*)?>)([\s\S]*?)(<\/\2>)/g,
        (_match, openTag, _tagName, content, closeTag) => {
            return `${openTag}<![CDATA[${content}]]>${closeTag}`;
        }
    );

    // console.log("Server: Wrapped text for validation:\n", wrappedText);

    // Basic check for XML structure
    const hasXMLStructure = wrappedText.trim().startsWith('<response>') &&
        wrappedText.trim().endsWith('</response>') &&
        wrappedText.includes('<conversation>');

    if (!hasXMLStructure) {
        console.log('Server: Invalid XML structure detected');
        return Promise.resolve(false);
    }

    return parseXML(wrappedText)
        .then((result: unknown) => {
            const xmlResult = result as XMLResponse;
            // Check if we have the required structure
            const hasValidStructure =
                xmlResult?.response &&
                (xmlResult.response.conversation || []).length > 0;

            if (!hasValidStructure) {
                console.log('Server: Missing required XML elements');
                return false;
            }

            return true;
        })
        .catch(error => {
            console.log('Server: XML validation error:', error);
            return false;
        });
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

app.post('/api/chat', async (req: Request<{}, {}, ChatRequest>, res: Response) => {
    try {
        const { message, history, useTestPrompt } = req.body;
        // insert line return
        console.log('\n ------------------------------');
        console.log('Processing chat request...');

        // Get available tools to include in the system prompt
        const availableTools = await getAllAvailableTools();

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

        console.log('Sending request to Claude...');

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

        let repairAttempts = 0;
        let responseText = response.content[0].text;
        const isValid = await isValidXMLResponse(responseText);

        // Log initial validation result
        await logValidationResult(responseText, isValid);

        if (!isValid) {
            console.log('XML validation failed, attempting repairs...');

            // Try repair strategies
            for (const repair of repairStrategies) {
                repairAttempts++;
                try {
                    const repairedText = repair(responseText);
                    const isRepairedValid = await isValidXMLResponse(repairedText);
                    if (isRepairedValid) {
                        console.log('XML repair successful');
                        // Log successful repair
                        await logValidationResult(repairedText, true, repairAttempts);
                        res.json({ response: repairedText });
                        return;
                    }
                } catch (error) {
                    // Silent catch - continue to next strategy
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
            const isReformattedValid = await isValidXMLResponse(reformattedText);
            
            // Log reformatting result
            await logValidationResult(reformattedText, isReformattedValid, repairAttempts);

            if (isReformattedValid) {
                console.log('LLM reformatting successful');
                res.json({ response: reformattedText });
                return;
            }

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
        }

        res.json({ response: responseText });

    } catch (error) {
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