# MCP Server Implementation Guide

## Overview
This document outlines how to implement the Model Context Protocol (MCP) server structure, which acts as a bridge between client applications and various MCP-compatible model servers. The implementation follows a service-oriented architecture pattern with clear separation of concerns.

## Architecture

### Directory Structure
```
src/
├── server/
│   ├── routes/
│   │   └── chat.ts        # Chat endpoint handler
│   ├── services/
│   │   ├── mcp.ts         # MCP client management
│   │   ├── message.ts     # Message format handling
│   │   ├── artifact.ts    # Artifact processing
│   │   └── logging.ts     # Logging utilities
│   └── index.ts           # Main server entry point
├── utils/
│   └── api.ts            # API URL management utilities
└── store/
    └── chatStore.ts      # Frontend state management
```

## Current Routes Overview

### 1. Chat Route (`/api/chat`)
**Purpose**: Handles all chat-related interactions with the AI model and MCP tools.
**Endpoint**: POST `/api/chat`
**Key Features**:
- Processes user messages and maintains conversation history
- Integrates with Anthropic's Claude model
- Manages sequential thinking process
- Coordinates MCP tool usage
- Handles binary outputs and artifacts
- Supports bibliography generation

**Request Format**:
```typescript
{
  message: string;              // User's input message
  history: Array<{             // Previous conversation history
    role: 'user' | 'assistant';
    content: string;
  }>;
  blockedServers?: string[];   // Optional list of MCP servers to exclude
}
```

**Response Format**:
```typescript
{
  response: {
    thinking?: string;         // Optional internal reasoning process
    conversation: string;      // Formatted conversation text
    artifacts?: Array<{        // Optional artifacts generated during processing
      id: string;
      type: string;
      title: string;
      content: string;
      position: number;
      language?: string;
    }>;
  }
}
```

**Key Processing Steps**:
1. Message Reception and Validation
2. Sequential Thinking Process
   - Fetches available MCP tools
   - Makes initial Anthropic API call
   - Processes tool usage requests
3. Tool Execution
   - Calls appropriate MCP servers
   - Processes tool responses
   - Handles binary outputs
4. Response Formatting
   - Formats conversation text
   - Processes artifacts
   - Handles bibliography if present
5. Response Delivery
   - Sends formatted response to client
   - Includes any generated artifacts

**Error Handling**:
- Validates input message and history
- Handles MCP tool execution failures
- Manages Anthropic API errors
- Provides detailed error messages

[Additional routes will be documented here as they are added to the system]

## API URL Management

### 1. Proxy Configuration (`vite.config.ts`)
The application uses Vite's proxy configuration as the primary method for API routing:

```typescript
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true
      }
    }
  }
})
```

This configuration automatically forwards all `/api/*` requests to the backend server.

### 2. API Utilities (`src/utils/api.ts`)
We provide utility functions for consistent API URL handling:

```typescript
export const getApiUrl = (endpoint: string): string => {
  const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  
  return import.meta.env.VITE_API_OVERRIDE
    ? `${import.meta.env.VITE_API_OVERRIDE}/api${normalizedEndpoint}`
    : `/api${normalizedEndpoint}`;
};

export const API_ENDPOINTS = {
  CHAT: '/chat',
  // Add new endpoints here as they are created
} as const;
```

### 3. Environment Configuration
The system supports an optional override for API URLs:

```env
# Only set VITE_API_OVERRIDE if you need to bypass the proxy configuration
# VITE_API_OVERRIDE=http://example.com
```

## Adding New Routes

### 1. Backend Route Setup
Create a new route handler in `src/server/routes/`:

```typescript
import express from 'express';
const router = express.Router();

router.post('/', async (req, res) => {
  try {
    // Implementation
  } catch (error) {
    console.error('Error in route:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to process request'
    });
  }
});

export default router;
```

### 2. Register Route in Server
Add the route in `src/server/index.ts`:

```typescript
import newFeatureRouter from './routes/newFeature';
app.use('/api/newFeature', newFeatureRouter);
```

### 3. Add API Endpoint
Update `src/utils/api.ts`:

```typescript
export const API_ENDPOINTS = {
  CHAT: '/chat',
  NEW_FEATURE: '/newFeature',  // Add new endpoint
} as const;
```

### 4. Use in Frontend Code
```typescript
const apiUrl = getApiUrl(API_ENDPOINTS.NEW_FEATURE);
const response = await fetch(apiUrl, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(data)
});
```

## Route Implementation Best Practices

### 1. URL Management
- Always use the `getApiUrl` utility for API URLs
- Add new endpoints to `API_ENDPOINTS` object
- Never hardcode API URLs in components

### 2. Proxy Usage
- All API routes should be under `/api/*`
- The proxy will automatically handle routing to the backend
- No need for port management in frontend code

### 3. Environment Override
Only use `VITE_API_OVERRIDE` when you need to:
- Point to a different API server
- Test against a staging environment
- Debug specific API issues

### 4. Error Handling
```typescript
try {
  const response = await fetch(getApiUrl(API_ENDPOINTS.NEW_FEATURE));
  if (!response.ok) {
    throw new Error('API request failed');
  }
  // Handle response
} catch (error) {
  console.error('Error:', error);
  // Handle error appropriately
}
```

## Testing Routes

### 1. Development Testing
```bash
# Start backend server
npm run server

# Start frontend (in new terminal)
npm run dev
```

### 2. Testing with Override
```bash
# Set override in .env
VITE_API_OVERRIDE=http://staging-server.com

# Start frontend
npm run dev
```

## Troubleshooting

### Common Issues

1. **Connection Refused**
   - Check if backend server is running
   - Verify correct port in `src/server/index.ts`
   - Ensure proxy configuration matches backend port

2. **404 Not Found**
   - Verify route is registered in `src/server/index.ts`
   - Check endpoint spelling in `API_ENDPOINTS`
   - Ensure route handler exists

3. **CORS Issues**
   - Proxy should handle CORS in development
   - Check CORS configuration in production
   - Verify `changeOrigin: true` in proxy config

## Deployment Considerations

### 1. Environment Configuration
- Remove `VITE_API_OVERRIDE` in production
- Use proxy configuration for local development
- Configure production server URLs appropriately

### 2. Security
- Implement proper authentication
- Validate all inputs
- Use HTTPS in production

### 3. Monitoring
- Add logging for API requests
- Monitor response times
- Track error rates

## Maintenance

### 1. Adding Routes
1. Create route handler
2. Register in `index.ts`
3. Add to `API_ENDPOINTS`
4. Use `getApiUrl` in frontend

### 2. Updating Routes
1. Update handler logic
2. Update `API_ENDPOINTS` if needed
3. Update any dependent frontend code

### 3. Removing Routes
1. Remove route registration
2. Remove from `API_ENDPOINTS`
3. Clean up related frontend code

## Best Practices Summary

1. **Route Organization**
   - Keep related endpoints grouped
   - Use clear, descriptive names
   - Follow RESTful conventions

2. **URL Management**
   - Use `getApiUrl` utility
   - Maintain `API_ENDPOINTS` object
   - Avoid hardcoded URLs

3. **Error Handling**
   - Implement consistent error responses
   - Log errors appropriately
   - Provide meaningful error messages

4. **Testing**
   - Test with and without override
   - Verify proxy functionality
   - Test error conditions

## Services Layer

### 1. MCPService (`services/mcp.ts`)
Handles all MCP client interactions and tool management.

```typescript
export class MCPService {
  private mcpClients: Map<string, McpClient>;
  private toolNameMapping: Map<string, string>;

  constructor() {
    this.mcpClients = new Map();
    this.toolNameMapping = new Map();
  }

  async initializeServers(config: MCPServersConfig): Promise<void>;
  async getAllAvailableTools(blockedServers: string[]): Promise<AnthropicTool[]>;
  private resolveSchemaRefs(schema: any, definitions: Record<string, any>): any;
}
```

Key Responsibilities:
- Initialize MCP server connections
- Manage tool discovery and formatting
- Handle schema resolution
- Convert between MCP and Anthropic formats

### 2. MessageService (`services/message.ts`)
Handles message format conversions and chat history management.

```typescript
export class MessageService {
  convertChatMessages(messages: ChatMessage[]): AnthropicMessage[];
  convertToStoreFormat(toolResponse: ToolResponse): StoreFormat;
  formatResponse(response: any): FormattedResponse;
}
```

Key Responsibilities:
- Convert between different message formats
- Manage chat history
- Format responses for client consumption

### 3. ArtifactService (`services/artifact.ts`)
Manages artifact processing and validation.

```typescript
export class ArtifactService {
  validateArtifactType(type: string): string;
  processBinaryOutput(output: BinaryOutput): ProcessedArtifact;
  createArtifactButton(artifact: Artifact): string;
}
```

Key Responsibilities:
- Validate artifact types
- Process binary outputs
- Create artifact UI elements
- Handle artifact metadata

### 4. LoggingService (`services/logging.ts`)
Handles logging and debugging functionality.

```typescript
export class LoggingService {
  initializeLogging(logDir: string): void;
  logRequest(req: Request): void;
  logResponse(res: Response): void;
  logError(error: Error): void;
}
```

Key Responsibilities:
- Manage log directory
- Format log messages
- Handle console overrides
- Track request/response cycles

## Routes Layer

### Chat Route (`routes/chat.ts`)
Main endpoint for handling chat interactions.

```typescript
export class ChatRouter {
  constructor(
    private mcpService: MCPService,
    private messageService: MessageService,
    private artifactService: ArtifactService,
    private loggingService: LoggingService
  ) {}

  async handleChatRequest(req: ChatRequest): Promise<ChatResponse>;
}
```

Request Flow:
1. Receive chat request
2. Get available MCP tools
3. Make initial Anthropic call with tools
4. Execute any requested MCP tools
5. Make final Anthropic call with response formatter
6. Return formatted response

## Implementation Steps

### 1. Set Up Services

1. **Create MCPService**:
   ```typescript
   // services/mcp.ts
   export class MCPService {
     async initializeServers(config: MCPServersConfig) {
       // Initialize MCP clients
       // Set up tool mappings
     }
   }
   ```

2. **Create MessageService**:
   ```typescript
   // services/message.ts
   export class MessageService {
     convertChatMessages(messages: ChatMessage[]) {
       // Convert message formats
     }
   }
   ```

3. **Create ArtifactService**:
   ```typescript
   // services/artifact.ts
   export class ArtifactService {
     validateArtifactType(type: string) {
       // Validate and normalize artifact types
     }
   }
   ```

### 2. Set Up Routes

1. **Create Chat Route**:
   ```typescript
   // routes/chat.ts
   const router = express.Router();
   
   router.post('/', async (req, res) => {
     // 1. Get available tools
     const tools = await mcpService.getAllAvailableTools(req.body.blockedServers);
     
     // 2. Make initial Anthropic call
     const toolResponse = await makeAnthropicCall(req.body, tools);
     
     // 3. Process any tool usage
     const processedResponse = await processToolResponse(toolResponse);
     
     // 4. Format and return response
     res.json(messageService.formatResponse(processedResponse));
   });
   ```

### 3. Wire Everything Together

1. **Update Main Server File**:
   ```typescript
   // index.ts
   const mcpService = new MCPService();
   const messageService = new MessageService();
   const artifactService = new ArtifactService();
   const loggingService = new LoggingService();

   // Initialize services
   await mcpService.initializeServers(config);
   loggingService.initializeLogging(logDir);

   // Mount routes
   app.use('/api/chat', createChatRouter(mcpService, messageService, artifactService, loggingService));
   ```

## Data Flow

1. **Input Request**:
   ```typescript
   interface ChatRequest {
     message: string;
     history: ChatMessage[];
     blockedServers?: string[];
     modelSettings?: ModelSettings;
   }
   ```

2. **Internal Processing**:
   ```typescript
   interface ProcessedRequest {
     message: ChatMessage;
     history: ChatMessage[];
     modelConfig?: ModelConfig;
     blockedServers: string[];
   }
   ```

3. **Output Response**:
   ```typescript
   interface ChatResponse {
     response: {
       thinking?: string;
       conversation: string;
       artifacts?: Artifact[];
     };
     error?: ErrorDetails;
   }
   ```

## Error Handling

1. **Service Level**:
   - Each service should handle its own specific errors
   - Use custom error types for different failure modes
   - Provide meaningful error messages

2. **Route Level**:
   - Catch and format all service errors
   - Provide consistent error responses
   - Log errors appropriately

## Testing

1. **Service Tests**:
   - Unit tests for each service
   - Mock external dependencies
   - Test error conditions

2. **Route Tests**:
   - Integration tests for routes
   - Test complete request flow
   - Verify response formats

## Best Practices

1. **Service Design**:
   - Keep services focused and single-purpose
   - Use dependency injection
   - Maintain clear interfaces

2. **Route Design**:
   - Keep routes thin
   - Delegate business logic to services
   - Use proper HTTP methods and status codes

3. **Error Handling**:
   - Use custom error types
   - Provide meaningful error messages
   - Log errors appropriately

4. **Testing**:
   - Write tests for all services
   - Test error conditions
   - Use proper mocking

## Deployment Considerations

1. **Environment Variables**:
   - API keys
   - Server configurations
   - Log settings

2. **Logging**:
   - Configure log rotation
   - Set appropriate log levels
   - Monitor disk usage

3. **Monitoring**:
   - Health checks
   - Performance metrics
   - Error tracking

## Maintenance

1. **Code Updates**:
   - Keep dependencies updated
   - Monitor for security issues
   - Update API versions

2. **Documentation**:
   - Keep README files updated
   - Document API changes
   - Maintain change log

3. **Testing**:
   - Run tests regularly
   - Update tests with changes
   - Monitor test coverage 