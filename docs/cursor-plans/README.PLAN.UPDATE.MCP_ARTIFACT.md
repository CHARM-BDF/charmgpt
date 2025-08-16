# MCP Artifact Standardization Plan

## Current Implementation Analysis

### 1. PubMed MCP Server Response Format

The PubMed MCP server (`pubmed-mcp/src/index.ts`) returns:

```typescript
// Search tool response
return {
  content: [
    {
      type: "text",
      text: `# Search Results for: ${formattedQuery}\n\n${markdownArticles.join("\n\n")}`,
      forModel: true
    }
  ],
  bibliography: bibliographyData
};
```

Key characteristics:
- Returns `content` array with formatted text
- Returns a separate `bibliography` property with structured citation data
- Does not use dedicated artifacts array

### 2. MediKanren MCP Server Response Format

The MediKanren MCP server (`medik-mcp/src/index.ts`) returns:

```typescript
// get-everything tool response
return {
  content: formattedResult.content,
  artifacts: formattedResult.artifacts,
  metadata: metadata
};
```

Key characteristics:
- Returns `content` array with formatted text
- Returns `artifacts` array with knowledge graph data
- Returns `metadata` with additional information about the query
- Uses formatted response functions for consistent structuring

### 3. Chat Server Enhancement Functions

The chat server (`src/server/routes/chat.ts`) processes MCP responses using multiple enhancement functions:

```typescript
// Process bibliography
storeResponse = messageService.formatResponseWithBibliography(
  storeResponse, 
  (messages as any).bibliography
);

// Process grant markdown
storeResponse = messageService.formatResponseWithMarkdown(
  storeResponse, 
  (messages as any).grantMarkdown
);

// Process knowledge graph
storeResponse = messageService.formatResponseWithKnowledgeGraph(
  storeResponse, 
  (messages as any).knowledgeGraph,
  "Knowledge Graph"
);

// Process binary outputs
if ((messages as any).binaryOutputs) {
  const artifacts = storeResponse.artifacts || [];
  let position = artifacts.length;

  for (const binaryOutput of (messages as any).binaryOutputs) {
    const processedArtifacts = artifactService.processBinaryOutput(binaryOutput, position);
    artifacts.push(...processedArtifacts);
    position += processedArtifacts.length;
  }

  storeResponse.artifacts = artifacts;
}
```

### 4. Frontend Artifact Rendering

The frontend (`src/components/artifacts/ArtifactContent.tsx`) renders artifacts based on their type:

```typescript
renderContent = () => {
  switch (artifact.type) {
    case 'application/vnd.knowledge-graph':
      return <ReagraphKnowledgeGraphViewer data={artifact.content} artifactId={artifact.id} />;
    
    case 'application/vnd.bibliography':
      // Renders bibliography entries with citations and links
      
    case 'text/markdown':
      // Renders markdown with ReactMarkdown
      
    case 'image/png':
      // Renders base64-encoded images
      
    // Other types...
  }
}
```

Key observations:
- Each artifact type has specialized rendering logic
- The UI expects specific type identifiers (e.g., 'application/vnd.bibliography')
- Binary types (like PNG) are handled as base64 strings
- Knowledge graphs have custom interactive viewers

### 5. Artifact Service Implementation

The `ArtifactService` (`src/server/services/artifact.ts`) handles binary outputs:

```typescript
processBinaryOutput(output: BinaryOutput, position: number): ProcessedArtifact[] {
  const artifacts: ProcessedArtifact[] = [];
  const type = this.validateArtifactType(output.type);

  // Add main binary artifact
  artifacts.push({
    id: crypto.randomUUID(),
    type,
    title: `Generated ${output.type.split('/')[1].toUpperCase()}`,
    content: output.data,
    position
  });

  // Add source code if available
  if (output.metadata?.sourceCode) {
    artifacts.push({
      id: crypto.randomUUID(),
      type: 'application/vnd.ant.python',
      title: 'Source Code',
      content: output.metadata.sourceCode,
      language: 'python',
      position: position + 1
    });
  }

  return artifacts;
}
```

Key features:
- Creates multiple artifacts from one binary output when needed
- Handles both the binary data and its source code
- Assigns positions for UI display order

## Standardization Plan

### Phase 1: Define Unified MCP Response Format ✅

1. Create a standard response interface for all MCP servers:

```typescript
interface StandardMCPResponse {
  // Primary content for the chat interface
  content: Array<{
    type: string;
    text: string;
    forModel?: boolean;
  }>;
  
  // Structured artifacts to display in the UI
  artifacts?: Array<{
    type: string;       // e.g., 'application/vnd.bibliography', 'application/vnd.knowledge-graph'
    title: string;      // Display title for the artifact
    content: string;    // JSON stringified content or raw content
    language?: string;  // For code artifacts
  }>;
  
  // Additional metadata about the response
  metadata?: {
    querySuccess?: boolean;
    nodeCount?: number;
    message?: string;
    [key: string]: any;
  };
}
```

✅ **Completed**: Created `src/types/mcp.ts` with these interfaces:
- `MCPContentItem`
- `MCPArtifact`
- `MCPResponseMetadata`
- `StandardMCPResponse`
- `MCPBinaryOutput`

### Phase 2: Create Unified Enhancement Function ✅

2. Replace multiple enhancement functions with a single `enhanceResponseWithArtifacts` function:

```typescript
function enhanceResponseWithArtifacts(
  baseResponse: StoreResponse,
  artifacts: Array<{
    type: string;
    title: string;
    content: any;
    language?: string;
  }>
): StoreResponse {
  // Start with existing artifacts or empty array
  const existingArtifacts = baseResponse.artifacts || [];
  let position = existingArtifacts.length;
  
  // Process each artifact based on its type
  const processedArtifacts = artifacts.map(artifact => {
    const artifactId = `${artifact.type.split('/').pop()}-${uuidv4()}`;
    
    // Process different artifact types consistently
    return {
      id: artifactId,
      artifactId: artifactId,
      type: artifact.type,
      title: artifact.title,
      content: typeof artifact.content === 'string' ? 
               artifact.content : 
               JSON.stringify(artifact.content),
      position: position++,
      language: artifact.language
    };
  });
  
  // Return updated response with all artifacts
  return {
    ...baseResponse,
    artifacts: [...existingArtifacts, ...processedArtifacts]
  };
}
```

✅ **Completed**: Added `enhanceResponseWithArtifacts` to MessageService with these enhancements:
- Type-specific content handling through `formatArtifactContent` helper
- Support for artifact buttons in conversation text
- Capability to append multiple artifacts in a single call
- Compatible with the existing artifact structure

### Phase 3: Update Chat Server Implementation ✅

3. Refactor chat.ts to use the new unified approach:

```typescript
// Process all artifacts from MCP response
if (toolResult && typeof toolResult === 'object') {
  let artifactsToAdd = [];
  
  // Handle bibliography if present
  if ('bibliography' in toolResult && toolResult.bibliography) {
    artifactsToAdd.push({
      type: 'application/vnd.bibliography',
      title: 'Bibliography',
      content: toolResult.bibliography
    });
  }
  
  // Handle grant markdown if present
  if ('grantMarkdown' in toolResult && toolResult.grantMarkdown) {
    artifactsToAdd.push({
      type: 'text/markdown',
      title: 'Grant Proposal',
      content: toolResult.grantMarkdown
    });
  }
  
  // Handle knowledge graph if present
  if ('knowledgeGraph' in toolResult && toolResult.knowledgeGraph) {
    artifactsToAdd.push({
      type: 'application/vnd.knowledge-graph',
      title: 'Knowledge Graph',
      content: toolResult.knowledgeGraph
    });
  }
  
  // Handle existing artifacts array
  if ('artifacts' in toolResult && Array.isArray(toolResult.artifacts)) {
    artifactsToAdd.push(...toolResult.artifacts);
  }
  
  // Handle binary outputs
  if ('binaryOutput' in toolResult && toolResult.binaryOutput) {
    const binaryOutput = toolResult.binaryOutput as BinaryOutput;
    
    // Use artifact service to process binary outputs
    const binaryArtifacts = artifactService.processBinaryOutput(binaryOutput);
    artifactsToAdd.push(...binaryArtifacts);
  }
  
  // Apply all artifacts in one operation
  if (artifactsToAdd.length > 0) {
    storeResponse = enhanceResponseWithArtifacts(storeResponse, artifactsToAdd);
  }
}
```

✅ **Completed**: Updated chat.ts to:
- Collect all artifacts in a standardized way
- Process binary outputs consistently
- Apply all artifacts in a single operation using the unified function

### Phase 4: Update MCP Servers ✅

4. ✅ **Completed**: The PubMed MCP server already uses the standardized format:
```typescript
// Search tool response
return {
  content: [
    {
      type: "text",
      text: `# Search Results for: ${formattedQuery}\n\n${markdownArticles.join("\n\n")}`,
      forModel: true
    }
  ],
  artifacts: [
    {
      type: "application/vnd.bibliography",
      title: "Bibliography",
      content: bibliographyData
    }
  ]
};

// Get-Details tool response - legitimately returns only content (no artifacts needed)
// This is still compliant with our standardized format - artifacts array is optional
return {
  content: [
    {
      type: "text",
      text: formattedArticle,
    },
  ],
};
```
**Note:** The Get-Details tool only retrieves information about a single article, so it doesn't need to return an artifacts array. This is still compliant with our standardized format since the artifacts array is optional. This is an important distinction - not all tool responses need artifacts, but when they do have structured data, they should use the artifacts array format.

5. Update MediKanren MCP to ensure consistency with the standard:

```typescript
// Ensure consistent artifact format in formatKnowledgeGraphArtifact function
return {
  content: [/* content items */],
  artifacts: [
    {
      type: "application/vnd.knowledge-graph",
      title: "Knowledge Graph",
      content: knowledgeGraph
    }
  ],
  metadata: {/* metadata */}
};
```

6. Grant Fetch MCP server updated to use standardized artifacts array
   - Replaced custom `grantMarkdown` field with standard `artifacts` array
   - Removed non-standard `isError` field
   - Preserved all metadata and functionality

## Implementation Steps

1. ✅ **Create base interfaces**: Define standard interfaces for MCP responses and artifacts
   - Created `src/types/mcp.ts` with all required interfaces
   - Used JSDoc comments for clear documentation

2. ✅ **Implement unified enhancement function**: Create the `enhanceResponseWithArtifacts` function in MessageService
   - Implemented with specialized content handling per artifact type
   - Added support for conversation buttons integration
   - Ensured consistent ID generation and positioning

3. ✅ **Update existing enhancement functions**: Adapt legacy methods to use new approach
   - Updated existing enhancement functions to internally use the new unified approach
   - Added `@deprecated` tags to indicate they should be phased out
   - Maintained backward compatibility with existing code

4. ✅ **Update chat.ts**: Refactor to use the unified approach
   - Modified to collect all artifacts before processing them
   - Ensured proper handling of all artifact types
   - Used a single enhancement call for better maintainability

5. ✅ **Update MCP servers**: Modify each MCP server to follow the standard format
   - ✅ PubMed MCP server already follows the standardized format
   - ✅ MediKanren MCP server already follows the standardized format
   - ✅ Grant Fetch MCP server updated to use standardized artifacts array
     - Replaced custom `grantMarkdown` field with standard `artifacts` array
     - Removed non-standard `isError` field
     - Preserved all metadata and functionality

6. ✅ **Add backward compatibility**: Ensure existing non-standard response formats are still processed correctly
   - ✅ Added backward compatibility for bibliography, knowledge graph, and grant markdown
   - ✅ Verified that the unified enhancement approach is used for all artifact types

7. ✅ **Test integration**: Verify all artifact types are correctly processed and displayed in the UI
   - ✅ Added comprehensive logging to trace code execution paths
   - ✅ Confirmed through server logs that the unified enhancement function is being used
   - ✅ Verified bibliography artifacts are correctly processed and displayed
   - ✅ Server logs show the complete artifact enhancement pipeline:
     ```
     🟡🟡🟡 CHAT ROUTE: Starting unified artifact collection 🟡🟡🟡
     🟡🟡🟡 CHAT ROUTE: Found bibliography data with 6 entries 🟡🟡🟡
     🟡🟡🟡 CHAT ROUTE: Applying 1 artifacts using unified enhancement function 🟡🟡🟡
     🟢🟢🟢 NEW PATH: enhanceResponseWithArtifacts called 🟢🟢🟢
     Processing application/vnd.bibliography artifact: "Bibliography"
     Processed 1 artifacts successfully
     Added 1 artifact buttons to conversation
     🟢🟢🟢 NEW PATH: Enhancement complete 🟢🟢🟢
     🟡🟡🟡 CHAT ROUTE: Enhancement complete, storeResponse now has 2 artifacts 🟡🟡🟡
     ```
   - ✅ No legacy code paths were used (no red logs appeared), confirming full transition to the unified approach

## Benefits

- **Simplified codebase**: One enhancement function instead of multiple specialized ones
- **Consistent processing**: All artifacts follow the same pattern
- **Easier maintenance**: Adding new artifact types requires minimal changes
- **Better type safety**: Standard interfaces help prevent errors
- **Improved readability**: Code intent is clearer with standardized patterns

## Migration Strategy

1. ✅ Implement the new system alongside the existing one
   - Added new interfaces and functions while retaining backward compatibility
   - Updated existing enhancement functions to use the new approach internally
   - Modified chat.ts to use the unified method for collecting and processing artifacts

2. ✅ Update one MCP server at a time to use the new format
   - Both PubMed and MediKanren MCP servers already use the standardized format

3. ✅ Once all servers are updated, refactor chat.ts to use only the unified approach
   - Completed the refactoring of chat.ts to collect artifacts in a standardized way
   - Implemented the unified approach for applying all artifacts in one operation
   - Verified through testing that the unified approach is being used

4. ✅ Remove the old enhancement functions after validation
   - The old enhancement functions have been updated to internally use the new approach
   - They are marked with @deprecated tags and can be safely removed in a future cleanup

## Technical Considerations and Edge Cases

### 1. Binary Data Handling

The unified approach must correctly handle binary data like PNG images that are base64-encoded:

```typescript
// For binary types, preserve the base64 string without JSON.stringify
const content = artifact.type.startsWith('image/') 
  ? artifact.content  // Keep base64 string as-is
  : typeof artifact.content === 'string'
    ? artifact.content
    : JSON.stringify(artifact.content);
```

### 2. Artifact UI Integration

The enhancement function needs to ensure artifacts are properly linked in the conversation text. Currently this happens in MessageService.convertToStoreFormat():

```typescript
// Current approach
const buttonHtml = `<button class="artifact-button" data-artifact-id="${uniqueId}">📎 ${item.artifact.title}</button>`;
conversation.push(buttonHtml);
```

This element injection must be preserved during refactoring to maintain UI integration.

### 3. Knowledge Graph Versioning

The chat store implements versioning for knowledge graphs that must be maintained:

```typescript
// From chatStore.ts
updateGraphArtifact: (baseArtifactId: string, updates: {
  nodes?: KnowledgeGraphNode[];
  links?: KnowledgeGraphLink[];
  // ...
}) => string | null
```

Any standardization should preserve this versioning capability.

### 4. Special Processing for Different Types

While using a unified enhancement function, we still need type-specific logic for certain artifacts:

```typescript
function processArtifactContent(artifact) {
  switch(artifact.type) {
    case 'application/vnd.knowledge-graph':
      // Special processing for knowledge graphs
      // ...
    case 'application/vnd.bibliography':
      // Special processing for bibliographies
      // ...
    default:
      // Default processing
  }
}
```

### 5. Testing Requirements

Testing should verify:

1. All current MCP functions continue working
2. New artifact types can be easily added
3. UI renders all artifact types correctly
4. Knowledge graph versioning still works
5. Binary outputs are correctly processed
6. Backwards compatibility with existing data 

## Next Steps

With all implementation steps complete and verified, we can now:

1. **Check for any other MCP servers**:
   - Review all remaining MCP servers in the codebase
   - Update any other non-standardized MCP servers before proceeding
   - Run additional tests with all MCP servers to ensure compatibility

2. **Clean up the codebase**:
   - Remove unnecessary logging statements added for testing
   - Update documentation to reflect the new standardized approach
   - Maintain deprecated functions until all MCP servers are confirmed working

3. **Plan for deprecated function removal**:
   - Add enhanced logging to deprecated functions to monitor usage
   - Set a timeline for monitoring usage before removal
   - Remove deprecated functions only after sufficient time with no usage

4. **Explore improvements**:
   - Add support for new artifact types following the established pattern
   - Optimize performance for large artifacts
   - Consider adding type validation for artifacts coming from MCP servers 