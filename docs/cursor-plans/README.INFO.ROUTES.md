# MCP Server: Current Routing Implementation

## Overview
This document describes the current implementation of the Model Context Protocol (MCP) server's routing architecture. The MCP server acts as a bridge between client applications and various MCP-compatible model servers, following a service-oriented architecture with clear separation of concerns.

## Current Architecture

### Directory Structure
```
src/
├── server/
│   ├── routes/
│   │   ├── chat.ts            # Main chat endpoint handler
│   │   ├── server-status.ts   # Server status information
│   │   ├── storage.ts         # File storage handling
│   │   ├── ollama_mcp.ts      # Ollama model integration
│   │   └── api/
│   │       └── internal/
│   │           └── llm.ts     # Internal LLM service API
│   ├── services/
│   │   ├── mcp.ts             # MCP client management
│   │   ├── message.ts         # Message format handling
│   │   ├── artifact.ts        # Artifact processing
│   │   ├── logging.ts         # Logging utilities
│   │   └── llm/               # LLM service implementation
│   │       ├── index.ts       # Main LLM service
│   │       ├── providers/     # LLM provider implementations
│   │       └── cache.ts       # LLM response caching
│   └── index.ts               # Main server entry point
└── ...
```

## Routes Implementation

### 1. Chat Route (`/api/chat`)
**Purpose**: Handles all chat-related interactions with AI models and MCP tools.
**File**: `src/server/routes/chat.ts`
**Key Features**:
- Processes user messages and maintains conversation history
- Integrates with Anthropic's Claude model
- Manages sequential thinking process
- Coordinates MCP tool usage
- Handles binary outputs and artifacts
- Supports bibliography generation and knowledge graphs

**Request Flow**:
1. Request validation and initialization
2. MCP tool retrieval
3. Sequential thinking process with Claude
4. Tool execution and response processing
5. Knowledge graph processing and merging
6. Final response formatting
7. Artifact collection (bibliographies, grant markdown, etc.)
8. Response delivery

### 2. Server Status Route (`/api/server-status`)
**Purpose**: Provides operational status of all connected MCP servers.
**File**: `src/server/routes/server-status.ts`
**Key Features**:
- Returns status information for all MCP servers
- Lists available tools for each server
- Provides server health information

**Implementation Details**:
```javascript
router.get('/', async (req: Request, res: Response) => {
  try {
    const mcpService = req.app.locals.mcpService as MCPService;
    const loggingService = req.app.locals.loggingService as LoggingService;
    
    // Get statuses from MCP service
    const serverStatuses = await getServerStatuses(mcpService);
    
    res.json({ servers: serverStatuses });
  } catch (error) {
    // Error handling
  }
});
```

### 3. Storage Route (`/api/storage`)
**Purpose**: Handles file storage operations.
**File**: `src/server/routes/storage.ts`
**Key Features**:
- File upload and retrieval
- File metadata management
- File content access

**Endpoints**:
- `GET /api/storage/files` - List all files
- `GET /api/storage/files/:id/content` - Get file content

### 4. Ollama MCP Route
**Purpose**: Integrates with Ollama models through MCP protocol.
**File**: `src/server/routes/ollama_mcp.ts`
**Key Features**:
- Manages Ollama model instances
- Provides MCP-compatible interface

### 5. Internal LLM API (`/api/internal/llm`)
**Purpose**: Internal API for MCP servers to access LLM capabilities.
**File**: `src/server/routes/api/internal/llm.ts`
**Key Features**:
- Authentication middleware for MCP requests
- LLM service access

## Services Layer

### 1. MCP Service (`services/mcp.ts`)
**Purpose**: Manages all MCP client interactions and tool management.
**Key Responsibilities**:
- Initialize and maintain MCP server connections
- Manage tool discovery and access
- Handle MCP client communication
- Process MCP responses and logs

**Implementation**:
```typescript
export class MCPService {
  private mcpClients: Map<string, McpClient>;
  private mcpProcesses: Map<string, ChildProcess>;
  
  async initializeServers(config: MCPServersConfig): Promise<void> { /* ... */ }
  async getAllAvailableTools(blockedServers: string[]): Promise<AnthropicTool[]> { /* ... */ }
  async callTool(serverName: string, toolName: string, args: Record<string, unknown>): Promise<any> { /* ... */ }
  getOriginalToolName(toolName: string): string | undefined { /* ... */ }
  setLogMessageHandler(handler: (message: MCPLogMessage) => void): void { /* ... */ }
  cleanup(): void { /* ... */ }
}
```

### 2. Message Service (`services/message.ts`)
**Purpose**: Handles message format conversions and chat history management.
**Key Responsibilities**:
- Convert between different message formats
- Manage chat history and contexts
- Format responses for client consumption

### 3. Artifact Service (`services/artifact.ts`)
**Purpose**: Manages artifact processing and validation.
**Key Responsibilities**:
- Validate artifact types
- Process binary outputs
- Handle artifact metadata

### 4. Logging Service (`services/logging.ts`)
**Purpose**: Handles logging and debugging functionality.
**Key Responsibilities**:
- Manage log directory and sessions
- Format log messages
- Track request/response cycles

### 5. LLM Service (`services/llm/`)
**Purpose**: Provides access to LLM capabilities.
**Key Components**:
- `index.ts` - Main service implementation
- `providers/` - LLM provider implementations
- `cache.ts` - Response caching

**Implementation**:
```typescript
export class LLMService implements LLMServiceInterface {
  private provider: LLMProvider;
  private _cache: LLMCache;
  
  constructor(options: LLMServiceOptions = {}) { /* ... */ }
  async generateResponse(request: LLMRequest): Promise<LLMResponse> { /* ... */ }
  async extractJSON(prompt: string): Promise<any> { /* ... */ }
}
```

## Route Registration

Routes are registered in `src/server/index.ts`:

```typescript
// Initialize services
const mcpService = new MCPService();
const loggingService = new LoggingService();
const llmService = new LLMService();

// Store services in app.locals for routes to access
app.locals.mcpService = mcpService;
app.locals.loggingService = loggingService;
app.locals.llmService = llmService;

// Mount routes
app.use('/api/chat', chatRouter);
app.use('/api/server-status', serverStatusRouter);
app.use('/api/storage', storageRouter);
app.use('/api/internal/llm', llmRoutes);
```

## Current Pattern for Adding Routes

1. **Create Route File**:
   ```typescript
   // src/server/routes/new-feature.ts
   import express, { Request, Response } from 'express';
   import { MCPService } from '../services/mcp';
   import { LoggingService } from '../services/logging';

   const router = express.Router();

   router.get('/', async (req: Request, res: Response) => {
     try {
       const mcpService = req.app.locals.mcpService as MCPService;
       const loggingService = req.app.locals.loggingService as LoggingService;
       
       // Implementation
       
       res.json({ result: 'success' });
     } catch (error) {
       // Error handling
     }
   });

   export default router;
   ```

2. **Import and Register in Server**:
   ```typescript
   // src/server/index.ts
   import newFeatureRouter from './routes/new-feature';
   
   // Mount routes
   app.use('/api/new-feature', newFeatureRouter);
   ```

3. **Access Services via app.locals**:
   ```typescript
   const mcpService = req.app.locals.mcpService as MCPService;
   const loggingService = req.app.locals.loggingService as LoggingService;
   ```

## Error Handling

Current error handling pattern:

```typescript
try {
  // Implementation
} catch (error) {
  const loggingService = req.app.locals.loggingService as LoggingService;
  loggingService.logError(error as Error);
  
  res.status(500).json({
    error: 'Friendly error message',
    details: error instanceof Error ? error.message : 'Unknown error'
  });
}
```

## API Response Streaming

The chat route implements response streaming:

```typescript
// Set headers for streaming
res.setHeader('Content-Type', 'application/json');
res.setHeader('Transfer-Encoding', 'chunked');
res.setHeader('Cache-Control', 'no-cache');
res.setHeader('Connection', 'keep-alive');

// Send updates
const sendStatusUpdate = (status: string) => {
  res.write(JSON.stringify({ 
    type: 'status', 
    message: status,
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString()
  }) + '\n');
};
```

## Best Practices

1. **Route Organization**:
   - Keep related endpoints grouped in a single file
   - Use descriptive route names
   - Follow RESTful conventions

2. **Service Access**:
   - Access services via `req.app.locals`
   - Cast to appropriate service type
   - Handle potential unavailability

3. **Error Handling**:
   - Use try-catch blocks
   - Log errors with LoggingService
   - Return consistent error responses

4. **Response Formatting**:
   - Use consistent JSON structures
   - Include appropriate metadata
   - Set correct HTTP status codes

## Security Considerations

1. **Authentication**:
   - Internal API routes use authentication middleware
   - Token validation for protected endpoints

2. **Input Validation**:
   - Validate request parameters
   - Sanitize user input

3. **Error Exposure**:
   - Avoid exposing internal errors
   - Provide user-friendly error messages

## Future Improvements

1. **Route Standardization**:
   - Standardize error handling across routes
   - Implement middleware for common functionality
   - Add request validation middleware

2. **Documentation**:
   - Add OpenAPI specifications
   - Document all endpoints and parameters

3. **Testing**:
   - Implement route-level unit tests
   - Add integration tests across routes and services 