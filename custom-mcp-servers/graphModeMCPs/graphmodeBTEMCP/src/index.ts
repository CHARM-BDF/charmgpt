import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

// =============================================================================
// CONFIGURATION SECTION
// =============================================================================
const TOOL_NAME = "graphmode-bte";
const SERVICE_NAME = "bte-mcp";
const DEFAULT_API_BASE_URL = process.env.API_BASE_URL || "http://localhost:3001";
const BTE_API_URL = "https://bte.transltr.io/v1";

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================
interface BteNode {
  name?: string;
  categories?: string[];
  attributes?: Array<{
    attribute_type_id: string;
    value: any;
  }>;
}

interface BteEdge {
  subject: string;
  object: string;
  predicate: string;
  attributes?: Array<{
    attribute_type_id: string;
    value: any;
  }>;
  sources?: Array<{
    resource_id: string;
    resource_role: string;
    upstream_resource_ids?: string[];
  }>;
}

interface GraphModeNode {
  id: string;
  label: string;
  type: string;
  data: any;
  position: { x: number; y: number };
}

interface GraphModeEdge {
  id: string;
  source: string;
  target: string;
  label: string;
  data: any;
}

interface TrapiResponse {
  message: {
    query_graph?: any;
    knowledge_graph?: {
      nodes: Record<string, BteNode>;
      edges: Record<string, BteEdge>;
    };
    results?: Array<{
      node_bindings: any;
      analyses: any[];
    }>;
  };
  description?: string;
  logs?: any[];
}

// =============================================================================
// SCHEMA DEFINITIONS
// =============================================================================
const DatabaseContextSchema = z.object({
  conversationId: z.string().min(1, "conversationId is required"),
  artifactId: z.string().optional().describe("Artifact ID for Graph Mode"),
  apiBaseUrl: z.string().url().optional(),
  accessToken: z.string().optional(),
});

const QueryGraphNodeSchema = z.object({
  ids: z.array(z.string()).optional(),
  categories: z.array(z.string()).optional(),
  set_interpretation: z.string().optional(),
  constraints: z.array(z.any()).optional(),
});

const QueryGraphEdgeSchema = z.object({
  subject: z.string(),
  object: z.string(),
  predicates: z.array(z.string()).optional(),
  knowledge_type: z.string().optional(),
  attribute_constraints: z.array(z.any()).optional(),
  qualifier_constraints: z.array(z.any()).optional(),
});

const TrapiQueryGraphSchema = z.object({
  nodes: z.record(QueryGraphNodeSchema),
  edges: z.record(QueryGraphEdgeSchema),
});

const QueryBTEArgumentsSchema = z.object({
  query_graph: TrapiQueryGraphSchema,
  databaseContext: DatabaseContextSchema,
});

const ExpandNeighborhoodArgumentsSchema = z.object({
  nodeIds: z.array(z.string()).min(1, "At least one seed node ID is required"),
  categories: z.array(z.string()).optional().describe("Optional categories to filter connecting nodes (e.g., ['gene', 'disease'])"),
  databaseContext: DatabaseContextSchema,
});

// =============================================================================
// SERVER SETUP
// =============================================================================
const server = new Server(
  {
    name: SERVICE_NAME,
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
      logging: {
        level: "debug"
      }
    },
  }
);

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Normalize user-provided category to Biolink format
 */
function normalizeCategoryToBiolink(category: string): string {
  // If already has biolink: prefix, return as-is
  if (category.startsWith('biolink:')) {
    return category;
  }
  
  // Capitalize first letter and add biolink: prefix
  const capitalized = category.charAt(0).toUpperCase() + category.slice(1).toLowerCase();
  return `biolink:${capitalized}`;
}

/**
 * Make API request to GraphMode backend database
 */
async function makeAPIRequest(
  endpoint: string,
  context: { conversationId: string; apiBaseUrl?: string; accessToken?: string },
  options: RequestInit = {}
): Promise<any> {
  try {
    const baseUrl = context.apiBaseUrl || DEFAULT_API_BASE_URL;
    const url = `${baseUrl}/api/graph/${context.conversationId}${endpoint}`;

    console.error(`[${SERVICE_NAME}] Making request to: ${url}`);
    console.error(`[${SERVICE_NAME}] Method: ${options.method || 'GET'}`);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': TOOL_NAME,
    };

    if (context.accessToken) {
      headers['Authorization'] = `Bearer ${context.accessToken}`;
    }

    const response = await fetch(url, { ...options, headers });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`[${SERVICE_NAME}] API request failed:`, error);
    throw error;
  }
}

/**
 * Clean query graph to remove empty arrays that BTE doesn't accept
 */
function cleanQueryGraph(queryGraph: any): any {
  const cleaned = JSON.parse(JSON.stringify(queryGraph)); // Deep clone
  
  // Clean edges - remove empty predicates arrays
  if (cleaned.edges) {
    for (const edgeKey of Object.keys(cleaned.edges)) {
      const edge = cleaned.edges[edgeKey];
      if (edge.predicates && Array.isArray(edge.predicates) && edge.predicates.length === 0) {
        delete edge.predicates;
        console.error(`[${SERVICE_NAME}] Removed empty predicates array from edge ${edgeKey}`);
      }
    }
  }
  
  // Clean nodes - remove empty arrays
  if (cleaned.nodes) {
    for (const nodeKey of Object.keys(cleaned.nodes)) {
      const node = cleaned.nodes[nodeKey];
      if (node.categories && Array.isArray(node.categories) && node.categories.length === 0) {
        delete node.categories;
      }
      if (node.ids && Array.isArray(node.ids) && node.ids.length === 0) {
        delete node.ids;
      }
    }
  }
  
  return cleaned;
}

/**
 * Make request to BTE TRAPI endpoint
 */
async function makeBTERequest(queryGraph: any): Promise<TrapiResponse> {
  try {
    const url = `${BTE_API_URL}/query`;
    
    // Clean the query graph to remove empty arrays
    const cleanedQueryGraph = cleanQueryGraph(queryGraph);
    
    console.error(`[${SERVICE_NAME}] Making BTE request to: ${url}`);
    console.error(`[${SERVICE_NAME}] Query graph:`, JSON.stringify(cleanedQueryGraph, null, 2));

    const requestBody = {
      message: {
        query_graph: cleanedQueryGraph
      }
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': TOOL_NAME,
      },
      body: JSON.stringify(requestBody)
    });

    console.error(`[${SERVICE_NAME}] BTE response status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`BTE API error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    console.error(`[${SERVICE_NAME}] BTE response received:`, {
      nodeCount: Object.keys(data.message?.knowledge_graph?.nodes || {}).length,
      edgeCount: Object.keys(data.message?.knowledge_graph?.edges || {}).length,
      resultCount: data.message?.results?.length || 0,
    });

    return data;
  } catch (error) {
    console.error(`[${SERVICE_NAME}] BTE request failed:`, error);
    throw error;
  }
}

/**
 * Extract xrefs from node attributes
 */
function extractXrefs(node: BteNode): string[] {
  const xrefs: string[] = [];
  if (node.attributes) {
    for (const attr of node.attributes) {
      if (attr.attribute_type_id === 'biolink:xref' && Array.isArray(attr.value)) {
        xrefs.push(...attr.value);
      }
    }
  }
  return xrefs;
}

/**
 * Extract synonyms from node attributes
 */
function extractSynonyms(node: BteNode): string[] {
  const synonyms: string[] = [];
  if (node.attributes) {
    for (const attr of node.attributes) {
      if (attr.attribute_type_id === 'biolink:synonym' && Array.isArray(attr.value)) {
        synonyms.push(...attr.value);
      }
    }
  }
  return synonyms;
}

/**
 * Extract primary source from edge sources
 */
function extractPrimarySource(sources?: Array<{ resource_id: string; resource_role: string }>): string {
  if (!sources || sources.length === 0) {
    return 'infores:bte';
  }
  
  // Find primary knowledge source
  const primarySource = sources.find(s => s.resource_role === 'primary_knowledge_source');
  if (primarySource) {
    return primarySource.resource_id;
  }
  
  // Fallback to first source
  return sources[0].resource_id;
}

/**
 * Extract publications from edge attributes
 */
function extractPublications(attributes?: Array<{ attribute_type_id: string; value: any }>): string[] {
  const publications: string[] = [];
  if (attributes) {
    for (const attr of attributes) {
      if (attr.attribute_type_id === 'biolink:publications' && Array.isArray(attr.value)) {
        publications.push(...attr.value);
      }
    }
  }
  return publications;
}

/**
 * Extract specific attribute value from edge
 */
function extractAttribute(attributes: Array<{ attribute_type_id: string; value: any }> | undefined, attributeId: string): any {
  if (!attributes) return null;
  const attr = attributes.find(a => a.attribute_type_id === attributeId);
  return attr ? attr.value : null;
}

/**
 * Transform BTE node to GraphMode format
 */
function transformBTENodeToGraphMode(nodeId: string, node: BteNode): GraphModeNode {
  // Clean up category to remove biolink: prefix for type
  const category = node.categories?.[0] || 'biolink:NamedThing';
  const type = category.replace('biolink:', '');
  
  return {
    id: nodeId,
    label: node.name || nodeId,
    type: type,
    data: {
      categories: node.categories || [],
      attributes: node.attributes || [],
      xrefs: extractXrefs(node),
      synonyms: extractSynonyms(node),
      source: 'bte',
      originalId: nodeId,
    },
    position: {
      x: Math.random() * 800,
      y: Math.random() * 600,
    }
  };
}

/**
 * Transform BTE edge to GraphMode format with composite ID
 */
function transformBTEEdgeToGraphMode(
  edgeId: string, 
  edge: BteEdge, 
  graphId: string
): GraphModeEdge {
  const source = edge.subject;
  const target = edge.object;
  const label = edge.predicate.replace('biolink:', '');
  const dataSource = 'bte';
  const primarySource = extractPrimarySource(edge.sources);
  
  // Generate deterministic composite ID for deduplication
  // Format: graphId|data.source|primary_source|source|label|target
  const compositeId = [
    graphId,
    dataSource,
    primarySource,
    source,
    label,
    target
  ].join('|');
  
  return {
    id: compositeId, // Explicitly set composite ID
    source: source,
    target: target,
    label: label,
    data: {
      source: dataSource,
      primary_source: primarySource,
      publications: extractPublications(edge.attributes),
      knowledge_level: extractAttribute(edge.attributes, 'biolink:knowledge_level'),
      agent_type: extractAttribute(edge.attributes, 'biolink:agent_type'),
      provenance: edge.sources || [],
      attributes: edge.attributes || [],
      edgeId: edgeId, // Original BTE edge ID for reference
    }
  };
}

/**
 * Create node in database
 */
async function createNodeInDatabase(
  node: GraphModeNode,
  databaseContext: any
): Promise<any> {
  try {
    console.error(`[${SERVICE_NAME}] Creating node: ${node.id} (${node.label})`);
    
    const result = await makeAPIRequest('/nodes', databaseContext, {
      method: 'POST',
      body: JSON.stringify(node)
    });
    
    console.error(`[${SERVICE_NAME}] Node created successfully: ${node.id}`);
    return result;
  } catch (error) {
    // If node already exists, that's okay (deduplication)
    if (error instanceof Error && error.message.includes('Unique constraint')) {
      console.error(`[${SERVICE_NAME}] Node ${node.id} already exists (deduplication)`);
      return null;
    }
    throw error;
  }
}

/**
 * Create edge in database
 */
async function createEdgeInDatabase(
  edge: GraphModeEdge,
  databaseContext: any
): Promise<any> {
  try {
    console.error(`[${SERVICE_NAME}] Creating edge: ${edge.source} -> ${edge.target} (${edge.label})`);
    
    const result = await makeAPIRequest('/edges', databaseContext, {
      method: 'POST',
      body: JSON.stringify(edge)
    });
    
    console.error(`[${SERVICE_NAME}] Edge created successfully`);
    return result;
  } catch (error) {
    // If edge already exists, that's okay (deduplication)
    if (error instanceof Error && error.message.includes('duplicate') || error instanceof Error && error.message.includes('already exists')) {
      console.error(`[${SERVICE_NAME}] Edge ${edge.source} -> ${edge.target} already exists (deduplication)`);
      return null;
    }
    console.error(`[${SERVICE_NAME}] Edge creation failed:`, error);
    throw error;
  }
}

/**
 * Process TRAPI response and create nodes/edges in database using bulk operations
 */
async function processTrapiResponse(
  trapiResponse: TrapiResponse,
  databaseContext: any
): Promise<{ nodeCount: number; edgeCount: number; resultCount: number }> {
  const knowledgeGraph = trapiResponse.message?.knowledge_graph;
  
  if (!knowledgeGraph) {
    throw new Error('No knowledge graph in BTE response');
  }

  const nodes = knowledgeGraph.nodes || {};
  const edges = knowledgeGraph.edges || {};
  const results = trapiResponse.message?.results || [];

  console.error(`[${SERVICE_NAME}] Processing ${Object.keys(nodes).length} nodes and ${Object.keys(edges).length} edges`);

  // Step 1: Transform all nodes
  const transformedNodes: GraphModeNode[] = [];
  for (const [nodeId, nodeData] of Object.entries(nodes)) {
    try {
      const graphModeNode = transformBTENodeToGraphMode(nodeId, nodeData);
      transformedNodes.push(graphModeNode);
    } catch (error) {
      console.error(`[${SERVICE_NAME}] Failed to transform node ${nodeId}:`, error);
    }
  }

  // Step 2: Bulk create nodes (with batching for large payloads)
  let nodesCreated = 0;
  if (transformedNodes.length > 0) {
    try {
      // Batch nodes in groups of 500 to avoid payload size limits
      const batchSize = 500;
      const batches = [];
      for (let i = 0; i < transformedNodes.length; i += batchSize) {
        batches.push(transformedNodes.slice(i, i + batchSize));
      }
      
      console.error(`[${SERVICE_NAME}] Creating ${transformedNodes.length} nodes in ${batches.length} batches of ${batchSize}`);
      
      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        console.error(`[${SERVICE_NAME}] Processing node batch ${i + 1}/${batches.length} (${batch.length} nodes)`);
        
        const nodeResult = await makeAPIRequest('/nodes/bulk', databaseContext, {
          method: 'POST',
          body: JSON.stringify({ nodes: batch })
        });
        
        nodesCreated += nodeResult.created || 0;
        console.error(`[${SERVICE_NAME}] Batch ${i + 1}: created ${nodeResult.created || 0} nodes (${nodeResult.skipped || 0} skipped)`);
      }
      
      console.error(`[${SERVICE_NAME}] Total nodes created: ${nodesCreated}`);
    } catch (error) {
      console.error(`[${SERVICE_NAME}] Failed to bulk create nodes:`, error);
      throw error;
    }
  }

  // Step 3: Transform all edges with composite IDs
  const transformedEdges: GraphModeEdge[] = [];
  for (const [edgeId, edgeData] of Object.entries(edges)) {
    try {
      const graphModeEdge = transformBTEEdgeToGraphMode(
        edgeId, 
        edgeData, 
        databaseContext.conversationId
      );
      transformedEdges.push(graphModeEdge);
    } catch (error) {
      console.error(`[${SERVICE_NAME}] Failed to transform edge ${edgeId}:`, error);
    }
  }

  // Step 4: Bulk create edges (with batching for large payloads)
  let edgesCreated = 0;
  if (transformedEdges.length > 0) {
    try {
      // Batch edges in groups of 500 to avoid payload size limits
      const batchSize = 500;
      const batches = [];
      for (let i = 0; i < transformedEdges.length; i += batchSize) {
        batches.push(transformedEdges.slice(i, i + batchSize));
      }
      
      console.error(`[${SERVICE_NAME}] Creating ${transformedEdges.length} edges in ${batches.length} batches of ${batchSize}`);
      
      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        console.error(`[${SERVICE_NAME}] Processing edge batch ${i + 1}/${batches.length} (${batch.length} edges)`);
        
        const edgeResult = await makeAPIRequest('/edges/bulk', databaseContext, {
          method: 'POST',
          body: JSON.stringify({ edges: batch })
        });
        
        edgesCreated += edgeResult.created || 0;
        console.error(`[${SERVICE_NAME}] Batch ${i + 1}: created ${edgeResult.created || 0} edges (${edgeResult.skipped || 0} skipped)`);
      }
      
      console.error(`[${SERVICE_NAME}] Total edges created: ${edgesCreated}`);
    } catch (error) {
      console.error(`[${SERVICE_NAME}] Failed to bulk create edges:`, error);
      throw error;
    }
  }

  console.error(`[${SERVICE_NAME}] Processing complete: ${nodesCreated} nodes, ${edgesCreated} edges, ${results.length} results`);

  return {
    nodeCount: nodesCreated,
    edgeCount: edgesCreated,
    resultCount: results.length,
  };
}

/**
 * Mark nodes as seed nodes in the database
 */
async function markNodesAsSeed(
  nodeIds: string[],
  databaseContext: any
): Promise<void> {
  for (const nodeId of nodeIds) {
    try {
      // Get current node data
      const currentState = await makeAPIRequest('/state', databaseContext);
      const node = currentState.data.nodes.find((n: any) => n.id === nodeId);
      
      if (node) {
        // Update node with seedNode flag
        const updatedData = {
          ...node.data,
          seedNode: true
        };
        
        await makeAPIRequest(`/nodes/${nodeId}`, databaseContext, {
          method: 'PUT',
          body: JSON.stringify({ data: updatedData })
        });
        
        console.error(`[${SERVICE_NAME}] Marked node ${nodeId} as seed`);
      } else {
        console.error(`[${SERVICE_NAME}] Node ${nodeId} not found in current graph`);
      }
    } catch (error) {
      console.error(`[${SERVICE_NAME}] Failed to mark node ${nodeId} as seed:`, error);
    }
  }
}

/**
 * Build neighborhood expansion query for BTE
 */
function buildNeighborhoodQuery(
  seedNodeIds: string[],
  categories?: string[]
): any {
  // Normalize categories to biolink format
  const biolinkCategories = categories?.map(normalizeCategoryToBiolink);
  
  // Build TRAPI query with seed nodes and open-ended neighbors
  return {
    nodes: {
      n0: {
        ids: seedNodeIds,
        set_interpretation: "BATCH" // Query all seeds at once
      },
      n1: {
        ...(biolinkCategories && biolinkCategories.length > 0 
          ? { categories: biolinkCategories } 
          : {}) // No categories = get all types
      }
    },
    edges: {
      e1: {
        subject: "n0",
        object: "n1"
        // No predicates = get all relationship types
      }
    }
  };
}

/**
 * Filter nodes to keep only those connected to 2+ seed nodes
 */
function filterMultiConnectedNodes(
  trapiResponse: TrapiResponse,
  seedNodeIds: string[]
): { nodes: Record<string, BteNode>; edges: Record<string, BteEdge> } {
  const knowledgeGraph = trapiResponse.message?.knowledge_graph;
  if (!knowledgeGraph) {
    return { nodes: {}, edges: {} };
  }
  
  console.error(`[${SERVICE_NAME}] === FILTERING ANALYSIS ===`);
  console.error(`[${SERVICE_NAME}] Seed nodes: ${seedNodeIds.join(', ')}`);
  console.error(`[${SERVICE_NAME}] Total edges in BTE response: ${Object.keys(knowledgeGraph.edges).length}`);
  console.error(`[${SERVICE_NAME}] Total nodes in BTE response: ${Object.keys(knowledgeGraph.nodes).length}`);
  
  // Count connections per neighbor node
  const connectionCounts = new Map<string, Set<string>>();
  
  for (const [edgeId, edge] of Object.entries(knowledgeGraph.edges)) {
    const neighborId = edge.object; // Neighbor is the object
    const seedId = edge.subject; // Seed is the subject
    
    // Skip if this edge doesn't involve a seed node
    if (!seedNodeIds.includes(seedId)) continue;
    
    // Track which seeds this neighbor connects to
    if (!connectionCounts.has(neighborId)) {
      connectionCounts.set(neighborId, new Set());
    }
    connectionCounts.get(neighborId)!.add(seedId);
  }
  
  console.error(`[${SERVICE_NAME}] === CONNECTION ANALYSIS ===`);
  console.error(`[${SERVICE_NAME}] Found ${connectionCounts.size} unique neighbor nodes`);
  
  // Log detailed connection analysis
  for (const [neighborId, seedSet] of connectionCounts.entries()) {
    const neighborNode = knowledgeGraph.nodes[neighborId];
    const neighborName = neighborNode?.name || 'Unknown';
    const neighborCategory = neighborNode?.categories?.[0]?.replace('biolink:', '') || 'Unknown';
    const connectedSeeds = Array.from(seedSet);
    
    console.error(`[${SERVICE_NAME}] Neighbor: ${neighborName} (${neighborId}) [${neighborCategory}]`);
    console.error(`[${SERVICE_NAME}]   Connected to ${seedSet.size} unique seed(s): ${connectedSeeds.join(', ')}`);
    
    if (seedSet.size >= 2) {
      console.error(`[${SERVICE_NAME}]   ✅ KEEPING - Connected to 2+ seeds`);
    } else {
      console.error(`[${SERVICE_NAME}]   ❌ FILTERING OUT - Connected to only 1 seed`);
    }
  }
  
  // Filter for nodes connected to 2+ seeds
  const multiConnectedNodeIds = Array.from(connectionCounts.entries())
    .filter(([_, seedSet]) => seedSet.size >= 2)
    .map(([nodeId, _]) => nodeId);
  
  console.error(`[${SERVICE_NAME}] === FILTERING RESULTS ===`);
  console.error(`[${SERVICE_NAME}] Nodes connected to 2+ seeds: ${multiConnectedNodeIds.length}`);
  console.error(`[${SERVICE_NAME}] Nodes filtered out (1 seed only): ${connectionCounts.size - multiConnectedNodeIds.length}`);
  
  // Filter nodes
  const filteredNodes: Record<string, BteNode> = {};
  for (const nodeId of multiConnectedNodeIds) {
    if (knowledgeGraph.nodes[nodeId]) {
      filteredNodes[nodeId] = knowledgeGraph.nodes[nodeId];
    }
  }
  
  // Filter edges (only keep edges involving filtered nodes)
  const filteredEdges: Record<string, BteEdge> = {};
  for (const [edgeId, edge] of Object.entries(knowledgeGraph.edges)) {
    const isSeedToFiltered = seedNodeIds.includes(edge.subject) && multiConnectedNodeIds.includes(edge.object);
    
    if (isSeedToFiltered) {
      filteredEdges[edgeId] = edge;
    }
  }
  
  console.error(`[${SERVICE_NAME}] Final filtered nodes: ${Object.keys(filteredNodes).length}`);
  console.error(`[${SERVICE_NAME}] Final filtered edges: ${Object.keys(filteredEdges).length}`);
  console.error(`[${SERVICE_NAME}] === END FILTERING ANALYSIS ===`);
  
  return { nodes: filteredNodes, edges: filteredEdges };
}

/**
 * Generate connection summary for neighborhood expansion
 */
function generateConnectionSummary(
  nodes: Record<string, BteNode>,
  edges: Record<string, BteEdge>,
  seedNodeIds: string[]
): string {
  // Count nodes per category
  const categoryCount = new Map<string, number>();
  for (const node of Object.values(nodes)) {
    const category = node.categories?.[0]?.replace('biolink:', '') || 'Unknown';
    categoryCount.set(category, (categoryCount.get(category) || 0) + 1);
  }
  
  // Count connections per seed node
  const seedConnections = new Map<string, Map<string, number>>();
  for (const seedId of seedNodeIds) {
    seedConnections.set(seedId, new Map());
  }
  
  for (const edge of Object.values(edges)) {
    const seedId = edge.subject;
    const neighborNode = nodes[edge.object];
    
    if (neighborNode && seedNodeIds.includes(seedId)) {
      const category = neighborNode.categories?.[0]?.replace('biolink:', '') || 'Unknown';
      const seedMap = seedConnections.get(seedId)!;
      seedMap.set(category, (seedMap.get(category) || 0) + 1);
    }
  }
  
  // Build summary text
  let summary = `**Overall Summary:**\n`;
  summary += `- Total nodes found: ${Object.keys(nodes).length}\n`;
  summary += `- Total edges: ${Object.keys(edges).length}\n\n`;
  
  summary += `**Nodes by Category:**\n`;
  for (const [category, count] of Array.from(categoryCount.entries()).sort((a, b) => b[1] - a[1])) {
    summary += `- ${category}: ${count}\n`;
  }
  
  summary += `\n**Connections per Seed Node:**\n`;
  for (const [seedId, categoryMap] of seedConnections.entries()) {
    summary += `\n*${seedId}:*\n`;
    for (const [category, count] of Array.from(categoryMap.entries()).sort((a, b) => b[1] - a[1])) {
      summary += `  - ${category}: ${count}\n`;
    }
  }
  
  return summary;
}

/**
 * Generate human-readable query description
 */
function generateQueryDescription(queryGraph: any): string {
  const nodes = queryGraph.nodes || {};
  const edges = queryGraph.edges || {};
  
  const nodeDescriptions: string[] = [];
  for (const [nodeKey, nodeData] of Object.entries(nodes)) {
    const node = nodeData as any;
    if (node.ids && node.ids.length > 0) {
      nodeDescriptions.push(`${nodeKey}: ${node.ids.join(', ')}`);
    } else if (node.categories && node.categories.length > 0) {
      nodeDescriptions.push(`${nodeKey}: ${node.categories.join(', ')}`);
    }
  }
  
  const edgeDescriptions: string[] = [];
  for (const [edgeKey, edgeData] of Object.entries(edges)) {
    const edge = edgeData as any;
    const predicates = edge.predicates?.join(', ') || 'any relationship';
    edgeDescriptions.push(`${edge.subject} -[${predicates}]-> ${edge.object}`);
  }
  
  return `Nodes: ${nodeDescriptions.join('; ')}\nEdges: ${edgeDescriptions.join('; ')}`;
}

// =============================================================================
// TOOL DEFINITIONS
// =============================================================================
server.setRequestHandler(ListToolsRequestSchema, async () => {
  const tools = [
    {
      name: "query_bte",
      description: "Query BioThings Explorer (BTE) using TRAPI query graph format. Supports finding relationships between biomedical entities (genes, diseases, drugs, variants, etc.). Supports batch queries with multiple entity IDs. Results are added to the current graph visualization.",
      inputSchema: {
        type: "object",
        properties: {
          query_graph: {
            type: "object",
            description: "TRAPI query graph with nodes and edges defining the query pattern",
            properties: {
              nodes: {
                type: "object",
                description: "Dictionary of query nodes with unique keys (e.g., 'n0', 'n1')",
                additionalProperties: {
                  type: "object",
                  properties: {
                    ids: {
                      type: "array",
                      items: { type: "string" },
                      description: "Array of CURIE identifiers (e.g., ['DBSNP:rs121913521', 'NCBIGene:695'])"
                    },
                    categories: {
                      type: "array",
                      items: { type: "string" },
                      description: "Array of Biolink categories (e.g., ['biolink:Gene', 'biolink:Disease'])"
                    }
                  }
                }
              },
              edges: {
                type: "object",
                description: "Dictionary of query edges with unique keys (e.g., 'e0', 'e1')",
                additionalProperties: {
                  type: "object",
                  properties: {
                    subject: {
                      type: "string",
                      description: "Key of the subject node"
                    },
                    object: {
                      type: "string",
                      description: "Key of the object node"
                    },
                    predicates: {
                      type: "array",
                      items: { type: "string" },
                      description: "Array of Biolink predicates (e.g., ['biolink:related_to'])"
                    }
                  },
                  required: ["subject", "object"]
                }
              }
            },
            required: ["nodes", "edges"]
          },
          databaseContext: {
            type: "object",
            properties: {
              conversationId: { type: "string" },
              artifactId: { type: "string" },
              apiBaseUrl: { type: "string" },
              accessToken: { type: "string" }
            },
            required: ["conversationId"]
          }
        },
        required: ["query_graph", "databaseContext"]
      }
    },
    {
      name: "expand_neighborhood",
      description: "Expand the graph by finding first-degree neighbors of seed nodes. Only keeps nodes connected to 2+ seed nodes (intersection). Marks seed nodes persistently in the database.",
      inputSchema: {
        type: "object",
        properties: {
          nodeIds: {
            type: "array",
            items: { type: "string" },
            description: "Array of seed node IDs (e.g., ['NCBIGene:695', 'NCBIGene:1956'])"
          },
          categories: {
            type: "array",
            items: { type: "string" },
            description: "Optional: Array of categories to filter connecting nodes (e.g., ['gene', 'disease']). Leave empty to get all categories."
          },
          databaseContext: {
            type: "object",
            properties: {
              conversationId: { type: "string" },
              artifactId: { type: "string" },
              apiBaseUrl: { type: "string" },
              accessToken: { type: "string" }
            },
            required: ["conversationId"]
          }
        },
        required: ["nodeIds", "databaseContext"]
      }
    }
  ];

  return { tools };
});

// =============================================================================
// TOOL HANDLERS
// =============================================================================
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    if (name === "query_bte") {
      const queryParams = QueryBTEArgumentsSchema.parse(args);

      console.error(`[${SERVICE_NAME}] Executing BTE query`);
      console.error(`[${SERVICE_NAME}] Query description:`, generateQueryDescription(queryParams.query_graph));

      // Step 1: Query BTE
      const trapiResponse = await makeBTERequest(queryParams.query_graph);

      // Step 2: Process response and create graph elements
      const stats = await processTrapiResponse(trapiResponse, queryParams.databaseContext);

      // Step 3: Generate response
      const queryDescription = generateQueryDescription(queryParams.query_graph);
      const description = trapiResponse.description || 'Query completed';

      return {
        content: [{
          type: "text",
          text: `✅ BTE Query Complete!

**Results:**
- Created ${stats.nodeCount} new nodes
- Created ${stats.edgeCount} new edges
- Found ${stats.resultCount} result paths

**Query:**
${queryDescription}

**BTE Response:**
${description}

**Source:** BioThings Explorer (BTE)
**Endpoint:** ${BTE_API_URL}/query

The graph has been updated with the new nodes and edges from BTE.
Note: Duplicate nodes/edges were automatically skipped.`
        }],
        refreshGraph: true  // CRITICAL: Triggers UI refresh
      };
    }

    if (name === "expand_neighborhood") {
      const queryParams = ExpandNeighborhoodArgumentsSchema.parse(args);
      
      console.error(`[${SERVICE_NAME}] Executing neighborhood expansion for ${queryParams.nodeIds.length} seed nodes`);
      
      // Step 1: Mark seed nodes
      await markNodesAsSeed(queryParams.nodeIds, queryParams.databaseContext);
      
      // Step 2: Build and execute BTE query
      const queryGraph = buildNeighborhoodQuery(queryParams.nodeIds, queryParams.categories);
      const trapiResponse = await makeBTERequest(queryGraph);
      
      // Step 3: Filter for multi-connected nodes
      const { nodes, edges } = filterMultiConnectedNodes(trapiResponse, queryParams.nodeIds);
      
      // Step 4: Process and add to database
      const filteredResponse: TrapiResponse = {
        message: {
          knowledge_graph: { nodes, edges },
          results: []
        }
      };
      const stats = await processTrapiResponse(filteredResponse, queryParams.databaseContext);
      
      // Step 5: Generate summary
      const summary = generateConnectionSummary(nodes, edges, queryParams.nodeIds);
      
      return {
        content: [{
          type: "text",
          text: `✅ Neighborhood Expansion Complete!

**Seed Nodes:** ${queryParams.nodeIds.length} nodes marked as seeds
**Filter:** Nodes connected to 2+ seeds only
${queryParams.categories ? `**Categories:** ${queryParams.categories.join(', ')}` : '**Categories:** All types'}

**Results:**
- Created ${stats.nodeCount} new nodes
- Created ${stats.edgeCount} new edges

${summary}

The graph has been updated with the neighborhood expansion.`
        }],
        refreshGraph: true
      };
    }

    throw new Error(`Unknown tool: ${name}`);

  } catch (error) {
    console.error(`[${SERVICE_NAME}] Tool execution failed:`, error);

    if (error instanceof z.ZodError) {
      return {
        content: [{
          type: "text",
          text: `❌ Invalid input parameters:\n${error.errors.map(e => `- ${e.path.join('.')}: ${e.message}`).join('\n')}`
        }]
      };
    }

    return {
      content: [{
        type: "text",
        text: `❌ BTE Query Failed:\n${error instanceof Error ? error.message : String(error)}`
      }]
    };
  }
});

// =============================================================================
// SERVER STARTUP
// =============================================================================
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`[${SERVICE_NAME}] BTE GraphMode MCP Server running on stdio`);
}

main().catch(console.error);

