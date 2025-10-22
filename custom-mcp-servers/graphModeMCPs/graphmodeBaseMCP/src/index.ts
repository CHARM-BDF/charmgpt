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

// Schema for bulk removeNodes tool
const BulkRemoveNodesArgumentsSchema = z.object({
  nodeIds: z.array(z.string()).min(1, "At least one node ID is required"),
  databaseContext: DatabaseContextSchema,
});

// Schema for bulk removeEdges tool
const BulkRemoveEdgesArgumentsSchema = z.object({
  edgeIds: z.array(z.string()).min(1, "At least one edge ID is required"),
  databaseContext: DatabaseContextSchema,
});

// Schema for removeNodesByDegree tool
const RemoveNodesByDegreeArgumentsSchema = z.object({
  databaseContext: DatabaseContextSchema,
  criteria: z.object({
    minDegree: z.number().optional().describe("Minimum number of connections (inclusive)"),
    maxDegree: z.number().optional().describe("Maximum number of connections (inclusive)"),
    exactDegree: z.number().optional().describe("Exact number of connections"),
    nodeType: z.string().optional().describe("Filter by node type (case-insensitive)"),
  }).refine(
    (criteria) => {
      // At least one degree criteria must be provided
      return criteria.minDegree !== undefined || 
             criteria.maxDegree !== undefined || 
             criteria.exactDegree !== undefined;
    },
    { message: "At least one degree criteria (minDegree, maxDegree, or exactDegree) must be provided" }
  ),
});

// Schema for bulk remove nodes by type tool
const BulkRemoveNodesByTypeArgumentsSchema = z.object({
  databaseContext: DatabaseContextSchema,
  criteria: z.object({
    nodeTypes: z.array(z.string()).optional().describe("Array of node types to delete (e.g., ['gene', 'disease'])"),
    excludeTypes: z.array(z.string()).optional().describe("Array of node types to keep (delete everything except these)"),
    preview: z.boolean().optional().default(false).describe("If true, preview what would be deleted without actually deleting"),
  }).refine(
    (criteria) => {
      // Either nodeTypes or excludeTypes must be provided, but not both
      const hasNodeTypes = criteria.nodeTypes && criteria.nodeTypes.length > 0;
      const hasExcludeTypes = criteria.excludeTypes && criteria.excludeTypes.length > 0;
      return hasNodeTypes || hasExcludeTypes;
    },
    {
      message: "Either nodeTypes or excludeTypes must be provided (but not both)"
    }
  ),
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

function calculateNodeDegrees(nodes: any[], edges: any[]): Map<string, number> {
  const degreeMap = new Map<string, number>();
  
  // Initialize all nodes with degree 0
  nodes.forEach(node => {
    degreeMap.set(node.id, 0);
  });
  
  // Count connections for each node
  edges.forEach(edge => {
    const sourceDegree = degreeMap.get(edge.source) || 0;
    const targetDegree = degreeMap.get(edge.target) || 0;
    degreeMap.set(edge.source, sourceDegree + 1);
    degreeMap.set(edge.target, targetDegree + 1);
  });
  
  return degreeMap;
}

function filterNodesByDegree(nodes: any[], edges: any[], criteria: {
  minDegree?: number;
  maxDegree?: number;
  exactDegree?: number;
  nodeType?: string;
}): any[] {
  const degreeMap = calculateNodeDegrees(nodes, edges);
  
  return nodes.filter(node => {
    const degree = degreeMap.get(node.id) || 0;
    
    // Check degree criteria
    if (criteria.exactDegree !== undefined && degree !== criteria.exactDegree) {
      return false;
    }
    if (criteria.minDegree !== undefined && degree < criteria.minDegree) {
      return false;
    }
    if (criteria.maxDegree !== undefined && degree > criteria.maxDegree) {
      return false;
    }
    
    // Check node type criteria (case-insensitive)
    if (criteria.nodeType && node.type?.toLowerCase() !== criteria.nodeType.toLowerCase()) {
      return false;
    }
    
    return true;
  });
}

function formatGraphStateForModel(graphData: any): string {
  const { nodes, edges, metadata } = graphData;
  
  // Debug: Log what we're getting
  console.error(`[${SERVICE_NAME}] formatGraphStateForModel - graphData:`, {
    hasGraphData: !!graphData,
    hasNodes: !!nodes,
    hasEdges: !!edges,
    nodeCount: nodes?.length || 0,
    edgeCount: edges?.length || 0,
    graphDataKeys: graphData ? Object.keys(graphData) : 'no graphData',
    nodesType: typeof nodes,
    edgesType: typeof edges
  });

  if (!nodes || nodes.length === 0) {
    return "The graph is currently empty (no nodes or edges).";
  }

  // Calculate node degrees
  const degreeMap = calculateNodeDegrees(nodes, edges || []);

  // Group nodes by type
  const nodesByType: Record<string, any[]> = {};
  nodes.forEach((node: any) => {
    const type = node.type || 'other';
    if (!nodesByType[type]) {
      nodesByType[type] = [];
    }
    nodesByType[type].push(node);
  });

  // Format nodes section with degree information
  const nodesSummary = Object.entries(nodesByType).map(([type, nodeList]) => {
    const nodeItems = nodeList.map((n: any) => {
      const degree = degreeMap.get(n.id) || 0;
      return `  - ${n.label} (ID: ${n.id}, ${degree} connections)`;
    }).join('\n');
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

  // Calculate degree statistics
  const degrees = Array.from(degreeMap.values());
  const minDegree = Math.min(...degrees);
  const maxDegree = Math.max(...degrees);
  const avgDegree = degrees.reduce((sum, d) => sum + d, 0) / degrees.length;

  return `# Current Graph State\n\n` +
    `**Total Nodes:** ${metadata?.nodeCount || nodes.length}\n` +
    `**Total Edges:** ${metadata?.edgeCount || (edges?.length || 0)}\n` +
    `**Last Updated:** ${metadata?.lastUpdated || 'Unknown'}\n\n` +
    `## Node Statistics\n\n` +
    `- **Degree Range:** ${minDegree} - ${maxDegree} connections\n` +
    `- **Average Degree:** ${avgDegree.toFixed(1)} connections\n\n` +
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
                  description: "Filter nodes by type (case-insensitive, e.g., 'gene', 'Gene', 'GENE' all work)",
                },
                edgeType: {
                  type: "string",
                  description: "Filter edges by type (case-insensitive, e.g., 'inhibits', 'Inhibits', 'INHIBITS' all work)",
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
      {
        name: "bulkRemoveNodes",
        description: "Remove multiple nodes from the knowledge graph in a single operation. " +
          "This is much faster than calling removeNode multiple times. " +
          "All edges connected to these nodes will also be removed. " +
          "Use this when you need to delete many nodes at once.",
        inputSchema: {
          type: "object",
          properties: {
            nodeIds: {
              type: "array",
              items: { type: "string" },
              description: "Array of node IDs to remove",
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
          required: ["nodeIds", "databaseContext"],
        },
      },
      {
        name: "bulkRemoveEdges",
        description: "Remove multiple edges from the knowledge graph in a single operation. " +
          "This is much faster than calling removeEdge multiple times. " +
          "Use this when you need to delete many edges at once.",
        inputSchema: {
          type: "object",
          properties: {
            edgeIds: {
              type: "array",
              items: { type: "string" },
              description: "Array of edge IDs to remove",
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
          required: ["edgeIds", "databaseContext"],
        },
      },
      {
        name: "removeNodesByDegree",
        description: "Remove nodes based on their number of connections (degree) in the graph. " +
          "Use this to clean up isolated nodes, highly connected nodes, or nodes with specific connection patterns. " +
          "Supports filtering by degree range, exact degree, and node type. " +
          "Uses batch processing for fast removal of multiple nodes.",
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
            criteria: {
              type: "object",
              properties: {
                minDegree: {
                  type: "number",
                  description: "Minimum number of connections (inclusive)",
                },
                maxDegree: {
                  type: "number", 
                  description: "Maximum number of connections (inclusive)",
                },
                exactDegree: {
                  type: "number",
                  description: "Exact number of connections",
                },
                nodeType: {
                  type: "string",
                  description: "Filter by node type (case-insensitive, e.g., 'gene', 'disease')",
                },
              },
            },
          },
          required: ["databaseContext", "criteria"],
        },
      },
      {
        name: "bulkRemoveNodesByType",
        description: "Efficiently remove multiple nodes based on their type or exclusion criteria. " +
          "This is much faster than calling removeNode multiple times. " +
          "Supports two modes: 1) Delete specific node types, or 2) Delete everything except specified types. " +
          "Type matching is case-insensitive (e.g., 'Gene', 'gene', 'GENE' all match). " +
          "Use this for bulk cleanup operations like 'remove all diseases' or 'keep only genes and proteins'.",
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
            criteria: {
              type: "object",
              properties: {
                nodeTypes: {
                  type: "array",
                  items: { type: "string" },
                  description: "Array of node types to delete (e.g., ['gene', 'disease']). Case-insensitive matching.",
                },
                excludeTypes: {
                  type: "array",
                  items: { type: "string" },
                  description: "Array of node types to keep (delete everything except these). Case-insensitive matching.",
                },
                preview: {
                  type: "boolean",
                  description: "If true, preview what would be deleted without actually deleting",
                  default: false,
                },
              },
              required: [],
            },
          },
          required: ["databaseContext", "criteria"],
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
        refreshGraph: true  // NEW: Signal UI to refresh
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
        refreshGraph: true  // NEW: Signal UI to refresh
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
      
      // Debug: Log the actual data structure
      console.error(`[${SERVICE_NAME}] Debug - result.data structure:`, {
        hasData: !!result.data,
        hasNodes: !!result.data?.nodes,
        hasEdges: !!result.data?.edges,
        nodeCount: result.data?.nodes?.length || 0,
        edgeCount: result.data?.edges?.length || 0,
        dataKeys: result.data ? Object.keys(result.data) : 'no data',
        firstNode: result.data?.nodes?.[0] || 'no nodes'
      });

      // Apply filters if provided
      if (filter) {
        const { nodeType, edgeType, nodeIds } = filter;

        // Filter nodes
        if (nodeType || nodeIds) {
          graphData.nodes = graphData.nodes?.filter((node: any) => {
            if (nodeType && node.type?.toLowerCase() !== nodeType.toLowerCase()) return false;
            if (nodeIds && nodeIds.length > 0 && !nodeIds.includes(node.id)) return false;
            return true;
          });
        }

        // Filter edges
        if (edgeType || nodeIds) {
          const validNodeIds = new Set(graphData.nodes?.map((n: any) => n.id) || []);
          graphData.edges = graphData.edges?.filter((edge: any) => {
            if (edgeType && edge.type?.toLowerCase() !== edgeType.toLowerCase()) return false;
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

    } else if (name === "bulkRemoveNodes") {
      const { nodeIds, databaseContext } = BulkRemoveNodesArgumentsSchema.parse(args);
      
      console.error(`[${SERVICE_NAME}] Bulk removing ${nodeIds.length} nodes`);
      console.error(`[${SERVICE_NAME}] Conversation ID: ${databaseContext.conversationId}`);
      
      // Get node details for response message
      let nodeLabels: string[] = [];
      try {
        const graphState = await makeAPIRequest('/state', databaseContext);
        nodeLabels = nodeIds.map(nodeId => {
          const node = graphState.data?.nodes?.find((n: any) => n.id === nodeId);
          return node ? (node.label || nodeId) : nodeId;
        });
      } catch (error) {
        console.error(`[${SERVICE_NAME}] Could not fetch node details, using IDs as labels`);
        nodeLabels = nodeIds;
      }
      
      // Delete nodes in parallel for speed with rate limiting
      const batchSize = 5;
      const batches = [];
      for (let i = 0; i < nodeIds.length; i += batchSize) {
        batches.push(nodeIds.slice(i, i + batchSize));
      }
      
      const allResults = [];
      for (const batch of batches) {
        const batchPromises = batch.map(nodeId => 
          makeAPIRequest(
            `/nodes/${encodeURIComponent(nodeId)}`,
            databaseContext,
            { method: 'DELETE' }
          )
        );
        
        const batchResults = await Promise.allSettled(batchPromises);
        allResults.push(...batchResults);
        
        // Small delay between batches
        if (batches.indexOf(batch) < batches.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      
      const results = allResults;
      
      // Count successes and failures
      const successful = results.filter(r => r.status === 'fulfilled' && r.value?.success).length;
      const failed = results.length - successful;
      
      return {
        content: [
          {
            type: "text",
            text: `Bulk removal completed: ${successful} nodes removed successfully, ${failed} failed. ` +
                  `Removed nodes: ${nodeLabels.slice(0, 5).join(', ')}${nodeLabels.length > 5 ? '...' : ''}`,
          },
        ],
        refreshGraph: true
      };

    } else if (name === "bulkRemoveEdges") {
      const { edgeIds, databaseContext } = BulkRemoveEdgesArgumentsSchema.parse(args);
      
      console.error(`[${SERVICE_NAME}] Bulk removing ${edgeIds.length} edges`);
      console.error(`[${SERVICE_NAME}] Conversation ID: ${databaseContext.conversationId}`);
      
      // Get edge details for response message
      let edgeDescriptions: string[] = [];
      try {
        const graphState = await makeAPIRequest('/state', databaseContext);
        edgeDescriptions = edgeIds.map(edgeId => {
          const edge = graphState.data?.edges?.find((e: any) => e.id === edgeId);
          if (edge) {
            const nodes = graphState.data?.nodes || [];
            const sourceNode = nodes.find((n: any) => n.id === edge.source);
            const targetNode = nodes.find((n: any) => n.id === edge.target);
            return `${sourceNode?.label || edge.source} → ${targetNode?.label || edge.target}`;
          }
          return edgeId;
        });
      } catch (error) {
        console.error(`[${SERVICE_NAME}] Could not fetch edge details, using IDs`);
        edgeDescriptions = edgeIds;
      }
      
      // Delete edges in parallel for speed
      const deletePromises = edgeIds.map(edgeId => 
        makeAPIRequest(
          `/edges/${encodeURIComponent(edgeId)}`,
          databaseContext,
          { method: 'DELETE' }
        )
      );
      
      const results = await Promise.allSettled(deletePromises);
      
      // Count successes and failures
      const successful = results.filter(r => r.status === 'fulfilled' && r.value?.success).length;
      const failed = results.length - successful;
      
      return {
        content: [
          {
            type: "text",
            text: `Bulk edge removal completed: ${successful} edges removed successfully, ${failed} failed. ` +
                  `Removed edges: ${edgeDescriptions.slice(0, 3).join(', ')}${edgeDescriptions.length > 3 ? '...' : ''}`,
          },
        ],
        refreshGraph: true
      };

    } else if (name === "removeNodesByDegree") {
      const { databaseContext, criteria } = RemoveNodesByDegreeArgumentsSchema.parse(args);
      
      console.error(`[${SERVICE_NAME}] Removing nodes by degree criteria`);
      console.error(`[${SERVICE_NAME}] Conversation ID: ${databaseContext.conversationId}`);
      console.error(`[${SERVICE_NAME}] Criteria:`, JSON.stringify(criteria, null, 2));
      
      // Get current graph state
      const result = await makeAPIRequest('/state', databaseContext);
      
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
      
      const { nodes, edges } = result.data;
      
      if (!nodes || nodes.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: "The graph is empty - no nodes to remove.",
            },
          ],
        };
      }
      
      // Filter nodes by degree criteria
      const nodesToRemove = filterNodesByDegree(nodes, edges || [], criteria);
      
      if (nodesToRemove.length === 0) {
        const degreeMap = calculateNodeDegrees(nodes, edges || []);
        const degreeSummary = Array.from(degreeMap.entries())
          .map(([id, degree]) => {
            const node = nodes.find((n: any) => n.id === id);
            return `${node?.label || id}: ${degree} connections`;
          })
          .slice(0, 5)
          .join(', ');
        
        return {
          content: [
            {
              type: "text",
              text: `No nodes found matching the degree criteria. ` +
                    `Current node degrees: ${degreeSummary}${degreeMap.size > 5 ? '...' : ''}`,
            },
          ],
        };
      }
      
      // Get node labels for response
      const nodeLabels = nodesToRemove.map(node => node.label || node.id);
      
      // Remove nodes in parallel using bulk removal with rate limiting
      const nodeIds = nodesToRemove.map(node => node.id);
      
      // Process in batches of 5 to avoid overwhelming the backend
      const batchSize = 5;
      const batches = [];
      for (let i = 0; i < nodeIds.length; i += batchSize) {
        batches.push(nodeIds.slice(i, i + batchSize));
      }
      
      const allResults = [];
      for (const batch of batches) {
        const batchPromises = batch.map(nodeId => 
          makeAPIRequest(
            `/nodes/${encodeURIComponent(nodeId)}`,
            databaseContext,
            { method: 'DELETE' }
          )
        );
        
        const batchResults = await Promise.allSettled(batchPromises);
        allResults.push(...batchResults);
        
        // Small delay between batches to prevent overwhelming the backend
        if (batches.indexOf(batch) < batches.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      
      const results = allResults;
      
      // Count successes and failures
      const successful = results.filter(r => r.status === 'fulfilled' && r.value?.success).length;
      const failed = results.length - successful;
      
      // Create criteria description for response
      const criteriaDesc = [];
      if (criteria.exactDegree !== undefined) {
        criteriaDesc.push(`exactly ${criteria.exactDegree} connections`);
      } else {
        if (criteria.minDegree !== undefined) criteriaDesc.push(`≥${criteria.minDegree} connections`);
        if (criteria.maxDegree !== undefined) criteriaDesc.push(`≤${criteria.maxDegree} connections`);
      }
      if (criteria.nodeType) {
        criteriaDesc.push(`type '${criteria.nodeType}'`);
      }
      
      return {
        content: [
          {
            type: "text",
            text: `Degree-based removal completed: ${successful} nodes removed successfully, ${failed} failed. ` +
                  `Criteria: ${criteriaDesc.join(' and ')}. ` +
                  `Removed nodes: ${nodeLabels.slice(0, 5).join(', ')}${nodeLabels.length > 5 ? '...' : ''}`,
          },
        ],
        refreshGraph: true
      };

    } else if (name === "bulkRemoveNodesByType") {
      const { databaseContext, criteria } = BulkRemoveNodesByTypeArgumentsSchema.parse(args);
      
      console.error(`[${SERVICE_NAME}] Bulk removing nodes by type`);
      console.error(`[${SERVICE_NAME}] Conversation ID: ${databaseContext.conversationId}`);
      console.error(`[${SERVICE_NAME}] Criteria:`, JSON.stringify(criteria, null, 2));
      
      // Make API call to backend
      const result = await makeAPIRequest(
        '/nodes/by-type',
        databaseContext,
        { 
          method: 'DELETE',
          body: JSON.stringify({
            nodeTypes: criteria.nodeTypes,
            excludeTypes: criteria.excludeTypes,
            preview: criteria.preview
          })
        }
      );
      
      if (!result || !result.success) {
        return {
          content: [
            {
              type: "text",
              text: `Failed to bulk remove nodes by type: ${result?.error || 'Unknown error'}`,
            },
          ],
        };
      }
      
      if (criteria.preview) {
        // Preview mode - show what would be deleted
        const nodesToDelete = result.data?.nodesToDelete || [];
        const count = result.data?.count || 0;
        
        if (count === 0) {
          return {
            content: [
              {
                type: "text",
                text: "No nodes found matching the specified criteria.",
              },
            ],
          };
        }
        
        const nodeList = nodesToDelete.slice(0, 10).map((node: any) => 
          `${node.label} (${node.type})`
        ).join(', ');
        const moreText = count > 10 ? ` and ${count - 10} more...` : '';
        
        const criteriaDesc = criteria.nodeTypes && criteria.nodeTypes.length > 0 
          ? `types: ${criteria.nodeTypes.join(', ')}`
          : `exclude types: ${criteria.excludeTypes?.join(', ') || 'none'}`;
        
        return {
          content: [
            {
              type: "text",
              text: `Preview: Would delete ${count} nodes matching criteria (${criteriaDesc}).\n\n` +
                    `Sample nodes: ${nodeList}${moreText}\n\n` +
                    `Set preview: false to perform the actual deletion.`,
            },
          ],
        };
      } else {
        // Actual deletion
        const deletedCount = result.data?.deletedCount || 0;
        const criteriaDesc = criteria.nodeTypes && criteria.nodeTypes.length > 0 
          ? `types: ${criteria.nodeTypes.join(', ')}`
          : `exclude types: ${criteria.excludeTypes?.join(', ') || 'none'}`;
        
        return {
          content: [
            {
              type: "text",
              text: `Bulk removal completed: ${deletedCount} nodes removed successfully. ` +
                    `Criteria: ${criteriaDesc}`,
            },
          ],
          refreshGraph: true
        };
      }

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
  console.error(`[${SERVICE_NAME}] Available tools: removeNode, removeEdge, getGraphState, bulkRemoveNodes, bulkRemoveEdges, removeNodesByDegree, bulkRemoveNodesByType`);

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`[${SERVICE_NAME}] MCP Server running on stdio`);
}

main().catch((error) => {
  console.error(`[${SERVICE_NAME}] Fatal error in main():`, error);
  process.exit(1);
});

