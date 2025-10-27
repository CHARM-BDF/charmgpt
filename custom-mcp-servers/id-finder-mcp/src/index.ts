import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { randomUUID } from 'crypto';
import { 
    formatAsMarkdownTable, 
    formatAsGraph, 
    groupByType, 
    EntityIdentification, 
    Entity, 
    AraxResponse, 
    extractNormalizerInfo,
    formatAraxAsMarkdownTable,
    convertAraxToEntityIdentification,
    NormalizerInfo
} from './formatter.js';

// Enable debug mode for verbose logging
const DEBUG = false;

// Define log levels type
type LogLevel = 'debug' | 'info' | 'notice' | 'warning' | 'error' | 'critical' | 'alert' | 'emergency';

// Helper function for structured logging
function sendStructuredLog(server: Server, level: LogLevel, message: string, metadata?: Record<string, unknown>) {
    console.error(`[id-finder-mcp] [LOG] ${message}`);
    const timestamp = new Date().toISOString();
    const traceId = randomUUID().split('-')[0];
    
    // Format the message
    const formattedMessage = `[id-finder-mcp] [${level.toUpperCase()}] [${traceId}] ${message}`;
    
    try {
        // Create log payload
        const logPayload = {
            level,
            logger: 'id-finder-mcp',
            data: {
                message: formattedMessage,
                timestamp: timestamp,
                traceId: traceId,
                level: level,
                method: "logging/message",
                ...metadata
            },
        };
        
        // Send through MCP logging system
        server.sendLoggingMessage(logPayload);
        
        // Also log to console for debugging
        if (DEBUG) {
            console.error(`[id-finder-mcp] [DEBUG] Successfully sent log message through MCP`);
            if (metadata && Object.keys(metadata).length > 0) {
                console.error(`[id-finder-mcp] [${traceId}] Metadata:`, metadata);
            }
        }
    } catch (error) {
        // Log the error to console since MCP logging failed
        console.error(`[id-finder-mcp] ERROR SENDING LOG:`, {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
            level,
            message,
            metadata
        });

        // Fall back to console.error
        console.error(formattedMessage);
        if (metadata && Object.keys(metadata).length > 0) {
            console.error(`[id-finder-mcp] [${traceId}] Metadata:`, metadata);
        }
    }
}

// Debug helper for direct console output
function debugLog(message: string, data?: any) {
    if (DEBUG) {
        console.error(`[id-finder-mcp] [DEBUG] ${message}`, data ? data : '');
    }
}

// ARAX entity API configuration
const ARAX_API_URL = "https://arax.ncats.io/api/arax/v1.4/entity";

// Define patterns for entity recognition
const GENE_PATTERN = /\b[A-Z0-9]{2,}[A-Z0-9]*\b/g;
const BASIC_TERM_EXTRACTION = /\b[A-Za-z][\w-]+(?:\s+[A-Za-z][\w-]+){0,5}\b/g;

// Extract entities from text
function extractEntities(text: string): string[] {
    const entities: Set<string> = new Set();
    
    // Extract potential gene symbols (all caps)
    const geneMatches = text.match(GENE_PATTERN) || [];
    geneMatches.forEach(match => entities.add(match));
    
    // Extract basic terms - these could be diseases, drugs, etc.
    const termMatches = text.match(BASIC_TERM_EXTRACTION) || [];
    termMatches.forEach(match => {
        // Filter out common words, conjunctions, etc.
        if (match.length > 3 && !isCommonWord(match)) {
            entities.add(match);
        }
    });
    
    return Array.from(entities);
}

// Naive check for common words to filter them out
function isCommonWord(word: string): boolean {
    const commonWords = [
        'and', 'the', 'this', 'that', 'with', 'from', 'for', 'what', 'where', 'when',
        'who', 'how', 'why', 'which', 'should', 'could', 'would', 'about', 'find'
    ];
    return commonWords.includes(word.toLowerCase());
}

// Function to query ARAX API for entity identification
async function identifyEntities(entities: string[]): Promise<EntityIdentification[]> {
    try {
        const response = await fetch(ARAX_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': '*/*',
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache'
            },
            body: JSON.stringify({
                terms: entities
            })
        });

        if (!response.ok) {
            console.error(`[id-finder-mcp] HTTP error! status: ${response.status}`);
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        
        // Check if we got an ARAX format response
        if (typeof data === 'object' && !Array.isArray(data)) {
            // Convert ARAX format to our standard format
            return convertAraxToEntityIdentification(data as AraxResponse);
        }
        
        return data as EntityIdentification[];
    } catch (error) {
        console.error(`[id-finder-mcp] Error in API request: ${error instanceof Error ? error.message : String(error)}`);
        throw error;
    }
}

// Function to directly query ARAX API and get the raw response
async function queryAraxApi(entities: string[]): Promise<AraxResponse> {
    try {
        const response = await fetch(ARAX_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': '*/*',
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache'
            },
            body: JSON.stringify({
                terms: entities
            })
        });

        if (!response.ok) {
            console.error(`[id-finder-mcp] HTTP error! status: ${response.status}`);
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        return data as AraxResponse;
    } catch (error) {
        console.error(`[id-finder-mcp] Error in API request: ${error instanceof Error ? error.message : String(error)}`);
        throw error;
    }
}

// Create server instance
const server = new Server(
    {
        name: "id-finder-mcp",
        version: "1.0.0",
    },
    {
        capabilities: {
            tools: {},
            logging: {}
        },
    }
);

// Define validation schemas for tools
const GetNormalizerInfoRequestSchema = z.object({
    entities: z.union([
        z.string().describe("Entity (gene, disease, drug, etc.) to get normalizer info for"),
        z.array(z.string()).describe("Array of entities to get normalizer info for")
    ]).describe("Single entity or array of entities to get normalizer info for")
});

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
        tools: [
            {
                name: "get-normalizer-info",
                description: "Get only the SRI normalizer information (category, curie, name) for one or more entities.",
                inputSchema: {
                    type: "object",
                    properties: {
                        entities: {
                            oneOf: [
                                {
                                    type: "string",
                                    description: "Entity (gene, disease, drug, etc.) to get normalizer info for",
                                },
                                {
                                    type: "array",
                                    items: {
                                        type: "string",
                                    },
                                    description: "Array of entities to get normalizer info for",
                                }
                            ],
                            description: "Single entity or array of entities to get normalizer info for",
                        }
                    },
                    required: ["entities"],
                },
            }
        ],
    };
});

// Format entity data for display
function formatEntityData(entityData: EntityIdentification[]): any {
    return entityData.map(data => {
        // Check if any identifiers were found
        if (!data.identifiers || data.identifiers.length === 0) {
            return {
                input: data.input,
                status: "No identifiers found"
            };
        }

        // Format each identifier
        return {
            input: data.input,
            identifiers: data.identifiers.map(entity => ({
                id: entity.identifier,
                name: entity.name,
                type: entity.type.join(', '),
                description: entity.description || "No description available",
                confidence: entity.confidence || 1.0
            }))
        };
    });
}

// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request, extra) => {
    try {
        const toolName = request.params.name;
        const toolArgs = request.params.arguments || {};

        debugLog('Tool execution started', {
            tool: toolName,
            args: toolArgs,
            hasExtra: !!extra
        });

        if (toolName === "get-normalizer-info") {
            // Get only the normalizer info for one or more entities
            const { entities } = GetNormalizerInfoRequestSchema.parse(toolArgs);
            
            // Convert to array if single string
            const entityArray = Array.isArray(entities) ? entities : [entities];
            
            sendStructuredLog(server, 'info', `Processing get-normalizer-info request for: ${entityArray.join(', ')}`, {
                entities: entityArray,
                count: entityArray.length,
                timestamp: new Date().toISOString()
            });
            
            // Get the raw ARAX response
            const araxResponse = await queryAraxApi(entityArray);
            
            // Extract just the normalizer values
            const normalizerInfo = extractNormalizerInfo(araxResponse);
            
            // Identify which terms didn't match
            const matchedTerms = normalizerInfo.map(info => info.input);
            const unmatchedTerms = entityArray.filter(term => !matchedTerms.includes(term));
            
            // Format response according to the requested format
            let responseText = "We found the following matches ";
            
            if (normalizerInfo.length === 0) {
                responseText = `We found no matches for the provided terms: ${entityArray.join(', ')}.`;
            } else {
                // List matches in the requested format
                const matchesList = normalizerInfo.map(info => 
                    `${info.input} (ID: ${info.curie}, Type: ${info.category})`
                ).join(', ');
                
                responseText = `We found the following matches: ${matchesList}`;
                
                // Add unmatched terms if any
                if (unmatchedTerms.length > 0) {
                    responseText += ` and these terms did not match any terms we have an ID for: ${unmatchedTerms.join(', ')}.`;
                } else {
                    responseText += '.';
                }
            }
            
            // Convert the normalizer table to plain text instead of markdown
            const normalizerTable = "| Input | Category | Identifier | Name |\n" +
                                    "|-------|----------|------------|------|\n" +
                                    normalizerInfo.map(info => 
                                        `| ${info.input} | ${info.category} | ${info.curie} | ${info.name} |`
                                    ).join("\n");
            
            // Format the JSON as text
            const jsonAsText = JSON.stringify(normalizerInfo, null, 2);
            
            // Combine everything into a single text response
            const fullResponse = `${responseText}\n\n${normalizerTable}\n\n${jsonAsText}`;
            
            return {
                content: [
                    {
                        type: "text",
                        text: fullResponse
                    }
                ],
                artifacts: [
                    {
                        type: "application/json",
                        name: "normalizer-info.json",
                        content: JSON.stringify(normalizerInfo, null, 2)
                    }
                ]
            };
        } else {
            // Handle unknown tool
            return {
                content: [
                    {
                        type: "text",
                        text: `Unknown tool: ${toolName}`,
                    },
                ],
            };
        }
    } catch (error) {
        console.error(`[id-finder-mcp] Error handling tool request:`, error);
        return {
            content: [
                {
                    type: "text",
                    text: `Error: ${error instanceof Error ? error.message : String(error)}`,
                },
            ],
        };
    }
});

// Start the server
async function main() {
    console.error('[id-finder-mcp] Starting MCP server initialization');
    const transport = new StdioServerTransport();
    console.error('[id-finder-mcp] Created StdioServerTransport');
    
    try {
        console.error('[id-finder-mcp] Connecting server to transport');
        await server.connect(transport);
        console.error('[id-finder-mcp] Server connected successfully');
        
        // Basic server start log
        sendStructuredLog(server, 'info', 'ID Finder MCP Server started', {
            transport: 'stdio',
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('[id-finder-mcp] Fatal error during server initialization', {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined
        });
        throw error;
    }
}

main().catch((error) => {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    console.error(`[id-finder-mcp] Fatal error in main(): ${errorMessage}`);
    process.exit(1);
}); 