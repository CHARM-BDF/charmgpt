import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

// =============================================================================
// CONFIGURATION SECTION
// =============================================================================

const TOOL_NAME = "graph-mode-mcp";
const SERVICE_NAME = "graph-mode";

// API configuration will come from database context passed by backend
// No hardcoded URL - it's provided per-request
const DEFAULT_API_BASE_URL = process.env.API_BASE_URL || "http://localhost:5001";

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

// Schema for removeNode tool
const RemoveNodeArgumentsSchema = z.object({
  nodeId: z.string().min(1, "Node ID cannot be empty"),
  databaseContext: DatabaseContextSchema,
});

// Schema for removeEdge tool
const RemoveEdgeArgumentsSchema = z.object({
  edgeId: z.string().min(1, "Edge ID cannot be empty"),
  databaseContext: DatabaseContextSchema,
});

// Schema for getGraphState tool
const GetGraphStateArgumentsSchema = z.object({
  databaseContext: DatabaseContextSchema,
  filter: z.object({
    nodeType: z.string().optional(),
    edgeType: z.string().optional(),
    nodeIds: z.array(z.string()).optional(),
  }).optional(),
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
    console.error(`[${SERVICE_NAME}] Context conversationId: ${context.conversationId}`);
    console.error(`[${SERVICE_NAME}] Base URL: ${baseUrl}`);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': TOOL_NAME,
    };

    if (context.accessToken) {
      headers['Authorization'] = `Bearer ${context.accessToken}`;
    }

    console.error(`[${SERVICE_NAME}] Making request to: ${url}`);
    console.error(`[${SERVICE_NAME}] Method: ${options.method || 'GET'}`);

    const response = await fetch(url, {
      ...options,
      headers: {
        ...headers,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[${SERVICE_NAME}] HTTP error! status: ${response.status}, body: ${errorText}`);
      throw new Error(`HTTP error! status: ${response.status} - ${response.statusText}`);
    }

    const data = await response.json();
    return data;

  } catch (error) {
    console.error(`[${SERVICE_NAME}] Error making API request to ${endpoint}:`, error);
    throw error;
  }
}

// =============================================================================
// DATA FORMATTING FUNCTIONS
// =============================================================================

function formatGraphStateForModel(graphData: any): string {
  const { nodes, edges, metadata } = graphData;

  if (!nodes || nodes.length === 0) {
    return "The graph is currently empty (no nodes or edges).";
  }

  // Group nodes by type
  const nodesByType: Record<string, any[]> = {};
  nodes.forEach((node: any) => {
    const type = node.type || 'other';
    if (!nodesByType[type]) {
      nodesByType[type] = [];
    }
    nodesByType[type].push(node);
  });

  // Format nodes section
  const nodesSummary = Object.entries(nodesByType).map(([type, nodeList]) => {
    const nodeItems = nodeList.map((n: any) => `  - ${n.label} (ID: ${n.id})`).join('\n');
    return `**${type}** (${nodeList.length}):\n${nodeItems}`;
  }).join('\n\n');

  // Format edges section
  const edgesSummary = edges && edges.length > 0 
    ? edges.map((e: any) => {
        const sourceNode = nodes.find((n: any) => n.id === e.source);
        const targetNode = nodes.find((n: any) => n.id === e.target);
        const sourceLabel = sourceNode ? sourceNode.label : e.source;
        const targetLabel = targetNode ? targetNode.label : e.target;
        const edgeLabel = e.label ? ` (${e.label})` : '';
        return `  - ${sourceLabel} → ${targetLabel}${edgeLabel}`;
      }).join('\n')
    : '  (No edges)';

  return `# Current Graph State\n\n` +
    `**Total Nodes:** ${metadata?.nodeCount || nodes.length}\n` +
    `**Total Edges:** ${metadata?.edgeCount || (edges?.length || 0)}\n` +
    `**Last Updated:** ${metadata?.lastUpdated || 'Unknown'}\n\n` +
    `## Nodes\n\n${nodesSummary}\n\n` +
    `## Edges\n\n${edgesSummary}`;
}

function formatNodeDetails(node: any): string {
  return `**Node Details:**\n` +
    `- ID: ${node.id}\n` +
    `- Label: ${node.label}\n` +
    `- Type: ${node.type}\n` +
    `- Position: (${node.position?.x || 0}, ${node.position?.y || 0})\n` +
    `- Created: ${node.createdAt}`;
}

function formatEdgeDetails(edge: any, nodes: any[]): string {
  const sourceNode = nodes?.find((n: any) => n.id === edge.source);
  const targetNode = nodes?.find((n: any) => n.id === edge.target);
  
  return `**Edge Details:**\n` +
    `- ID: ${edge.id}\n` +
    `- Source: ${sourceNode?.label || edge.source} (${edge.source})\n` +
    `- Target: ${targetNode?.label || edge.target} (${edge.target})\n` +
    `- Label: ${edge.label || 'No label'}\n` +
    `- Type: ${edge.type || 'No type'}\n` +
    `- Created: ${edge.createdAt}`;
}

// =============================================================================
// TOOL DEFINITIONS
// =============================================================================

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "removeNode",
        description: "Remove a node from the knowledge graph. This will also remove all edges connected to this node. " +
          "Use this when you need to delete a node that is no longer relevant or was added by mistake. " +
          "This modifies the existing graph artifact - no new artifacts are created.",
        inputSchema: {
          type: "object",
          properties: {
            nodeId: {
              type: "string",
              description: "The unique identifier of the node to remove",
            },
            databaseContext: {
              type: "object",
              properties: {
                conversationId: { type: "string" },
                apiBaseUrl: { type: "string" },
                accessToken: { type: "string" },
              },
              required: ["conversationId"],
            },
          },
          required: ["nodeId", "databaseContext"],
        },
      },
      {
        name: "removeEdge",
        description: "Remove an edge (connection) from the knowledge graph. " +
          "Use this when you need to delete a relationship between two nodes. " +
          "This modifies the existing graph artifact - no new artifacts are created.",
        inputSchema: {
          type: "object",
          properties: {
            edgeId: {
              type: "string",
              description: "The unique identifier of the edge to remove",
            },
            databaseContext: {
              type: "object",
              properties: {
                conversationId: { type: "string" },
                apiBaseUrl: { type: "string" },
                accessToken: { type: "string" },
              },
              required: ["conversationId"],
            },
          },
          required: ["edgeId", "databaseContext"],
        },
      },
      {
        name: "getGraphState",
        description: "Get the current state of the knowledge graph, including all nodes and edges. " +
          "Optionally filter by node type, edge type, or specific node IDs. " +
          "Use this to query what's currently in the graph. " +
          "Returns information directly to the conversation - no artifacts are created.",
        inputSchema: {
          type: "object",
          properties: {
            databaseContext: {
              type: "object",
              properties: {
                conversationId: { type: "string" },
                apiBaseUrl: { type: "string" },
                accessToken: { type: "string" },
              },
              required: ["conversationId"],
            },
            filter: {
              type: "object",
              properties: {
                nodeType: {
                  type: "string",
                  description: "Filter nodes by type (e.g., 'gene', 'disease', 'drug')",
                },
                edgeType: {
                  type: "string",
                  description: "Filter edges by type (e.g., 'inhibits', 'associated_with')",
                },
                nodeIds: {
                  type: "array",
                  items: { type: "string" },
                  description: "Filter to only include specific node IDs",
                },
              },
            },
          },
          required: ["databaseContext"],
        },
      },
    ],
  };
});

// =============================================================================
// TOOL EXECUTION
// =============================================================================

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    if (name === "removeNode") {
      const { nodeId, databaseContext } = RemoveNodeArgumentsSchema.parse(args);
      
      console.error(`[${SERVICE_NAME}] Removing node: ${nodeId}`);
      console.error(`[${SERVICE_NAME}] Conversation ID: ${databaseContext.conversationId}`);
      
      // First, get the node details for the response message
      let nodeLabel = nodeId;
      try {
        const graphState = await makeAPIRequest('/state', databaseContext);
        const node = graphState.data?.nodes?.find((n: any) => n.id === nodeId);
        if (node) {
          nodeLabel = node.label || nodeId;
        }
      } catch (error) {
        console.error(`[${SERVICE_NAME}] Could not fetch node details, using ID as label`);
      }
      
      // Delete the node
      const result = await makeAPIRequest(
        `/nodes/${encodeURIComponent(nodeId)}`,
        databaseContext,
        { method: 'DELETE' }
      );

      if (!result || !result.success) {
        return {
          content: [
            {
              type: "text",
              text: `Failed to remove node '${nodeLabel}' from the graph. The node may not exist.`,
            },
          ],
        };
      }

      return {
        content: [
            {
              type: "text",
              text: `Successfully removed node '${nodeLabel}' (ID: ${nodeId}) from the graph. All edges connected to this node were also removed.`,
            },
        ],
      };

    } else if (name === "removeEdge") {
      const { edgeId, databaseContext } = RemoveEdgeArgumentsSchema.parse(args);
      
      console.error(`[${SERVICE_NAME}] Removing edge: ${edgeId}`);
      console.error(`[${SERVICE_NAME}] Conversation ID: ${databaseContext.conversationId}`);
      
      // First, get the edge details for the response message
      let edgeDescription = edgeId;
      try {
        const graphState = await makeAPIRequest('/state', databaseContext);
        const edge = graphState.data?.edges?.find((e: any) => e.id === edgeId);
        if (edge) {
          const nodes = graphState.data?.nodes || [];
          const sourceNode = nodes.find((n: any) => n.id === edge.source);
          const targetNode = nodes.find((n: any) => n.id === edge.target);
          edgeDescription = `${sourceNode?.label || edge.source} → ${targetNode?.label || edge.target}`;
        }
      } catch (error) {
        console.error(`[${SERVICE_NAME}] Could not fetch edge details, using ID`);
      }
      
      // Delete the edge
      const result = await makeAPIRequest(
        `/edges/${encodeURIComponent(edgeId)}`,
        databaseContext,
        { method: 'DELETE' }
      );

      if (!result || !result.success) {
        return {
          content: [
            {
              type: "text",
              text: `Failed to remove edge '${edgeDescription}' from the graph. The edge may not exist.`,
            },
          ],
        };
      }

      return {
        content: [
          {
            type: "text",
            text: `Successfully removed edge '${edgeDescription}' (ID: ${edgeId}) from the graph.`,
          },
        ],
      };

    } else if (name === "getGraphState") {
      const { databaseContext, filter } = GetGraphStateArgumentsSchema.parse(args);
      
      console.error(`[${SERVICE_NAME}] Getting graph state`);
      console.error(`[${SERVICE_NAME}] Received ID: ${databaseContext.conversationId}`);
      console.error(`[${SERVICE_NAME}] Treating as artifact ID (will query all graphs to find match)`);
      console.error(`[${SERVICE_NAME}] API Base URL: ${databaseContext.apiBaseUrl}`);
      console.error(`[${SERVICE_NAME}] Filter:`, JSON.stringify(filter));
      console.error(`[${SERVICE_NAME}] Full database context:`, JSON.stringify(databaseContext, null, 2));
      
      // Treat the incoming ID as an artifact ID - query database to find the actual conversation
      // Since database doesn't store artifact IDs, we'll try the ID as-is first
      const result = await makeAPIRequest('/state', databaseContext);
      
      // If no data found, try to provide helpful error message
      if (result && result.success && (!result.data.nodes || result.data.nodes.length === 0)) {
        console.error(`[${SERVICE_NAME}] No data found for ID: ${databaseContext.conversationId}`);
        console.error(`[${SERVICE_NAME}] This might be an artifact ID instead of a conversation ID`);
        console.error(`[${SERVICE_NAME}] Database stores data by conversation ID, not artifact ID`);
      }
      
      console.error(`[${SERVICE_NAME}] API Response received:`, {
        success: result?.success,
        hasData: !!result?.data,
        nodeCount: result?.data?.nodes?.length || 0,
        edgeCount: result?.data?.edges?.length || 0,
        metadata: result?.data?.metadata
      });

      if (!result || !result.success) {
        return {
          content: [
            {
              type: "text",
              text: "Failed to retrieve graph state from the database.",
            },
          ],
        };
      }

      let graphData = result.data;

      // Apply filters if provided
      if (filter) {
        const { nodeType, edgeType, nodeIds } = filter;

        // Filter nodes
        if (nodeType || nodeIds) {
          graphData.nodes = graphData.nodes?.filter((node: any) => {
            if (nodeType && node.type !== nodeType) return false;
            if (nodeIds && nodeIds.length > 0 && !nodeIds.includes(node.id)) return false;
            return true;
          });
        }

        // Filter edges
        if (edgeType || nodeIds) {
          const validNodeIds = new Set(graphData.nodes?.map((n: any) => n.id) || []);
          graphData.edges = graphData.edges?.filter((edge: any) => {
            if (edgeType && edge.type !== edgeType) return false;
            // Only include edges where both nodes are in the filtered set
            if (nodeIds && nodeIds.length > 0) {
              if (!validNodeIds.has(edge.source) || !validNodeIds.has(edge.target)) {
                return false;
              }
            }
            return true;
          });
        }

        // Update metadata
        graphData.metadata = {
          nodeCount: graphData.nodes?.length || 0,
          edgeCount: graphData.edges?.length || 0,
          lastUpdated: graphData.metadata?.lastUpdated || new Date().toISOString(),
          filtered: true,
          appliedFilters: filter,
        };
      }

      // Format for display
      const formattedState = formatGraphStateForModel(graphData);

      return {
        content: [
          {
            type: "text",
            text: formattedState,
          },
        ],
      };

    } else {
      throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    console.error(`[${SERVICE_NAME}] Error handling tool request:`, error);
    
    if (error instanceof z.ZodError) {
      return {
        content: [
          {
            type: "text",
            text: `Invalid arguments: ${error.errors
              .map((e) => `${e.path.join(".")}: ${e.message}`)
              .join(", ")}`,
          },
        ],
      };
    }
    
    return {
      content: [
        {
          type: "text",
          text: `Error: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
    };
  }
});

// =============================================================================
// SERVER STARTUP
// =============================================================================

async function main() {
  console.error(`[${SERVICE_NAME}] Starting Graph Mode MCP Server`);
  console.error(`[${SERVICE_NAME}] Default API Base URL: ${DEFAULT_API_BASE_URL}`);
  console.error(`[${SERVICE_NAME}] Available tools: removeNode, removeEdge, getGraphState`);

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`[${SERVICE_NAME}] MCP Server running on stdio`);
}

main().catch((error) => {
  console.error(`[${SERVICE_NAME}] Fatal error in main():`, error);
  process.exit(1);
});

