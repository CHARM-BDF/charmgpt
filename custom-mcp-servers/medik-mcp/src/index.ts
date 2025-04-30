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
import { LLMClient } from "../../mcp-helpers/llm-client.js";
import logger from './logger.js';
import fs from 'fs';
import path from 'path';

// Enable console interception to capture logs to file
logger.interceptConsole();

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

// Initialize the LLM client
const llmClient = new LLMClient({
    mcpName: 'medik-mcp', // Identifies this MCP in logs
    retries: 3 // Number of retry attempts for failed requests
});

// Log LLM client initialization 
if (DEBUG) console.error('[medik-mcp] LLM Client initialized');

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

// Define validation schema for find-pathway tool
const FindPathwayRequestSchema = z.object({
    sourceCurie: z.string().describe("CURIE of the first entity (e.g., gene HGNC:1097)"),
    targetCurie: z.string().describe("CURIE of the second entity (e.g., disease MONDO:0011719)"),
    maxIterations: z.number().default(3).describe("Maximum number of exploration iterations"),
    maxNodesPerIteration: z.number().default(5).describe("Number of candidate nodes to explore in each iteration")
});

// Add TypeScript declaration for global.writeDebugLog
declare global {
    var writeDebugLog: (message: string) => void;
}

// Create server instance
const server = new Server(
    {
        name: "medik-mcp",
        version: "1.0.1",
    },
    {
        capabilities: {
            tools: {},
            logging: {}  // Add logging capability
        },
    }
);

// Direct file logging for debugging
try {
    // Use the imported fs and path modules
    const debugDir = './debug';
    
    // Create debug directory if it doesn't exist
    if (!fs.existsSync(debugDir)) {
        fs.mkdirSync(debugDir, { recursive: true });
    }
    
    // Create a debug log file
    const timestamp = new Date().toISOString()
        .replace(/:/g, '-')
        .replace(/\..+/, '')
        .replace('T', '_');
    const debugFile = path.join(debugDir, `medik-debug_${timestamp}.log`);
    
    // Write initial log
    fs.writeFileSync(debugFile, `MediK MCP Server Debug Log\nStarted at: ${new Date().toISOString()}\nVersion: 1.0.1\n\n`);
    
    // Log function for appending to the debug file
    global.writeDebugLog = function(message) {
        try {
            const logEntry = `[${new Date().toISOString()}] ${message}\n`;
            fs.appendFileSync(debugFile, logEntry);
            console.error(`[DEBUG] ${message}`);
        } catch (err) {
            console.error(`[ERROR] Failed to write debug log: ${err}`);
        }
    };
    
    global.writeDebugLog('Debug logging initialized');
    global.writeDebugLog('Server version: 1.0.1');
    global.writeDebugLog('find-pathway tool is enabled');
} catch (error) {
    console.error('Failed to initialize debug logging:', error);
}

// Log server initialization
console.log(`[medik-mcp] Starting server v1.0.1 with find-pathway tool enabled`);
console.log(`[medik-mcp] Registering tools: run-query, get-everything, network-neighborhood, find-pathway`);

// Debug helper for direct console output
function debugLog(message: string, data?: any) {
    if (DEBUG) {
        console.error(`[medik-mcp] [MEDIK-DEBUG] ${message}`, data ? data : '');
    }
}

// Helper function for API requests
async function makeMediKanrenRequest<T>(params: Record<string, any>, retryCount = 0): Promise<T | null> {
    const MAX_RETRIES = 5;
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
    console.error('[TOOLS-DEBUG] Starting ListToolsRequestSchema handler');
    
    // Create the tools array with all tools
    console.error('[TOOLS-DEBUG] Creating tools array...');
    const allTools = [
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
            name: "find-pathway",
            description: "Find potential connection pathways between two biomedical entities by exploring the knowledge graph",
            inputSchema: {
                type: "object",
                properties: {
                    sourceCurie: {
                        type: "string",
                        description: "CURIE of the first entity (e.g., gene HGNC:1097)",
                    },
                    targetCurie: {
                        type: "string", 
                        description: "CURIE of the second entity (e.g., disease MONDO:0011719)",
                    },
                    maxIterations: {
                        type: "number",
                        description: "Maximum number of exploration iterations (default: 3)",
                    },
                    maxNodesPerIteration: {
                        type: "number",
                        description: "Number of candidate nodes to explore in each iteration (default: 5)",
                    }
                },
                required: ["sourceCurie", "targetCurie"],
            },
            // These fields were causing issues, removing them
            // version: "0.1",
            // enabled: true  // Explicitly mark the tool as enabled
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
    
    // Double-check that find-pathway is included
    const findPathwayTool = allTools.find(t => t.name === 'find-pathway');
    console.error('[TOOLS-DEBUG] Find-pathway tool found?', !!findPathwayTool);
    
    // Log to debug file
    if (global.writeDebugLog) {
        global.writeDebugLog('--------- TOOLS LIST ---------');
        global.writeDebugLog(`Returning ${allTools.length} tools:`);
        allTools.forEach(tool => {
            global.writeDebugLog(`- ${tool.name}: ${tool.description.substring(0, 50)}...`);
        });
    }
    
    console.error('[TOOLS-DEBUG] Final tools count before return:', allTools.length);
    
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
        } else if (toolName === "find-pathway") {
            // Validate parameters
            const { sourceCurie, targetCurie, maxIterations = 3, maxNodesPerIteration = 5 } = 
                FindPathwayRequestSchema.parse(toolArgs);
            
            // Create a unique ID for this pathway request for tracking in logs
            const requestId = randomUUID().substring(0, 8);
            
            // Log the request
            sendStructuredLog(server, 'info', `Starting pathway discovery between ${sourceCurie} and ${targetCurie}`, {
                requestId,
                sourceCurie,
                targetCurie,
                maxIterations,
                maxNodesPerIteration
            });
            
            try {
                // Step 1: Get initial neighborhoods for source and target
                sendStructuredLog(server, 'info', `Querying initial neighborhoods for source and target`, {
                    requestId,
                    stage: "initial_neighborhoods"
                });
                
                const sourceNeighborhood = await runBidirectionalQuery({ curie: sourceCurie });
                const targetNeighborhood = await runBidirectionalQuery({ curie: targetCurie });
                
                if (!sourceNeighborhood || !targetNeighborhood) {
                    sendStructuredLog(server, 'error', `Failed to retrieve neighborhoods for source or target`, {
                        sourceCurie,
                        targetCurie,
                        sourceSuccess: !!sourceNeighborhood,
                        targetSuccess: !!targetNeighborhood
                    });
                    
                    return {
                        content: [
                            {
                                type: "text",
                                text: `Could not find neighborhood information for ${!sourceNeighborhood ? sourceCurie : ''} ${!sourceNeighborhood && !targetNeighborhood ? 'and' : ''} ${!targetNeighborhood ? targetCurie : ''}. Please verify these CURIEs exist in the knowledge graph.`
                            }
                        ]
                    };
                }

                // Step 2: Format the neighborhoods for the LLM
                sendStructuredLog(server, 'info', `Formatting neighborhoods for LLM analysis`, {
                    requestId,
                    stage: "data_preparation"
                });
                
                // Format nodes for LLM analysis - simplify the data structure
                const formatRelationshipForLLM = (rel: any[]) => {
                    // Expected format: [subject, predicate, object, ...]
                    return {
                        subject: rel[0] || 'Unknown',
                        predicate: rel[2] || 'Unknown',
                        object: rel[3] || 'Unknown'
                    };
                };
                
                const sourceRelationships = Array.isArray(sourceNeighborhood) 
                    ? sourceNeighborhood
                        .filter(rel => rel && rel.length >= 4)
                        .map(formatRelationshipForLLM)
                        .slice(0, 20) // Limit to 20 relationships to avoid token limits
                    : [];
                
                const targetRelationships = Array.isArray(targetNeighborhood)
                    ? targetNeighborhood
                        .filter(rel => rel && rel.length >= 4)
                        .map(formatRelationshipForLLM)
                        .slice(0, 20) // Limit to 20 relationships
                    : [];
                
                sendStructuredLog(server, 'info', `Using LLM to identify potential connecting paths`, {
                    requestId,
                    stage: "llm_analysis",
                    sourceRelationshipsCount: sourceRelationships.length,
                    targetRelationshipsCount: targetRelationships.length
                });

                // Step 3: Use the LLM client to analyze potential pathways
                try {
                    // Log that we're about to call the LLM
                    console.error(`[medik-mcp] [Pathfinder:${requestId}] Calling LLM client for pathway analysis between ${sourceCurie} and ${targetCurie}`);
                    
                    // Add detailed logging before LLM call
                    sendStructuredLog(server, 'info', `[Pathfinder:${requestId}] Preparing LLM request with prompt data`, {
                        stage: "llm_request_preparation",
                        requestId,
                        model: "claude-3-opus-20240229",
                        promptLength: {
                            system: generateSystemPrompt().length,
                            user: generateUserPrompt(sourceCurie, targetCurie).length
                        },
                        timestamp: new Date().toISOString()
                    });
                    
                    // FIX: Use llmClient instead of server.llm and use the correct method name (extractJSON with uppercase JSON)
                    // Also add explicit error handling with more details in the logs
                    const systemPrompt = generateSystemPrompt();
                    const userPrompt = generateUserPrompt(sourceCurie, targetCurie);
                    
                    console.error(`[medik-mcp] [Pathfinder:${requestId}] Using llmClient to query LLM`);
                    
                    const response = await llmClient.query({
                        prompt: userPrompt,
                        systemPrompt: systemPrompt,
                        responseFormat: 'text',
                        options: {
                            model: "claude-3-opus-20240229"
                        }
                    });

                    // Log the raw response for debugging
                    console.error(`[medik-mcp] [Pathfinder:${requestId}] Raw LLM response:`, 
                        response ? `success=${response.success}, content_length=${response.content?.length || 0}` : 'null');
                    
                    // Add more detailed logging for the response
                    sendStructuredLog(server, 'info', `[Pathfinder:${requestId}] Received LLM response`, {
                        stage: "llm_response_received",
                        requestId,
                        status: response?.success ? "success" : "error",
                        hasContent: !!response?.content,
                        contentSize: response?.content ? response.content.length : 0,
                        errorMessage: response?.error || null,
                        responseTime: new Date().toISOString()
                    });

                    console.error(`[medik-mcp] [Pathfinder:${requestId}] LLM response received: ${response?.success ? "success" : "error"}`);

                    if (!response || !response.success || !response.content) {
                        // Add detailed error logging
                        sendStructuredLog(server, 'error', `[Pathfinder:${requestId}] Failed to extract pathways from LLM response`, {
                            stage: "llm_extraction_failure",
                            requestId,
                            error: response?.error || "Invalid or empty LLM response",
                            rawResponse: response ? JSON.stringify(response).substring(0, 500) : "null",
                            timestamp: new Date().toISOString()
                        });
                        
                        return {
                            content: [
                                {
                                    type: "text",
                                    text: `Error: ${response?.error || 'Unknown error'}`
                                }
                            ],
                            metadata: {
                                pathfinder: true,
                                sourceCurie,
                                targetCurie,
                                maxIterations,
                                maxNodesPerIteration,
                                sourceNeighborhoodSize: Array.isArray(sourceNeighborhood) ? sourceNeighborhood.length : 0,
                                targetNeighborhoodSize: Array.isArray(targetNeighborhood) ? targetNeighborhood.length : 0,
                                llmSuccess: false,
                                version: "0.1-prototype"
                            }
                        };
                    }
                    
                    // Format the response
                    const analysisText = `## Pathway Analysis Results

### Source Entity: ${sourceCurie}
Found ${sourceRelationships.length} relationships in its neighborhood.

### Target Entity: ${targetCurie}
Found ${targetRelationships.length} relationships in its neighborhood.

### Potential Pathways
${response.content}

---
*Note: This is an early prototype of the pathway discovery tool. Future versions will include interactive graph visualization.*`;
                    
                    // Return the formatted response
                    return {
                        content: [
                            {
                                type: "text",
                                text: analysisText
                            }
                        ],
                        metadata: {
                            pathfinder: true,
                            sourceCurie,
                            targetCurie,
                            maxIterations,
                            maxNodesPerIteration,
                            sourceNeighborhoodSize: Array.isArray(sourceNeighborhood) ? sourceNeighborhood.length : 0,
                            targetNeighborhoodSize: Array.isArray(targetNeighborhood) ? targetNeighborhood.length : 0,
                            llmSuccess: response.success,
                            version: "0.1-prototype"
                        }
                    };
                    
                } catch (llmError) {
                    // Handle LLM error gracefully with detailed logs
                    console.error(`[medik-mcp] [Pathfinder:${requestId}] LLM query error:`, llmError);
                    
                    // Add full error details to the log
                    const errorDetails = {
                        message: llmError instanceof Error ? llmError.message : String(llmError),
                        stack: llmError instanceof Error ? llmError.stack : undefined,
                        name: llmError instanceof Error ? llmError.name : undefined,
                        toString: String(llmError)
                    };
                    
                    sendStructuredLog(server, 'error', `[Pathfinder:${requestId}] LLM query failed: ${errorDetails.message}`, {
                        stage: "llm_error",
                        requestId,
                        errorDetails,
                        timestamp: new Date().toISOString()
                    });
                    
                    // Return a degraded but still useful response
                    return {
                        content: [
                            {
                                type: "text",
                                text: `## Pathway Analysis Results

### Source Entity: ${sourceCurie}
Found ${sourceRelationships.length} relationships in its neighborhood.

### Target Entity: ${targetCurie}
Found ${targetRelationships.length} relationships in its neighborhood.

### LLM Analysis Failed
Could not generate pathway analysis due to an error with the LLM service.
The basic neighborhood data has been retrieved successfully.

---
*Error details: ${errorDetails.message}*`
                            }
                        ],
                        metadata: {
                            pathfinder: true,
                            sourceCurie,
                            targetCurie,
                            llmSuccess: false,
                            version: "0.1-prototype"
                        }
                    };
                }
                
            } catch (error) {
                console.error(`[medik-mcp] Pathway discovery error:`, error);
                sendStructuredLog(server, 'error', `Pathway discovery failed with error: ${error instanceof Error ? error.message : String(error)}`, {
                    sourceCurie,
                    targetCurie,
                    error: error instanceof Error ? error.message : String(error),
                    stack: error instanceof Error ? error.stack : undefined
                });
                
                return {
                    content: [
                        {
                            type: "text",
                            text: `Error finding pathway: ${error instanceof Error ? error.message : String(error)}`
                        }
                    ]
                };
            }
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

// Generate system prompt for the LLM
function generateSystemPrompt(): string {
  return `You are a biomedical pathway analysis expert. Your analysis should be scientific and evidence-based.
When asked to identify pathways, please output a numbered list of pathways in the following format:
1. [Pathway Name] - [Brief description of mechanism with key proteins/genes]

Focus on molecular interactions, signaling pathways, metabolic pathways, gene regulation, 
or other biological processes that connect the entities. 
Limit your analysis to 3-5 of the most relevant and well-established pathways.`;
}

// Generate user prompt for the LLM
function generateUserPrompt(entity1: string, entity2: string): string {
  return `Identify the biological pathways that connect ${entity1} and ${entity2}. 
For each pathway, briefly describe the key steps and mediators involved in the relationship.`;
}

// Start the server
async function main() {
    console.log(`[medik-mcp] Starting server with log file: ${logger.getLogFile()}`);
    
    const transport = new StdioServerTransport();
    
    try {
        await server.connect(transport);
        
        sendStructuredLog(server, 'info', 'Server started', {
            transport: 'stdio',
            timestamp: new Date().toISOString(),
            logFile: logger.getLogFile()
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
    // Close the logger before exiting
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