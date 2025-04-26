import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { randomUUID } from "crypto";
import { EventKitService } from "./services/eventkit-service.js";

// Tool definitions
const listCalendarsTool = {
    name: "list_calendars",
    description: "List all calendars visible via macOS EventKit",
    inputSchema: { type: "object" }
};

const listEventsTool = {
    name: "list_calendar_events",
    description: "Return upcoming events (next N days) across all calendars",
    inputSchema: {
        type: "object",
        properties: {
            days: {
                type: "integer",
                description: "Days ahead",
                default: 7
            }
        },
        required: []
    }
};

// Initialize services
const calendar = new EventKitService();

// Create MCP server
const server = new Server(
    {
        name: "cal2-mcp",
        version: "1.0.0",
    },
    {
        capabilities: {
            tools: {},
            logging: {}
        },
    }
);

// Flag to track server connection status
let serverConnected = false;

// Helper function for structured logging
function sendStructuredLog(server: Server, level: 'debug' | 'info' | 'notice' | 'warning' | 'error' | 'critical' | 'alert' | 'emergency', message: string, metadata?: Record<string, unknown>) {
    const timestamp = new Date().toISOString();
    const traceId = randomUUID().split('-')[0];
    
    // Always log to stderr for debugging
    console.error(`[cal2-mcp] [${level.toUpperCase()}] [${traceId}] ${message}`);
    if (metadata) {
        console.error(`[cal2-mcp] [${traceId}] Metadata:`, metadata);
    }
    
    // Only try to use MCP logging if server is connected
    if (serverConnected) {
        try {
            server.sendLoggingMessage({
                level,
                logger: 'cal2-mcp',
                data: {
                    message: `[cal2-mcp] [${level.toUpperCase()}] [${traceId}] ${message}`,
                    timestamp,
                    traceId,
                    ...metadata
                },
            });
        } catch (error) {
            console.error(`[cal2-mcp] Error sending log:`, error);
        }
    }
}

// Tool registration handler
server.setRequestHandler(ListToolsRequestSchema, async () => {
    sendStructuredLog(server, 'info', 'Listing available tools');
    return {
        tools: [listCalendarsTool, listEventsTool],
    };
});

// Tool execution handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const traceId = randomUUID().split('-')[0];
    try {
        const toolName = request.params.name;
        const toolArgs = request.params.arguments || {};

        sendStructuredLog(server, 'info', `Tool execution requested: ${toolName}`, {
            traceId,
            toolName,
            arguments: toolArgs
        });

        if (toolName === "list_calendars") {
            try {
                sendStructuredLog(server, 'info', `Retrieving calendars`, { traceId });
                const cals = await calendar.listCalendars();
                sendStructuredLog(server, 'info', `Found ${cals.length} calendars`, { traceId });
                
                return {
                    content: [{ 
                        type: "text", 
                        text: `${cals.length} calendars found`, 
                        forModel: true 
                    }],
                    artifacts: [{
                        type: "json",
                        id: randomUUID(),
                        title: "Calendars",
                        content: JSON.stringify(cals, null, 2)
                    }]
                };
            } catch (error) {
                sendStructuredLog(server, 'error', `Failed to retrieve calendars`, {
                    traceId,
                    error: error instanceof Error ? error.message : String(error),
                    stack: error instanceof Error ? error.stack : undefined
                });
                
                return {
                    content: [{ 
                        type: "text", 
                        text: `Error retrieving calendars: ${error instanceof Error ? error.message : String(error)}`, 
                        forModel: true 
                    }],
                    isError: true
                };
            }
        } 
        
        if (toolName === "list_calendar_events") {
            try {
                const { days = 7 } = toolArgs as { days?: number };
                sendStructuredLog(server, 'info', `Retrieving events for next ${days} days`, { traceId, days });
                const evts = await calendar.listEvents({ days });
                sendStructuredLog(server, 'info', `Found ${evts.length} events`, { traceId });
                
                return {
                    content: [{ 
                        type: "text", 
                        text: `${evts.length} events found for the next ${days} days`, 
                        forModel: true 
                    }],
                    artifacts: [{
                        type: "json",
                        id: randomUUID(),
                        title: "Events",
                        content: JSON.stringify(evts, null, 2)
                    }]
                };
            } catch (error) {
                sendStructuredLog(server, 'error', `Failed to retrieve events`, {
                    traceId,
                    error: error instanceof Error ? error.message : String(error),
                    stack: error instanceof Error ? error.stack : undefined
                });
                
                return {
                    content: [{ 
                        type: "text", 
                        text: `Error retrieving events: ${error instanceof Error ? error.message : String(error)}`, 
                        forModel: true 
                    }],
                    isError: true
                };
            }
        }

        sendStructuredLog(server, 'warning', `Unknown tool requested: ${toolName}`, { traceId });
        return {
            content: [{
                type: "text",
                text: `Tool ${toolName} not found`
            }],
            isError: true
        };

    } catch (error) {
        sendStructuredLog(server, 'error', 'Error in tool execution', {
            traceId,
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined
        });
        
        return {
            content: [{
                type: "text",
                text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
            }],
            isError: true
        };
    }
});

// Server startup
async function main() {
    const transport = new StdioServerTransport();
    
    try {
        // Use console.error for logging before server is connected
        console.error('[cal2-mcp] Initializing calendar service');
        await calendar.initialize();
        
        console.error('[cal2-mcp] Connecting to transport');
        await server.connect(transport);
        
        // Now the server is connected, we can use MCP logging
        serverConnected = true;
        
        sendStructuredLog(server, 'info', 'Server started', {
            transport: 'stdio',
            timestamp: new Date().toISOString()
        });
        
        const diagnosticId = randomUUID().slice(0, 8);
        console.error(`[cal2-mcp] Server initialization complete - ${diagnosticId}`);
        
    } catch (error) {
        console.error('[cal2-mcp] Fatal error during server initialization', {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined
        });
        throw error;
    }
}

main().catch((error) => {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    console.error('[cal2-mcp] Fatal error in main():', errorMessage);
    process.exit(1);
}); 