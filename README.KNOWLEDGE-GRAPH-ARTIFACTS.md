# Knowledge Graph Artifact Handling

## Overview

This documentation explains how knowledge graph artifacts are processed, merged, and displayed in the Charm MCP framework. Knowledge graphs provide a visual representation of relationships between entities, allowing users to explore connections in the data.

## Features

- Standardized knowledge graph data structure
- Automatic merging of knowledge graphs with deduplication
- Progressive growth of knowledge graphs across multiple requests
- Dedicated UI components for knowledge graph visualization
- Seamless integration with the existing artifact framework

## Technical Implementation

### Data Structure

Knowledge graphs follow a standard structure:

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

All knowledge graph artifacts use the MIME type `application/vnd.knowledge-graph`.

### Merging Logic

When multiple knowledge graphs are generated across different requests, they are automatically merged:

1. Nodes are deduplicated based on their IDs
2. Links are deduplicated based on source, target, and label
3. Evidence arrays for duplicate links are combined with duplicate removal
4. The merged knowledge graph is included in responses and grows over time

The merging process is handled by the `mergeKnowledgeGraphs` function in `src/utils/knowledgeGraphUtils.ts`.

### Processing Flow

1. Knowledge graph artifacts from tool results are detected in the chat router
2. If this is the first knowledge graph, it's stored in the message state
3. If a knowledge graph already exists, the new one is merged with it
4. The knowledge graph is added to the response artifacts with a unique ID
5. The UI displays a link to view the knowledge graph

### Component Integration

The following components are part of the knowledge graph processing:

- `KnowledgeGraphViewer`: Core visualization component
- `KnowledgeGraphLinkLucide`: UI component for viewing knowledge graphs in chat
- `formatResponseWithKnowledgeGraph`: Method to add knowledge graphs to responses

## Usage Example

When an MCP server returns a knowledge graph artifact:

```javascript
// Tool result from an MCP server
const toolResult = {
  content: [
    { type: 'text', text: 'Here is some information...' }
  ],
  artifacts: [
    {
      type: 'application/vnd.knowledge-graph',
      title: 'Disease Relationships',
      content: JSON.stringify({
        nodes: [
          { id: 'MONDO:0011719', name: 'gastrointestinal stromal tumor', group: 3, entityType: 'Disease' },
          { id: 'DRUGBANK:DB14723', name: 'larotrectinib', group: 1, entityType: 'Drug' }
        ],
        links: [
          { 
            source: 'DRUGBANK:DB14723', 
            target: 'MONDO:0011719', 
            label: 'treats',
            evidence: ['PMID:12345678'] 
          }
        ]
      })
    }
  ]
};
```

The system will:
1. Extract the knowledge graph from the artifacts
2. Merge it with any existing knowledge graph
3. Add it to the final response
4. Display a "View Knowledge Graph" button in the chat UI

## Comparison with Bibliography Artifacts

Knowledge graph artifacts are handled similarly to bibliography artifacts:

1. Both are accumulated across multiple requests
2. Both use deduplication to avoid redundancy
3. Both have dedicated UI components for viewing
4. Both preserve all existing data during merging

The main difference is in the merging logic, which is specific to the structure of each artifact type.

## Notes for Developers

- To modify the knowledge graph merging behavior, update the `mergeKnowledgeGraphs` function
- To customize the UI styling, modify the `KnowledgeGraphLinkLucide` component
- The knowledge graph viewer settings can be adjusted in `KnowledgeGraphViewer`
- New properties can be added to nodes and links as needed, as the interfaces support additional properties 