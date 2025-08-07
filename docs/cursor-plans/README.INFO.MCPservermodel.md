# MCP Server Implementation Guide

This guide outlines how to create a new Model Context Protocol (MCP) server for the charm-mcp system. It's based on the successful conversion of the aims-review service from an Express HTTP server to an MCP server.

## Core Components

### 1. Required Dependencies
```typescript
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
```

### 2. Server Setup
```typescript
const server = new Server(
    {
        name: "your-mcp-name",
        version: "1.0.0",
    },
    {
        capabilities: {
            tools: {},
            logging: {}
        },
    }
);
```

### 3. Tool Definition
```typescript
const exampleTool = {
    name: "your-tool-name",
    description: "Description of what your tool does",
    inputSchema: {
        type: "object",
        properties: {
            param1: {
                type: "string",
                description: "Description of parameter 1"
            },
            // ... more parameters
        },
        required: ["param1"]
    }
};
```

### 4. Tool Registration
```typescript
server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
        tools: [exampleTool],
    };
});
```

### 5. Tool Execution Handler
```typescript
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    try {
        const toolName = request.params.name;
        const toolArgs = request.params.arguments || {};

        if (toolName !== "your-tool-name") {
            return {
                content: [{
                    type: "text",
                    text: `Tool ${toolName} not found`
                }],
                isError: true
            };
        }

        // Your tool logic here
        const result = await processToolRequest(toolArgs);

        return {
            content: [{
                type: "text",
                text: "Operation completed successfully",
                forModel: true
            }],
            artifacts: [result]
        };

    } catch (error) {
        console.error('Error in tool execution:', error);
        return {
            content: [{
                type: "text",
                text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
            }],
            isError: true
        };
    }
});
```

### 6. Logging Helper
```typescript
function sendStructuredLog(server: Server, level: 'debug' | 'info' | 'notice' | 'warning' | 'error' | 'critical' | 'alert' | 'emergency', message: string, metadata?: Record<string, unknown>) {
    const timestamp = new Date().toISOString();
    const traceId = crypto.randomUUID().split('-')[0];
    
    try {
        server.sendLoggingMessage({
            level,
            logger: 'your-mcp-name',
            data: {
                message: `[your-mcp-name] [${level.toUpperCase()}] [${traceId}] ${message}`,
                timestamp,
                traceId,
                ...metadata
            },
        });
    } catch (error) {
        console.error(`[your-mcp-name] Error sending log:`, error);
        console.error(`[your-mcp-name] [${level.toUpperCase()}] [${traceId}] ${message}`);
        if (metadata) {
            console.error(`[your-mcp-name] [${traceId}] Metadata:`, metadata);
        }
    }
}
```

### 7. Server Startup
```typescript
async function main() {
    const transport = new StdioServerTransport();
    
    try {
        await server.connect(transport);
        
        sendStructuredLog(server, 'info', 'Server started', {
            transport: 'stdio',
            timestamp: new Date().toISOString()
        });
        
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const diagnosticId = crypto.randomUUID().slice(0, 8);
        console.error(`[your-mcp-name] Server initialization complete - ${diagnosticId}`);
        
    } catch (error) {
        console.error('[your-mcp-name] Fatal error during server initialization', {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined
        });
        throw error;
    }
}

main().catch((error) => {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    console.error('[your-mcp-name] Fatal error in main():', errorMessage);
    process.exit(1);
});
```

## Key Points

1. **Communication Protocol**
   - Uses stdio transport instead of HTTP
   - Follows the Model Context Protocol for tool registration and execution
   - Handles bidirectional communication through the MCP server

2. **Tool Structure**
   - Each tool must have a unique name
   - Input schema must be properly defined
   - Tool execution should return content and optional artifacts
   - Error handling should be comprehensive

3. **Logging**
   - Use structured logging through the MCP server
   - Include trace IDs for debugging
   - Log both successes and failures
   - Include relevant metadata

4. **Error Handling**
   - Catch and properly format all errors
   - Include stack traces when available
   - Return user-friendly error messages
   - Log detailed error information

5. **Response Format**
```typescript
{
    content: [{
        type: "text",
        text: string,
        forModel?: boolean
    }],
    artifacts?: [{
        type: string,
        id: string,
        title: string,
        content: string,
        metadata?: Record<string, unknown>
    }],
    isError?: boolean
}
```

## Required Files

1. **package.json**
   - Include MCP SDK dependencies
   - Define build and start scripts
   - Specify TypeScript configuration

2. **tsconfig.json**
   - Configure TypeScript compilation
   - Set appropriate module settings
   - Define output directory

3. **index.ts**
   - Main server implementation
   - Tool definitions and handlers
   - Server initialization

## Building and Running

1. Build the TypeScript code:
```bash
npm run build
```

2. Start the server:
```bash
npm start
```

The server will start using stdio transport and register with the main MCP system.

## Best Practices

1. **Initialization**
   - Always initialize environment variables first
   - Validate required configuration
   - Use proper error handling during startup

2. **Tool Implementation**
   - Keep tools focused and single-purpose
   - Validate all input parameters
   - Return clear success/error messages
   - Include helpful artifacts when appropriate

3. **Error Handling**
   - Use try-catch blocks around async operations
   - Provide detailed error messages
   - Log errors with appropriate context
   - Handle both expected and unexpected errors

4. **Logging**
   - Use appropriate log levels
   - Include relevant context in logs
   - Add trace IDs for debugging
   - Log both success and failure paths

5. **Response Format**
   - Follow the MCP response structure
   - Include appropriate content types
   - Add helpful metadata
   - Use clear status indicators 