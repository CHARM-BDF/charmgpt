#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

// Load environment variables
import dotenv from "dotenv";
dotenv.config();

// PubTator MCP Configuration
const API_BASE_URL = process.env.PUBTATOR_BASE_URL || "https://www.ncbi.nlm.nih.gov/research/pubtator3-api";
const API_KEY = process.env.PUBTATOR_API_KEY;
const USER_EMAIL = process.env.PUBTATOR_USER_EMAIL;
const TOOL_NAME = "pubtator-mcp";
const SERVICE_NAME = "pubtator";

// Rate limiting and timeout settings
const RATE_LIMIT_MS = parseInt(process.env.PUBTATOR_RATE_LIMIT_MS || "2000");
const TIMEOUT_MS = parseInt(process.env.PUBTATOR_TIMEOUT_MS || "60000");
const MAX_RETRIES = parseInt(process.env.PUBTATOR_MAX_RETRIES || "3");
const MAX_BATCH_SIZE = parseInt(process.env.PUBTATOR_MAX_BATCH_SIZE || "100");
const ASYNC_POLL_INTERVAL_MS = parseInt(process.env.PUBTATOR_ASYNC_POLL_INTERVAL_MS || "5000");
const ASYNC_MAX_WAIT_MS = parseInt(process.env.PUBTATOR_ASYNC_MAX_WAIT_MS || "300000");

// PubTator Schemas
const PubTatorPMIDSchema = z.object({
  pmids: z.array(z.string()).min(1, "At least one PMID is required").max(MAX_BATCH_SIZE, `Maximum ${MAX_BATCH_SIZE} PMIDs per request`),
  concepts: z.array(z.enum(["gene", "disease", "chemical", "species", "mutation", "cellline", "snp", "protein"]))
    .optional()
    .default(["gene", "disease", "chemical"]),
  format: z.enum(["biocjson", "pubtator", "pubannotation"]).optional().default("biocjson"),
});

const PubTatorEntityNetworkSchema = z.object({
  query: z.string().min(1, "Search query is required"),
  concept: z.enum(["gene", "disease", "chemical", "species", "cellline", "variant"]),
  max_entities: z.number().min(1).max(20).optional().default(5),
  max_relations_per_entity: z.number().min(10).max(500).optional().default(100),
  relationship_types: z.array(z.enum(["associate", "inhibit", "negative_correlate", "positive_correlate", "interact", "stimulate"])).optional(),
});

const PubTatorSearchSchema = z.object({
  text: z.string().min(1, "Search text is required"),
  search_type: z.enum(["general", "relations"]).optional().default("general"),
  max_results: z.number().min(1).max(1000).optional().default(100),
  page: z.number().min(1).optional().default(1),
  include_facets: z.boolean().optional().default(true),
});



// Make PubTator API request
async function makePubTatorRequest(endpoint: string, method: 'GET' | 'POST' = 'GET', body?: any, params?: Record<string, any>): Promise<any> {
  const url = new URL(`${API_BASE_URL}${endpoint}`);
  
  // Add query parameters for GET requests
  if (method === 'GET' && params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        if (Array.isArray(value)) {
          url.searchParams.set(key, value.join(','));
        } else {
          url.searchParams.set(key, String(value));
        }
      }
    });
  }
  
  const headers: Record<string, string> = {
    'Accept': 'application/json',
    'User-Agent': `${SERVICE_NAME}-mcp/1.0.0`,
  };

  // Add API key if available
  if (API_KEY) {
    headers['X-API-Key'] = API_KEY;
  }

  // Add user email if available
  if (USER_EMAIL) {
    headers['X-User-Email'] = USER_EMAIL;
  }

  // Only add Content-Type for POST requests
  if (method === 'POST') {
    headers['Content-Type'] = 'application/json';
  }

  console.log(`[${SERVICE_NAME}] Making PubTator request to: ${url.toString()}`);
  console.log(`[${SERVICE_NAME}] Base URL: ${API_BASE_URL}`);
  console.log(`[${SERVICE_NAME}] Endpoint: ${endpoint}`);
  console.log(`[${SERVICE_NAME}] Method: ${method}`);
  console.log(`[${SERVICE_NAME}] Params:`, params);

  try {
    const requestOptions: RequestInit = {
      method,
      headers,
    };

    if (method === 'POST' && body) {
      requestOptions.body = JSON.stringify(body);
    }

    const response = await fetch(url.toString(), requestOptions);
    
    console.log(`[${SERVICE_NAME}] Response status: ${response.status} ${response.statusText}`);
    console.log(`[${SERVICE_NAME}] Response headers:`, Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`PubTator resource not found: ${endpoint}`);
      }
      if (response.status === 400) {
        const errorText = await response.text();
        throw new Error(`Invalid PubTator request: ${errorText}`);
      }
      if (response.status === 413) {
        throw new Error(`Text too long. Maximum 100,000 characters allowed.`);
      }
      if (response.status === 429) {
        throw new Error(`Rate limit exceeded. Please wait before retrying.`);
      }
      if (response.status === 500) {
        throw new Error(`Internal server error in PubTator service.`);
      }
      throw new Error(`PubTator request failed: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`[${SERVICE_NAME}] PubTator request error:`, error);
    throw error;
  }
}


// Format PubTator response for Claude consumption
function formatPubTatorResponseForModel(response: any, queryType: string, queryParams: any): string {
  let output = [
    `**PubTator ${queryType} Results**`,
    `**Query:** ${JSON.stringify(queryParams)}`,
    `**Format:** ${queryParams.format || 'biocjson'}`,
    ""
  ];

  if (response.PubTator3 && Array.isArray(response.PubTator3)) {
    const documents = response.PubTator3;
    output.push(`## Found ${documents.length} Document(s)`);
    
    documents.forEach((doc: any, index: number) => {
      output.push(`### Document ${index + 1}`);
      output.push(`**PMID:** ${doc.pmid || 'Unknown'}`);
      output.push(`**Title:** ${doc.passages?.[0]?.text || 'No title'}`);
      output.push(`**Journal:** ${doc.journal || 'Unknown'}`);
      output.push(`**Date:** ${doc.date || 'Unknown'}`);
      
      // Get abstract from passages
      const abstract = doc.passages?.find((p: any) => p.infons?.type === 'abstract');
      if (abstract) {
        output.push(`**Abstract:** ${abstract.text.substring(0, 200)}...`);
      }
      
      // Collect all annotations from all passages
      const allAnnotations = doc.passages?.flatMap((p: any) => p.annotations || []) || [];
      
      if (allAnnotations.length > 0) {
        output.push(`**Annotations:** ${allAnnotations.length} entities found`);
        
        // Group annotations by type
        const annotationsByType = allAnnotations.reduce((acc: any, ann: any) => {
          const type = ann.infons?.type || 'unknown';
          if (!acc[type]) acc[type] = [];
          acc[type].push(ann);
          return acc;
        }, {});
        
        Object.entries(annotationsByType).forEach(([type, annotations]: [string, any]) => {
          output.push(`#### ${type.toUpperCase()} (${annotations.length})`);
          annotations.slice(0, 5).forEach((ann: any) => {
            const name = ann.infons?.name || ann.text;
            const identifier = ann.infons?.identifier || 'No ID';
            output.push(`- **${ann.text}** (${name}, ID: ${identifier})`);
          });
          if (annotations.length > 5) {
            output.push(`  ... and ${annotations.length - 5} more`);
          }
        });
      } else {
        output.push(`**Annotations:** No entities found`);
      }
      
      output.push("");
    });
  } else if (response.annotations && response.annotations.length > 0) {
    output.push(`## Found ${response.annotations.length} Annotation(s)`);
    
    // Group annotations by type
    const annotationsByType = response.annotations.reduce((acc: any, ann: any) => {
      const type = ann.infons?.type || 'unknown';
      if (!acc[type]) acc[type] = [];
      acc[type].push(ann);
      return acc;
    }, {});
    
    Object.entries(annotationsByType).forEach(([type, annotations]: [string, any]) => {
      output.push(`### ${type.toUpperCase()} (${annotations.length})`);
      annotations.slice(0, 10).forEach((ann: any) => {
        output.push(`- **${ann.text}** (${ann.infons?.identifier || 'No ID'})`);
      });
      if (annotations.length > 10) {
        output.push(`  ... and ${annotations.length - 10} more`);
      }
      output.push("");
    });
  } else {
    output.push("No annotations found in the response.");
  }

  return output.join("\n");
}

// Types for knowledge graph data structures (matching medik-mcp2 format)
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

// Entity type classification based on entity type
function getEntityType(entityType: string): { type: string; group: number } {
  switch (entityType.toLowerCase()) {
    case 'gene':
      return { type: 'Gene', group: 2 };
    case 'disease':
      return { type: 'Disease', group: 3 };
    case 'chemical':
      return { type: 'Drug', group: 1 };
    case 'species':
      return { type: 'Species', group: 4 };
    case 'mutation':
      return { type: 'Mutation', group: 5 };
    case 'cellline':
      return { type: 'Cell Line', group: 6 };
    case 'snp':
      return { type: 'SNP', group: 7 };
    case 'protein':
      return { type: 'Protein', group: 8 };
    default:
      return { type: 'Other', group: 9 };
  }
}

// Create knowledge graph from PubTator annotations
function createKnowledgeGraphFromAnnotations(response: any, queryParams: any): KnowledgeGraph {
  const nodes = new Map<string, GraphNode>();
  const links: GraphLink[] = [];
  let filteredCount = 0;
  let filteredNodeCount = 0;
  
  // Process PubTator3 documents and their annotations
  if (response.PubTator3 && Array.isArray(response.PubTator3)) {
    for (const doc of response.PubTator3) {
      // Collect all annotations from all passages
      const allAnnotations = doc.passages?.flatMap((p: any) => p.annotations || []) || [];
      
      if (allAnnotations.length > 0) {
        for (const annotation of allAnnotations) {
          const entityType = annotation.infons?.type || 'unknown';
          const entityId = annotation.infons?.identifier || annotation.text;
          const entityName = annotation.text;
          
          // Create node if it doesn't exist
          if (!nodes.has(entityId)) {
            const entityInfo = getEntityType(entityType);
            nodes.set(entityId, {
              id: entityId,
              name: entityName,
              entityType: entityInfo.type,
              group: entityInfo.group,
              isStartingNode: false,
              val: 10,
              connections: 0
            });
          }
          
          // Increment connection count
          nodes.get(entityId)!.connections++;
        }
      }
    }
  }
  
  // Create co-occurrence links between entities in the same document
  if (response.PubTator3 && Array.isArray(response.PubTator3)) {
    for (const doc of response.PubTator3) {
      // Collect all annotations from all passages
      const allAnnotations = doc.passages?.flatMap((p: any) => p.annotations || []) || [];
      
      if (allAnnotations.length > 1) {
        // Create links between all pairs of entities in the same document
        for (let i = 0; i < allAnnotations.length; i++) {
          for (let j = i + 1; j < allAnnotations.length; j++) {
            const ann1 = allAnnotations[i];
            const ann2 = allAnnotations[j];
            const id1 = ann1.infons?.identifier || ann1.text;
            const id2 = ann2.infons?.identifier || ann2.text;
            
            if (id1 !== id2) {
              // Check if link already exists (bidirectional)
              const existingLink = links.find(link => 
                (link.source === id1 && link.target === id2) ||
                (link.source === id2 && link.target === id1)
              );
              
              if (!existingLink) {
                links.push({
                  source: id1,
                  target: id2,
                  label: 'co-occurs with',
                  value: 1,
                  evidence: [doc.pmid || 'unknown']
                });
              } else {
                // Increment value for existing co-occurrence
                existingLink.value++;
                if (!existingLink.evidence.includes(doc.pmid || 'unknown')) {
                  existingLink.evidence.push(doc.pmid || 'unknown');
                }
              }
            }
          }
        }
      }
    }
  }
  
  // Adjust node sizes based on connection count (5-20 range)
  const nodeArray = Array.from(nodes.values());
  nodeArray.forEach(node => {
    node.val = Math.min(20, Math.max(5, 5 + node.connections));
  });
  
  return {
    nodes: nodeArray,
    links,
    filteredCount,
    filteredNodeCount
  };
}

// Format PubTator data for artifacts
function formatPubTatorArtifactData(response: any, queryParams: any, queryType: string): any {
  // Create knowledge graph if we have annotation data
  if (response.PubTator3 && Array.isArray(response.PubTator3)) {
    const graph = createKnowledgeGraphFromAnnotations(response, queryParams);
    return graph;
  }
  
  // Fallback to original format for non-annotation responses
  return {
    query_type: queryType,
    query_params: queryParams,
    response: {
      documents_count: response.PubTator3?.length || 0,
      annotations_count: response.PubTator3?.reduce((sum: number, doc: any) => {
        const allAnnotations = doc.passages?.flatMap((p: any) => p.annotations || []) || [];
        return sum + allAnnotations.length;
      }, 0) || 0,
      total_entities: response.PubTator3?.reduce((sum: number, doc: any) => {
        const allAnnotations = doc.passages?.flatMap((p: any) => p.annotations || []) || [];
        return sum + allAnnotations.length;
      }, 0) || 0,
    },
    data: response,
    metadata: {
      timestamp: new Date().toISOString(),
      service: "PubTator API",
      endpoint: API_BASE_URL,
      version: "1.0.0",
    }
  };
}

// Entity autocomplete helper function
async function getEntityAutocomplete(query: string, concept: string): Promise<any[]> {
  const endpoint = `/entity/autocomplete/?query=${encodeURIComponent(query)}&concept=${concept}`;
  const response = await makePubTatorRequest(endpoint);
  return Array.isArray(response) ? response : [];
}

// Get entity relationships helper function
async function getEntityRelations(entityId: string, maxResults: number = 100, relationshipTypes?: string[]): Promise<any[]> {
  const endpoint = `/relations?e1=${encodeURIComponent(entityId)}`;
  const response = await makePubTatorRequest(endpoint);
  
  if (!Array.isArray(response)) {
    return [];
  }
  
  let relations = response;
  
  // Filter by relationship types if specified
  if (relationshipTypes && relationshipTypes.length > 0) {
    relations = relations.filter((rel: any) => relationshipTypes.includes(rel.type));
  }
  
  // Limit results
  return relations.slice(0, maxResults);
}

// Search PubTator papers helper function
async function searchPubTatorPapers(searchText: string, searchType: 'general' | 'relations' = 'general', maxResults: number = 100, page: number = 1, includeFacets: boolean = true): Promise<any> {
  let queryText = searchText;
  
  // For relations search, wrap the text with relations:ANY
  if (searchType === 'relations') {
    // Replace AND with | for relations search format
    queryText = searchText.replace(/\s+AND\s+/g, '|');
    queryText = `relations:ANY|${queryText}`;
  }
  
  const endpoint = `/search/?text=${encodeURIComponent(queryText)}`;
  const params: Record<string, any> = {
    page_size: maxResults,
    current: page
  };
  
  if (!includeFacets) {
    params.facets = false;
  }
  
  const response = await makePubTatorRequest(endpoint, 'GET', undefined, params);
  return response;
}

// Helper function to extract PMIDs from search results
function extractPMIDsFromResults(results: any[]): string[] {
  return results.map(paper => paper.pmid?.toString() || '').filter(pmid => pmid !== '');
}

// Create knowledge graph from entity relationships
function createKnowledgeGraphFromEntityRelations(entities: any[], allRelations: any[]): KnowledgeGraph {
  const nodes = new Map<string, GraphNode>();
  const links: GraphLink[] = [];
  
  // Create nodes for all entities
  entities.forEach(entity => {
    const entityInfo = getEntityType(entity.biotype || 'unknown');
    nodes.set(entity._id, {
      id: entity._id,
      name: entity.name,
      entityType: entityInfo.type,
      group: entityInfo.group,
      isStartingNode: true, // These are the starting entities
      val: 15,
      connections: 0
    });
  });
  
  // Process all relationships
  allRelations.forEach(relation => {
    // Create nodes for source and target if they don't exist
    const sourceId = relation.source;
    const targetId = relation.target;
    
    if (!nodes.has(sourceId)) {
      const sourceType = getEntityTypeFromId(sourceId);
      nodes.set(sourceId, {
        id: sourceId,
        name: extractEntityName(sourceId),
        entityType: sourceType.type,
        group: sourceType.group,
        isStartingNode: false,
        val: 10,
        connections: 0
      });
    }
    
    if (!nodes.has(targetId)) {
      const targetType = getEntityTypeFromId(targetId);
      nodes.set(targetId, {
        id: targetId,
        name: extractEntityName(targetId),
        entityType: targetType.type,
        group: targetType.group,
        isStartingNode: false,
        val: 10,
        connections: 0
      });
    }
    
    // Create link with bucket-based width scaling
    // This prevents extremely thick edges from dominating the visualization
    // while still showing meaningful differences in publication counts
    const pubs = relation.publications || 1;
    let width = 1;
    if (pubs >= 1000) width = 20;      // Very well-studied relationships
    else if (pubs >= 500) width = 15;  // Highly studied relationships  
    else if (pubs >= 100) width = 10;  // Well-studied relationships
    else if (pubs >= 50) width = 8;    // Moderately studied relationships
    else if (pubs >= 10) width = 5;    // Somewhat studied relationships
    else if (pubs >= 5) width = 3;     // Limited studies
    else width = 2;                    // Single or few studies
    
    links.push({
      source: sourceId,
      target: targetId,
      label: mapRelationshipType(relation.type),
      value: width,
      evidence: [] // Could be populated with PMIDs if available
    });
    
    // Update connection counts
    nodes.get(sourceId)!.connections++;
    nodes.get(targetId)!.connections++;
  });
  
  // Adjust node sizes based on connection count
  const nodeArray = Array.from(nodes.values());
  nodeArray.forEach(node => {
    node.val = Math.min(20, Math.max(5, 5 + node.connections));
  });
  
  return {
    nodes: nodeArray,
    links,
    filteredCount: 0,
    filteredNodeCount: 0
  };
}

// Helper function to extract entity type from entity ID
function getEntityTypeFromId(entityId: string): { type: string; group: number } {
  if (entityId.startsWith('@GENE_')) return { type: 'Gene', group: 2 };
  if (entityId.startsWith('@DISEASE_')) return { type: 'Disease', group: 3 };
  if (entityId.startsWith('@CHEMICAL_')) return { type: 'Drug', group: 1 };
  if (entityId.startsWith('@SPECIES_')) return { type: 'Species', group: 4 };
  if (entityId.startsWith('@CELLLINE_')) return { type: 'Cell Line', group: 6 };
  if (entityId.startsWith('@VARIANT_')) return { type: 'Variant', group: 7 };
  return { type: 'Other', group: 9 };
}

// Helper function to extract entity name from entity ID
function extractEntityName(entityId: string): string {
  return entityId.replace(/^@[A-Z]+_/, '').replace(/_/g, ' ');
}

// Helper function to map relationship types to human-readable labels
function mapRelationshipType(relationType: string): string {
  const mapping: Record<string, string> = {
    'associate': 'associated with',
    'inhibit': 'inhibits',
    'negative_correlate': 'negatively correlates with',
    'positive_correlate': 'positively correlates with',
    'interact': 'interacts with',
    'stimulate': 'stimulates'
  };
  return mapping[relationType] || relationType;
}

// Create the MCP server
const server = new Server(
  {
    name: TOOL_NAME,
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Define tools
const tools: Tool[] = [
  {
    name: "annotate-pmids",
    description: "Annotate PubMed articles by PMIDs to extract biomedical entities (genes, diseases, chemicals, etc.) using PubTator API.",
        inputSchema: {
          type: "object",
          properties: {
        pmids: {
          type: "array",
          items: { type: "string" },
          minItems: 1,
          maxItems: MAX_BATCH_SIZE,
          description: `Array of PubMed IDs (PMIDs) to annotate (max ${MAX_BATCH_SIZE})`
        },
        concepts: {
          type: "array",
          items: { 
              type: "string",
            enum: ["gene", "disease", "chemical", "species", "mutation", "cellline", "snp", "protein"]
          },
          default: ["gene", "disease", "chemical"],
          description: "Types of entities to extract (default: gene, disease, chemical)"
        },
        format: {
              type: "string",
          enum: ["biocjson", "pubtator", "pubannotation"],
          default: "biocjson",
          description: "Output format (default: biocjson)"
        }
      },
      required: ["pmids"]
    }
  },
  {
    name: "build-entity-network",
    description: "Build a comprehensive knowledge graph by discovering entities through autocomplete and aggregating all their relationships across PubMed. Creates a unified network from multiple entities and their semantic relationships.",
        inputSchema: {
          type: "object",
          properties: {
        query: {
          type: "string",
          description: "Search query to find entities (e.g., 'BRCA1', 'cancer', 'olaparib')"
        },
        concept: {
              type: "string",
          enum: ["gene", "disease", "chemical", "species", "cellline", "variant"],
          description: "Type of entity to search for"
        },
        max_entities: {
          type: "number",
          minimum: 1,
          maximum: 20,
          default: 5,
          description: "Maximum number of entities to include in the network (default: 5)"
        },
        max_relations_per_entity: {
          type: "number",
          minimum: 10,
          maximum: 500,
          default: 100,
          description: "Maximum number of relationships to fetch per entity (default: 100)"
        },
        relationship_types: {
          type: "array",
          items: {
            type: "string",
            enum: ["associate", "inhibit", "negative_correlate", "positive_correlate", "interact", "stimulate"]
          },
          description: "Optional: Filter by specific relationship types"
        }
      },
      required: ["query", "concept"]
    }
  },
  {
    name: "search-pubtator-papers",
    description: "Search PubTator for papers that mention specific biomedical entities using entity IDs. Returns actual PMIDs, titles, abstracts, and detailed paper information. Use this to find the specific papers that support relationships discovered by other tools.",
    inputSchema: {
      type: "object",
      properties: {
        text: {
          type: "string",
          description: "Search text using entity IDs (e.g., '@CHEMICAL_olaparib AND @GENE_BRCA1', '@DISEASE_COVID_19 AND @GENE_PON1')"
        },
        search_type: {
          type: "string",
          enum: ["general", "relations"],
          default: "general",
          description: "Search type: 'general' finds papers mentioning both entities (broader), 'relations' finds papers with semantic relationships between entities (more specific)"
        },
        max_results: {
          type: "number",
          minimum: 1,
          maximum: 1000,
          default: 100,
          description: "Maximum number of results to return (default: 100)"
        },
        page: {
          type: "number",
          minimum: 1,
          default: 1,
          description: "Page number for pagination (default: 1)"
        },
        include_facets: {
          type: "boolean",
          default: true,
          description: "Whether to include facet information (journals, years, etc.)"
        }
      },
      required: ["text"]
    }
  },
];

// Helper function to process PubTator search results into snippet format
function processSnippetData(results: any[]): any[] {
  return results.map(result => {
    // Clean up the text_hl field to remove PubTator markup
    let cleanSnippet = result.text_hl || '';
    
    // Keep the original @@@ markers for UI processing
    cleanSnippet = cleanSnippet
      .replace(/\s+/g, ' ')                 // Normalize whitespace
      .trim();
    
    // Extract year from date
    let year = 'n.d.';
    if (result.date) {
      const dateMatch = result.date.match(/(\d{4})/);
      if (dateMatch) {
        year = dateMatch[1];
      }
    }
    
    return {
      snippet: cleanSnippet,
      authors: result.authors || [],
      title: result.title || 'Untitled',
      journal: result.journal || 'Unknown Journal',
      year: year,
      pmid: result.pmid?.toString() || '',
      citation: result.citations?.NLM
    };
  });
}

// List tools handler
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools };
});

// Tool execution handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    if (name === "annotate-pmids") {
      const queryParams = PubTatorPMIDSchema.parse(args);
      
      console.log(`[${SERVICE_NAME}] Annotating PMIDs: ${queryParams.pmids.join(', ')}`);
      
      const params: Record<string, any> = {
        pmids: queryParams.pmids.join(','),
        // Note: PubTator3 API doesn't support concepts parameter - it returns all entity types
        // format parameter is also not supported - always returns BioC JSON
      };

      const response = await makePubTatorRequest("/publications/export/biocjson", "GET", undefined, params);
      
      const formattedResponse = formatPubTatorResponseForModel(response, "PMID Annotation", queryParams);
      const artifactData = formatPubTatorArtifactData(response, queryParams, "pmid_annotation");

        return {
          content: [
            {
              type: "text",
            text: formattedResponse
          }
        ],
        artifacts: [
          {
            type: "application/vnd.knowledge-graph",
            title: "PubTator Knowledge Graph - PMID Annotations",
            content: JSON.stringify(artifactData)
          }
        ]
      };
    }

    if (name === "build-entity-network") {
      const queryParams = PubTatorEntityNetworkSchema.parse(args);
      
      console.log(`[${SERVICE_NAME}] Building entity network for query: "${queryParams.query}" (${queryParams.concept})`);
      
      // Step 1: Get entities through autocomplete
      const entities = await getEntityAutocomplete(queryParams.query, queryParams.concept);
      
      if (entities.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: `No entities found for query "${queryParams.query}" with concept type "${queryParams.concept}". Please try a different search term or concept type.`
            }
          ]
        };
      }
      
      // Limit to max_entities
      const selectedEntities = entities.slice(0, queryParams.max_entities);
      
      console.log(`[${SERVICE_NAME}] Found ${entities.length} entities, using top ${selectedEntities.length}`);
      
      // Step 2: Get relationships for each entity
      const allRelations: any[] = [];
      const entityDetails: any[] = [];
      
      for (const entity of selectedEntities) {
        console.log(`[${SERVICE_NAME}] Getting relationships for entity: ${entity._id} (${entity.name})`);
        
        const relations = await getEntityRelations(
          entity._id, 
          queryParams.max_relations_per_entity,
          queryParams.relationship_types
        );
        
        allRelations.push(...relations);
        entityDetails.push({
          ...entity,
          relationCount: relations.length
        });
        
        // Add a small delay to be respectful to the API
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      console.log(`[${SERVICE_NAME}] Collected ${allRelations.length} total relationships`);
      
      // Step 3: Create unified knowledge graph
      const knowledgeGraph = createKnowledgeGraphFromEntityRelations(entityDetails, allRelations);
      
      // Step 4: Format response
      const responseText = [
        `# Entity Network: ${queryParams.query} (${queryParams.concept})`,
        ``,
        `## Discovery Summary`,
        `- **Query:** "${queryParams.query}"`,
        `- **Concept Type:** ${queryParams.concept}`,
        `- **Entities Found:** ${entities.length}`,
        `- **Entities Selected:** ${selectedEntities.length}`,
        `- **Total Relationships:** ${allRelations.length}`,
        `- **Network Nodes:** ${knowledgeGraph.nodes.length}`,
        `- **Network Links:** ${knowledgeGraph.links.length}`,
        ``,
        `## Selected Entities`,
        ...selectedEntities.map((entity, index) => [
          `### ${index + 1}. ${entity.name}`,
          `- **ID:** ${entity._id}`,
          `- **Type:** ${entity.biotype}`,
          `- **Database:** ${entity.db}`,
          `- **Description:** ${entity.description}`,
          `- **Relationships Found:** ${entityDetails[index]?.relationCount || 0}`,
          ``
        ]).flat(),
        `## Relationship Types Found`,
        ...Object.entries(
          allRelations.reduce((acc: any, rel: any) => {
            acc[rel.type] = (acc[rel.type] || 0) + 1;
            return acc;
          }, {})
        ).map(([type, count]) => `- **${mapRelationshipType(type)}:** ${count} relationships`),
        ``,
        `## Network Statistics`,
        `- **Starting Entities:** ${knowledgeGraph.nodes.filter(n => n.isStartingNode).length}`,
        `- **Connected Entities:** ${knowledgeGraph.nodes.filter(n => !n.isStartingNode).length}`,
        `- **Most Connected Entity:** ${knowledgeGraph.nodes.reduce((max, node) => node.connections > max.connections ? node : max, knowledgeGraph.nodes[0])?.name || 'N/A'}`,
        ``,
        `*This network shows semantic relationships discovered across PubMed literature using PubTator's entity-centric relationship data.*`
      ].join('\n');

      return {
        content: [
          {
            type: "text",
            text: responseText
          }
        ],
        artifacts: [
          {
            type: "application/vnd.knowledge-graph",
            title: `Entity Network - ${queryParams.query} (${queryParams.concept})`,
            content: JSON.stringify(knowledgeGraph)
          }
        ]
      };
    }

    if (name === "search-pubtator-papers") {
      const searchParams = PubTatorSearchSchema.parse(args);
      
      console.log(`[${SERVICE_NAME}] Searching PubTator papers: ${searchParams.text} (${searchParams.search_type})`);
      
      const searchResults = await searchPubTatorPapers(
        searchParams.text,
        searchParams.search_type,
        searchParams.max_results,
        searchParams.page,
        searchParams.include_facets
      );
      
      if (!searchResults.results || searchResults.results.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: `No papers found for search: "${searchParams.text}" (${searchParams.search_type} search)`
            }
          ]
        };
      }
      
      // Format papers for display
      const papers = searchResults.results.map((paper: any) => {
        const authors = paper.authors ? paper.authors.slice(0, 3).join(', ') + (paper.authors.length > 3 ? ' et al.' : '') : 'Unknown authors';
        const journal = paper.journal || 'Unknown journal';
        const date = paper.meta_date_publication || paper.date || 'Unknown date';
        const doi = paper.doi ? `DOI: ${paper.doi}` : '';
        
        return `**${paper.title}**
- **PMID**: ${paper.pmid}
- **Authors**: ${authors}
- **Journal**: ${journal}
- **Date**: ${date}
- **Score**: ${paper.score?.toFixed(2) || 'N/A'}
${doi ? `- ${doi}` : ''}
---`;
      }).join('\n');
      
      // Format facets if available
      let facetsText = '';
      if (searchResults.facets && searchParams.include_facets) {
        const topJournals = searchResults.facets.facet_fields?.journal?.slice(0, 5) || [];
        const topYears = searchResults.facets.facet_fields?.year?.slice(0, 5) || [];
        
        if (topJournals.length > 0 || topYears.length > 0) {
          facetsText = '\n## Search Facets\n';
          
          if (topJournals.length > 0) {
            facetsText += '**Top Journals:**\n';
            facetsText += topJournals.map((j: any) => `- ${j.name}: ${j.value} papers`).join('\n') + '\n';
          }
          
          if (topYears.length > 0) {
            facetsText += '**Top Years:**\n';
            facetsText += topYears.map((y: any) => `- ${y.name}: ${y.value} papers`).join('\n') + '\n';
          }
        }
      }
      
      const searchTypeDescription = searchParams.search_type === 'relations' 
        ? 'papers with semantic relationships between the specified entities'
        : 'papers mentioning the specified entities';
      
      // Extract PMIDs for the follow-up question
      const pmids = extractPMIDsFromResults(searchResults.results);
      
      // Log the text content that will be returned to the LLM
      const textContent = `# PubTator Paper Search Results

**Instructions**: This summary is generated from the paper titles, authors, and metadata returned by the PubTator search. The relationships were identified from the semantic analysis of biomedical literature.

**Search Query**: ${searchParams.text}
**Search Type**: ${searchParams.search_type} (${searchTypeDescription})
**Results**: ${searchResults.results.length} of ${searchParams.max_results} requested (Page ${searchParams.page})
**Total Available**: ${searchResults.count || 'Unknown'} papers

## Papers Found
${papers}
${facetsText}
## Search Information
- **Search Type**: ${searchParams.search_type === 'relations' ? 'Relations search (more specific - finds papers with semantic relationships)' : 'General search (broader - finds papers mentioning both entities)'}
- **Entity IDs Used**: ${searchParams.text}
- **Results per page**: ${searchParams.max_results}
- **Current page**: ${searchParams.page}

## Next Steps
1. **Use PMIDs**: Copy the PMIDs to use with the \`annotate-pmids\` tool for detailed annotations
2. **Explore relationships**: Use the \`build-entity-network\` tool to find related entities
3. **Refine search**: Try different entity combinations or use the relations search type for more specific results

---
Include structions for the next LLM to process that they MUST include the following exactly at the end of the summary with a line break above it:

This summary is only generated from the sentence that the relationships was identified in. Would you like me to return a more detailed summary from the full text of the abstract? If so then please make sure the Pubmed MCP tool is turned on and I will summarize the abstracts using these Pubmed IDs: [${pmids.join(', ')}]`;

      console.log(`[${SERVICE_NAME}] Text content returned to LLM:`);
      console.log('='.repeat(80));
      console.log(textContent);
      console.log('='.repeat(80));
      
      // Process results for snippet view
      const snippetData = processSnippetData(searchResults.results);
      
      return {
        content: [
          {
            type: "text",
            text: textContent
          }
        ],
        artifacts: [
          {
            type: "application/json",
            title: `PubTator Search Results - ${searchParams.text}`,
            name: `pubtator_search_${searchParams.text.replace(/[^a-zA-Z0-9]/g, '_')}.json`,
            content: {
              search_params: searchParams,
              results: searchResults.results,
              facets: searchResults.facets,
              pagination: {
                current_page: searchParams.page,
                results_per_page: searchParams.max_results,
                total_results: searchResults.count,
                total_pages: searchResults.total_pages
              }
            }
          },
          {
            type: "application/vnd.snippet-view",
            title: `PubTator Snippet View - ${searchParams.text}`,
            name: `pubtator_snippets_${searchParams.text.replace(/[^a-zA-Z0-9]/g, '_')}.json`,
            content: {
              snippets: snippetData,
              search_info: {
                query: searchParams.text,
                search_type: searchParams.search_type,
                total_results: searchResults.count,
                current_page: searchParams.page
              }
            }
          }
        ]
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
    
    throw new Error(`Failed to execute ${name}: ${error instanceof Error ? error.message : String(error)}`);
  }
});

// Start the server
async function main() {
  console.error(`[${SERVICE_NAME}] Starting PubTator MCP Server...`);
  console.error(`[${SERVICE_NAME}] API Base URL: ${API_BASE_URL}`);
  console.error(`[${SERVICE_NAME}] API Key configured: ${API_KEY ? 'Yes' : 'No'}`);
  console.error(`[${SERVICE_NAME}] User Email: ${USER_EMAIL || 'Not set'}`);

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`[${SERVICE_NAME}] PubTator MCP Server running on stdio`);
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
}); 
