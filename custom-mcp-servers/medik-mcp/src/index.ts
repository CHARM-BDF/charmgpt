import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { createInterface } from 'readline';
import { formatKnowledgeGraphArtifact } from "./formatters.js";
import { randomUUID } from 'crypto';

// Define log levels type
type LogLevel = 'debug' | 'info' | 'notice' | 'warning' | 'error' | 'critical' | 'alert' | 'emergency';

// Helper function for structured logging
function sendStructuredLog(server: Server, level: LogLevel, message: string, metadata?: Record<string, unknown>) {
    console.error(`[medik-mcp] [MEDIK-STEP 0] PREPARING TO SEND LOG: ${message}`);
    const timestamp = new Date().toISOString();
    const traceId = randomUUID().split('-')[0]; // Use imported randomUUID
    
    // Format the message
    const formattedMessage = `[medik-mcp] [${level.toUpperCase()}] [${traceId}] ${message}`;
    
    try {
        // Check if server is initialized
        console.error(`[medik-mcp] [MEDIK-STEP 0] Server object type: ${typeof server}`);
        console.error(`[medik-mcp] [MEDIK-STEP 0] Has sendLoggingMessage: ${typeof server.sendLoggingMessage === 'function'}`);
        
        // Create log payload
        const logPayload = {
            level,
            logger: 'medik-mcp',
            data: {
                message: formattedMessage,
                timestamp: timestamp,
                traceId: traceId,
                level: level,
                method: "logging/message", // Explicitly include the expected method name
                ...metadata
            },
        };
        
        console.error(`[medik-mcp] [MEDIK-STEP 0] About to call server.sendLoggingMessage with payload: ${JSON.stringify(logPayload)}`);
        
        // Send through MCP logging system
        server.sendLoggingMessage(logPayload);
        
        console.error(`[medik-mcp] [MEDIK-STEP 0] ✅ server.sendLoggingMessage completed without errors`);
        
        // Also log to console for debugging
        if (DEBUG) {
            console.error(`[medik-mcp] [MEDIK-DEBUG] Successfully sent log message through MCP`);
            console.error(formattedMessage);
            if (metadata && Object.keys(metadata).length > 0) {
                console.error(`[medik-mcp] [${traceId}] Metadata:`, metadata);
            }
        }
    } catch (error) {
        // Log the error to console since MCP logging failed
        console.error(`[medik-mcp] [MEDIK-STEP 0] ❌ ERROR SENDING LOG:`, {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
            level,
            message,
            metadata
        });

        // Fall back to console.error
        console.error(formattedMessage);
        if (metadata && Object.keys(metadata).length > 0) {
            console.error(`[medik-mcp] [${traceId}] Metadata:`, metadata);
        }
    }
}

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

// Debug helper for direct console output
function debugLog(message: string, data?: any) {
    if (DEBUG) {
        console.error(`[medik-mcp] [MEDIK-DEBUG] ${message}`, data ? data : '');
    }
}

// Helper function for API requests
async function makeMediKanrenRequest<T>(params: Record<string, any>, retryCount = 0): Promise<T | null> {
    const MAX_RETRIES = 3;
    const RETRY_DELAY_MS = 1000; // 1 second between retries
    
    sendStructuredLog(server, 'info', `Starting makeMediKanrenRequest (attempt ${retryCount + 1}/${MAX_RETRIES + 1})`, {
        params,
        retryCount,
        maxRetries: MAX_RETRIES
    });
    
    // Add a 1 second pause before making the request
    sendStructuredLog(server, 'debug', 'Adding 1 second pause before making request to mediKanren');
    await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
    
    const url = `${MEDIKANREN_API_BASE}/query`;
    
    sendStructuredLog(server, 'debug', `Making request to: ${url}`);

    try {
        // Construct the URL with query parameters
        const queryParams = new URLSearchParams();
        for (const [key, value] of Object.entries(params)) {
            queryParams.append(key, value);
        }
        
        const fullUrl = `${url}?${queryParams.toString()}`;
        sendStructuredLog(server, 'debug', `Full URL: ${fullUrl}`);
        
        const response = await fetch(fullUrl, {
            method: 'GET'
        });
        
        if (!response.ok) {
            const text = await response.text();
            sendStructuredLog(server, 'error', `HTTP error response`, {
                status: response.status,
                responseText: text
            });
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        return data as T;
    } catch (error) {
        sendStructuredLog(server, 'error', `Error in request`, {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined
        });
        
        // If we haven't exceeded max retries, try again
        if (retryCount < MAX_RETRIES) {
            sendStructuredLog(server, 'notice', `Retrying request`, {
                attempt: retryCount + 2,
                maxAttempts: MAX_RETRIES + 1
            });
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
    
    // Log query start
    console.error(`[medik-mcp] MEDIK: NEW QUERY STARTED AT ${new Date().toISOString()}`);
    console.error(`[medik-mcp] MEDIK: Query: ${e1} ${e2} ${e3}`);
    
    try {
        // Make the API request
        const queryResult = await makeMediKanrenRequest<QueryResponse>({
            e1, e2, e3
        });
        
        if (!queryResult) {
            console.error(`[medik-mcp] MEDIK: QUERY FAILED AT ${new Date().toISOString()}`);
            return null;
        }
        
        return queryResult;
    } catch (error) {
        console.error(`[medik-mcp] MEDIK: Query error:`, error);
        return null;
    }
}

// Function to run both X->Known and Known->X queries
export async function runBidirectionalQuery(params: {
    curie: string
}): Promise<QueryResponse | null> {
    const { curie } = params;
    
    // Log query start with structured logging
    sendStructuredLog(server, 'info', `Starting bidirectional query for ${curie}`, {
        curie,
        queryType: 'bidirectional',
        timestamp: new Date().toISOString()
    });
    
    try {
        // Make the API request
        const queryResult = await makeMediKanrenRequest<QueryResponse>({
            curie
        });
        
        if (!queryResult) {
            // Log query failure with structured logging
            sendStructuredLog(server, 'error', `Bidirectional query failed for ${curie}`, {
                curie,
                queryType: 'bidirectional',
                error: 'No result returned from API',
                timestamp: new Date().toISOString()
            });
            
            console.error(`MEDIK: BIDIRECTIONAL QUERY FAILED AT ${new Date().toISOString()}`);
            return null;
        }
        
        return queryResult;
    } catch (error) {
        // Log error with structured logging
        sendStructuredLog(server, 'error', `Error in bidirectional query for ${curie}`, {
            curie,
            queryType: 'bidirectional',
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
            timestamp: new Date().toISOString()
        });
        
        console.error(`MEDIK: Query error:`, error);
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
    console.error('[medik-mcp] [MEDIK-INIT] Starting MCP server initialization');
    const transport = new StdioServerTransport();
    console.error('[medik-mcp] [MEDIK-INIT] Created StdioServerTransport');
    
    try {
        console.error('[medik-mcp] [MEDIK-INIT] Connecting server to transport');
        await server.connect(transport);
        console.error('[medik-mcp] [MEDIK-INIT] Server connected successfully');
        
        // Check server capabilities
        console.error('[medik-mcp] [MEDIK-INIT] Checking server capabilities');
        console.error(`[medik-mcp] [MEDIK-INIT] Server object: ${typeof server}`);
        console.error(`[medik-mcp] [MEDIK-INIT] sendLoggingMessage method available: ${typeof server.sendLoggingMessage === 'function'}`);
        
        // Basic server start log
        sendStructuredLog(server, 'info', 'Server started', {
            transport: 'stdio',
            timestamp: new Date().toISOString()
        });
        
        // Add a small delay to ensure connection is fully established
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Send special diagnostic logs to test notification pathway
        console.error('\n[medik-mcp] [DIAGNOSTIC] Starting diagnostic notification tests');
        
        // Use a unique ID for this diagnostic test session
        const diagnosticId = randomUUID().slice(0, 8);
        
        try {
            console.error(`[medik-mcp] [DIAGNOSTIC:${diagnosticId}] Sending diagnostic logs`);
            
            // First, using the structured log function
            console.error(`[medik-mcp] [DIAGNOSTIC:${diagnosticId}] Test 1: Regular log via sendStructuredLog`);
            sendStructuredLog(server, 'info', `DIAGNOSTIC TEST #1: Regular structured log ${diagnosticId}`, {
                diagnosticId,
                testType: 'regular',
                diagnosticTimestamp: new Date().toISOString()
            });
            
            // Wait briefly
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Second, using the direct method
            console.error(`[medik-mcp] [DIAGNOSTIC:${diagnosticId}] Test 2: Direct server.sendLoggingMessage call`);
            server.sendLoggingMessage({
                level: 'info',
                logger: 'medik-mcp-DIAGNOSTIC',
                data: {
                    message: `[medik-mcp] [DIAGNOSTIC:${diagnosticId}] Test 2: Direct logging message`,
                    timestamp: new Date().toISOString(),
                    diagnosticId: diagnosticId,
                    method: "logging/message"
                }
            });
            
            console.error(`[medik-mcp] [DIAGNOSTIC:${diagnosticId}] Diagnostic tests complete`);
        } catch (error) {
            console.error(`[medik-mcp] [DIAGNOSTIC:${diagnosticId}] Error during diagnostic tests:`, {
                error: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined
            });
        }
        
        // Send test logs at different levels
        try {
            console.error('[medik-mcp] [MEDIK-INIT] Sending test logs at different levels');
            
            // Send a log at each level
            const levels: LogLevel[] = ['debug', 'info', 'notice', 'warning', 'error'];
            for (const level of levels) {
                console.error(`[medik-mcp] [MEDIK-INIT] Sending test ${level} message`);
                sendStructuredLog(server, level, `Test message for ${level} level`, {
                    testId: randomUUID().slice(0, 8),
                    testLevel: level
                });
                
                // Small delay between logs
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            
            console.error('[medik-mcp] [MEDIK-INIT] All test log messages sent');
        } catch (error) {
            console.error('[medik-mcp] [MEDIK-INIT] Error sending test logs', {
                error: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined
            });
            
            // Try direct server logging
            try {
                console.error('[medik-mcp] [MEDIK-INIT] Attempting direct server.sendLoggingMessage');
                server.sendLoggingMessage({
                    level: 'error',
                    logger: 'medik-mcp',
                    data: {
                        message: `[medik-mcp] [MEDIK-ERROR] ${error instanceof Error ? error.message : String(error)}`,
                        timestamp: new Date().toISOString(),
                        stack: error instanceof Error ? error.stack : undefined,
                        method: "logging/message"
                    }
                });
                console.error('[medik-mcp] [MEDIK-INIT] Direct logging message sent');
            } catch (directError) {
                console.error('[medik-mcp] [MEDIK-INIT] Error with direct server logging:', {
                    error: directError instanceof Error ? directError.message : String(directError),
                    stack: directError instanceof Error ? directError.stack : undefined
                });
            }
            
            // Log the error using our server
            try {
                console.error('[medik-mcp] [MEDIK-INIT] Using server.sendLoggingMessage for error');
                server.sendLoggingMessage({
                    level: 'error',
                    logger: 'medik-mcp',
                    data: {
                        message: `[medik-mcp] [MEDIK-ERROR] ${error instanceof Error ? error.message : String(error)}`,
                        timestamp: new Date().toISOString(),
                        stack: error instanceof Error ? error.stack : undefined,
                        method: "logging/message"
                    }
                });
            } catch (logError) {
                console.error('[medik-mcp] [MEDIK-ERROR] Failed to log error through server', {
                    originalError: error instanceof Error ? error.message : String(error),
                    logError: logError instanceof Error ? logError.message : String(logError)
                });
            }
        }
        
        // Add diagnostic testing for the logging system
        try {
            console.error(`[medik-mcp] [MEDIK-INIT] Starting server diagnostic - ${diagnosticId}`);
            console.error(`[medik-mcp] [MEDIK-INIT] Server object available: ${!!server}`);
            console.error(`[medik-mcp] [MEDIK-INIT] sendLoggingMessage method available: ${typeof server.sendLoggingMessage === 'function'}`);
            
            // Run diagnostic tests for logging
            // ... existing code ...
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