import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { createInterface } from 'readline';
import { formatKnowledgeGraphArtifact } from "./formatters.js";

// mediKanren API configuration
const MEDIKANREN_API_BASE = "https://medikanren.metareflective.app";
const DEBUG = true;

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

// Helper function for API requests
async function makeMediKanrenRequest<T>(params: Record<string, any>): Promise<T | null> {
    const url = `${MEDIKANREN_API_BASE}/query`;
    
    console.error(`MEDIK: Making request to: ${url}`);

    try {
        // Construct the URL with query parameters
        const queryParams = new URLSearchParams();
        for (const [key, value] of Object.entries(params)) {
            queryParams.append(key, value);
        }
        
        const fullUrl = `${url}?${queryParams.toString()}`;
        console.error(`MEDIK: Full URL: ${fullUrl}`);
        
        const response = await fetch(fullUrl, {
            method: 'GET'
        });
        
        if (!response.ok) {
            const text = await response.text();
            console.error(`MEDIK: Error response body: ${text}`);
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.error(`MEDIK: Response:`, JSON.stringify(data, null, 2));
        return data as T;
    } catch (error) {
        console.error(`MEDIK: Error in request:`, error);
        return null;
    }
}

// Function to run a query
export async function runQuery(params: {
    e1: string,
    e2: string,
    e3: string
}): Promise<QueryResponse | null> {
    server.sendLoggingMessage({
        level: "info",
        data: {
            message: "MEDIK: Starting runQuery",
            params: params
        },
    });
    
    return await makeMediKanrenRequest<QueryResponse>(params);
}

// Function to run both X->Known and Known->X queries
export async function runBidirectionalQuery(params: {
    curie: string
}): Promise<QueryResponse | null> {
    server.sendLoggingMessage({
        level: "info",
        data: {
            message: "MEDIK: Starting runBidirectionalQuery",
            params: params
        },
    });
    
    // Run X->Known query
    const xToKnownParams = {
        e1: "X->Known",
        e2: "biolink:related_to",
        e3: params.curie
    };
    
    console.error(`MEDIK: Running X->Known query with params:`, xToKnownParams);
    const xToKnownResults = await makeMediKanrenRequest<QueryResponse>(xToKnownParams);
    
    // Run Known->X query
    const knownToXParams = {
        e1: "Known->X",
        e2: "biolink:related_to",
        e3: params.curie
    };
    
    console.error(`MEDIK: Running Known->X query with params:`, knownToXParams);
    const knownToXResults = await makeMediKanrenRequest<QueryResponse>(knownToXParams);
    
    // Check for errors in either query
    if (!xToKnownResults || !knownToXResults) {
        console.error("MEDIK: One or both queries failed");
        return null;
    }
    
    // Check if either result is an error
    if (!Array.isArray(xToKnownResults) || !Array.isArray(knownToXResults)) {
        console.error("MEDIK: One or both queries returned an error");
        return Array.isArray(xToKnownResults) ? xToKnownResults : knownToXResults;
    }
    
    // Combine results
    const combinedResults = [...xToKnownResults];
    
    // Add results from Known->X query, avoiding duplicates
    // We'll consider a result duplicate if source, predicate, and target are the same
    knownToXResults.forEach(knownToXResult => {
        const [sourceId, sourceName, predicate, targetId, targetName] = knownToXResult;
        
        // Check if this relationship already exists in the combined results
        const isDuplicate = combinedResults.some(existingResult => {
            const [existingSourceId, , existingPredicate, existingTargetId] = existingResult;
            return (
                existingSourceId === sourceId &&
                existingPredicate === predicate &&
                existingTargetId === targetId
            );
        });
        
        // If not a duplicate, add to combined results
        if (!isDuplicate) {
            combinedResults.push(knownToXResult);
        }
    });
    
    console.error(`MEDIK: Combined ${xToKnownResults.length} X->Known results and ${knownToXResults.length} Known->X results into ${combinedResults.length} total results`);
    
    return combinedResults;
}

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
        tools: [
            {
                name: "run-query",
                description: "Run a 1-hop query in mediKanren",
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
                description: "Run both X->Known and Known->X queries with biolink:related_to to get all relationships for a CURIE",
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
            }
        ],
    };
});

// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request, extra) => {
    try {
        // Extract the actual tool name and arguments from the request
        const toolName = request.params.name;
        const toolArgs = request.params.arguments || {};

        if (DEBUG) {
            console.error('MEDIK: Tool request:', { toolName, toolArgs });
        }

        if (toolName === "run-query") {
            const { e1, e2, e3 } = QueryRequestSchema.parse(toolArgs);
            
            // Add a clear boundary marker for the start of a new query
            console.error("\n\n========================================");
            console.error(`MEDIK: NEW QUERY STARTED AT ${new Date().toISOString()}`);
            console.error(`MEDIK: Query: ${e1} ${e2} ${e3}`);
            console.error("========================================\n");
            
            if (DEBUG) {
                console.error('MEDIK: Parsed arguments:', { e1, e2, e3 });
            }
        
            const queryResult = await runQuery({ e1, e2, e3 });
        
            if (!queryResult) {
                console.error("========================================");
                console.error(`MEDIK: QUERY FAILED AT ${new Date().toISOString()}`);
                console.error("========================================\n");
                return {
                    content: [
                        {
                            type: "text",
                            text: "Failed to retrieve query results. Please check the server logs for details.",
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
                        message: "MEDIK: Filtering out nodes with CAID: prefix from query results",
                        originalResultCount: queryResult.length
                    },
                });
                
                console.error(`MEDIK: Starting CAID node filtering process on ${queryResult.length} results`);
                
                try {
                    console.error(`MEDIK: Calling formatKnowledgeGraphArtifact with ${queryResult.length} results`);
                    
                    // Format the query results into a knowledge graph artifact
                    const formattingPromise = formatKnowledgeGraphArtifact(queryResult, { e1, e2, e3 });
                    console.error(`MEDIK: Got Promise from formatKnowledgeGraphArtifact, waiting for resolution...`);
                    
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
                    console.error(`MEDIK: Error formatting results: ${error instanceof Error ? error.message : String(error)}`);
                    console.error(`MEDIK: Error stack trace: ${error instanceof Error ? error.stack : 'No stack trace available'}`);
                    console.error("========================================");
                    console.error(`MEDIK: QUERY ERROR AT ${new Date().toISOString()}: Error formatting results`);
                    console.error("========================================\n");
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
            const { curie } = GetEverythingRequestSchema.parse(toolArgs);
            
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
                
                console.error(`MEDIK: Starting CAID node filtering process on ${queryResult.length} results`);
                
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
                    }
                    
                    // Return the formatted result
                    return {
                        content: formattedResult.content,
                        artifacts: formattedResult.artifacts
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
    await server.connect(transport);
    console.error("mediKanren MCP Server running on stdio");
}

main().catch((error) => {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    console.error("Fatal error in main():", errorMessage);
    process.exit(1);
}); 