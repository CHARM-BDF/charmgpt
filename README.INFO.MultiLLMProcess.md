# Multi-LLM Process Documentation

## Overview
This document explains how the ChatService handles multiple LLM providers in the system.

## LLM Provider Types
The system supports the following LLM providers:
- Anthropic (Claude)
- OpenAI (ChatGPT)
- Google (Gemini)
- Ollama (Local)

## Provider Selection Process

### 1. Provider Specification
The provider is specified through a `ModelType` type:
```typescript
type ModelType = 'anthropic' | 'ollama' | 'openai' | 'gemini';
```

### 2. Service Architecture
- The `ChatService` receives an `LLMService` instance through dependency injection
- The `LLMService` is responsible for managing the actual LLM provider implementations
- The `ChatService` delegates all LLM interactions to the `LLMService`

### 3. Provider Configuration
When a chat method is called, the provider is configured using:
```typescript
this.llmService.setProvider({
  provider: options.modelProvider,
  temperature: options.temperature || 0.2,
  maxTokens: options.maxTokens || 4000
});
```

### 4. LLM Interaction
- All LLM interactions are made through the `llmService.query()` method
- The `LLMService` handles the provider-specific implementations
- The `ChatService` remains provider-agnostic

## Implementation Details

### LLMService Class
The `LLMService` class is the core implementation that manages different LLM providers. Key features:

1. **Provider Management**
   - Maintains a single active provider instance
   - Handles provider initialization and switching
   - Validates model compatibility with providers

2. **Default Models**
   - Anthropic: `claude-3-5-sonnet-20241022`
   - OpenAI: `gpt-4-turbo-preview`
   - Gemini: `gemini-1.5-flash`

3. **Provider Switching**
   - Validates model compatibility when switching providers
   - Automatically selects appropriate default model if current model is incompatible
   - Maintains provider-specific configurations

### Provider Implementation
Each provider implements the `LLMProvider` interface with:

1. **Common Interface**
   ```typescript
   interface LLMProvider {
     query(prompt: string, options?: LLMProviderOptions): Promise<LLMProviderResponse>;
   }
   ```

2. **Provider-Specific Features**
   - Each provider (Anthropic, OpenAI, Gemini) has its own implementation
   - Handles provider-specific API calls and response formatting
   - Manages provider-specific authentication and configuration

### Caching System
The service includes a caching mechanism:
- In-memory cache for LLM responses
- Configurable TTL and maximum cache size
- Cache key generation based on prompt and options
- Optional cache bypass for specific requests

### Response Processing
The service handles various response formats:
- Text responses
- JSON responses with validation
- Markdown formatting
- Token usage tracking
- Raw response preservation for debugging

## Current Implementation Status
The current implementation in `index.ts` shows the structure for multi-LLM support, with:
- Full support for Anthropic, OpenAI, and Gemini
- Ollama support marked as "not yet implemented"
- Robust error handling and logging
- Comprehensive caching system
- Flexible provider switching

## Questions to Resolve
1. How does the `LLMService` implement different providers?
   - ANSWERED: Through provider-specific classes implementing the `LLMProvider` interface
2. What is the provider-specific logic in the `setProvider` method?
   - ANSWERED: Validates model compatibility and initializes appropriate provider
3. How does the `query` method handle different provider requirements?
   - ANSWERED: Delegates to provider-specific implementations while maintaining common interface

## Next Steps
To fully understand the LLM selection process, we need to examine:
1. ~~The `LLMService` class implementation~~ ✓ COMPLETED
2. ~~The provider-specific implementations~~ ✓ COMPLETED
3. ~~The `setProvider` method implementation~~ ✓ COMPLETED
4. ~~The `query` method implementation~~ ✓ COMPLETED

## Response Formatting Process

### Overview
The system uses provider-specific formatter adapters to ensure consistent response formatting across different LLM providers. The process is designed to standardize the output format regardless of the provider used.

### Provider-Specific Flow

#### Anthropic/Claude Flow
1. **Initial Request**
   - ChatService receives request with provider set to 'anthropic'
   - LLMService initializes AnthropicProvider with default model 'claude-3-5-sonnet-20241022'

2. **Response Formatter Setup**
   - System uses `AnthropicResponseFormatterAdapter`
   - Configures tool_choice to use "response_formatter"
   - Provides specific schema for Claude's response format

3. **Response Processing**
   - Claude returns response in its native format with content blocks
   - Formatter extracts response from `tool_use` block
   - Converts to standardized format with:
     - thinking (optional markdown)
     - conversation (array of text/artifact segments)
     - artifacts (if any)

4. **Final Output Format**
   ```typescript
   {
     thinking: string,  // Optional markdown
     conversation: Array<{
       type: 'text' | 'artifact',
       content?: string,
       artifact?: {
         type: string,
         title: string,
         content: string,
         language?: string
       }
     }>,
     artifacts?: Array<{
       id: string,
       type: string,
       title: string,
       content: string,
       position: number,
       language?: string
     }>
   }
   ```

#### OpenAI Flow
1. **Initial Request**
   - ChatService receives request with provider set to 'openai'
   - LLMService initializes OpenAIProvider with default model 'gpt-4-turbo-preview'

2. **Response Formatter Setup**
   - System uses `OpenAIResponseFormatterAdapter`
   - Configures tool_choice as function call
   - Uses OpenAI's function calling format

3. **Response Processing**
   - OpenAI returns response with tool_calls
   - Formatter extracts response from function arguments
   - Converts to standardized format

4. **Final Output Format**
   - Same structure as Anthropic, but with slight differences in processing:
     - Conversation segments are joined with double newlines
     - Artifacts are referenced via HTML buttons in the text

### Key Differences
1. **Response Structure**
   - Anthropic: Uses content blocks with tool_use
   - OpenAI: Uses function calls with tool_calls

2. **Tool Configuration**
   - Anthropic: Uses `tool_choice: { name: "response_formatter" }`
   - OpenAI: Uses `tool_choice: { type: "function", function: { name: "response_formatter" } }`

3. **Error Handling**
   - Anthropic: Falls back to text content if tool_use is missing
   - OpenAI: Falls back to message content if tool_calls are missing

4. **Artifact Handling**
   - Anthropic: Maintains array structure for conversation
   - OpenAI: Converts conversation to string with artifact buttons

### UI Impact
The UI receives the same standardized format regardless of provider, ensuring consistent display of:
- Text content
- Artifacts
- Thinking process (if enabled)
- Conversation flow

The main difference is in how the conversation is structured:
- Anthropic responses maintain the array structure
- OpenAI responses are joined into a single string with artifact buttons

This standardization ensures that the UI can handle responses from any provider without modification.

## Known Issues and Future Improvements

### Response Format Inconsistency
There is a current inconsistency in how the response formatter adapters handle conversation formatting between OpenAI and Anthropic providers.

#### Current Implementation Differences

1. **Conversation Structure**
   - Anthropic: Maintains conversation as an array of objects
   - OpenAI: Joins all segments into a single string with artifact buttons

2. **Artifact References**
   - Anthropic: Keeps artifacts as separate objects in conversation array
   - OpenAI: Converts artifacts into HTML buttons in conversation text

3. **Text Joining**
   - Anthropic: Preserves array structure of conversation segments
   - OpenAI: Joins text segments with double newlines (`\n\n`)

#### Impact
- UI needs to handle both array-based and string-based conversation formats
- Makes code maintenance more difficult
- Could lead to inconsistent user experience
- Requires different rendering logic for different providers

#### Proposed Solution
Standardize the response format across all providers to use the array-based structure (Anthropic's approach) because:
1. It's more flexible and maintainable
2. Preserves the original structure of the conversation
3. Makes it easier to handle artifacts and text segments separately
4. Provides better type safety

#### Implementation Steps
1. Update OpenAI formatter to maintain array structure
2. Remove HTML button generation from formatters
3. Move artifact button generation to UI layer
4. Update UI to handle array-based conversation format
5. Add migration tests to ensure backward compatibility
6. Update documentation to reflect standardized format

#### Files to Modify
- `src/server/services/chat/formatters/openai.ts`
- `src/server/services/chat/formatters/gemini.ts` (currently follows OpenAI pattern)
- UI components that handle conversation rendering
- Formatter adapter tests

#### Priority
Medium - While this doesn't cause immediate issues, it should be addressed to improve code maintainability and consistency. 