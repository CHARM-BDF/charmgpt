# Current MCP Server Routes Implementation

## Overview
This document describes the current implementation of routes in the MCP (Model Context Protocol) server. The server acts as a bridge between client applications and various AI model servers, with a focus on Anthropic's Claude and Ollama models.

## Directory Structure
```
src/server/
├── routes/
│   ├── chat.ts        # Main chat endpoint handler for Claude
│   └── ollama_mcp.ts  # Ollama-specific endpoint handler
├── services/
│   ├── mcp.ts         # MCP client management
│   ├── message.ts     # Message format handling
│   ├── artifact.ts    # Artifact and binary output processing
│   └── logging.ts     # Logging utilities
└── systemPrompt.ts    # System prompt configuration
```

## Service Initialization Patterns

The codebase uses two patterns for service initialization:

1. **Route-Level Initialization**:
   ```typescript
   // In chat.ts
   const messageService = new MessageService();
   const artifactService = new ArtifactService();
   ```

2. **Application-Level Services** (accessed via req.app.locals):
   ```typescript
   // Services accessed in routes
   const loggingService = req.app.locals.loggingService as LoggingService;
   const mcpService = req.app.locals.mcpService as MCPService;
   ```

## Chat Route (`/api/chat`)

### Purpose
Handles all chat-related interactions with Anthropic's Claude model, including:
- Processing user messages
- Managing conversation history
- Coordinating tool usage
- Sequential thinking process
- Bibliography generation
- Binary output handling

### Request Format
```typescript
interface ChatRequest {
  message: string;              // User's input message
  history: Array<{             // Previous conversation history
    role: 'user' | 'assistant';
    content: string;
  }>;
  blockedServers?: string[];   // Optional list of MCP servers to exclude
}
```

### Processing Flow

1. **Request Initialization**:
   ```typescript
   router.post('/', async (req: Request, res: Response) => {
     const loggingService = req.app.locals.loggingService;
     const { message, history, blockedServers = [] } = req.body;
   ```

2. **Sequential Thinking Process**:
   ```typescript
   while (!isSequentialThinkingComplete) {
     // Get available MCP tools
     let tools = [];
     if (req.app.locals.mcpService) {
       tools = await req.app.locals.mcpService.getAllAvailableTools(blockedServers);
     }

     // Make Anthropic call
     const toolResponse = await anthropic.messages.create({
       model: 'claude-3-5-sonnet-20241022',
       messages: messageService.convertChatMessages(messages),
       tools: tools,
     });
   ```

3. **Tool Execution**:
   ```typescript
   if (content.type === 'tool_use') {
     const mcpService = req.app.locals.mcpService;
     const originalToolName = mcpService.getOriginalToolName(content.name);
     const [serverName, toolName] = originalToolName.split(':');
     const toolResult = await mcpService.callTool(serverName, toolName, content.input);
   }
   ```

4. **Special Output Handling**:
   - Bibliography Processing:
     ```typescript
     if ('bibliography' in toolResult && toolResult.bibliography) {
       // Merge and deduplicate based on PMID
       const currentBibliography = (messages as any).bibliography;
       const newBibliography = toolResult.bibliography;
       // ... bibliography merging logic
     }
     ```
   - Binary Output Processing:
     ```typescript
     if ('binaryOutput' in toolResult && toolResult.binaryOutput) {
       const binaryOutput = toolResult.binaryOutput as BinaryOutput;
       (messages as any).binaryOutputs.push(binaryOutput);
     }
     ```

5. **Response Formatting**:
   ```typescript
   const response = await anthropic.messages.create({
     model: 'claude-3-5-sonnet-20241022',
     messages: messageService.convertChatMessages(messages),
     system: systemPrompt,
     tools: [{
       name: "response_formatter",
       // ... response formatting schema
     }],
     tool_choice: { type: "tool", name: "response_formatter" }
   });
   ```

### Response Format
```typescript
interface ChatResponse {
  response: {
    thinking?: string;         // Optional internal reasoning process
    conversation: Array<{      // Conversation segments and artifacts
      type: 'text' | 'artifact';
      content?: string;        // Markdown formatted text
      artifact?: {             // Optional artifact details
        type: string;          // Content type
        id: string;           
        title: string;
        content: string;
        language?: string;
      };
    }>;
  };
}
```

## Ollama MCP Route (`/api/ollama`)

### Purpose
Handles interactions with Ollama models, providing MCP-compatible endpoints.

### Key Features
- Model management
- Chat completions with tool support
- MCP tool integration
- Response formatting to match chat store expectations

### Request Format
```typescript
interface OllamaRequest {
  message: string;              // User's input message
  history: Array<{             // Previous conversation history
    role: 'user' | 'assistant';
    content: string;
  }>;
  blockedServers?: string[];   // Optional list of MCP servers to exclude
}
```

### Processing Flow
1. **MCP Client Initialization**:
   ```typescript
   const client = await initializeMCPClient();
   let availableTools = await client.listTools();
   ```

2. **Tool Format Conversion**:
   ```typescript
   // Convert MCP tools to Ollama format
   availableTools = availableTools.tools.map(tool => ({
     type: 'function',
     function: {
       ...tool,
       parameters: tool.inputSchema
     }
   }));
   ```

3. **Message Processing**:
   ```typescript
   const response = await ollama.chat({
     model: 'llama3.1',
     messages: messages,
     tools: availableTools,
     options: { temperature: 0 }
   });
   ```

4. **Tool Execution Handling**:
   ```typescript
   if (response.message.tool_calls?.length > 0) {
     for (const tool of response.message.tool_calls) {
       const funcResponse = await client.callTool({
         name: tool.function.name,
         arguments: tool.function.arguments
       });
       // Process tool response...
     }
   }
   ```

5. **Response Formatting**:
   ```typescript
   res.json({
     response: {
       conversation: finalResponse.message.content,
       thinking: null  // Ollama doesn't support thinking output
     }
   });
   ```

### Model Configuration
```typescript
const ollamaOptions = {
  temperature: 0  // Make responses more deterministic
};

const systemPrompts = [
  'only answer questions about a favorite color by using the response from the favorite_color_tool',
  'when asked for a favorite color if you have not called the favorite_color_tool, call it',
  'Never guess a favorite color',
  'Never mention a tool by name',
  'Do not mention tools or calling a tool',
  'Give short answers when possible'
];
```

## Error Handling

Both routes implement comprehensive error handling:

1. **Request Validation**:
   ```typescript
   try {
     // Validate request body
     const { message, history, blockedServers = [] } = req.body;
   } catch (error) {
     // Handle validation errors
   }
   ```

2. **Tool Execution Errors**:
   ```typescript
   try {
     const toolResult = await mcpService.callTool(/*...*/);
   } catch (error) {
     console.error('Tool execution error:', error);
     // Handle tool errors
   }
   ```

3. **Response Formatting Errors**:
   ```typescript
   if (response.content[0].type !== 'tool_use') {
     throw new Error('Expected tool_use response from Claude');
   }
   ```

## Logging

Comprehensive logging is implemented throughout the routes:

```typescript
// Request logging
loggingService.logRequest(req);

// Tool execution logging
console.log('\n=== TOOL EXECUTION DETAILS ===');
console.log(`Tool Selected: ${content.name}`);

// Response logging
console.log('\n=== FORMATTED RESPONSE ===');
console.log('Tool Response:', JSON.stringify(toolResponse, null, 2));
```

## Best Practices

1. **Service Access**:
   - Use consistent service initialization patterns
   - Consider moving all services to application-level initialization
   - Document service dependencies clearly

2. **Error Handling**:
   - Implement comprehensive error handling
   - Log errors with context
   - Return appropriate HTTP status codes

3. **Response Formatting**:
   - Use consistent response formats
   - Validate responses before sending
   - Handle special cases (bibliography, binary output)

4. **Logging**:
   - Log all significant operations
   - Include relevant context in logs
   - Use appropriate log levels

## Future Improvements

1. **Service Initialization**:
   - Standardize service initialization pattern
   - Implement proper dependency injection
   - Create service factory/container

2. **Error Handling**:
   - Create custom error types
   - Implement error recovery strategies
   - Add error reporting

3. **Documentation**:
   - Add OpenAPI/Swagger documentation
   - Document all response types
   - Add example requests/responses

4. **Testing**:
   - Add unit tests for routes
   - Add integration tests
   - Add load testing