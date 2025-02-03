# Model Context Protocol (MCP) Type System Documentation

## Protocol Information
- Latest Protocol Version: 2024-11-05
- JSON-RPC Version: 2.0

## Core Type System

### Base Types and Constants

#### Protocol Versioning
```typescript
const LATEST_PROTOCOL_VERSION = "2024-11-05"
const SUPPORTED_PROTOCOL_VERSIONS: string[]
const JSONRPC_VERSION = "2.0"
```

### Core Schema Types

#### Progress Token
```typescript
type ProgressToken = string | number
```
Purpose: Used to associate progress notifications with original requests
Validation: Handled by `ProgressTokenSchema` (Zod union of string and number)

#### Cursor
```typescript
type Cursor = string
```
Purpose: Opaque token for pagination
Validation: Handled by `CursorSchema` (Zod string)

### Request/Response Types

#### Request Structure
```typescript
interface Request {
    method: string;
    params?: {
        _meta?: {
            progressToken?: ProgressToken;
        };
    };
}
```

Key Points:
- All requests must have a `method`
- `params` is optional
- `_meta` is a special field for protocol-level metadata
- `progressToken` enables out-of-band progress tracking

#### JSON-RPC Request
```typescript
interface JSONRPCRequest extends Request {
    jsonrpc: "2.0";
    id: string | number;
}
```

Additional Properties:
- Extends base Request
- Requires JSON-RPC version
- Requires unique request ID

#### Notification Structure
```typescript
interface Notification {
    method: string;
    params?: {
        _meta?: Record<string, unknown>;
    };
}
```

Key Points:
- Similar to Request but simpler
- No response expected
- `_meta` allows arbitrary metadata

#### Result Structure
```typescript
interface Result {
    _meta?: Record<string, unknown>;
}
```

Purpose: Base structure for all response results
Note: Specific methods extend this with their own result types

## Runtime Behavior

### Data Validation

1. Schema Validation
   - All data structures validated through Zod schemas
   - Strict type checking enforced
   - Runtime type safety guaranteed

2. Default Values
   - No implicit defaults in core types
   - All optional fields must be explicitly handled
   - Implementers should check existence before access

3. Null/Undefined Handling
   - Optional fields may be undefined
   - Null values are generally not allowed
   - Use optional chaining when accessing nested fields

### Type Transformations

1. Input Validation
   ```typescript
   // Example validation flow
   const request = RequestSchema.parse(inputData);
   ```

2. Output Transformation
   ```typescript
   // Example response transformation
   const response = ResultSchema.parse(outputData);
   ```

## Version Compatibility

### Version-Specific Features

1. Protocol Version 2024-11-05
   - Current latest version
   - Full type safety support
   - Complete Zod schema validation

### Type Migration Guide

1. Upgrading from Previous Versions
   ```typescript
   // Example: Adding progress token to legacy request
   const legacyRequest = {
       method: "someMethod",
       params: {}
   };
   
   const modernRequest = {
       ...legacyRequest,
       params: {
           ...legacyRequest.params,
           _meta: {
               progressToken: generateProgressToken()
           }
       }
   };
   ```

2. Backward Compatibility
   - Always check protocol version support
   - Fallback gracefully for unsupported features
   - Maintain type safety across versions

## Common Patterns and Best Practices

### Type Safety

1. Request Type Safety
   ```typescript
   // Always validate incoming requests
   const safeRequest = RequestSchema.parse(incomingData);
   ```

2. Response Type Safety
   ```typescript
   // Ensure responses match schema
   const safeResponse = ResultSchema.parse(outgoingData);
   ```

### Error Handling

1. Schema Validation Errors
   ```typescript
   try {
       const validated = RequestSchema.parse(data);
   } catch (error) {
       // Handle validation error
   }
   ```

2. Type Coercion
   ```typescript
   // Safely handle type coercion
   const id = RequestIdSchema.parse(rawId);
   ```

## Implementation Guidelines

### Required Implementation Checks

1. Version Compatibility
   ```typescript
   if (!SUPPORTED_PROTOCOL_VERSIONS.includes(clientVersion)) {
       throw new Error("Unsupported protocol version");
   }
   ```

2. Type Validation
   ```typescript
   // Always validate at boundaries
   export const validateRequest = (req: unknown) => {
       return RequestSchema.parse(req);
   };
   ```

### Optional Features

1. Progress Tracking
   ```typescript
   // Optional progress token implementation
   const withProgress = {
       method: "longRunningOperation",
       params: {
           _meta: {
               progressToken: "unique-token"
           }
       }
   };
   ```

## Common Issues and Solutions

### Type Mismatches

1. Request ID Type Mismatch
   ```typescript
   // Problem: Mixed string/number IDs
   const fixRequestId = (id: unknown) => RequestIdSchema.parse(id);
   ```

2. Optional Fields Access
   ```typescript
   // Safe optional field access
   const getProgressToken = (req: Request) => 
       req.params?._meta?.progressToken;
   ```

### Schema Validation

1. Complex Object Validation
   ```typescript
   // Handle nested object validation
   const validateNestedRequest = (data: unknown) => {
       const request = RequestSchema.parse(data);
       // Additional validation as needed
       return request;
   };
   ```

2. Custom Type Guards
   ```typescript
   // Type guard for requests
   const isRequest = (data: unknown): data is Request => {
       try {
           RequestSchema.parse(data);
           return true;
       } catch {
           return false;
       }
   };
   ```

## Testing Considerations

1. Schema Validation Tests
   ```typescript
   test("validates correct request", () => {
       const validRequest = {
           method: "test",
           params: {
               _meta: {
                   progressToken: "test-token"
               }
           }
       };
       expect(() => RequestSchema.parse(validRequest)).not.toThrow();
   });
   ```

2. Type Safety Tests
   ```typescript
   test("handles invalid types", () => {
       const invalidRequest = {
           method: 123, // should be string
           params: {}
       };
       expect(() => RequestSchema.parse(invalidRequest)).toThrow();
   });
   ```

## Additional Resources

1. Related Documentation
   - JSON-RPC 2.0 Specification
   - Zod Documentation
   - TypeScript Handbook

2. Type Definition Files
   - types.d.ts (main type definitions)
   - shared/index.d.ts (shared types)
   - client/index.d.ts (client-specific types)
   - server/index.d.ts (server-specific types)

## Client-Server Communication

### Client Types

#### Client Options
```typescript
interface ClientOptions extends ProtocolOptions {
    capabilities: ClientCapabilities;
}
```

#### Client Class
```typescript
class Client<RequestT extends Request = Request, 
             NotificationT extends Notification = Notification, 
             ResultT extends Result = Result> {
    
    // Core Properties
    private _clientInfo: Implementation;
    private _serverCapabilities?: ServerCapabilities;
    private _serverVersion?: Implementation;
    private _capabilities: ClientCapabilities;

    // Key Methods
    connect(transport: Transport): Promise<void>;
    getServerCapabilities(): ServerCapabilities | undefined;
    getServerVersion(): Implementation | undefined;
    
    // Core Operations
    ping(options?: RequestOptions): Promise<Result>;
    complete(params: CompleteRequest["params"], options?: RequestOptions): Promise<CompleteResult>;
    setLoggingLevel(level: LoggingLevel, options?: RequestOptions): Promise<Result>;
}
```

### Server Types

#### Server Options
```typescript
interface ServerOptions extends ProtocolOptions {
    capabilities: ServerCapabilities;
}
```

#### Server Class
```typescript
class Server<RequestT extends Request = Request, 
            NotificationT extends Notification = Notification, 
            ResultT extends Result = Result> {
    
    // Core Properties
    private _serverInfo: Implementation;
    private _clientCapabilities?: ClientCapabilities;
    private _clientVersion?: Implementation;
    private _capabilities: ServerCapabilities;
    
    // Lifecycle Events
    oninitialized?: () => void;
    
    // Key Methods
    getClientCapabilities(): ClientCapabilities | undefined;
    getClientVersion(): Implementation | undefined;
    
    // Core Operations
    ping(): Promise<Result>;
    createMessage(params: CreateMessageRequest["params"], options?: RequestOptions): Promise<CreateMessageResult>;
    listRoots(params?: ListRootsRequest["params"], options?: RequestOptions): Promise<ListRootsResult>;
    
    // Notifications
    sendLoggingMessage(params: LoggingMessageNotification["params"]): Promise<void>;
    sendResourceUpdated(params: ResourceUpdatedNotification["params"]): Promise<void>;
    sendResourceListChanged(): Promise<void>;
    sendToolListChanged(): Promise<void>;
    sendPromptListChanged(): Promise<void>;
}
```

### Transport Types

The MCP SDK supports multiple transport mechanisms:

1. WebSocket Transport
```typescript
interface WebSocketTransport extends Transport {
    // WebSocket specific implementation
}
```

2. SSE (Server-Sent Events) Transport
```typescript
interface SSETransport extends Transport {
    // SSE specific implementation
}
```

3. STDIO Transport
```typescript
interface STDIOTransport extends Transport {
    // STDIO specific implementation
}
```

### Message Content Types

#### Text Content
```typescript
interface TextContent {
    type: "text";
    text: string;
}
```

#### Image Content
```typescript
interface ImageContent {
    type: "image";
    data: string;
    mimeType: string;
}
```

#### Resource Content
```typescript
interface ResourceContent {
    type: "resource";
    resource: {
        uri: string;
        mimeType?: string;
        text?: string;
        blob?: string;
    };
}
```

### Capability Types

#### Client Capabilities
```typescript
interface ClientCapabilities {
    // Client-specific capabilities
    // Extended by implementations
}
```

#### Server Capabilities
```typescript
interface ServerCapabilities {
    // Server-specific capabilities
    // Extended by implementations
}
```

## Implementation Guidelines

### Client Implementation

1. Basic Client Setup
```typescript
const client = new Client({
    name: "MyClient",
    version: "1.0.0",
    capabilities: {
        // Define supported capabilities
    }
});

await client.connect(transport);
```

2. Custom Type Extensions
```typescript
// Define custom types
interface CustomRequest extends Request {
    // Custom request fields
}

interface CustomNotification extends Notification {
    // Custom notification fields
}

interface CustomResult extends Result {
    // Custom result fields
}

// Create typed client
const client = new Client<CustomRequest, CustomNotification, CustomResult>({
    name: "CustomClient",
    version: "1.0.0",
    capabilities: {
        // Custom capabilities
    }
});
```

### Server Implementation

1. Basic Server Setup
```typescript
const server = new Server({
    name: "MyServer",
    version: "1.0.0",
    capabilities: {
        // Define supported capabilities
    }
});

server.oninitialized = () => {
    // Handle initialization
};
```

2. Custom Type Extensions
```typescript
// Define custom types
interface CustomServerRequest extends ServerRequest {
    // Custom request fields
}

interface CustomServerNotification extends ServerNotification {
    // Custom notification fields
}

interface CustomServerResult extends ServerResult {
    // Custom result fields
}

// Create typed server
const server = new Server<CustomServerRequest, CustomServerNotification, CustomServerResult>({
    name: "CustomServer",
    version: "1.0.0",
    capabilities: {
        // Custom capabilities
    }
});
```

## Type Safety Considerations

### Generic Type Constraints

1. Request Type Constraints
```typescript
type RequestT extends Request = Request
```
- Must extend base Request type
- Includes method and optional params

2. Notification Type Constraints
```typescript
type NotificationT extends Notification = Notification
```
- Must extend base Notification type
- Similar to Request but for one-way messages

3. Result Type Constraints
```typescript
type ResultT extends Result = Result
```
- Must extend base Result type
- Includes optional metadata

### Type Validation Flow

1. Input Validation
```typescript
// Client-side
const validatedRequest = RequestSchema.parse(incomingRequest);

// Server-side
const validatedNotification = NotificationSchema.parse(incomingNotification);
```

2. Output Validation
```typescript
// Client-side
const validatedResult = ResultSchema.parse(outgoingResult);

// Server-side
const validatedResponse = ResponseSchema.parse(outgoingResponse);
```

## Error Handling Types

### Protocol Errors
```typescript
interface ProtocolError extends Error {
    code: number;
    data?: unknown;
}
```

### Validation Errors
```typescript
interface ValidationError extends Error {
    path: string[];
    message: string;
}
```

## Testing Types

### Mock Types
```typescript
interface MockTransport extends Transport {
    // Mock implementation for testing
}

interface MockClient extends Client {
    // Mock client implementation
}

interface MockServer extends Server {
    // Mock server implementation
}
```

### Test Utilities
```typescript
interface TestContext {
    client: MockClient;
    server: MockServer;
    transport: MockTransport;
}
```

## LLM Integration Types

### Message History Types
```typescript
interface Message {
    role: "user" | "assistant";
    content: string | ToolUse[];
}

interface ToolUse {
    type: "tool_use";
    name: string;
    input: Record<string, any>;
}

interface MessageHistory {
    messages: Message[];
    toolResults: {
        name: string;
        result: any;
    }[];
}
```

### Tool Discovery Types

#### Tool Definition
```typescript
interface Tool {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: Record<string, any>;
        required?: string[];
    };
}

interface ToolList {
    tools: Tool[];
}
```

#### Tool Call Types
```typescript
interface CallToolRequest {
    name: string;
    input: Record<string, any>;
}

interface CallToolResult {
    isError: boolean;
    content: Array<{
        type: "text";
        text: string;
    }>;
}
```

### Resource Types

#### Resource Template
```typescript
interface ResourceTemplate {
    uriTemplate: string;
    name: string;
    description: string;
    mimeType?: string;
}

interface ResourceList {
    resources: Resource[];
    resourceTemplates: ResourceTemplate[];
}
```

#### Resource Content
```typescript
interface ResourceContent {
    contents: Array<{
        text?: string;
        blob?: string;
        mimeType?: string;
    }>;
}
```

### Prompt Types

#### Prompt Definition
```typescript
interface Prompt {
    name: string;
    description: string;
    arguments?: Array<{
        name: string;
        description: string;
        required: boolean;
    }>;
}

interface PromptList {
    prompts: Prompt[];
}
```

### LLM Context Management Types

#### Context Manager
```typescript
interface LLMContext {
    available_tools: Array<{
        name: string;
        description: string;
        parameters: Record<string, any>;
        example?: Record<string, any>;
    }>;
    available_prompts: Array<{
        name: string;
        description: string;
        arguments?: Array<{
            name: string;
            description: string;
            required: boolean;
        }>;
    }>;
    available_resources: Array<{
        name: string;
        uri: string;
        description: string;
    }>;
}

interface ContextManager {
    context: LLMContext | null;
    lastUpdate: number | null;
    
    prepareLlmContext(): Promise<LLMContext>;
    asSystemPrompt(): string;
    formatForClaude(): Record<string, any>;
}
```

### Initialization Types

#### Root Definition
```typescript
interface Root {
    uri: string;
    name?: string;
}

interface InitializeRequest {
    roots: Root[];
}

interface InitializeResponse {
    capabilities: ServerCapabilities;
    serverInfo: Implementation;
}
```

## Implementation Patterns

### Context Re-injection Pattern
```typescript
interface ContextReinjection {
    // Record tool call
    toolCall: {
        role: "assistant";
        content: [{
            type: "tool_use";
            name: string;
            input: Record<string, any>;
        }];
    };
    
    // Record tool result
    toolResult: {
        role: "user";
        content: any;
    };
}
```

### Human-in-the-Loop Pattern
```typescript
interface ToolApproval {
    toolName: string;
    toolArgs: Record<string, any>;
    approved: boolean;
}

interface ApprovalManager {
    shouldCallTool(toolName: string, args: Record<string, any>): Promise<boolean>;
}
```

### Transport Connection Pattern
```typescript
interface TransportConfig {
    command: string;
    args: string[];
}

interface StdioConfig extends TransportConfig {
    // Additional stdio-specific configuration
}

interface WebSocketConfig extends TransportConfig {
    url: string;
    // Additional websocket-specific configuration
}

interface SSEConfig extends TransportConfig {
    endpoint: string;
    // Additional SSE-specific configuration
}
```

## Testing Patterns

### LLM Integration Tests
```typescript
interface LLMTestContext {
    messages: Message[];
    tools: Tool[];
    expectedToolCalls: ToolUse[];
    mockToolResults: Record<string, any>;
}

interface ContextManagerTest {
    context: LLMContext;
    expectedSystemPrompt: string;
    expectedClaudeFormat: Record<string, any>;
}
```

### Tool Validation Tests
```typescript
interface ToolValidationTest {
    tool: Tool;
    validInputs: Record<string, any>[];
    invalidInputs: Record<string, any>[];
    expectedErrors: Record<string, string>;
}
```

## Error Handling Patterns

### Tool Error Types
```typescript
interface ToolError extends Error {
    toolName: string;
    inputArgs: Record<string, any>;
    errorType: "validation" | "execution" | "permission";
}

interface ValidationError extends ToolError {
    errorType: "validation";
    validationErrors: Record<string, string>;
}

interface ExecutionError extends ToolError {
    errorType: "execution";
    cause?: Error;
}
```

### Context Management Errors
```typescript
interface ContextError extends Error {
    contextType: "tools" | "prompts" | "resources";
    operation: string;
    timestamp: number;
}
``` 