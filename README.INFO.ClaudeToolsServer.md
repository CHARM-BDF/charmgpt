# Claude/Anthropic Integration Overview

## Core Components and File Structure

### 1. Chat Service (`/src/server/services/chat/index.ts`)
The main service orchestrating chat interactions with Claude and other providers. This service:
- Manages chat sessions with Anthropic's content format
- Handles tool execution with Claude-specific adaptations
- Processes array-based content responses
- Manages artifacts with Claude's content structure

### 2. Adapter Layer (`/src/server/services/chat/adapters/`)
- **anthropic.ts**: Claude-specific adapter for tool calls and response handling
- **index.ts**: Barrel file exporting adapter factory and types
- **types.ts**: Type definitions including AnthropicTool interface

Key Difference from OpenAI:
```typescript
// Anthropic's content structure is array-based
interface AnthropicMessage {
  role: string;
  content: Array<{
    type: 'text' | 'image' | 'tool_call';
    text?: string;
    tool_call?: AnthropicToolCall;
  }>;
}
```

### 3. Formatter Layer (`/src/server/services/chat/formatters/`)
- **anthropic.ts**: Claude-specific response formatting
- **index.ts**: Barrel file for formatter exports
- **types.ts**: Formatter interface definitions

Anthropic-Specific Format:
```typescript
{
  role: 'assistant',
  content: [{ 
    type: 'text', 
    text: `Tool used: ${toolCall.name}\nArguments: ${JSON.stringify(toolCall.input)}` 
  }]
}
```

### 4. LLM Service (`/src/server/services/llm/`)
Base service with Anthropic-specific handling:
- Provider configuration for Claude models
- Message array handling
- Content type management

### 5. MCP Service (`/src/server/services/mcp/`)
Tool management service with Anthropic considerations:
- Tool registration with Claude format
- Tool execution with content array support
- Response processing for Claude's structure

## Claude Integration Flow

### 1. Initial Setup
```typescript
// Provider configuration in ChatService constructor
this.llmService.setProvider({
  provider: 'anthropic',
  temperature: options.temperature || 0.2,
  maxTokens: options.maxTokens || 4000
});
```

### 2. Message Processing
1. **Content Array Handling**
   ```typescript
   // Anthropic requires content as arrays
   const formattedMessage = {
     role: 'user',
     content: [{ 
       type: 'text', 
       text: message 
     }]
   };
   ```

2. **Tool Call Structure**
   ```typescript
   // Claude's tool call format
   {
     type: 'tool_call',
     tool_call: {
       name: toolName,
       parameters: toolParameters
     }
   }
   ```

### 3. Response Processing
1. **Raw Response Handling**
   - Processes Claude's array-based content structure
   - Extracts tool calls from content arrays
   - Handles multi-part responses

2. **Response Formatting**
   - Converts array-based content to standard format
   - Maintains content type information
   - Preserves tool call context

## Key Features

### 1. Content Type Management
- Array-based content handling
- Multiple content type support
- Tool call integration
- Content type preservation

### 2. Tool Management
- Claude-specific tool definitions
- Array-based tool responses
- Tool call extraction
- Parameter validation

### 3. Response Formatting
- Array content normalization
- Multi-part response handling
- Content type conversion
- Streaming support

### 4. State Management
- Content array tracking
- Tool state preservation
- Response aggregation
- Context maintenance

## Integration Points

### 1. External Services
- Claude API connection
- Content array processing
- Tool response handling
- Message formatting

### 2. Internal Components
- Message array handling
- Content type processing
- Tool execution
- State management

## Configuration Options

### 1. Provider Settings
```typescript
{
  provider: 'anthropic',
  temperature: number,
  maxTokens: number,
  messages: Array<{
    role: string,
    content: Array<ContentItem>
  }>
}
```

### 2. Tool Configuration
```typescript
// UPDATED: Correct format for tool definition
// input_schema is directly on the tool object, NOT wrapped in custom
{
  name: string,
  description: string,
  input_schema: {
    type: 'object',
    properties: Record<string, any>,
    required?: string[]
  }
}
```

## Best Practices

### 1. Content Handling
- Always use array-based content
- Validate content types
- Handle multi-part responses
- Preserve content structure

### 2. Tool Processing
- Maintain tool call context
- Validate parameters
- Handle array responses
- Track tool states

### 3. Response Formatting
- Normalize array content
- Process multi-part responses
- Handle content types
- Support streaming

### 4. Logging
- Log content arrays
- Track tool executions
- Monitor content types
- Debug tool calls

## Common Issues and Solutions

### 1. Content Array Issues
- Content type validation
- Array structure verification
- Multi-part handling
- Type conversion

### 2. Tool Call Handling
- Parameter validation using `input_schema`
- Response extraction
- Context preservation
- State management
- Proper tool choice specification using `type: "tool"`

### 3. Response Processing
- Array content normalization
- Type conversion
- Context maintenance
- Stream handling

## Future Improvements

### 1. Content Management
- Better array handling
- Type system improvements
- Content validation
- Structure verification

### 2. Tool Integration
- Enhanced parameter handling
- Better response processing
- Context preservation
- State tracking

### 3. Response Processing
- Improved array handling
- Better type conversion
- Enhanced streaming
- Content optimization

### 4. Type System
- Stronger content types
- Better tool definitions
- Enhanced validation
- Error refinement

## Key Differences from OpenAI

### 1. Content Structure
- Array-based vs object-based
- Multiple content types
- Tool call integration
- Response format

### 2. Tool Handling
- Parameter structure
- Response format
- Context preservation
- State management

### 3. Response Processing
- Content normalization
- Type conversion
- Stream handling
- Context maintenance

### 4. Type System
- Content type definitions
- Tool structures
- Response formats
- Validation approaches

## Detailed Implementation Differences

### 1. Message Structure
```typescript
// Claude's Required Format
{
  role: 'assistant',
  content: [{ 
    type: 'text', 
    text: message 
  }]
}

// OpenAI's Format
{
  role: 'assistant',
  content: message
}
```

### 2. Tool Result Format
```typescript
// Claude's Tool Result
{
  type: 'tool_result',
  tool_use_id: result.toolCallId,
  content: result.content
}

// OpenAI's Function Result
{
  tool_call_id: result.toolCallId,
  name: result.name,
  content: result.content
}
```

### 3. Streaming Implementation
Claude uses a more sophisticated streaming format with multiple event types:

1. **Event Flow**:
   ```typescript
   // Claude's Event Sequence
   event: message_start
   → event: content_block_start
   → event: content_block_delta
   → event: content_block_stop
   → event: message_delta
   → event: message_stop
   ```

2. **Event Types**:
   - `message_start`: Initial message object with empty content
   - `content_block_start`: Beginning of a content block
   - `content_block_delta`: Incremental content updates
   - `content_block_stop`: End of content block
   - `message_delta`: Top-level message changes
   - `message_stop`: Final event

3. **Content Block Structure**:
   ```typescript
   {
     type: "content_block_delta",
     index: number,
     delta: {
       type: "text_delta" | "input_json_delta",
       text?: string,
       partial_json?: string
     }
   }
   ```

### 4. Tool Execution Context
```typescript
// Claude's Tool Context
const assistantMessage = {
  role: 'assistant',
  content: [{ 
    type: 'text', 
    text: `Tool used: ${toolCall.name}\nArguments: ${JSON.stringify(toolCall.input)}` 
  }]
};

const userMessage = {
  role: 'user',
  content: [{ 
    type: 'text', 
    text: textContent 
  }]
};

// OpenAI's Tool Context
const assistantMessage = {
  role: 'assistant',
  content: `Tool used: ${toolCall.name}\nArguments: ${JSON.stringify(toolCall.input)}`
};

const userMessage = {
  role: 'user',
  content: textContent
};
```

### 5. Error Handling Differences
1. **Claude**:
   - Handles errors through event stream
   - Includes `ping` events for connection maintenance
   - Provides detailed error events with type information

2. **OpenAI**:
   - Uses HTTP status codes
   - Simpler error format
   - No connection maintenance events

### 6. Response Processing
1. **Claude**:
   - Processes array-based content
   - Handles multiple content types in single response
   - Maintains type information throughout

2. **OpenAI**:
   - Processes single content string
   - Simpler response structure
   - Type information in separate fields 

## Tool Specifications and Format

### 1. Key Requirements
- Tools must use `input_schema` directly on the tool object (NOT wrapped in custom)
- Tools should not be wrapped in a `type: "function"` object
- The model version should be `claude-3-5-sonnet-20241022`
- Tool choice must be specified as `{ type: "tool", name: "tool_name" }`

### 2. Correct Tool Definition Format
```typescript
// UPDATED: Verified correct format through testing
{
  name: string,
  description: string,
  input_schema: {
    type: 'object',
    properties: Record<string, any>,
    required?: string[]
  }
}
```

### 3. Tool Choice Format
```typescript
{
  type: 'tool',
  name: 'tool_name'
}
```

### 4. Example Tool Definition
```typescript
// UPDATED: Verified correct format through testing
{
  name: "calculator",
  description: "Perform basic arithmetic calculations",
  input_schema: {
    type: "object",
    properties: {
      operation: {
        type: "string",
        enum: ["add", "subtract", "multiply", "divide"]
      },
      numbers: {
        type: "array",
        items: { type: "number" }
      }
    },
    required: ["operation", "numbers"]
  }
}
```

### 5. Common Tool Format Issues
- ~~Missing `custom` wrapper around `input_schema`~~ - DO NOT use custom wrapper
- Incorrect placement of `input_schema`
- Using `parameters` instead of `input_schema`
- Missing required fields in schema
- Incorrect tool choice format

### 6. Implementation Files
The key files implementing Claude's tool format are:

1. **Chat Adapter**: `src/server/services/chat/adapters/anthropic.ts`
   - Handles converting MCP tools to Claude format
   - Extracts tool calls from responses
   - Formats tool results

2. **LLM Provider**: `src/server/services/llm/providers/anthropic.ts`
   - Makes direct API calls to Claude
   - Ensures correct tool format in requests
   - Processes Claude's responses

3. **Chat Route**: `src/server/routes/chat.ts`
   - Direct API integration example with Claude
   - Shows working tool format

4. **Test Script**: `src/server/services/chat/adapters/test-claude-tool-format.sh`
   - Tests different tool formats
   - Verifies correct implementation

### 7. Resolving Format Issues
If encountering "tools.0.custom.input_schema: Field required" error:
1. Ensure `input_schema` is directly on the tool object, not inside `custom`
2. Verify tool format matches the example format in section 4
3. Check both chat adapter and LLM provider for consistent format
4. Run test script to confirm working formats
