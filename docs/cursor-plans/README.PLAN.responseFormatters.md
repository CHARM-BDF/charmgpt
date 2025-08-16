# Response Formatter Implementation Plan

## Context
- **Purpose**: Documents the implementation of structured response formatters for multiple LLM providers
- **Related Documents**: 
  - [README.PLAN.expandLLMoptions.md](./README.PLAN.expandLLMoptions.md) - Overall multi-provider strategy
- **Dependencies**: Requires implementation of provider-specific adapters

## Overview

This document details the implementation of structured response formatters for different LLM providers (Anthropic/Claude, OpenAI, and Gemini). These formatters standardize how each provider handles structured responses containing text and artifacts, ensuring a consistent experience regardless of which LLM provider is used.

The implementation follows the adapter pattern to handle provider-specific differences in tool definitions, response formats, and extraction methods.

## Current Implementation Status

✅ **Response Formatter Adapters**: 
- Implemented `ResponseFormatterAdapter` interface in `types.ts`
- Created provider-specific implementations for Anthropic, OpenAI, and Gemini
- Added factory function to get the appropriate adapter based on provider

✅ **Provider-Specific Formatters**:
- Each formatter handles the unique requirements of its respective provider:
  - Anthropic: Uses `input_schema` and `tool_use` content blocks
  - OpenAI: Uses `function` with `parameters` and JSON string arguments
  - Gemini: Uses `functionDeclarations` and `functionCalls()` method

✅ **Format Standardization**:
- All adapters convert provider-specific outputs to a common `StoreFormat`
- Consistent artifact processing across all providers

✅ **Integration**:
- Added `getResponseFormatterConfig` function to configure formatter usage per provider

✅ **Testing**:
- Created standalone test script covering all adapters
- Verified each adapter works with its provider-specific response format
- All tests pass for all adapters

## Implementation Details

### 1. ResponseFormatterAdapter Interface

The base interface defines three key methods:

```typescript
interface ResponseFormatterAdapter {
  // Get tool definition for the response formatter in provider-specific format
  getResponseFormatterToolDefinition(): any;
  
  // Extract formatter output from provider-specific response
  extractFormatterOutput(response: any): any;
  
  // Convert the formatter output to the standard store format
  convertToStoreFormat(formatterOutput: any): StoreFormat;
}
```

### 2. Provider-Specific Adapters

<section id="openai-formatter">

#### OpenAI Response Formatter

The OpenAI adapter handles the unique requirements of OpenAI's function calling format:

- **Tool Definition**: Uses `type: "function"` at the top level with nested `function` property containing `parameters`
- **Response Extraction**: Parses the JSON string from `tool_calls[0].function.arguments`
- **Validation**: Checks for proper tool call and conversation structure

Key implementation points:
- Requires `tool_choice` parameter to force tool usage
- Handles error cases when tool calls are missing or incorrect
- Processes tool response from the first `tool_calls` entry
- Parses the JSON string in `arguments` field to extract formatter output

</section>

<section id="anthropic-formatter">

#### Anthropic (Claude) Response Formatter

The Anthropic adapter works with Claude's content blocks format:

- **Tool Definition**: Uses direct object with `name`, `description`, and `input_schema`
- **Response Extraction**: Finds `tool_use` content block with `name: "response_formatter"`
- **Validation**: Verifies content structure and conversation array presence

Key implementation points:
- Processes the `input` field from the tool_use block
- Finds the correct tool_use block by name matching
- Handles empty responses and missing tool calls

</section>

<section id="gemini-formatter">

#### Gemini Response Formatter

The Gemini adapter handles Google's function calling approach:

- **Tool Definition**: Uses `functionDeclarations` array with function specification
- **Response Extraction**: Calls `functionCalls()` method and processes the result
- **Validation**: Checks for function calls and proper structure

Key implementation points:
- Uses the special `functionCalls()` method to access tool results
- Finds the correct function call by name matching
- Gets structured arguments directly from the `args` property

</section>

### 3. Common Conversion Logic

All adapters share similar logic for converting to the standard store format:

- Process text and artifact items separately
- Generate unique IDs for artifacts
- Create artifact buttons for the UI
- Return a standardized `StoreFormat` with thinking, conversation, and artifacts

```typescript
convertToStoreFormat(formatterOutput: FormatterOutput): StoreFormat {
  const conversation: string[] = [];
  const artifacts: Array<any> = [];
  let position = 0;
  
  // Process conversation items...
  
  return {
    thinking: formatterOutput.thinking,
    conversation: conversation.join('\n\n'),
    artifacts: artifacts.length > 0 ? artifacts : undefined
  };
}
```

### 4. Factory and Configuration Functions

The implementation includes two key utility functions:

- **getResponseFormatterAdapter**: Returns the appropriate adapter instance for a provider
- **getResponseFormatterConfig**: Returns provider-specific configuration for forcing tool usage

```typescript
function getResponseFormatterAdapter(provider: FormatterAdapterType): ResponseFormatterAdapter {
  switch (provider) {
    case 'anthropic': return new AnthropicResponseFormatterAdapter();
    case 'openai': return new OpenAIResponseFormatterAdapter();
    case 'gemini': return new GeminiResponseFormatterAdapter();
    // Fallback for unsupported providers...
  }
}

function getResponseFormatterConfig(provider: FormatterAdapterType): any {
  switch (provider) {
    case 'anthropic': return { tool_choice: { name: "response_formatter" } };
    case 'openai': return { tool_choice: { type: "function", function: { name: "response_formatter" } } };
    case 'gemini': return { toolConfig: { functionCallingConfig: { mode: "ANY", allowedFunctionNames: ["response_formatter"] } } };
    // Defaults for other providers...
  }
}
```

## Testing Strategy

### Current Test Coverage

✅ **Test Script Implementation**:
- Created a standalone `test-formatters.js` script for testing all formatters
- Provides detailed verification for each adapter's functionality
- Uses realistic mock responses for each provider's format

✅ **Adapter Test Coverage**:
- All three adapters (Anthropic, OpenAI, Gemini) tested
- Verification for all key methods:
  - `getResponseFormatterToolDefinition()`
  - `extractFormatterOutput()`
  - `convertToStoreFormat()`
- Tests pass for all adapters

### Test Implementation Approach

Instead of using a traditional testing framework like Jest (which would require additional configuration for TypeScript/ESM modules), we've implemented a streamlined standalone test script that provides full coverage of the formatter adapter functionality:

```javascript
// Example test script excerpt (test-formatters.js)
import { AnthropicResponseFormatterAdapter } from './src/server/services/chat/formatters/anthropic';
import { OpenAIResponseFormatterAdapter } from './src/server/services/chat/formatters/openai';
import { GeminiResponseFormatterAdapter } from './src/server/services/chat/formatters/gemini';

// Test adapter functionality with provider-specific mock responses
function testAdapter(name, adapterInstance) {
  // Create provider-specific mock responses
  let mockResponse;
  if (name === 'Anthropic') {
    mockResponse = {
      content: [
        { type: 'text', text: 'Processing...' },
        {
          type: 'tool_use',
          name: 'response_formatter',
          id: 'tool_123',
          input: { /* mock data */ }
        }
      ]
    };
  } else if (name === 'OpenAI') {
    // OpenAI-specific mock response
  } else if (name === 'Gemini') {
    // Gemini-specific mock response
  }
  
  // Test all adapter methods
  const definition = adapterInstance.getResponseFormatterToolDefinition();
  const output = adapterInstance.extractFormatterOutput(mockResponse);
  const storeFormat = adapterInstance.convertToStoreFormat(formatterOutput);
  
  // Verify results
  // ...
}
```

The test script can be run with:

```bash
npx tsx test-formatters.js
```

### Test Verification Points

For each adapter, the test script verifies:

1. **Tool Definition Structure**:
   - Anthropic adapter generates proper direct object with `name`, `description`, and `input_schema`
   - OpenAI adapter generates `type: "function"` with nested function object
   - Gemini adapter generates `functionDeclarations` array

2. **Formatter Output Extraction**:
   - Each adapter correctly extracts formatted output from provider-specific responses
   - Adapters handle different response structures (content blocks, tool_calls, functionCalls)

3. **Store Format Conversion**:
   - Consistent generation of StoreFormat with thinking, conversation, and artifacts
   - Proper artifact generation with unique IDs
   - Correct creation of artifact buttons for UI

This testing approach ensures that all adapters maintain compatible behavior while handling their provider-specific details.

## Challenges and Solutions

### 1. Different Tool Calling Formats

**Challenge**: Each provider has a unique approach to tool definitions and responses.

**Solution**: Created provider-specific adapters that handle these differences behind a common interface, allowing the rest of the application to work with a standardized format.

### 2. Inconsistent Response Structures

**Challenge**: Different providers return tool results in vastly different formats.

**Solution**: Implemented specialized extraction methods for each provider that know how to navigate their specific response structure.

### 3. Error Handling

**Challenge**: Different types of errors can occur with each provider.

**Solution**: Added detailed error handling with specific error messages for each provider, making debugging easier.

### 4. Artifact Processing

**Challenge**: Maintaining consistent artifact structure across providers.

**Solution**: Centralized artifact processing logic with a standard format definition.

## Next Steps

### Completed

✅ **Adapter Implementation**:
- Created ResponseFormatterAdapter interface in `types.ts`
- Implemented provider-specific adapters for Anthropic, OpenAI, and Gemini
- Added factory function to get the appropriate adapter based on provider type

✅ **Testing**:
- Created comprehensive test script (`test-formatters.js`)
- Tested all adapter implementations
- Verified consistent behavior across providers

### Future Enhancements

1. **Documentation**:
   - Add more detailed JSDoc comments to all adapter methods
   - Create usage examples for the ChatService integration

2. **Performance Optimization**:
   - Profile adapter performance during integration
   - Optimize extraction and conversion methods if needed

3. **Error Recovery**:
   - Implement fallback mechanisms for when structured formatting fails
   - Add retry logic with exponential backoff for intermittent errors

4. **Extended Testing**:
   - Add additional edge case tests
   - Create integration tests with the ChatService
   - Add performance benchmarks 