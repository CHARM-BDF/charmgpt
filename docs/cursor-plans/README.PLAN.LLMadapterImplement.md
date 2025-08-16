# LLM Adapter Implementation Plan
Created: May 13, 2025

## Background and Motivation

During the implementation of multi-LLM support in our chat system, we discovered an inconsistency in how different formatter adapters handle text responses. The issue became apparent when responses from Anthropic and OpenAI were not displaying correctly in the UI, while Gemini responses worked as expected.

The root cause was identified: the Gemini formatter adapter joins text segments into a single string (matching the UI's expectations), while the Anthropic and OpenAI adapters return arrays of separate text segments. This mismatch causes the UI to only display the last segment of the response for Anthropic and OpenAI.

## Current Implementation Analysis

### Formatter Adapter Behavior

1. **Gemini Adapter (Working Correctly)**:
   ```typescript
   // In GeminiResponseFormatterAdapter.convertToStoreFormat:
   return {
     thinking: formatterOutput.thinking,
     conversation: conversation.join('\n\n'),  // ✅ Text segments joined!
     artifacts: artifacts.length > 0 ? artifacts : undefined
   };
   ```

2. **Anthropic and OpenAI Adapters (Need Update)**:
   ```typescript
   // In both adapters' convertToStoreFormat:
   return {
     thinking: formatterOutput.thinking,
     conversation: processedConversation,  // ❌ Array of separate items!
     artifacts: artifacts.length > 0 ? artifacts : undefined
   };
   ```

## Required Changes

### 1. Formatter Adapters

Update the following files to standardize text segment joining:

- `src/server/services/chat/adapters/anthropic.ts`
- `src/server/services/chat/adapters/openai.ts`

Both need to match Gemini's approach of joining text segments.

### 2. Affected Code in index.ts

The following areas in `src/server/services/chat/index.ts` interact with the formatter output:

1. **processChat Method**:
   ```typescript
   async processChat(
     message: string,
     history: ChatMessage[],
     options: {
       modelProvider: ModelType;
       // ... other options
     },
     statusHandler?: (status: string) => void
   ): Promise<StoreFormat>
   ```
   - Expects StoreFormat with single string conversation
   - No changes needed if adapters are updated correctly

2. **formatSequentialThinkingData Method**:
   ```typescript
   private formatSequentialThinkingData(
     originalQuery: string,
     processedMessages: any[],
     toolExecutions: any[] = []
   ): string
   ```
   - Formats data for the formatter
   - No changes needed, but important for context

3. **streamEnhancedResponse Method**:
   ```typescript
   private streamEnhancedResponse(response: StoreFormat): ReadableStream
   ```
   - Streams response to client
   - No changes needed if StoreFormat is correct

4. **processChatWithArtifacts Method**:
   ```typescript
   async processChatWithArtifacts(
     message: string,
     history: ChatMessage[],
     options: {
       // ... options
     },
     statusHandler?: (status: string) => void
   ): Promise<ReadableStream>
   ```
   - Handles artifacts in responses
   - No changes needed if formatter adapters handle artifacts correctly

5. **Message History Formatting**:
   ```typescript
   private formatMessageHistory(
     history: ChatMessage[],
     providerType: ModelType
   ): ProviderChatMessage[]
   ```
   - No changes needed, but important for context

6. **Logging Statements**:
   - Keep existing logging
   - Add new logging for text joining process

## Implementation Steps

1. **Update Anthropic Formatter**:
   ```typescript
   // In AnthropicResponseFormatterAdapter:
   convertToStoreFormat(formatterOutput: any): StoreFormat {
     const textSegments: string[] = [];
     const artifacts: any[] = [];
     let position = 0;

     // Process formatter output
     formatterOutput.conversation.forEach(item => {
       if (item.type === 'text') {
         textSegments.push(item.content);
       } else if (item.type === 'artifact') {
         const artifactId = crypto.randomUUID();
         artifacts.push({
           id: artifactId,
           // ... other artifact properties
           position: position++
         });
         textSegments.push(this.createArtifactButton(artifactId, item.type, item.title));
       }
     });

     return {
       thinking: formatterOutput.thinking,
       conversation: textSegments.join('\n\n'),
       artifacts: artifacts.length > 0 ? artifacts : undefined
     };
   }
   ```

2. **Update OpenAI Formatter**:
   - Apply the same changes to the OpenAI adapter
   - Ensure consistent artifact handling

3. **Testing**:
   - Test with all providers
   - Verify text display in UI
   - Check artifact linking
   - Validate response format

## Validation Checklist

- [ ] All formatter adapters join text segments
- [ ] Artifact references are properly embedded in text
- [ ] UI displays complete responses
- [ ] Artifact links work correctly
- [ ] Logging is comprehensive
- [ ] Error handling is robust

## Success Criteria

1. UI displays complete responses from all providers
2. Artifact references are clickable and work correctly
3. Response format is consistent across all providers
4. No regression in existing functionality

## Rollback Plan

If issues are encountered:
1. Keep both old and new adapter implementations
2. Add version flag to switch between them
3. Roll back to old version if needed

## Future Considerations

1. Monitor performance impact of text joining
2. Consider streaming improvements
3. Plan for additional LLM providers
4. Consider standardizing artifact handling further

## Timeline

- Implementation: 1-2 days
- Testing: 1 day
- Deployment: 1 day
- Monitoring: 1 week

## Notes

- Minimal changes required to core code
- Focus on adapter implementations
- Maintain existing error handling
- Keep comprehensive logging 