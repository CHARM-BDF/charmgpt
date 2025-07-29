# Artifact Collection and Processing Prevention Plan

## Current System Analysis

### Current Flow (Problem)
1. PubMed MCP returns:
   ```typescript
   return {
     content: [{
       type: "text",
       text: `# Search Results...`,
       forModel: true
     }],
     artifacts: [{
       type: "application/vnd.bibliography",
       title: "Bibliography",
       content: bibliographyData
     }]
   }
   ```

2. During sequential thinking:
   - Full content (including publication info) goes back to tool selection
   - Tool selection sees publication content and calls PubMed MCP again
   - Creates duplicate artifacts

### Impact
- Unnecessary API calls
- Duplicate artifacts
- Processing overhead
- Potential rate limiting issues

## Proposed Solution

### 1. Separate Content and Artifact Processing

Create distinct paths for content and artifacts:

```typescript
interface MCPResponse {
  // Content for further processing
  content: {
    type: "text";
    text: string;
    forModel: boolean;
    // Flag to indicate this content has already produced artifacts
    hasGeneratedArtifacts?: boolean;
  }[];
  
  // Artifacts to be stored (not reprocessed)
  artifacts?: {
    type: string;
    title: string;
    content: any;
    // Source information to prevent reprocessing
    source?: {
      tool: string;
      query?: string;
    };
  }[];
}
```

### 2. Track Processed Content

Add tracking to prevent reprocessing:

```typescript
interface ProcessingState {
  // Track which content has already generated artifacts
  processedContent: Set<string>;  // Store content hashes or identifiers
  
  // Track collected artifacts
  collectedArtifacts: MCPArtifact[];
}
```

### 3. Modified Sequential Thinking Flow

Update the flow to prevent reprocessing:

```typescript
async function runSequentialThinking(
  message: string,
  history: ChatMessage[],
  mcpTools: AnthropicTool[],
  modelProvider: ModelType,
  options: any
): Promise<any[]> {
  const processingState = {
    processedContent: new Set<string>(),
    collectedArtifacts: []
  };

  while (!isSequentialThinkingComplete) {
    // Get next tool selection
    const toolSelection = await getToolSelection(/* ... */);

    // Check if this content has already generated artifacts
    const contentHash = hashContent(toolSelection.content);
    if (processingState.processedContent.has(contentHash)) {
      continue;  // Skip if already processed
    }

    // Execute tool
    const result = await executeSelectedTool(toolSelection);

    // If artifacts were generated, mark content as processed
    if (result.artifacts?.length) {
      processingState.processedContent.add(contentHash);
      processingState.collectedArtifacts.push(...result.artifacts);
    }

    // Only pass non-artifact content to next thinking step
    const contentForNextStep = result.content.filter(c => !c.hasGeneratedArtifacts);
    // Continue processing with filtered content...
  }

  return {
    finalContent: /* ... */,
    artifacts: processingState.collectedArtifacts
  };
}
```

## Implementation Steps

1. **Update MCP Response Structure**:
   - Add source tracking to artifacts
   - Add flags for content that has generated artifacts
   - Update all MCPs to use new structure

2. **Modify Chat Service**:
   - Implement content tracking system
   - Add content filtering before tool selection
   - Update artifact collection logic

3. **Update Tool Selection**:
   - Add checks for already processed content
   - Skip tool selection for content marked as processed

4. **Add Processing State Management**:
   - Create state tracking system
   - Implement content hashing/identification
   - Add artifact source tracking

## Files to Modify

1. **Core Processing**:
   ```
   /src/server/services/chat/index.ts
   /src/server/routes/chat.ts
   ```

2. **MCP Updates**:
   ```
   /custom-mcp-servers/pubmed-mcp/src/index.ts
   /src/server/services/chat/types.ts
   ```

## Testing Strategy

1. **Unit Tests**:
   - Verify content tracking system
   - Test content hash generation
   - Validate artifact source tracking

2. **Integration Tests**:
   - Test complete flow with PubMed MCP
   - Verify no duplicate processing occurs
   - Check artifact collection accuracy

3. **Edge Cases**:
   - Multiple MCPs in sequence
   - Content that references multiple sources
   - Partial content updates

## Migration Plan

1. **Phase 1**: Add tracking without enforcing
   - Implement new structures
   - Add logging to identify reprocessing
   - Don't block existing functionality

2. **Phase 2**: Enable prevention
   - Start enforcing content tracking
   - Enable artifact source checking
   - Monitor for issues

3. **Phase 3**: Clean up legacy code
   - Remove old artifact handling
   - Update all MCPs to new format
   - Update documentation

## Success Metrics

1. No duplicate artifacts in output
2. Reduced API calls to external services
3. Faster processing time
4. Lower resource usage

## Future Considerations

1. Add more sophisticated content tracking
2. Implement partial content updates
3. Add artifact versioning if needed
4. Consider caching for frequently used artifacts 