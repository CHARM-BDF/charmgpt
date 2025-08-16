# Comprehensive MCP Artifact System Plan

This document integrates two related plans:
1. **Server-side MCP Response Standardization** (from `README.PLAN.UPDATE.MCP_ARTIFACT.md`)
2. **Client-side Artifact Display System** (from `README.PLAN.MCP_ARTIFACT_DISPLAY.md`)

Together, these create an end-to-end solution for handling artifacts throughout the application.

## 1. Overview

The MCP (Model Context Protocol) Artifact System consists of:

1. **MCP Servers** that generate specialized artifacts (bibliography, knowledge graphs, etc.)
2. **Server-side Processing** that standardizes and enhances these artifacts
3. **Client-side Components** that display artifacts in the UI

This plan addresses all three aspects to create a cohesive, extensible system.

## 2. Server-side Standardization (Completed)

### 2.1 Standardized Response Format

All MCP servers now use a consistent `StandardMCPResponse` format:

```typescript
interface StandardMCPResponse {
  // Primary content for the chat interface
  content: MCPContentItem[];
  
  // Structured artifacts to display in the UI
  artifacts?: MCPArtifact[];
  
  // Additional metadata about the response
  metadata?: MCPResponseMetadata;
}
```

### 2.2 Unified Enhancement Function

Server processing uses a central `enhanceResponseWithArtifacts` function:

```typescript
function enhanceResponseWithArtifacts(
  baseResponse: StoreResponse,
  artifacts: MCPArtifact[],
  appendButtons: boolean = true
): StoreResponse {
  // Process artifacts and format content based on type
  // Create artifact buttons in conversation
  // Return enhanced response
}
```

### 2.3 Backwards Compatibility

The system still supports legacy formats through a standardized collection process:

```typescript
// In chat.ts
// Collect artifacts from various sources
let artifactsToAdd = [];

// Handle bibliography if present
if ((messages as any).bibliography) {
  artifactsToAdd.push({
    type: 'application/vnd.bibliography',
    title: 'Bibliography',
    content: (messages as any).bibliography
  });
}

// Similar handling for grantMarkdown, knowledgeGraph, etc.

// Apply all artifacts in one operation
if (artifactsToAdd.length > 0) {
  storeResponse = messageService.enhanceResponseWithArtifacts(storeResponse, artifactsToAdd);
}
```

### 2.4 Content Format Handling (Immediate Fix - Completed)

We encountered an issue where some custom MCP servers were returning nested content structures that weren't displaying properly. 

**Original Plan**: Update the server-side `formatArtifactContent` function to detect and handle nested content structures.

**Actual Implementation**: We found that a client-side fix was more immediate and effective. We modified the `ArtifactContent.tsx` component to detect and extract nested content:

```typescript
// In src/components/artifacts/ArtifactContent.tsx
case 'text/markdown':
  const trimmedContent = (() => {
    // Check if we have a JSON string with nested content
    if (artifact.content.trim().startsWith('{')) {
      try {
        const parsed = JSON.parse(artifact.content);
        // If it has a content property, use that instead
        if (parsed.content) {
          console.log('Found nested content in artifact, extracting inner content');
          return typeof parsed.content === 'string' 
            ? parsed.content.split('\n').map((line: string) => line.trimStart()).join('\n')
            : artifact.content.split('\n').map((line: string) => line.trimStart()).join('\n');
        }
      } catch (e) {
        console.log('Content looks like JSON but failed to parse:', e);
      }
    }
    // Default trimming for normal content
    return artifact.content.split('\n').map((line: string) => line.trimStart()).join('\n');
  })();

  return (
    <div className="prose max-w-none dark:prose-invert">
      <ReactMarkdown>
        {trimmedContent}
      </ReactMarkdown>
    </div>
  );
```

This client-side approach proved effective because:
1. It works immediately without requiring server changes or restarts
2. It handles both old and new artifacts
3. It provides a more direct fix where the rendering actually happens
4. It can be deployed independently from server changes

The server-side fix described in section 2.4 is still a good long-term approach, but the client-side solution has resolved the immediate issue.

## 3. Client-side Display System (To Be Implemented)

### 3.1 Artifact Type Registry

Create a registry to map artifact types to their renderers:

```typescript
class ArtifactTypeRegistry {
  private renderers: Map<string, React.ComponentType<ArtifactRendererProps>> = new Map();
  private fallbackRenderer: React.ComponentType<ArtifactRendererProps>;
  
  registerRenderer(type: string, renderer: React.ComponentType<ArtifactRendererProps>) {
    this.renderers.set(type, renderer);
    return this;
  }
  
  getRenderer(type: string): React.ComponentType<ArtifactRendererProps> {
    return this.renderers.get(type) || this.fallbackRenderer;
  }
}
```

### 3.2 Modular Renderer Components

Create dedicated components for each artifact type:

```typescript
// For Markdown artifacts
export const MarkdownRenderer: React.FC<ArtifactRendererProps> = ({ artifact }) => {
  return (
    <div className="prose max-w-none dark:prose-invert">
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
        {artifact.content}
      </ReactMarkdown>
    </div>
  );
};

// Similar components for KnowledgeGraph, Bibliography, etc.
```

### 3.3 Plugin Registration System

Enable dynamic registration of renderers:

```typescript
export function registerBuiltinRenderers() {
  artifactTypeRegistry
    .setFallbackRenderer(FallbackRenderer)
    .registerRenderer('text/markdown', MarkdownRenderer)
    .registerRenderer('application/vnd.knowledge-graph', KnowledgeGraphRenderer)
    // Register other built-in renderers
}
```

### 3.4 Content Type Auto-detection

Implement smart detection for unknown content types:

```typescript
export class ContentTypeDetector {
  detectType(content: string): string {
    // Detect JSON structure (knowledge graphs, etc.)
    try {
      const parsed = JSON.parse(content);
      if (parsed.nodes && parsed.links) {
        return 'application/vnd.knowledge-graph';
      }
      return 'application/json';
    } catch (e) {
      // Not JSON, continue checking...
    }
    
    // Check for markdown, HTML, etc.
    // Return appropriate type or default to text
  }
}
```

## 4. Integration Points

### 4.1 Artifact Flow Through the System

1. **Creation**: MCP Server produces artifact in standard format
2. **Processing**: Server enhances response with artifacts
3. **Storage**: Artifacts stored in chat store
4. **Rendering**: Client components display artifacts using appropriate renderer

### 4.2 Type Handling Consistency

The system maintains type consistency through:

1. **Type Definition**: Standardized type names (e.g., 'application/vnd.knowledge-graph')
2. **Content Formatting**: Consistent formatting based on type
3. **Renderer Mapping**: Registry maps each type to the appropriate renderer

### 4.3 Data Flow Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │     │                 │
│   MCP Servers   │────▶│  Chat Server    │────▶│  Client Store   │
│                 │     │                 │     │                 │
└─────────────────┘     └─────────────────┘     └────────┬────────┘
                                                          │
                                                          ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │     │                 │
│ Type Registry   │◀────│ Artifact        │◀────│ Artifact        │
│ & Renderers     │     │ Components      │     │ Selection       │
│                 │     │                 │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

## 5. Implementation Sequence

### Phase I: Server-side Standardization (Completed)

1. ✅ Define standard interfaces for MCP responses
2. ✅ Implement unified artifact enhancement function
3. ✅ Update existing enhancement functions with unified approach
4. ✅ Refactor chat.ts to use the unified approach
5. ✅ Update MCP servers to follow standard format
6. ✅ Add backward compatibility for non-standard formats
7. ✅ Test integration of all artifact types

### Phase IA: Immediate Content Formatting Fix (Completed)

1. ✅ Identified issue with nested JSON content in Grant Fetch MCP artifacts
2. ✅ Implemented client-side fix in ArtifactContent.tsx to detect and extract nested content
3. ✅ Tested fix with Grant Fetch MCP content, confirming proper rendering
4. ✅ Documented the approach for future reference

The client-side fix proved to be more immediate and effective than the originally planned server-side approach. It correctly identifies JSON-formatted content with a nested content property, extracts the inner content, and properly displays it in the UI.

### Phase II: Registry and Renderer Foundation

1. Create ArtifactTypeRegistry class
2. Implement ContentTypeDetector service
3. Create base ArtifactRendererProps interface
4. Implement FallbackRenderer with auto-detection
5. Set up plugin registration system

### Phase III: Extract Dedicated Renderers

1. Extract MarkdownRenderer component
2. Extract KnowledgeGraphRenderer component
3. Extract BibliographyRenderer component
4. Extract ImageRenderer component
5. Create specialized renderers for other types
6. Set up registry with all extracting renderers

### Phase IV: Refactor ArtifactContent

1. Update ArtifactContent to use the registry
2. Create SourceView component for source display
3. Implement metadata-driven header component
4. Add specialized controls based on artifact type
5. Test with all existing artifact types

### Phase V: Enhancement and Optimization

1. Add content type auto-detection for fallback cases
2. Implement renderer configuration options
3. Add interactive capabilities to renderers
4. Optimize performance for large artifacts
5. Add accessibility improvements

### Phase VI: Future MCP Server Standardization

1. Create clear content format specifications for MCP servers
2. Document standard formats for each artifact type
3. Update existing custom MCP servers to use standardized formats
4. Create templates and examples for future MCP server development
5. Phase out special handling for non-standard formats

## 6. Benefits of Integrated Approach

### 6.1 Technical Benefits

1. **End-to-End Type Consistency**: Same type definitions throughout the system
2. **Modular Architecture**: Each component has a single responsibility
3. **Extensibility**: Easy to add new artifact types and renderers
4. **Maintainability**: Centralized type handling and rendering logic
5. **Performance**: Optimized rendering based on artifact type

### 6.2 User Experience Benefits

1. **Consistent Display**: Artifacts render consistently across the application
2. **Type-Specific Controls**: UI adapts based on artifact type
3. **Fallback Handling**: Unknown content types still render appropriately
4. **Responsive UI**: Registry-based approach improves performance

### 6.3 Developer Experience Benefits

1. **Clear Architecture**: Well-defined responsibilities and interfaces
2. **Plugin System**: Easy to add new artifact types and renderers
3. **Reduced Boilerplate**: Registry handling reduces repetitive code
4. **Improved Testing**: Components can be tested in isolation

## 7. Compatibility Considerations

1. **Backward Compatibility**: Supports existing artifact formats
2. **Forward Compatibility**: Ready for new artifact types
3. **Store Compatibility**: No changes to underlying data structure
4. **MCP Server Compatibility**: Works with both old and new server formats

## 8. Future Enhancements

1. **Custom Configuration**: Allow renderers to have configurable options
2. **Interactive Artifacts**: Support for artifacts that can be modified by the user
3. **Renderer Composition**: Ability to compose renderers for complex artifact types
4. **Multi-format Support**: Handle multiple representations of the same data
5. **Accessibility Improvements**: Ensure all renderers are fully accessible
6. **Mobile Optimization**: Responsive design for all artifact renderers

## 9. Technical Debt Reduction

This integrated approach addresses several areas of technical debt:

1. **Removal of Large Switch Statements**: Registry replaces complex conditionals
2. **Elimination of Duplicated Logic**: Centralized type handling
3. **Reduction of Tight Coupling**: Components depend on interfaces, not implementations
4. **Improved Type Safety**: Consistent type definitions throughout
5. **Documentation**: Clear architecture and responsibilities

## 10. Conclusion

The comprehensive MCP Artifact System creates a consistent, extensible framework for handling specialized content from MCP servers. By standardizing both the server-side processing and client-side rendering, we create a cohesive system that's easy to maintain and extend with new artifact types.

The completed server-side standardization provides a solid foundation for building the improved client-side display system. Together, they create an end-to-end solution for managing the diverse artifacts that MCP servers can produce.

Our approach has proven flexible and robust, allowing us to successfully address immediate display issues (like the Grant Fetch MCP nested content) while building toward a more structured, maintainable architecture for the future. The client-side fix demonstrates the value of having multiple layers of handling to ensure proper content display regardless of format variations. 