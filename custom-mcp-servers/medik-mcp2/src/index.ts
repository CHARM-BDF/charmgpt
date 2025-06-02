#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  CallToolRequest,
  ListToolsRequest,
  Tool,
  TextContent,
  LoggingLevel
} from '@modelcontextprotocol/sdk/types.js';

// Types for our data structures
interface EntityInfo {
  type: string;
  group: number;
}

interface GraphNode {
  id: string;
  name: string;
  entityType: string;
  group: number;
  isStartingNode: boolean;
  val: number;
  connections: number;
}

interface GraphLink {
  source: string;
  target: string;
  label: string;
  value: number;
  evidence: string[];
}

interface KnowledgeGraph {
  nodes: GraphNode[];
  links: GraphLink[];
  filteredCount: number;
  filteredNodeCount: number;
}

// API response tuple type
type MediKanrenTuple = [string, string, string, string, string, string, string[]];

// MCP logging utility - will be set after server creation
let mcpServer: Server | null = null;

function log(message: string, data?: any): void {
  const timestamp = new Date().toISOString();
  const fullMessage = data ? `${message} | Data: ${JSON.stringify(data)}` : message;
  
  // STEP 1 DEBUG: Log function called
  console.error(`[STEP-1-DEBUG] log() function called`);
  console.error(`[STEP-1-DEBUG] Message: ${message}`);
  console.error(`[STEP-1-DEBUG] Data: ${data ? JSON.stringify(data) : 'none'}`);
  console.error(`[STEP-1-DEBUG] mcpServer exists: ${mcpServer !== null}`);

  // Use MCP logging if server is available, fallback to console
  if (mcpServer) {
    console.error(`[STEP-1-DEBUG] Attempting to send MCP logging message`);
    const logPayload = {
      level: 'info' as LoggingLevel,
      logger: 'medik-mcp',
      data: {
        message: fullMessage,
        timestamp: timestamp,
        traceId: Math.random().toString(36).substring(2, 8),
        ...data
      }
    };
    
    console.error(`[STEP-1-DEBUG] Log payload:`, JSON.stringify(logPayload, null, 2));
    
    mcpServer.sendLoggingMessage(logPayload).then(() => {
      console.error(`[STEP-1-DEBUG] ✅ sendLoggingMessage() completed successfully`);
    }).catch((error: any) => {
      console.error(`[STEP-1-DEBUG] ❌ sendLoggingMessage() failed:`, error);
      // Fallback to console if MCP logging fails
      console.error(`[${timestamp}] MEDIK: ${fullMessage}`);
    });
  } else {
    console.error(`[STEP-1-DEBUG] ❌ mcpServer is null, using console fallback`);
    console.error(`[${timestamp}] MEDIK: ${fullMessage}`);
  }
}

// Entity type classification based on CURIE prefix
function getEntityType(curie: string): EntityInfo {
  const prefix = curie.split(':')[0];
  
  switch (prefix) {
    case 'DRUGBANK':
      return { type: 'Drug', group: 1 };
    case 'NCBIGene':
    case 'HGNC':
      return { type: 'Gene', group: 2 };
    case 'MONDO':
    case 'HP':
    case 'DOID':
      return { type: 'Disease', group: 3 };
    case 'UMLS':
      return { type: 'UMLS Concept', group: 4 };
    case 'REACT':
      return { type: 'Reaction', group: 5 };
    case 'NCIT':
      return { type: 'Cancer Concept', group: 6 };
    default:
      return { type: 'Other', group: 7 };
  }
}

// Make API request to MediKanren
async function makeMediKanrenRequest(subject: string, predicate: string, object: string): Promise<any[] | null> {
  const url = `https://medikanren.metareflective.systems/query0?subject=${encodeURIComponent(subject)}&predicate=${encodeURIComponent(predicate)}&object=${encodeURIComponent(object)}`;
  
  log(`Making API request to MediKanren`, { url, subject, predicate, object });
  
  try {
    // Add timeout to prevent hanging on overwhelmed server
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
    
    const response = await fetch(url, { 
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'MediK-MCP/2.0.0'
      }
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      log(`API request failed with status ${response.status}: ${response.statusText}`);
      return null;
    }
    
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      log(`API returned non-JSON response, content-type: ${contentType}`);
      return null;
    }
    
    const data = await response.json();
    log(`API request successful, received ${data.length} relationships`);
    return data;
  } catch (error: any) {
    if (error.name === 'AbortError') {
      log(`API request timed out after 30 seconds`);
    } else {
      log(`API request error: ${error}`);
    }
    return null;
  }
}

// Run bidirectional query (X->Known and Known->X)
export async function runBidirectionalQuery(targetEntity: string): Promise<MediKanrenTuple[]> {
  log(`Starting bidirectional query for entity: ${targetEntity}`);
  
  const predicate = "biolink:affects"; // Using a more specific predicate
  
  // Query 1: targetEntity -> X (what the target affects)
  log(`Query 1: ${targetEntity} -> X (what ${targetEntity} affects)`);
  const query1Results = await makeMediKanrenRequest(targetEntity, predicate, "");
  
  // Query 2: X -> targetEntity (what affects the target)
  log(`Query 2: X -> ${targetEntity} (what affects ${targetEntity})`);
  const query2Results = await makeMediKanrenRequest("", predicate, targetEntity);
  
  // Combine results
  const allResults: MediKanrenTuple[] = [];
  
  if (query1Results) {
    log(`Query 1 returned ${query1Results.length} relationships`);
    allResults.push(...query1Results);
  } else {
    log(`Query 1 failed or returned no results`);
  }
  
  if (query2Results) {
    log(`Query 2 returned ${query2Results.length} relationships`);
    allResults.push(...query2Results);
  } else {
    log(`Query 2 failed or returned no results`);
  }
  
  // Remove duplicates based on source-predicate-target combination
  const seen = new Set<string>();
  const deduplicated = allResults.filter((tuple: MediKanrenTuple) => {
    const key = `${tuple[0]}-${tuple[2]}-${tuple[3]}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
  
  log(`Combined and deduplicated: ${allResults.length} -> ${deduplicated.length} relationships`);
  return deduplicated;
}

// Run bidirectional query with custom predicate
export async function runBidirectionalQueryWithPredicate(targetEntity: string, predicate: string): Promise<MediKanrenTuple[]> {
  log(`Starting bidirectional query for entity: ${targetEntity} with predicate: ${predicate}`);
  
  // Query 1: targetEntity -> X (what the target relates to via predicate)
  log(`Query 1: ${targetEntity} -> X (${targetEntity} ${predicate} X)`);
  const query1Results = await makeMediKanrenRequest(targetEntity, predicate, "");
  
  // Query 2: X -> targetEntity (what relates to target via predicate)
  log(`Query 2: X -> ${targetEntity} (X ${predicate} ${targetEntity})`);
  const query2Results = await makeMediKanrenRequest("", predicate, targetEntity);
  
  // Combine results
  const allResults: MediKanrenTuple[] = [];
  
  if (query1Results) {
    log(`Query 1 returned ${query1Results.length} relationships`);
    allResults.push(...query1Results);
  } else {
    log(`Query 1 failed or returned no results`);
  }
  
  if (query2Results) {
    log(`Query 2 returned ${query2Results.length} relationships`);
    allResults.push(...query2Results);
  } else {
    log(`Query 2 failed or returned no results`);
  }
  
  // Remove duplicates based on source-predicate-target combination
  const seen = new Set<string>();
  const deduplicated = allResults.filter((tuple: MediKanrenTuple) => {
    const key = `${tuple[0]}-${tuple[2]}-${tuple[3]}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
  
  log(`Combined and deduplicated: ${allResults.length} -> ${deduplicated.length} relationships`);
  return deduplicated;
}

// Create knowledge graph from raw API data
function createKnowledgeGraph(rawData: MediKanrenTuple[], queryEntity: string): KnowledgeGraph {
  log(`Creating knowledge graph from ${rawData.length} relationships`);
  
  const nodes = new Map<string, GraphNode>();
  const links: GraphLink[] = [];
  let filteredCount = 0;
  let filteredNodeCount = 0;
  
  // Process each relationship tuple
  for (const tuple of rawData) {
    const [sourceId, sourceName, predicate, targetId, targetName, , evidence] = tuple;
    
    // Filter out CAID nodes (unreliable variant data)
    if (sourceId.startsWith('CAID:') || targetId.startsWith('CAID:')) {
      filteredNodeCount++;
      continue;
    }
    
    // Filter out basic transcription relationships
    if (predicate === 'biolink:transcribed_from') {
      filteredCount++;
      continue;
    }
    
    // Normalize UniProtKB versioned IDs
    const normalizedSourceId = sourceId.replace(/^(UniProtKB:[^-]+)-\d+$/, '$1');
    const normalizedTargetId = targetId.replace(/^(UniProtKB:[^-]+)-\d+$/, '$1');
    
    // Create source node
    if (!nodes.has(normalizedSourceId)) {
      const entityInfo = getEntityType(normalizedSourceId);
      nodes.set(normalizedSourceId, {
        id: normalizedSourceId,
        name: sourceName || normalizedSourceId,
        entityType: entityInfo.type,
        group: entityInfo.group,
        isStartingNode: normalizedSourceId === queryEntity,
        val: 10, // Default size, will be adjusted based on connections
        connections: 0
      });
    }
    
    // Create target node
    if (!nodes.has(normalizedTargetId)) {
      const entityInfo = getEntityType(normalizedTargetId);
      nodes.set(normalizedTargetId, {
        id: normalizedTargetId,
        name: targetName || normalizedTargetId,
        entityType: entityInfo.type,
        group: entityInfo.group,
        isStartingNode: normalizedTargetId === queryEntity,
        val: 10, // Default size, will be adjusted based on connections
        connections: 0
      });
    }
    
    // Increment connection counts
    nodes.get(normalizedSourceId)!.connections++;
    nodes.get(normalizedTargetId)!.connections++;
    
    // Create link
    const humanReadablePredicate = predicate.replace('biolink:', '').replace(/_/g, ' ');
    links.push({
      source: normalizedSourceId,
      target: normalizedTargetId,
      label: humanReadablePredicate,
      value: 1,
      evidence: evidence || []
    });
  }
  
  // Adjust node sizes based on connection count (5-20 range)
  const nodeArray = Array.from(nodes.values());
  nodeArray.forEach(node => {
    node.val = Math.min(20, Math.max(5, 5 + node.connections));
  });
  
  log(`Knowledge graph created:`, {
    nodes: nodeArray.length,
    links: links.length,
    filteredRelationships: filteredCount,
    filteredNodes: filteredNodeCount
  });
  
  return {
    nodes: nodeArray,
    links,
    filteredCount,
    filteredNodeCount
  };
}

// New interfaces for the connecting paths functionality
interface ConnectingPathsResult {
  nodes: GraphNode[];
  links: GraphLink[];
  startNodes: string[];
  connectedComponents: number;
  prunedNodes: number;
  prunedLinks: number;
  totalFetched: number;
}

// Cache for neighbor data to avoid redundant API calls
const neighborCache = new Map<string, string[]>();

// Get neighbors for a node with caching
async function getCachedNeighbors(nodeId: string): Promise<string[]> {
  // Skip CAID nodes entirely - they contain unreliable variant data
  if (nodeId.startsWith('CAID:')) {
    log(`Skipping CAID node: ${nodeId}`);
    return [];
  }
  
  if (neighborCache.has(nodeId)) {
    log(`Cache hit for node: ${nodeId}`);
    return neighborCache.get(nodeId)!;
  }
  
  log(`Fetching neighbors for node: ${nodeId}`);
  const neighbors: string[] = [];
  
  try {
    // Query 1: nodeId -> X (what this node affects)
    const result1 = await makeMediKanrenRequest(nodeId, "biolink:affects", "");
    if (result1) {
      for (const tuple of result1) {
        const targetId = tuple[3]; // target node ID
        // Filter out CAID nodes and self-references
        if (targetId && targetId !== nodeId && !targetId.startsWith('CAID:')) {
          neighbors.push(targetId);
        }
      }
    }
    
    // Small delay between the two API calls
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Query 2: X -> nodeId (what affects this node)  
    const result2 = await makeMediKanrenRequest("", "biolink:affects", nodeId);
    if (result2) {
      for (const tuple of result2) {
        const sourceId = tuple[0]; // source node ID
        // Filter out CAID nodes, self-references, and duplicates
        if (sourceId && sourceId !== nodeId && !sourceId.startsWith('CAID:') && !neighbors.includes(sourceId)) {
          neighbors.push(sourceId);
        }
      }
    }
    
  } catch (error) {
    log(`Error fetching neighbors for ${nodeId}: ${error}`);
    // Return empty array on error instead of failing completely
  }
  
  neighborCache.set(nodeId, neighbors);
  log(`Cached ${neighbors.length} neighbors for node: ${nodeId} (filtered out CAID nodes)`);
  return neighbors;
}

// Perform multi-source BFS to collect 2-hop neighborhood
async function collect2HopNeighborhood(startNodes: string[]): Promise<{
  allNodes: Set<string>;
  adjacencyList: Map<string, Set<string>>;
  nodeDetails: Map<string, any>;
}> {
  let allNodes: Set<string>;
  let adjacencyList: Map<string, Set<string>>;
  const nodeDetails = new Map<string, any>();
  let visited: Set<string>;
  let queue: Array<{nodeId: string, depth: number}>;
  let processedCount = 0;
  
  // Try to load existing state
  const savedState = loadQueryState();
  
  if (savedState && JSON.stringify(savedState.startNodes.sort()) === JSON.stringify(startNodes.sort())) {
    // Resume from saved state
    log(`Resuming from saved state with ${savedState.processedCount} nodes already processed`);
    
    allNodes = new Set(savedState.allNodes);
    adjacencyList = new Map(savedState.adjacencyList.map(([key, value]) => [key, new Set(value)]));
    visited = new Set(savedState.visited);
    queue = savedState.queue;
    processedCount = savedState.processedCount;
    
    // Restore neighbor cache
    neighborCache.clear();
    savedState.neighborCache.forEach(([key, value]) => {
      neighborCache.set(key, value);
    });
    
    log(`Restored state: ${allNodes.size} nodes, ${queue.length} remaining in queue`);
  } else {
    // Start fresh
    if (savedState) {
      log(`Starting fresh - saved state was for different entities`);
    }
    
    allNodes = new Set<string>();
    adjacencyList = new Map<string, Set<string>>();
    visited = new Set<string>();
    queue = [];
    
    // Initialize with start nodes
    for (const startNode of startNodes) {
      queue.push({nodeId: startNode, depth: 0});
      visited.add(startNode);
      allNodes.add(startNode);
      adjacencyList.set(startNode, new Set());
    }
  }
  
  log(`Starting sequential multi-source BFS from ${startNodes.length} nodes (${queue.length} in queue)`);
  
  // Process queue sequentially to avoid overwhelming the server
  while (queue.length > 0) {
    const {nodeId, depth} = queue.shift()!;
    
    if (depth >= 2) continue; // Don't expand beyond 2 hops
    
    processedCount++;
    log(`Processing node ${nodeId} at depth ${depth} (queue size: ${queue.length}, processed: ${processedCount})`);
    
    try {
      const neighbors = await getCachedNeighbors(nodeId);
      
      for (const neighborId of neighbors) {
        // Skip CAID nodes entirely
        if (neighborId.startsWith('CAID:')) {
          continue;
        }
        
        allNodes.add(neighborId);
        
        // Add bidirectional edge
        if (!adjacencyList.has(nodeId)) {
          adjacencyList.set(nodeId, new Set());
        }
        if (!adjacencyList.has(neighborId)) {
          adjacencyList.set(neighborId, new Set());
        }
        adjacencyList.get(nodeId)!.add(neighborId);
        adjacencyList.get(neighborId)!.add(nodeId);
        
        // Queue for next level if not visited and within depth limit
        if (!visited.has(neighborId) && depth < 2) {
          visited.add(neighborId);
          queue.push({nodeId: neighborId, depth: depth + 1});
        }
      }
      
      // Add delay between API calls to be courteous to the server
      if (queue.length > 0) {
        log(`Waiting 1 second before next API call...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
    } catch (error) {
      log(`Error processing node ${nodeId}: ${error}`);
      // Continue with next node instead of failing completely
    }
    
    // Save state every 10 nodes processed
    if (processedCount % 10 === 0) {
      saveQueryState(startNodes, allNodes, adjacencyList, visited, queue, processedCount);
      log(`Progress: ${queue.length} nodes remaining in queue, ${allNodes.size} total nodes collected`);
    }
  }
  
  // Clear state file when complete
  clearQueryState();
  
  log(`Sequential BFS complete: ${allNodes.size} nodes, ${Array.from(adjacencyList.values()).reduce((sum, set) => sum + set.size, 0) / 2} edges`);
  
  return { allNodes, adjacencyList, nodeDetails };
}

// Filter subgraph to keep only connecting paths between start nodes
function filterConnectingPaths(
  adjacencyList: Map<string, Set<string>>,
  startNodes: string[]
): {
  filteredAdjList: Map<string, Set<string>>;
  prunedNodes: number;
  prunedLinks: number;
} {
  const startSet = new Set(startNodes);
  const originalNodeCount = adjacencyList.size;
  const originalLinkCount = Array.from(adjacencyList.values()).reduce((sum, set) => sum + set.size, 0) / 2;
  
  log(`Starting path filtering with ${originalNodeCount} nodes and ${originalLinkCount} links`);
  
  // Create a copy to modify
  const filteredAdjList = new Map<string, Set<string>>();
  adjacencyList.forEach((neighbors, node) => {
    filteredAdjList.set(node, new Set(neighbors));
  });
  
  // Iteratively remove leaf nodes that are not start nodes
  let removed = true;
  let iterations = 0;
  
  while (removed && iterations < 100) { // Safety limit
    removed = false;
    iterations++;
    
    const nodesToRemove: string[] = [];
    
    filteredAdjList.forEach((neighbors, node) => {
      // If node is not a start node and has <= 1 connection, mark for removal
      if (!startSet.has(node) && neighbors.size <= 1) {
        nodesToRemove.push(node);
      }
    });
    
    if (nodesToRemove.length > 0) {
      removed = true;
      
      for (const node of nodesToRemove) {
        const neighbors = filteredAdjList.get(node) || new Set();
        
        // Remove this node from its neighbors' adjacency lists
        neighbors.forEach(neighbor => {
          const neighborSet = filteredAdjList.get(neighbor);
          if (neighborSet) {
            neighborSet.delete(node);
          }
        });
        
        // Remove the node itself
        filteredAdjList.delete(node);
      }
      
      log(`Iteration ${iterations}: Removed ${nodesToRemove.length} leaf nodes`);
    }
  }
  
  const finalNodeCount = filteredAdjList.size;
  const finalLinkCount = Array.from(filteredAdjList.values()).reduce((sum, set) => sum + set.size, 0) / 2;
  
  log(`Path filtering complete: ${finalNodeCount} nodes, ${finalLinkCount} links remaining`);
  
  return {
    filteredAdjList,
    prunedNodes: originalNodeCount - finalNodeCount,
    prunedLinks: originalLinkCount - finalLinkCount
  };
}

// Convert filtered adjacency list to knowledge graph format
async function createConnectingPathsGraph(
  filteredAdjList: Map<string, Set<string>>,
  startNodes: string[]
): Promise<ConnectingPathsResult> {
  const nodes: GraphNode[] = [];
  const links: GraphLink[] = [];
  const startSet = new Set(startNodes);
  const processedEdges = new Set<string>();
  
  // Create nodes
  const nodeIds = Array.from(filteredAdjList.keys());
  for (const nodeId of nodeIds) {
    const entityInfo = getEntityType(nodeId);
    const connections = filteredAdjList.get(nodeId)?.size || 0;
    
    nodes.push({
      id: nodeId,
      name: nodeId, // We'd need to fetch names from API for full details
      entityType: entityInfo.type,
      group: entityInfo.group,
      isStartingNode: startSet.has(nodeId),
      val: Math.min(20, Math.max(5, 5 + connections)),
      connections
    });
  }
  
  // Create links
  filteredAdjList.forEach((neighbors, sourceId) => {
    neighbors.forEach(targetId => {
      // Avoid duplicate edges (since graph is undirected)
      const edgeKey = [sourceId, targetId].sort().join('->');
      if (!processedEdges.has(edgeKey)) {
        processedEdges.add(edgeKey);
        
        links.push({
          source: sourceId,
          target: targetId,
          label: 'affects',
          value: 1,
          evidence: []
        });
      }
    });
  });
  
  // Count connected components containing start nodes
  const visited = new Set<string>();
  let connectedComponents = 0;
  
  for (const startNode of startNodes) {
    if (!visited.has(startNode) && filteredAdjList.has(startNode)) {
      // BFS to find component
      const queue = [startNode];
      visited.add(startNode);
      let hasMultipleStarts = false;
      
      while (queue.length > 0) {
        const current = queue.shift()!;
        const neighbors = filteredAdjList.get(current) || new Set();
        
        neighbors.forEach(neighbor => {
          if (!visited.has(neighbor)) {
            visited.add(neighbor);
            queue.push(neighbor);
            if (startSet.has(neighbor)) {
              hasMultipleStarts = true;
            }
          }
        });
      }
      
      if (hasMultipleStarts) {
        connectedComponents++;
      }
    }
  }
  
  return {
    nodes,
    links,
    startNodes,
    connectedComponents,
    prunedNodes: 0, // Will be set by caller
    prunedLinks: 0, // Will be set by caller
    totalFetched: neighborCache.size
  };
}

// State persistence for long-running queries
interface QueryState {
  startNodes: string[];
  allNodes: string[];
  adjacencyList: [string, string[]][];
  visited: string[];
  queue: Array<{nodeId: string, depth: number}>;
  neighborCache: [string, string[]][];
  processedCount: number;
  timestamp: number;
}

// Save state to file
function saveQueryState(
  startNodes: string[],
  allNodes: Set<string>,
  adjacencyList: Map<string, Set<string>>,
  visited: Set<string>,
  queue: Array<{nodeId: string, depth: number}>,
  processedCount: number
): void {
  try {
    const state: QueryState = {
      startNodes,
      allNodes: Array.from(allNodes),
      adjacencyList: Array.from(adjacencyList.entries()).map(([key, value]) => [key, Array.from(value)]),
      visited: Array.from(visited),
      queue,
      neighborCache: Array.from(neighborCache.entries()),
      processedCount,
      timestamp: Date.now()
    };
    
    const fs = require('fs');
    const path = require('path');
    const stateFile = path.join(process.cwd(), 'medik-query-state.json');
    fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
    log(`State saved to ${stateFile} (${processedCount} nodes processed)`);
  } catch (error) {
    log(`Error saving state: ${error}`);
  }
}

// Load state from file
function loadQueryState(): QueryState | null {
  try {
    const fs = require('fs');
    const path = require('path');
    const stateFile = path.join(process.cwd(), 'medik-query-state.json');
    
    if (!fs.existsSync(stateFile)) {
      return null;
    }
    
    const stateData = fs.readFileSync(stateFile, 'utf8');
    const state: QueryState = JSON.parse(stateData);
    
    // Check if state is recent (less than 24 hours old)
    const ageHours = (Date.now() - state.timestamp) / (1000 * 60 * 60);
    if (ageHours > 24) {
      log(`State file is ${ageHours.toFixed(1)} hours old, ignoring`);
      return null;
    }
    
    log(`Loaded state from ${stateFile} (${state.processedCount} nodes already processed)`);
    return state;
  } catch (error) {
    log(`Error loading state: ${error}`);
    return null;
  }
}

// Clear state file
function clearQueryState(): void {
  try {
    const fs = require('fs');
    const path = require('path');
    const stateFile = path.join(process.cwd(), 'medik-query-state.json');
    
    if (fs.existsSync(stateFile)) {
      fs.unlinkSync(stateFile);
      log(`Cleared state file`);
    }
  } catch (error) {
    log(`Error clearing state: ${error}`);
  }
}

// Create the MCP server
const server = new Server({
  name: 'medik-mcp',
  version: '2.0.0',
}, {
  capabilities: {
    tools: {},
    logging: {},
  },
});

// ✅ FIX #1: Set the global server reference IMMEDIATELY after creation
mcpServer = server;
log("✅ MCP server created and reference assigned");

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async (): Promise<{ tools: Tool[] }> => {
  log('Tools list requested');
  
  return {
    tools: [
      {
        name: 'get-everything',
        description: 'Get all biomedical relationships for a given entity using biolink:affects predicate (bidirectional query)',
        inputSchema: {
          type: 'object',
          properties: {
            entity: {
              type: 'string',
              description: 'The entity to query (CURIE format, e.g., "HGNC:8651", "NCBIGene:4893", "DRUGBANK:DB12411")',
            },
          },
          required: ['entity'],
        },
      },
      {
        name: 'query-with-predicate',
        description: 'Query biomedical relationships with a specific predicate (bidirectional)',
        inputSchema: {
          type: 'object',
          properties: {
            entity: {
              type: 'string',
              description: 'The entity to query (CURIE format, e.g., "HGNC:8651", "DRUGBANK:DB12411")',
            },
            predicate: {
              type: 'string',
              description: 'The biolink predicate to use (e.g., "biolink:treats", "biolink:affects", "biolink:related_to")',
            },
          },
          required: ['entity', 'predicate'],
        },
      },
      {
        name: 'get-connecting-paths',
        description: 'Find connecting paths between multiple biomedical entities within 2-hop neighborhoods. Efficiently collects the subgraph around all input nodes and filters to show only the paths that connect them together.',
        inputSchema: {
          type: 'object',
          properties: {
            entities: {
              type: 'array',
              items: {
                type: 'string'
              },
              description: 'Array of entities to find connections between (CURIE format, e.g., ["HGNC:8651", "DRUGBANK:DB12411", "NCBIGene:4893"])',
              minItems: 2
            },
          },
          required: ['entities'],
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request: CallToolRequest) => {
  const { name, arguments: args } = request.params;
  
  log(`🔥 TOOL CALL RECEIVED: ${name}`, args);
  
  try {
    if (name === 'get-everything') {
      const entity = args?.entity as string;
      
      if (!entity) {
        throw new Error('Entity parameter is required');
      }
      
      log(`🚨 STARTING get-everything for entity: ${entity}`);
      
      // Send status update to UI
      await server.sendLoggingMessage({
        level: 'info',
        logger: 'medik-mcp',
        data: {
          message: `Starting bidirectional query for ${entity}...`,
          timestamp: new Date().toISOString(),
          traceId: Math.random().toString(36).substring(2, 8)
        }
      });
      
      // Run the bidirectional query
      const rawData = await runBidirectionalQuery(entity);
      
      if (rawData.length === 0) {
        const message = `No relationships found for entity: ${entity}`;
        log(`❌ ${message}`);
        
        await server.sendLoggingMessage({
          level: 'warning',
          logger: 'medik-mcp',
          data: {
            message: message,
            timestamp: new Date().toISOString(),
            traceId: Math.random().toString(36).substring(2, 8)
          }
        });
        
        return {
          content: [
            {
              type: 'text',
              text: `# No Results Found\n\nNo biomedical relationships were found for entity: **${entity}**\n\nThis could mean:\n- The entity doesn't exist in the MediKanren knowledge base\n- The entity has no known relationships\n- There was an API connectivity issue\n\nPlease verify the entity identifier is correct (should be in CURIE format like "HGNC:8651").`
            } as TextContent
          ]
        };
      }
      
      await server.sendLoggingMessage({
        level: 'info',
        logger: 'medik-mcp',
        data: {
          message: `Found ${rawData.length} raw relationships, creating knowledge graph...`,
          timestamp: new Date().toISOString(),
          traceId: Math.random().toString(36).substring(2, 8)
        }
      });
      
      // Create knowledge graph
      const graph = createKnowledgeGraph(rawData, entity);
      
      await server.sendLoggingMessage({
        level: 'info',
        logger: 'medik-mcp',
        data: {
          message: `Knowledge graph created: ${graph.nodes.length} nodes, ${graph.links.length} links`,
          timestamp: new Date().toISOString(),
          traceId: Math.random().toString(36).substring(2, 8)
        }
      });
      
      // Create response
      const title = `Knowledge Graph: All relationships for ${entity}`;
      const summary = `Found ${graph.links.length} relationships connecting ${graph.nodes.length} biomedical entities.`;
      
      if (graph.filteredCount > 0 || graph.filteredNodeCount > 0) {
        await server.sendLoggingMessage({
          level: 'info',
          logger: 'medik-mcp',
          data: {
            message: `Filtered out ${graph.filteredCount} basic relationships and ${graph.filteredNodeCount} unreliable variant nodes`,
            timestamp: new Date().toISOString(),
            traceId: Math.random().toString(36).substring(2, 8)
          }
        });
      }
      
      log(`✅ SUCCESS: Returning knowledge graph with ${graph.nodes.length} nodes and ${graph.links.length} links`);
      
      return {
        content: [
          {
            type: 'text',
            text: `# ${title}\n\n${summary}\n\n## Statistics\n- **Nodes**: ${graph.nodes.length}\n- **Relationships**: ${graph.links.length}\n- **Filtered out**: ${graph.filteredCount} basic relationships, ${graph.filteredNodeCount} unreliable nodes\n\n## Entity Types Found\n${Array.from(new Set(graph.nodes.map(n => n.entityType))).map(type => `- ${type}`).join('\n')}\n\nThe knowledge graph has been generated and can be visualized using the attached artifact.`
          } as TextContent
        ],
        artifacts: [
          {
            type: 'application/vnd.knowledge-graph',
            title,
            content: JSON.stringify(graph)
          }
        ]
      };
    } else if (name === 'query-with-predicate') {
      const entity = args?.entity as string;
      const predicate = args?.predicate as string;
      
      if (!entity || !predicate) {
        throw new Error('Both entity and predicate parameters are required');
      }
      
      log(`🚨 STARTING query-with-predicate for entity: ${entity} and predicate: ${predicate}`);
      
      // Send status update to UI
      await server.sendLoggingMessage({
        level: 'info',
        logger: 'medik-mcp',
        data: {
          message: `Starting bidirectional query for ${entity} with predicate ${predicate}...`,
          timestamp: new Date().toISOString(),
          traceId: Math.random().toString(36).substring(2, 8)
        }
      });
      
      // Run the bidirectional query with custom predicate
      const rawData = await runBidirectionalQueryWithPredicate(entity, predicate);
      
      if (rawData.length === 0) {
        const message = `No relationships found for entity: ${entity} with predicate: ${predicate}`;
        log(`❌ ${message}`);
        
        await server.sendLoggingMessage({
          level: 'warning',
          logger: 'medik-mcp',
          data: {
            message: message,
            timestamp: new Date().toISOString(),
            traceId: Math.random().toString(36).substring(2, 8)
          }
        });
        
        return {
          content: [
            {
              type: 'text',
              text: `# No Results Found\n\nNo biomedical relationships were found for entity: **${entity}** with predicate: **${predicate}**\n\nThis could mean:\n- The entity doesn't exist in the MediKanren knowledge base\n- The entity has no known relationships with the specified predicate\n- There was an API connectivity issue\n\nPlease verify the entity identifier and predicate are correct (should be in CURIE format like "HGNC:8651" and "biolink:affects").`
            } as TextContent
          ]
        };
      }
      
      await server.sendLoggingMessage({
        level: 'info',
        logger: 'medik-mcp',
        data: {
          message: `Found ${rawData.length} raw relationships, creating knowledge graph...`,
          timestamp: new Date().toISOString(),
          traceId: Math.random().toString(36).substring(2, 8)
        }
      });
      
      // Create knowledge graph
      const graph = createKnowledgeGraph(rawData, entity);
      
      await server.sendLoggingMessage({
        level: 'info',
        logger: 'medik-mcp',
        data: {
          message: `Knowledge graph created: ${graph.nodes.length} nodes, ${graph.links.length} links`,
          timestamp: new Date().toISOString(),
          traceId: Math.random().toString(36).substring(2, 8)
        }
      });
      
      // Create response
      const title = `Knowledge Graph: All relationships for ${entity} with predicate ${predicate}`;
      const summary = `Found ${graph.links.length} relationships connecting ${graph.nodes.length} biomedical entities.`;
      
      if (graph.filteredCount > 0 || graph.filteredNodeCount > 0) {
        await server.sendLoggingMessage({
          level: 'info',
          logger: 'medik-mcp',
          data: {
            message: `Filtered out ${graph.filteredCount} basic relationships and ${graph.filteredNodeCount} unreliable variant nodes`,
            timestamp: new Date().toISOString(),
            traceId: Math.random().toString(36).substring(2, 8)
          }
        });
      }
      
      log(`✅ SUCCESS: Returning knowledge graph with ${graph.nodes.length} nodes and ${graph.links.length} links`);
      
      return {
        content: [
          {
            type: 'text',
            text: `# ${title}\n\n${summary}\n\n## Statistics\n- **Nodes**: ${graph.nodes.length}\n- **Relationships**: ${graph.links.length}\n- **Filtered out**: ${graph.filteredCount} basic relationships, ${graph.filteredNodeCount} unreliable nodes\n\n## Entity Types Found\n${Array.from(new Set(graph.nodes.map(n => n.entityType))).map(type => `- ${type}`).join('\n')}\n\nThe knowledge graph has been generated and can be visualized using the attached artifact.`
          } as TextContent
        ],
        artifacts: [
          {
            type: 'application/vnd.knowledge-graph',
            title,
            content: JSON.stringify(graph)
          }
        ]
      };
    } else if (name === 'get-connecting-paths') {
      const entities = args?.entities as string[];
      
      if (!entities || entities.length < 2) {
        throw new Error('At least two entities are required');
      }
      
      log(`🚨 STARTING get-connecting-paths for entities: ${entities.join(', ')}`);
      
      // Send status update to UI
      await server.sendLoggingMessage({
        level: 'info',
        logger: 'medik-mcp',
        data: {
          message: `Starting connecting paths query for ${entities.length} entities...`,
          timestamp: new Date().toISOString(),
          traceId: Math.random().toString(36).substring(2, 8)
        }
      });
      
      // Collect 2-hop neighborhood
      const { allNodes, adjacencyList, nodeDetails } = await collect2HopNeighborhood(entities);
      
      // Filter subgraph to keep only connecting paths
      const { filteredAdjList, prunedNodes, prunedLinks } = filterConnectingPaths(adjacencyList, entities);
      
      // Create knowledge graph from filtered adjacency list
      const graph = await createConnectingPathsGraph(filteredAdjList, entities);
      
      await server.sendLoggingMessage({
        level: 'info',
        logger: 'medik-mcp',
        data: {
          message: `Connecting paths query completed: ${graph.nodes.length} nodes, ${graph.links.length} links`,
          timestamp: new Date().toISOString(),
          traceId: Math.random().toString(36).substring(2, 8)
        }
      });
      
      // Create response
      const title = `Connecting Paths: All paths between ${entities.length} biomedical entities`;
      const summary = `Found ${graph.links.length} paths connecting ${graph.nodes.length} biomedical entities.`;
      
      if (prunedNodes > 0 || prunedLinks > 0) {
        await server.sendLoggingMessage({
          level: 'info',
          logger: 'medik-mcp',
          data: {
            message: `Filtered out ${prunedNodes} leaf nodes and ${prunedLinks} isolated edges`,
            timestamp: new Date().toISOString(),
            traceId: Math.random().toString(36).substring(2, 8)
          }
        });
      }
      
      log(`✅ SUCCESS: Returning connecting paths graph with ${graph.nodes.length} nodes and ${graph.links.length} links`);
      
      return {
        content: [
          {
            type: 'text',
            text: `# ${title}\n\n${summary}\n\n## Statistics\n- **Nodes**: ${graph.nodes.length}\n- **Relationships**: ${graph.links.length}\n- **Filtered out**: ${prunedNodes} leaf nodes, ${prunedLinks} isolated edges\n\n## Entity Types Found\n${Array.from(new Set(graph.nodes.map(n => n.entityType))).map(type => `- ${type}`).join('\n')}\n\nThe knowledge graph has been generated and can be visualized using the attached artifact.`
          } as TextContent
        ],
        artifacts: [
          {
            type: 'application/vnd.knowledge-graph',
            title,
            content: JSON.stringify(graph)
          }
        ]
      };
    } else {
      throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error: any) {
    const errorMessage = `Error in tool ${name}: ${error}`;
    log(`❌ ${errorMessage}`);
    
    await server.sendLoggingMessage({
      level: 'error',
      logger: 'medik-mcp',
      data: {
        message: errorMessage,
        timestamp: new Date().toISOString(),
        traceId: Math.random().toString(36).substring(2, 8)
      }
    });
    
    throw error;
  }
});

// Start the server
async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  
  // ✅ FIX #2: Now that server is connected, we can safely use MCP logging
  log('🚀 Starting MediK MCP Server v2.0.0 (Simplified)');
  log('✅ MediK MCP Server connected and ready');
  
  // ✅ FIX #3: Add a forced test log to confirm end-to-end MCP logging flow
  mcpServer!.sendLoggingMessage({
    level: 'info',
    logger: 'startup',
    data: {
      message: 'Test MCP log message - server startup complete',
      timestamp: new Date().toISOString(),
      traceId: Math.random().toString(36).substring(2, 8)
    }
  });
  
  // ✅ DIAGNOSTIC: Add explicit test log message
  console.error('[DIAGNOSTIC] Sending explicit test log message...');
  await mcpServer!.sendLoggingMessage({
    level: 'info',
    logger: 'diagnostic',
    data: {
      message: '[TEST] Explicit diagnostic logging test - should appear in UI',
      timestamp: new Date().toISOString(),
      traceId: 'TEST-' + Math.random().toString(36).substring(2, 8)
    }
  });
  console.error('[DIAGNOSTIC] Test log message sent!');
}

main().catch((error: any) => {
  log(`💥 Server startup error: ${error}`);
  process.exit(1);
});