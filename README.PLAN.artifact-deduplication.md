# Artifact Deduplication Plan

## Current Behavior Analysis

### Legacy Bibliography Handling
The legacy system has built-in deduplication for bibliography entries:

```typescript
// Current deduplication in legacy system
if ('bibliography' in toolResult && toolResult.bibliography) {
  if ((messages as any).bibliography) {
    const currentBibliography = (messages as any).bibliography;
    const newBibliography = toolResult.bibliography;
    
    // Deduplicate based on PMID
    const existingPmids = new Set(currentBibliography.map(entry => entry.pmid));
    const uniqueNewEntries = newBibliography.filter(entry => !existingPmids.has(entry.pmid));
    
    (messages as any).bibliography = [...currentBibliography, ...uniqueNewEntries];
  }
}
```

### New Artifacts Array System
The new system currently lacks deduplication:

```typescript
// Current behavior in new system
if ((processedHistory as any).directArtifacts) {
  for (const artifact of (processedHistory as any).directArtifacts) {
    artifactsToAdd.push(artifact);  // No deduplication check
  }
}
```

## Issue Description

### Problem
During sequential thinking steps, artifacts can be duplicated because:
1. PubMed MCP returns publication info as an artifact
2. This artifact gets processed during sequential thinking
3. Each step adds the artifact without checking for duplicates
4. The same artifact can be added multiple times during different thinking steps

### Impact
- Duplicate artifacts in the UI
- Unnecessary data redundancy
- Potential confusion for users seeing the same information multiple times

## Files Involved

1. **Main Processing Files**:
   ```
   /src/server/services/chat/index.ts        # Main chat service with sequential thinking
   /src/server/routes/chat.ts                # Chat route handling
   /src/services/message.ts                  # Message formatting service
   ```

2. **MCP Server Files**:
   ```
   /custom-mcp-servers/pubmed-mcp/src/index.ts  # PubMed MCP implementation
   ```

## Proposed Solution

### 1. Implement Generic Artifact Deduplication

Add a new deduplication function that works with all artifact types:

```typescript
interface ArtifactDeduplicationConfig {
  type: string;
  identifierField: string;
}

const DEDUPLICATION_CONFIGS: Record<string, ArtifactDeduplicationConfig> = {
  'application/vnd.bibliography': {
    type: 'application/vnd.bibliography',
    identifierField: 'pmid'
  },
  // Add configs for other artifact types as needed
};

function deduplicateArtifacts(existing: any[], newArtifacts: any[]): any[] {
  const uniqueArtifacts = [...existing];
  
  for (const newArtifact of newArtifacts) {
    const config = DEDUPLICATION_CONFIGS[newArtifact.type];
    if (!config) {
      // If no deduplication config, treat as unique
      uniqueArtifacts.push(newArtifact);
      continue;
    }

    // Parse content if it's a string
    const content = typeof newArtifact.content === 'string' 
      ? JSON.parse(newArtifact.content) 
      : newArtifact.content;

    // Check if this artifact already exists
    const isDuplicate = uniqueArtifacts.some(existing => {
      const existingContent = typeof existing.content === 'string'
        ? JSON.parse(existing.content)
        : existing.content;
      
      return existing.type === newArtifact.type &&
             existingContent[config.identifierField] === content[config.identifierField];
    });

    if (!isDuplicate) {
      uniqueArtifacts.push(newArtifact);
    }
  }

  return uniqueArtifacts;
}
```

### 2. Integration Points

Update the following locations to use the new deduplication:

1. **ChatService Sequential Thinking**:
```typescript
// In runSequentialThinking method
if ((processedHistory as any).directArtifacts) {
  artifactsToAdd = deduplicateArtifacts(
    artifactsToAdd,
    (processedHistory as any).directArtifacts
  );
}
```

2. **Message Processing**:
```typescript
// In processChat method
if ((processedHistory as any).directArtifacts) {
  artifactsToAdd = deduplicateArtifacts(
    artifactsToAdd,
    (processedHistory as any).directArtifacts
  );
}
```

## Implementation Steps

1. Create new utility file for artifact deduplication
2. Implement the deduplication function with configurable rules
3. Update ChatService to use the new deduplication
4. Add tests to verify deduplication behavior
5. Update documentation to reflect new artifact handling

## Testing Plan

1. **Unit Tests**:
   - Test deduplication with bibliography artifacts
   - Test handling of different artifact types
   - Test content parsing (string vs object)
   - Test edge cases (missing fields, invalid content)

2. **Integration Tests**:
   - Test PubMed MCP sequential thinking flow
   - Verify artifacts are properly deduplicated
   - Check handling of mixed artifact types

## Migration Notes

- The legacy bibliography handling can be maintained for backward compatibility
- New artifact handling will use the generic deduplication system
- Both systems can coexist during transition period

## Future Considerations

1. Add support for more artifact types in deduplication config
2. Consider adding metadata-based deduplication rules
3. Add monitoring for duplicate artifacts to track effectiveness
4. Consider adding user preferences for artifact handling 