# Unified MCP Artifact Display System Plan

## Overview

This document outlines a comprehensive plan for creating a unified system to display artifacts from various MCP (Model Context Protocol) servers. The goal is to establish a standardized approach that can handle all current artifact types and be easily extended for future types.

## Current Implementation Analysis

### Artifact Processing Flow

1. **MCP Server Response**: Each MCP server returns a response following the `StandardMCPResponse` interface with:
   - `content`: Array of content items (primarily text)
   - `artifacts`: Array of structured artifacts (bibliography, knowledge graph, etc.)
   - `metadata`: Additional information about the response

2. **Server-side Processing**: 
   - `MessageService.enhanceResponseWithArtifacts()` processes artifacts
   - `ArtifactService.processBinaryOutput()` handles binary artifacts
   - Chat route collects artifacts from various sources and applies them

3. **Client-side Display**:
   - `ArtifactContent.tsx` renders artifacts based on type
   - `ArtifactDrawer.tsx` provides a list of available artifacts
   - `useChatStore` manages artifacts and their selection state

### Key Components

#### 1. Types and Interfaces

```typescript
// Core artifact types
export type ArtifactType = 
  | 'text/markdown'
  | 'application/vnd.bibliography'
  | 'application/vnd.knowledge-graph'
  | 'image/png'
  // Other supported types...

// Client-side artifact structure
export interface Artifact {
  id: string;
  artifactId: string;
  type: ArtifactType;
  title: string;
  content: string;
  timestamp: Date;
  position: number;
  language?: string;
  sourceCode?: string;
  // Additional fields for versioning...
}

// Server-side MCP artifact structure
export interface MCPArtifact {
  type: string;
  title: string;
  content: any;
  language?: string;
}
```

#### 2. Server-side Artifact Processing

The `MessageService` includes methods to process artifacts:

```typescript
// Unified processing function
enhanceResponseWithArtifacts(
  baseResponse: StoreFormat,
  artifacts: MCPArtifact[],
  appendButtons: boolean = true
): StoreFormat {
  // Process artifacts and add to store format
  // Create artifact buttons in conversation text
  // Format content based on type
}

// Content formatting by type
private formatArtifactContent(artifact: MCPArtifact): string {
  // Handle images differently than JSON data
  // Ensure content is properly stringified
}
```

#### 3. Client-side Rendering

The `ArtifactContent` component renders artifacts based on type:

```typescript
const renderContent = () => {
  switch (artifact.type) {
    case 'application/vnd.knowledge-graph':
      return <ReagraphKnowledgeGraphViewer data={artifact.content} artifactId={artifact.id} />;
    case 'text/markdown':
      return <ReactMarkdown>{artifact.content}</ReactMarkdown>;
    case 'application/vnd.bibliography':
      // Bibliography rendering
    case 'image/png':
      // Image rendering
    default:
      return renderFallbackContent(artifact.content);
  }
};
```

## Challenges with Current Implementation

1. **Type-specific Rendering Logic**: The `renderContent` function uses a large switch statement
2. **Tight Coupling**: UI components are tightly coupled to specific artifact types
3. **Limited Extensibility**: Adding new types requires modifying multiple components
4. **Inconsistent Content Handling**: Different processing for similar content types
5. **No Plugin Architecture**: Cannot easily add renderers for new types

## Unified Display Plan

### Phase 1: Artifact Type Registry System

Create a registry system to dynamically map artifact types to their renderers:

```typescript
// src/services/ArtifactTypeRegistry.ts
export interface ArtifactRendererProps {
  artifact: Artifact;
  onUpdate?: (content: string) => void;
}

class ArtifactTypeRegistry {
  private renderers: Map<string, React.ComponentType<ArtifactRendererProps>> = new Map();
  private fallbackRenderer: React.ComponentType<ArtifactRendererProps>;
  
  constructor() {
    this.fallbackRenderer = FallbackRenderer;
  }
  
  registerRenderer(type: string, renderer: React.ComponentType<ArtifactRendererProps>) {
    this.renderers.set(type, renderer);
    return this; // Enable chaining
  }
  
  getRenderer(type: string): React.ComponentType<ArtifactRendererProps> {
    return this.renderers.get(type) || this.fallbackRenderer;
  }
  
  setFallbackRenderer(renderer: React.ComponentType<ArtifactRendererProps>) {
    this.fallbackRenderer = renderer;
    return this;
  }
}

// Create singleton instance
export const artifactTypeRegistry = new ArtifactTypeRegistry();

// Hook for components
export function useArtifactTypeRegistry() {
  return artifactTypeRegistry;
}
```

### Phase 2: Dedicated Renderer Components

Create individual renderer components for each artifact type:

```typescript
// src/components/artifacts/renderers/MarkdownRenderer.tsx
export const MarkdownRenderer: React.FC<ArtifactRendererProps> = ({ artifact }) => {
  return (
    <div className="prose max-w-none dark:prose-invert">
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
        {artifact.content}
      </ReactMarkdown>
    </div>
  );
};

// src/components/artifacts/renderers/KnowledgeGraphRenderer.tsx
export const KnowledgeGraphRenderer: React.FC<ArtifactRendererProps> = ({ artifact }) => {
  const [useReagraph, setUseReagraph] = useState(true);
  
  return (
    <div className="w-full h-full min-h-[400px] flex flex-col">
      {useReagraph ? (
        <ReagraphKnowledgeGraphViewer 
          data={artifact.content} 
          artifactId={artifact.id}
        />
      ) : (
        <KnowledgeGraphViewer 
          data={artifact.content} 
          artifactId={artifact.id}
          showVersionControls={true}
        />
      )}
    </div>
  );
};

// Other renderer components...
```

### Phase 3: Plugin Registration System

Create a plugin system for registering renderers:

```typescript
// src/plugins/artifactRenderers.ts
import { artifactTypeRegistry } from '../services/ArtifactTypeRegistry';
import { MarkdownRenderer } from '../components/artifacts/renderers/MarkdownRenderer';
import { KnowledgeGraphRenderer } from '../components/artifacts/renderers/KnowledgeGraphRenderer';
import { BibliographyRenderer } from '../components/artifacts/renderers/BibliographyRenderer';
import { ImageRenderer } from '../components/artifacts/renderers/ImageRenderer';
import { FallbackRenderer } from '../components/artifacts/renderers/FallbackRenderer';

// Register all built-in renderers
export function registerBuiltinRenderers() {
  artifactTypeRegistry
    .setFallbackRenderer(FallbackRenderer)
    .registerRenderer('text/markdown', MarkdownRenderer)
    .registerRenderer('application/vnd.knowledge-graph', KnowledgeGraphRenderer)
    .registerRenderer('application/vnd.ant.knowledge-graph', KnowledgeGraphRenderer)
    .registerRenderer('application/vnd.bibliography', BibliographyRenderer)
    .registerRenderer('image/png', ImageRenderer)
    .registerRenderer('image/svg+xml', SvgRenderer);
}

// Allow external plugins to register their own renderers
export function registerExternalRenderer(type: string, renderer: React.ComponentType<ArtifactRendererProps>) {
  artifactTypeRegistry.registerRenderer(type, renderer);
}
```

### Phase 4: Updated ArtifactContent Component

Refactor the ArtifactContent component to use the registry:

```typescript
// src/components/artifacts/ArtifactContent.tsx
import { useArtifactTypeRegistry } from '../../services/ArtifactTypeRegistry';

export const ArtifactContent: React.FC<{
  artifact: Artifact;
  storageService?: any;
}> = ({ artifact, storageService }) => {
  const [viewMode, setViewMode] = useState<'rendered' | 'source'>('rendered');
  const registry = useArtifactTypeRegistry();
  
  const renderContent = () => {
    if (viewMode === 'source') {
      return <SourceView artifact={artifact} />;
    }
    
    // Get the appropriate renderer for this artifact type
    const Renderer = registry.getRenderer(artifact.type);
    return <Renderer artifact={artifact} />;
  };
  
  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
      {/* Header, controls, etc. */}
      <div className="flex-1 overflow-y-auto min-h-0 p-4">
        {renderContent()}
      </div>
      {/* Footer, copy button, etc. */}
    </div>
  );
};
```

### Phase 5: Content Type Auto-detection

Implement a service for automatic content type detection:

```typescript
// src/services/ContentTypeDetector.ts
export class ContentTypeDetector {
  detectType(content: string): string {
    // Check if it's valid JSON
    try {
      JSON.parse(content);
      
      // Try to determine if it's a knowledge graph
      const parsed = JSON.parse(content);
      if (parsed.nodes && parsed.links) {
        return 'application/vnd.knowledge-graph';
      }
      
      return 'application/json';
    } catch (e) {
      // Not JSON, continue checking
    }
    
    // Check if it's Markdown
    if (content.match(/^#+ |^-+ |^\* |^```|^> /m)) {
      return 'text/markdown';
    }
    
    // Check if it's HTML
    if (content.match(/<\/?[a-z][\s\S]*>/i)) {
      return 'html';
    }
    
    // Default to plain text
    return 'text';
  }
}

export const contentTypeDetector = new ContentTypeDetector();
```

### Phase 6: Metadata-driven UI Adaptations

Implement customizable UI elements based on artifact metadata:

```typescript
// src/components/artifacts/ArtifactHeader.tsx
export const ArtifactHeader: React.FC<{
  artifact: Artifact;
  viewMode: 'rendered' | 'source';
  setViewMode: (mode: 'rendered' | 'source') => void;
}> = ({ artifact, viewMode, setViewMode }) => {
  // Determine available actions based on artifact type and metadata
  const actions = [];
  
  // Knowledge graph specific controls
  if (artifact.type.includes('knowledge-graph')) {
    actions.push(
      <KnowledgeGraphVersionControls 
        key="graph-controls"
        artifact={artifact} 
      />
    );
  }
  
  // Markdown specific controls
  if (artifact.type === 'text/markdown') {
    actions.push(
      <SaveToProjectButton 
        key="save-project"
        artifact={artifact} 
      />
    );
  }
  
  return (
    <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 rounded-t-lg">
      <div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">{artifact.title}</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Type: {artifact.type === 'code' && artifact.language ? `${artifact.type} (${artifact.language})` : artifact.type}
        </p>
      </div>
      <div className="flex items-center space-x-2">
        {actions}
        {canToggleView(artifact.type) && (
          <button
            onClick={() => setViewMode(viewMode === 'rendered' ? 'source' : 'rendered')}
            className="px-3 py-1 text-sm bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm"
          >
            {viewMode === 'rendered' ? 'View Source' : 'View Rendered'}
          </button>
        )}
      </div>
    </div>
  );
};
```

## Implementation Strategy

### Step 1: Create Core Services

1. Implement the ArtifactTypeRegistry class
2. Create the ContentTypeDetector service
3. Set up the plugin registration system

### Step 2: Split Renderer Components

1. Extract each artifact type renderer into its own component
2. Implement the fallback renderer with auto-detection
3. Set up the registry with all built-in renderers

### Step 3: Refactor ArtifactContent

1. Update ArtifactContent to use the registry
2. Implement the new metadata-driven header component
3. Create a SourceView component for all artifact types

### Step 4: Test and Validate

1. Test with each existing artifact type
2. Verify backward compatibility
3. Test with new, unknown artifact types

## Benefits

1. **Extensibility**: New artifact types can be added without modifying core components
2. **Separation of Concerns**: Each renderer is responsible for a single artifact type
3. **Simplified Core**: ArtifactContent becomes simple and maintainable
4. **Plugin Architecture**: External renderers can be registered dynamically
5. **Type Safety**: Better typing throughout the artifact display system
6. **Consistent UI**: Standardized approach to artifact rendering

## Compatibility Considerations

- The registry will default to the fallback renderer for unknown types
- All existing artifact functionality will be preserved
- Backward compatibility with existing store format
- No changes to MCP server response formats

## Future Enhancements

1. **Custom Configuration**: Allow renderers to have configurable options
2. **Interactive Artifacts**: Support for artifacts that can be modified by the user
3. **Renderer Composition**: Ability to compose renderers for complex artifact types
4. **Accessibility Improvements**: Ensure all renderers are fully accessible
5. **Mobile Optimization**: Responsive design for all artifact renderers 