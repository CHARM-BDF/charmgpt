import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

// =============================================================================
// CONFIGURATION SECTION
// =============================================================================
const TOOL_NAME = "graphmode-arax";
const SERVICE_NAME = "arax-mcp";
const DEFAULT_API_BASE_URL = process.env.API_BASE_URL || "http://localhost:3001";
const ARAX_API_URL = "https://arax.ncats.io/api/arax/v1.4";

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================
interface AraxNode {
  name?: string;
  categories?: string[];
  attributes?: Array<{
    attribute_type_id: string;
    value: any;
  }>;
}

interface AraxEdge {
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

interface AraxResponse {
  message: {
    query_graph?: any;
    knowledge_graph?: {
      nodes: Record<string, AraxNode>;
      edges: Record<string, AraxEdge>;
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
  edges: z.record(QueryGraphEdgeSchema).optional(),
});

const AraxQuerySchema = z.object({
  query_graph: TrapiQueryGraphSchema,
  query_options: z.object({
    kp_timeout: z.string().optional(),
    prune_threshold: z.string().optional(),
    max_pathfinder_paths: z.string().optional(),
    max_path_length: z.string().optional(),
  }).optional(),
  stream_progress: z.boolean().optional(),
  submitter: z.string().optional(),
  databaseContext: DatabaseContextSchema,
});

const PathfinderQuerySchema = z.object({
  source_nodes: z.array(z.string()).min(1, "At least one source node is required"),
  target_nodes: z.array(z.string()).min(1, "At least one target node is required"),
  max_path_length: z.number().min(1).max(10).optional().default(4),
  max_paths: z.number().min(1).max(1000).optional().default(100),
  databaseContext: DatabaseContextSchema,
});

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================
function generateRandomPosition(): { x: number; y: number } {
  return {
    x: Math.random() * 1000 - 500,
    y: Math.random() * 1000 - 500,
  };
}

function extractNodeName(node: AraxNode, nodeId: string): string {
  if (node.name) return node.name;
  
  // Try to extract from attributes
  if (node.attributes) {
    const nameAttr = node.attributes.find(attr => 
      attr.attribute_type_id === 'biolink:name' || 
      attr.attribute_type_id === 'name'
    );
    if (nameAttr?.value) return nameAttr.value;
  }
  
  // Fallback to node ID
  return nodeId;
}

function extractNodeType(node: AraxNode): string {
  if (node.categories && node.categories.length > 0) {
    // Get the most specific category (last in hierarchy)
    const category = node.categories[node.categories.length - 1];
    return category.replace('biolink:', '').replace(/([A-Z])/g, ' $1').trim();
  }
  return 'Unknown';
}

function extractNodeData(node: AraxNode, nodeId: string): any {
  const data: any = {
    source: 'arax',
    categories: node.categories || [],
    xrefs: [],
    synonyms: [],
  };

  // Extract xrefs and synonyms from attributes
  if (node.attributes) {
    node.attributes.forEach(attr => {
      if (attr.attribute_type_id === 'biolink:xref' || attr.attribute_type_id === 'xref') {
        if (Array.isArray(attr.value)) {
          data.xrefs.push(...attr.value);
        } else {
          data.xrefs.push(attr.value);
        }
      } else if (attr.attribute_type_id === 'biolink:synonym' || attr.attribute_type_id === 'synonym') {
        if (Array.isArray(attr.value)) {
          data.synonyms.push(...attr.value);
        } else {
          data.synonyms.push(attr.value);
        }
      }
    });
  }

  return data;
}

function extractEdgeData(edge: AraxEdge): any {
  const data: any = {
    source: 'arax',
    primary_source: 'arax',
    publications: [],
    knowledge_level: 'knowledge_assertion',
    agent_type: 'computational_agent',
    provenance: [],
  };

  // Extract provenance from sources
  if (edge.sources) {
    edge.sources.forEach(source => {
      data.provenance.push({
        resource_id: source.resource_id,
        resource_role: source.resource_role,
        upstream_resource_ids: source.upstream_resource_ids,
      });
      
      if (source.resource_role === 'primary_knowledge_source') {
        data.primary_source = source.resource_id;
      }
    });
  }

  // Extract publications from attributes
  if (edge.attributes) {
    edge.attributes.forEach(attr => {
      if (attr.attribute_type_id === 'biolink:publications' || 
          attr.attribute_type_id === 'publications') {
        if (Array.isArray(attr.value)) {
          data.publications.push(...attr.value);
        } else {
          data.publications.push(attr.value);
        }
      }
    });
  }

  return data;
}

// =============================================================================
// API REQUEST FUNCTIONS
// =============================================================================
async function makeAPIRequest(
  url: string,
  method: string,
  data?: any,
  headers?: Record<string, string>
): Promise<any> {
  console.error('Making API request to:', url);
  console.error('Request data:', JSON.stringify(data, null, 2));
  
  const response = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: data ? JSON.stringify(data) : undefined,
  });

  console.error('Response status:', response.status);
  console.error('Response headers:', Object.fromEntries(response.headers.entries()));

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Error response body:', errorText);
    throw new Error(`API request failed: ${response.status} ${response.statusText} - ${errorText}`);
  }

  // Handle streaming response from ARAX
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('text/event-stream')) {
    console.error('Processing streaming response from ARAX...');
    return await processStreamingResponse(response);
  }

  return await response.json();
}

async function processStreamingResponse(response: Response): Promise<AraxResponse> {
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('No response body reader available');
  }

  const decoder = new TextDecoder();
  let buffer = '';
  let finalResponse: any = null;
  let lineCount = 0;
  const maxLines = 2000; // Increased limit for longer responses
  const timeout = 60000; // 60 second timeout (ARAX can take a while)
  const startTime = Date.now();

  try {
    while (true) {
      // Check timeout
      if (Date.now() - startTime > timeout) {
        console.error('Streaming timeout reached, using last valid response');
        break;
      }

      const { done, value } = await reader.read();
      
      if (done) {
        console.error('Stream completed normally');
        break;
      }
      
      buffer += decoder.decode(value, { stream: true });
      
      // Process complete lines
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep incomplete line in buffer
      
      for (const line of lines) {
        if (line.trim() === '') continue;
        
        lineCount++;
        if (lineCount > maxLines) {
          console.error('Max lines reached, using last valid response');
          break;
        }
        
        // Log first few lines to understand the format
        if (lineCount <= 5) {
          console.error(`Line ${lineCount}:`, line.substring(0, 200));
        }
        
        // ARAX streaming format: each line is a JSON object
        try {
          const parsed = JSON.parse(line);
          console.error(`Parsed JSON from line ${lineCount}:`, {
            hasMessage: !!parsed.message,
            hasKnowledgeGraph: !!parsed.message?.knowledge_graph,
            hasResults: !!parsed.message?.results,
            messageKeys: parsed.message ? Object.keys(parsed.message) : [],
            timestamp: parsed.timestamp,
            level: parsed.level
          });
          
          // Look for the final response with knowledge graph
          if (parsed.message && parsed.message.knowledge_graph) {
            console.error('Found complete response with knowledge graph');
            finalResponse = parsed;
            // Don't break here, keep looking for more complete responses
          } else if (parsed.message && Array.isArray(parsed.message)) {
            // This is a progress update with log entries, skip it
            console.error(`Skipping progress update with ${parsed.message.length} log entries`);
          } else if (parsed.message) {
            // Keep any other response with a message
            finalResponse = parsed;
          }
        } catch (e) {
          // Skip malformed JSON lines
          if (lineCount < 10) { // Only log first few errors
            console.error('Failed to parse streaming data:', line.substring(0, 100) + '...');
          }
        }
      }
      
      // If we have a good response with knowledge graph, break
      if (finalResponse && finalResponse.message && finalResponse.message.knowledge_graph) {
        console.error('Complete response with knowledge graph found, stopping stream processing');
        break;
      }
    }
  } finally {
    reader.releaseLock();
  }

  if (!finalResponse) {
    console.error('No valid response found. Buffer content:', buffer.substring(0, 500));
    throw new Error('No valid response received from ARAX streaming');
  }

  console.error('Final response structure:', {
    hasMessage: !!finalResponse.message,
    hasKnowledgeGraph: !!finalResponse.message?.knowledge_graph,
    hasNodes: !!finalResponse.message?.knowledge_graph?.nodes,
    hasEdges: !!finalResponse.message?.knowledge_graph?.edges,
    nodeCount: finalResponse.message?.knowledge_graph?.nodes ? Object.keys(finalResponse.message.knowledge_graph.nodes).length : 0,
    edgeCount: finalResponse.message?.knowledge_graph?.edges ? Object.keys(finalResponse.message.knowledge_graph.edges).length : 0
  });

  return finalResponse;
}

async function makeAraxRequest(queryData: any): Promise<AraxResponse> {
  const url = `${ARAX_API_URL}/query`;
  
  const requestData = {
    message: {
      query_graph: queryData.query_graph,
    },
    query_options: queryData.query_options || {
      kp_timeout: "30",
      prune_threshold: "50",
      max_pathfinder_paths: "100",
      max_path_length: "4",
    },
    stream_progress: queryData.stream_progress || true,
    submitter: queryData.submitter || "ARAX MCP",
  };

  console.error('ARAX Request Data:', JSON.stringify(requestData, null, 2));
  return await makeAPIRequest(url, 'POST', requestData);
}

async function createNodeInDatabase(
  node: GraphModeNode,
  conversationId: string,
  apiBaseUrl: string
): Promise<void> {
  const url = `${apiBaseUrl}/api/graph/${conversationId}/nodes`;
  
  await makeAPIRequest(url, 'POST', node);
}

async function createEdgeInDatabase(
  edge: GraphModeEdge,
  conversationId: string,
  apiBaseUrl: string
): Promise<void> {
  const url = `${apiBaseUrl}/api/graph/${conversationId}/edges`;
  
  await makeAPIRequest(url, 'POST', edge);
}

// =============================================================================
// TRANSFORMATION FUNCTIONS
// =============================================================================
function transformAraxNodeToGraphMode(
  nodeId: string,
  node: AraxNode
): GraphModeNode {
  const label = extractNodeName(node, nodeId);
  const type = extractNodeType(node);
  const data = extractNodeData(node, nodeId);
  const position = generateRandomPosition();

  return {
    id: nodeId,
    label,
    type,
    data,
    position,
  };
}

function transformAraxEdgeToGraphMode(
  edgeId: string,
  edge: AraxEdge
): GraphModeEdge {
  const data = extractEdgeData(edge);
  
  return {
    id: edgeId,
    source: edge.subject,
    target: edge.object,
    label: edge.predicate.replace('biolink:', ''),
    data,
  };
}

async function processAraxResponse(
  response: AraxResponse,
  conversationId: string,
  apiBaseUrl: string
): Promise<{ nodesCreated: number; edgesCreated: number; errors: string[] }> {
  const errors: string[] = [];
  let nodesCreated = 0;
  let edgesCreated = 0;

  const knowledgeGraph = response.message?.knowledge_graph;
  if (!knowledgeGraph) {
    throw new Error('No knowledge graph in ARAX response');
  }

  // Process nodes
  const nodeEntries = Object.entries(knowledgeGraph.nodes || {});
  for (const [nodeId, node] of nodeEntries) {
    try {
      const graphModeNode = transformAraxNodeToGraphMode(nodeId, node);
      await createNodeInDatabase(graphModeNode, conversationId, apiBaseUrl);
      nodesCreated++;
    } catch (error) {
      const errorMsg = `Failed to create node ${nodeId}: ${error}`;
      errors.push(errorMsg);
      console.error(errorMsg);
    }
  }

  // Process edges
  const edgeEntries = Object.entries(knowledgeGraph.edges || {});
  for (const [edgeId, edge] of edgeEntries) {
    try {
      const graphModeEdge = transformAraxEdgeToGraphMode(edgeId, edge);
      await createEdgeInDatabase(graphModeEdge, conversationId, apiBaseUrl);
      edgesCreated++;
    } catch (error) {
      const errorMsg = `Failed to create edge ${edgeId}: ${error}`;
      errors.push(errorMsg);
      console.error(errorMsg);
    }
  }

  return { nodesCreated, edgesCreated, errors };
}

// =============================================================================
// MCP SERVER SETUP
// =============================================================================
const server = new Server(
  {
    name: SERVICE_NAME,
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// =============================================================================
// TOOL IMPLEMENTATIONS
// =============================================================================
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "query_arax",
        description: "Query ARAX pathfinder to find connections between biomedical entities using TRAPI format",
        inputSchema: {
          type: "object",
          properties: {
            query_graph: {
              type: "object",
              description: "TRAPI query graph with nodes and edges",
              properties: {
                nodes: {
                  type: "object",
                  description: "Nodes in the query graph",
                  additionalProperties: {
                    type: "object",
                    properties: {
                      ids: { type: "array", items: { type: "string" } },
                      categories: { type: "array", items: { type: "string" } },
                    },
                  },
                },
                edges: {
                  type: "object",
                  description: "Edges in the query graph",
                  additionalProperties: {
                    type: "object",
                    properties: {
                      subject: { type: "string" },
                      object: { type: "string" },
                      predicates: { type: "array", items: { type: "string" } },
                    },
                  },
                },
              },
            },
            query_options: {
              type: "object",
              description: "ARAX query options",
              properties: {
                kp_timeout: { type: "string" },
                prune_threshold: { type: "string" },
                max_pathfinder_paths: { type: "string" },
                max_path_length: { type: "string" },
              },
            },
            stream_progress: { type: "boolean" },
            submitter: { type: "string" },
            databaseContext: {
              type: "object",
              description: "Database context for Graph Mode",
              properties: {
                conversationId: { type: "string" },
                artifactId: { type: "string" },
                apiBaseUrl: { type: "string" },
                accessToken: { type: "string" },
              },
            },
          },
          required: ["query_graph", "databaseContext"],
        },
      },
      {
        name: "pathfinder_query",
        description: "Find paths between source and target nodes using ARAX pathfinder",
        inputSchema: {
          type: "object",
          properties: {
            source_nodes: {
              type: "array",
              items: { type: "string" },
              description: "Source node IDs (CURIE format)",
            },
            target_nodes: {
              type: "array",
              items: { type: "string" },
              description: "Target node IDs (CURIE format)",
            },
            max_path_length: {
              type: "number",
              description: "Maximum path length (1-10)",
              minimum: 1,
              maximum: 10,
            },
            max_paths: {
              type: "number",
              description: "Maximum number of paths to find (1-1000)",
              minimum: 1,
              maximum: 1000,
            },
            databaseContext: {
              type: "object",
              description: "Database context for Graph Mode",
              properties: {
                conversationId: { type: "string" },
                artifactId: { type: "string" },
                apiBaseUrl: { type: "string" },
                accessToken: { type: "string" },
              },
            },
          },
          required: ["source_nodes", "target_nodes", "databaseContext"],
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    if (name === "query_arax") {
      const validatedArgs = AraxQuerySchema.parse(args);
      const { query_graph, query_options, stream_progress, submitter, databaseContext } = validatedArgs;
      
      const { conversationId, apiBaseUrl = DEFAULT_API_BASE_URL } = databaseContext;

      // Make ARAX API request
      const araxResponse = await makeAraxRequest({
        query_graph,
        query_options,
        stream_progress,
        submitter,
      });

      // Process response and create nodes/edges
      const { nodesCreated, edgesCreated, errors } = await processAraxResponse(
        araxResponse,
        conversationId,
        apiBaseUrl
      );

      const errorText = errors.length > 0 ? `\n\n**Errors:**\n${errors.join('\n')}` : '';
      
      return {
        content: [
          {
            type: "text",
            text: `✅ ARAX Query Complete!

**Results:**
- Added ${nodesCreated} nodes
- Added ${edgesCreated} edges

**Query:** ${JSON.stringify(query_graph, null, 2)}${errorText}

The graph has been updated with ARAX pathfinder results.`,
          },
        ],
        refreshGraph: true,
      };
    }

    if (name === "pathfinder_query") {
      const validatedArgs = PathfinderQuerySchema.parse(args);
      const { source_nodes, target_nodes, max_path_length, max_paths, databaseContext } = validatedArgs;
      
      const { conversationId, apiBaseUrl = DEFAULT_API_BASE_URL } = databaseContext;

      // Construct pathfinder query graph
      const query_graph = {
        nodes: {
          n0: {
            ids: source_nodes,
          },
          n1: {
            ids: target_nodes,
          },
        },
        edges: {
          e0: {
            subject: "n0",
            object: "n1",
            predicates: ["biolink:related_to"],
          },
        },
      };

      const query_options = {
        kp_timeout: "30",
        prune_threshold: "50",
        max_pathfinder_paths: max_paths.toString(),
        max_path_length: max_path_length.toString(),
      };

      // Make ARAX API request
      const araxResponse = await makeAraxRequest({
        query_graph,
        query_options,
        stream_progress: true,
        submitter: "ARAX Pathfinder MCP",
      });

      // Process response and create nodes/edges
      const { nodesCreated, edgesCreated, errors } = await processAraxResponse(
        araxResponse,
        conversationId,
        apiBaseUrl
      );

      const errorText = errors.length > 0 ? `\n\n**Errors:**\n${errors.join('\n')}` : '';
      
      return {
        content: [
          {
            type: "text",
            text: `✅ ARAX Pathfinder Query Complete!

**Pathfinder Results:**
- Source nodes: ${source_nodes.join(', ')}
- Target nodes: ${target_nodes.join(', ')}
- Max path length: ${max_path_length}
- Max paths: ${max_paths}

**Results:**
- Added ${nodesCreated} nodes
- Added ${edgesCreated} edges

The graph has been updated with pathfinder results.${errorText}`,
          },
        ],
        refreshGraph: true,
      };
    }

    throw new Error(`Unknown tool: ${name}`);
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `❌ ARAX Query Failed: ${error}`,
        },
      ],
    };
  }
});

// =============================================================================
// START SERVER
// =============================================================================
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("ARAX GraphMode MCP server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in ARAX MCP server:", error);
  process.exit(1);
});
