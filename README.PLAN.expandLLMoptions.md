# MCP Server: Plan for Expanding LLM Options

## Current Progress (2024-09-19)

We have successfully implemented the following components:

1. ✅ **LLM Provider Support**:
   - Added OpenAI and Gemini providers alongside Claude
   - Implemented provider-specific query methods
   - Updated all type definitions to support multiple providers

2. ✅ **Tool Calling Integration**:
   - Created adapter classes for different provider tool calling formats
   - Documented the exact format differences between providers
   - Implemented tests to verify tool calling works with all providers

3. ✅ **UI Updates**:
   - Enhanced ModelSelector component to support all providers
   - Created reusable components for better maintainability
   - Added model logos for visual identification

4. ✅ **Backend Integration**:
   - Updated chat route to accept provider selection
   - Connected UI model selection to backend provider switching
   - Created factory methods for getting appropriate adapters

The remaining work focuses on creating a unified ChatService that uses the appropriate adapters for each provider and handles the sequential thinking process in a provider-agnostic way.

## Overview
This document outlines a comprehensive plan for expanding the MCP Server to support multiple Large Language Model (LLM) providers, including OpenAI and Google Gemini alongside the currently implemented Claude (Anthropic) and Ollama models. The implementation will maintain the existing architecture while creating a more modular approach to handle different LLM providers.

## Current Architecture Analysis

The codebase already has a foundation for supporting multiple LLM providers:

1. **Frontend Model Selection**:
   - `ModelSelector` component exists in the UI
   - `modelStore.ts` maintains state for model selection (currently supports 'claude' and 'ollama')
   - `chatStore.ts` uses the selected model to determine which endpoint to use

2. **Backend LLM Services**:
   - `LLMService` class provides a unified interface for LLM interactions
   - Provider-based architecture with `AnthropicProvider` already implemented
   - Type definitions support adding new providers
   - Backend routes access LLM service via `req.app.locals.llmService`

3. **Current Chat Implementation**:
   - `chat.ts` route directly uses Anthropic's client
   - Non-modularized logic for handling chat requests
   - Sequential thinking process and tool calling are implemented specifically for Claude

## Implementation Progress

### Completed Steps
1. ✅ Updated `modelStore.ts` to support additional LLM types:
   - Added 'openai' and 'gemini' to the `ModelType` definition
   - Ensured type safety with explicit type casting

2. ✅ Updated LLM service types in `types.ts`:
   - Added 'openai', 'gemini', and 'ollama' to the provider options
   - Maintained compatibility with existing code

3. ✅ Created provider implementations:
   - Created `OpenAIProvider` implementing the LLMProvider interface
   - Created `GeminiProvider` implementing the LLMProvider interface
   - Both support standard options like model, temperature, and maxTokens

4. ✅ Updated LLM service in `index.ts` for dynamic provider switching:
   - Added `initializeProvider()` method for code reuse
   - Implemented `setProvider()` method to change providers at runtime
   - Added `getProvider()` method to check current provider
   - Fixed TypeScript error with definite assignment assertion

5. ✅ Created test scripts to verify implementations:
   - Tested basic queries for all three providers
   - Tested tool calling functionality for all three providers
   - Documented differences in tool calling implementations

6. ✅ Created tool call adapter classes:
   - Created base `ToolCallAdapter` interface
   - Implemented provider-specific adapters for Claude, OpenAI, and Gemini
   - Created a factory to get the appropriate adapter for each provider

7. ✅ Updated ModelSelector component:
   - Added support for all provider types
   - Created reusable ModelButton component
   - Implemented data-driven approach for maintainability

8. ✅ Updated chat route:
   - Added support for modelProvider parameter
   - Added code to dynamically switch providers based on request

9. ✅ Created script for downloading provider logos

## Tool Calling Format Analysis

Each LLM provider has a different format for defining tools, receiving tool calls, and sending tool results. This section documents these differences based on our tests.

### Claude (Anthropic)

#### Tool Definition Format
Claude expects tools as an array of objects with the format:
```json
{
  "name": "calculator",
  "description": "A basic calculator that can perform arithmetic operations",
  "input_schema": {
    "type": "object",
    "properties": {
      "operation": {
        "type": "string",
        "enum": ["add", "subtract", "multiply", "divide"],
        "description": "The arithmetic operation to perform"
      },
      "a": {
        "type": "number",
        "description": "The first number"
      },
      "b": {
        "type": "number",
        "description": "The second number"
      }
    },
    "required": ["operation", "a", "b"]
  }
}
```

Key differences:
- Uses `input_schema` (not `parameters`) for schema definition
- Accepts standard JSONSchema format within `input_schema`

#### Tool Response Format
Claude returns tool calls in the `content` array of the response with type 'tool_use':
```json
{
  "content": [
    {
      "type": "text",
      "text": "I'll help you multiply 24 by 15 using the calculator function."
    },
    {
      "type": "tool_use",
      "id": "toolu_018hPsBJfHvf9dXnyCLdQ83s",
      "name": "calculator",
      "input": {
        "operation": "multiply",
        "a": 24,
        "b": 15
      }
    }
  ]
}
```

#### Tool Result Format
Tool results must be sent back to Claude in a specific format:
```json
{
  "role": "user",
  "content": [
    {
      "type": "tool_result",
      "tool_use_id": "toolu_018hPsBJfHvf9dXnyCLdQ83s",
      "content": "360"
    }
  ]
}
```

Key details:
- Tool results are sent as user messages with `type: 'tool_result'`
- Must include `tool_use_id` matching the original tool call ID
- Content is provided as a string

### OpenAI

#### Tool Definition Format
OpenAI expects tools as an array of objects with the format:
```json
{
  "type": "function",
  "function": {
    "name": "calculator",
    "description": "A basic calculator that can perform arithmetic operations",
    "parameters": {
      "type": "object",
      "properties": {
        "operation": {
          "type": "string",
          "enum": ["add", "subtract", "multiply", "divide"],
          "description": "The arithmetic operation to perform"
        },
        "a": {
          "type": "number",
          "description": "The first number"
        },
        "b": {
          "type": "number",
          "description": "The second number"
        }
      },
      "required": ["operation", "a", "b"]
    }
  }
}
```

Key differences:
- Requires `type: "function"` at the top level
- Tool details are nested under the `function` property
- Uses `parameters` for schema definition

#### Tool Response Format
OpenAI returns tool calls in the message under `tool_calls`:
```json
{
  "role": "assistant",
  "content": null,
  "tool_calls": [
    {
      "id": "call_yW3WbEvOQwcrgzeVUi0oUvXh",
      "type": "function",
      "function": {
        "name": "calculator",
        "arguments": "{\"operation\":\"multiply\",\"a\":24,\"b\":15}"
      }
    }
  ]
}
```

Key differences:
- Arguments are provided as a JSON string that needs to be parsed
- The `content` field may be null when tool_calls are present

#### Tool Result Format
Tool results must be sent back to OpenAI in a specific format:
```json
{
  "role": "tool",
  "tool_call_id": "call_yW3WbEvOQwcrgzeVUi0oUvXh",
  "content": "360"
}
```

Key details:
- Uses a unique `role: "tool"` (not user or assistant)
- Requires `tool_call_id` matching the original tool call ID
- Does not need the tool name in the response

### Google Gemini

#### Tool Definition Format
Gemini expects tools defined under a special `functionDeclarations` array:
```json
{
  "tools": [
    {
      "functionDeclarations": [
        {
          "name": "calculator",
          "description": "A basic calculator that can perform arithmetic operations",
          "parameters": {
            "type": "object",
            "properties": {
              "operation": {
                "type": "string",
                "enum": ["add", "subtract", "multiply", "divide"],
                "description": "The arithmetic operation to perform"
              },
              "a": {
                "type": "number",
                "description": "The first number"
              },
              "b": {
                "type": "number",
                "description": "The second number"
              }
            },
            "required": ["operation", "a", "b"]
          }
        }
      ]
    }
  ]
}
```

Key differences:
- Tools are defined under a nested `functionDeclarations` array
- Similar JSONSchema format for parameters as OpenAI

#### Tool Response Format
Gemini tool calls are accessed via a special method `functionCalls()`:
```json
[
  {
    "name": "calculator",
    "args": {
      "a": 24,
      "b": 15,
      "operation": "multiply"
    }
  }
]
```

Key differences:
- Tool arguments are provided in a structured `args` object, not a string
- Requires calling a special method to access function calls

#### Tool Result Format
Tool results are sent to Gemini in a `functionResponse` object:
```json
{
  "functionResponse": {
    "name": "calculator",
    "response": { "result": 360 }
  }
}
```

Key details:
- Uses a special `functionResponse` object format
- Requires the function name
- Response can be structured as an object

## Remaining Implementation Steps

### Chat Service Integration

The next step is to properly integrate our tool call adapters with the chat service:

1. Create a `ChatService` class that uses the appropriate adapter based on the model provider
2. Modify the chat route to use this service instead of direct Anthropic client calls
3. Implement the sequential thinking process for all providers
4. Test the full flow with all providers

## Detailed Next Steps

To complete the implementation and ensure that the UI model selection fully switches the backend provider, we need to:

### Phase 1: Create ChatService Class

1. Create a new file `src/server/services/chat/index.ts` with the following components:
   - Define a `ChatService` interface with methods for handling the complete chat flow
   - Implement a provider-agnostic chat implementation that uses the appropriate adapter

2. The ChatService should include these key methods:
   - `sendMessage(message, history, options)` - Send a message to the LLM
   - `processToolCalls(response)` - Extract and handle tool calls from LLM responses
   - `sendToolResults(toolResults)` - Send tool results back to the LLM
   - `formatFinalResponse(response)` - Create a standardized response format

3. Use the adapter pattern to handle provider-specific differences:
   - The service should use the appropriate adapter from our existing adapters
   - Tool definitions, calls, and results should be converted to the correct format

### Phase 2: Refactor Chat Route

1. Update the chat route to use the new ChatService:
   - Replace direct Anthropic client usage with ChatService
   - Keep the streaming response capabilities
   - Maintain status updates for UI feedback

2. Move the sequential thinking logic into the ChatService:
   - Create a provider-agnostic implementation
   - Support different approaches for different providers
   - Maintain the same behavior and capabilities

3. Ensure artifact processing works consistently:
   - Update artifact creation to work with all providers
   - Maintain compatibility with the existing UI expectations

### Phase 3: Testing and Deployment

1. Create test cases for all providers:
   - Test basic chat functionality
   - Test tool calling capabilities
   - Test sequential thinking functionality
   - Test artifact generation

2. Add graceful error handling:
   - Handle provider-specific errors
   - Provide useful error messages
   - Add fallback mechanisms where appropriate

3. Update documentation:
   - Document the new ChatService API
   - Provide examples of using different providers
   - Update environment variable requirements

## ChatService Technical Specification

The `ChatService` class will be the central component for managing LLM interactions. Here's a detailed specification for its implementation:

### Interface Definition

```typescript
interface ChatService {
  // Core methods
  sendMessage(
    message: string, 
    history: ChatMessage[], 
    options: ChatOptions
  ): Promise<StreamingResponse>;
  
  // Tool-related methods
  getAvailableTools(blockedServers?: string[]): Promise<MCPTool[]>;
  processToolCalls(response: any): ToolCall[];
  executeToolCall(toolCall: ToolCall): Promise<ToolResult>;
  sendToolResults(toolResults: ToolResult[]): Promise<any>;
  
  // Provider management
  setProvider(provider: ModelType): void;
  getProvider(): ModelType;
  
  // Sequential thinking
  runSequentialThinking(
    message: string, 
    history: ChatMessage[]
  ): Promise<ChatMessage[]>;
}

interface ChatOptions {
  modelProvider: ModelType;
  temperature?: number;
  maxTokens?: number;
  streamHandler?: (chunk: any) => void;
  statusHandler?: (status: string) => void;
  pinnedGraph?: any;
}

interface StreamingResponse {
  stream: ReadableStream;
  cancel: () => void;
}
```

### Implementation Strategy

The ChatService implementation will use the Adapter and Strategy patterns:

1. **Provider Strategy**:
   - Create a base `ProviderStrategy` class
   - Implement provider-specific strategies (Claude, OpenAI, Gemini)
   - Each strategy handles its unique API format

2. **Sequential Thinking**:
   - Create a `SequentialThinkingProcessor` that works with all providers
   - Handle differences in how each provider implements tool calls
   - Maintain the same behavior and capabilities

3. **Request/Response Mapping**:
   - Convert between provider-specific formats using our adapters
   - Normalize all responses to a consistent format for the UI

### Example Usage

Here's how the chat route would use the ChatService:

```typescript
router.post('/', async (req, res) => {
  // Set up streaming response headers
  setupStreamingHeaders(res);
  
  // Get the selected model provider
  const { message, history, modelProvider = 'claude' } = req.body;
  
  // Get the chat service and set the provider
  const chatService = req.app.locals.chatService as ChatService;
  chatService.setProvider(modelProvider);
  
  try {
    // Get available tools
    const tools = await chatService.getAvailableTools(req.body.blockedServers);
    
    // Run sequential thinking if needed
    const processedHistory = await chatService.runSequentialThinking(
      message, 
      history
    );
    
    // Send the final message and stream the response
    const response = await chatService.sendMessage(
      message, 
      processedHistory, 
      {
        modelProvider,
        temperature: 0.2,
        streamHandler: (chunk) => {
          res.write(JSON.stringify(chunk) + '\n');
        },
        statusHandler: (status) => {
          res.write(JSON.stringify({ 
            type: 'status', 
            message: status 
          }) + '\n');
        },
        pinnedGraph: req.body.pinnedGraph
      }
    );
    
    // End the response when complete
    res.end();
  } catch (error) {
    // Handle errors
    res.write(JSON.stringify({ 
      type: 'error', 
      message: error.message 
    }) + '\n');
    res.end();
  }
});
```

## Benefits of This Approach

1. **Unified Interface**: Maintains a consistent interface for the client, regardless of which LLM provider is used
2. **Provider Flexibility**: Allows for easy switching between providers without changing application logic
3. **Extensibility**: Makes it simple to add more providers in the future
4. **Minimized Changes**: Reuses much of the existing architecture, minimizing changes to the core application

## Conclusion

This implementation plan follows a modular, service-oriented approach to expand the MCP Server's capabilities to support multiple LLM providers. By focusing on:

1. **Abstraction**: Separating the interface from implementation details
2. **Adapters**: Using the adapter pattern to handle model-specific quirks
3. **Dependency Injection**: Making services pluggable and testable
4. **Frontend Integration**: Providing a seamless user experience for model selection

The implementation will allow users to switch between different LLM providers while maintaining all the existing functionality, including tool usage, sequential thinking, and artifact generation.

### Implementation Strategy

For the smoothest implementation, the steps should be executed in the following order:

1. First, implement the backend provider classes (Steps 2-3)
2. Then, create the model-agnostic chat handling (Step 4)
3. Next, update the chat route to use the new services (Step 5)
4. Finally, enhance the UI to support model selection (Steps 1 and 6)

This order minimizes risk by first ensuring the backend can support the new models before exposing the functionality to the frontend.

### Future Extensibility

This architecture makes it easy to add support for additional LLM providers in the future:

1. Create a new provider implementation class
2. Add a new adapter for model-specific processing
3. Update the model selector UI
4. Add any necessary environment variables

No changes to the core architecture or chat flow logic would be needed, making the system highly extensible.

### Dependencies Required

The implementation will require adding the following NPM packages:

- `openai` - For OpenAI API integration
- `@google/generative-ai` - For Google Gemini API integration

In addition, the following environment variables need to be added:

- `OPENAI_API_KEY` - API key for accessing OpenAI services
- `GEMINI_API_KEY` - API key for accessing Google Gemini services 

## Implementation Challenges and Solutions

In implementing the unified ChatService, we've identified several challenges that need to be addressed:

### 1. Different Tool Calling Protocols

Each provider has a significantly different approach to tool calling:

| Provider | Tool Definition | Tool Calls | Tool Results |
|----------|----------------|------------|--------------|
| Claude   | `input_schema` | `tool_use` content blocks | `tool_result` in user message |
| OpenAI   | `function` with `parameters` | `tool_calls` array | `role: "tool"` messages |
| Gemini   | `functionDeclarations` | `functionCalls()` method | `functionResponse` object |

**Solution:** Our adapter classes handle these differences by providing a unified API that hides the complexities of each provider's format.

### 2. Sequential Thinking Implementation

Claude's sequential thinking process is currently implemented directly in the chat route, which makes it Claude-specific:

**Solution:** Abstract the sequential thinking process into a provider-agnostic interface with provider-specific implementations. This allows us to maintain the same behavior across all providers.

### 3. Streaming Response Handling

Different providers have different approaches to streaming:

- Claude: Content blocks streamed over time
- OpenAI: Delta messages with incremental content
- Gemini: Chunked responses through a streaming method

**Solution:** Create a unified streaming interface that normalizes these differences and provides a consistent experience.

### 4. Error Handling and Rate Limiting

Each provider has different error formats and rate limiting behaviors:

**Solution:** Implement provider-specific error handling that translates provider errors into a standard format, and add retry logic with exponential backoff for rate limit errors.

### 5. Artifact Processing and Compatibility

The MCP system has a sophisticated artifact processing system that must work consistently across providers:

- **Artifact Sources:**
  - Direct artifacts from MCP tool responses
  - Knowledge graphs built during conversations
  - Bibliography data from research tools
  - Binary outputs requiring special processing

- **Artifact Types:**
  - `text/markdown` - Markdown content
  - `application/vnd.ant.code` - Code snippets with syntax highlighting
  - `image/svg+xml` - SVG images
  - `application/vnd.mermaid` - Mermaid diagrams
  - `text/html` - HTML content
  - `application/vnd.react` - React components
  - `application/vnd.bibliography` - Bibliography entries
  - `application/vnd.knowledge-graph` - Knowledge graph data

- **Artifact Structure:**
  - `id` - Unique identifier
  - `type` - MIME type
  - `title` - Human-readable title
  - `content` - The actual content (text, JSON, etc.)
  - `position` - Display order in the UI
  - `language` - (optional) For code artifacts

**Solution:** Ensure the ChatService maintains a consistent artifact collection and processing pipeline regardless of the LLM provider being used. The `enhanceResponseWithArtifacts` function must be provider-agnostic to work with all response formats.

## ChatService Implementation Details for Artifact Processing

The ChatService will need to maintain the following artifact processing steps that currently happen in the chat route:

1. **Artifact Collection**: During the conversation, various types of artifacts are collected from different sources:
   - Direct artifacts from MCP tool responses
   - Knowledge graphs built during the conversation
   - Bibliography entries from research tools
   - Binary outputs (images, etc.) with special processing

2. **Unified Processing Pipeline**: Regardless of which provider is used, the ChatService will:
   - Collect artifacts in a standard format
   - Process binary outputs using `artifactService.processBinaryOutput()`
   - Create artifact buttons for the UI when needed
   - Use the MessageService's `enhanceResponseWithArtifacts()` for final formatting

3. **Response Enhancement**: The ChatService will maintain the existing `enhanceResponseWithArtifacts` functionality, which:
   - Generates unique IDs for each artifact
   - Formats content appropriately based on type
   - Creates UI buttons for artifact access
   - Preserves metadata and additional properties
   - Handles content formatting for different types (JSON, images, text)

4. **Provider-Specific Adaptations**: Each provider's response will be adapted to the standard format:
   - Claude: Extract artifacts from content blocks
   - OpenAI: Parse JSON response and extract artifact definitions
   - Gemini: Handle function response format and extract artifacts

This will ensure that regardless of which LLM provider is selected in the UI, all artifact-related functionality will continue to work consistently, maintaining compatibility with the existing UI and user experience.

## Technical Specification: ChatService Integration with LLMService

### Class Structure and Dependencies

```typescript
/**
 * ChatService manages the complete chat flow with LLMs, including
 * sequential thinking, tool calling, and artifact processing.
 */
export class ChatService {
  private llmService: LLMService;
  private messageService: MessageService;
  private artifactService: ArtifactService;
  private mcpService: MCPService;
  
  constructor(
    llmService: LLMService,
    messageService: MessageService,
    artifactService: ArtifactService,
    mcpService: MCPService
  ) {
    this.llmService = llmService;
    this.messageService = messageService;
    this.artifactService = artifactService;
    this.mcpService = mcpService;
  }
  
  // Methods will be implemented as described below
}
```

### Key Method: processChat

```typescript
/**
 * Process a complete chat from start to finish
 * @param message The user message
 * @param history Previous message history
 * @param options Chat processing options
 * @param statusHandler Optional callback for status updates
 * @returns A stream of response chunks
 */
async processChat(
  message: string,
  history: ChatMessage[],
  options: {
    modelProvider: ModelType;
    blockedServers?: string[];
    pinnedGraph?: any;
    temperature?: number;
    maxTokens?: number;
  },
  statusHandler?: (status: string) => void
): Promise<ReadableStream> {
  // Set the LLM provider
  this.llmService.setProvider({
    provider: options.modelProvider as any,
    temperature: options.temperature,
    maxTokens: options.maxTokens
  });
  
  // Get the appropriate tool adapter
  const toolAdapter = getToolCallAdapter(options.modelProvider);
  
  // 1. Convert history to provider-specific format if needed
  const formattedHistory = this.formatMessageHistory(history, options.modelProvider);
  
  // 2. Get available tools from MCP service
  const mcpTools = await this.mcpService.getAllAvailableTools(options.blockedServers);
  
  // 3. Convert tools to provider-specific format
  const formattedTools = toolAdapter.convertToolDefinitions(mcpTools);
  
  // 4. Run sequential thinking (provider-specific implementation)
  const processedMessages = await this.runSequentialThinking(
    message,
    formattedHistory,
    formattedTools,
    options,
    statusHandler
  );
  
  // 5. Generate final response
  const response = await this.generateFinalResponse(
    processedMessages,
    formattedTools,
    options,
    statusHandler
  );
  
  // 6. Process artifacts and stream the final response
  return this.streamProcessedResponse(response, processedMessages, statusHandler);
}
```

### Integration with LLMService

The ChatService will use the existing LLMService for direct interactions with the LLM providers. The main difference is that ChatService will handle:

1. **Provider Switching**: Setting the appropriate provider on the LLMService
2. **Tool Format Conversion**: Using the adapters to convert tool definitions and calls
3. **Sequential Thinking**: Managing the sequential thinking workflow
4. **Artifact Collection and Processing**: Handling artifacts from all sources
5. **Response Formatting**: Ensuring consistent response format for the UI

### Provider-Specific Sequential Thinking

```typescript
/**
 * Run the sequential thinking process for a message
 * @param message User message
 * @param history Message history
 * @param tools Available tools
 * @param options Chat options
 * @param statusHandler Status update handler
 * @returns Processed messages with thinking steps
 */
private async runSequentialThinking(
  message: string,
  history: any[],
  tools: any[],
  options: any,
  statusHandler?: (status: string) => void
): Promise<any[]> {
  // Clone message history to avoid modifying the original
  const workingMessages = [...history, { role: 'user', content: message }];
  let isSequentialThinkingComplete = false;
  
  // Get the appropriate tool adapter
  const toolAdapter = getToolCallAdapter(options.modelProvider);
  
  // Sequential thinking loop
  while (!isSequentialThinkingComplete) {
    statusHandler?.('Analyzing request and planning response...');
    
    // Provider-specific call implementation
    const toolResponse = await this.callProviderWithTools(
      workingMessages,
      tools,
      options
    );
    
    // Extract tool calls using the appropriate adapter
    const toolCalls = toolAdapter.extractToolCalls(toolResponse);
    
    if (toolCalls.length > 0) {
      statusHandler?.(`Executing ${toolCalls.length} tool(s)...`);
      
      // Process each tool call
      for (const toolCall of toolCalls) {
        // Execute the tool and get results
        const toolResult = await this.executeToolCall(toolCall, options);
        
        // Format tool results for the provider
        const formattedResults = toolAdapter.formatToolResults([toolResult]);
        
        // Add assistant message (tool call)
        workingMessages.push({
          role: 'assistant',
          content: `Tool used: ${toolCall.name}\nArguments: ${JSON.stringify(toolCall.input)}`
        });
        
        // Add user message (tool result)
        workingMessages.push({
          role: 'user',
          content: typeof toolResult.content === 'string'
            ? toolResult.content
            : JSON.stringify(toolResult.content)
        });
        
        // Check if this was sequential thinking tool
        if (toolCall.name.includes('sequential-thinking')) {
          try {
            const result = typeof toolResult.content === 'string'
              ? JSON.parse(toolResult.content)
              : toolResult.content;
            isSequentialThinkingComplete = !result.nextThoughtNeeded;
          } catch (error) {
            console.error('Error parsing sequential thinking result:', error);
            isSequentialThinkingComplete = true;
          }
        }
      }
    } else {
      // No tools used, end the loop
      isSequentialThinkingComplete = true;
    }
  }
  
  return workingMessages;
}
```

## Roadmap for Implementation

### Week 1: Core ChatService

- Day 1-2: Create ChatService interface and base implementation
- Day 3-4: Implement provider-specific strategies
- Day 5: Add unit tests for core functionality

### Week 2: Sequential Thinking and Tool Calling

- Day 1-2: Abstract sequential thinking process
- Day 3-4: Implement tool calling for all providers
- Day 5: Add tests for sequential thinking and tool calling

### Week 3: Chat Route Integration

- Day 1-2: Refactor chat route to use ChatService
- Day 3: Implement streaming support
- Day 4-5: Test and debug the complete flow

### Week 4: UI Enhancements and Deployment

- Day 1-2: Add provider-specific UI elements
- Day 3: Implement frontend error handling
- Day 4-5: Final testing and deployment

## Conclusion

The implementation of a unified ChatService is a critical step in supporting multiple LLM providers in the MCP Server. By using the adapter pattern and carefully designing our abstraction layers, we can create a system that allows users to seamlessly switch between providers while maintaining all the existing functionality.

This approach not only makes the codebase more maintainable but also future-proofs it against new providers that may be added in the future. The modular design means that adding a new provider is as simple as implementing a new adapter and strategy, without having to modify the core chat flow logic. 