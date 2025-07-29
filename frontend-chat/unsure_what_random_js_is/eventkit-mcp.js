#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { randomUUID } from "crypto";
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Helper binary path
const helperPath = join(__dirname, 'bin/CalendarHelper/CalendarHelper');

console.log('=== EventKit Calendar MCP Server ===');
console.log(`Current directory: ${__dirname}`);
console.log(`Helper path: ${helperPath}`);
console.log(`Helper exists: ${existsSync(helperPath) ? 'Yes' : 'No'}`);

if (!existsSync(helperPath)) {
  console.error('ERROR: Helper binary not found! Make sure you built it correctly.');
  process.exit(1);
}

// Initialize the MCP server
const server = new Server(
    { name: "eventkit-mcp", version: "1.0.0" },
    { capabilities: { tools: {}, logging: {} } }
);

// Define calendar tools
const listCalendarsTool = {
  name: "list_calendars",
  description: "Lists all available calendars from macOS Calendar.app",
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

// Helper function to run the Calendar Helper binary
function runCalendarHelper(args) {
  return new Promise((resolve, reject) => {
    console.log(`Running helper with args: ${args.join(' ')}`);
    const helperProcess = spawn(helperPath, args, { stdio: ['inherit', 'pipe', 'pipe'] });
    
    let stdout = '';
    let stderr = '';
    
    helperProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    helperProcess.stderr.on('data', (data) => {
      stderr += data.toString();
      console.error('Helper error:', stderr);
    });
    
    helperProcess.on('close', (code) => {
      console.log(`Helper process exited with code ${code}`);
      
      if (code === 0) {
        try {
          const result = JSON.parse(stdout);
          resolve(result);
        } catch (error) {
          console.error('Failed to parse helper output:', error);
          console.log('Raw output:', stdout);
          reject(new Error('Failed to parse helper output'));
        }
      } else {
        reject(new Error(`Helper failed with code ${code}: ${stderr}`));
      }
    });
  });
}

// Log helper function
function sendLog(level, message, metadata = {}) {
    const traceId = randomUUID().substring(0, 8);
    
    try {
        server.sendLoggingMessage({
            level,
            logger: 'eventkit-mcp',
            data: {
                message: `[eventkit-mcp] [${level.toUpperCase()}] [${traceId}] ${message}`,
                timestamp: new Date().toISOString(),
                traceId,
                ...metadata
            },
        });
    } catch (error) {
        console.error(`[eventkit-mcp] Error sending log:`, error);
        console.error(`[eventkit-mcp] [${level.toUpperCase()}] [${traceId}] ${message}`);
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
      const calendars = await runCalendarHelper(['list-calendars']);
      
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
      // Calculate days for the helper
      const start = new Date();
      const end = toolArgs.end ? new Date(toolArgs.end) : new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
      const days = Math.ceil((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
      
      // Run the helper
      const events = await runCalendarHelper(['list-events', String(days)]);
      
      // Filter if needed
      let filteredEvents = events;
      if (toolArgs.calendarId) {
        filteredEvents = filteredEvents.filter(event => event.calendar_id === toolArgs.calendarId);
      }
      if (toolArgs.query) {
        const query = toolArgs.query.toLowerCase();
        filteredEvents = filteredEvents.filter(event => 
          event.title.toLowerCase().includes(query));
      }
      
      return {
        content: [{
          type: "text",
          text: `Found ${filteredEvents.length} events`,
          forModel: true
        }],
        artifacts: [{
          type: "json",
          id: randomUUID(),
          title: "Calendar Events",
          content: JSON.stringify(filteredEvents, null, 2)
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
        // Test the helper once to make sure it's working
        console.log('Testing calendar access...');
        try {
          const calendars = await runCalendarHelper(['list-calendars']);
          console.log(`Successfully loaded ${calendars.length} calendars`);
        } catch (error) {
          console.error('Failed to access calendars:', error);
        }
        
        // Connect to MCP transport
        await server.connect(transport);
        
        sendLog('info', 'EventKit MCP Server started', {
            transport: 'stdio',
            timestamp: new Date().toISOString()
        });
        
        const diagnosticId = randomUUID().slice(0, 8);
        console.error(`[eventkit-mcp] Server initialization complete - ${diagnosticId}`);
        
    } catch (error) {
        console.error('[eventkit-mcp] Fatal error during server initialization', {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined
        });
        throw error;
    }
}

main().catch((error) => {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    console.error('[eventkit-mcp] Fatal error in main():', errorMessage);
    process.exit(1);
}); 