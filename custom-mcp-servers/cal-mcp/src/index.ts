import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { randomUUID } from "crypto";
import { CalendarService } from "./services/calendar-service.js";
import { getCalendarConfig, validateConfig } from "./config.js";

// Initialize the MCP server
const server = new Server(
    { name: "cal-mcp", version: "1.0.0" },
    { capabilities: { tools: {}, logging: {} } }
);

// Initialize calendar service
const calendarService = new CalendarService();

// Define calendar tools
const listCalendarsTool = {
  name: "list_calendars",
  description: "Lists all available calendars from the CalDAV server",
  inputSchema: {
    type: "object",
    properties: {},
    required: []
  }
};

const getEventsTool = {
  name: "get_calendar_events",
  description: "Gets events from a specified calendar within a date range",
  inputSchema: {
    type: "object",
    properties: {
      calendarId: {
        type: "string",
        description: "Optional ID of the calendar to get events from"
      },
      start: {
        type: "string",
        description: "Start date in ISO format (defaults to today)"
      },
      end: {
        type: "string",
        description: "End date in ISO format (defaults to 7 days from start)"
      },
      query: {
        type: "string",
        description: "Optional search query to filter events"
      }
    }
  }
};

// Log helper function
function sendLog(level: 'debug' | 'info' | 'notice' | 'warning' | 'error', message: string, metadata?: Record<string, unknown>) {
    const traceId = randomUUID().substring(0, 8);
    
    try {
        server.sendLoggingMessage({
            level,
            logger: 'cal-mcp',
            data: {
                message: `[cal-mcp] [${level.toUpperCase()}] [${traceId}] ${message}`,
                timestamp: new Date().toISOString(),
                traceId,
                ...metadata
            },
        });
    } catch (error) {
        console.error(`[cal-mcp] Error sending log:`, error);
        console.error(`[cal-mcp] [${level.toUpperCase()}] [${traceId}] ${message}`);
    }
}

// Register tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  sendLog('debug', 'Listing available tools');
  return {
    tools: [listCalendarsTool, getEventsTool],
  };
});

// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    const toolName = request.params.name;
    const toolArgs = request.params.arguments || {};
    
    sendLog('debug', `Tool execution requested: ${toolName}`, { args: toolArgs });
    
    if (toolName === "list_calendars") {
      const calendars = await calendarService.getCalendars();
      
      return {
        content: [{
          type: "text",
          text: `Found ${calendars.length} calendars`,
          forModel: true
        }],
        artifacts: [{
          type: "json",
          id: randomUUID(),
          title: "Calendars",
          content: JSON.stringify(calendars, null, 2)
        }]
      };
    }
    
    if (toolName === "get_calendar_events") {
      const events = await calendarService.getEvents(toolArgs);
      
      return {
        content: [{
          type: "text",
          text: `Found ${events.length} events`,
          forModel: true
        }],
        artifacts: [{
          type: "json",
          id: randomUUID(),
          title: "Calendar Events",
          content: JSON.stringify(events, null, 2)
        }]
      };
    }
    
    return {
      content: [{
        type: "text",
        text: `Tool ${toolName} not found`
      }],
      isError: true
    };
    
  } catch (error) {
    sendLog('error', 'Error in tool execution', {
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

// Define server startup
async function main() {
    const transport = new StdioServerTransport();
    
    try {
        // Connect to MCP transport
        await server.connect(transport);
        
        // Validate configuration before initializing
        const config = getCalendarConfig();
        validateConfig(config);
        
        // Initialize calendar service
        await calendarService.initialize();
        
        sendLog('info', 'CalDAV MCP Server started', {
            transport: 'stdio',
            timestamp: new Date().toISOString()
        });
        
        const diagnosticId = randomUUID().slice(0, 8);
        console.error(`[cal-mcp] Server initialization complete - ${diagnosticId}`);
        
    } catch (error) {
        console.error('[cal-mcp] Fatal error during server initialization', {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined
        });
        throw error;
    }
}

main().catch((error) => {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    console.error('[cal-mcp] Fatal error in main():', errorMessage);
    process.exit(1);
}); 