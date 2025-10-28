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

const FindAllConnectedNodesArgumentsSchema = z.object({
  entityId: z.string().min(1, "Entity ID is required"),
  entityCategory: z.string().optional().describe("Biolink category of the entity (e.g., 'biolink:Gene')"),
  queryType: z.enum(["focused", "comprehensive", "minimal"]).optional().default("focused"),
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
 * Map common predicates to appropriate target node categories
 */
const PREDICATE_CATEGORY_MAP: Record<string, string> = {

  'biolink:involved_in': 'biolink:Pathway',
  'biolink:participates_in': 'biolink:Pathway',
  'biolink:regulates': 'biolink:Gene',
  'biolink:positively_regulates': 'biolink:Gene',
  'biolink:negatively_regulates': 'biolink:Gene',
  'biolink:treats': 'biolink:Disease',
  'biolink:associated_with': 'biolink:Disease',
  'biolink:causes': 'biolink:Disease',
  'biolink:affects': 'biolink:Gene',
  'biolink:interacts_with': 'biolink:Protein',
};

/**
 * Get suggested target category based on predicate
 */
function getSuggestedCategoryForPredicate(predicate: string): string | null {
  return PREDICATE_CATEGORY_MAP[predicate] || null;
}

// =============================================================================
// OPTIMIZED PREDICATE SETS FOR FIND_ALL_CONNECTED_NODES
// =============================================================================

const BIOLINK_PREDICATE_SETS = {
  focused: [
    'biolink:affected_by',
    'biolink:affects', 
    'biolink:associated_with',
    'biolink:interacts_with',
    'biolink:participates_in'
  ],
  comprehensive: [
    'biolink:related_to_at_instance_level',
    'biolink:related_to_at_concept_level'
  ],
  minimal: [
    'biolink:regulates',
    'biolink:associated_with',
    'biolink:interacts_with',
    'biolink:participates_in',
    'biolink:similar_to'
  ],
  causal: [
    'biolink:affects',
    'biolink:affected_by',
    'biolink:causes',
    'biolink:contributes_to'
  ],
  associational: [
    'biolink:associated_with',
    'biolink:correlated_with',
    'biolink:coexpressed_with',
    'biolink:biomarker_for'
  ],
  interaction: [
    'biolink:interacts_with',
    'biolink:physically_interacts_with',
    'biolink:binds',
    'biolink:coexists_with'
  ]
};

const CATEGORY_PREDICATE_MAP: Record<string, string[]> = {
  'biolink:Gene': ['causal', 'associational'],
  'biolink:Protein': ['interaction', 'causal'],
  'biolink:Disease': ['associational', 'causal'],
  'biolink:ChemicalEntity': ['causal', 'interaction'],
  'biolink:SmallMolecule': ['causal', 'interaction'],
  'biolink:Drug': ['causal', 'interaction'],
  'biolink:AnatomicalEntity': ['associational', 'focused'],
  'biolink:Pathway': ['participates_in', 'interaction'],
  'biolink:BiologicalProcess': ['participates_in', 'causal'],
  'biolink:SequenceVariant': ['causal', 'associational']
};

/**
 * Get optimized predicates for a query based on entity category and query type
 */
function getOptimizedPredicates(entityCategory: string | undefined, queryType: string = 'focused'): string[] {
  // If we have category-specific recommendations, use them
  if (entityCategory && CATEGORY_PREDICATE_MAP[entityCategory]) {
    const recommendedSets = CATEGORY_PREDICATE_MAP[entityCategory];
    const predicates: string[] = [];
    
    // Combine predicates from recommended sets
    for (const setName of recommendedSets) {
      if (BIOLINK_PREDICATE_SETS[setName as keyof typeof BIOLINK_PREDICATE_SETS]) {
        predicates.push(...BIOLINK_PREDICATE_SETS[setName as keyof typeof BIOLINK_PREDICATE_SETS]);
      }
    }
    
    // Remove duplicates and return
    return [...new Set(predicates)];
  }
  
  // Fall back to query type
  return BIOLINK_PREDICATE_SETS[queryType as keyof typeof BIOLINK_PREDICATE_SETS] || BIOLINK_PREDICATE_SETS.focused;
}

/**
 * Auto-detect entity category from entity ID format
 */
function detectEntityCategory(entityId: string): string {
  if (entityId.startsWith('NCBIGene:') || entityId.startsWith('HGNC:')) {
    return 'biolink:Gene';
  } else if (entityId.startsWith('UniProtKB:') || entityId.startsWith('PR:')) {
    return 'biolink:Protein';
  } else if (entityId.startsWith('MONDO:') || entityId.startsWith('DOID:') || entityId.startsWith('OMIM:')) {
    return 'biolink:Disease';
  } else if (entityId.startsWith('DrugBank:') || entityId.startsWith('CHEBI:') || entityId.startsWith('MESH:')) {
    return 'biolink:ChemicalEntity';
  } else if (entityId.startsWith('DBSNP:') || entityId.startsWith('ClinVar:')) {
    return 'biolink:SequenceVariant';
  } else if (entityId.startsWith('UBERON:') || entityId.startsWith('CL:')) {
    return 'biolink:AnatomicalEntity';
  } else if (entityId.startsWith('REACTOME:') || entityId.startsWith('KEGG:')) {
    return 'biolink:Pathway';
  }
  
  // Default fallback
  return 'biolink:NamedThing';
}

/**
 * Generate optimized query for finding all connected nodes
 */
function generateOptimizedConnectedNodesQuery(entityId: string, entityCategory: string | undefined, queryType: string = 'focused') {
  const category = entityCategory || detectEntityCategory(entityId);
  const predicates = getOptimizedPredicates(category, queryType);
  
  // Standard 11-category set for comprehensive coverage
  const standardCategories = [
    'biolink:BiologicalProcessOrActivity',
    'biolink:Gene',
    'biolink:Protein',
    'biolink:GeneFamily',
    'biolink:DiseaseOrPhenotypicFeature',
    'biolink:AnatomicalEntity',
    'biolink:RNAProduct',
    'biolink:ChemicalMixture',
    'biolink:SmallMolecule',
    'biolink:Polypeptide',
    'biolink:ProteinFamily'
  ];
  
  return {
    nodes: {
      n0: {
        ids: [entityId],
        categories: [category]
      },
      n1: {
        categories: standardCategories
      }
    },
    edges: {
      e0: {
        subject: 'n0',
        object: 'n1',
        predicates: predicates
      }
    }
  };
}

/**
 * Validate TRAPI query structure
 * Returns error details if invalid, null if valid
 */
function validateQueryGraph(queryGraph: any): { error: string; details: any } | null {
  const nodes = queryGraph.nodes || {};
  const edges = queryGraph.edges || {};
  
  // Check all edge references
  for (const [edgeId, edge] of Object.entries(edges)) {
    const edgeData = edge as any;
    
    // Check subject exists
    if (!nodes[edgeData.subject]) {
      return {
        error: `Edge ${edgeId} references subject '${edgeData.subject}' which is not defined in nodes`,
        details: {
          edge_id: edgeId,
          missing_node_id: edgeData.subject,
          edge_reference: 'subject',
          defined_nodes: Object.keys(nodes),
          predicates: edgeData.predicates || []
        }
      };
    }
    
    // Check object exists
    if (!nodes[edgeData.object]) {
      return {
        error: `Edge ${edgeId} references object '${edgeData.object}' which is not defined in nodes`,
        details: {
          edge_id: edgeId,
          missing_node_id: edgeData.object,
          edge_reference: 'object',
          defined_nodes: Object.keys(nodes),
          predicates: edgeData.predicates || []
        }
      };
    }
  }
  
  return null;
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

  const totalEdges = Object.keys(edges).length;
  console.error(`[${SERVICE_NAME}] Processing ${Object.keys(nodes).length} nodes and ${totalEdges} edges`);

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
  if (filteredEdgeCount > 0) {
    console.error(`[${SERVICE_NAME}] Quality filter: Removed ${filteredEdgeCount} co-occurrence edges (${((filteredEdgeCount / totalEdges) * 100).toFixed(1)}% of total)`);
  }

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
        // Handle case where data might already be a string (from database)
        const currentData = typeof node.data === 'string' ? JSON.parse(node.data) : node.data;
        const updatedData = {
          ...currentData,
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
 * Build neighborhood expansion query for BTE using optimized predicates
 */
function buildNeighborhoodQuery(
  seedNodeIds: string[],
  categories?: string[]
): any {
  // Use standard 11-category set for comprehensive coverage
  const standardCategories = [
    'biolink:BiologicalProcessOrActivity',
    'biolink:Gene',
    'biolink:Protein',
    'biolink:GeneFamily',
    'biolink:DiseaseOrPhenotypicFeature',
    'biolink:AnatomicalEntity',
    'biolink:RNAProduct',
    'biolink:ChemicalMixture',
    'biolink:SmallMolecule',
    'biolink:Polypeptide',
    'biolink:ProteinFamily'
  ];
  
  // If specific categories are requested, use them; otherwise use standard set
  const targetCategories = categories && categories.length > 0 
    ? categories.map(normalizeCategoryToBiolink)
    : standardCategories;
  
  // Use focused predicate set for neighborhood expansion
  const predicates = BIOLINK_PREDICATE_SETS.focused;
  
  // Build TRAPI query with seed nodes and optimized neighbors
  return {
    nodes: {
      n0: {
        ids: seedNodeIds,
        set_interpretation: "BATCH" // Query all seeds at once
      },
      n1: {
        categories: targetCategories
      }
    },
    edges: {
      e1: {
        subject: "n0",
        object: "n1",
        predicates: predicates
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
    const totalConnections = Array.from(categoryMap.values()).reduce((sum, count) => sum + count, 0);
    summary += `\n*${seedId}* (${totalConnections} total connections):\n`;
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
// ANALYSIS FUNCTIONS
// =============================================================================

interface AnalysisResult {
  totalNodes: number;
  totalEdges: number;
  categoryBreakdown: Array<{ category: string; count: number }>;
  predicateBreakdown: Array<{ predicate: string; count: number }>;
  topCombinations: Array<{ category: string; predicate: string; count: number }>;
  insights: string[];
}

function analyzeComprehensiveResults(nodes: any, edges: any, sourceEntityId: string): AnalysisResult {
  const nodeEntries = Object.values(nodes) as any[];
  const edgeEntries = Object.values(edges) as any[];
  
  // Filter out the source entity from node count
  const connectedNodes = nodeEntries.filter(node => 
    !node.ids || !node.ids.includes(sourceEntityId)
  );
  
  const totalNodes = connectedNodes.length;
  const totalEdges = edgeEntries.length;
  
  // Category breakdown
  const categoryCounts: { [key: string]: number } = {};
  connectedNodes.forEach(node => {
    if (node.categories) {
      node.categories.forEach((category: string) => {
        categoryCounts[category] = (categoryCounts[category] || 0) + 1;
      });
    }
  });
  
  const categoryBreakdown = Object.entries(categoryCounts)
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count);
  
  // Predicate breakdown
  const predicateCounts: { [key: string]: number } = {};
  edgeEntries.forEach(edge => {
    if (edge.predicates) {
      edge.predicates.forEach((predicate: string) => {
        predicateCounts[predicate] = (predicateCounts[predicate] || 0) + 1;
      });
    } else {
      predicateCounts['related_to'] = (predicateCounts['related_to'] || 0) + 1;
    }
  });
  
  const predicateBreakdown = Object.entries(predicateCounts)
    .map(([predicate, count]) => ({ predicate, count }))
    .sort((a, b) => b.count - a.count);
  
  // Category-Predicate combinations
  const combinationCounts: { [key: string]: number } = {};
  edgeEntries.forEach(edge => {
    const predicates = edge.predicates || ['related_to'];
    const subjectNode = nodes[edge.subject];
    const objectNode = nodes[edge.object];
    
    if (subjectNode && objectNode) {
      const subjectCategories = subjectNode.categories || [];
      const objectCategories = objectNode.categories || [];
      
      predicates.forEach((predicate: string) => {
        subjectCategories.forEach((subjectCat: string) => {
          objectCategories.forEach((objectCat: string) => {
            const key = `${objectCat} via ${predicate}`;
            combinationCounts[key] = (combinationCounts[key] || 0) + 1;
          });
        });
      });
    }
  });
  
  const topCombinations = Object.entries(combinationCounts)
    .map(([key, count]) => {
      const [category, predicate] = key.split(' via ');
      return { category, predicate, count };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
  
  // Generate insights
  const insights: string[] = [];
  
  if (categoryBreakdown.length > 0) {
    const topCategory = categoryBreakdown[0];
    insights.push(`Most connected category: ${topCategory.category} (${topCategory.count} nodes)`);
  }
  
  if (predicateBreakdown.length > 0) {
    const topPredicate = predicateBreakdown[0];
    insights.push(`Most common relationship: ${topPredicate.predicate} (${topPredicate.count} relationships)`);
  }
  
  if (totalNodes > 100) {
    insights.push(`High connectivity: ${totalNodes} connected nodes indicates extensive relationships`);
  } else if (totalNodes < 10) {
    insights.push(`Limited connectivity: ${totalNodes} connected nodes suggests specialized or rare entity`);
  }
  
  const uniquePredicates = predicateBreakdown.length;
  if (uniquePredicates > 20) {
    insights.push(`Diverse relationships: ${uniquePredicates} different relationship types found`);
  }
  
  const hasDiseaseConnections = categoryBreakdown.some(item => 
    item.category.includes('Disease') || item.category.includes('Phenotypic')
  );
  if (hasDiseaseConnections) {
    insights.push(`Disease associations found: Clinical relevance detected`);
  }
  
  const hasDrugConnections = categoryBreakdown.some(item => 
    item.category.includes('Drug') || item.category.includes('SmallMolecule') || item.category.includes('Chemical')
  );
  if (hasDrugConnections) {
    insights.push(`Drug/chemical associations found: Therapeutic potential detected`);
  }
  
  return {
    totalNodes,
    totalEdges,
    categoryBreakdown,
    predicateBreakdown,
    topCombinations,
    insights
  };
}

/**
 * Generate a quick summary from raw TRAPI response data
 * Efficiently counts categories and edges for timeout scenarios
 */
function generateQuickSummary(
  nodes: Record<string, BteNode>, 
  edges: Record<string, BteEdge>
): string {
  const totalNodes = Object.keys(nodes).length;
  const totalEdges = Object.keys(edges).length;
  
  // Efficient counting using Map
  const categoryCount = new Map<string, number>();
  
  // Count categories
  for (const node of Object.values(nodes)) {
    const category = node.categories?.[0]?.replace('biolink:', '') || 'Unknown';
    categoryCount.set(category, (categoryCount.get(category) || 0) + 1);
  }
  
  // Build markdown table
  const categoryRows = Array.from(categoryCount.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([category, count]) => `| ${category} | ${count} |`)
    .join('\n');
  
  return `## 📊 Quick Summary

**Total Nodes:** ${totalNodes}  
**Total Edges:** ${totalEdges}

### Node Categories
| Category | Count |
|----------|-------|
${categoryRows}

*This is a summary of the raw data. The full graph is being processed in the background.*`;
}

/**
 * Get top connected nodes for detailed response
 */
function getTopConnectedNodes(trapiResponse: TrapiResponse, limit: number = 20): string {
  const nodes = trapiResponse.message?.knowledge_graph?.nodes || {};
  const edges = trapiResponse.message?.knowledge_graph?.edges || {};
  
  // Count connections per node
  const connectionCount = new Map<string, number>();
  
  for (const edge of Object.values(edges)) {
    connectionCount.set(edge.subject, (connectionCount.get(edge.subject) || 0) + 1);
    connectionCount.set(edge.object, (connectionCount.get(edge.object) || 0) + 1);
  }
  
  // Get top connected nodes
  const topNodes = Array.from(connectionCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([nodeId, count]) => {
      const node = nodes[nodeId];
      const name = node?.name || nodeId;
      const category = node?.categories?.[0]?.replace('biolink:', '') || 'Unknown';
      return `- **${name}** (${nodeId}) [${category}] - ${count} connections`;
    })
    .join('\n');
  
  return topNodes;
}

// =============================================================================
// TOOL DEFINITIONS
// =============================================================================
server.setRequestHandler(ListToolsRequestSchema, async () => {
  const tools = [
    {
      name: "query_bte",
      description: "Query BioThings Explorer (BTE) using TRAPI query graph format. " +
        "Supports finding relationships between biomedical entities (genes, diseases, drugs, variants, etc.). " +
        "Supports batch queries with multiple entity IDs. Results are added to the current graph visualization.\n\n" +
        
        "**QUALITY FILTERING:**\n" +
        "- Automatically excludes low-quality co-occurrence relationships\n" +
        "- Filters out 'occurs_together_in_literature_with' predicates\n" +
        "- Focuses on high-quality biological relationships\n\n" +
        
        "**CRITICAL QUERY STRUCTURE RULES:**\n" +
        "1. ✓ ALWAYS define ALL nodes that are referenced in edges\n" +
        "2. ✓ If an edge has subject='n0', then 'n0' MUST exist in the nodes object\n" +
        "3. ✓ If an edge has object='n1', then 'n1' MUST exist in the nodes object\n" +
        "4. ✓ Each node must have either 'ids' (for known entities) OR 'categories' (for entity types to find)\n\n" +
        
        "**COMMON QUERY PATTERNS:**\n\n" +
        
        "Pattern 1 - Find related entities:\n" +
        "```\n" +
        "nodes: {\n" +
        "  n0: { ids: ['NCBIGene:4353'], categories: ['biolink:Gene'] },\n" +
        "  n1: { categories: ['biolink:Disease'] }  // ← target node MUST be defined\n" +
        "},\n" +
        "edges: {\n" +
        "  e0: { subject: 'n0', object: 'n1' }  // ← Note: NO predicate for general queries\n" +
        "}\n" +
        "```\n\n" +
        
        "Pattern 2 - Find molecular functions:\n" +
        "```\n" +
        "nodes: {\n" +
        "  n0: { ids: ['NCBIGene:4353'] },\n" +
        "  n1: { categories: ['biolink:MolecularActivity'] }  // ← required for molecular functions\n" +
        "},\n" +
        "edges: {\n" +
        "  e0: { subject: 'n0', object: 'n1' }  // ← NO predicate needed\n" +
        "}\n" +
        "```\n\n" +
        
        "Pattern 3 - Find pathways:\n" +
        "```\n" +
        "nodes: {\n" +
        "  n0: { ids: ['NCBIGene:4353'] },\n" +
        "  n1: { categories: ['biolink:Pathway'] }  // ← required for pathways\n" +
        "},\n" +
        "edges: {\n" +
        "  e0: { subject: 'n0', object: 'n1' }  // ← NO predicate or use biolink:participates_in\n" +
        "}\n" +
        "```\n\n" +
        
        "Pattern 4 - Gene-Protein relationships:\n" +
        "```\n" +
        "nodes: {\n" +
        "  n0: { ids: ['NCBIGene:4353'], categories: ['biolink:Gene'] },\n" +
        "  n1: { categories: ['biolink:Protein'] }\n" +
        "},\n" +
        "edges: {\n" +
        "  e0: { subject: 'n0', object: 'n1', predicates: ['biolink:produces'] }  // Gene produces protein\n" +
        "}\n" +
        "```\n\n" +
        
        "Pattern 5 - Protein-Protein interactions:\n" +
        "```\n" +
        "nodes: {\n" +
        "  n0: { ids: ['UniProtKB:P12345'], categories: ['biolink:Protein'] },\n" +
        "  n1: { categories: ['biolink:Protein'] }\n" +
        "},\n" +
        "edges: {\n" +
        "  e0: { subject: 'n0', object: 'n1', predicates: ['biolink:physically_interacts_with'] }\n" +
        "}\n" +
        "```\n\n" +
        
        "Pattern 6 - Drug-target relationships:\n" +
        "```\n" +
        "nodes: {\n" +
        "  n0: { ids: ['DrugBank:DB00001'], categories: ['biolink:Drug'] },\n" +
        "  n1: { categories: ['biolink:Protein'] }\n" +
        "},\n" +
        "edges: {\n" +
        "  e0: { subject: 'n0', object: 'n1', predicates: ['biolink:affects'] }  // Drug affects protein\n" +
        "}\n" +
        "```\n\n" +
        
        "Pattern 7 - Gene regulation:\n" +
        "```\n" +
        "nodes: {\n" +
        "  n0: { ids: ['NCBIGene:4353'], categories: ['biolink:Gene'] },\n" +
        "  n1: { categories: ['biolink:Gene'] }\n" +
        "},\n" +
        "edges: {\n" +
        "  e0: { subject: 'n0', object: 'n1', predicates: ['biolink:regulates'] }  // Gene regulates gene\n" +
        "}\n" +
        "```\n\n" +
        
        "Pattern 8 - Molecular functions:\n" +
        "```\n" +
        "nodes: {\n" +
        "  n0: { ids: ['NCBIGene:4353'], categories: ['biolink:Gene'] },\n" +
        "  n1: { categories: ['biolink:MolecularActivity'] }\n" +
        "},\n" +
        "edges: {\n" +
        "  e0: { subject: 'n0', object: 'n1', predicates: ['biolink:capable_of'] }  // Gene capable of activity\n" +
        "}\n" +
        "```\n\n" +
        
        "Pattern 9 - Default comprehensive query (when user says 'everything'):\n" +
        "```\n" +
        "nodes: {\n" +
        "  n0: { ids: ['NCBIGene:4353'], categories: ['biolink:Gene'] },\n" +
        "  n1: { categories: [\n" +
        "    'biolink:BiologicalProcessOrActivity',\n" +
        "    'biolink:Gene',\n" +
        "    'biolink:Protein',\n" +
        "    'biolink:GeneFamily',\n" +
        "    'biolink:DiseaseOrPhenotypicFeature',\n" +
        "    'biolink:AnatomicalEntity',\n" +
        "    'biolink:RNAProduct',\n" +
        "    'biolink:ChemicalMixture',\n" +
        "    'biolink:SmallMolecule',\n" +
        "    'biolink:Polypeptide',\n" +
        "    'biolink:ProteinFamily'\n" +
        "  ] }  // ← Default comprehensive category set\n" +
        "},\n" +
        "edges: {\n" +
        "  e0: { subject: 'n0', object: 'n1' }  // ← NO predicate for comprehensive search\n" +
        "}\n" +
        "```\n\n" +
        
        "**CRITICAL: Do NOT Assume Predicates Based on Node Types**\n" +
        "- Default to NO predicate (omit predicates field entirely) or use biolink:related_to for general queries\n" +
        "- ONLY use specific predicates when the user explicitly describes a relationship\n" +
        "- ONLY use predicates from the known Biolink predicate list below\n" +
        "- Example: 'Find genes related to MPO' → use categories only, NO predicate field\n" +
        "- Example: 'Find genes that regulate MPO' → use biolink:regulates predicate\n" +
        "- Example: 'Find molecular functions of MPO' → use biolink:MolecularActivity category, NO predicate\n\n" +
        
        "**COMPREHENSIVE PREDICATE REFERENCE (use when user specifies relationship):**\n\n" +
        
        "**Most Common Predicates (use these first):**\n" +
        "- biolink:affects - Causal/functional relationships\n" +
        "- biolink:interacts_with - Molecular interactions\n" +
        "- biolink:related_to - General relationships (default if unsure)\n" +
        "- biolink:regulates - Regulatory relationships\n" +
        "- biolink:causes - Causal relationships\n" +
        "- biolink:disrupts - Disruptive effects\n" +
        "- biolink:participates_in - Participation in processes/pathways\n" +
        "- biolink:produces - Production relationships\n" +
        "- biolink:correlated_with - Statistical correlations\n" +
        "- biolink:associated_with - General associations\n\n" +
        
        "**Gene-Specific Predicates:**\n" +
        "- biolink:coexpressed_with - Co-expression relationships\n" +
        "- biolink:colocalizes_with - Co-localization\n" +
        "- biolink:homologous_to - Homology relationships\n" +
        "- biolink:orthologous_to - Orthology relationships\n" +
        "- biolink:genetically_interacts_with - Genetic interactions\n" +
        "- biolink:genetically_associated_with - Genetic associations\n" +
        "- biolink:gene_product_of - Gene product relationships\n" +
        "- biolink:produces - Gene produces protein/RNA\n" +
        "- biolink:regulated_by - Being regulated by\n" +
        "- biolink:derives_from - Derivation relationships\n" +
        "- biolink:derives_into - Derivation into\n" +
        "- biolink:positively_correlated_with - Positive correlations\n" +
        "- biolink:negatively_correlated_with - Negative correlations\n" +
        "- biolink:associated_with_increased_likelihood_of - Risk associations\n" +
        "- biolink:associated_with_sensitivity_to - Sensitivity associations\n" +
        "- biolink:associated_with_resistance_to - Resistance associations\n" +
        "- biolink:biomarker_for - Biomarker relationships\n" +
        "- biolink:capable_of - Functional capabilities\n" +
        "- biolink:expressed_in - Expression relationships\n" +
        "- biolink:located_in - Spatial relationships\n" +
        "- biolink:occurs_in - Occurrence relationships\n" +
        "- biolink:coexists_with - Co-existence\n" +
        "- biolink:overlaps - Overlap relationships\n" +
        "- biolink:part_of - Part relationships\n" +
        "- biolink:has_part - Part-whole relationships\n" +
        "- biolink:has_member - Membership relationships\n" +
        "- biolink:has_participant - Participant relationships\n" +
        "- biolink:has_input - Input relationships\n" +
        "- biolink:in_complex_with - Complex formation\n" +
        "- biolink:chemically_similar_to - Chemical similarity\n" +
        "- biolink:close_match - Similarity relationships\n" +
        "- biolink:same_as - Identity relationships\n" +
        "- biolink:subclass_of - Hierarchical relationships\n" +
        "- biolink:acts_upstream_of - Upstream relationships\n" +
        "- biolink:acts_upstream_of_positive_effect - Positive upstream effects\n" +
        "- biolink:acts_upstream_of_negative_effect - Negative upstream effects\n" +
        "- biolink:acts_upstream_of_or_within - Upstream or within relationships\n" +
        "- biolink:acts_upstream_of_or_within_positive_effect - Positive upstream/within effects\n" +
        "- biolink:acts_upstream_of_or_within_negative_effect - Negative upstream/within effects\n" +
        "- biolink:actively_involved_in - Active involvement\n" +
        "- biolink:enables - Enabling relationships\n" +
        "- biolink:contributes_to - Contribution relationships\n" +
        "- biolink:catalyzes - Catalytic relationships\n" +
        "- biolink:gene_associated_with_condition - Gene-disease associations\n" +
        "- biolink:exacerbates_condition - Exacerbation relationships\n" +
        "- biolink:contraindicated_in - Contraindication relationships\n" +
        "- biolink:preventative_for_condition - Prevention relationships\n" +
        "- biolink:predisposes_to_condition - Predisposition relationships\n" +
        "- biolink:sensitivity_associated_with - Sensitivity associations\n" +
        "- biolink:resistance_associated_with - Resistance associations\n" +
        "- biolink:occurs_together_in_literature_with - Co-occurrence in literature\n" +
        "- biolink:temporally_related_to - Temporal relationships\n\n" +
        
        "**Protein-Specific Predicates:**\n" +
        "- biolink:physically_interacts_with - Physical interactions\n" +
        "- biolink:directly_physically_interacts_with - Direct physical interactions\n" +
        "- biolink:is_substrate_of - Being substrate of\n" +
        "- biolink:has_substrate - Having substrate\n" +
        "- biolink:is_active_ingredient_of - Being active ingredient of\n" +
        "- biolink:has_active_ingredient - Having active ingredient\n" +
        "- biolink:is_active_metabolite_of - Being active metabolite of\n" +
        "- biolink:has_active_metabolite - Having active metabolite\n" +
        "- biolink:is_sequence_variant_of - Sequence variant relationships\n" +
        "- biolink:has_sequence_variant - Having sequence variants\n" +
        "- biolink:is_output_of - Being output of\n" +
        "- biolink:is_input_of - Being input of\n" +
        "- biolink:regulated_by - Being regulated by\n" +
        "- biolink:preceded_by - Being preceded by\n" +
        "- biolink:assesses - Assessing relationships\n" +
        "- biolink:is_assessed_by - Being assessed by\n" +
        "- biolink:superclass_of - Parent class relationships\n" +
        "- biolink:similar_to - Similarity relationships\n" +
        "- biolink:increases_response_to - Response enhancement\n" +
        "- biolink:decreases_response_to - Response reduction\n" +
        "- biolink:response_affected_by - Response affected by\n" +
        "- biolink:treats - Therapeutic relationships\n" +
        "- biolink:treats_or_applied_or_studied_to_treat - Comprehensive therapeutic relationships\n" +
        "- biolink:applied_to_treat - Applied to treat relationships\n" +
        "- biolink:contraindicated_in - Contraindication relationships\n\n" +
        
        "**Therapeutic Focus Predicates:**\n" +
        "- biolink:treats - Drug treats disease\n" +
        "- biolink:treats_or_applied_or_studied_to_treat - Comprehensive therapeutic relationships\n" +
        "- biolink:applied_to_treat - Applied to treat relationships\n" +
        "- biolink:preventative_for_condition - Prevention relationships\n" +
        "- biolink:predisposes_to_condition - Predisposition relationships\n\n" +
        
        "**Functional Relationship Predicates:**\n" +
        "- biolink:enables - Enabling relationships\n" +
        "- biolink:contributes_to - Contribution relationships\n" +
        "- biolink:capable_of - Functional capabilities\n" +
        "- biolink:catalyzes - Catalytic relationships\n" +
        "- biolink:assesses - Assessment relationships\n\n" +
        
        "**Hierarchical Relationship Predicates:**\n" +
        "- biolink:subclass_of - Subclass relationships\n" +
        "- biolink:superclass_of - Superclass relationships\n" +
        "- biolink:part_of - Part relationships\n" +
        "- biolink:has_part - Part-whole relationships\n" +
        "- biolink:has_member - Membership relationships\n\n" +
        
        "**Interaction Type Predicates:**\n" +
        "- biolink:physically_interacts_with - Physical interactions\n" +
        "- biolink:directly_physically_interacts_with - Direct physical interactions\n" +
        "- biolink:genetically_interacts_with - Genetic interactions\n" +
        "- biolink:in_complex_with - Complex formation\n\n" +
        
        "**Response/Pharmacology Predicates:**\n" +
        "- biolink:increases_response_to - Response enhancement\n" +
        "- biolink:decreases_response_to - Response reduction\n" +
        "- biolink:response_affected_by - Response affected by\n" +
        "- biolink:sensitivity_associated_with - Sensitivity associations\n" +
        "- biolink:resistance_associated_with - Resistance associations\n\n" +
        
        "**Literature/Co-occurrence Predicates:**\n" +
        "- biolink:occurs_together_in_literature_with - Co-occurrence in literature\n" +
        "- biolink:coexpressed_with - Co-expression relationships\n" +
        "- biolink:colocalizes_with - Co-localization\n" +
        "- biolink:coexists_with - Co-existence\n\n" +
        
        "**DEFAULT CATEGORY SET (when user says 'everything' or doesn't specify):**\n" +
        "Use these 10 high-priority categories for comprehensive biomedical queries:\n\n" +
        "1. biolink:BiologicalProcessOrActivity (27 associations) - Biological processes and activities\n" +
        "2. biolink:Gene (1,041 associations) - Genes and genetic elements\n" +
        "3. biolink:Protein (1,063 associations) - Proteins and protein targets\n" +
        "4. biolink:GeneFamily (378 associations) - Gene families and target classes\n" +
        "5. biolink:DiseaseOrPhenotypicFeature (732 associations) - Diseases and phenotypes\n" +
        "6. biolink:AnatomicalEntity (638 associations) - Tissues, organs, anatomical structures\n" +
        "7. biolink:RNAProduct (202 associations) - RNA molecules and transcripts\n" +
        "8. biolink:ChemicalMixture (217 associations) - Chemical mixtures and complexes\n" +
        "9. biolink:SmallMolecule (1,063 associations) - Small molecules and drug candidates\n" +
        "10. biolink:Polypeptide (642 associations) - Polypeptides and peptide sequences\n" +
        "11. biolink:ProteinFamily (12 associations) - Protein families and domains\n\n" +
        
        "**ADDITIONAL USEFUL CATEGORIES (when user specifies):**\n" +
        "Use these for more specific queries:\n\n" +
        "Drug and Chemical Categories:\n" +
        "- biolink:Drug - Approved drugs (preferred for drug queries)\n" +
        "- biolink:ChemicalEntity - General drugs/compounds (parent of Drug/SmallMolecule)\n" +
        "- biolink:Disease - Diseases, conditions, and indications\n" +
        "- biolink:PhenotypicFeature - Phenotypes, symptoms, and clinical features\n\n" +
        
        "Functional Annotation Categories:\n" +
        "- biolink:MolecularActivity - Molecular functions (enzymatic activity, binding, catalysis)\n" +
        "- biolink:BiologicalProcess - Biological processes (apoptosis, signaling, metabolism)\n" +
        "- biolink:Pathway - Signaling and metabolic pathways\n" +
        "- biolink:CellularComponent - Subcellular locations (nucleus, mitochondria, membrane)\n\n" +
        
        "Additional Specific Categories:\n" +
        "- biolink:Cell - Cell types for specificity analysis\n" +
        "- biolink:ProteinDomain - Protein functional domains\n" +
        "- biolink:SequenceVariant - Genetic variants and mutations\n" +
        "- biolink:Publication - Scientific publications and literature\n\n" +
        
        "**CATEGORY SELECTION GUIDE:**\n" +
        "- User says 'everything' or doesn't specify → Use DEFAULT CATEGORY SET (11 categories above)\n" +
        "- Find genes related to X → biolink:Gene (NO predicate)\n" +
        "- Find diseases associated with X → biolink:Disease (NO predicate)\n" +
        "- Find drugs for X → biolink:Drug or biolink:SmallMolecule (NO predicate)\n" +
        "- Find what X does → biolink:MolecularActivity or biolink:BiologicalProcess (NO predicate)\n" +
        "- Find pathways X is in → biolink:Pathway (NO predicate or biolink:participates_in)\n" +
        "- Find where X is located → biolink:CellularComponent (NO predicate)\n" +
        "- Find genes that regulate X → biolink:Gene (WITH biolink:regulates predicate)\n" +
        "- Find drugs that treat X → biolink:Drug (WITH biolink:treats predicate)\n" +
        "- Find proteins related to X → biolink:Protein (NO predicate)\n" +
        "- Find gene families for X → biolink:GeneFamily (NO predicate)\n" +
        "- Find anatomical structures for X → biolink:AnatomicalEntity (NO predicate)\n" +
        "- Find RNA products for X → biolink:RNAProduct (NO predicate)\n" +
        "- Find chemical mixtures for X → biolink:ChemicalMixture (NO predicate)\n" +
        "- Find polypeptides for X → biolink:Polypeptide (NO predicate)\n" +
        "- Find protein families for X → biolink:ProteinFamily (NO predicate)\n\n" +
        
        "**DRUG REPURPOSING TIP:** Prefer biolink:Drug or biolink:SmallMolecule over biolink:ChemicalEntity for more specific results.\n\n" +
        
        "**SELF-VALIDATION CHECKLIST:**\n" +
        "Before calling this tool, verify:\n" +
        "✓ All edge subjects exist as node IDs in the nodes object\n" +
        "✓ All edge objects exist as node IDs in the nodes object\n" +
        "✓ Target nodes use categories from the list above\n" +
        "✓ Categories match the query intent (e.g., molecular functions → biolink:MolecularActivity)\n" +
        "✓ Node IDs are consistent (e.g., if edge uses 'n1', nodes must have 'n1')\n" +
        "✓ Predicates are ONLY used when user specifies a relationship\n\n" +
        
        "**COMMON MISTAKES TO AVOID:**\n" +
        "❌ Missing target node: edges reference 'n1' but nodes only defines 'n0'\n" +
        "❌ Wrong category: using biolink:Pathway for molecular functions (should be biolink:MolecularActivity)\n" +
        "❌ Typo in node ID: edge uses 'n1' but nodes defines 'n_1'\n" +
        "❌ Hallucinated predicate: inventing predicates like biolink:has_molecular_function\n" +
        "❌ Unnecessary predicate: using specific predicate when user just said 'find related'",
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
      name: "find_all_connected_nodes",
      description: "Find ALL nodes connected to a single specific entity using optimized predicate sets. " +
        "This tool is specifically designed for 'find all nodes related to X' queries where the user wants " +
        "to see everything connected to ONE specific entity. Uses intelligent predicate selection based on " +
        "the Biolink hierarchy for better performance and quality.\n\n" +
        
        "**QUALITY FILTERING:**\n" +
        "- Automatically excludes low-quality co-occurrence relationships\n" +
        "- Filters out 'occurs_together_in_literature_with' predicates\n" +
        "- Focuses on high-quality biological relationships\n\n" +
        
        "**WHEN TO USE THIS TOOL:**\n" +
        "- User says 'find all nodes connected to [entity]'\n" +
        "- User says 'show me everything related to [entity]'\n" +
        "- User says 'what is connected to [entity]'\n" +
        "- User wants comprehensive connections for ONE specific entity\n\n" +
        
        "**OPTIMIZED APPROACH:**\n" +
        "- Uses category-specific predicate sets for better targeting\n" +
        "- Covers all 11 standard entity categories\n" +
        "- Focuses on high-quality biological relationships\n" +
        "- Combines optimized predicates with comprehensive category coverage\n\n" +
        
        "**PREDICATE SETS BY ENTITY TYPE:**\n" +
        "- **Genes**: Causal + Associational relationships (8 predicates)\n" +
        "- **Proteins**: Interaction + Causal relationships (8 predicates)\n" +
        "- **Diseases**: Associational + Causal relationships (8 predicates)\n" +
        "- **Drugs/Chemicals**: Causal + Interaction relationships (8 predicates)\n" +
        "- **Other entities**: Focused set (5 core predicates)\n\n" +
        
        "**REQUIREMENTS:**\n" +
        "- Exactly ONE entity ID (single CURIE)\n" +
        "- One entity category (auto-detected if not provided)\n" +
        "- Returns connections to all 11 standard categories\n\n" +
        
        "**EXAMPLE USAGE:**\n" +
        "- 'Find all nodes connected to gene NCBIGene:695'\n" +
        "- 'Show me everything related to disease MONDO:0005148'\n" +
        "- 'What is connected to drug DrugBank:DB00001'",
      inputSchema: {
        type: "object",
        properties: {
          entityId: {
            type: "string",
            description: "The entity ID to find connections for (e.g., 'NCBIGene:695', 'MONDO:0005148')"
          },
          entityCategory: {
            type: "string",
            description: "The Biolink category of the entity (e.g., 'biolink:Gene', 'biolink:Disease'). " +
              "If not provided, will be auto-detected from entityId format."
          },
          queryType: {
            type: "string",
            enum: ["focused", "comprehensive", "minimal"],
            description: "Query complexity level. 'focused' is recommended for most use cases.",
            default: "focused"
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
      name: "expand_neighborhood",
      description: "Expand the graph by finding first-degree neighbors of seed nodes using optimized predicates. " +
        "Only keeps nodes connected to 2+ seed nodes (intersection). Marks seed nodes persistently in the database. " +
        "Uses the same optimized predicate sets as find_all_connected_nodes for consistent, high-quality results.\n\n" +
        
        "**QUALITY FILTERING:**\n" +
        "- Automatically excludes low-quality co-occurrence relationships\n" +
        "- Filters out 'occurs_together_in_literature_with' predicates\n" +
        "- Focuses on high-quality biological relationships\n\n" +
        
        "**OPTIMIZED APPROACH:**\n" +
        "- Uses focused predicate set (5 core predicates) for better targeting\n" +
        "- Covers all 11 standard entity categories by default\n" +
        "- Focuses on high-quality biological relationships\n" +
        "- Consistent with find_all_connected_nodes tool\n\n" +
        
        "**PREDICATES USED:**\n" +
        "- biolink:affected_by\n" +
        "- biolink:affects\n" +
        "- biolink:associated_with\n" +
        "- biolink:interacts_with\n" +
        "- biolink:participates_in\n\n" +
        
        "**CATEGORIES SEARCHED (default):**\n" +
        "BiologicalProcessOrActivity, Gene, Protein, GeneFamily, DiseaseOrPhenotypicFeature, " +
        "AnatomicalEntity, RNAProduct, ChemicalMixture, SmallMolecule, Polypeptide, ProteinFamily",
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
    },
    {
      name: "get_comprehensive_summary",
      description: "Get a comprehensive summary of ALL connected nodes across ALL categories and predicates. " +
        "This tool uses an open-ended query structure that finds every node connected to the specified entity, " +
        "regardless of category or relationship type. Returns a detailed summary table showing the count of " +
        "connected nodes broken down by category and predicate. Perfect for getting a complete overview " +
        "of all relationships for a given entity.\n\n" +
        
        "**QUALITY FILTERING:**\n" +
        "- Automatically excludes low-quality co-occurrence relationships\n" +
        "- Filters out 'occurs_together_in_literature_with' predicates\n" +
        "- Focuses on high-quality biological relationships\n\n" +
        
        "**QUERY APPROACH:**\n" +
        "- Uses open-ended query structure (is_set: false)\n" +
        "- Finds ALL nodes connected to the specified entity\n" +
        "- Covers ALL categories (not limited to default set)\n" +
        "- Covers ALL predicates (not limited to specific types)\n" +
        "- Provides truly comprehensive coverage\n\n" +
        
        "**OUTPUT FORMAT:**\n" +
        "Returns a comprehensive summary table with:\n" +
        "- Total nodes found\n" +
        "- Breakdown by category (count per category)\n" +
        "- Breakdown by predicate (count per predicate)\n" +
        "- Category-Predicate matrix (count per category-predicate combination)\n" +
        "- Top relationships by frequency\n\n" +
        
        "**USE CASES:**\n" +
        "- Get complete overview of entity relationships\n" +
        "- Identify most common relationship types\n" +
        "- Discover unexpected connections\n" +
        "- Generate comprehensive entity profiles\n" +
        "- Analyze relationship patterns\n\n" +
        
        "**EXAMPLE:**\n" +
        "Input: NCBIGene:4353 (BRCA1)\n" +
        "Output: Summary table showing ALL categories of connected nodes with counts by predicate\n" +
        "Query Structure:\n" +
        "```\n" +
        "{\n" +
        "  \"nodes\": {\n" +
        "    \"n0\": { \"is_set\": false },\n" +
        "    \"n1\": { \"ids\": [\"NCBIGene:4353\"], \"categories\": [\"biolink:Gene\"] }\n" +
        "  },\n" +
        "  \"edges\": {\n" +
        "    \"e0\": { \"subject\": \"n0\", \"object\": \"n1\" }\n" +
        "  }\n" +
        "}\n" +
        "```",
      inputSchema: {
        type: "object",
        properties: {
          entityId: {
            type: "string",
            description: "The CURIE identifier of the entity to analyze (e.g., 'NCBIGene:4353', 'UniProtKB:P38398')"
          },
          entityCategory: {
            type: "string",
            description: "The Biolink category of the input entity (e.g., 'biolink:Gene', 'biolink:Protein')",
            default: "biolink:Gene"
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

      // VALIDATE QUERY STRUCTURE BEFORE SENDING
      const validationError = validateQueryGraph(queryParams.query_graph);
      if (validationError) {
        console.error(`[${SERVICE_NAME}] Query validation failed:`, validationError);
        
        // Generate suggested fix
        const missingNodeId = validationError.details.missing_node_id;
        const predicates = validationError.details.predicates || [];
        const firstPredicate = predicates[0];
        const suggestedCategory = firstPredicate ? getSuggestedCategoryForPredicate(firstPredicate) : null;
        
        // Build corrected query example
        const correctedQuery = JSON.parse(JSON.stringify(queryParams.query_graph));
        if (!correctedQuery.nodes[missingNodeId]) {
          correctedQuery.nodes[missingNodeId] = {
            categories: suggestedCategory ? [suggestedCategory] : ['biolink:NamedThing']
          };
        }
        
        return {
          content: [{
            type: "text",
            text: `❌ Query Construction Error

**Problem:** ${validationError.error}

**Details:**
- Edge ID: ${validationError.details.edge_id}
- Missing node: ${missingNodeId}
- Reference type: ${validationError.details.edge_reference}
- Defined nodes: ${validationError.details.defined_nodes.join(', ')}

**How to Fix:**
Add the missing node definition to your query. Based on your predicate '${firstPredicate || 'unknown'}', the target node should likely be:

\`\`\`json
"${missingNodeId}": {
  "categories": ["${suggestedCategory || 'biolink:NamedThing'}"]
}
\`\`\`

**Corrected Query Example:**
\`\`\`json
${JSON.stringify(correctedQuery, null, 2)}
\`\`\`

**Action Required:**
Retry your query with the corrected structure above. Make sure ALL nodes referenced in edges are defined in the nodes object.

**Validation Checklist:**
✓ Does every edge subject exist in nodes?
✓ Does every edge object exist in nodes?
✓ Do target nodes have appropriate categories?`
          }],
          isError: true
        };
      }

      // Step 1: Query BTE with timeout protection
      const startTime = Date.now();
      const MCP_TIMEOUT_BUFFER = 10000; // 10 second buffer before MCP timeout
      const TOTAL_PROCESSING_TIMEOUT = 45000; // 45 seconds for BTE + processing
      
      // Start BTE request (don't await it yet)
      const btePromise = makeBTERequest(queryParams.query_graph);
      
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
          
          // Send error notification for BTE request failure
          try {
            fetch(`${queryParams.databaseContext.apiBaseUrl}/api/graph/${queryParams.databaseContext.conversationId}/broadcast`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                type: 'bte-background-error',
                message: `BTE request failed: ${error instanceof Error ? error.message : 'Unknown error'}`
              })
            }).catch(notificationError => {
              console.error(`[${SERVICE_NAME}] Failed to send BTE request error notification:`, notificationError);
            });
          } catch (fetchError) {
            console.error(`[${SERVICE_NAME}] Error creating notification request:`, fetchError);
          }
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
3. If still no results, try a more specific query (fewer categories)

**Query being processed:**
${generateQueryDescription(queryParams.query_graph)}

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
      
      // Step 2: Generate quick summary
      const quickSummary = generateQuickSummary(
        knowledgeGraph.nodes,
        knowledgeGraph.edges
      );

      // Step 3: Start processing with remaining time check
      const remainingTime = MCP_TIMEOUT_BUFFER - (Date.now() - startTime);
      if (remainingTime < 5000) {
        // Not enough time for processing - return summary
        return {
          content: [{
            type: "text",
            text: `⏱️ Large Network Detected - Processing in Background

${quickSummary}

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
        return {
          content: [{
            type: "text",
            text: `⏱️ Large Network Detected - Processing in Background

${quickSummary}

**Note:** Due to the large network size, we're providing this summary while the full graph loads. **Please refresh the page in about 1 minute** to see the complete graph visualization.

The data is being added to the graph in the background.`
          }],
          refreshGraph: false  // Don't refresh yet
        };
      } else {
        // Processing completed in time - return full response
        const queryDescription = generateQueryDescription(queryParams.query_graph);
        const description = trapiResponse.description || 'Query completed';
        
        // Calculate approximate response size for token limit handling
        const stats = result.stats!; // We know stats exists when completed is true
        const estimatedSize = stats.nodeCount * 50; // rough estimate
        let responseText = `✅ BTE Query Complete!

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
Note: Duplicate nodes/edges were automatically skipped.`;

        // Add top connected nodes if response size is reasonable
        if (estimatedSize < 5000) {
          const topNodes = getTopConnectedNodes(trapiResponse, 20);
          if (topNodes) {
            responseText += `\n\n**Top Connected Nodes:**\n${topNodes}`;
          }
        }

        return {
          content: [{
            type: "text",
            text: responseText
          }],
          refreshGraph: true  // CRITICAL: Triggers UI refresh
        };
      }
    }

    if (name === "find_all_connected_nodes") {
      const queryParams = FindAllConnectedNodesArgumentsSchema.parse(args);
      
      console.error(`[${SERVICE_NAME}] Executing find_all_connected_nodes for ${queryParams.entityId}`);
      
      try {
        // Generate optimized query
        const queryGraph = generateOptimizedConnectedNodesQuery(
          queryParams.entityId, 
          queryParams.entityCategory, 
          queryParams.queryType
        );
        
        console.error(`[${SERVICE_NAME}] Generated query:`, JSON.stringify(queryGraph, null, 2));
        
        // Execute BTE query
        const trapiResponse = await makeBTERequest(queryGraph);
        
        if (!trapiResponse || !trapiResponse.message || !trapiResponse.message.knowledge_graph) {
          throw new Error("Invalid BTE response structure");
        }

        // Process and add to database
        const stats = await processTrapiResponse(trapiResponse, queryParams.databaseContext);
        
        // Get entity category for display
        const entityCategory = queryParams.entityCategory || detectEntityCategory(queryParams.entityId);
        const predicates = getOptimizedPredicates(entityCategory, queryParams.queryType);
        
        return {
          content: [{
            type: "text",
            text: `✅ Connected Nodes Found!

**Entity:** ${queryParams.entityId} (${entityCategory})
**Query Type:** ${queryParams.queryType}
**Categories Searched:** 11 standard categories
**Predicates Used:** ${predicates.length} optimized predicates

**Results:**
- Created ${stats.nodeCount} new nodes
- Created ${stats.edgeCount} new edges

**Categories:** BiologicalProcessOrActivity, Gene, Protein, GeneFamily, DiseaseOrPhenotypicFeature, AnatomicalEntity, RNAProduct, ChemicalMixture, SmallMolecule, Polypeptide, ProteinFamily

**Predicate Set:** ${predicates.join(', ')}

**Optimization:** This query used category-specific predicate selection combined with comprehensive category coverage for optimal results.

The graph has been updated with all connected nodes.`
          }],
          refreshGraph: true
        };
      } catch (error) {
        console.error(`[${SERVICE_NAME}] Find all connected nodes failed:`, error);
        return {
          content: [{
            type: "text",
            text: `❌ Find All Connected Nodes Failed

**Error:** ${error instanceof Error ? error.message : 'Unknown error'}

**Troubleshooting:**
- Verify the entity ID format (e.g., NCBIGene:695, MONDO:0005148)
- Check that the entity exists in BTE
- Try a different query type (focused, comprehensive, minimal)

**Entity ID:** ${queryParams.entityId}
**Detected Category:** ${detectEntityCategory(queryParams.entityId)}

The graph state has not been modified.`
          }]
        };
      }
    }

    if (name === "expand_neighborhood") {
      const queryParams = ExpandNeighborhoodArgumentsSchema.parse(args);
      
      console.error(`[${SERVICE_NAME}] Executing neighborhood expansion for ${queryParams.nodeIds.length} seed nodes`);
      
      try {
        // Step 1: Mark seed nodes (continue even if this fails)
        try {
          await markNodesAsSeed(queryParams.nodeIds, queryParams.databaseContext);
        } catch (error) {
          console.error(`[${SERVICE_NAME}] Warning: Failed to mark some nodes as seeds:`, error);
        }
        
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
**Categories Searched:** ${queryParams.categories ? queryParams.categories.length : 11} categories
**Predicates Used:** 5 optimized predicates

${queryParams.categories ? `**Categories:** ${queryParams.categories.join(', ')}` : '**Categories:** All 11 standard categories'}

**Results:**
- Created ${stats.nodeCount} new nodes
- Created ${stats.edgeCount} new edges

**Predicate Set:** affected_by, affects, associated_with, interacts_with, participates_in

${summary}

**Summary:** Each seed node now shows its connection count to different node types. The graph has been updated with the neighborhood expansion using optimized predicates for better quality results.`
          }],
          refreshGraph: true
        };
      } catch (error) {
        console.error(`[${SERVICE_NAME}] Neighborhood expansion failed:`, error);
        return {
          content: [{
            type: "text",
            text: `❌ Neighborhood Expansion Failed

**Error:** ${error instanceof Error ? error.message : 'Unknown error'}

**Troubleshooting:**
- BTE API may be temporarily unavailable
- Network connectivity issues
- Query may be too complex

**Suggestions:**
- Try again in a few minutes
- Simplify the query (fewer seed nodes)
- Check network connection

The graph state has not been modified.`
          }]
        };
      }
    }

    if (name === "get_comprehensive_summary") {
      const queryParams = args as { entityId: string; entityCategory?: string; databaseContext: any };
      const entityCategory = normalizeCategoryToBiolink(queryParams.entityCategory || "Gene");
      
      console.error(`[${SERVICE_NAME}] Executing comprehensive summary for ${queryParams.entityId} (${entityCategory})`);
      
      try {
        // Create comprehensive query using the open-ended structure
        // This queries for ALL categories and predicates connected to the entity
        const queryGraph = {
          nodes: {
            n0: {
              is_set: false  // This means "find all nodes connected to n1"
            },
            n1: {
              ids: [queryParams.entityId],
              categories: [entityCategory]
            }
          },
          edges: {
            e0: {
              subject: "n0",
              object: "n1"
              // No predicates specified = all predicates
            }
          }
        };

        console.error(`[${SERVICE_NAME}] Querying BTE with comprehensive categories...`);
        const trapiResponse = await makeBTERequest(queryGraph);
        
        if (!trapiResponse || !trapiResponse.message || !trapiResponse.message.knowledge_graph) {
          throw new Error("Invalid BTE response structure");
        }

        const kg = trapiResponse.message.knowledge_graph;
        const nodes = kg.nodes || {};
        const edges = kg.edges || {};

        // Analyze the results
        const analysis = analyzeComprehensiveResults(nodes, edges, queryParams.entityId);
        
        // Add results to graph
        await processTrapiResponse(trapiResponse, queryParams.databaseContext);

        return {
          content: [{
            type: "text",
            text: `✅ Comprehensive Summary Complete!

**Entity Analyzed:** ${queryParams.entityId} (${entityCategory})
**Total Connected Nodes:** ${analysis.totalNodes}
**Total Relationships:** ${analysis.totalEdges}

## 📊 Summary by Category
${analysis.categoryBreakdown.map(item => 
  `- **${item.category}**: ${item.count} nodes`
).join('\n')}

## 🔗 Summary by Predicate  
${analysis.predicateBreakdown.map(item => 
  `- **${item.predicate}**: ${item.count} relationships`
).join('\n')}

## 📈 Top Category-Predicate Combinations
${analysis.topCombinations.map(item => 
  `- **${item.category}** via **${item.predicate}**: ${item.count} relationships`
).join('\n')}

## 🎯 Key Insights
${analysis.insights.map(insight => `- ${insight}`).join('\n')}

**Graph Updated:** All relationships have been added to the current graph visualization.`
          }],
          refreshGraph: true
        };

      } catch (error) {
        console.error(`[${SERVICE_NAME}] Comprehensive summary failed:`, error);
        return {
          content: [{
            type: "text",
            text: `❌ Comprehensive Summary Failed

**Error:** ${error instanceof Error ? error.message : 'Unknown error'}

**Troubleshooting:**
- BTE API may be temporarily unavailable
- Entity ID may be invalid or not found
- Network connectivity issues

**Suggestions:**
- Verify the entity ID is correct
- Try again in a few minutes
- Check network connection

The graph state has not been modified.`
          }]
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

    // Check if this is a BTE API error
    const errorMessage = error instanceof Error ? error.message : String(error);
    const isBTEError = errorMessage.includes('BTE API error');
    const isQueryNotTraversable = errorMessage.includes('QueryNotTraversable');
    
    if (isBTEError && isQueryNotTraversable) {
      // Extract details from error message
      const isInvalidQuery = errorMessage.includes('InvalidQueryGraphError');
      
      return {
        content: [{
          type: "text",
          text: `❌ BTE Query Structure Error

**Error Type:** Query Not Traversable
**Status:** The query structure is invalid

**What This Means:**
The BTE API rejected your query because it has a structural problem. This usually means:
- A node referenced in edges is not defined in the nodes object
- An edge points to a non-existent node
- The query graph is incomplete

**Common Causes:**
1. Missing target node definition (most common)
2. Typo in node ID references
3. Edge references wrong node ID

**How to Fix:**
1. Check that ALL nodes used in edges are defined in the nodes object
2. Verify node IDs match exactly (case-sensitive)
3. Ensure target nodes have appropriate categories

**Example of Correct Structure:**
\`\`\`json
{
  "nodes": {
    "n0": { "ids": ["NCBIGene:4353"] },
    "n1": { "categories": ["biolink:MolecularActivity"] }  ← MUST be defined
  },
  "edges": {
    "e0": { "subject": "n0", "object": "n1" }  ← both n0 and n1 must exist above
  }
}
\`\`\`

**Recommended Action:**
Review your query structure and ensure all referenced nodes are properly defined. Retry with the corrected query.

**Original Error:**
${errorMessage}`
        }],
        isError: true
      };
    }

    // Generic error fallback
    return {
      content: [{
        type: "text",
        text: `❌ BTE Query Failed:\n${errorMessage}\n\n` +
              `**Troubleshooting:**\n` +
              `- Verify all nodes referenced in edges are defined\n` +
              `- Check that node IDs match exactly\n` +
              `- Ensure target nodes have appropriate categories\n` +
              `- Review the query construction rules in the tool description`
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
  console.error(`[${SERVICE_NAME}] BTE GraphMode MCP Server running on stdio`);
}

main().catch(console.error);

