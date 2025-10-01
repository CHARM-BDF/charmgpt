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

// Gene Enrichment MCP Configuration
const API_BASE_URL = process.env.GENE_ENRICH_BASE_URL || "https://translator.broadinstitute.org/gelinea-trapi/v1.5";
const TOOL_NAME = "gene-enrichment-mcp";
const SERVICE_NAME = "gene-enrichment";

// TRAPI Query Schema for Gene Enrichment
const GeneEnrichmentQuerySchema = z.object({
  gene_ids: z.array(z.string()).min(1, "At least one gene ID is required").max(2500, "Maximum 2500 genes per request"),
  pvalue_threshold: z.number().min(0).max(1).optional().default(0.05),
  include_workflow: z.boolean().optional().default(true),
  submitter: z.string().optional(),
  bypass_cache: z.boolean().optional().default(false),
});

// Meta Knowledge Graph Schema
const MetaKnowledgeGraphSchema = z.object({
  include_attributes: z.boolean().optional().default(true),
});

// TRAPI Response Schema
const TRAPIResponseSchema = z.object({
  message: z.object({
    knowledge_graph: z.object({
      nodes: z.record(z.any()),
      edges: z.record(z.any()),
    }).optional(),
    results: z.array(z.any()).optional(),
    query_graph: z.object({
      nodes: z.record(z.any()),
      edges: z.record(z.any()),
    }).optional(),
  }),
  status: z.string().optional(),
  description: z.string().optional(),
  logs: z.array(z.any()).optional(),
  workflow: z.array(z.any()).optional(),
});

// Make TRAPI request to gene enrichment service
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
        throw new Error(`Payload too large. Gene list exceeds batch size limit of 2500.`);
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

// Format TRAPI response for Claude consumption
function formatTRAPIResponseForModel(response: any): string {
  const message = response.message || {};
  const results = message.results || [];
  const knowledgeGraph = message.knowledge_graph || {};
  const nodes = knowledgeGraph.nodes || {};
  const edges = knowledgeGraph.edges || {};
  
  let output = [
    `**Gene Enrichment Analysis Results**`,
    `**Status:** ${response.status || 'Unknown'}`,
    `**Description:** ${response.description || 'No description available'}`,
    `**Results Found:** ${results.length}`,
    `**Knowledge Graph Nodes:** ${Object.keys(nodes).length}`,
    `**Knowledge Graph Edges:** ${Object.keys(edges).length}`,
    ""
  ];

  if (results.length > 0) {
    output.push("## Enrichment Results");
    results.slice(0, 10).forEach((result: any, index: number) => {
      const nodeBindings = result.node_bindings || {};
      const analyses = result.analyses || [];
      
      output.push(`### Result ${index + 1}`);
      output.push(`**Node Bindings:** ${Object.keys(nodeBindings).length} nodes`);
      output.push(`**Analyses:** ${analyses.length} analyses`);
      
      if (analyses.length > 0) {
        const analysis = analyses[0];
        if (analysis.score !== undefined) {
          output.push(`**Score:** ${analysis.score}`);
        }
        if (analysis.resource_id) {
          output.push(`**Resource:** ${analysis.resource_id}`);
        }
      }
      output.push("");
    });
    
    if (results.length > 10) {
      output.push(`... and ${results.length - 10} more results`);
    }
  }

  if (Object.keys(nodes).length > 0) {
    output.push("## Knowledge Graph Summary");
    const nodeTypes = new Set();
    Object.values(nodes).forEach((node: any) => {
      if (node.categories) {
        node.categories.forEach((cat: string) => nodeTypes.add(cat));
      }
    });
    output.push(`**Node Categories:** ${Array.from(nodeTypes).join(', ')}`);
  }

  if (response.logs && response.logs.length > 0) {
    output.push("## Processing Logs");
    response.logs.slice(0, 5).forEach((log: any) => {
      output.push(`- [${log.level || 'INFO'}] ${log.message || 'No message'}`);
    });
  }

  return output.join("\n");
}

// Format TRAPI data for artifacts
function formatTRAPIArtifactData(response: any, queryParams: any): any {
  return {
    query: {
      gene_ids: queryParams.gene_ids,
      pvalue_threshold: queryParams.pvalue_threshold,
      parameters: queryParams,
    },
    response: {
      status: response.status,
      description: response.description,
      results_count: response.message?.results?.length || 0,
      knowledge_graph: {
        nodes_count: Object.keys(response.message?.knowledge_graph?.nodes || {}).length,
        edges_count: Object.keys(response.message?.knowledge_graph?.edges || {}).length,
      },
      logs_count: response.logs?.length || 0,
    },
    results: response.message?.results || [],
    knowledge_graph: response.message?.knowledge_graph || {},
    logs: response.logs || [],
    workflow: response.workflow || [],
    metadata: {
      timestamp: new Date().toISOString(),
      service: "GeLiNEA TRAPI 1.5.0",
      endpoint: API_BASE_URL,
    }
  };
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
    name: "get-gene-enrichment-meta-kg",
    description: "Get the meta knowledge graph for the Gene Enrichment TRAPI service, showing available node categories, predicates, and supported operations.",
    inputSchema: {
      type: "object",
      properties: {
        include_attributes: {
          type: "boolean",
          default: true,
          description: "Whether to include attribute information in the meta knowledge graph"
        }
      }
    }
  },
  {
    name: "query-gene-enrichment",
    description: "Perform gene enrichment analysis using a list of gene IDs. Returns enriched pathways, GO terms, and other functional annotations with statistical significance.",
    inputSchema: {
      type: "object",
      properties: {
        gene_ids: {
          type: "array",
          items: { type: "string" },
          minItems: 1,
          maxItems: 2500,
          description: "Array of gene identifiers (e.g., NCBIGene:695, ENSEMBL:ENSG00000012048)"
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
          description: "Whether to include workflow information in the response"
        },
        submitter: {
          type: "string",
          description: "Optional identifier for the submitter of the query"
        },
        bypass_cache: {
          type: "boolean",
          default: false,
          description: "Whether to bypass cached results and get fresh data"
        }
      },
      required: ["gene_ids"]
    }
  }
];

// List tools handler
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools };
});

// Tool execution handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    if (name === "get-gene-enrichment-meta-kg") {
      const metaParams = MetaKnowledgeGraphSchema.parse(args);
      
      console.log(`[${SERVICE_NAME}] Getting meta knowledge graph`);
      
      const metaKg = await makeTRAPIRequest("/meta_knowledge_graph", "GET");
      
      if (!metaKg) {
        return {
          content: [
            {
              type: "text",
              text: `Failed to retrieve meta knowledge graph from Gene Enrichment TRAPI service.`
            }
          ]
        };
      }

      const formattedMeta = [
        `**Gene Enrichment TRAPI Meta Knowledge Graph**`,
        `**Service:** GeLiNEA (Gene-List Network Enrichment Analysis)`,
        `**TRAPI Version:** 1.5.0`,
        `**Endpoint:** ${API_BASE_URL}`,
        "",
        `**Available Node Categories:** ${Object.keys(metaKg.nodes || {}).length}`,
        `**Available Predicates:** ${(metaKg.edges || []).length}`,
        ""
      ];

      if (metaKg.nodes) {
        formattedMeta.push("## Supported Node Categories");
        Object.entries(metaKg.nodes).forEach(([category, nodeInfo]: [string, any]) => {
          formattedMeta.push(`- **${category}**`);
          if (nodeInfo.id_prefixes) {
            formattedMeta.push(`  - ID Prefixes: ${nodeInfo.id_prefixes.join(', ')}`);
          }
        });
        formattedMeta.push("");
      }

      if (metaKg.edges) {
        formattedMeta.push("## Supported Predicates");
        metaKg.edges.slice(0, 10).forEach((edge: any) => {
          formattedMeta.push(`- **${edge.predicate}**: ${edge.subject} → ${edge.object}`);
        });
        if (metaKg.edges.length > 10) {
          formattedMeta.push(`... and ${metaKg.edges.length - 10} more predicates`);
        }
      }

      return {
        content: [
          {
            type: "text",
            text: formattedMeta.join("\n")
          }
        ],
        artifacts: [
          {
            type: "application/json",
            title: "Gene Enrichment Meta Knowledge Graph",
            name: "gene_enrichment_meta_kg.json",
            content: {
              meta_kg: metaKg,
              service_info: {
                name: "GeLiNEA",
                version: "1.5.0",
                endpoint: API_BASE_URL,
                operations: ["lookup", "enrich_results"],
                batch_size_limit: 2500,
              },
              metadata: {
                timestamp: new Date().toISOString(),
                retrieved_from: API_BASE_URL,
              }
            }
          }
        ]
      };
    }

    if (name === "query-gene-enrichment") {
      const queryParams = GeneEnrichmentQuerySchema.parse(args);
      
      console.log(`[${SERVICE_NAME}] Performing gene enrichment analysis for ${queryParams.gene_ids.length} genes`);
      
      // Build TRAPI query for gene enrichment
      const trapiQuery: any = {
        message: {
          knowledge_graph: {
            nodes: {},
            edges: {}
          }
        },
        workflow: queryParams.include_workflow ? [
          {
            id: "enrich_results",
            parameters: {
              pvalue_threshold: queryParams.pvalue_threshold
            }
          }
        ] : undefined,
        submitter: queryParams.submitter,
        bypass_cache: queryParams.bypass_cache
      };

      // Add gene nodes to knowledge graph
      queryParams.gene_ids.forEach((geneId, index) => {
        const nodeKey = `n${index}`;
        trapiQuery.message.knowledge_graph.nodes[nodeKey] = {
          categories: ["biolink:Gene"],
          attributes: []
        };
      });

      const trapiResponse = await makeTRAPIRequest("/query", "POST", trapiQuery);
      
      const formattedResponse = formatTRAPIResponseForModel(trapiResponse);
      const artifactData = formatTRAPIArtifactData(trapiResponse, queryParams);

      return {
        content: [
          {
            type: "text",
            text: formattedResponse
          }
        ],
        artifacts: [
          {
            type: "application/json",
            title: "Gene Enrichment Analysis Results",
            name: "gene_enrichment_results.json",
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

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`${TOOL_NAME} server running on stdio`);
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});