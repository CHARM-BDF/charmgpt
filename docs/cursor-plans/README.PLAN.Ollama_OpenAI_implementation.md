# Ollama Integration Plan: OpenAI Provider Pattern

## Overview

This document outlines the plan to integrate Ollama with the MCP service using the existing provider pattern, similar to how OpenAI is integrated. This approach will replace the current direct implementation in `ollama_mcp.ts` with a more maintainable and consistent architecture.

## Goals

1. Create a dedicated `OllamaProvider` class following the LLMProvider interface
2. Complete the `OllamaToolAdapter` implementation for tool calling
3. Integrate with the existing LLMService with minimal changes
4. Maintain all capabilities currently implemented in the direct approach
5. Ensure feature parity with other providers (OpenAI, Anthropic, Gemini)

## Implementation Steps

### 1. Provider Implementation

- Create `src/server/services/llm/providers/ollama.ts` with `OllamaProvider` class
- Implement the LLMProvider interface methods:
  - `query(prompt, options)`: Send requests to Ollama API
  - Handle both streaming and non-streaming responses
  - Support system prompts and temperature settings
  - Implement proper error handling and retries

```typescript
// Implementation structure
export class OllamaProvider implements LLMProvider {
  // Configuration
  private model: string;
  private apiUrl: string = 'http://localhost:11434/api';
  
  constructor(options: { model?: string }) {
    this.model = options.model || 'llama3.2:latest';
  }
  
  async query(prompt: string, options: any): Promise<LLMResponse> {
    // Format options for Ollama
    // Make API request
    // Process response
    // Handle errors
    // Return standardized response
  }
}
```

### 2. Tool Adapter Enhancement

- Complete `src/server/services/chat/adapters/ollama.ts` implementation
- Implement the three core methods:
  - `convertToolDefinitions()`: Transform MCP tools to Ollama format
  - `extractToolCalls()`: Parse Ollama's namespaced tool calls
  - `formatToolResults()`: Format tool results for Ollama

```typescript
// Key implementation focus
extractToolCalls(response: any): ToolCall[] {
  if (!response.message?.tool_calls?.length) {
    return [];
  }
  
  return response.message.tool_calls.map(toolCall => {
    // Handle namespaced format (tool_name.operation)
    const [toolName, operation] = (toolCall.function.name || '').split('.');
    
    return {
      id: generateId(),
      name: toolName,
      operation: operation,
      arguments: toolCall.function.arguments,
      raw: toolCall
    };
  });
}
```

### 3. LLMService Integration

- Update `src/server/services/llm/index.ts` to include Ollama
- Add import for OllamaProvider
- Modify the provider initialization code
- Add default model handling for Ollama
- Update model compatibility checking

```typescript
// Replace the current placeholder
else if (this.options.provider === 'ollama') {
  this.provider = new OllamaProvider({
    model: this.options.model
  });
}
```

### 4. Response Format Handling

- Ensure Ollama responses are correctly formatted
- Handle JSON extraction from responses
- Support streaming responses
- Process tool call responses

### 5. Migration Strategy

- Keep existing implementation during transition
- Add feature flag to control routing
- Implement A/B testing for validation
- Gradually shift traffic to new implementation

## Testing Plan

1. **Unit Tests**
   - Test OllamaProvider methods
   - Test tool adapter functions
   - Test response parsing

2. **Integration Tests**
   - Test end-to-end flows with real Ollama instance
   - Verify tool calling works properly
   - Test different model options

3. **Comparison Testing**
   - Compare results between current and new implementation
   - Verify feature parity
   - Measure performance differences

## Technical Challenges

1. **Tool Calling Format**
   - Ollama uses namespaced format (tool_name.operation)
   - Arguments may be returned as strings even for numeric values
   - Need to handle inconsistencies between models

2. **Model Capabilities**
   - Different Ollama models have varying tool support
   - Need model capability detection
   - Should fall back gracefully when features aren't supported

3. **Response Formatting**
   - Need to handle both tool_calls and text responses
   - Extract content correctly from various response formats
   - Maintain consistent structure with other providers

## Timeline

1. **Phase 1: Implementation (1-2 days)**
   - Create OllamaProvider class
   - Complete OllamaToolAdapter
   - Update LLMService integration

2. **Phase 2: Testing (1-2 days)**
   - Create test cases
   - Validate with different models
   - Compare with existing implementation

3. **Phase 3: Migration (1 day)**
   - Implement feature flag
   - Add metrics for comparison
   - Create rollback plan

4. **Phase 4: Cleanup (1 day)**
   - Remove deprecated code
   - Update documentation
   - Finalize tests

## Future Enhancements

1. Model-specific optimizations
2. Enhanced tool processing for complex parameters
3. Performance improvements for streaming responses
4. Caching layer for model capabilities 