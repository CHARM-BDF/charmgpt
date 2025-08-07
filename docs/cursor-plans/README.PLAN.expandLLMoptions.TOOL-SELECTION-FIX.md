# ChatService Tool Selection Fix

## Context
- **Purpose**: Documents the fix for tool selection issues in the ChatService with multiple providers
- **Related Documents**: 
  - [README.PLAN.expandLLMoptions.md](./README.PLAN.expandLLMoptions.md) - Overall multi-provider strategy
  - [README.PLAN.expandLLMoptions.ChatService.md](./README.PLAN.expandLLMoptions.ChatService.md) - Chat service architecture
- **Dependencies**: ChatService implementation, tool adapters

## Issue Summary

The ChatService wasn't properly selecting tools during sequential thinking with OpenAI. After fixing model name conflicts, we discovered that the OpenAI provider wasn't being told to use appropriate tools (like PubMed search) when directly applicable to user queries.

## Root Cause Analysis

1. **Missing Parameters in LLM Query**: In the `runSequentialThinking` method, the LLM query did not include:
   - The `tools` parameter for passing provider tools
   - The `toolChoice` parameter for encouraging tool selection

2. **Incomplete SystemPrompt Guidance**: The system prompt did not strongly encourage using tools when appropriate, leading the model to generate fictional responses.

## Implemented Fixes

### 1. Passing Tools to LLM Query

Updated the query in `runSequentialThinking` to include tools:

```typescript
const response = await this.llmService.query({
  prompt: latestMessage,
  options: {
    temperature: options.temperature || 0.2,
    maxTokens: options.maxTokens || 4000,
    // Added these two critical parameters:
    tools: providerTools,
    toolChoice: modelProvider === 'openai' ? 'auto' : undefined
  } as any, // Type assertion needed due to typing constraints
  systemPrompt: this.buildSystemPromptWithContext(formattedHistory, providerTools)
});
```

### 2. Enhanced System Prompt

Improved the system prompt to better encourage tool usage:

```typescript
if (tools.length > 0) {
  systemPrompt += '# Available Tools\n\n';
  systemPrompt += 'You have access to the following tools. USE THESE TOOLS WHEN APPROPRIATE to provide the best response.\n';
  systemPrompt += 'You should prefer using tools over generating fictional information. For example, if asked about specific data that requires a tool, use the tool rather than making up an answer.\n\n';
  
  // ... tool listing code ...
}
```

## Testing & Verification

- Added diagnostic logging throughout the pipeline to track:
  - Tool selection
  - Parameter passing
  - Provider-specific handling
  - Response processing

- Created curl tests to verify proper tool selection with queries like:
  ```
  curl -X POST http://localhost:3001/api/chat-artifacts -H "Content-Type: application/json" \
    -d '{"message":"look up 3 papers on pubmed about cancer", "history":[], "modelProvider":"openai"}'
  ```

- Confirmed in logs that OpenAI now selects the `pubmed-search` tool when appropriate.

## Lessons & Future Considerations

### What to Watch For

1. **Provider-Specific Parameters**: Always ensure that provider-specific parameters are correctly passed through all layers of abstraction.

2. **Type Safety vs. Flexibility**: The LLM service interface might need updates to properly type optional parameters like `tools` and `toolChoice` without requiring type assertions.

3. **Debugging Visibility**: Consider adding permanent log points at key decision points in the tool selection flow for easier debugging.

### Future Improvements

1. **Provider-Specific Adapters**: Create more robust provider-specific adapters that automatically handle parameters like `toolChoice` in the format each provider expects.

2. **LLMService Interface Extension**: Update the LLMService interface to natively support tools and tool choice parameters without needing to use type assertions.

3. **Response Processing**: Ensure the entire chain works from tool selection through tool execution to response formatting for all providers.

4. **Auto-Logging**: Implement more automated logging for key parameters at critical points in the call chain to make debugging easier.

## Conclusion

The fix ensures that OpenAI (and potentially other providers) will now properly select tools like PubMed search when directly applicable to the user's query, rather than generating potentially fictional information. This improves the accuracy and utility of the ChatService across all supported providers.

The key insight was that provider-specific parameters need to be passed all the way through the service layers, from the initial query through to the final API call. 