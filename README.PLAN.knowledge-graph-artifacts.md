# Knowledge Graph Artifact Enhancement Plan

## Goals
- Treat knowledge graph artifacts similar to bibliography artifacts
- Enhance the mediKanren MCP server to accumulate knowledge graphs over time
- Create a consistent, merged representation of knowledge across multiple queries
- Update the UI to display merged knowledge graphs

## Implementation Steps

1. ✅ **Standardize Knowledge Graph Data Format**
   - ✅ Define standard interfaces for knowledge graph data
   - ✅ Create type definitions for nodes and links
   - ✅ Ensure consistency with existing knowledge graph viewer component

2. ✅ **Implement Knowledge Graph Merging Functionality**
   - ✅ Create utility function to merge multiple knowledge graphs
   - ✅ Implement node deduplication based on IDs
   - ✅ Implement link deduplication based on source, target, and label
   - ✅ Add support for merging evidence arrays

3. ✅ **Server-Side Knowledge Graph Processing**
   - ✅ Update chat router to detect knowledge graph artifacts
   - ✅ Add code to process and merge knowledge graphs over time
   - ✅ Store the merged graph in the message state

4. ✅ **Message Service Enhancement**
   - ✅ Add method to format responses with knowledge graph artifacts
   - ✅ Ensure consistent handling with other artifact types
   - ✅ Add support for optional metadata and title

5. ✅ **Add Knowledge Graph UI Components**
   - ✅ Create dedicated UI component for knowledge graph link
   - ✅ Update chat message component to show knowledge graph links
   - ✅ Ensure consistent styling with other artifact links

6. ✅ **Update Type Definitions**
   - ✅ Add knowledge graph to list of supported artifact types
   - ✅ Update validation functions to support knowledge graph data
   - ✅ Ensure proper TypeScript interfaces throughout the codebase

7. ✅ **Documentation and Testing**
   - ✅ Create documentation explaining knowledge graph artifact handling
   - ✅ Test the implementation with the mediKanren MCP server
   - ✅ Verify merging functionality and UI display
   - ✅ Create examples of knowledge graph usage

## Technical Details

### Knowledge Graph Data Structure

```typescript
interface KnowledgeGraph {
  nodes: KnowledgeGraphNode[];
  links: KnowledgeGraphLink[];
  metadata?: {
    title?: string;
    description?: string;
    source?: string;
    timestamp?: string;
    [key: string]: any;
  };
}

interface KnowledgeGraphNode {
  id: string;
  name: string;
  group?: number;
  entityType?: string;
  val?: number;
  [key: string]: any;
}

interface KnowledgeGraphLink {
  source: string;
  target: string;
  label?: string;
  value?: number;
  evidence?: string[];
  [key: string]: any;
}
```

### Merging Algorithm

The merging algorithm works as follows:
1. Combine all nodes from both graphs
2. Deduplicate nodes based on their IDs
3. Combine all links from both graphs
4. Deduplicate links based on source, target, and label
5. For duplicate links, merge any evidence arrays

## Progress Tracking

| Component | Status | Location |
|-----------|--------|----------|
| Knowledge Graph Interfaces | ✅ Complete | `src/utils/knowledgeGraphUtils.ts` |
| Merging Function | ✅ Complete | `src/utils/knowledgeGraphUtils.ts` |
| Chat Router Updates | ✅ Complete | `src/server/routes/chat.ts` |
| Message Service Method | ✅ Complete | `src/server/services/message.ts` |
| UI Components | ✅ Complete | `src/components/chat/ChatMessages.tsx` |
| Documentation | ✅ Complete | `README.KNOWLEDGE-GRAPH-ARTIFACTS.md` |
| Testing | ✅ Complete | Tested with demo.js script |

## Next Steps

All implementation steps have been completed and tested. The knowledge graph artifact handling is now ready for use in production. Any future enhancements would focus on:

1. Advanced visualization options for complex knowledge graphs
2. Additional merging strategies for specific use cases
3. Performance optimizations for very large knowledge graphs
4. Specialized filtering and query capabilities for knowledge graph data

## References

- [Current Bibliography Handling Code](src/server/routes/chat.ts)
- [Existing Knowledge Graph Viewer](src/components/artifacts/KnowledgeGraphViewer.tsx)
- [MediKanren Knowledge Graph Format](custom-mcp-servers/medik-mcp/src/formatters.ts) 