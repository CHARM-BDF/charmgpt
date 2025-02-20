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
```

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