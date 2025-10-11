#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

// =============================================================================
// CONFIGURATION SECTION
// =============================================================================
const TOOL_NAME = "graphmode-pubtator-mcp";
const SERVICE_NAME = "graphmode-pubtator";

// PubTator API Configuration
const PUBTATOR_BASE_URL = process.env.PUBTATOR_BASE_URL || "https://www.ncbi.nlm.nih.gov/research/pubtator3-api";
const PUBTATOR_API_KEY = process.env.PUBTATOR_API_KEY;
const PUBTATOR_USER_EMAIL = process.env.PUBTATOR_USER_EMAIL;

// Rate limiting and timeout settings
const RATE_LIMIT_MS = parseInt(process.env.PUBTATOR_RATE_LIMIT_MS || "2000");
const TIMEOUT_MS = parseInt(process.env.PUBTATOR_TIMEOUT_MS || "60000");
const MAX_RETRIES = parseInt(process.env.PUBTATOR_MAX_RETRIES || "3");
const MAX_BATCH_SIZE = parseInt(process.env.PUBTATOR_MAX_BATCH_SIZE || "100");

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================
interface DatabaseContext {
  conversationId: string;
  artifactId?: string;
  apiBaseUrl?: string;
  accessToken?: string;
}

interface EntityType {
  type: string;
  group: number;
}

interface PubTatorEntity {
  id: string;
  name: string;
  type: string;
  mentions?: Array<{
    start: number;
    end: number;
    text: string;
  }>;
}

interface PubTatorRelation {
  id: string;
  type: string;
  e1: string;
  e2: string;
  pmid?: string;
}

interface NodeData {
  id: string;
  label: string;
  type: string;
  data: {
    pubtatorId?: string;
    source?: string;
    [key: string]: any;
  };
  position: {
    x: number;
    y: number;
  };
}

interface EdgeData {
  source: string;
  target: string;
  label: string;
  data: {
    type: string;
    source?: string;
    [key: string]: any;
  };
}

// =============================================================================
// SCHEMA DEFINITIONS
// =============================================================================
// Schema for database context (passed by backend)
const DatabaseContextSchema = z.object({
  conversationId: z.string().min(1, "conversationId is required"),
  artifactId: z.string().optional().describe("Artifact ID for Graph Mode (one artifact per conversation)"),
  apiBaseUrl: z.string().url().optional(),
  accessToken: z.string().optional(),
});

// Schema for addNodesFromPMIDs tool
const AddNodesFromPMIDsArgumentsSchema = z.object({
  pmids: z.array(z.string()).min(1, "At least one PMID is required").max(MAX_BATCH_SIZE, `Maximum ${MAX_BATCH_SIZE} PMIDs per request`),
  concepts: z.array(z.enum(["gene", "disease", "chemical", "species", "mutation", "cellline", "snp", "protein"]))
    .optional()
    .default(["gene", "disease", "chemical"]),
  databaseContext: DatabaseContextSchema,
});

// Schema for addNodesFromText tool
const AddNodesFromTextArgumentsSchema = z.object({
  text: z.string().min(1, "Text is required").max(100000, "Text too long (max 100,000 characters)"),
  concepts: z.array(z.enum(["gene", "disease", "chemical", "species", "mutation", "cellline", "snp", "protein"]))
    .optional()
    .default(["gene", "disease", "chemical"]),
  databaseContext: DatabaseContextSchema,
});

// Schema for addNodesFromEntityNetwork tool
const AddNodesFromEntityNetworkArgumentsSchema = z.object({
  query: z.string().min(1, "Search query is required"),
  concept: z.enum(["gene", "disease", "chemical", "species", "cellline", "variant"]),
  max_entities: z.number().min(1).max(20).optional().default(5),
  max_relations_per_entity: z.number().min(10).max(500).optional().default(100),
  relationship_types: z.array(z.enum(["associate", "inhibit", "negative_correlate", "positive_correlate", "interact", "stimulate"])).optional(),
  databaseContext: DatabaseContextSchema,
});

// Schema for findRelatedEntities tool
const FindRelatedEntitiesArgumentsSchema = z.object({
  sourceEntity: z.string().min(1, "Source entity name is required"),
  sourceType: z.enum(["gene", "disease", "chemical", "species", "cellline", "variant"]),
  targetType: z.enum(["gene", "disease", "chemical", "species", "cellline", "variant"]),
  relationshipTypes: z.array(z.enum(["associate", "inhibit", "negative_correlate", "positive_correlate", "interact", "stimulate"])).optional(),
  maxResults: z.number().min(1).max(100).optional().default(20),
  databaseContext: DatabaseContextSchema,
});

// Schema for findAllRelatedEntities tool
const FindAllRelatedEntitiesArgumentsSchema = z.object({
  sourceEntity: z.string().min(1, "Source entity name is required"),
  sourceType: z.enum(["gene", "disease", "chemical", "species", "cellline", "variant"]),
  relationshipTypes: z.array(z.enum(["associate", "inhibit", "negative_correlate", "positive_correlate", "interact", "stimulate"])).optional(),
  maxResults: z.number().min(1).max(100).optional().default(30),
  databaseContext: DatabaseContextSchema,
});

// =============================================================================
// PUBTATOR API FUNCTIONS
// =============================================================================
// Make PubTator API request
async function makePubTatorRequest(
  endpoint: string, 
  method: 'GET' | 'POST' = 'GET', 
  body?: any, 
  params?: Record<string, any>
): Promise<any> {
  const url = new URL(`${PUBTATOR_BASE_URL}${endpoint}`);
  
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

  // Add API key if available (optional - PubTator API works without authentication)
  if (PUBTATOR_API_KEY) {
    headers['X-API-Key'] = PUBTATOR_API_KEY;
  }

  // Add user email if available (optional - PubTator API works without authentication)
  if (PUBTATOR_USER_EMAIL) {
    headers['X-User-Email'] = PUBTATOR_USER_EMAIL;
  }

  // Only add Content-Type for POST requests
  if (method === 'POST') {
    headers['Content-Type'] = 'application/json';
  }

  console.error(`[${SERVICE_NAME}] Making PubTator request to: ${url.toString()}`);

  try {
    const requestOptions: RequestInit = {
      method,
      headers,
    };

    if (method === 'POST' && body) {
      requestOptions.body = JSON.stringify(body);
    }

    const response = await fetch(url.toString(), requestOptions);
    console.error(`[${SERVICE_NAME}] Response status: ${response.status} ${response.statusText}`);

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

// Make API request to Graph Mode backend
async function makeGraphModeAPIRequest(
  endpoint: string, 
  databaseContext: DatabaseContext, 
  method: 'GET' | 'POST' | 'DELETE' = 'GET', 
  body?: any
): Promise<any> {
  const apiBaseUrl = databaseContext.apiBaseUrl || "http://localhost:3001";
  const url = `${apiBaseUrl}${endpoint}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (databaseContext.accessToken) {
    headers['Authorization'] = `Bearer ${databaseContext.accessToken}`;
  }

  console.error(`[${SERVICE_NAME}] Making Graph Mode API request to: ${url}`);

  try {
    const requestOptions: RequestInit = {
      method,
      headers,
    };

    if (body && (method === 'POST' || method === 'DELETE')) {
      requestOptions.body = JSON.stringify(body);
    }

    const response = await fetch(url, requestOptions);
    console.error(`[${SERVICE_NAME}] Graph Mode API response status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Graph Mode API request failed: ${response.status} ${response.statusText} - ${errorText}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`[${SERVICE_NAME}] Graph Mode API request error:`, error);
    throw error;
  }
}

// Entity autocomplete helper function
async function getEntityAutocomplete(query: string, concept: string): Promise<PubTatorEntity[]> {
  const endpoint = `/entity/autocomplete/?query=${encodeURIComponent(query)}&concept=${concept}`;
  const response = await makePubTatorRequest(endpoint);
  
  if (!Array.isArray(response)) {
    return [];
  }
  
  // Map PubTator response format to our interface
  // PubTator returns _id, but our interface expects id
  return response.map((entity: any) => ({
    id: entity._id,  // Map _id to id
    name: entity.name,
    type: entity.type,
    mentions: entity.mentions
  }));
}

// Get entity relationships helper function
async function getEntityRelations(
  entityId: string, 
  maxResults: number = 100, 
  relationshipTypes?: string[]
): Promise<PubTatorRelation[]> {
  const endpoint = `/relations?e1=${encodeURIComponent(entityId)}`;
  const response = await makePubTatorRequest(endpoint);
  
  if (!Array.isArray(response)) {
    return [];
  }

  // Map PubTator response format to our interface
  // PubTator returns source/target, but our interface expects e1/e2
  let relations = response.map((rel: any) => ({
    id: rel.id || `${rel.source}_${rel.target}_${rel.type}`,
    type: rel.type,
    e1: rel.source,  // Map source to e1
    e2: rel.target,  // Map target to e2
    pmid: rel.pmid
  }));

  console.error(`🔥 [PUBTATOR-DEBUG] Raw PubTator API response for ${entityId}:`, JSON.stringify(response, null, 2));
  console.error(`🔥 [PUBTATOR-DEBUG] Mapped relations:`, JSON.stringify(relations, null, 2));

  // Filter by relationship types if specified
  if (relationshipTypes && relationshipTypes.length > 0) {
    relations = relations.filter((rel: PubTatorRelation) => relationshipTypes.includes(rel.type));
  }

  // Limit results
  return relations.slice(0, maxResults);
}

// =============================================================================
// NODE CREATION FUNCTIONS
// =============================================================================
// Create node in Graph Mode database
async function createNodeInDatabase(nodeData: Omit<NodeData, 'id'>, databaseContext: DatabaseContext): Promise<any> {
  console.error(`🔥 [DEBUG] createNodeInDatabase called with:`, JSON.stringify(nodeData, null, 2));
  console.error(`🔥 [DEBUG] Entity type: ${nodeData.type}`);
  
  const endpoint = `/api/graph/${databaseContext.conversationId}/nodes`;
  
  // Use PubTator ID as the canonical ID (like mock data does)
  const nodeWithId: NodeData = {
    id: nodeData.data?.pubtatorId || `pubtator_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    ...nodeData
  };

  console.error(`[${SERVICE_NAME}] 🔍 Creating node with ID: ${nodeWithId.id}`);
  console.error(`[${SERVICE_NAME}] 🔍 Node structure:`, JSON.stringify(nodeWithId, null, 2));
  console.error(`[${SERVICE_NAME}] 🔍 Database context:`, JSON.stringify(databaseContext, null, 2));
  
  const result = await makeGraphModeAPIRequest(endpoint, databaseContext, 'POST', nodeWithId);
  console.error(`[${SERVICE_NAME}] ✅ Node created successfully:`, result);
  return result;
}

// Create edge in Graph Mode database
async function createEdgeInDatabase(edgeData: EdgeData, databaseContext: DatabaseContext): Promise<any> {
  const endpoint = `/api/graph/${databaseContext.conversationId}/edges`;
  
  console.error(`[${SERVICE_NAME}] 🔍 Creating edge: ${edgeData.source} → ${edgeData.target}`);
  console.error(`[${SERVICE_NAME}] 🔍 Edge structure:`, JSON.stringify(edgeData, null, 2));
  
  const result = await makeGraphModeAPIRequest(endpoint, databaseContext, 'POST', edgeData);
  console.error(`[${SERVICE_NAME}] ✅ Edge created successfully:`, result);
  return result;
}

// Entity type classification based on entity type
function getEntityType(entityType: string): EntityType {
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

// Helper function to extract entity type from entity ID
function getEntityTypeFromId(entityId: string): EntityType {
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

// =============================================================================
// MCP SERVER SETUP
// =============================================================================
// Create the MCP server
const server = new Server({
  name: TOOL_NAME,
  version: "1.0.0",
}, {
  capabilities: {
    tools: {},
  },
});

// Define tools
const tools = [
  {
    name: "addNodesFromPMIDs",
    description: "Extract biomedical entities from PubMed articles by PMIDs and add them as nodes to the Graph Mode knowledge graph. Creates nodes for genes, diseases, chemicals, and other entities found in the literature.",
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
          description: "Types of biomedical concepts to extract (default: gene, disease, chemical)"
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
      required: ["pmids", "databaseContext"]
    }
  },
  {
    name: "addNodesFromText",
    description: "Extract biomedical entities from free text and add them as nodes to the Graph Mode knowledge graph. Uses PubTator's text annotation service to identify genes, diseases, chemicals, and other entities.",
    inputSchema: {
      type: "object",
      properties: {
        text: {
          type: "string",
          minLength: 1,
          maxLength: 100000,
          description: "Text to analyze for biomedical entities (max 100,000 characters)"
        },
        concepts: {
          type: "array",
          items: {
            type: "string",
            enum: ["gene", "disease", "chemical", "species", "mutation", "cellline", "snp", "protein"]
          },
          description: "Types of biomedical concepts to extract (default: gene, disease, chemical)"
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
      required: ["text", "databaseContext"]
    }
  },
  {
    name: "addNodesFromEntityNetwork",
    description: "Build a network of related biomedical entities by searching for entities and their relationships. Creates nodes and edges showing how entities are connected in the literature.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          minLength: 1,
          description: "Search query to find entities (e.g., 'BRCA1', 'cancer', 'insulin')"
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
          description: "Maximum number of entities to find (default: 5)"
        },
        max_relations_per_entity: {
          type: "number",
          minimum: 10,
          maximum: 500,
          default: 100,
          description: "Maximum number of relationships per entity (default: 100)"
        },
        relationship_types: {
          type: "array",
          items: {
            type: "string",
            enum: ["associate", "inhibit", "negative_correlate", "positive_correlate", "interact", "stimulate"]
          },
          description: "Optional: Filter by specific relationship types. If not specified, all relationship types are included."
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
      required: ["query", "concept", "databaseContext"]
    }
  },
  {
    name: "findRelatedEntities",
    description: "Find all entities of a specific type that are related to a given entity (e.g., find all genes related to FAM177A1). Uses PubTator's relationship database to discover connections and adds them to the Graph Mode knowledge graph.",
    inputSchema: {
      type: "object",
      properties: {
        sourceEntity: {
          type: "string",
          minLength: 1,
          description: "Name of the source entity to find relationships from (e.g., 'FAM177A1', 'BRCA1', 'cancer')"
        },
        sourceType: {
          type: "string",
          enum: ["gene", "disease", "chemical", "species", "cellline", "variant"],
          description: "Type of the source entity"
        },
        targetType: {
          type: "string",
          enum: ["gene", "disease", "chemical", "species", "cellline", "variant"],
          description: "Type of entities to find relationships to (e.g., 'gene' to find all genes related to the source)"
        },
        relationshipTypes: {
          type: "array",
          items: {
            type: "string",
            enum: ["associate", "inhibit", "negative_correlate", "positive_correlate", "interact", "stimulate"]
          },
          description: "Optional: Filter by specific relationship types. If not specified, all relationship types are included."
        },
        maxResults: {
          type: "number",
          minimum: 1,
          maximum: 100,
          default: 20,
          description: "Maximum number of related entities to find and add to the graph (default: 20)"
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
      required: ["sourceEntity", "sourceType", "targetType", "databaseContext"]
    }
  },
  {
    name: "findAllRelatedEntities",
    description: "Find ALL entities related to a given entity across all types (genes, diseases, chemicals, etc.). Creates a comprehensive network showing all relationships regardless of entity type. Perfect for exploring the full relationship network of an entity.",
    inputSchema: {
      type: "object",
      properties: {
        sourceEntity: {
          type: "string",
          minLength: 1,
          description: "Name of the source entity to find relationships from (e.g., 'FAM177A1', 'BRCA1', 'cancer')"
        },
        sourceType: {
          type: "string",
          enum: ["gene", "disease", "chemical", "species", "cellline", "variant"],
          description: "Type of the source entity"
        },
        relationshipTypes: {
          type: "array",
          items: {
            type: "string",
            enum: ["associate", "inhibit", "negative_correlate", "positive_correlate", "interact", "stimulate"]
          },
          description: "Optional: Filter by specific relationship types. If not specified, all relationship types are included."
        },
        maxResults: {
          type: "number",
          minimum: 1,
          maximum: 100,
          default: 30,
          description: "Maximum number of related entities to find and add to the graph (default: 30)"
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
      required: ["sourceEntity", "sourceType", "databaseContext"]
    }
  }
];

// =============================================================================
// TOOL HANDLERS
// =============================================================================
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  
  try {
    if (name === "addNodesFromPMIDs") {
      const queryParams = AddNodesFromPMIDsArgumentsSchema.parse(args);
      const { pmids, concepts, databaseContext } = queryParams;

      console.error(`[${SERVICE_NAME}] Processing ${pmids.length} PMIDs for concepts: ${concepts.join(', ')}`);

      const createdNodes: NodeData[] = [];
      const createdEdges: EdgeData[] = [];
      const processedEntities = new Set<string>();

      for (const pmid of pmids) {
        try {
          // Get annotations for this PMID
          const endpoint = `/annotations/PMID:${pmid}`;
          const annotations = await makePubTatorRequest(endpoint);

          if (!annotations || !annotations.annotations) {
            console.error(`[${SERVICE_NAME}] No annotations found for PMID: ${pmid}`);
            continue;
          }

          // Process entities
          for (const entity of annotations.annotations) {
            if (!concepts.includes(entity.type)) continue;
            if (processedEntities.has(entity.id)) continue;

            const entityType = getEntityType(entity.type);
            const nodeData: Omit<NodeData, 'id'> = {
              label: entity.name,
              type: entityType.type,
              data: {
                pubtatorId: entity.id,
                source: 'pubtator',
                pmid: pmid,
                entityType: entity.type,
                mentions: entity.mentions || []
              },
              position: {
                x: Math.random() * 800 + 100,
                y: Math.random() * 600 + 100
              }
            };

            const createdNode = await createNodeInDatabase(nodeData, databaseContext);
            createdNodes.push(createdNode);
            processedEntities.add(entity.id);
          }

          // Process relations
          if (annotations.relations) {
            for (const relation of annotations.relations) {
              if (processedEntities.has(relation.e1) && processedEntities.has(relation.e2)) {
                const edgeData: EdgeData = {
                  source: relation.e1,
                  target: relation.e2,
                  label: mapRelationshipType(relation.type),
                  data: {
                    type: relation.type,
                    source: 'pubtator',
                    pmid: pmid
                  }
                };
                // Actually create the edge in the database
                const createdEdge = await createEdgeInDatabase(edgeData, databaseContext);
                createdEdges.push(createdEdge);
              }
            }
          }

          // Rate limiting
          await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_MS));

        } catch (error) {
          console.error(`[${SERVICE_NAME}] Error processing PMID ${pmid}:`, error);
        }
      }

      console.error(`[${SERVICE_NAME}] 📊 Operation complete: ${createdNodes.length} nodes, ${createdEdges.length} edges`);
      console.error(`[${SERVICE_NAME}] 📊 Node IDs created:`, createdNodes.map(n => n.data?.id || n.id || 'NO_ID'));
      console.error(`[${SERVICE_NAME}] 📊 First node structure:`, JSON.stringify(createdNodes[0], null, 2));
      
      return {
        content: [{
          type: "text",
          text: `Successfully added ${createdNodes.length} nodes and ${createdEdges.length} edges from ${pmids.length} PubMed articles to the Graph Mode knowledge graph.`
        }],
        refreshGraph: true
      };
    }

    if (name === "addNodesFromText") {
      const queryParams = AddNodesFromTextArgumentsSchema.parse(args);
      const { text, concepts, databaseContext } = queryParams;

      console.error(`[${SERVICE_NAME}] Processing text of length ${text.length} for concepts: ${concepts.join(', ')}`);

      // Annotate text with PubTator
      const endpoint = '/annotations/';
      const body = {
        text: text,
        concepts: concepts
      };

      const annotations = await makePubTatorRequest(endpoint, 'POST', body);

      if (!annotations || !annotations.annotations) {
        return {
          content: [{
            type: "text",
            text: "No biomedical entities found in the provided text."
          }]
        };
      }

      const createdNodes: NodeData[] = [];
      const processedEntities = new Set<string>();

      // Process entities
      for (const entity of annotations.annotations) {
        if (!concepts.includes(entity.type)) continue;
        if (processedEntities.has(entity.id)) continue;

        const entityType = getEntityType(entity.type);
        const nodeData: Omit<NodeData, 'id'> = {
          label: entity.name,
          type: entityType.type,
          data: {
            pubtatorId: entity.id,
            source: 'pubtator',
            entityType: entity.type,
            mentions: entity.mentions || []
          },
          position: {
            x: Math.random() * 800 + 100,
            y: Math.random() * 600 + 100
          }
        };

        const createdNode = await createNodeInDatabase(nodeData, databaseContext);
        createdNodes.push(createdNode);
        processedEntities.add(entity.id);
      }

      console.error(`[${SERVICE_NAME}] 📊 Operation complete: ${createdNodes.length} nodes, 0 edges`);
      console.error(`[${SERVICE_NAME}] 📊 Node IDs created:`, createdNodes.map(n => n.data?.id || n.id || 'NO_ID'));
      console.error(`[${SERVICE_NAME}] 📊 First node structure:`, JSON.stringify(createdNodes[0], null, 2));
      
      return {
        content: [{
          type: "text",
          text: `Successfully added ${createdNodes.length} biomedical entities from the text to the Graph Mode knowledge graph.`
        }],
        refreshGraph: true
      };
    }

    if (name === "addNodesFromEntityNetwork") {
      const queryParams = AddNodesFromEntityNetworkArgumentsSchema.parse(args);
      const { query, concept, max_entities, max_relations_per_entity, relationship_types, databaseContext } = queryParams;

      console.error(`[${SERVICE_NAME}] Building entity network for query: ${query}, concept: ${concept}`);

      // Find entities using autocomplete
      const entities = await getEntityAutocomplete(query, concept);
      const limitedEntities = entities.slice(0, max_entities);

      if (limitedEntities.length === 0) {
        return {
          content: [{
            type: "text",
            text: `No entities found for query "${query}" and concept "${concept}".`
          }]
        };
      }

      const createdNodes: NodeData[] = [];
      const createdEdges: EdgeData[] = [];
      const processedEntities = new Set<string>();

      // Create nodes for found entities
      for (const entity of limitedEntities) {
        const entityType = getEntityType(concept);
        const nodeData: Omit<NodeData, 'id'> = {
          label: entity.name,
          type: entityType.type,
          data: {
            pubtatorId: entity.id,
            source: 'pubtator',
            entityType: concept,
            mentions: entity.mentions || []
          },
          position: {
            x: Math.random() * 800 + 100,
            y: Math.random() * 600 + 100
          }
        };

        const createdNode = await createNodeInDatabase(nodeData, databaseContext);
        createdNodes.push(createdNode);
        processedEntities.add(entity.id);
      }

      // Get relationships for each entity
      for (const entity of limitedEntities) {
        try {
          const relations = await getEntityRelations(entity.id, max_relations_per_entity, relationship_types);
          
      for (const relation of relations) {
        // Skip relations with missing target entity
        if (!relation.e2) {
          console.error(`[${SERVICE_NAME}] Skipping relation with missing target entity:`, relation);
          continue;
        }
        
        // Create target entity if it doesn't exist
        if (!processedEntities.has(relation.e2)) {
          const targetEntityType = getEntityTypeFromId(relation.e2);
              const targetNodeData: Omit<NodeData, 'id'> = {
                label: extractEntityName(relation.e2),
                type: targetEntityType.type,
                data: {
                  pubtatorId: relation.e2,
                  source: 'pubtator',
                  entityType: relation.e2.split('_')[0].replace('@', '').toLowerCase()
                },
                position: {
                  x: Math.random() * 800 + 100,
                  y: Math.random() * 600 + 100
                }
              };

              const createdTargetNode = await createNodeInDatabase(targetNodeData, databaseContext);
              createdNodes.push(createdTargetNode);
              processedEntities.add(relation.e2);
            }

            // Create edge
            const edgeData: EdgeData = {
              source: relation.e1,
              target: relation.e2,
              label: mapRelationshipType(relation.type),
              data: {
                type: relation.type,
                source: 'pubtator'
              }
            };
            
        console.error(`🔥 [PUBTATOR-DEBUG] About to create edge: ${relation.e1} -> ${relation.e2} (${relation.type})`);
        console.error(`🔥 [PUBTATOR-DEBUG] Edge data:`, JSON.stringify(edgeData, null, 2));
        
        // Actually create the edge in the database
        const createdEdge = await createEdgeInDatabase(edgeData, databaseContext);
        console.error(`🔥 [PUBTATOR-DEBUG] Edge created successfully:`, JSON.stringify(createdEdge, null, 2));
        createdEdges.push(createdEdge);
          }

          // Rate limiting
          await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_MS));

        } catch (error) {
          console.error(`[${SERVICE_NAME}] Error getting relations for entity ${entity.id}:`, error);
        }
      }

      console.error(`[${SERVICE_NAME}] 📊 Operation complete: ${createdNodes.length} nodes, ${createdEdges.length} edges`);
      console.error(`[${SERVICE_NAME}] 📊 Node IDs created:`, createdNodes.map(n => n.data?.id || n.id || 'NO_ID'));
      console.error(`[${SERVICE_NAME}] 📊 First node structure:`, JSON.stringify(createdNodes[0], null, 2));
      
      return {
        content: [{
          type: "text",
          text: `Successfully built entity network with ${createdNodes.length} nodes and ${createdEdges.length} edges for query "${query}".`
        }],
        refreshGraph: true
      };
    }

    if (name === "findRelatedEntities") {
      const queryParams = FindRelatedEntitiesArgumentsSchema.parse(args);
      const { sourceEntity, sourceType, targetType, relationshipTypes, maxResults, databaseContext } = queryParams;

      console.error(`[${SERVICE_NAME}] Finding ${targetType} entities related to ${sourceEntity} (${sourceType})`);

      // Find the source entity using autocomplete
      const sourceEntities = await getEntityAutocomplete(sourceEntity, sourceType);
      if (sourceEntities.length === 0) {
        return {
          content: [{
            type: "text",
            text: `No ${sourceType} entity found with name "${sourceEntity}".`
          }]
        };
      }

      const sourceEntityData = sourceEntities[0];
      const createdNodes: NodeData[] = [];
      const createdEdges: EdgeData[] = [];
      const processedEntities = new Set<string>();

      // Create source entity node if it doesn't exist
      const sourceEntityType = getEntityType(sourceType);
      const sourceNodeData: Omit<NodeData, 'id'> = {
        label: sourceEntityData.name,
        type: sourceEntityType.type,
        data: {
          pubtatorId: sourceEntityData.id,
          source: 'pubtator',
          entityType: sourceType,
          mentions: sourceEntityData.mentions || []
        },
        position: {
          x: Math.random() * 800 + 100,
          y: Math.random() * 600 + 100
        }
      };

      const createdSourceNode = await createNodeInDatabase(sourceNodeData, databaseContext);
      createdNodes.push(createdSourceNode);
      processedEntities.add(sourceEntityData.id);

      // Get relationships for the source entity
      const relations = await getEntityRelations(sourceEntityData.id, maxResults * 2, relationshipTypes);
      
      // Filter relations to only include target type entities
      const filteredRelations = relations.filter(rel => {
        const targetEntityType = getEntityTypeFromId(rel.e2);
        return targetEntityType.type.toLowerCase() === targetType.toLowerCase();
      }).slice(0, maxResults);

      for (const relation of filteredRelations) {
        // Create target entity if it doesn't exist
        if (!processedEntities.has(relation.e2)) {
          const targetEntityType = getEntityType(targetType);
          const targetNodeData: Omit<NodeData, 'id'> = {
            label: extractEntityName(relation.e2),
            type: targetEntityType.type,
            data: {
              pubtatorId: relation.e2,
              source: 'pubtator',
              entityType: targetType
            },
            position: {
              x: Math.random() * 800 + 100,
              y: Math.random() * 600 + 100
            }
          };

          const createdTargetNode = await createNodeInDatabase(targetNodeData, databaseContext);
          createdNodes.push(createdTargetNode);
          processedEntities.add(relation.e2);
        } else {
          console.error(`🔥 [DEBUG] SKIPPED - entity already processed: ${relation.e2}`);
        }

        // Create edge
        const edgeData: EdgeData = {
          source: relation.e1,
          target: relation.e2,
          label: mapRelationshipType(relation.type),
          data: {
            type: relation.type,
            source: 'pubtator'
          }
        };
        
        console.error(`🔥 [PUBTATOR-DEBUG] About to create edge: ${relation.e1} -> ${relation.e2} (${relation.type})`);
        console.error(`🔥 [PUBTATOR-DEBUG] Edge data:`, JSON.stringify(edgeData, null, 2));
        
        // Actually create the edge in the database
        const createdEdge = await createEdgeInDatabase(edgeData, databaseContext);
        console.error(`🔥 [PUBTATOR-DEBUG] Edge created successfully:`, JSON.stringify(createdEdge, null, 2));
        createdEdges.push(createdEdge);
      }

      console.error(`[${SERVICE_NAME}] 📊 Operation complete: ${createdNodes.length} nodes, ${createdEdges.length} edges`);
      console.error(`[${SERVICE_NAME}] 📊 Node IDs created:`, createdNodes.map(n => n.data?.id || n.id || 'NO_ID'));
      console.error(`[${SERVICE_NAME}] 📊 First node structure:`, JSON.stringify(createdNodes[0], null, 2));
      
      return {
        content: [{
          type: "text",
          text: `Found ${createdNodes.length - 1} ${targetType} entities related to ${sourceEntity}. Added ${createdNodes.length} nodes and ${createdEdges.length} edges to the graph.`
        }],
        refreshGraph: true
      };
    }

    if (name === "findAllRelatedEntities") {
      const queryParams = FindAllRelatedEntitiesArgumentsSchema.parse(args);
      const { sourceEntity, sourceType, relationshipTypes, maxResults, databaseContext } = queryParams;

      console.error(`[${SERVICE_NAME}] Finding ALL entities related to ${sourceEntity} (${sourceType})`);

      // Find the source entity using autocomplete
      const sourceEntities = await getEntityAutocomplete(sourceEntity, sourceType);
      if (sourceEntities.length === 0) {
        return {
          content: [{
            type: "text",
            text: `No ${sourceType} entity found with name "${sourceEntity}".`
          }]
        };
      }

      const sourceEntityData = sourceEntities[0];
      const createdNodes: NodeData[] = [];
      const createdEdges: EdgeData[] = [];
      const processedEntities = new Set<string>();

      // Create source entity node if it doesn't exist
      const sourceEntityType = getEntityType(sourceType);
      const sourceNodeData: Omit<NodeData, 'id'> = {
        label: sourceEntityData.name,
        type: sourceEntityType.type,
        data: {
          pubtatorId: sourceEntityData.id,
          source: 'pubtator',
          entityType: sourceType,
          mentions: sourceEntityData.mentions || []
        },
        position: {
          x: Math.random() * 800 + 100,
          y: Math.random() * 600 + 100
        }
      };

      const createdSourceNode = await createNodeInDatabase(sourceNodeData, databaseContext);
      createdNodes.push(createdSourceNode);
      processedEntities.add(sourceEntityData.id);

      // Get ALL relationships for the source entity (no target type filtering)
      const relations = await getEntityRelations(sourceEntityData.id, maxResults, relationshipTypes);
      console.error(`🔥 [PUBTATOR-DEBUG] Found ${relations.length} relations from PubTator API`);

      for (const relation of relations) {
        console.error(`🔥 [PUBTATOR-DEBUG] Processing relation: ${relation.e1} -> ${relation.e2} (${relation.type})`);
        
        // Skip relations with missing target entity
        if (!relation.e2) {
          console.error(`[${SERVICE_NAME}] Skipping relation with missing target entity:`, relation);
          continue;
        }
        
        // Create source entity if it doesn't exist
        console.error(`🔥 [DEBUG] Checking if ${relation.e1} is in processedEntities`);
        console.error(`🔥 [DEBUG] processedEntities contains:`, Array.from(processedEntities));
        
        if (!processedEntities.has(relation.e1)) {
          console.error(`🔥 [PUBTATOR-DEBUG] Creating node for source entity: ${relation.e1}`);
          const sourceEntityType = getEntityTypeFromId(relation.e1);
          console.error(`🔥 [PUBTATOR-DEBUG] Source entity type determined:`, sourceEntityType);
          const sourceNodeData: Omit<NodeData, 'id'> = {
            label: extractEntityName(relation.e1),
            type: sourceEntityType.type,
            data: {
              pubtatorId: relation.e1,
              source: 'pubtator',
              entityType: relation.e1.split('_')[0].replace('@', '').toLowerCase()
            },
            position: {
              x: Math.random() * 800 + 100,
              y: Math.random() * 600 + 100
            }
          };

          const createdSourceNode = await createNodeInDatabase(sourceNodeData, databaseContext);
          createdNodes.push(createdSourceNode);
          processedEntities.add(relation.e1);
        } else {
          console.error(`🔥 [DEBUG] SKIPPED - source entity already processed: ${relation.e1}`);
        }

        // Create target entity if it doesn't exist
        console.error(`🔥 [DEBUG] Checking if ${relation.e2} is in processedEntities`);
        
        if (!processedEntities.has(relation.e2)) {
          console.error(`🔥 [PUBTATOR-DEBUG] Creating node for target entity: ${relation.e2}`);
          const targetEntityType = getEntityTypeFromId(relation.e2);
          console.error(`🔥 [PUBTATOR-DEBUG] Target entity type determined:`, targetEntityType);
          const targetNodeData: Omit<NodeData, 'id'> = {
            label: extractEntityName(relation.e2),
            type: targetEntityType.type,
            data: {
              pubtatorId: relation.e2,
              source: 'pubtator',
              entityType: relation.e2.split('_')[0].replace('@', '').toLowerCase()
            },
            position: {
              x: Math.random() * 800 + 100,
              y: Math.random() * 600 + 100
            }
          };

          const createdTargetNode = await createNodeInDatabase(targetNodeData, databaseContext);
          createdNodes.push(createdTargetNode);
          processedEntities.add(relation.e2);
        } else {
          console.error(`🔥 [DEBUG] SKIPPED - target entity already processed: ${relation.e2}`);
        }

        // Create edge
        const edgeData: EdgeData = {
          source: relation.e1,
          target: relation.e2,
          label: mapRelationshipType(relation.type),
          data: {
            type: relation.type,
            source: 'pubtator'
          }
        };
        
        console.error(`🔥 [PUBTATOR-DEBUG] About to create edge: ${relation.e1} -> ${relation.e2} (${relation.type})`);
        console.error(`🔥 [PUBTATOR-DEBUG] Edge data:`, JSON.stringify(edgeData, null, 2));
        
        // Actually create the edge in the database
        const createdEdge = await createEdgeInDatabase(edgeData, databaseContext);
        console.error(`🔥 [PUBTATOR-DEBUG] Edge created successfully:`, JSON.stringify(createdEdge, null, 2));
        createdEdges.push(createdEdge);
      }

      console.error(`[${SERVICE_NAME}] 📊 Operation complete: ${createdNodes.length} nodes, ${createdEdges.length} edges`);
      console.error(`[${SERVICE_NAME}] 📊 Node IDs created:`, createdNodes.map(n => n.data?.id || n.id || 'NO_ID'));
      console.error(`[${SERVICE_NAME}] 📊 First node structure:`, JSON.stringify(createdNodes[0], null, 2));
      
      return {
        content: [{
          type: "text",
          text: `Found comprehensive relationship network for ${sourceEntity}. Added ${createdNodes.length} nodes and ${createdEdges.length} edges across all entity types to the graph.`
        }],
        refreshGraph: true
      };
    }

    throw new Error(`Unknown tool: ${name}`);
  } catch (error) {
    console.error(`[${SERVICE_NAME}] Tool execution failed:`, error);
    
    return {
      content: [{
        type: "text",
        text: `Error: ${error instanceof Error ? error.message : String(error)}`
      }]
    };
  }
});

// =============================================================================
// SERVER STARTUP
// =============================================================================
async function main() {
  console.error(`[${SERVICE_NAME}] Starting Graph Mode PubTator MCP Server...`);
  console.error(`[${SERVICE_NAME}] PubTator API Base URL: ${PUBTATOR_BASE_URL}`);
  console.error(`[${SERVICE_NAME}] PubTator API Key configured: ${PUBTATOR_API_KEY ? 'Yes' : 'No (not required)'}`);
  console.error(`[${SERVICE_NAME}] PubTator User Email: ${PUBTATOR_USER_EMAIL ? PUBTATOR_USER_EMAIL : 'Not set (not required)'}`);

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`[${SERVICE_NAME}] Graph Mode PubTator MCP Server running on stdio`);
}

main().catch(console.error);
