import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

const SERVICE_NAME = "graphmode-gene-add-mcp";
const TOOL_NAME = "Graph Mode Gene Addition MCP";
const DEFAULT_API_BASE_URL = process.env.API_BASE_URL || "http://localhost:5001";
const ARAX_API_URL = "https://arax.ncats.io/api/arax/v1.4/entity";

// Database context schema (matches graphmodeBaseMCP pattern)
const DatabaseContextSchema = z.object({
  conversationId: z.string().min(1, "conversationId is required"),
  apiBaseUrl: z.string().url().optional(),
  accessToken: z.string().optional(),
});

// Tool argument schema
const AddGeneNodesArgumentsSchema = z.object({
  geneNames: z.union([
    z.string(),
    z.array(z.string())
  ]).describe("Single gene symbol or array of gene symbols"),
  databaseContext: DatabaseContextSchema,
});

// API request helper for Graph Mode operations
async function makeAPIRequest(
  endpoint: string, 
  context: { conversationId: string; apiBaseUrl?: string; accessToken?: string },
  options: RequestInit = {}
): Promise<any> {
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

  const response = await fetch(url, {
    ...options,
    headers: { ...headers, ...options.headers },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[${SERVICE_NAME}] HTTP error! status: ${response.status}, body: ${errorText}`);
    throw new Error(`HTTP error! status: ${response.status} - ${response.statusText}`);
  }

  return await response.json();
}

// ARAX API Query Function
async function queryAraxApi(geneSymbols: string[]): Promise<any> {
  console.error(`[${SERVICE_NAME}] Querying ARAX API for genes: ${geneSymbols.join(', ')}`);
  
  const response = await fetch(ARAX_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': '*/*',
    },
    body: JSON.stringify({ terms: geneSymbols })
  });

  if (!response.ok) {
    console.error(`[${SERVICE_NAME}] ARAX API error! status: ${response.status}`);
    throw new Error(`ARAX API error! status: ${response.status}`);
  }

  const data = await response.json();
  console.error(`[${SERVICE_NAME}] ARAX API returned data for ${Object.keys(data).length} terms`);
  return data;
}

// Create server instance
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

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "addGeneNodes",
        description: "Add one or more gene nodes to a Graph Mode conversation. " +
          "FIRST CHOICE for adding genes by symbol. Uses ARAX API to normalize gene names to CURIEs. " +
          "Supports bulk addition of multiple genes at once. Only works with genes.",
        inputSchema: {
          type: "object",
          properties: {
            geneNames: {
              oneOf: [
                { type: "string", description: "Single gene symbol (e.g., 'JUND')" },
                { 
                  type: "array", 
                  items: { type: "string" },
                  description: "Array of gene symbols (e.g., ['JUND', 'FOS', 'PON1'])"
                }
              ],
              description: "Gene symbol(s) to add to the graph"
            },
            databaseContext: {
              type: "object",
              properties: {
                conversationId: { type: "string" },
                apiBaseUrl: { type: "string" },
                accessToken: { type: "string" }
              },
              required: ["conversationId"],
              description: "Graph Mode database context (auto-injected by backend)"
            }
          },
          required: ["geneNames", "databaseContext"]
        }
      }
    ]
  };
});

// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    const { name, arguments: args } = request.params;
    
    if (name === "addGeneNodes") {
      const { geneNames, databaseContext } = AddGeneNodesArgumentsSchema.parse(args);
      
      // Convert to array
      const geneArray = Array.isArray(geneNames) ? geneNames : [geneNames];
      
      console.error(`[${SERVICE_NAME}] Adding gene nodes: ${geneArray.join(', ')}`);
      console.error(`[${SERVICE_NAME}] Conversation ID: ${databaseContext.conversationId}`);
      
      // Query ARAX API
      const araxResponse = await queryAraxApi(geneArray);
      
      // Extract gene data and filter for genes only
      const geneData = Object.entries(araxResponse)
        .filter(([_, data]: [string, any]) => 
          data?.id?.SRI_normalizer_category === 'biolink:Gene'
        )
        .map(([input, data]: [string, any]) => ({
          input,
          curie: data.id.SRI_normalizer_curie,
          name: data.id.SRI_normalizer_name,
          category: data.id.SRI_normalizer_category
        }));
      
      console.error(`[${SERVICE_NAME}] Found ${geneData.length} valid genes out of ${geneArray.length} input terms`);
      
      if (geneData.length === 0) {
        return {
          content: [{
            type: "text",
            text: `No valid gene identifiers found for: ${geneArray.join(', ')}`
          }]
        };
      }
      
      // Add each gene to graph (following graphmodeBaseMCP pattern)
      const results = [];
      for (const gene of geneData) {
        try {
          const nodeDataForGraph = {
            id: gene.curie,
            label: gene.name,
            type: "Gene",
            data: JSON.stringify({
              categories: [gene.category],
              originalId: gene.curie,
              source: "graphmode-gene-add-mcp",
              description: `${gene.name} gene`
            }),
            position: JSON.stringify({ x: 0, y: 0 })
          };
          
          console.error(`[${SERVICE_NAME}] Adding gene: ${gene.name} (${gene.curie})`);
          
          const addResult = await makeAPIRequest('/nodes', databaseContext, {
            method: 'POST',
            body: JSON.stringify(nodeDataForGraph)
          });
          
          if (addResult?.success) {
            results.push({ success: true, gene });
            console.error(`[${SERVICE_NAME}] Successfully added gene: ${gene.name}`);
          } else {
            results.push({ success: false, gene, error: addResult?.error || 'Unknown error' });
            console.error(`[${SERVICE_NAME}] Failed to add gene: ${gene.name}, error: ${addResult?.error}`);
          }
        } catch (error) {
          results.push({ success: false, gene, error: String(error) });
          console.error(`[${SERVICE_NAME}] Error adding gene ${gene.name}:`, error);
        }
      }
      
      // Build response message
      const successful = results.filter(r => r.success);
      const failed = results.filter(r => !r.success);
      
      let responseText = '';
      if (successful.length > 0) {
        responseText += `✅ Added ${successful.length} gene node${successful.length > 1 ? 's' : ''} to the graph:\n\n`;
        successful.forEach(r => {
          responseText += `- **${r.gene.name}** (${r.gene.curie})\n`;
        });
      }
      
      if (failed.length > 0) {
        if (successful.length > 0) responseText += '\n';
        responseText += `⚠️ Failed to add ${failed.length} gene${failed.length > 1 ? 's' : ''}:\n`;
        failed.forEach(r => {
          responseText += `- ${r.gene.name}: ${r.error}\n`;
        });
      }
      
      // Check for genes not found by ARAX
      const foundInputs = geneData.map(g => g.input.toLowerCase());
      const notFound = geneArray.filter(name => !foundInputs.includes(name.toLowerCase()));
      if (notFound.length > 0) {
        responseText += `\n⚠️ No identifiers found for: ${notFound.join(', ')}`;
      }
      
      return {
        content: [{ type: "text", text: responseText }],
        refreshGraph: true
      };
    }
    
    throw new Error(`Unknown tool: ${name}`);
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

// Start the server
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
