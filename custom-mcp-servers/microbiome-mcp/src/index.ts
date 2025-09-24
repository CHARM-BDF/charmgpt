import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

// =============================================================================
// CONFIGURATION SECTION - Multiomics Microbiome KP
// =============================================================================

// Microbiome KP Configuration
const API_BASE_URL = "https://multiomics.transltr.io/mbkp";
const TOOL_NAME = "microbiome-kp-mcp";
const SERVICE_NAME = "microbiome-kp";

// Environment variables (none required for public TRAPI endpoint)
const USER_EMAIL = process.env.USER_EMAIL || 'anonymous@example.com';

// =============================================================================
// SCHEMA DEFINITIONS - TRAPI Query Schemas
// =============================================================================

// TRAPI Query Schema
const TRAPIQuerySchema = z.object({
  subject_id: z.string().min(1, "Subject ID cannot be empty")
    .regex(/^[A-Za-z0-9]+:[A-Za-z0-9]+$/, "Invalid curie ID format. Expected format: PREFIX:ID"),
  object_id: z.string().optional(),
  predicate: z.string().optional().default("biolink:related_to"),
  subject_categories: z.array(z.string()).optional(),
  object_categories: z.array(z.string()).optional(),
  max_results: z.number().min(1).max(100).optional().default(20),
  log_level: z.enum(['ERROR', 'WARNING', 'INFO', 'DEBUG']).optional().default('INFO'),
});

// Meta Knowledge Graph Schema
const MetaKnowledgeGraphSchema = z.object({
  include_attributes: z.boolean().optional().default(true),
  include_qualifiers: z.boolean().optional().default(true),
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
// API REQUEST HELPER
// =============================================================================

async function makeTRAPIRequest(endpoint: string, method: 'GET' | 'POST' = 'GET', body?: any): Promise<any> {
  const url = new URL(`${API_BASE_URL}${endpoint}`);

  const headers: Record<string, string> = {
    'Accept': 'application/json',
    'User-Agent': `${SERVICE_NAME}-mcp/1.0.0`,
  };

  // Only add Content-Type for POST requests
  if (method === 'POST') {
    headers['Content-Type'] = 'application/json';
  }

  console.log(`[${SERVICE_NAME}] Making TRAPI request to: ${url.toString()}`);

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

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`TRAPI endpoint not found: ${endpoint}`);
      }
      if (response.status === 400) {
        const errorText = await response.text();
        throw new Error(`Invalid TRAPI request: ${errorText}`);
      }
      if (response.status === 413) {
        throw new Error(`Payload too large. Batch size exceeded limit.`);
      }
      if (response.status === 429) {
        throw new Error(`Rate limit exceeded. Please wait before retrying.`);
      }
      if (response.status === 500) {
        throw new Error(`Internal server error in TRAPI service.`);
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
// DATA FORMATTING FUNCTIONS
// =============================================================================

// Format TRAPI response for Claude consumption
function formatTRAPIResponseForModel(response: any): string {
  if (!response || !response.message) {
    return "No TRAPI response data available";
  }

  const message = response.message;
  const results = message.results || [];
  const knowledgeGraph = message.knowledge_graph || { nodes: {}, edges: {} };
  const queryGraph = message.query_graph || { nodes: {}, edges: {} };

  const nodeCount = Object.keys(knowledgeGraph.nodes || {}).length;
  const edgeCount = Object.keys(knowledgeGraph.edges || {}).length;
  const resultCount = results.length;

  let formattedResponse = [
    `# TRAPI Query Results`,
    ``,
    `## Summary`,
    `- **Results Found:** ${resultCount}`,
    `- **Knowledge Graph Nodes:** ${nodeCount}`,
    `- **Knowledge Graph Edges:** ${edgeCount}`,
    `- **Status:** ${response.status || 'Unknown'}`,
    `- **Description:** ${response.description || 'No description available'}`,
    ``
  ];

  if (resultCount > 0) {
    formattedResponse.push(`## Top Results`);
    
    results.slice(0, 5).forEach((result: any, index: number) => {
      const nodeBindings = result.node_bindings || {};
      const analyses = result.analyses || [];
      
      formattedResponse.push(`### Result ${index + 1}`);
      
      // Show node bindings
      Object.entries(nodeBindings).forEach(([queryNodeId, bindings]: [string, any]) => {
        if (Array.isArray(bindings) && bindings.length > 0) {
          const nodeIds = bindings.map((b: any) => b.id).join(', ');
          formattedResponse.push(`- **${queryNodeId}:** ${nodeIds}`);
        }
      });
      
      // Show analysis scores
      if (analyses.length > 0) {
        const scores = analyses.map((a: any) => a.score).filter(Boolean);
        if (scores.length > 0) {
          formattedResponse.push(`- **Score:** ${scores.join(', ')}`);
        }
      }
      
      formattedResponse.push(``);
    });
  }

  // Show sample nodes
  if (nodeCount > 0) {
    formattedResponse.push(`## Sample Knowledge Graph Nodes`);
    const nodeEntries = Object.entries(knowledgeGraph.nodes).slice(0, 3);
    nodeEntries.forEach(([nodeId, node]: [string, any]) => {
      const name = node.name || 'Unknown';
      const categories = Array.isArray(node.categories) ? node.categories.join(', ') : 'Unknown';
      formattedResponse.push(`- **${nodeId}:** ${name} (${categories})`);
    });
    formattedResponse.push(``);
  }

  // Show sample edges
  if (edgeCount > 0) {
    formattedResponse.push(`## Sample Knowledge Graph Edges`);
    const edgeEntries = Object.entries(knowledgeGraph.edges).slice(0, 3);
    edgeEntries.forEach(([edgeId, edge]: [string, any]) => {
      const predicate = edge.predicate || 'Unknown';
      const subject = edge.subject || 'Unknown';
      const object = edge.object || 'Unknown';
      formattedResponse.push(`- **${edgeId}:** ${subject} --[${predicate}]--> ${object}`);
    });
    formattedResponse.push(``);
  }

  return formattedResponse.join("\n");
}

// Format TRAPI response data for artifacts
function formatTRAPIArtifactData(response: any): any {
  if (!response || !response.message) {
    return { error: "No TRAPI response data available" };
  }

  const message = response.message;
  const results = message.results || [];
  const knowledgeGraph = message.knowledge_graph || { nodes: {}, edges: {} };
  const queryGraph = message.query_graph || { nodes: {}, edges: {} };

  return {
    summary: {
      status: response.status,
      description: response.description,
      result_count: results.length,
      node_count: Object.keys(knowledgeGraph.nodes || {}).length,
      edge_count: Object.keys(knowledgeGraph.edges || {}).length,
      query_node_count: Object.keys(queryGraph.nodes || {}).length,
      query_edge_count: Object.keys(queryGraph.edges || {}).length,
      biolink_version: response.biolink_version,
      schema_version: response.schema_version,
    },
    query_graph: queryGraph,
    knowledge_graph: knowledgeGraph,
    results: results,
    logs: response.logs || [],
    full_response: response
  };
}

// Format Meta Knowledge Graph for Claude consumption
function formatMetaKnowledgeGraphForModel(metaKG: any): string {
  if (!metaKG || !metaKG.nodes || !metaKG.edges) {
    return "No meta knowledge graph data available";
  }

  const nodeCount = Object.keys(metaKG.nodes).length;
  const edgeCount = metaKG.edges.length;

  let formattedResponse = [
    `# Meta Knowledge Graph`,
    ``,
    `## Summary`,
    `- **Node Categories:** ${nodeCount}`,
    `- **Edge Types:** ${edgeCount}`,
    ``
  ];

  if (nodeCount > 0) {
    formattedResponse.push(`## Available Node Categories`);
    Object.entries(metaKG.nodes).slice(0, 10).forEach(([category, node]: [string, any]) => {
      const prefixes = Array.isArray(node.id_prefixes) ? node.id_prefixes.join(', ') : 'None';
      formattedResponse.push(`- **${category}:** ${prefixes}`);
    });
    if (nodeCount > 10) {
      formattedResponse.push(`- ... and ${nodeCount - 10} more categories`);
    }
    formattedResponse.push(``);
  }

  if (edgeCount > 0) {
    formattedResponse.push(`## Available Edge Types`);
    metaKG.edges.slice(0, 10).forEach((edge: any) => {
      const subject = edge.subject || 'Unknown';
      const predicate = edge.predicate || 'Unknown';
      const object = edge.object || 'Unknown';
      formattedResponse.push(`- **${subject}** --[${predicate}]--> **${object}**`);
    });
    if (edgeCount > 10) {
      formattedResponse.push(`- ... and ${edgeCount - 10} more edge types`);
    }
    formattedResponse.push(``);
  }

  return formattedResponse.join("\n");
}

// Format Meta Knowledge Graph data for artifacts
function formatMetaKnowledgeGraphArtifactData(metaKG: any): any {
  if (!metaKG || !metaKG.nodes || !metaKG.edges) {
    return { error: "No meta knowledge graph data available" };
  }

  return {
    summary: {
      node_categories: Object.keys(metaKG.nodes).length,
      edge_types: metaKG.edges.length,
      total_id_prefixes: Object.values(metaKG.nodes).reduce((total: number, node: any) => 
        total + (Array.isArray(node.id_prefixes) ? node.id_prefixes.length : 0), 0
      ),
    },
    nodes: metaKG.nodes,
    edges: metaKG.edges,
    full_meta_kg: metaKG
  };
}

// =============================================================================
// TOOL DEFINITIONS
// =============================================================================

const tools = [
  {
    name: "query-microbiome",
    description: "Query the Multiomics Microbiome Knowledge Provider using TRAPI 1.5.0. Find relationships between microbiome entities, genes, diseases, and other biomedical concepts. Supports complex graph-based queries with customizable predicates and categories.",
    inputSchema: {
      type: "object",
      properties: {
        subject_id: {
          type: "string",
          description: "Curie ID of the subject entity (e.g., 'NCBIGene:695', 'MONDO:0005148', 'CHEBI:15365')"
        },
        object_id: {
          type: "string",
          description: "Optional: Curie ID of the object entity to find specific relationships"
        },
        predicate: {
          type: "string",
          default: "biolink:related_to",
          description: "Biolink predicate for the relationship (e.g., 'biolink:related_to', 'biolink:interacts_with', 'biolink:associated_with')"
        },
        subject_categories: {
          type: "array",
          items: { type: "string" },
          description: "Optional: Biolink categories for subject entity (e.g., ['biolink:Gene', 'biolink:Disease'])"
        },
        object_categories: {
          type: "array",
          items: { type: "string" },
          description: "Optional: Biolink categories for object entity (e.g., ['biolink:Gene', 'biolink:Disease'])"
        },
        max_results: {
          type: "number",
          minimum: 1,
          maximum: 100,
          default: 20,
          description: "Maximum number of results to return"
        },
        log_level: {
          type: "string",
          enum: ["ERROR", "WARNING", "INFO", "DEBUG"],
          default: "INFO",
          description: "Logging level for the query"
        }
      },
      required: ["subject_id"]
    }
  },
  {
    name: "get-microbiome-meta-kg",
    description: "Get the meta knowledge graph for the Multiomics Microbiome Knowledge Provider. Shows all available node categories, edge types, and ID prefixes supported by the service.",
    inputSchema: {
      type: "object",
      properties: {
        include_attributes: {
          type: "boolean",
          default: true,
          description: "Whether to include attribute information in the response"
        },
        include_qualifiers: {
          type: "boolean",
          default: true,
          description: "Whether to include qualifier information in the response"
        }
      }
    }
  }
];

// =============================================================================
// TOOL EXECUTION
// =============================================================================

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    if (name === "query-microbiome") {
      const queryParams = TRAPIQuerySchema.parse(args);
      
      console.log(`[${SERVICE_NAME}] Querying microbiome KP for: ${queryParams.subject_id}`);
      
      // Build TRAPI query
      const trapiQuery: any = {
        message: {
          query_graph: {
            nodes: {
              n0: {
                ids: [queryParams.subject_id],
                categories: queryParams.subject_categories
              }
            },
            edges: {}
          }
        },
        log_level: queryParams.log_level
      };

      // Add object node if specified
      if (queryParams.object_id) {
        trapiQuery.message.query_graph.nodes.n1 = {
          ids: [queryParams.object_id],
          categories: queryParams.object_categories
        };
        trapiQuery.message.query_graph.edges.e0 = {
          subject: "n0",
          object: "n1",
          predicates: [queryParams.predicate]
        };
      } else {
        // Single node query - find all related entities
        trapiQuery.message.query_graph.nodes.n1 = {
          categories: queryParams.object_categories
        };
        trapiQuery.message.query_graph.edges.e0 = {
          subject: "n0",
          object: "n1",
          predicates: [queryParams.predicate]
        };
      }

      const trapiResponse = await makeTRAPIRequest('/query', 'POST', trapiQuery);
      
      const formattedResponse = formatTRAPIResponseForModel(trapiResponse);
      const artifactData = formatTRAPIArtifactData(trapiResponse);

      return {
        content: [
          {
            type: "text",
            text: `${formattedResponse}

## Usage Instructions
This TRAPI query provides microbiome-related knowledge from the Multiomics Knowledge Provider. Use this data to:
1. **Explore relationships** - understand how entities are connected in the microbiome context
2. **Analyze results** - examine scores and confidence levels for different relationships
3. **Build knowledge graphs** - use the structured data to create visualizations
4. **Find new connections** - discover unexpected relationships between entities

## Next Steps
- Examine the knowledge graph nodes and edges for detailed relationship information
- Use the scores to rank results by relevance or confidence
- Explore the full TRAPI response for additional metadata and provenance information
- Consider querying with different predicates to explore different types of relationships`
          }
        ],
        artifacts: [
          {
            type: "application/json",
            title: "Microbiome TRAPI Query Results",
            name: "microbiome_trapi_results.json",
            content: artifactData
          }
        ]
      };
    }

    if (name === "get-microbiome-meta-kg") {
      const metaParams = MetaKnowledgeGraphSchema.parse(args);
      
      console.log(`[${SERVICE_NAME}] Getting meta knowledge graph`);
      
      const metaKGResponse = await makeTRAPIRequest('/meta_knowledge_graph', 'GET');
      
      const formattedResponse = formatMetaKnowledgeGraphForModel(metaKGResponse);
      const artifactData = formatMetaKnowledgeGraphArtifactData(metaKGResponse);

      return {
        content: [
          {
            type: "text",
            text: `${formattedResponse}

## Usage Instructions
The meta knowledge graph shows all available capabilities of the Multiomics Microbiome Knowledge Provider. Use this information to:
1. **Understand capabilities** - see what types of entities and relationships are supported
2. **Plan queries** - use the available node categories and edge types to construct effective queries
3. **Validate inputs** - ensure your curie IDs use supported prefixes
4. **Explore possibilities** - discover new types of queries you can perform

## Next Steps
- Use the node categories to understand what types of entities you can query
- Use the edge types to understand what relationships are available
- Check the ID prefixes to ensure your curie IDs are supported
- Use this information to construct more targeted TRAPI queries`
          }
        ],
        artifacts: [
          {
            type: "application/json",
            title: "Microbiome Meta Knowledge Graph",
            name: "microbiome_meta_kg.json",
            content: artifactData
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

// =============================================================================
// SERVER STARTUP
// =============================================================================

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools };
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.log(`[${SERVICE_NAME}] Microbiome KP MCP server running on stdio`);
}

main().catch((error) => {
  console.error(`[${SERVICE_NAME}] Server error:`, error);
  process.exit(1);
});