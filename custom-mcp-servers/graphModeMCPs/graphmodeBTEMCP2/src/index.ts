import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

// =============================================================================
// CONFIGURATION
// =============================================================================
const TOOL_NAME = "graphmode-bte-v2";
const SERVICE_NAME = "bte-mcp-v2";
const DEFAULT_API_BASE_URL = process.env.API_BASE_URL || "http://localhost:3001";
const BTE_API_URL = "https://bte.transltr.io/v1";

// =============================================================================
// FIXED CONFIGURATION
// =============================================================================
const FIXED_PREDICATES = [
  'biolink:affected_by',
  'biolink:affects',
  'biolink:interacts_with',
  'biolink:participates_in',
  'biolink:derives_from',
  'biolink:derives_into'
];

const FIXED_CATEGORIES = [
  'biolink:BiologicalProcessOrActivity',
  'biolink:Gene',
  'biolink:Protein',
  'biolink:GeneFamily',
  'biolink:DiseaseOrPhenotypicFeature',
  'biolink:AnatomicalEntity',
  'biolink:RNAProduct',
  'biolink:ChemicalMixture',
  'biolink:Polypeptide',
  'biolink:ProteinFamily'
];

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

const QueryBTEArgumentsSchema = z.object({
  entityId: z.string().min(1, "Entity ID is required"),
  databaseContext: DatabaseContextSchema,
});

const QueryBTEByCategoriesSchema = z.object({
  entityId: z.string().min(1, "Entity ID is required"),
  categories: z.array(z.string()).min(1, "At least one category is required"),
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
 * Build simplified query with fixed predicates and categories
 */
function buildSimplifiedQuery(entityId: string) {
  return {
    nodes: {
      n0: { ids: [entityId] },
      n1: { categories: FIXED_CATEGORIES }
    },
    edges: {
      e0: {
        subject: 'n0',
        object: 'n1',
        predicates: FIXED_PREDICATES
      }
    }
  };
}

function buildCategorySpecificQuery(entityId: string, categories: string[]) {
  return {
    nodes: {
      n0: { ids: [entityId] },
      n1: { categories: categories }
    },
    edges: {
      e0: {
        subject: 'n0',
        object: 'n1',
        predicates: FIXED_PREDICATES
      }
    }
  };
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
  const maxRetries = 3;
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const url = `${BTE_API_URL}/query`;
      
      // Clean the query graph to remove empty arrays
      const cleanedQueryGraph = cleanQueryGraph(queryGraph);
      
      console.error(`[${SERVICE_NAME}] Making BTE request to: ${url} (attempt ${attempt}/${maxRetries})`);
      console.error(`[${SERVICE_NAME}] Query graph:`, JSON.stringify(cleanedQueryGraph, null, 2));

      const requestBody = {
        message: {
          query_graph: cleanedQueryGraph
        }
      };

      // Add timeout to prevent hanging requests
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120000); // 120 second timeout
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'User-Agent': TOOL_NAME,
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);

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
      lastError = error as Error;
      console.error(`[${SERVICE_NAME}] BTE request failed (attempt ${attempt}/${maxRetries}):`, error);
      
      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000; // Exponential backoff: 2s, 4s, 8s
        console.error(`[${SERVICE_NAME}] Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  // If we get here, all retries failed
  console.error(`[${SERVICE_NAME}] BTE request failed after ${maxRetries} attempts`);
  throw lastError || new Error('BTE API request failed after multiple attempts');
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

  const totalEdges = Object.keys(edges).length;
  console.error(`[${SERVICE_NAME}] Processing ${Object.keys(nodes).length} nodes and ${totalEdges} edges`);
  console.error(`[${SERVICE_NAME}] Database context:`, {
    conversationId: databaseContext.conversationId,
    apiBaseUrl: databaseContext.apiBaseUrl,
    hasAccessToken: !!databaseContext.accessToken
  });

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
        
        console.error(`[${SERVICE_NAME}] Making bulk nodes API request for batch ${i + 1}...`);
        const nodeResult = await makeAPIRequest('/nodes/bulk', databaseContext, {
          method: 'POST',
          body: JSON.stringify({ nodes: batch })
        });
        
        console.error(`[${SERVICE_NAME}] Bulk nodes API response:`, nodeResult);
        nodesCreated += nodeResult.created || 0;
        console.error(`[${SERVICE_NAME}] Batch ${i + 1}: created ${nodeResult.created || 0} nodes (${nodeResult.skipped || 0} skipped)`);
      }
      
      console.error(`[${SERVICE_NAME}] Total nodes created: ${nodesCreated}`);
    } catch (error) {
      console.error(`[${SERVICE_NAME}] Failed to bulk create nodes:`, error);
      throw error;
    }
  }

  // Step 3: Filter and transform edges with composite IDs
  const transformedEdges: GraphModeEdge[] = [];
  let filteredEdgeCount = 0;
  
  for (const [edgeId, edgeData] of Object.entries(edges)) {
    try {
      // Filter out low-quality co-occurrence relationships
      if (edgeData.predicate === 'biolink:occurs_together_in_literature_with') {
        filteredEdgeCount++;
        continue; // Skip this edge
      }
      
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
  
  if (filteredEdgeCount > 0) {
    console.error(`[${SERVICE_NAME}] Filtered out ${filteredEdgeCount} low-quality co-occurrence edges`);
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
        
        console.error(`[${SERVICE_NAME}] Making bulk edges API request for batch ${i + 1}...`);
        const edgeResult = await makeAPIRequest('/edges/bulk', databaseContext, {
          method: 'POST',
          body: JSON.stringify({ edges: batch })
        });
        
        console.error(`[${SERVICE_NAME}] Bulk edges API response:`, edgeResult);
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
  if (filteredEdgeCount > 0) {
    console.error(`[${SERVICE_NAME}] Quality filter: Removed ${filteredEdgeCount} co-occurrence edges (${((filteredEdgeCount / totalEdges) * 100).toFixed(1)}% of total)`);
  }

  return {
    nodeCount: nodesCreated,
    edgeCount: edgesCreated,
    resultCount: results.length,
  };
}

// =============================================================================
// TOOL DEFINITIONS
// =============================================================================
server.setRequestHandler(ListToolsRequestSchema, async () => {
  const tools = [
    {
      name: "query_bte_getall",
      description: "Query BTE for ALL available entity types using fixed predicates and categories. " +
        "Use this tool when querying for comprehensive connections across all biomedical categories. " +
        "Do NOT use if user specifies particular categories (genes, proteins, diseases, etc.).\n\n" +
        "**Fixed Predicates:** affected_by, affects, interacts_with, participates_in, derives_from, derives_into\n" +
        "**Fixed Categories:** 10 standard biomedical categories\n" +
        "**Usage:** Just provide the entity ID - all other parameters are fixed.",
      inputSchema: {
        type: "object",
        properties: {
          entityId: {
            type: "string",
            description: "The entity ID to find connections for (e.g., 'NCBIGene:695', 'MONDO:0005148')"
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
        required: ["entityId", "databaseContext"]
      }
    },
    {
      name: "query_bte_by_categories",
      description: "Query BTE for connections to SPECIFIC entity types. Use this when user specifies particular categories like 'genes', 'proteins', 'diseases', etc.\n\n" +
        "**Fixed Predicates:** affected_by, affects, interacts_with, participates_in, derives_from, derives_into\n" +
        "**Selectable Categories:** Choose from 11 biomedical categories\n" +
        "**Important:** At least 1 category MUST be selected.\n" +
        "**Example:** Get all genes connected to MONDO:0005148",
      inputSchema: {
        type: "object",
        properties: {
          entityId: {
            type: "string",
            description: "The entity ID to find connections for"
          },
          categories: {
            type: "array",
            items: {
              type: "string",
              enum: FIXED_CATEGORIES
            },
            minItems: 1,
            description: "Select specific categories to query (at least 1 required)"
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
        required: ["entityId", "categories", "databaseContext"]
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
    if (name === "query_bte_getall") {
      const queryParams = QueryBTEArgumentsSchema.parse(args);

      console.error(`[${SERVICE_NAME}] Executing simplified BTE query for ${queryParams.entityId}`);

      // Step 1: Build simplified query
      const queryGraph = buildSimplifiedQuery(queryParams.entityId);
      
      // Step 2: Query BTE with timeout protection
      const startTime = Date.now();
      const MCP_TIMEOUT_BUFFER = 10000; // 10 second buffer before MCP timeout
      const TOTAL_PROCESSING_TIMEOUT = 45000; // 45 seconds for BTE + processing
      
      // Start BTE request (don't await it yet)
      const btePromise = makeBTERequest(queryGraph);
      
      // Race between BTE request and timeout
      const timeoutPromise = new Promise<null>((resolve) => 
        setTimeout(() => resolve(null), TOTAL_PROCESSING_TIMEOUT)
      );
      
      const bteResult = await Promise.race([btePromise, timeoutPromise]);
      
      if (!bteResult) {
        // BTE request is taking too long - let it continue in background
        console.error(`[${SERVICE_NAME}] BTE request taking longer than ${TOTAL_PROCESSING_TIMEOUT/1000}s, returning early but continuing in background`);
        
        // Continue BTE request in background (don't await)
        btePromise.then(async (trapiResponse) => {
          try {
            console.error(`[${SERVICE_NAME}] BTE request completed in background, processing data...`);
            const stats = await processTrapiResponse(trapiResponse, queryParams.databaseContext);
            console.error(`[${SERVICE_NAME}] Background processing completed successfully`);
            
            // Broadcast notification via SSE
            try {
              await fetch(`${queryParams.databaseContext.apiBaseUrl}/api/graph/${queryParams.databaseContext.conversationId}/broadcast`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  type: 'bte-background-complete',
                  nodeCount: stats.nodeCount,
                  edgeCount: stats.edgeCount,
                  message: `Large BTE query completed! Added ${stats.nodeCount} nodes and ${stats.edgeCount} edges.`
                })
              });
              console.error(`[${SERVICE_NAME}] Background completion notification sent`);
            } catch (notificationError) {
              console.error(`[${SERVICE_NAME}] Failed to send background completion notification:`, notificationError);
            }
            
          } catch (error) {
            console.error(`[${SERVICE_NAME}] Background processing failed:`, error);
            
            // Send error notification
            try {
              await fetch(`${queryParams.databaseContext.apiBaseUrl}/api/graph/${queryParams.databaseContext.conversationId}/broadcast`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  type: 'bte-background-error',
                  message: `Background BTE processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`
                })
              });
              console.error(`[${SERVICE_NAME}] Background error notification sent`);
            } catch (notificationError) {
              console.error(`[${SERVICE_NAME}] Failed to send background error notification:`, notificationError);
            }
          }
        }).catch(error => {
          console.error(`[${SERVICE_NAME}] Background BTE request failed:`, error);
        });
        
        return {
          content: [{
            type: "text",
            text: `⏱️ Large Network Query - Processing in Background

**Status:** The BTE query is taking longer than expected (45+ seconds). This typically indicates a very large network.

**What's happening:**
- BTE is processing your query in the background
- The query may return 1000+ nodes and relationships
- This is normal for comprehensive queries

**Next steps:**
1. **Wait 1-2 minutes** for BTE to complete processing
2. **You'll get a notification** when processing is complete
3. If still no results, try a more specific query

**Entity:** ${queryParams.entityId}
**Predicates:** ${FIXED_PREDICATES.join(', ')}
**Categories:** 10 standard biomedical categories

**Note:** Large networks can take 1-3 minutes to process completely. You'll receive a notification when the data is ready.`
          }],
          refreshGraph: false
        };
      }
      
      const trapiResponse = bteResult;
      const knowledgeGraph = trapiResponse.message?.knowledge_graph;
      if (!knowledgeGraph) {
        throw new Error('No knowledge graph in BTE response');
      }
      
      // Step 3: Start processing with remaining time check
      const remainingTime = MCP_TIMEOUT_BUFFER - (Date.now() - startTime);
      if (remainingTime < 5000) {
        // Not enough time for processing - return summary
        const totalNodes = Object.keys(knowledgeGraph.nodes).length;
        const totalEdges = Object.keys(knowledgeGraph.edges).length;
        
        return {
          content: [{
            type: "text",
            text: `⏱️ Large Network Detected - Processing in Background

**Entity:** ${queryParams.entityId}
**Total Nodes:** ${totalNodes}
**Total Edges:** ${totalEdges}

**Note:** Due to the large network size, we're providing this summary while the full graph loads. **Please refresh the page in about 1 minute** to see the complete graph visualization.

The data is being added to the graph in the background.`
          }],
          refreshGraph: false
        };
      }

      // Step 4: Process with remaining time
      const processingPromise = processTrapiResponse(trapiResponse, queryParams.databaseContext);
      const result = await Promise.race([
        processingPromise.then(stats => ({ completed: true, stats })),
        new Promise<{ completed: false }>(resolve => setTimeout(() => resolve({ completed: false }), remainingTime))
      ]) as { completed: boolean; stats?: any };

      // Step 5: Return appropriate response
      if (!result.completed) {
        // Return summary, processing continues in background
        const totalNodes = Object.keys(knowledgeGraph.nodes).length;
        const totalEdges = Object.keys(knowledgeGraph.edges).length;
        
        return {
          content: [{
            type: "text",
            text: `⏱️ Large Network Detected - Processing in Background

**Entity:** ${queryParams.entityId}
**Total Nodes:** ${totalNodes}
**Total Edges:** ${totalEdges}

**Note:** Due to the large network size, we're providing this summary while the full graph loads. **Please refresh the page in about 1 minute** to see the complete graph visualization.

The data is being added to the graph in the background.`
          }],
          refreshGraph: false  // Don't refresh yet
        };
      } else {
        // Processing completed in time - return full response
        const stats = result.stats!; // We know stats exists when completed is true
        
        return {
          content: [{
            type: "text",
            text: `✅ BTE Query Complete!

**Entity:** ${queryParams.entityId}
**Results:**
- Created ${stats.nodeCount} new nodes
- Created ${stats.edgeCount} new edges
- Found ${stats.resultCount} result paths

**Predicates Used:** ${FIXED_PREDICATES.join(', ')}
**Categories Searched:** 10 standard biomedical categories

**Source:** BioThings Explorer (BTE)
**Endpoint:** ${BTE_API_URL}/query

The graph has been updated with the new nodes and edges from BTE.
Note: Duplicate nodes/edges were automatically skipped.`
          }],
          refreshGraph: true  // CRITICAL: Triggers UI refresh
        };
      }
    }

    if (name === "query_bte_by_categories") {
      const queryParams = QueryBTEByCategoriesSchema.parse(args);

      // Validate categories are from FIXED_CATEGORIES
      const invalidCategories = queryParams.categories.filter(cat => !FIXED_CATEGORIES.includes(cat));
      if (invalidCategories.length > 0) {
        throw new Error(`Invalid categories: ${invalidCategories.join(', ')}. Must be from: ${FIXED_CATEGORIES.join(', ')}`);
      }

      console.error(`[${SERVICE_NAME}] Executing category-specific BTE query for ${queryParams.entityId} with categories: ${queryParams.categories.join(', ')}`);

      // Step 1: Build category-specific query
      const queryGraph = buildCategorySpecificQuery(queryParams.entityId, queryParams.categories);
      
      // Step 2: Query BTE with timeout protection
      const startTime = Date.now();
      const MCP_TIMEOUT_BUFFER = 10000; // 10 second buffer before MCP timeout
      const TOTAL_PROCESSING_TIMEOUT = 45000; // 45 seconds for BTE + processing
      
      // Start BTE request (don't await it yet)
      const btePromise = makeBTERequest(queryGraph);
      
      // Race between BTE request and timeout
      const timeoutPromise = new Promise<null>((resolve) => 
        setTimeout(() => resolve(null), TOTAL_PROCESSING_TIMEOUT)
      );
      
      const bteResult = await Promise.race([btePromise, timeoutPromise]);
      
      if (!bteResult) {
        // BTE request is taking too long - let it continue in background
        console.error(`[${SERVICE_NAME}] BTE request taking longer than ${TOTAL_PROCESSING_TIMEOUT/1000}s, returning early but continuing in background`);
        
        // Continue BTE request in background (don't await)
        console.error(`[${SERVICE_NAME}] Starting background BTE request processing...`);
        btePromise.then(async (trapiResponse) => {
          try {
            console.error(`[${SERVICE_NAME}] BTE request completed in background, processing data...`);
            console.error(`[${SERVICE_NAME}] Background response stats:`, {
              nodeCount: Object.keys(trapiResponse.message?.knowledge_graph?.nodes || {}).length,
              edgeCount: Object.keys(trapiResponse.message?.knowledge_graph?.edges || {}).length,
              resultCount: trapiResponse.message?.results?.length || 0,
            });
            
            const stats = await processTrapiResponse(trapiResponse, queryParams.databaseContext);
            console.error(`[${SERVICE_NAME}] Background processing completed successfully:`, stats);
            
            // Broadcast notification via SSE
            try {
              console.error(`[${SERVICE_NAME}] Sending background completion notification...`);
              const notificationResponse = await fetch(`${queryParams.databaseContext.apiBaseUrl}/api/graph/${queryParams.databaseContext.conversationId}/broadcast`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  type: 'bte-background-complete',
                  nodeCount: stats.nodeCount,
                  edgeCount: stats.edgeCount,
                  message: `Targeted BTE query completed! Added ${stats.nodeCount} nodes and ${stats.edgeCount} edges for categories: ${queryParams.categories.join(', ')}.`
                })
              });
              console.error(`[${SERVICE_NAME}] Background completion notification response:`, notificationResponse.status, notificationResponse.statusText);
            } catch (notificationError) {
              console.error(`[${SERVICE_NAME}] Failed to send background completion notification:`, notificationError);
            }
            
          } catch (error) {
            console.error(`[${SERVICE_NAME}] Background processing failed:`, error);
            console.error(`[${SERVICE_NAME}] Background processing error stack:`, error instanceof Error ? error.stack : 'No stack trace');
            
            // Send error notification
            try {
              console.error(`[${SERVICE_NAME}] Sending background error notification...`);
              const errorResponse = await fetch(`${queryParams.databaseContext.apiBaseUrl}/api/graph/${queryParams.databaseContext.conversationId}/broadcast`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  type: 'bte-background-error',
                  message: `Background BTE processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`
                })
              });
              console.error(`[${SERVICE_NAME}] Background error notification response:`, errorResponse.status, errorResponse.statusText);
            } catch (notificationError) {
              console.error(`[${SERVICE_NAME}] Failed to send background error notification:`, notificationError);
            }
          }
        }).catch(error => {
          console.error(`[${SERVICE_NAME}] Background BTE request failed:`, error);
          console.error(`[${SERVICE_NAME}] Background BTE request error stack:`, error instanceof Error ? error.stack : 'No stack trace');
        });
        
        return {
          content: [{
            type: "text",
            text: `⏱️ Large Targeted Query - Processing in Background

**Status:** The BTE query is taking longer than expected (45+ seconds). This typically indicates a very large network.

**What's happening:**
- BTE is processing your targeted query in the background
- The query may return 1000+ nodes and relationships
- This is normal for comprehensive targeted queries

**Next steps:**
1. **Wait 1-2 minutes** for BTE to complete processing
2. **You'll get a notification** when processing is complete
3. If still no results, try a more specific query

**Entity:** ${queryParams.entityId}
**Target Categories:** ${queryParams.categories.join(', ')}
**Predicates:** ${FIXED_PREDICATES.join(', ')}

**Note:** Large networks can take 1-3 minutes to process completely. You'll receive a notification when the data is ready.`
          }],
          refreshGraph: false
        };
      }
      
      const trapiResponse = bteResult;
      const knowledgeGraph = trapiResponse.message?.knowledge_graph;
      if (!knowledgeGraph) {
        throw new Error('No knowledge graph in BTE response');
      }
      
      // Step 3: Start processing with remaining time check
      const remainingTime = MCP_TIMEOUT_BUFFER - (Date.now() - startTime);
      if (remainingTime < 5000) {
        // Not enough time for processing - return summary
        const totalNodes = Object.keys(knowledgeGraph.nodes).length;
        const totalEdges = Object.keys(knowledgeGraph.edges).length;
        
        return {
          content: [{
            type: "text",
            text: `⏱️ Large Targeted Network Detected - Processing in Background

**Entity:** ${queryParams.entityId}
**Target Categories:** ${queryParams.categories.join(', ')}
**Total Nodes:** ${totalNodes}
**Total Edges:** ${totalEdges}

**Note:** Due to the large network size, we're providing this summary while the full graph loads. **Please refresh the page in about 1 minute** to see the complete graph visualization.

The data is being added to the graph in the background.`
          }],
          refreshGraph: false
        };
      }

      // Step 4: Process with remaining time
      const processingPromise = processTrapiResponse(trapiResponse, queryParams.databaseContext);
      const result = await Promise.race([
        processingPromise.then(stats => ({ completed: true, stats })),
        new Promise<{ completed: false }>(resolve => setTimeout(() => resolve({ completed: false }), remainingTime))
      ]) as { completed: boolean; stats?: any };

      // Step 5: Return appropriate response
      if (!result.completed) {
        // Return summary, processing continues in background
        const totalNodes = Object.keys(knowledgeGraph.nodes).length;
        const totalEdges = Object.keys(knowledgeGraph.edges).length;
        
        return {
          content: [{
            type: "text",
            text: `⏱️ Large Targeted Network Detected - Processing in Background

**Entity:** ${queryParams.entityId}
**Target Categories:** ${queryParams.categories.join(', ')}
**Total Nodes:** ${totalNodes}
**Total Edges:** ${totalEdges}

**Note:** Due to the large network size, we're providing this summary while the full graph loads. **Please refresh the page in about 1 minute** to see the complete graph visualization.

The data is being added to the graph in the background.`
          }],
          refreshGraph: false  // Don't refresh yet
        };
      } else {
        // Processing completed in time - return full response
        const stats = result.stats!; // We know stats exists when completed is true
        
        return {
          content: [{
            type: "text",
            text: `✅ Targeted BTE Query Complete!

**Entity:** ${queryParams.entityId}
**Target Categories:** ${queryParams.categories.join(', ')}
**Results:**
- Created ${stats.nodeCount} new nodes
- Created ${stats.edgeCount} new edges
- Found ${stats.resultCount} result paths

**Predicates Used:** ${FIXED_PREDICATES.join(', ')}
**Categories Searched:** ${queryParams.categories.length} selected categories

**Source:** BioThings Explorer (BTE)
**Endpoint:** ${BTE_API_URL}/query

The graph has been updated with the new nodes and edges from BTE.
Note: Duplicate nodes/edges were automatically skipped.`
          }],
          refreshGraph: true  // CRITICAL: Triggers UI refresh
        };
      }
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

    // Generic error fallback
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [{
        type: "text",
        text: `❌ BTE Query Failed:\n${errorMessage}\n\n` +
              `**Troubleshooting:**\n` +
              `- Verify the entity ID is correct (e.g., NCBIGene:695, MONDO:0005148)\n` +
              `- Check that the entity exists in BTE\n` +
              `- Try again in a few minutes if BTE is busy`
      }],
      isError: true
    };
  }
});

// =============================================================================
// SERVER STARTUP
// =============================================================================
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`[${SERVICE_NAME}] BTE GraphMode MCP Server V2 running on stdio`);
}

main().catch(console.error);
