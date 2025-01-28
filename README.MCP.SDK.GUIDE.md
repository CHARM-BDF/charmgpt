# MCP SDK Implementation Guide

## Overview

This guide details how to implement a Model Context Protocol (MCP) client using the SDK's type system and design patterns.

## Component Architecture and Interactions

### 1. Core Components

1. **MCPClient**
   - Primary interface to the MCP server
   - Handles transport-level communication
   - Manages connection lifecycle
   - Implements core MCP operations (tools, resources, prompts)

2. **MCPContextManager**
   - Manages MCP context state
   - Caches capabilities and server info
   - Provides context for LLM system prompts
   - Handles context refreshing and validation

3. **Transport Layer**
   - Implements communication protocol (e.g., stdio, websocket)
   - Handles message serialization/deserialization
   - Manages connection state
   - Example: `StdioClientTransport` for command-line based communication

4. **Server Integration**
   - Express server endpoints
   - Integrates MCP with Claude/Anthropic API
   - Handles tool execution and response processing
   - Manages XML response validation and repair

### 2. Data Flow

1. **Initialization Flow**
   ```
   Server Start
   ├─> Create MCPClient
   ├─> Connect to MCP Server (via Transport)
   ├─> Initialize MCPContextManager
   └─> Cache initial capabilities
   ```

2. **Chat Request Flow**
   ```
   Client Request
   ├─> Express Server
   ├─> Get Enhanced System Prompt (with MCP context)
   ├─> Send to Claude
   ├─> Process Claude Response
   │   ├─> Parse Tool Calls
   │   ├─> Execute Tools via MCPClient
   │   └─> Replace Tool Calls with Results
   └─> Return Processed Response
   ```

3. **Tool Execution Flow**
   ```
   Tool Call Detection
   ├─> Parse Tool Call from Response
   ├─> Validate Tool Arguments
   ├─> Execute via MCPClient
   │   ├─> Send Tool Request
   │   ├─> Wait for Response
   │   └─> Process Result
   └─> Insert Result into Response
   ```

4. **Context Refresh Flow**
   ```
   Context Update
   ├─> Check Cache Freshness
   ├─> Fetch Updated Capabilities
   │   ├─> List Tools
   │   ├─> List Resources
   │   └─> List Prompts
   └─> Update Cache
   ```

### 3. Key Interactions

1. **Client-Server Communication**
   - Client initiates connection with server command
   - Server responds with capabilities
   - Bidirectional message passing via transport
   - Error handling and recovery

2. **Tool Integration**
   - Tools registered with server
   - Client discovers tools via capabilities
   - Tool execution through standardized interface
   - Results formatted and validated

3. **Resource Management**
   - Resources discovered via server
   - Resource content fetched on demand
   - Content cached when appropriate
   - URI-based resource addressing

4. **Prompt Management**
   - Prompts provided by server
   - Arguments validated against schema
   - Dynamic prompt generation
   - Context-aware prompt enhancement

### 4. Error Handling and Recovery

1. **Connection Issues**
   - Automatic reconnection attempts
   - Connection state management
   - Transport error recovery
   - Session recovery

2. **Tool Execution Errors**
   - Tool-specific error handling
   - Result validation
   - Fallback behaviors
   - Error reporting to client

3. **Context Errors**
   - Cache invalidation
   - Refresh retry logic
   - Fallback to base functionality
   - Error notification

4. **Response Processing**
   - XML validation
   - Automatic repair strategies
   - LLM-based reformatting
   - Fallback response formats

## 1. Core Types and Schemas

The SDK uses Zod extensively for runtime type validation. The core types are:

```typescript
// Base Protocol Types
type Request = {
    method: string;
    params?: {
        _meta?: {
            progressToken?: string | number;
        };
    };
};

type Notification = {
    method: string;
    params?: {
        _meta?: Record<string, unknown>;
    };
};

type Result = {
    _meta?: Record<string, unknown>;
};
```

## 2. Client Class Structure

The `Client` class is designed to be extended with custom types:

```typescript
class Client<
    RequestT extends Request = Request,
    NotificationT extends Notification = Notification,
    ResultT extends Result = Result
> {
    constructor(
        clientInfo: Implementation,  // { name: string, version: string }
        options: ClientOptions       // { capabilities: ClientCapabilities }
    )
}
```

## 3. Key Methods and Their Types

```typescript
interface ClientMethods {
    // Connection
    connect(transport: Transport): Promise<void>;
    close(): Promise<void>;

    // Core Operations
    listTools(params?: { 
        _meta?: { progressToken?: string | number },
        cursor?: string 
    }): Promise<ToolResponse>;

    listResources(params?: {
        _meta?: { progressToken?: string | number },
        cursor?: string
    }): Promise<ResourceResponse>;

    listPrompts(params?: {
        _meta?: { progressToken?: string | number },
        cursor?: string
    }): Promise<PromptResponse>;

    callTool(params: {
        name: string;
        arguments?: Record<string, unknown>;
        _meta?: { progressToken?: string | number }
    }): Promise<ToolResult>;
}
```

## 4. Response Types

All responses should match the SDK's Zod schemas:

```typescript
interface ToolResponse {
    tools: Array<{
        name: string;
        description?: string;
        inputSchema: {
            type: "object";
            properties?: Record<string, unknown>;
        };
    }>;
    _meta?: Record<string, unknown>;
}

interface ResourceResponse {
    resources: Array<{
        uri: string;
        name: string;
        description?: string;
        mimeType?: string;
    }>;
    _meta?: Record<string, unknown>;
    nextCursor?: string;
}

interface PromptResponse {
    prompts: Array<{
        name: string;
        description?: string;
        arguments?: Array<{
            name: string;
            description?: string;
            required?: boolean;
        }>;
    }>;
}
```

## 5. Implementation Strategy

1. First, define the Zod schemas for validation:
```typescript
const toolResponseSchema = z.object({
    tools: z.array(z.object({
        name: z.string(),
        description: z.string().optional(),
        inputSchema: z.object({
            type: z.literal("object"),
            properties: z.record(z.unknown()).optional()
        })
    }))
});
```

2. Then implement the client class:
```typescript
class MCPClient extends Client<Request, Notification, Result> {
    constructor(config: MCPClientConfig) {
        super(
            { name: config.name, version: config.version },
            { capabilities: { prompts: {}, resources: {}, tools: {} } }
        );
    }

    // Implement methods using the correct types and schemas
}
```

## 6. Best Practices

1. **Type Safety**
   - Always use the SDK's type definitions
   - Avoid type assertions unless absolutely necessary
   - Let TypeScript infer types where possible

2. **Schema Validation**
   - Define Zod schemas for all requests and responses
   - Use the SDK's base schemas as starting points
   - Add custom validation as needed

3. **Error Handling**
   - Handle transport errors
   - Validate responses before processing
   - Provide meaningful error messages

4. **Resource Management**
   - Clean up resources in close()
   - Handle connection state properly
   - Implement proper error recovery

## 7. Common Gotchas

1. **Type Mismatches**
   - Ensure response types match SDK expectations
   - Pay attention to optional fields
   - Use correct generic type parameters

2. **Schema Validation**
   - Don't skip schema validation
   - Handle validation errors gracefully
   - Keep schemas in sync with types

3. **Method Signatures**
   - Match SDK method signatures exactly
   - Include all optional parameters
   - Use correct parameter types

## 8. Testing Strategy

1. **Unit Tests**
   - Test each method independently
   - Verify schema validation
   - Check error handling

2. **Integration Tests**
   - Test with actual transports
   - Verify end-to-end flows
   - Test error conditions

3. **Type Tests**
   - Verify type compatibility
   - Test generic constraints
   - Check inference behavior

## Configuration and Environment

### 1. Environment Setup

1. **Required Environment Variables**
   ```
   ANTHROPIC_API_KEY=<your-api-key>
   PORT=3000                      # Server port
   MCP_SERVER_CMD=mcp-server      # Command to start MCP server
   MCP_SERVER_ARGS=[]            # Arguments for MCP server
   ```

2. **Development Configuration**
   ```typescript
   interface MCPClientConfig {
       name: string;              // Client name
       version: string;           // Client version
       roots?: string[];         // Resource root paths
       cacheTimeout?: number;    // Context cache timeout
   }
   ```

3. **Server Configuration**
   ```typescript
   interface ServerConfig {
       model: string;            // Claude model version
       maxTokens: number;        // Max response tokens
       temperature: number;      // Response temperature
       systemPrompt: string;    // Base system prompt
   }
   ```

### 2. Directory Structure

```
src/
├── mcp/
│   ├── client.ts           # MCPClient implementation
│   ├── contextManager.ts   # Context management
│   ├── types.ts           # Type definitions
│   └── mcpSetup.ts        # Client setup and config
├── server/
│   ├── index.ts           # Express server
│   ├── systemPrompt.ts    # Prompt management
│   └── mcpSetup.ts        # Server MCP setup
└── utils/
    ├── validation.ts      # Response validation
    └── error.ts          # Error handling
```

### 3. Dependencies

1. **Required Packages**
   ```json
   {
     "dependencies": {
       "@anthropic-ai/sdk": "^0.x.x",
       "@modelcontextprotocol/sdk": "latest",
       "express": "^4.x.x",
       "zod": "^3.x.x"
     }
   }
   ```

2. **Development Dependencies**
   ```json
   {
     "devDependencies": {
       "@types/express": "^4.x.x",
       "typescript": "^5.x.x",
       "ts-node": "^10.x.x"
     }
   }
   ```

### 4. TypeScript Configuration

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "node",
    "esModuleInterop": true,
    "strict": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules"]
}
``` 