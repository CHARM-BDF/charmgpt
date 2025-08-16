# Model Name Conflict Resolution

## Issue Summary

When switching between different LLM providers (Anthropic/Claude, OpenAI, and Gemini), the system was experiencing model name conflicts. Specifically:

1. When switching from Anthropic to OpenAI or Gemini, the system would still use Claude's model name with the new provider, causing compatibility errors.
2. OpenAI would reject requests with the error: "The model `claude-3-5-sonnet-20241022` does not exist or you do not have access to it."
3. Gemini would also attempt to use Claude's model name, causing similar errors.

## Root Cause

The `LLMService.setProvider()` method was not properly handling model compatibility when switching providers. When setting a new provider, it would keep the model name from the previous provider, which led to conflicts when:

1. The current model name was specific to another provider
2. The new provider did not support the model name format of the previous provider

## Solution

The solution was to implement provider-specific model name handling in the `LLMService` class:

1. Added a private `isIncompatibleModel()` method to detect if a model name is incompatible with a provider.
2. Modified the `setProvider()` method to reset the model to a provider-specific default when:
   - No model is specified in the options
   - The current model is incompatible with the new provider

3. Added provider-specific default models:
   - Anthropic: `claude-3-5-sonnet-20241022`
   - OpenAI: `gpt-4-turbo-preview`
   - Gemini: `gemini-1.5-flash`
   - Ollama: `llama3:latest`

## Implementation Details

The key changes were made in the `LLMService` class:

```typescript
private isIncompatibleModel(provider: string, model: string | undefined): boolean {
  if (!model) return true;
  
  if (provider === 'anthropic' && !model.includes('claude')) {
    return true;
  } else if (provider === 'openai' && model.includes('claude')) {
    return true;
  } else if (provider === 'gemini' && (model.includes('claude') || model.includes('gpt'))) {
    return true;
  }
  return false;
}

setProvider(options: LLMServiceOptions): void {
  // ...existing code...
  
  // Reset model to provider-specific defaults if not explicitly set in options
  // or if current model is incompatible with the new provider
  const providerName = options.provider;
  if (!options.model || this.isIncompatibleModel(providerName, this.options.model)) {
    if (providerName === 'anthropic') {
      this.options.model = 'claude-3-5-sonnet-20241022';
      console.log(`LLMService: Using default Anthropic model: ${this.options.model}`);
    } else if (providerName === 'openai') {
      this.options.model = 'gpt-4-turbo-preview';
      console.log(`LLMService: Using default OpenAI model: ${this.options.model}`);
    } else if (providerName === 'gemini') {
      this.options.model = 'gemini-1.5-flash';
      console.log(`LLMService: Using default Gemini model: ${this.options.model}`);
    } else if (providerName === 'ollama') {
      this.options.model = 'llama3:latest';
      console.log(`LLMService: Using default Ollama model: ${this.options.model}`);
    }
  }
  
  // ...remaining code...
}
```

## Testing

The fix was tested using:

1. Direct API calls to the `/api/chat-artifacts` endpoint with different providers:
   ```bash
   curl -X POST http://localhost:3001/api/chat-artifacts -H "Content-Type: application/json" -d '{"message":"What is the capital of France?", "history":[], "modelProvider":"anthropic"}'
   
   curl -X POST http://localhost:3001/api/chat-artifacts -H "Content-Type: application/json" -d '{"message":"What is the capital of France?", "history":[], "modelProvider":"openai"}'
   
   curl -X POST http://localhost:3001/api/chat-artifacts -H "Content-Type: application/json" -d '{"message":"What is the capital of France?", "history":[], "modelProvider":"gemini"}'
   ```

2. Server logs showing proper model selection:
   - Anthropic: `AnthropicProvider: Initialized with model claude-3-5-sonnet-20241022`
   - OpenAI: `OpenAIProvider: Initialized with model gpt-4-turbo-preview`
   - Gemini: `GeminiProvider: Initialized with model gemini-1.5-flash`

## Conclusion

This fix ensures that the LLM service properly handles provider-specific model names when switching between providers. Each provider now uses a compatible model name format, preventing the "model not found" errors that were occurring previously.

## Testing Recommendations

To verify this fix is working correctly, test the following scenarios:

1. Start with Anthropic/Claude provider and then switch to OpenAI
2. Start with OpenAI provider and then switch to Gemini
3. Start with Gemini provider and then switch to Anthropic
4. Use explicit model name overrides and verify they work as expected

Each scenario should produce log messages indicating:
- The provider change
- Detection of any incompatible model
- The default model being applied for the new provider

## Related Documentation

This change is part of the multi-provider LLM implementation plan. For more details on provider-specific implementations, see:

- [README.PLAN.expandLLMoptions.md](./README.PLAN.expandLLMoptions.md) - Overall multi-provider strategy
- [README.PLAN.expandLLMoptions.ChatService.md](./README.PLAN.expandLLMoptions.ChatService.md) - ChatService implementation details 