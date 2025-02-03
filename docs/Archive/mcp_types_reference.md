# MCP Types Reference

## SDK Types
Imported from `@modelcontextprotocol/sdk/types.js`:

```typescript
// Core Schema Types
ListToolsResultSchema
CallToolResultSchema
ToolSchema
ResultSchema
TextContentSchema
ImageContentSchema
EmbeddedResourceSchema
```

## Server Configuration Types

```typescript
interface MCPServerConfig {
  command: string;
  args: string[];
  env?: Record<string, string>;
}

interface MCPServersConfig {
  mcpServers: Record<string, MCPServerConfig>;
}
```

## Tool Types

### Server Tool Definition
```typescript
interface ServerTool {
  name: string;
  description?: string;
  inputSchema?: {
    type: string;
    properties?: Record<string, unknown>;
    required?: string[];
  };
}
```

### Anthropic Tool Format
```typescript
interface AnthropicTool {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}
```

## Response Types

### Tool Response
```typescript
interface ToolCallResponse {
  result: any;
  content?: Array<{type: string; text?: string}>;
  bibliography?: any;
}

interface ToolListResponse {
  tools: Array<{
    name: string;
    description?: string;
    inputSchema: {
      type: string;
      properties?: Record<string, unknown>;
      required?: string[];
    };
  }>;
}
```

### Content Types
```typescript
type ToolContent = {
  type: 'text';
  text: string;
} | {
  type: 'image';
  data: string;
  mimeType: string;
} | {
  type: 'resource';
  resource: any;  // Can be made more specific based on resource type
};

type TextContent = {
  type: 'text';
  text: string;
};
```

## Server Status Types
```typescript
interface ServerStatus {
  name: string;
  isRunning: boolean;
  tools?: ServerTool[];
}
```

## Message Types

### Chat Message
```typescript
interface ChatMessage {
  role: 'user' | 'assistant';
  content: string | Array<{ type: string; text: string }>;
}
```

### Formatter Types
```typescript
interface FormatterInput {
  thinking?: string;
  conversation: Array<{
    type: 'text' | 'artifact';
    content?: string;
    artifact?: {
      type: string;
      id: string;
      title: string;
      content: string;
      language?: string;
    };
  }>;
}
```

### XML Response Type
```typescript
interface XMLResponse {
  response: {
    thinking?: string[];
    conversation: string[];
    artifact?: Array<{
      $: {
        type: string;
        id: string;
        title: string;
      };
      _: string;
    }>;
  };
}
```

## Notes

1. **SDK Schema Usage**
   - The SDK provides Zod schemas for validation
   - Use `z.infer<typeof SchemaName>` to get TypeScript types from schemas
   - Example: `z.infer<typeof TextContentSchema>` for text content type

2. **Type Conversions**
   - Server tools → Anthropic tools (requires name formatting)
   - Chat messages → Anthropic messages
   - Tool responses → Formatted conversation messages

3. **Common Patterns**
   - Use of Record<string, unknown> for flexible object properties
   - Optional chaining for nullable fields
   - Union types for different content types
   - Array types for collections of tools and messages

4. **Type Safety Considerations**
   - Always validate tool response structure
   - Check for optional fields before access
   - Use type guards for union types
   - Maintain proper error handling with types

5. **Bibliography Handling**
   - Bibliography data is attached to messages
   - Requires special handling in formatters
   - Consider type safety when accessing bibliography data 