# MCP Server: Plan for Expanding LLM Options

## Current Progress (2024-09-19)

We have successfully implemented the following components:

1. ✅ **LLM Provider Support**:
   - Added OpenAI and Gemini providers alongside Claude
   - Implemented provider-specific query methods
   - Updated all type definitions to support multiple providers
   - Fixed model name conflicts when switching between providers

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

## Provider Implementation Details

This section outlines the implementation details for each LLM provider, including initialization, API client usage, and response handling.

### Anthropic (Claude) Provider Implementation

The Anthropic provider uses the official Anthropic SDK to interact with Claude models.

#### Initialization
```typescript
import { Anthropic } from '@anthropic-ai/sdk';
import { LLMProvider, LLMProviderOptions, LLMProviderResponse } from '../types';

export class AnthropicProvider implements LLMProvider {
  private client: Anthropic;
  private defaultModel: string;
  
  constructor(options: LLMProviderOptions = {}) {
    // Get API key from options or environment variables
    const apiKey = options.apiKey || process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('Anthropic API key is required. Set it in options or ANTHROPIC_API_KEY environment variable.');
    }
    
    // Initialize Anthropic client
    this.client = new Anthropic({ apiKey });
    // Set default model
    this.defaultModel = options.model || 'claude-3-5-sonnet-20241022';
    
    console.log(`AnthropicProvider: Initialized with model ${this.defaultModel}`);
  }
}
```

#### API Client Usage
```typescript
async query(prompt: string, options: LLMProviderOptions = {}): Promise<LLMProviderResponse> {
  // Get options with defaults
  const model = options.model || this.defaultModel;
  const temperature = options.temperature ?? 0.7;
  const maxTokens = options.maxTokens || 4000;
  const systemPrompt = options.systemPrompt || '';
  
  try {
    console.log(`AnthropicProvider: Sending query to ${model} (temp: ${temperature})`);
    
    // Make API request
    const response = await this.client.messages.create({
      model,
      max_tokens: maxTokens,
      temperature,
      system: systemPrompt,
      messages: [{ role: 'user', content: prompt }],
    });
    
    // Extract content from the response (handling different content block types)
    let content = '';
    if (response.content && response.content.length > 0) {
      const block = response.content[0];
      if (block.type === 'text') {
        content = block.text;
      } else if (block.type === 'tool_use') {
        // For tool_use blocks, return the input as JSON string
        content = JSON.stringify(block.input);
      } else {
        // Fallback for other content types
        content = JSON.stringify(block);
      }
    }
    
    // Format the response
    return {
      content,
      rawResponse: response,
      usage: {
        promptTokens: response.usage.input_tokens,
        completionTokens: response.usage.output_tokens,
        totalTokens: response.usage.input_tokens + response.usage.output_tokens
      }
    };
  } catch (error) {
    console.error('Anthropic query error:', error);
    throw new Error(`Anthropic query failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}
```

### OpenAI Provider Implementation

The OpenAI provider uses the official OpenAI Node.js SDK to interact with GPT models.

#### Initialization
```typescript
import OpenAI from 'openai';
import { LLMProvider, LLMProviderOptions, LLMProviderResponse } from '../types';

export class OpenAIProvider implements LLMProvider {
  private client: OpenAI;
  private defaultModel: string;
  
  constructor(options: LLMProviderOptions = {}) {
    // Initialize OpenAI client
    const apiKey = options.apiKey || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OpenAI API key is required. Set it in options or OPENAI_API_KEY environment variable.');
    }
    
    this.client = new OpenAI({ apiKey });
    // Set default model (GPT-4 Turbo is a good default)
    this.defaultModel = options.model || 'gpt-4-turbo-preview';
    
    console.log(`OpenAIProvider: Initialized with model ${this.defaultModel}`);
  }
}
```

#### API Client Usage
```typescript
async query(prompt: string, options: LLMProviderOptions = {}): Promise<LLMProviderResponse> {
  // Get options with defaults
  const model = options.model || this.defaultModel;
  const temperature = options.temperature ?? 0.7;
  const maxTokens = options.maxTokens || 4000;
  const systemPrompt = options.systemPrompt || '';
  
  try {
    console.log(`OpenAIProvider: Sending query to ${model} (temp: ${temperature})`);
    
    // Make API request
    const response = await this.client.chat.completions.create({
      model,
      max_tokens: maxTokens,
      temperature,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ],
    });
    
    // Extract content from the response
    const content = response.choices[0]?.message?.content || '';
    
    // Format the response
    return {
      content,
      rawResponse: response,
      usage: {
        promptTokens: response.usage?.prompt_tokens || 0,
        completionTokens: response.usage?.completion_tokens || 0,
        totalTokens: response.usage?.total_tokens || 0
      }
    };
  } catch (error) {
    console.error('OpenAI query error:', error);
    throw new Error(`OpenAI query failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}
```

### Gemini Provider Implementation

The Gemini provider uses Google's Generative AI SDK to interact with Gemini models.

#### Initialization
```typescript
import { GoogleGenerativeAI } from '@google/generative-ai';
import { LLMProvider, LLMProviderOptions, LLMProviderResponse } from '../types';

export class GeminiProvider implements LLMProvider {
  private client: GoogleGenerativeAI;
  private defaultModel: string;
  
  constructor(options: LLMProviderOptions = {}) {
    // Initialize Gemini client
    const apiKey = options.apiKey || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('Gemini API key is required. Set it in options or GEMINI_API_KEY environment variable.');
    }
    
    this.client = new GoogleGenerativeAI(apiKey);
    // Set default model to gemini-1.5-flash instead of gemini-pro
    this.defaultModel = options.model || 'gemini-1.5-flash';
    
    console.log(`GeminiProvider: Initialized with model ${this.defaultModel}`);
  }
}
```

#### API Client Usage
```typescript
async query(prompt: string, options: LLMProviderOptions = {}): Promise<LLMProviderResponse> {
  // Get options with defaults
  const model = options.model || this.defaultModel;
  const temperature = options.temperature ?? 0.7;
  const maxTokens = options.maxTokens || 4000;
  const systemPrompt = options.systemPrompt || '';
  
  try {
    console.log(`GeminiProvider: Sending query to ${model} (temp: ${temperature})`);
    
    // Create model instance
    const geminiModel = this.client.getGenerativeModel({ model });
    
    // Prepare chat history with system prompt if available
    const contents = [];
    
    // Add system prompt if provided
    if (systemPrompt) {
      contents.push({
        role: 'user',
        parts: [{ text: `[System instruction] ${systemPrompt}` }]
      });
      
      // Add model response to acknowledge system instruction
      contents.push({
        role: 'model',
        parts: [{ text: "I'll follow those instructions." }]
      });
    }
    
    // Add user prompt
    contents.push({
      role: 'user',
      parts: [{ text: prompt }]
    });
    
    // Make API request
    const result = await geminiModel.generateContent({
      contents,
      generationConfig: {
        temperature,
        maxOutputTokens: maxTokens,
      },
    });
    
    const response = result.response;
    const content = response.text();
    
    // Format the response - Gemini doesn't provide token counts directly
    // so we make an approximation based on content length
    const estimatedTokens = Math.ceil(prompt.length / 4) + Math.ceil(content.length / 4);
    
    return {
      content,
      rawResponse: response,
      usage: {
        promptTokens: Math.ceil(prompt.length / 4),
        completionTokens: Math.ceil(content.length / 4),
        totalTokens: estimatedTokens
      }
    };
  } catch (error) {
    console.error('Gemini query error:', error);
    throw new Error(`Gemini query failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}
```

### Key Implementation Differences Summary

Here are the key differences between provider implementations that need to be accounted for in the ChatService:

1. **Authentication & Initialization**:
   - All providers require API keys, but they're initialized with different client libraries
   - Default models vary: `claude-3-5-sonnet-20241022` (Anthropic), `gpt-4-turbo-preview` (OpenAI), `gemini-1.5-flash` (Gemini)

2. **Message Formatting**:
   - Anthropic: Uses a `messages` array with simple `role: 'user'` for both system and user prompts
   - OpenAI: Uses a `messages` array with distinct `role: 'system'` and `role: 'user'` entries
   - Gemini: Uses `contents` array with a special format for system prompts and a conversation structure

3. **Response Processing**:
   - Anthropic: Content is an array of typed blocks (text, tool_use, etc.)
   - OpenAI: Content is in `choices[0].message.content`
   - Gemini: Content is accessed via `response.text()`

4. **Token Usage Tracking**:
   - Anthropic: Reports `input_tokens` and `output_tokens`
   - OpenAI: Reports `prompt_tokens`, `completion_tokens`, and `total_tokens`
   - Gemini: Doesn't directly provide token counts; an estimation is used

These implementation details, combined with the tool calling format differences, provide the complete information needed to replace the placeholder implementations in the ChatService with actual provider-specific code.

## Next Steps for Full Tool Calling Implementation

Now that we have implemented the response formatter adapters for all providers, the remaining work to complete the multi-provider implementation involves:

### 1. Prioritize Structured Responses Over Streaming

Unlike the earlier sections that emphasized streaming, the key priority is to ensure that all providers return properly structured responses for the UI:

- Use the response formatter adapters to generate structured outputs from all providers
- Ensure the client receives a consistent format regardless of which provider is used
- Focus on the final structured response rather than incremental streaming

This shift in approach means we'll prioritize getting complete, structured responses from each provider and formatting them consistently, rather than focusing on real-time streaming.

### 2. Implement ChatService for All Providers

Create a provider-agnostic ChatService that integrates with all providers:

```typescript
class ChatService {
  // Use the appropriate provider based on the requested model
  async processChat(message, history, options) {
    // 1. Set the provider based on options.modelProvider
    // 2. Process the chat with the selected provider
    // 3. Use response formatter adapter to format the response
    // 4. Return a consistently structured response
  }
}
```

### 3. Implement Sequential Thinking With Tool Execution

Create a provider-agnostic sequential thinking process that works with the response formatters:

```typescript
private async runSequentialThinking(
  message: string,
  history: ChatMessage[],
  mcpTools: any[],
  options: {
    modelProvider: ModelType;
    temperature?: number;
    maxTokens?: number;
  }
): Promise<ChatMessage[]> {
  // Get the appropriate tool adapter for this provider
  const toolAdapter = getToolCallAdapter(options.modelProvider);
  
  // Run sequential thinking steps using the selected provider
  // Use the adapter to handle provider-specific formats
  // Focus on getting properly structured responses at each step
  // Return the processed conversation
}
```

### 4. Create a New Chat Route Using ChatService

Create a new route that uses the ChatService instead of direct provider calls:

```typescript
router.post('/', async (req: Request, res: Response) => {
  const chatService = req.app.locals.chatService as ChatService;
  
  try {
    // Process the chat using the requested provider
    const response = await chatService.processChat(
      req.body.message,
      req.body.history,
      {
        modelProvider: req.body.modelProvider || 'anthropic',
        // Other options...
      }
    );
    
    // Return the structured response
    res.json(response);
  } catch (error) {
    // Handle errors
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});
```

### 5. Testing and Integration Plan

Once the implementations are complete, follow this plan to test and integrate:

1. Test each provider's response format with various types of conversations
2. Test tool calling with simple tools for each provider
3. Test sequential thinking for each provider
4. Compare results with the original Claude implementation for correctness
5. Gradually migrate endpoints from old implementation to new ChatService
6. Deploy to production when all tests pass

By implementing these steps, you'll have a complete, working implementation of tool calling across all supported LLM providers.

## Phase 6: Structured Response Formatter Implementation

For detailed information about the structured response formatter implementation, see [README.PLAN.responseFormatters.md](./README.PLAN.responseFormatters.md).

This phase focuses on ensuring consistent structured response formatting across all providers. The implementation uses the adapter pattern to handle provider-specific differences while maintaining a standardized output format.

Key components:
- ResponseFormatterAdapter interface
- Provider-specific adapters for Anthropic, OpenAI, and Gemini
- Common conversion logic for standardizing formats
- Factory and configuration functions 

## Remaining Implementation Steps 