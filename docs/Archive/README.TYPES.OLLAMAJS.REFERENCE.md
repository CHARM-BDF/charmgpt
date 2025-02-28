# Ollama Types Reference Guide

## Directory Information
- **Reference Guide Location**: `/docs/OLLAMA.TYPES.REFERENCE.md`
- **Source Type Definitions**: `/node_modules/ollama/src/interfaces.ts`
- **Package Entry Point**: `/node_modules/ollama/src/index.ts`

## Source Code Quick Access
To view original type definitions:
```bash
# View interfaces
cat node_modules/ollama/src/interfaces.ts

# View main exports
cat node_modules/ollama/src/index.ts
```

## Quick Reference for Common Types

### Basic Message Structure
```typescript
interface Message {
  role: string;        // e.g., "system", "user", "assistant"
  content: string;     // The actual message content
  images?: Uint8Array[] | string[]; // Optional: Base64 encoded images or image paths
  tool_calls?: ToolCall[]; // Optional: Tool/function calls
}
```

### Chat Request Structure
```typescript
interface ChatRequest {
  model: string;      // Name of the model to use
  messages?: Message[]; // Array of chat messages
  stream?: boolean;   // Whether to stream the response
  format?: string | object; // Response format
  keep_alive?: string | number; // Duration to keep model loaded
  tools?: Tool[];     // Available tools/functions
  options?: Partial<Options>; // Optional runtime settings
}
```

### Generation Request Structure
```typescript
interface GenerateRequest {
  model: string;      // Name of the model to use
  prompt: string;     // Input prompt
  system?: string;    // System prompt
  template?: string;  // Custom prompt template
  context?: number[]; // Previous context
  stream?: boolean;   // Whether to stream the response
  raw?: boolean;      // Raw mode toggle
  format?: string | object; // Response format
  images?: Uint8Array[] | string[]; // Images for multimodal models
  options?: Partial<Options>; // Optional runtime settings
}
```

## Common Runtime Options
```typescript
interface Options {
  // Model Loading Options
  numa: boolean;
  num_ctx: number;
  num_batch: number;
  num_gpu: number;
  main_gpu: number;
  low_vram: boolean;
  f16_kv: boolean;
  
  // Generation Parameters
  seed: number;
  num_predict: number;
  top_k: number;
  top_p: number;
  temperature: number;
  repeat_penalty: number;
  presence_penalty: number;
  frequency_penalty: number;
  
  // Advanced Options
  stop: string[];     // Stop sequences
  tfs_z: number;      // Tail free sampling
  typical_p: number;  // Typical probability
  mirostat: number;   // Mirostat sampling version
  mirostat_tau: number;
  mirostat_eta: number;
}
```

## Response Types

### Chat Response
```typescript
interface ChatResponse {
  model: string;
  created_at: Date;
  message: Message;
  done: boolean;
  done_reason: string;
  total_duration: number;
  load_duration: number;
  prompt_eval_count: number;
  prompt_eval_duration: number;
  eval_count: number;
  eval_duration: number;
}
```

### Generation Response
```typescript
interface GenerateResponse {
  model: string;
  created_at: Date;
  response: string;
  done: boolean;
  done_reason: string;
  context: number[];
  total_duration: number;
  load_duration: number;
  prompt_eval_count: number;
  prompt_eval_duration: number;
  eval_count: number;
  eval_duration: number;
}
```

## Tool/Function Calling Types

### Tool Definition
```typescript
interface Tool {
  type: string;
  function: {
    name: string;
    description: string;
    parameters: {
      type: string;
      required: string[];
      properties: {
        [key: string]: {
          type: string;
          description: string;
          enum?: string[];
        };
      };
    };
  };
}
```

### Tool Call
```typescript
interface ToolCall {
  function: {
    name: string;
    arguments: {
      [key: string]: any;
    };
  };
}
```

## Model Management Types

### Model Information
```typescript
interface ModelResponse {
  name: string;
  modified_at: Date;
  model: string;
  size: number;
  digest: string;
  details: ModelDetails;
  expires_at: Date;
  size_vram: number;
}

interface ModelDetails {
  parent_model: string;
  format: string;
  family: string;
  families: string[];
  parameter_size: string;
  quantization_level: string;
}
```

## Common Type Issues and Solutions

### 1. Message Array Type
When creating an array of messages:
```typescript
const messages: Message[] = [
  {
    role: "system",
    content: "You are a helpful assistant"
  },
  {
    role: "user",
    content: "Hello!"
  }
];
```

### 2. Options Type
When specifying partial options:
```typescript
const options: Partial<Options> = {
  temperature: 0.7,
  top_p: 0.9,
  stop: ["\n", "END"]
};
```

### 3. Tool Definition
When defining tools:
```typescript
const tools: Tool[] = [
  {
    type: "function",
    function: {
      name: "get_weather",
      description: "Get the weather for a location",
      parameters: {
        type: "object",
        required: ["location"],
        properties: {
          location: {
            type: "string",
            description: "The city and state"
          }
        }
      }
    }
  }
];
```

## Type Import Guide

To use these types in your TypeScript code:

```typescript
import type {
  Message,
  ChatRequest,
  GenerateRequest,
  Options,
  Tool,
  ToolCall,
  ChatResponse,
  GenerateResponse,
  ModelResponse
} from 'ollama';
```

## Common Type Assertions

When you need to assert types:

```typescript
// Asserting a chat request
const request = {
  model: "llama2",
  messages: messages
} as ChatRequest;

// Asserting a response type
const response = await ollama.chat(request) as ChatResponse;
```

## Type Checking Best Practices

1. Always specify the complete type for request objects
2. Use `Partial<Options>` when providing partial options
3. For streaming responses, use the appropriate stream type
4. When working with tools, always provide complete tool definitions
5. Use proper date types for timestamp fields
6. Handle nullable fields appropriately

## Troubleshooting Type Errors

If you encounter type errors:

1. Check that all required fields are present
2. Verify that field types match the interfaces
3. Ensure arrays are properly typed
4. Confirm that optional fields are marked with `?`
5. Verify that date fields are proper Date objects
6. Check that tool definitions match the Tool interface exactly 