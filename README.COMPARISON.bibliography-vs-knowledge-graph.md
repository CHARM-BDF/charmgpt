# Comparison: Bibliography vs Knowledge Graph Artifact Handling

## Current Bibliography Artifact Handling Flow

The Charm MCP framework has a well-established process for handling bibliography artifacts across multiple tool calls. This document analyzes the current flow and provides a blueprint for implementing similar functionality for knowledge graph artifacts.

### Current Bibliography Processing Flow

1. **Tool Execution Phase**
   ```javascript
   // Handle bibliography if present
   if ('bibliography' in toolResult && toolResult.bibliography) {
     console.log('\n=== BIBLIOGRAPHY DATA ===');
     console.log(JSON.stringify(toolResult.bibliography, null, 2));
     
     // Check if bibliography exists and merge if it does
     if ((messages as any).bibliography) {
       // Merge and deduplicate based on PMID
       const currentBibliography = (messages as any).bibliography as any[];
       const newBibliography = toolResult.bibliography as any[];
       
       // Create a map of existing PMIDs
       const existingPmids = new Set(currentBibliography.map(entry => entry.pmid));
       
       // Only add entries with new PMIDs
       const uniqueNewEntries = newBibliography.filter(entry => !existingPmids.has(entry.pmid));
       
       // Merge unique new entries with existing bibliography
       (messages as any).bibliography = [...currentBibliography, ...uniqueNewEntries];
     } else {
       // First bibliography, just set it
       (messages as any).bibliography = toolResult.bibliography;
     }
   }
   ```

2. **Response Formatting Phase**
   ```javascript
   // Add bibliography if present
   if ((messages as any).bibliography) {
     storeResponse = messageService.formatResponseWithBibliography(
       storeResponse, 
       (messages as any).bibliography
     );
   }
   ```

3. **Message Service Processing**
   The `formatResponseWithBibliography` method in the MessageService:
   - Takes the current response and bibliography data
   - Generates a unique ID for the bibliography artifact
   - Adds the bibliography to the response artifacts
   - Returns the updated response

### Key Observations

1. Bibliography data is **accumulated across multiple tool calls**
2. Bibliography entries are **deduplicated based on PMID**
3. The accumulated bibliography is **attached to the messages object**
4. Final response formatting is done **without the bibliography**
5. Bibliography is **added back to the response** after formatting
6. The bibliography is formatted as a **specific artifact type**

## Proposed Knowledge Graph Artifact Handling

### Required Changes for Knowledge Graph Support

1. **Tool Execution Phase**
   ```javascript
   // Handle knowledge graph if present
   if ('artifacts' in toolResult && toolResult.artifacts) {
     const knowledgeGraphArtifact = toolResult.artifacts.find(a => 
       a.type === 'application/vnd.knowledge-graph'
     );
     
     if (knowledgeGraphArtifact) {
       console.log('\n=== KNOWLEDGE GRAPH DATA ===');
       
       // Parse the knowledge graph content from string to object
       const newGraph = JSON.parse(knowledgeGraphArtifact.content);
       
       // Check if knowledge graph exists and merge if it does
       if ((messages as any).knowledgeGraph) {
         // Get existing graph
         const currentGraph = (messages as any).knowledgeGraph;
         
         // Merge graphs with node and link deduplication
         const mergedGraph = mergeKnowledgeGraphs(currentGraph, newGraph);
         
         // Store merged graph
         (messages as any).knowledgeGraph = mergedGraph;
       } else {
         // First knowledge graph, just set it
         (messages as any).knowledgeGraph = newGraph;
       }
     }
   }
   ```

2. **Response Formatting Phase**
   ```javascript
   // Add knowledge graph if present
   if ((messages as any).knowledgeGraph) {
     storeResponse = messageService.formatResponseWithKnowledgeGraph(
       storeResponse, 
       (messages as any).knowledgeGraph
     );
   }
   ```

3. **Message Service Enhancement**
   Create a new method in MessageService:
   ```javascript
   public formatResponseWithKnowledgeGraph(
     response: StoreResponse, 
     knowledgeGraph: KnowledgeGraph
   ): StoreResponse {
     // Generate a unique ID for the knowledge graph
     const graphId = `kg-${uuidv4()}`;
     
     // Add knowledge graph to artifacts
     const artifacts = response.artifacts || [];
     
     artifacts.push({
       id: graphId,
       artifactId: graphId,
       type: 'application/vnd.knowledge-graph',
       title: 'Knowledge Graph',
       content: JSON.stringify(knowledgeGraph),
       position: artifacts.length
     });
     
     // Return updated response
     return {
       ...response,
       artifacts
     };
   }
   ```

4. **Knowledge Graph Merging Function**
   Create a utility function for merging knowledge graphs:
   ```javascript
   export function mergeKnowledgeGraphs(graph1, graph2) {
     // Create maps for nodes and links to enable efficient lookups
     const nodeMap = new Map();
     const linkMap = new Map();
     
     // Process nodes from first graph
     graph1.nodes.forEach(node => {
       nodeMap.set(node.id, node);
     });
     
     // Process nodes from second graph (adding only if new)
     graph2.nodes.forEach(node => {
       if (!nodeMap.has(node.id)) {
         nodeMap.set(node.id, node);
       }
     });
     
     // Process links from first graph
     graph1.links.forEach(link => {
       const linkKey = `${link.source}|${link.target}|${link.label || ''}`;
       linkMap.set(linkKey, link);
     });
     
     // Process links from second graph
     graph2.links.forEach(link => {
       const linkKey = `${link.source}|${link.target}|${link.label || ''}`;
       
       if (!linkMap.has(linkKey)) {
         // New link, add it
         linkMap.set(linkKey, link);
       } else {
         // Existing link, merge evidence if available
         const existingLink = linkMap.get(linkKey);
         
         if (link.evidence && existingLink.evidence) {
           // Create a Set to deduplicate evidence
           const evidenceSet = new Set([...existingLink.evidence]);
           
           // Add new evidence
           link.evidence.forEach(item => evidenceSet.add(item));
           
           // Update evidence array
           existingLink.evidence = Array.from(evidenceSet);
         }
       }
     });
     
     // Convert maps back to arrays for the final graph structure
     return {
       nodes: Array.from(nodeMap.values()),
       links: Array.from(linkMap.values())
     };
   }
   ```

## Implementation Steps

To implement knowledge graph handling similar to bibliography:

1. **Add Knowledge Graph Structure**
   - Define standard types for knowledge graph data
   - Create interfaces for nodes, links, and the overall graph structure

2. **Create Knowledge Graph Merging Function**
   - Implement the merging algorithm as shown above
   - Add node and link deduplication logic

3. **Update Chat Router**
   - Add logic to detect and extract knowledge graph artifacts
   - Implement accumulation and merging of knowledge graphs
   - Store the accumulated graph in the messages object

4. **Update Message Service**
   - Add the formatResponseWithKnowledgeGraph method
   - Ensure proper artifact creation and formatting

5. **Update Type Definitions**
   - Add knowledge graph types to artifact type definitions
   - Update validation functions

6. **Verify Rendering**
   - Ensure the KnowledgeGraphViewer component can handle the artifacts
   - Add any necessary UI components for displaying knowledge graph links

## Key Differences

- **Data Structure**: Knowledge graphs have nodes and links instead of bibliography entries
- **Deduplication Keys**: Nodes are deduplicated by ID, links by source+target+label
- **Evidence Merging**: Only links have evidence to be merged
- **Data Format**: Knowledge graph content is a stringified JSON object, not an array of entries
- **Rendering Component**: Uses KnowledgeGraphViewer instead of bibliography-specific components 