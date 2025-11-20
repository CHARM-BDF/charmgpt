#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

// =============================================================================
// CONFIGURATION
// =============================================================================
const SERVICE_NAME = "graphmode-gene-enrichment-mcp";
const TOOL_NAME = "Graph Mode Gene Enrichment MCP";
const DEFAULT_API_BASE_URL = process.env.API_BASE_URL || "http://localhost:3001";
const GENE_ENRICH_BASE_URL = process.env.GENE_ENRICH_BASE_URL || "https://translator.broadinstitute.org/gelinea-trapi/v1.5";

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================
interface TRAPINode {
  name?: string;
  categories?: string[];
  attributes?: Array<{
    attribute_type_id: string;
    value: any;
  }>;
}

interface TRAPIEdge {
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

interface TRAPIResponse {
  message: {
    knowledge_graph?: {
      nodes: Record<string, TRAPINode>;
      edges: Record<string, TRAPIEdge>;
    };
    results?: Array<{
      node_bindings: Record<string, Array<{ kg_id: string }>>;
      edge_bindings?: Record<string, Array<{ kg_id: string }>>;
      analyses?: Array<{
        resource_id?: string;
        score?: number;
        edge_bindings?: Record<string, Array<{ kg_id: string }>>;
      }>;
    }>;
  };
  status?: string;
  description?: string;
  logs?: Array<{
    level?: string;
    message?: string;
  }>;
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

const GeneEnrichmentQuerySchema = z.object({
  gene_ids: z.array(z.string()).max(2500, "Maximum 2500 genes per request").optional(),
  pvalue_threshold: z.number().min(0).max(1).optional().default(0.05),
  include_workflow: z.boolean().optional().default(true),
  submitter: z.string().optional(),
  bypass_cache: z.boolean().optional().default(false),
  add_to_graph: z.boolean().optional().default(true),
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
// API REQUEST HELPERS
// =============================================================================

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
 * Make TRAPI request to gene enrichment service
 */
async function makeTRAPIRequest(endpoint: string, method: 'GET' | 'POST' = 'GET', body?: any): Promise<any> {
  const url = new URL(`${GENE_ENRICH_BASE_URL}${endpoint}`);
  
  const headers: Record<string, string> = {
    'Accept': 'application/json',
    'User-Agent': `${SERVICE_NAME}/1.0.0`,
  };

  if (method === 'POST') {
    headers['Content-Type'] = 'application/json';
  }

  console.error(`[${SERVICE_NAME}] Making TRAPI request to: ${url.toString()}`);

  try {
    const requestOptions: RequestInit = {
      method,
      headers,
    };

    if (method === 'POST' && body) {
      requestOptions.body = JSON.stringify(body);
      console.error(`[${SERVICE_NAME}] TRAPI request body: ${JSON.stringify(body, null, 2).substring(0, 1000)}...`);
    }

    const response = await fetch(url.toString(), requestOptions);
    
    console.error(`[${SERVICE_NAME}] TRAPI response status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`TRAPI endpoint not found: ${endpoint}`);
      }
      if (response.status === 400) {
        const errorText = await response.text();
        throw new Error(`Invalid TRAPI request: ${errorText}`);
      }
      if (response.status === 413) {
        throw new Error(`Payload too large. Gene list exceeds batch size limit of 2500.`);
      }
      if (response.status === 429) {
        throw new Error(`Rate limit exceeded. Please wait before retrying.`);
      }
      if (response.status === 500) {
        const errorText = await response.text();
        console.error(`[${SERVICE_NAME}] TRAPI 500 error details: ${errorText}`);
        throw new Error(`Internal server error in TRAPI service: ${errorText}`);
      }
      if (response.status === 501) {
        throw new Error(`TRAPI endpoint not implemented: ${endpoint}`);
      }
      throw new Error(`TRAPI request failed: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`[${SERVICE_NAME}] TRAPI request error:`, error);
    throw error;
  }
}

// =============================================================================
// TRANSFORMATION FUNCTIONS
// =============================================================================

/**
 * Transform TRAPI node to GraphMode format
 */
function transformTRAPINodeToGraphMode(nodeId: string, node: TRAPINode): GraphModeNode {
  const category = node.categories?.[0] || 'biolink:NamedThing';
  const type = category.replace('biolink:', '');
  const label = node.name || nodeId;

  return {
    id: nodeId,
    label: label,
    type: type,
    data: {
      categories: node.categories || [],
      attributes: node.attributes || [],
      source: 'gene-enrichment',
      originalId: nodeId,
    },
    position: {
      x: Math.random() * 800 + 100,
      y: Math.random() * 600 + 100,
    }
  };
}

/**
 * Extract primary source from TRAPI edge sources
 */
function extractPrimarySource(sources?: Array<{ resource_id: string; resource_role: string }>): string {
  if (!sources || sources.length === 0) {
    return 'gelinea';
  }
  // Get the first primary source
  const primary = sources.find(s => s.resource_role === 'primary_knowledge_source');
  return primary?.resource_id || sources[0]?.resource_id || 'gelinea';
}

/**
 * Extract publications from TRAPI edge attributes
 */
function extractPublications(attributes?: Array<{ attribute_type_id: string; value: any }>): string[] {
  if (!attributes) return [];
  
  const publications: string[] = [];
  attributes.forEach(attr => {
    if (attr.attribute_type_id === 'biolink:publications' || 
        attr.attribute_type_id === 'biolink:publication' ||
        attr.attribute_type_id?.includes('publication')) {
      if (Array.isArray(attr.value)) {
        publications.push(...attr.value);
      } else {
        publications.push(attr.value);
      }
    }
  });
  
  return publications;
}

/**
 * Extract enrichment metadata from TRAPI edge attributes
 */
function extractEnrichmentMetadata(attributes?: Array<{ attribute_type_id: string; value: any }>): {
  overlap?: number;
  totalGenes?: number;
  pValue?: number;
  adjustedPValue?: number;
} {
  if (!attributes) return {};
  
  const metadata: {
    overlap?: number;
    totalGenes?: number;
    pValue?: number;
    adjustedPValue?: number;
  } = {};
  
  attributes.forEach(attr => {
    if (attr.attribute_type_id === 'GELINEA:gene_list_overlap') {
      metadata.overlap = typeof attr.value === 'number' ? attr.value : parseInt(attr.value, 10);
    } else if (attr.attribute_type_id === 'GELINEA:gene_list_connections') {
      metadata.totalGenes = typeof attr.value === 'number' ? attr.value : parseInt(attr.value, 10);
    } else if (attr.attribute_type_id === 'biolink:p_value') {
      metadata.pValue = typeof attr.value === 'number' ? attr.value : parseFloat(attr.value);
    } else if (attr.attribute_type_id === 'biolink:adjusted_p_value') {
      metadata.adjustedPValue = typeof attr.value === 'number' ? attr.value : parseFloat(attr.value);
    }
  });
  
  return metadata;
}

/**
 * Transform TRAPI edge to GraphMode format with composite ID
 */
function transformTRAPIEdgeToGraphMode(
  edgeId: string,
  edge: TRAPIEdge,
  graphId: string
): GraphModeEdge {
  const source = edge.subject;
  const target = edge.object;
  const label = edge.predicate.replace('biolink:', '');
  const dataSource = 'gene-enrichment';
  const primarySource = extractPrimarySource(edge.sources);
  
  // Generate deterministic composite ID for deduplication
  const compositeId = [
    graphId,
    dataSource,
    primarySource,
    source,
    label,
    target
  ].join('|');
  
  // Extract enrichment-specific metadata
  const enrichmentMetadata = extractEnrichmentMetadata(edge.attributes);
  
  // Build enrichedEdgeData object if we have enrichment metadata
  const enrichedEdgeData = (enrichmentMetadata.overlap !== undefined || 
                             enrichmentMetadata.totalGenes !== undefined || 
                             enrichmentMetadata.pValue !== undefined) 
    ? {
        overlap: enrichmentMetadata.overlap,
        totalGenes: enrichmentMetadata.totalGenes,
        pValue: enrichmentMetadata.pValue,
        adjustedPValue: enrichmentMetadata.adjustedPValue,
      }
    : undefined;
  
  return {
    id: compositeId,
    source: source,
    target: target,
    label: label,
    data: {
      source: dataSource,
      primary_source: primarySource,
      publications: extractPublications(edge.attributes),
      attributes: edge.attributes || [],
      sources: edge.sources || [],
      edgeId: edgeId,
      // Enrichment-specific metadata organized under enrichedEdgeData
      ...(enrichedEdgeData && { enrichedEdgeData }),
    }
  };
}

// =============================================================================
// PROCESSING FUNCTIONS
// =============================================================================

/**
 * Process TRAPI response and create nodes/edges in database
 */
async function processTrapiResponse(
  trapiResponse: TRAPIResponse,
  databaseContext: { conversationId: string; apiBaseUrl?: string; accessToken?: string }
): Promise<{ nodeCount: number; edgeCount: number; resultCount: number }> {
  const knowledgeGraph = trapiResponse.message?.knowledge_graph;
  
  if (!knowledgeGraph) {
    throw new Error('No knowledge graph in TRAPI response');
  }

  const nodes = knowledgeGraph.nodes || {};
  const edges = knowledgeGraph.edges || {};
  const results = trapiResponse.message?.results || [];

  console.error(`[${SERVICE_NAME}] Processing ${Object.keys(nodes).length} nodes and ${Object.keys(edges).length} edges`);

  // Step 1: Transform all nodes
  const transformedNodes: GraphModeNode[] = [];
  for (const [nodeId, nodeData] of Object.entries(nodes)) {
    try {
      const graphModeNode = transformTRAPINodeToGraphMode(nodeId, nodeData);
      transformedNodes.push(graphModeNode);
    } catch (error) {
      console.error(`[${SERVICE_NAME}] Failed to transform node ${nodeId}:`, error);
    }
  }

  // Step 2: Bulk create nodes (with batching for large payloads)
  let nodesCreated = 0;
  if (transformedNodes.length > 0) {
    try {
      const batchSize = 500;
      const batches = [];
      for (let i = 0; i < transformedNodes.length; i += batchSize) {
        batches.push(transformedNodes.slice(i, i + batchSize));
      }
      
      console.error(`[${SERVICE_NAME}] Creating ${transformedNodes.length} nodes in ${batches.length} batches`);
      
      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        const nodeResult = await makeAPIRequest('/nodes/bulk', databaseContext, {
          method: 'POST',
          body: JSON.stringify({ nodes: batch })
        });
        
        nodesCreated += nodeResult.created || 0;
        console.error(`[${SERVICE_NAME}] Batch ${i + 1}: created ${nodeResult.created || 0} nodes (${nodeResult.skipped || 0} skipped)`);
      }
    } catch (error) {
      console.error(`[${SERVICE_NAME}] Failed to bulk create nodes:`, error);
      throw error;
    }
  }

  // Step 3: Transform edges with composite IDs
  const transformedEdges: GraphModeEdge[] = [];
  
  for (const [edgeId, edgeData] of Object.entries(edges)) {
    try {
      const graphModeEdge = transformTRAPIEdgeToGraphMode(
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
      const batchSize = 500;
      const batches = [];
      for (let i = 0; i < transformedEdges.length; i += batchSize) {
        batches.push(transformedEdges.slice(i, i + batchSize));
      }
      
      console.error(`[${SERVICE_NAME}] Creating ${transformedEdges.length} edges in ${batches.length} batches`);
      
      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        const edgeResult = await makeAPIRequest('/edges/bulk', databaseContext, {
          method: 'POST',
          body: JSON.stringify({ edges: batch })
        });
        
        edgesCreated += edgeResult.created || 0;
        console.error(`[${SERVICE_NAME}] Batch ${i + 1}: created ${edgeResult.created || 0} edges (${edgeResult.skipped || 0} skipped)`);
      }
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
 * Extract enriched groups directly from knowledge_graph nodes and edges
 */
function extractEnrichedGroups(trapiResponse: TRAPIResponse): Array<{
  curie: string;
  name: string;
  overlap: number;
  totalGenes: number;
  pValue?: number;
  geneIds: string[];
}> {
  const knowledgeGraph = trapiResponse.message?.knowledge_graph;
  if (!knowledgeGraph) {
    return [];
  }

  const nodes = knowledgeGraph.nodes || {};
  const edges = knowledgeGraph.edges || {};

  // Find all pathway/term nodes (non-gene nodes)
  const pathwayNodes = new Map<string, string>(); // nodeId (CURIE) -> name
  Object.entries(nodes).forEach(([nodeId, node]: [string, any]) => {
    const isGene = node.categories?.some((cat: string) => 
      cat === 'biolink:Gene' || cat.includes('Gene')
    );
    if (!isGene) {
      pathwayNodes.set(nodeId, node.name || nodeId);
    }
  });

  // Count genes for each pathway/term via edges
  // GeLiNEA creates a GeneSet node (is_set: true) that aggregates all input genes
  // The overlap count is in GELINEA:gene_list_overlap
  // The total genes count is in GELINEA:gene_list_connections
  const pathwayToData = new Map<string, { 
    overlap: number;        // Direct overlap (gene_list_overlap)
    totalGenes: number;     // Total genes (gene_list_connections)
    geneIds: Set<string>;
    pValue?: number;
  }>(); // pathway CURIE -> data
  
  Object.entries(edges).forEach(([edgeId, edge]: [string, any]) => {
    const subject = edge.subject;
    const object = edge.object;
    
    const subjectNode = nodes[subject];
    const objectNode = nodes[object];
    
    if (!subjectNode || !objectNode) return;
    
    const subjectIsGeneSet = (subjectNode as any).is_set === true || 
                            (subjectNode.categories?.some((cat: string) => 
                              cat === 'biolink:Gene' || cat.includes('Gene')
                            ) && subject.startsWith('GeneSet:'));
    const objectIsGeneSet = (objectNode as any).is_set === true || 
                            (objectNode.categories?.some((cat: string) => 
                              cat === 'biolink:Gene' || cat.includes('Gene')
                            ) && object.startsWith('GeneSet:'));
    
    // Case 1: subject is GeneSet, object is pathway
    if (subjectIsGeneSet && pathwayNodes.has(object)) {
      const pathwayCurie = object;
      
      // Extract overlap, total genes, and p-value from edge attributes
      let overlap = 0;
      let totalGenes = 0;
      let pValue: number | undefined;
      
      const edgeAttrs = edge.attributes || [];
      edgeAttrs.forEach((attr: any) => {
        if (attr.attribute_type_id === 'GELINEA:gene_list_overlap') {
          overlap = typeof attr.value === 'number' ? attr.value : parseInt(attr.value, 10);
        }
        if (attr.attribute_type_id === 'GELINEA:gene_list_connections') {
          totalGenes = typeof attr.value === 'number' ? attr.value : parseInt(attr.value, 10);
        }
        if (attr.attribute_type_id === 'biolink:p_value') {
          pValue = typeof attr.value === 'number' ? attr.value : parseFloat(attr.value);
        }
      });
      
      // If no overlap attribute found, default to 1 (connection exists)
      if (overlap === 0 && subjectIsGeneSet) {
        overlap = 1;
      }
      if (totalGenes === 0 && subjectIsGeneSet) {
        totalGenes = 1;
      }
      
      if (!pathwayToData.has(pathwayCurie)) {
        pathwayToData.set(pathwayCurie, {
          overlap: overlap,
          totalGenes: totalGenes,
          geneIds: new Set(),
          pValue: pValue
        });
      } else {
        const existing = pathwayToData.get(pathwayCurie)!;
        // Use the maximum values if multiple edges exist
        if (overlap > existing.overlap) {
          existing.overlap = overlap;
        }
        if (totalGenes > existing.totalGenes) {
          existing.totalGenes = totalGenes;
        }
        if (pValue !== undefined && (existing.pValue === undefined || pValue < existing.pValue)) {
          existing.pValue = pValue;
        }
      }
      
      // Add the GeneSet ID to track which genes are involved
      pathwayToData.get(pathwayCurie)!.geneIds.add(subject);
    }
    // Case 2: subject is pathway, object is GeneSet (reversed direction)
    else if (pathwayNodes.has(subject) && objectIsGeneSet) {
      const pathwayCurie = subject;
      
      // Extract overlap, total genes, and p-value from edge attributes
      let overlap = 0;
      let totalGenes = 0;
      let pValue: number | undefined;
      
      const edgeAttrs = edge.attributes || [];
      edgeAttrs.forEach((attr: any) => {
        if (attr.attribute_type_id === 'GELINEA:gene_list_overlap') {
          overlap = typeof attr.value === 'number' ? attr.value : parseInt(attr.value, 10);
        }
        if (attr.attribute_type_id === 'GELINEA:gene_list_connections') {
          totalGenes = typeof attr.value === 'number' ? attr.value : parseInt(attr.value, 10);
        }
        if (attr.attribute_type_id === 'biolink:p_value') {
          pValue = typeof attr.value === 'number' ? attr.value : parseFloat(attr.value);
        }
      });
      
      if (overlap === 0 && objectIsGeneSet) {
        overlap = 1;
      }
      if (totalGenes === 0 && objectIsGeneSet) {
        totalGenes = 1;
      }
      
      if (!pathwayToData.has(pathwayCurie)) {
        pathwayToData.set(pathwayCurie, {
          overlap: overlap,
          totalGenes: totalGenes,
          geneIds: new Set(),
          pValue: pValue
        });
      } else {
        const existing = pathwayToData.get(pathwayCurie)!;
        if (overlap > existing.overlap) {
          existing.overlap = overlap;
        }
        if (totalGenes > existing.totalGenes) {
          existing.totalGenes = totalGenes;
        }
        if (pValue !== undefined && (existing.pValue === undefined || pValue < existing.pValue)) {
          existing.pValue = pValue;
        }
      }
      
      pathwayToData.get(pathwayCurie)!.geneIds.add(object);
    }
  });

  // Convert to array format
  const enrichedGroups: Array<{
    curie: string;
    name: string;
    overlap: number;
    totalGenes: number;
    pValue?: number;
    geneIds: string[];
  }> = [];

  pathwayToData.forEach((data, pathwayCurie) => {
    const pathwayName = pathwayNodes.get(pathwayCurie) || pathwayCurie;
    enrichedGroups.push({
      curie: pathwayCurie,
      name: pathwayName,
      overlap: data.overlap,
      totalGenes: data.totalGenes,
      pValue: data.pValue,
      geneIds: Array.from(data.geneIds)
    });
  });

  // Sort by overlap (descending)
  enrichedGroups.sort((a, b) => b.overlap - a.overlap);

  return enrichedGroups;
}

/**
 * Format enrichment group name by removing underscores and converting to title case
 */
function formatGroupName(name: string): string {
  // Replace underscores with spaces and convert to title case
  return name
    .replace(/_/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Format summary from enriched groups extracted from nodes and edges
 */
function formatEnrichmentSummaryFromGroups(
  enrichedGroups: Array<{ curie: string; name: string; overlap: number; totalGenes: number; pValue?: number; geneIds: string[] }>,
  stats: { nodeCount: number; edgeCount: number; resultCount: number },
  geneIds: string[],
  addToGraph: boolean
): string {
  let summary = [
    `THE FOLLOWING SUMMARY SHOULD BE RETURNED TO THE USER AND SHOULD BE COMPLETE AND IN THE GIVEN FORMAT`,
    ``,
    `## Gene Enrichment Analysis Complete`,
    ``,
    `**Status:** Success`,
    `**Input Genes:** ${geneIds.length}`,
    ``,
  ];

  if (addToGraph && enrichedGroups.length > 0) {
    summary.push(`### Graph Updates`);
    summary.push(`- **Number of Enrichment Groups:** ${enrichedGroups.length}`);
    summary.push(``);
  }

  if (enrichedGroups.length > 0) {
    summary.push(`### Enriched Groups (${enrichedGroups.length} total)`);
    summary.push(``);
    
    enrichedGroups.forEach((group) => {
      const formattedName = formatGroupName(group.name);
      summary.push(`### ${formattedName}`);
      summary.push(``);
      summary.push(`**Overlap:** ${group.overlap}`);
      summary.push(`**Total genes:** ${group.totalGenes}`);
      
      if (group.pValue !== undefined) {
        // Round p-value to 3 decimal places
        const roundedPValue = Math.round(group.pValue * 1000) / 1000;
        summary.push(`**GeLiNEA network enrichment (p-value):** ${roundedPValue.toFixed(3)}`);
      } else {
        summary.push(`**GeLiNEA network enrichment (p-value):** N/A`);
      }
      
      summary.push(``);
    });
  } else {
    summary.push(`### No Enrichment Results Found`);
    summary.push(`No statistically significant enrichment was found for the provided gene list.`);
  }

  return summary.join('\n');
}

/**
 * Format summary of enrichment results showing genes in enriched groups
 */
function formatEnrichmentSummary(
  trapiResponse: TRAPIResponse,
  stats: { nodeCount: number; edgeCount: number; resultCount: number },
  geneIds: string[]
): string {
  const results = trapiResponse.message?.results || [];
  const knowledgeGraph = trapiResponse.message?.knowledge_graph;
  const nodes = knowledgeGraph?.nodes || {};
  const edges = knowledgeGraph?.edges || {};

  let summary = [
    `## Gene Enrichment Analysis Complete`,
    ``,
    `**Status:** ${trapiResponse.status || 'Success'}`,
    `**Description:** ${trapiResponse.description || 'Gene enrichment analysis completed'}`,
    ``,
    `### Results Summary`,
    `- **Enrichment Results Found:** ${stats.resultCount}`,
    `- **Nodes Added to Graph:** ${stats.nodeCount}`,
    `- **Edges Added to Graph:** ${stats.edgeCount}`,
    `- **Input Genes:** ${geneIds.length}`,
    ``,
  ];

  // Extract enriched terms/pathways from knowledge_graph edges (GeLiNEA returns empty results array)
  // Edges connect genes (subject) to pathways/terms (object)
  const enrichedGroups: Array<{
    termId: string;
    termName: string;
    score: number;
    genes: string[];
  }> = [];

  // First, try to extract from results array if available
  if (results.length > 0) {
    results.slice(0, 10).forEach((result, index) => {
      const analyses = result.analyses || [];
      const nodeBindings = result.node_bindings || {};
      
      // Find enriched term/pathway nodes (non-gene nodes)
      const enrichedTermIds: string[] = [];
      const geneNodeIds: string[] = [];

      Object.entries(nodeBindings).forEach(([key, bindings]: [string, any]) => {
        if (Array.isArray(bindings)) {
          bindings.forEach((binding: any) => {
            const nodeId = binding.kg_id || binding.id;
            const node = nodes[nodeId];
            if (node) {
              const isGene = node.categories?.some((cat: string) => 
                cat === 'biolink:Gene' || cat.includes('Gene')
              );
              if (isGene) {
                geneNodeIds.push(nodeId);
              } else {
                enrichedTermIds.push(nodeId);
              }
            }
          });
        }
      });

      // Get the best score from analyses
      const bestAnalysis = analyses.length > 0 ? analyses[0] : null;
      const score = bestAnalysis?.score ?? 0;

      // Get term name from node
      enrichedTermIds.forEach(termId => {
        const termNode = nodes[termId];
        const termName = termNode?.name || termId;
        
        enrichedGroups.push({
          termId,
          termName,
          score,
          genes: geneNodeIds
        });
      });
    });
  }

  // If no results in results array, extract from knowledge_graph edges
  if (enrichedGroups.length === 0 && Object.keys(edges).length > 0) {
    // Build a map of pathway/term -> genes and scores
    const termToGenes = new Map<string, { name: string; genes: Set<string>; scores: number[] }>();
    
    // Find all pathway/term nodes (non-gene nodes)
    const pathwayNodes = new Map<string, string>(); // nodeId -> name
    Object.entries(nodes).forEach(([nodeId, node]: [string, any]) => {
      const isGene = node.categories?.some((cat: string) => 
        cat === 'biolink:Gene' || cat.includes('Gene')
      );
      if (!isGene) {
        pathwayNodes.set(nodeId, node.name || nodeId);
      }
    });

    // Process edges to find gene -> pathway connections
    Object.entries(edges).forEach(([edgeId, edge]: [string, any]) => {
      const subject = edge.subject;
      const object = edge.object;
      
      // Check if subject is a gene and object is a pathway/term
      const subjectNode = nodes[subject];
      const objectNode = nodes[object];
      
      if (subjectNode && objectNode) {
        const subjectIsGene = subjectNode.categories?.some((cat: string) => 
          cat === 'biolink:Gene' || cat.includes('Gene')
        );
        const objectIsPathway = pathwayNodes.has(object);
        
        if (subjectIsGene && objectIsPathway) {
          const termId = object;
          const termName = objectNode.name || termId;
          
          if (!termToGenes.has(termId)) {
            termToGenes.set(termId, {
              name: termName,
              genes: new Set([subject]),
              scores: []
            });
          } else {
            termToGenes.get(termId)!.genes.add(subject);
          }
          
          // Extract p-value from edge attributes
          const edgeAttrs = edge.attributes || [];
          edgeAttrs.forEach((attr: any) => {
            if (attr.attribute_type_id === 'biolink:p_value' || 
                attr.original_attribute_name?.toLowerCase().includes('p-value') ||
                attr.original_attribute_name?.toLowerCase().includes('pvalue')) {
              const pValue = typeof attr.value === 'number' ? attr.value : parseFloat(attr.value);
              if (!isNaN(pValue)) {
                termToGenes.get(termId)!.scores.push(pValue);
              }
            }
          });
        }
      }
    });

    // Convert to enrichedGroups format
    termToGenes.forEach((data, termId) => {
      // Use minimum (best) p-value from scores, or 0 if none found
      const score = data.scores.length > 0 ? Math.min(...data.scores) : 0;
      enrichedGroups.push({
        termId,
        termName: data.name,
        score,
        genes: Array.from(data.genes)
      });
    });

    // Sort by score (p-value, lower is better)
    enrichedGroups.sort((a, b) => a.score - b.score);
  }

  // Group by term and aggregate genes (if needed)
  const termMap = new Map<string, { name: string; score: number; genes: Set<string> }>();
  enrichedGroups.forEach(group => {
    if (!termMap.has(group.termId)) {
      termMap.set(group.termId, {
        name: group.termName,
        score: group.score,
        genes: new Set(group.genes)
      });
    } else {
      const existing = termMap.get(group.termId)!;
      group.genes.forEach(g => existing.genes.add(g));
      // Keep the best (lowest) score
      if (group.score > 0 && (existing.score === 0 || group.score < existing.score)) {
        existing.score = group.score;
      }
    }
  });

  // Format output
  if (termMap.size > 0) {
    const sortedTerms = Array.from(termMap.entries())
      .sort((a, b) => {
        // Sort by score (p-value), but handle 0 scores (no p-value found) last
        if (a[1].score === 0 && b[1].score === 0) return 0;
        if (a[1].score === 0) return 1;
        if (b[1].score === 0) return -1;
        return a[1].score - b[1].score;
      })
      .slice(0, 10);

    summary.push(`### Enriched Groups (Top ${Math.min(10, sortedTerms.length)})`);
    
    sortedTerms.forEach(([termId, value]) => {
      const geneNames = Array.from(value.genes)
        .map(geneId => {
          const geneNode = nodes[geneId];
          return geneNode?.name || geneId;
        })
        .filter(name => name !== termId)
        .slice(0, 10); // Limit to 10 genes per group

      summary.push(`\n**${value.name}** (${termId})`);
      if (value.score > 0) {
        summary.push(`- P-value: ${value.score.toExponential(3)}`);
      }
      summary.push(`- Genes in group: ${value.genes.size}`);
      if (geneNames.length > 0) {
        summary.push(`- Examples: ${geneNames.join(', ')}${value.genes.size > geneNames.length ? ` ... and ${value.genes.size - geneNames.length} more` : ''}`);
      }
    });

    if (termMap.size > 10) {
      summary.push(`\n... and ${termMap.size - 10} more enriched groups`);
    }
  } else {
    summary.push(`### No Enrichment Results Found`);
    summary.push(`No statistically significant enrichment was found for the provided gene list.`);
  }

  return summary.join('\n');
}

// =============================================================================
// TOOL HANDLERS
// =============================================================================

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "queryGeneEnrichment",
        description: "Perform gene enrichment analysis on a list of genes and add the enriched pathways/terms to the Graph Mode graph. " +
          "Returns enriched pathways, GO terms, and other functional annotations with statistical significance. " +
          "The enriched terms and their connections to genes are automatically added to the graph.",
        inputSchema: {
          type: "object",
          properties: {
            gene_ids: {
              type: "array",
              items: { type: "string" },
              maxItems: 2500,
              description: "Optional array of gene identifiers (e.g., 'NCBIGene:695', 'ENSEMBL:ENSG00000012048', 'HGNC:1133'). If not provided, automatically extracts all gene nodes from the graph."
            },
            pvalue_threshold: {
              type: "number",
              minimum: 0,
              maximum: 1,
              default: 0.05,
              description: "P-value threshold for statistical significance (default: 0.05)"
            },
            include_workflow: {
              type: "boolean",
              default: true,
              description: "Whether to include workflow information in the TRAPI request"
            },
            submitter: {
              type: "string",
              description: "Optional identifier for the submitter of the query"
            },
            bypass_cache: {
              type: "boolean",
              default: false,
              description: "Whether to bypass cached results and get fresh data"
            },
            add_to_graph: {
              type: "boolean",
              default: true,
              description: "Whether to add enriched pathways/terms and their connections to the graph. If false, only returns a summary."
            },
            databaseContext: {
              type: "object",
              properties: {
                conversationId: { type: "string" },
                artifactId: { type: "string" },
                apiBaseUrl: { type: "string" },
                accessToken: { type: "string" }
              },
              required: ["conversationId"],
              description: "Graph Mode database context (auto-injected by backend)"
            }
          },
          required: ["databaseContext"]
        }
      }
    ]
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    if (name === "queryGeneEnrichment") {
      const queryParams = GeneEnrichmentQuerySchema.parse(args);
      const { databaseContext, gene_ids, pvalue_threshold, include_workflow, submitter, bypass_cache, add_to_graph } = queryParams;

      // Determine which genes to use - default to extracting from graph
      let genesToUse: string[] = [];
      
      if (gene_ids && gene_ids.length > 0) {
        // Use provided gene IDs (override)
        genesToUse = gene_ids;
        console.error(`[${SERVICE_NAME}] Using provided gene_ids: ${genesToUse.length} genes`);
      } else {
        // Default: Extract genes from the graph database
        console.error(`[${SERVICE_NAME}] Extracting gene nodes from graph database...`);
        try {
          const graphState = await makeAPIRequest('/state', databaseContext, { method: 'GET' });
          
          if (!graphState || !graphState.success) {
            return {
              content: [{
                type: "text",
                text: `Failed to get graph state: ${graphState?.error || 'Unknown error'}`
              }],
            };
          }
          
          const nodes = graphState.data?.nodes || [];
          
          // Filter for gene nodes and extract their IDs
          genesToUse = nodes
            .filter((node: any) => {
              const nodeType = node.type?.toLowerCase() || '';
              let dataCategories: any = {};
              
              // Parse node data (can be string or object)
              if (node.data) {
                try {
                  dataCategories = typeof node.data === 'string' ? JSON.parse(node.data) : node.data;
                } catch (e) {
                  // If parsing fails, try to use as-is
                  dataCategories = node.data;
                }
              }
              
              const categories = dataCategories.categories || [];
              
              return nodeType === 'gene' || 
                     nodeType === 'biolink:gene' ||
                     nodeType === 'gene' ||
                     categories.some((cat: string) => 
                       cat.toLowerCase().includes('gene') || 
                       cat === 'biolink:Gene'
                     );
            })
            .map((node: any) => node.id)
            .filter((id: string) => id && id.trim() !== '');
          
          console.error(`[${SERVICE_NAME}] Found ${genesToUse.length} gene nodes in graph`);
          
          if (genesToUse.length === 0) {
            return {
              content: [{
                type: "text",
                text: "No gene nodes found in the graph. Please add genes to the graph first, or provide gene_ids parameter to specify genes manually."
              }],
            };
          }
        } catch (error) {
          console.error(`[${SERVICE_NAME}] Error extracting genes from graph:`, error);
          return {
            content: [{
              type: "text",
              text: `Failed to extract genes from graph: ${error instanceof Error ? error.message : String(error)}`
            }],
          };
        }
      }

      if (genesToUse.length === 0) {
        return {
          content: [{
            type: "text",
            text: "No genes provided for enrichment analysis."
          }],
        };
      }

      if (genesToUse.length > 2500) {
        return {
          content: [{
            type: "text",
            text: `Too many genes (${genesToUse.length}). Maximum 2500 genes per request. Please filter your gene list.`
          }],
        };
      }

      console.error(`[${SERVICE_NAME}] Performing gene enrichment analysis for ${genesToUse.length} genes`);
      console.error(`[${SERVICE_NAME}] Conversation ID: ${databaseContext.conversationId}`);

      // Build TRAPI query for gene enrichment
      // According to GeLiNEA SmartAPI spec, use knowledge_graph with nodes keyed by CURIE IDs
      const trapiQuery: any = {
        message: {
          knowledge_graph: {
            nodes: {},
            edges: {}
          }
        },
        workflow: include_workflow ? [
          {
            id: "enrich_results",
            parameters: {
              pvalue_threshold: pvalue_threshold
            }
          }
        ] : undefined,
        submitter: submitter,
        bypass_cache: bypass_cache
      };

      // Add gene nodes to knowledge_graph, each keyed by its CURIE ID
      // According to the SmartAPI spec example, nodes should be keyed by their actual CURIE IDs
      genesToUse.forEach((geneId) => {
        trapiQuery.message.knowledge_graph.nodes[geneId] = {
          categories: ["biolink:Gene"],
          attributes: []
        };
      });

      // Make TRAPI request
      const trapiResponse: TRAPIResponse = await makeTRAPIRequest("/query", "POST", trapiQuery);

      // Process response and add nodes/edges to graph (if enabled)
      let stats = { nodeCount: 0, edgeCount: 0, resultCount: 0 };
      if (add_to_graph) {
        stats = await processTrapiResponse(trapiResponse, databaseContext);
      }

      // Extract enriched groups from knowledge_graph nodes and edges
      const enrichedGroups = extractEnrichedGroups(trapiResponse);

      // Format summary
      const summary = formatEnrichmentSummaryFromGroups(enrichedGroups, stats, genesToUse, add_to_graph);

      return {
        content: [
          {
            type: "text",
            text: summary
          }
        ],
        refreshGraph: add_to_graph
      };
    }

    throw new Error(`Unknown tool: ${name}`);

  } catch (error) {
    console.error(`[${SERVICE_NAME}] Tool execution error:`, error);
    
    if (error instanceof z.ZodError) {
      return {
        content: [
          {
            type: "text",
            text: `Invalid input parameters: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`
          }
        ]
      };
    }
    
    return {
      content: [
        {
          type: "text",
          text: `Error: ${error instanceof Error ? error.message : String(error)}`
        }
      ]
    };
  }
});

// =============================================================================
// SERVER STARTUP
// =============================================================================

async function main() {
  console.error(`[${SERVICE_NAME}] Starting MCP server initialization`);
  const transport = new StdioServerTransport();
  console.error(`[${SERVICE_NAME}] Created StdioServerTransport`);
  
  try {
    console.error(`[${SERVICE_NAME}] Connecting server to transport`);
    await server.connect(transport);
    console.error(`[${SERVICE_NAME}] Server connected successfully`);
  } catch (error) {
    console.error(`[${SERVICE_NAME}] Fatal error during server initialization`, {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    throw error;
  }
}

main().catch((error) => {
  const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
  console.error(`[${SERVICE_NAME}] Fatal error in main(): ${errorMessage}`);
  process.exit(1);
});

