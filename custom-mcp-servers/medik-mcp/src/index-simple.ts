#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { formatKnowledgeGraphArtifact, formatNetworkNeighborhood } from "./formatters.js";
import { randomUUID } from 'crypto';
import logger from './logger.js';
import fs from 'fs';
import path from 'path';

// Define log levels type
type LogLevel = 'debug' | 'info' | 'notice' | 'warning' | 'error' | 'critical' | 'alert' | 'emergency';

// mediKanren API configuration
const MEDIKANREN_API_BASE = "https://medikanren.metareflective.systems";
const DEBUG = false;  // Set to false to reduce logging

// Define interface types for API responses
interface QueryErrorResponse {
    error: string;
}

// Define the main response type as an array (for successful queries)
type QueryResponse = any[] | QueryErrorResponse;

// Define validation schemas
const NetworkNeighborhoodRequestSchema = z.object({
    curies: z.array(z.string()).min(2).describe("Array of CURIEs (at least 2) representing genes or proteins.")
});

const GetEverythingRequestSchema = z.object({
    curie: z.string().describe("A CURIE such as MONDO:0011719; you can ask a Monarch action to get a CURIE from a name.")
});

// Create server instance
const server = new Server(
    {
        name: "medik-mcp",
        version: "1.0.1-simple",
    },
    {
        capabilities: {
            tools: {},
            logging: {}
        },
    }
);

// Logging helper function
function sendStructuredLog(server: Server, level: LogLevel, message: string, data?: any) {
    try {
        server.sendLoggingMessage({
            level,
            data: { message, ...data }
        });
    } catch (error) {
        console.error(`Failed to send log: ${error}`);
    }
}

// Function for debugging
function debugLog(message: string, data?: any) {
    if (DEBUG) {
        console.error(`[DEBUG] ${message}`, data ? JSON.stringify(data) : '');
    }
}

// Helper function for API requests
async function makeMediKanrenRequest<T>(params: Record<string, any>, retryCount = 0): Promise<T | null> {
    const MAX_RETRIES = 5;
    const url = `${MEDIKANREN_API_BASE}/query`;
    
    try {
        const queryParams = new URLSearchParams();
        for (const [key, value] of Object.entries(params)) {
            queryParams.append(key, value);
        }
        
        const fullUrl = `${url}?${queryParams.toString()}`;
        if (DEBUG) console.error(`[medik-mcp] Making request to: ${fullUrl}`);
        
        const response = await fetch(fullUrl, {
            method: 'GET',
        });
        
        if (!response.ok) {
            console.error(`[medik-mcp] HTTP error! status: ${response.status} for query: ${JSON.stringify(params)}`);
            throw new Error(`HTTP error! status: ${response.status} for query: ${JSON.stringify(params)}`);
        }
        
        const data = await response.json();
        return data as T;
    } catch (error) {
        console.error(`[medik-mcp] Error in request: ${error instanceof Error ? error.message : String(error)}`);
        
        if (retryCount < MAX_RETRIES) {
            if (DEBUG) console.error(`[medik-mcp] Retrying request (attempt ${retryCount + 2}/${MAX_RETRIES + 1})`);
            return makeMediKanrenRequest<T>(params, retryCount + 1);
        }
        
        return null;
    }
}

// Function to run both X->Known and Known->X queries
export async function runBidirectionalQuery(params: {
    curie: string
}): Promise<QueryResponse | null> {
    const { curie } = params;
    
    if (DEBUG) console.error(`[medik-mcp] Starting bidirectional query for ${curie}`);
    
    try {
        console.error(`[medik-mcp] Running X->Known query for ${curie}`);
        const xToKnownResult = await makeMediKanrenRequest<QueryResponse>({
            e1: 'X->Known',
            e2: 'biolink:related_to',
            e3: curie
        });

        console.error(`[medik-mcp] Running Known->X query for ${curie}`);
        const knownToXResult = await makeMediKanrenRequest<QueryResponse>({
            e1: 'Known->X',
            e2: 'biolink:related_to',
            e3: curie
        });

        let combinedResults: any[] = [];
        
        if (Array.isArray(xToKnownResult)) {
            console.error(`[medik-mcp] X->Known query for ${curie} returned ${xToKnownResult.length} results`);
            combinedResults = [...combinedResults, ...xToKnownResult];
        } else {
            console.error(`[medik-mcp] X->Known query for ${curie} failed or returned no results`);
        }
        
        if (Array.isArray(knownToXResult)) {
            console.error(`[medik-mcp] Known->X query for ${curie} returned ${knownToXResult.length} results`);
            combinedResults = [...combinedResults, ...knownToXResult];
        } else {
            console.error(`[medik-mcp] Known->X query for ${curie} failed or returned no results`);
        }

        const deduplicatedResults = combinedResults.filter((result, index, self) =>
            index === self.findIndex((r) => (
                r[0] === result[0] &&
                r[2] === result[2] &&
                r[3] === result[3]
            ))
        );
        
        if (deduplicatedResults.length === 0) {
            console.error(`[medik-mcp] No results found for ${curie} after deduplication`);
            return null;
        }
        
        if (DEBUG) console.error(`[medik-mcp] Found ${deduplicatedResults.length} unique relationships`);
        return deduplicatedResults;
        
    } catch (error) {
        console.error(`[medik-mcp] Error in bidirectional query: ${error instanceof Error ? error.message : String(error)}`);
        return null;
    }
}

// Function to run network neighborhood query
export async function runNetworkNeighborhoodQuery(params: {
    curies: string[]
}): Promise<any[] | null> {
    const { curies } = params;
    
    if (DEBUG) {
        console.error(`[medik-mcp] MEDIK: NEW NETWORK NEIGHBORHOOD QUERY STARTED AT ${new Date().toISOString()}`);
        console.error(`[medik-mcp] MEDIK: Query for genes: ${curies.join(', ')}`);
    }
    
    try {
        const allResults: any[] = [];
        const successfulGenes: string[] = [];
        const failedGenes: string[] = [];
        
        for (const curie of curies) {
            console.error(`[medik-mcp] Processing gene: ${curie}`);
            
            const queryResult = await runBidirectionalQuery({ curie });
            
            if (Array.isArray(queryResult) && queryResult.length > 0) {
                console.error(`[medik-mcp] Successfully retrieved ${queryResult.length} relationships for ${curie}`);
                allResults.push(...queryResult);
                successfulGenes.push(curie);
            } else {
                console.error(`[medik-mcp] Failed to retrieve relationships for ${curie}`);
                failedGenes.push(curie);
            }
            
            // Add a delay between requests to be respectful to the API
            if (curies.indexOf(curie) < curies.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
        
        console.error(`[medik-mcp] Query complete. Success: ${successfulGenes.length}, Failed: ${failedGenes.length}, Total results: ${allResults.length}`);
        
        if (failedGenes.length > 0) {
            console.error(`[medik-mcp] Failed genes: ${failedGenes.join(', ')}`);
        }
        
        return allResults.length > 0 ? allResults : null;
        
    } catch (error) {
        console.error(`[medik-mcp] Error in network neighborhood query: ${error instanceof Error ? error.message : String(error)}`);
        return null;
    }
}

// Log server initialization
sendStructuredLog(server, 'info', 'Starting server v1.0.1-simple with get-everything and network-neighborhood tools');

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
    console.error('[TOOLS-DEBUG] Starting ListToolsRequestSchema handler');
    
    const allTools = [
        {
            name: "get-everything",
            description: "Run both X->Known and Known->X queries with biolink:related_to to get all relationships for a CURIE. This provides complete bidirectional coverage.",
            inputSchema: {
                type: "object",
                properties: {
                    curie: {
                        type: "string",
                        description: "A CURIE such as MONDO:0011719; you can ask a Monarch action to get a CURIE from a name.",
                    }
                },
                required: ["curie"],
            },
        },
        {
            name: "network-neighborhood",
            description: "Find genes or proteins that are neighbors in the network.",
            inputSchema: {
                type: "object",
                properties: {
                    curies: {
                        type: "array",
                        items: {
                            type: "string",
                            description: "Array of CURIEs (at least 2) representing genes or proteins.",
                        },
                        minItems: 2,
                        description: "Array of CURIEs (at least 2) representing genes or proteins.",
                    },
                },
                required: ["curies"],
            },
        }
    ];

    console.error('[TOOLS-DEBUG] Tools list created with', allTools.length, 'tools');
    console.error('[TOOLS-DEBUG] Tools names:', allTools.map(t => t.name).join(', '));
    
    return {
        tools: allTools
    };
});

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

        if (DEBUG) {
            console.error('MEDIK: Tool request:', { toolName, toolArgs });
        }

        if (toolName === "get-everything") {
            // Validate parameters
            const { curie } = GetEverythingRequestSchema.parse(toolArgs);
            
            // Add explicit logging for testing
            sendStructuredLog(server, 'info', `Processing get-everything request for ${curie}`, {
                curie,
                toolName,
                timestamp: new Date().toISOString()
            });
            
            console.error(`MEDIK: Query: get-everything for ${curie}`);
            
            // Add a clear boundary marker for the start of a new query
            console.error("\n\n========================================");
            console.error(`MEDIK: NEW BIDIRECTIONAL QUERY STARTED AT ${new Date().toISOString()}`);
            console.error(`MEDIK: Query: get-everything for ${curie}`);
            console.error("========================================\n");
            
            if (DEBUG) {
                console.error('MEDIK: Parsed arguments:', { curie });
            }
        
            const queryResult = await runBidirectionalQuery({ curie });
        
            if (!queryResult) {
                console.error("========================================");
                console.error(`MEDIK: BIDIRECTIONAL QUERY FAILED AT ${new Date().toISOString()}`);
                console.error("========================================\n");
                return {
                    content: [
                        {
                            type: "text",
                            text: "Failed to retrieve bidirectional query results. Please check the server logs for details.",
                        },
                    ],
                    metadata: {
                        querySuccess: false,
                        bothDirectionsSuccessful: false,
                        nodeCount: 0
                    }
                };
            }
        
            // Format the results using the graph formatter
            const graphResult = formatKnowledgeGraphArtifact(queryResult as any[], curie);
            
            console.error("========================================");
            console.error(`MEDIK: BIDIRECTIONAL QUERY COMPLETED AT ${new Date().toISOString()}`);
            console.error("========================================\n");
            
            return graphResult;
            
        } else if (toolName === "network-neighborhood") {
            // Validate parameters
            const { curies } = NetworkNeighborhoodRequestSchema.parse(toolArgs);
            
            console.error(`MEDIK: Query: network-neighborhood for ${curies.join(', ')}`);
            
            // Add a clear boundary marker for the start of a new query  
            console.error("\n\n========================================");
            console.error(`MEDIK: NEW NETWORK NEIGHBORHOOD QUERY STARTED AT ${new Date().toISOString()}`);
            console.error(`MEDIK: Query: network-neighborhood for genes ${curies.join(', ')}`);
            console.error("========================================\n");
            
            if (DEBUG) {
                console.error('MEDIK: Parsed arguments:', { curies });
            }
        
            const queryResult = await runNetworkNeighborhoodQuery({ curies });
        
            if (!queryResult) {
                console.error("========================================");
                console.error(`MEDIK: NETWORK NEIGHBORHOOD QUERY FAILED AT ${new Date().toISOString()}`);
                console.error("========================================\n");
                return {
                    content: [
                        {
                            type: "text",
                            text: "Failed to retrieve network neighborhood query results. Please check the server logs for details.",
                        },
                    ],
                    metadata: {
                        querySuccess: false,
                        nodeCount: 0
                    }
                };
            }
        
            // Format the results using the network neighborhood formatter
            const networkResult = formatNetworkNeighborhood(queryResult, curies);
            
            console.error("========================================");
            console.error(`MEDIK: NETWORK NEIGHBORHOOD QUERY COMPLETED AT ${new Date().toISOString()}`);
            console.error("========================================\n");
            
            return networkResult;
            
        } else {
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
        console.error(`MEDIK: Error handling tool request:`, error);
        return {
            content: [
                {
                    type: "text",
                    text: `Error: ${error}`,
                },
            ],
        };
    }
});

// Start the server
async function main() {
    console.log(`[medik-mcp] Starting simplified server with log file: ${logger.getLogFile()}`);
    
    const transport = new StdioServerTransport();
    
    try {
        // Connect to the server first
        await server.connect(transport);
        
        // Wait for connection to be fully established
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Now that we're connected, send the startup log
        sendStructuredLog(server, 'info', 'Simplified server started', {
            transport: 'stdio',
            timestamp: new Date().toISOString(),
            logFile: logger.getLogFile()
        });
        
        // Send a test log message to verify logging is working
        console.log('[DIAGNOSTIC] Sending explicit test log message...');
        sendStructuredLog(server, 'info', 'Test log message', {
            timestamp: new Date().toISOString()
        });
        console.log('[DIAGNOSTIC] Test log message sent!');
        
    } catch (error) {
        console.error('[medik-mcp] [MEDIK-INIT] Fatal error during server initialization', {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined
        });
        throw error;
    }
}

main().catch((error) => {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    sendStructuredLog(server, 'critical', 'Fatal error in main()', {
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined
    });
    logger.close();
    process.exit(1);
});

// Register cleanup handlers
process.on('SIGINT', () => {
    console.log('[medik-mcp] Server shutting down (SIGINT)');
    logger.close();
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('[medik-mcp] Server shutting down (SIGTERM)');
    logger.close();
    process.exit(0);
});

process.on('exit', () => {
    console.log('[medik-mcp] Server exiting');
    logger.close();
}); 