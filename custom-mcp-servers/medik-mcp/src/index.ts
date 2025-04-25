import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { createInterface } from 'readline';
import { formatKnowledgeGraphArtifact, formatNetworkNeighborhood } from "./formatters.js";
import { randomUUID } from 'crypto';

// Define log levels type
type LogLevel = 'debug' | 'info' | 'notice' | 'warning' | 'error' | 'critical' | 'alert' | 'emergency';

// Helper function for structured logging
function sendStructuredLog(server: Server, level: LogLevel, message: string, metadata?: Record<string, unknown>) {
    if (DEBUG) console.error(`[medik-mcp] [MEDIK-STEP 0] PREPARING TO SEND LOG: ${message}`);
    const timestamp = new Date().toISOString();
    const traceId = randomUUID().split('-')[0];
    
    const formattedMessage = `[medik-mcp] [${level.toUpperCase()}] [${traceId}] ${message}`;
    
    try {
        if (DEBUG) {
            console.error(`[medik-mcp] [MEDIK-STEP 0] Server object type: ${typeof server}`);
            console.error(`[medik-mcp] [MEDIK-STEP 0] Has sendLoggingMessage: ${typeof server.sendLoggingMessage === 'function'}`);
        }
        
        const logPayload = {
            level,
            logger: 'medik-mcp',
            data: {
                message: formattedMessage,
                timestamp: timestamp,
                traceId: traceId,
                level: level,
                method: "logging/message",
                ...metadata
            },
        };
        
        if (DEBUG) console.error(`[medik-mcp] [MEDIK-STEP 0] About to call server.sendLoggingMessage with payload: ${JSON.stringify(logPayload)}`);
        
        server.sendLoggingMessage(logPayload);
        
        if (DEBUG) console.error(`[medik-mcp] [MEDIK-STEP 0] ✅ server.sendLoggingMessage completed without errors`);
    } catch (error) {
        console.error(`[medik-mcp] [MEDIK-STEP 0] ❌ ERROR SENDING LOG:`, {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
            level,
            message,
            metadata
        });

        console.error(formattedMessage);
        if (metadata && Object.keys(metadata).length > 0) {
            console.error(`[medik-mcp] [${traceId}] Metadata:`, metadata);
        }
    }
}

// mediKanren API configuration
// const MEDIKANREN_API_BASE = "https://medikanren.loca.lt/";
const MEDIKANREN_API_BASE = "https://medikanren.metareflective.app";
// https://medikanren.loca.lt/
const DEBUG = false;  // Set to false to reduce logging

// Define interface types for API responses
interface QueryErrorResponse {
    error: string;
}

type QueryResponse = any[] | QueryErrorResponse;

// Define validation schemas based on the OpenAPI spec
const QueryRequestSchema = z.object({
    e1: z.string().describe("X->Known or Known->X, for subject unknown or object unknown respectively."),
    e2: z.string().describe("A biolink predicate such as biolink:treats, from the biolink list."),
    e3: z.string().describe("A CURIE such as MONDO:0011719; you can ask a Monarch action to get a CURIE from a name.")
});

// Define validation schema for network-neighborhood tool
const NetworkNeighborhoodRequestSchema = z.object({
    curies: z.array(z.string()).min(2).describe("Array of CURIEs (at least 2) representing genes or proteins.")
});

// Define validation schema for get-everything tool
const GetEverythingRequestSchema = z.object({
    curie: z.string().describe("A CURIE such as MONDO:0011719; you can ask a Monarch action to get a CURIE from a name.")
});

// Create server instance
const server = new Server(
    {
        name: "medik-mcp",
        version: "1.0.0",
    },
    {
        capabilities: {
            tools: {},
            logging: {}  // Add logging capability
        },
    }
);

// Debug helper for direct console output
function debugLog(message: string, data?: any) {
    if (DEBUG) {
        console.error(`[medik-mcp] [MEDIK-DEBUG] ${message}`, data ? data : '');
    }
}

// Helper function for API requests
async function makeMediKanrenRequest<T>(params: Record<string, any>, retryCount = 0): Promise<T | null> {
    const MAX_RETRIES = 3;
    const RETRY_DELAY_MS = 1000;
    
    const url = `${MEDIKANREN_API_BASE}/query`;
    
    try {
        const queryParams = new URLSearchParams();
        for (const [key, value] of Object.entries(params)) {
            queryParams.append(key, value);
        }
        
        const fullUrl = `${url}?${queryParams.toString()}`;
        if (DEBUG) console.error(`[medik-mcp] Making request to: ${fullUrl}`);
        
        const headers: Record<string, string> = {};
        if (MEDIKANREN_API_BASE.includes('medikanren.loca.lt')) {
            const username = '';
            const password = '138.26.202.195';
            const credentials = Buffer.from(`${username}:${password}`).toString('base64');
            headers['Authorization'] = `Basic ${credentials}`;
        }
        
        const response = await fetch(fullUrl, {
            method: 'GET',
            headers
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

// Function to run a query
export async function runQuery(params: {
    e1: string,
    e2: string,
    e3: string
}): Promise<QueryResponse | null> {
    const { e1, e2, e3 } = params;
    
    if (DEBUG) console.error(`[medik-mcp] Query: ${e1} ${e2} ${e3}`);
    
    try {
        const queryResult = await makeMediKanrenRequest<QueryResponse>({
            e1, e2, e3
        });
        
        if (!queryResult) {
            console.error(`[medik-mcp] Query failed`);
            return null;
        }
        
        if (Array.isArray(queryResult) && DEBUG) {
            console.error(`[medik-mcp] Query returned ${queryResult.length} results`);
        }
        
        return queryResult;
    } catch (error) {
        console.error(`[medik-mcp] Query error:`, error);
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
}): Promise<QueryResponse | null> {
    const { curies } = params;
    
    if (DEBUG) {
        console.error(`[medik-mcp] MEDIK: NEW NETWORK NEIGHBORHOOD QUERY STARTED AT ${new Date().toISOString()}`);
        console.error(`[medik-mcp] MEDIK: Query for genes: ${curies.join(', ')}`);
    }
    
    try {
        const allResults = [];
        const successfulGenes = [];
        const failedGenes = [];
        
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
        }
        
        console.error(`[medik-mcp] Network neighborhood query summary:`);
        console.error(`[medik-mcp] - Total genes processed: ${curies.length}`);
        console.error(`[medik-mcp] - Successful genes: ${successfulGenes.length} (${successfulGenes.join(', ')})`);
        console.error(`[medik-mcp] - Failed genes: ${failedGenes.length} (${failedGenes.join(', ')})`);
        console.error(`[medik-mcp] - Total relationships retrieved: ${allResults.length}`);
        
        return allResults;
    } catch (error) {
        console.error(`[medik-mcp] MEDIK: Network neighborhood query error:`, error);
        return null;
    }
}

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
        tools: [
            {
                name: "run-query",
                description: "Run a 1-hop query in mediKanren. Note: If you need comprehensive bidirectional relationships, use get-everything instead as it provides complete coverage.",
                inputSchema: {
                    type: "object",
                    properties: {
                        e1: {
                            type: "string",
                            description: "X->Known or Known->X, for subject unknown or object unknown respectively.",
                        },
                        e2: {
                            type: "string",
                            description: "A biolink predicate such as biolink:treats, from the biolink list.",
                        },
                        e3: {
                            type: "string",
                            description: "A CURIE such as MONDO:0011719; you can ask a Monarch action to get a CURIE from a name.",
                        }
                    },
                    required: ["e1", "e2", "e3"],
                },
            },
            {
                name: "get-everything",
                description: "Run both X->Known and Known->X queries with biolink:related_to to get all relationships for a CURIE. This is the recommended comprehensive query that provides complete bidirectional coverage. Do not use run-query if you are using this tool as it would be redundant.",
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
        ],
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

        if (toolName === "run-query") {
            const { e1, e2, e3 } = QueryRequestSchema.parse(toolArgs);
            
            if (DEBUG) {
                console.error("\n\n========================================");
                console.error(`MEDIK: NEW QUERY STARTED AT ${new Date().toISOString()}`);
                console.error(`MEDIK: Query: ${e1} ${e2} ${e3}`);
                console.error("========================================\n");
                console.error('MEDIK: Parsed arguments:', { e1, e2, e3 });
            }
        
            const queryResult = await runQuery({ e1, e2, e3 });
        
            if (!queryResult) {
                if (DEBUG) {
                    console.error("========================================");
                    console.error(`MEDIK: QUERY FAILED AT ${new Date().toISOString()}`);
                    console.error("========================================\n");
                }
                return {
                    content: [
                        {
                            type: "text",
                            text: "Failed to retrieve query results. Please check the server logs for details.",
                        },
                    ],
                };
            }
            
            if (Array.isArray(queryResult)) {
                server.sendLoggingMessage({
                    level: "info",
                    data: {
                        message: "MEDIK: Filtering out nodes with CAID: prefix from query results",
                        originalResultCount: queryResult.length
                    },
                });
                
                if (DEBUG) console.error(`MEDIK: Starting CAID node filtering process on ${queryResult.length} results`);
                
                try {
                    if (DEBUG) console.error(`MEDIK: Calling formatKnowledgeGraphArtifact with ${queryResult.length} results`);
                    
                    const formattingPromise = formatKnowledgeGraphArtifact(queryResult, { e1, e2, e3 });
                    if (DEBUG) console.error(`MEDIK: Got Promise from formatKnowledgeGraphArtifact, waiting for resolution...`);
                    
                    const formattedResult = await formattingPromise;
                    if (DEBUG) console.error(`MEDIK: Promise resolved successfully, got formatted result`);
                    
                    if (formattedResult.filteredCount && formattedResult.filteredCount > 0) {
                        if (DEBUG) console.error(`MEDIK: Filtered out ${formattedResult.filteredCount} relationships involving ${formattedResult.filteredNodeCount} unique CAID nodes`);
                        server.sendLoggingMessage({
                            level: "info",
                            data: {
                                message: `MEDIK: Filtered out ${formattedResult.filteredCount} relationships involving ${formattedResult.filteredNodeCount} unique nodes with CAID: prefix`,
                                filteredCount: formattedResult.filteredCount,
                                filteredNodeCount: formattedResult.filteredNodeCount,
                                remainingCount: queryResult.length - formattedResult.filteredCount
                            },
                        });
                    } else if (DEBUG) {
                        console.error(`MEDIK: No CAID nodes found in the results`);
                    }
                    
                    if (DEBUG) {
                        console.error(`MEDIK: Formatted result has ${formattedResult.content.length} content items and ${formattedResult.artifacts?.length || 0} artifacts`);
                        console.error("\n========================================");
                        console.error(`MEDIK: QUERY COMPLETED SUCCESSFULLY AT ${new Date().toISOString()}`);
                        console.error("========================================\n");
                    }
                    
                    return {
                        content: formattedResult.content,
                        artifacts: formattedResult.artifacts
                    };
                } catch (error) {
                    console.error(`MEDIK: Error formatting results: ${error instanceof Error ? error.message : String(error)}`);
                    if (DEBUG) {
                        console.error(`MEDIK: Error stack trace: ${error instanceof Error ? error.stack : 'No stack trace available'}`);
                        console.error("========================================");
                        console.error(`MEDIK: QUERY ERROR AT ${new Date().toISOString()}: Error formatting results`);
                        console.error("========================================\n");
                    }
                    return {
                        content: [
                            {
                                type: "text",
                                text: `Error formatting results: ${error instanceof Error ? error.message : 'Unknown error'}`,
                            },
                        ],
                    };
                }
            } else if ('error' in queryResult) {
                console.error("========================================");
                console.error(`MEDIK: QUERY ERROR AT ${new Date().toISOString()}: ${queryResult.error}`);
                console.error("========================================\n");
                return {
                    content: [
                        {
                            type: "text",
                            text: `Error: ${queryResult.error}`,
                        },
                    ],
                };
            } else {
                console.error("========================================");
                console.error(`MEDIK: QUERY COMPLETED WITH UNKNOWN RESULT TYPE AT ${new Date().toISOString()}`);
                console.error("========================================\n");
                const formattedResult = JSON.stringify(queryResult, null, 2);
                return {
                    content: [
                        {
                            type: "text",
                            text: `Query results:\n\n${formattedResult}`,
                        },
                    ],
                };
            }
        } else if (toolName === "get-everything") {
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
            
            // Check if the result is an array (successful query) or an error
            if (Array.isArray(queryResult)) {
                // Log that we're filtering CAID nodes
                server.sendLoggingMessage({
                    level: "info",
                    data: {
                        message: "MEDIK: Filtering out nodes with CAID: prefix from bidirectional query results",
                        originalResultCount: queryResult.length
                    },
                });
                
                try {
                    console.error(`MEDIK: Calling formatKnowledgeGraphArtifact with ${queryResult.length} results`);
                    
                    // Create a combined query params object for the formatter
                    // We'll use a special value for e1 to indicate this is a bidirectional query
                    const combinedParams = {
                        e1: "Bidirectional",
                        e2: "biolink:related_to",
                        e3: curie
                    };
                    
                    // Format the query results into a knowledge graph artifact
                    const formattingPromise = formatKnowledgeGraphArtifact(queryResult, combinedParams);
                    console.error(`MEDIK: Got Promise from formatKnowledgeGraphArtifact, waiting for resolution...`);
                    
                    // Wait for the Promise to resolve
                    const formattedResult = await formattingPromise;
                    console.error(`MEDIK: Promise resolved successfully, got formatted result`);
                    
                    // Add metadata about the query success and node count
                    const metadata = {
                        querySuccess: true,
                        bothDirectionsSuccessful: true, // Since this is a bidirectional query and we got results
                        nodeCount: JSON.parse(formattedResult.artifacts?.[0]?.content || '{"nodes":[]}').nodes.length,
                        message: "Both forward and reverse queries were successful. No need to run this query again."
                    };

                    // Return the formatted result with metadata
                    return {
                        content: formattedResult.content,
                        artifacts: formattedResult.artifacts,
                        metadata: metadata
                    };
                } catch (error) {
                    console.error(`MEDIK: Error formatting knowledge graph:`, error);
                    return {
                        content: [
                            {
                                type: "text",
                                text: `Error formatting knowledge graph: ${error}`,
                            },
                        ],
                        metadata: {
                            querySuccess: false,
                            bothDirectionsSuccessful: false,
                            nodeCount: 0
                        }
                    };
                }
            } else {
                // Handle error response
                console.error(`MEDIK: Query returned an error:`, queryResult);
                return {
                    content: [
                        {
                            type: "text",
                            text: `Query error: ${queryResult.error}`,
                        },
                    ],
                    metadata: {
                        querySuccess: false,
                        bothDirectionsSuccessful: false,
                        nodeCount: 0
                    }
                };
            }
        } else if (toolName === "network-neighborhood") {
            // Validate parameters
            const { curies } = NetworkNeighborhoodRequestSchema.parse(toolArgs);
            
            // Add explicit logging for testing
            sendStructuredLog(server, 'info', `Processing network-neighborhood request for ${curies.join(', ')}`, {
                curies,
                toolName,
                timestamp: new Date().toISOString()
            });
            
            console.error(`MEDIK: Query: network-neighborhood for ${curies.join(', ')}`);
            
            // Add a clear boundary marker for the start of a new query
            console.error("\n\n========================================");
            console.error(`MEDIK: NEW NETWORK NEIGHBORHOOD QUERY STARTED AT ${new Date().toISOString()}`);
            console.error(`MEDIK: Query: network-neighborhood for ${curies.join(', ')}`);
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
                            text: "Failed to retrieve network-neighborhood query results. Please check the server logs for details.",
                        },
                    ],
                };
            }
            
            // Check if the result is an array (successful query) or an error
            if (Array.isArray(queryResult)) {
                // Log that we're filtering CAID nodes
                server.sendLoggingMessage({
                    level: "info",
                    data: {
                        message: "MEDIK: Filtering out nodes with CAID: prefix from network-neighborhood query results",
                        originalResultCount: queryResult.length
                    },
                });
                
                // console.error(`MEDIK: Star ting CAID node filtering process on ${queryResult.length} results`);
                
                try {
                    console.error(`MEDIK: Calling formatNetworkNeighborhood with ${queryResult.length} results`);
                    
                    // Format the query results into a knowledge graph artifact
                    const formattingPromise = formatNetworkNeighborhood(queryResult, curies);
                    console.error(`MEDIK: Got Promise from formatNetworkNeighborhood, waiting for resolution...`);
                    
                    // Wait for the Promise to resolve
                    const formattedResult = await formattingPromise;
                    console.error(`MEDIK: Promise resolved successfully, got formatted result`);
                    
                    // Log the filtering results
                    if (formattedResult.filteredCount && formattedResult.filteredCount > 0) {
                        console.error(`MEDIK: Filtered out ${formattedResult.filteredCount} relationships involving ${formattedResult.filteredNodeCount} unique CAID nodes`);
                        server.sendLoggingMessage({
                            level: "info",
                            data: {
                                message: `MEDIK: Filtered out ${formattedResult.filteredCount} relationships involving ${formattedResult.filteredNodeCount} unique nodes with CAID: prefix`,
                                filteredCount: formattedResult.filteredCount,
                                filteredNodeCount: formattedResult.filteredNodeCount,
                                remainingCount: queryResult.length - formattedResult.filteredCount
                            },
                        });
                    } else {
                        console.error(`MEDIK: No CAID nodes found in the results`);
                    }
                    
                    // Log the content and artifacts
                    console.error(`MEDIK: Formatted result has ${formattedResult.content.length} content items and ${formattedResult.artifacts?.length || 0} artifacts`);
                    
                    // Add a clear boundary marker for the end of a successful query
                    console.error("\n========================================");
                    console.error(`MEDIK: QUERY COMPLETED SUCCESSFULLY AT ${new Date().toISOString()}`);
                    console.error("========================================\n");
                    
                    // Return the formatted result as a ServerResult
                    return {
                        content: formattedResult.content,
                        artifacts: formattedResult.artifacts
                    };
                } catch (error) {
                    console.error(`MEDIK: Error formatting results:`, error);
                    return {
                        content: [
                            {
                                type: "text",
                                text: `Error formatting results: ${error instanceof Error ? error.message : 'Unknown error'}`,
                            },
                        ],
                    };
                }
            } else {
                // Handle error response
                console.error(`MEDIK: Query returned an error:`, queryResult);
                return {
                    content: [
                        {
                            type: "text",
                            text: `Query error: ${queryResult.error}`,
                        },
                    ],
                };
            }
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
    const transport = new StdioServerTransport();
    
    try {
        await server.connect(transport);
        
        sendStructuredLog(server, 'info', 'Server started', {
            transport: 'stdio',
            timestamp: new Date().toISOString()
        });
        
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const diagnosticId = randomUUID().slice(0, 8);
        
        try {
            if (DEBUG) {
                console.error(`[medik-mcp] [MEDIK-INIT] Starting server diagnostic - ${diagnosticId}`);
                console.error(`[medik-mcp] [MEDIK-INIT] Server object available: ${!!server}`);
                console.error(`[medik-mcp] [MEDIK-INIT] sendLoggingMessage method available: ${typeof server.sendLoggingMessage === 'function'}`);
            }
        } catch (error) {
            console.error(`[medik-mcp] [MEDIK-INIT] Error during server diagnostic tests:`, {
                error: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined
            });
        }
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
    process.exit(1);
}); 