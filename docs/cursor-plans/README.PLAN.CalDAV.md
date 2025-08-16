# CalDAV-based Calendar MCP Server Implementation Plan

This document outlines a comprehensive plan for implementing a Calendar MCP server using the CalDAV protocol. This approach will provide access to Apple Calendar, Google Calendar, and other calendar systems through a standardized protocol, avoiding the permission issues encountered with the direct EventKit implementation.

## Phase 1: Project Setup & Dependencies

### 1.1 Create Project Structure
```bash
mkdir -p custom-mcp-servers/caldav-mcp
cd custom-mcp-servers/caldav-mcp
npm init -y
```

### 1.2 Install Dependencies
```bash
npm install --save @modelcontextprotocol/sdk tsdav ical.js luxon dotenv
npm install --save-dev typescript ts-node @types/node esbuild
```

### 1.3 Configure TypeScript
Create `tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "esModuleInterop": true,
    "outDir": "dist",
    "strict": true,
    "sourceMap": true,
    "declaration": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### 1.4 Create Build Scripts
Update `package.json`:
```json
{
  "scripts": {
    "build": "esbuild src/index.ts --bundle --platform=node --outdir=dist --external:@modelcontextprotocol/sdk",
    "dev": "ts-node src/index.ts",
    "start": "node dist/index.js"
  },
  "type": "module"
}
```

## Phase 2: MCP Server Implementation

### 2.1 Create iCal Parser Utility
Create `src/utils/ical-parser.ts`:
```typescript
import ICAL from 'ical.js';

export function parseICS(icsData: string) {
  const jcalData = ICAL.parse(icsData);
  const comp = new ICAL.Component(jcalData);
  const vevent = comp.getFirstSubcomponent('vevent');
  
  if (!vevent) {
    return null;
  }
  
  const event = new ICAL.Event(vevent);
  
  return {
    id: event.uid,
    title: event.summary,
    description: event.description,
    location: event.location,
    start: event.startDate.toJSDate().toISOString(),
    end: event.endDate.toJSDate().toISOString(),
    allDay: event.startDate.isDate,
    recurrence: event.recurrenceId ? event.recurrenceId.toString() : null,
    organizer: event.organizer ? event.organizer.toString() : null,
    attendees: event.attendees ? event.attendees.map(attendee => attendee.toString()) : []
  };
}
```

### 2.2 Create Configuration
Create `src/config.ts`:
```typescript
import dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { join } from 'path';

// Load environment variables
dotenv.config();

// Check for user config file
let userConfig = {};
try {
    const configPath = process.env.CALENDAR_CONFIG_PATH || join(process.cwd(), 'config.json');
    const configData = readFileSync(configPath, 'utf8');
    userConfig = JSON.parse(configData);
} catch (error) {
    console.warn('No config.json found, using environment variables');
}

export interface CalendarConfig {
    serverUrl: string;
    username: string;
    password: string;
    defaultCalendar?: string;
}

export function getCalendarConfig(): CalendarConfig {
    // Environment variables take precedence over config file
    return {
        serverUrl: process.env.CALDAV_SERVER_URL || (userConfig as any).serverUrl || 'https://caldav.icloud.com/',
        username: process.env.CALDAV_USERNAME || (userConfig as any).username,
        password: process.env.CALDAV_PASSWORD || (userConfig as any).password,
        defaultCalendar: process.env.CALDAV_DEFAULT_CALENDAR || (userConfig as any).defaultCalendar
    };
}

export function validateConfig(config: CalendarConfig): void {
    if (!config.serverUrl) {
        throw new Error('Missing CALDAV_SERVER_URL');
    }
    if (!config.username) {
        throw new Error('Missing CALDAV_USERNAME');
    }
    if (!config.password) {
        throw new Error('Missing CALDAV_PASSWORD');
    }
}
```

### 2.3 Create Calendar Service
Create `src/services/calendar-service.ts`:
```typescript
import { createClient, DAVClient } from 'tsdav';
import { DateTime } from 'luxon';
import { parseICS } from '../utils/ical-parser.js';
import { getCalendarConfig } from '../config.js';

export class CalendarService {
    private client: DAVClient | null = null;
    private initialized = false;
    
    async initialize(): Promise<void> {
        try {
            const config = getCalendarConfig();
            this.client = await createClient({
                serverUrl: config.serverUrl,
                credentials: {
                    username: config.username,
                    password: config.password
                },
                defaultCalendarName: config.defaultCalendar
            });
            this.initialized = true;
            console.log('[CalendarService] Successfully connected to CalDAV server');
        } catch (error) {
            console.error('[CalendarService] Failed to initialize', error);
            throw error;
        }
    }
    
    async getCalendars() {
        this.ensureInitialized();
        const calendars = await this.client!.fetchCalendars();
        return calendars.map(cal => ({
            id: cal.url,
            name: cal.displayName || 'Unnamed Calendar',
            description: cal.description || '',
            color: cal.calendarColor || '#cccccc'
        }));
    }
    
    async getEvents(params: {
        calendarId?: string;
        start?: string;
        end?: string;
        query?: string;
    }) {
        this.ensureInitialized();
        
        // Process parameters
        const startDate = params.start ? new Date(params.start) : new Date();
        const endDate = params.end ? new Date(params.end) : DateTime.fromJSDate(startDate).plus({ days: 7 }).toJSDate();
        
        // Get calendar
        let calendar = undefined;
        if (params.calendarId) {
            const calendars = await this.client!.fetchCalendars();
            calendar = calendars.find(cal => cal.url === params.calendarId);
        }
        
        // Fetch events
        const events = await this.client!.fetchVEvents({
            calendar,
            timeRange: {
                start: startDate,
                end: endDate
            }
        });
        
        // Process events
        return events.map(event => parseICS(event)).filter(event => {
            // Filter by search query if provided
            if (params.query) {
                const query = params.query.toLowerCase();
                return (
                    event.title.toLowerCase().includes(query) ||
                    (event.description || '').toLowerCase().includes(query) ||
                    (event.location || '').toLowerCase().includes(query)
                );
            }
            return true;
        });
    }
    
    private ensureInitialized() {
        if (!this.initialized || !this.client) {
            throw new Error('Calendar service not initialized');
        }
    }
}
```

### 2.4 Create Main Server File
Create `src/index.ts`:
```typescript
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
    { name: "caldav-mcp", version: "1.0.0" },
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
            logger: 'caldav-mcp',
            data: {
                message: `[caldav-mcp] [${level.toUpperCase()}] [${traceId}] ${message}`,
                timestamp: new Date().toISOString(),
                traceId,
                ...metadata
            },
        });
    } catch (error) {
        console.error(`[caldav-mcp] Error sending log:`, error);
        console.error(`[caldav-mcp] [${level.toUpperCase()}] [${traceId}] ${message}`);
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
        console.error(`[caldav-mcp] Server initialization complete - ${diagnosticId}`);
        
    } catch (error) {
        console.error('[caldav-mcp] Fatal error during server initialization', {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined
        });
        throw error;
    }
}

main().catch((error) => {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    console.error('[caldav-mcp] Fatal error in main():', errorMessage);
    process.exit(1);
});
```

## Phase 3: Testing and Deployment

### 3.1 Create Sample Config File
Create `config.json.example`:
```json
{
  "serverUrl": "https://caldav.example.com/",
  "username": "your-username",
  "password": "your-password",
  "defaultCalendar": "My Calendar"
}
```

### 3.2 Create Environment File Template
Create `.env.example`:
```
CALDAV_SERVER_URL=https://caldav.example.com/
CALDAV_USERNAME=your-username
CALDAV_PASSWORD=your-password
CALDAV_DEFAULT_CALENDAR=My Calendar
```

### 3.3 Testing Instructions
1. Copy `.env.example` to `.env` and fill in your credentials
2. Build the project with `npm run build`
3. Run the server with `npm start`
4. Verify tool registration and execution via MCP client

### 3.4 Integration with MCP Client
1. Register the CalDAV MCP server with the main MCP client
2. Test tool execution through the MCP client interface
3. Verify calendar events are correctly retrieved and formatted 