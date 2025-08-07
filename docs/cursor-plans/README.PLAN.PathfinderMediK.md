# MediK Pathfinder Implementation Plan

## Overview

This plan outlines the implementation of a pathway discovery tool for MediK MCP that can find connections between two biomedical concepts (e.g., a gene and a disease) by traversing the knowledge graph. The tool will intelligently explore potential paths by using the existing MediKanren API and leveraging LLM capabilities to guide the search.

## 1. Core Functionality

### 1.1 New MCP Tool Definition

Add a new tool to the MediK MCP server:

```javascript
{
  name: "find-pathway",
  description: "Find potential connection pathways between two biomedical entities by exploring the knowledge graph",
  inputSchema: {
    type: "object",
    properties: {
      sourceCurie: {
        type: "string",
        description: "CURIE of the first entity (e.g., gene HGNC:1097)",
      },
      targetCurie: {
        type: "string",
        description: "CURIE of the second entity (e.g., disease MONDO:0011719)",
      },
      maxIterations: {
        type: "number",
        description: "Maximum number of exploration iterations (default: 3)",
      },
      maxNodesPerIteration: {
        type: "number",
        description: "Number of candidate nodes to explore in each iteration (default: 5)",
      }
    },
    required: ["sourceCurie", "targetCurie"],
  },
}
```

### 1.2 Algorithm Implementation

The core pathway discovery algorithm:

1. **Initial Query Phase**
   - Retrieve all relationships for the source entity
   - Retrieve all relationships for the target entity
   - Check for direct connections between the two neighborhoods

2. **Exploration Phase** (if no direct connection found)
   - Use LLM to rank nodes from each side based on connection potential
   - Select top-N promising nodes from each neighborhood
   - For each promising node, query its relationships
   - Check if new nodes create a path between source and target

3. **Iteration** (up to maxIterations)
   - If path found, terminate and return the result
   - If no path found, select new candidate nodes and repeat
   - Maintain a priority queue of which nodes to explore next

4. **Result Formatting**
   - Create a knowledge graph that highlights the discovered pathway
   - Include metadata about the exploration process

## 2. Caching System

### 2.1 Purpose

The caching system will significantly improve pathway discovery efficiency by:
- Avoiding redundant API calls during a single pathway exploration
- Storing intermediate results during the multi-step exploration process
- Reducing latency for common biomedical entity queries

### 2.2 Cache Structure

```typescript
interface NodeCache {
  [curie: string]: {
    timestamp: number;
    relationships: RelationshipData[];
    metadata: {
      queryCount: number;
      lastAccessed: number;
    }
  }
}

interface PathAttemptCache {
  [pathKey: string]: {
    exploredPaths: {
      intermediateNodes: string[];
      successful: boolean;
    }[];
    timestamp: number;
  }
}
```

### 2.3 Caching Strategy

1. **Entity-Level Caching (Primary Focus)**
   - Cache the complete neighborhood for each entity queried
   - Implementation:
     ```typescript
     async function getEntityNeighborhood(curie: string): Promise<RelationshipData[]> {
       // Check if we already have this entity's relationships in cache
       if (nodeCache[curie] && isValid(nodeCache[curie])) {
         nodeCache[curie].metadata.queryCount++;
         nodeCache[curie].metadata.lastAccessed = Date.now();
         return nodeCache[curie].relationships;
       }
       
       // If not in cache, fetch from API
       const relationships = await runBidirectionalQuery({ curie });
       
       // Store in cache
       nodeCache[curie] = {
         timestamp: Date.now(),
         relationships: relationships,
         metadata: {
           queryCount: 1,
           lastAccessed: Date.now()
         }
       };
       
       return relationships;
     }
     ```

2. **Path-Attempt Tracking**
   - Record which paths have already been attempted
   - Avoid re-exploring unsuccessful paths
   - Example key format: `${sourceCurie}|${targetCurie}`

3. **Exploration State Preservation**
   - During a multi-step exploration, preserve the current state
   - Allow resuming exploration if interrupted or timed out

### 2.4 Cache Management

1. **In-Memory Implementation (Phase 1)**
   - Store cache in a JavaScript object during server runtime
   - Simple but effective for single-session optimizations

2. **Memory Constraints**
   - Implement size limits based on:
     - Number of cached entities (e.g., max 1000 entities)
     - Total memory consumption
   - Use LRU (Least Recently Used) policy for eviction

3. **Future Expansion (Phase 2)**
   - Persistent storage using Redis or similar
   - Cross-session and cross-user caching benefits

## 3. Implementation Steps

### 3.1 Extend MediK-MCP Server

1. Add the pathway discovery tool to the server:

```typescript
// In custom-mcp-servers/medik-mcp/src/index.ts
// Add to the ListToolsRequestSchema handler

tools: [
  // Existing tools...
  {
    name: "find-pathway",
    description: "Find potential connection pathways between two biomedical entities by exploring the knowledge graph",
    inputSchema: {
      // as defined above
    },
  }
]
```

2. Implement the tool handler:

```typescript
// In the CallToolRequestSchema handler
else if (toolName === "find-pathway") {
  // Validate parameters
  const { sourceCurie, targetCurie, maxIterations = 3, maxNodesPerIteration = 5 } = 
    PathwayRequestSchema.parse(toolArgs);
  
  // Execute pathway discovery algorithm
  const pathwayResult = await findPathBetweenEntities({
    sourceCurie,
    targetCurie,
    maxIterations,
    maxNodesPerIteration
  });
  
  // Format and return the result
  return {
    content: pathwayResult.content,
    artifacts: pathwayResult.artifacts,
    metadata: pathwayResult.metadata
  };
}
```

### 3.2 Core Algorithm Implementation

```typescript
// Pathway discovery function (pseudocode)
async function findPathBetweenEntities({
  sourceCurie,
  targetCurie,
  maxIterations,
  maxNodesPerIteration
}) {
  // Initialize caching structure
  const nodeCache = {};
  const exploredPaths = new Set();
  
  // Step 1: Get initial neighborhoods
  const sourceNeighborhood = await getEntityNeighborhood(sourceCurie);
  const targetNeighborhood = await getEntityNeighborhood(targetCurie);
  
  // Step 2: Check for direct connection
  const directPath = findDirectConnection(sourceNeighborhood, targetNeighborhood);
  if (directPath) {
    return formatPathwayResult(directPath);
  }
  
  // Step 3: Prepare for iterative exploration
  let currentIteration = 0;
  let candidateNodes = selectInitialCandidates(
    sourceNeighborhood, 
    targetNeighborhood,
    maxNodesPerIteration
  );
  
  // Step 4: Iterative exploration
  while (currentIteration < maxIterations) {
    currentIteration++;
    
    // Explore next level of connections
    const newPathFound = await exploreNextLevel(
      candidateNodes,
      sourceNeighborhood,
      targetNeighborhood,
      nodeCache,
      exploredPaths
    );
    
    if (newPathFound) {
      return formatPathwayResult(newPathFound);
    }
    
    // Update candidate nodes for next iteration
    candidateNodes = selectNextCandidates(
      nodeCache,
      exploredPaths,
      maxNodesPerIteration
    );
    
    if (candidateNodes.length === 0) {
      break; // No more candidates to explore
    }
  }
  
  // No path found after maximum iterations
  return formatNoPathResult(sourceCurie, targetCurie, exploredPaths);
}
```

### 3.3 LLM-Guided Node Selection

The key intelligence in the pathway finder comes from LLM-based node selection:

```typescript
async function selectInitialCandidates(sourceNeighborhood, targetNeighborhood, maxNodes) {
  // Format node data for LLM
  const sourceNodeDescriptions = formatNodesForLLM(sourceNeighborhood);
  const targetNodeDescriptions = formatNodesForLLM(targetNeighborhood);
  
  // Create LLM prompt
  const prompt = `
    I'm trying to find potential connections between two biomedical entities:
    - Source entity (${sourceCurie}): ${getEntityName(sourceCurie)}
    - Target entity (${targetCurie}): ${getEntityName(targetCurie)}
    
    Source entity is connected to these entities:
    ${sourceNodeDescriptions}
    
    Target entity is connected to these entities:
    ${targetNodeDescriptions}
    
    Please rank the most promising nodes from the source side and target side 
    that might be connected through intermediate concepts.
    Consider biological plausibility, known relationship types, and semantic similarity.
    Format your answer as a JSON array of pairs with explanation:
    [
      {
        "sourceNode": "<curie>",
        "targetNode": "<curie>",
        "explanation": "Reason why these might connect"
      },
      ...
    ]
  `;
  
  // Call LLM
  const llmResponse = await callLLM(prompt);
  
  // Parse and return top candidates
  return parseLLMCandidatesResponse(llmResponse, maxNodes);
}
```

### 3.4 Knowledge Graph Path Formatting

When a path is found, format it as a special knowledge graph with path highlighting:

```typescript
function formatPathwayResult(pathData) {
  // Create knowledge graph with all entities in the path
  const nodes = getAllNodesInPath(pathData);
  const links = getAllLinksInPath(pathData);
  
  // Add special metadata and styling to highlight the path
  const enhancedNodes = nodes.map(node => ({
    ...node,
    isOnPath: pathData.pathNodes.includes(node.id),
    pathOrder: pathData.pathNodes.indexOf(node.id),
    // Add visual styling for path nodes
    color: pathData.pathNodes.includes(node.id) ? '#ff7700' : undefined,
    val: pathData.pathNodes.includes(node.id) ? 2 : 1,
  }));
  
  const enhancedLinks = links.map(link => ({
    ...link,
    isOnPath: pathData.pathLinks.includes(`${link.source}|${link.target}`),
    // Add visual styling for path links
    color: pathData.pathLinks.includes(`${link.source}|${link.target}`) ? '#ff7700' : undefined,
    value: pathData.pathLinks.includes(`${link.source}|${link.target}`) ? 2 : 1,
  }));
  
  return {
    content: [
      {
        type: "text",
        text: generatePathwayDescription(pathData)
      }
    ],
    artifacts: [
      {
        type: "application/vnd.knowledge-graph",
        title: `Pathway: ${getEntityName(sourceCurie)} → ${getEntityName(targetCurie)}`,
        content: JSON.stringify({
          nodes: enhancedNodes,
          links: enhancedLinks,
          metadata: {
            pathfinder: true,
            sourceCurie,
            targetCurie,
            pathLength: pathData.pathNodes.length,
            explorationDepth: pathData.explorationDepth,
            confidence: pathData.confidence
          }
        })
      }
    ],
    metadata: {
      pathFound: true,
      pathLength: pathData.pathNodes.length,
      exploredNodes: exploredPaths.size
    }
  };
}
```

## LLM Integration

This pathway discovery feature relies on LLM capabilities to rank and prioritize potential path nodes. Rather than implementing LLM functionality directly in the MediK MCP, this feature will use the centralized LLM Service.

See [README.PLAN.LLMService.md](./README.PLAN.LLMService.md) for the detailed implementation plan of the LLM Service that will support this and other MCP features.

The Pathfinder will interact with the LLM Service through its API for the node ranking functionality described in section 3.3. Instead of direct LLM calls, the code will be updated to use the LLM Client:

```typescript
// Updated node selection with LLM Client
import { LLMClient } from '../../mcp-helpers/llm-client';

// Initialize the client
const llmClient = new LLMClient();

async function selectInitialCandidates(sourceNeighborhood, targetNeighborhood, maxNodes) {
  // Format node data for LLM
  const sourceNodeDescriptions = formatNodesForLLM(sourceNeighborhood);
  const targetNodeDescriptions = formatNodesForLLM(targetNeighborhood);
  
  try {
    // Use LLM Client instead of direct LLM call
    const result = await llmClient.rank(
      [...sourceNeighborhood.nodes, ...targetNeighborhood.nodes],
      `Rank these biomedical entities based on their potential to form a connection path between ${getEntityName(sourceCurie)} and ${getEntityName(targetCurie)}. Consider biological plausibility, relationship types, and semantic similarity.`,
      {
        responseFormat: 'json',
        options: {
          temperature: 0.3,
          maxTokens: 2000
        }
      }
    );
    
    // Process the ranked nodes
    return processRankedNodes(result, maxNodes);
  } catch (error) {
    console.error('Error ranking nodes with LLM:', error);
    // Fall back to simpler heuristic-based selection
    return fallbackNodeSelection(sourceNeighborhood, targetNeighborhood, maxNodes);
  }
}
```

This approach provides several benefits:
1. Separates concerns - MediK MCP focuses on biomedical knowledge while LLM Service handles AI interactions
2. Allows for LLM-specific optimizations (caching, retries, error handling) in a central place
3. Makes it easier to switch LLM providers or models in the future
4. Provides consistent monitoring and usage tracking across all MCP servers

## 4. Usage Flow and Integration

### 4.1 Chat Interface Integration

The existing chat.ts flow will handle the tool execution through the MCP service:

1. User asks to find connections between two entities
2. Assistant identifies the need for pathfinding
3. MCP server executes the pathway discovery tool
4. Results are streamed back with status updates
5. Final pathway is displayed as a knowledge graph

### 4.2 User Experience Flow

1. **Initial Request**: User asks "Find connections between BRCA1 gene and breast cancer"
2. **Entity Identification**: Assistant identifies CURIEs (HGNC:1100 and MONDO:0007254)
3. **Tool Selection**: Assistant selects the find-pathway tool
4. **Execution with Updates**:
   - "Starting pathway exploration..."
   - "Querying initial neighborhoods..."
   - "Exploring potential connecting nodes..."
   - "Found pathway with 3 intermediates!"
5. **Result Presentation**:
   - Display the pathway as interactive knowledge graph
   - Explain the biological significance of the path
   - Allow user to pin the graph for future reference

## 5. Future Enhancements (Phase 2)

### 5.1 Advanced Caching

- Implement persistent caching with Redis
- Add cache analytics and management endpoints
- Enable cross-session caching benefits

### 5.2 Algorithm Improvements

- Add multiple pathway discovery (find top-N distinct paths)
- Implement bidirectional BFS for faster path finding
- Enable filtering by relationship types

### 5.3 UI Enhancements

- Add pathway animation in the knowledge graph
- Provide interactive path exploration
- Enable editing of the pathway parameters

## 6. Success Criteria

The implementation will be considered successful if:

1. It can find paths between biologically related entities within 30 seconds
2. The caching system reduces repeated entity queries by at least 90%
3. The LLM guidance provides meaningful direction to the pathfinding
4. Users can understand and interact with the discovered pathways
5. The system gracefully handles cases where no path exists

## 7. Timeline Estimate

- **Phase 1 (Basic Implementation)**: 2-3 weeks
  - Tool definition and algorithm: 1 week
  - Caching system: 3-4 days
  - LLM integration: 2-3 days
  - Testing and refinement: 3-4 days

- **Phase 2 (Advanced Features)**: 2-4 additional weeks
  - Persistent caching: 1 week
  - Algorithm improvements: 1-2 weeks
  - UI enhancements: 1 week 