import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

// =============================================================================
// CONFIGURATION SECTION - SmartAPI Configuration
// =============================================================================

// SmartAPI Configuration
const SMARTAPI_REGISTRY_URL = "https://smart-api.info/api";
const SMARTAPI_BASE_URL = "https://smart-api.info/ui"; // For UI links
const TOOL_NAME = "smart-api-mcp";
const SERVICE_NAME = "smart-api";

// Environment variables (none required for public SmartAPI registry)
const USER_EMAIL = process.env.USER_EMAIL || 'anonymous@example.com';

// =============================================================================
// SCHEMA DEFINITIONS - SmartAPI Tool Input Schemas
// =============================================================================

// SmartAPI Search Schema
const SmartAPISearchSchema = z.object({
  query: z.string().min(1, "Search query cannot be empty"),
  domain: z.enum(['translator', 'biothings', 'clinical', 'genomics', 'proteomics']).optional().default('translator'),
  component_type: z.enum(['KP', 'ARA', 'TRAPI', 'BTE']).optional(),
  max_results: z.number().min(1).max(100).optional().default(20),
  include_metadata: z.boolean().optional().default(true),
  tags: z.array(z.string()).optional(), // e.g., ['trapi', 'biolink']
});

// SmartAPI API Details Schema
const SmartAPIDetailsSchema = z.object({
  api_id: z.string().min(1, "API ID cannot be empty"),
  include_spec: z.boolean().optional().default(false),
  include_examples: z.boolean().optional().default(true),
});

// SmartAPI Registry Query Schema
const SmartAPIRegistrySchema = z.object({
  registry_query: z.string().min(1, "Registry query cannot be empty"),
  size: z.number().min(1).max(1000).optional().default(100),
  sort: z.enum(['_seq_no', 'title', 'version']).optional().default('_seq_no'),
  fields: z.string().optional(), // Comma-separated field list
});

// SmartAPI MetaKG Schema
const SmartAPIMetaKGSchema = z.object({
  subject: z.string().optional(),
  object: z.string().optional(),
  predicate: z.string().optional(),
  expand: z.array(z.enum(['subject', 'object', 'predicate', 'node', 'edge', 'all'])).optional(),
  api_details: z.boolean().optional().default(false),
  size: z.number().min(1).max(1000).optional().default(10),
  format: z.enum(['json', 'yaml', 'html', 'msgpack', 'graphml']).optional().default('json'),
});

// =============================================================================
// API REQUEST HELPERS
// =============================================================================

async function makeSmartAPIRequest(endpoint: string, params: Record<string, any> = {}): Promise<any> {
  const url = new URL(`${SMARTAPI_REGISTRY_URL}${endpoint}`);
  
  // Add query parameters
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      url.searchParams.append(key, value.toString());
    }
  });

  const headers: Record<string, string> = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'User-Agent': `${SERVICE_NAME}-mcp/1.0.0`,
  };

  console.log(`[${SERVICE_NAME}] Making SmartAPI request to: ${url.toString()}`);

  try {
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      throw new Error(`SmartAPI request failed: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`[${SERVICE_NAME}] SmartAPI request error:`, error);
    throw error;
  }
}

// =============================================================================
// DATA FORMATTING FUNCTIONS
// =============================================================================

// Format SmartAPI record for Claude consumption
function formatSmartAPIRecordForModel(record: any): string {
  const info = record.info || {};
  const meta = record._meta || {};
  
  return [
    `**API Title:** ${info.title || 'Unknown'}`,
    `**Version:** ${info.version || 'Unknown'}`,
    `**Description:** ${info.description || 'No description available'}`,
    `**Contact:** ${info.contact?.name || 'Unknown'} (${info.contact?.email || 'No email'})`,
    `**Terms of Service:** ${info.termsOfService || 'Not specified'}`,
    `**API ID:** ${meta._id || 'Unknown'}`,
    `**SmartAPI UI:** ${SMARTAPI_BASE_URL}/${meta._id || ''}`,
    `**Tags:** ${record.tags?.map((tag: any) => tag.name).join(', ') || 'None'}`,
    `**Servers:** ${record.servers?.map((s: any) => s.url).join(', ') || 'None'}`,
    `**Paths:** ${Object.keys(record.paths || {}).length} endpoints available`,
    "---"
  ].filter(Boolean).join("\n");
}

// Helper function to generate markdown table from associations data
function generateAssociationsTable(associations: any[]): string {
  if (!associations || associations.length === 0) {
    return "No associations found.";
  }

  // Create table header
  let table = "| Subject | Object | Predicate | API Name | SmartAPI ID |\n";
  table += "|---------|--------|-----------|----------|-------------|\n";

  // Add table rows
  associations.forEach((assoc: any) => {
    const subject = assoc.subject || 'Unknown';
    const object = assoc.object || 'Unknown';
    const predicate = assoc.predicate || 'Unknown';
    
    // Handle multiple APIs for the same association
    if (assoc.api && assoc.api.length > 0) {
      assoc.api.forEach((apiItem: any) => {
        const apiName = apiItem.api?.name || 'Unknown';
        const smartApiId = apiItem.api?.smartapi?.id || 'Unknown';
        const smartApiUi = apiItem.api?.smartapi?.ui || `https://smart-api.info/ui/${smartApiId}`;
        
        // Create clickable link for SmartAPI ID
        const smartApiLink = smartApiId !== 'Unknown' ? `[${smartApiId}](${smartApiUi})` : 'Unknown';
        
        // Show complete data in every row
        table += `| ${subject} | ${object} | ${predicate} | ${apiName} | ${smartApiLink} |\n`;
      });
    } else {
      table += `| ${subject} | ${object} | ${predicate} | Unknown | Unknown |\n`;
    }
  });

  return table;
}

// Format SmartAPI data for artifacts
function formatSmartAPIArtifactData(records: any[]): any {
  return {
    summary: {
      total_apis: records.length,
      domains: [...new Set(records.map(r => r.info?.title?.toLowerCase().includes('translator') ? 'translator' : 'other'))],
      components: [...new Set(records.flatMap(r => r.tags?.map((t: any) => t.name) || []))],
      latest_version: Math.max(...records.map(r => parseFloat(r.info?.version || '0'))),
    },
    apis: records.map(record => ({
      id: record._meta?._id,
      title: record.info?.title,
      version: record.info?.version,
      description: record.info?.description,
      contact: record.info?.contact,
      servers: record.servers,
      paths: Object.keys(record.paths || {}),
      tags: record.tags?.map((tag: any) => tag.name) || [],
      smartapi_ui: `${SMARTAPI_BASE_URL}/${record._meta?._id}`,
      translator_info: record.info?.['x-translator'] || null,
    }))
  };
}

// =============================================================================
// QUERY BUILDING FUNCTIONS
// =============================================================================

// Build SmartAPI registry query
function buildSmartAPIQuery(searchParams: any): string {
  const { query, domain, component_type, tags } = searchParams;
  
  let smartapiQuery = '';
  
  // Base query
  if (query) {
    smartapiQuery += `q=${encodeURIComponent(query)}`;
  }
  
  // Domain-specific filtering
  if (domain === 'translator') {
    smartapiQuery += (smartapiQuery ? ' AND ' : '') + 'tags.name:translator';
  }
  
  // Component type filtering
  if (component_type) {
    smartapiQuery += (smartapiQuery ? ' AND ' : '') + `tags.name:${component_type.toLowerCase()}`;
  }
  
  // Additional tags
  if (tags && tags.length > 0) {
    const tagQuery = tags.map((tag: string) => `tags.name:${tag}`).join(' AND ');
    smartapiQuery += (smartapiQuery ? ' AND ' : '') + tagQuery;
  }
  
  return smartapiQuery;
}

// Build SmartAPI registry parameters
function buildSmartAPIParams(searchParams: any): Record<string, any> {
  const { max_results, include_metadata } = searchParams;
  
  const params: Record<string, any> = {
    size: max_results || 20,
    sort: '_seq_no',
    raw: 1,
  };
  
  // Include specific fields for metadata
  if (include_metadata) {
    params.fields = 'paths,servers,tags,components.x-bte*,info,_meta';
  }
  
  return params;
}

// =============================================================================
// MCP SERVER SETUP
// =============================================================================

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
const tools = [
  {
    name: "search-smartapi-apis",
    description: "Search the SmartAPI registry for biomedical APIs that match your criteria. Supports filtering by domain (translator, biothings, clinical, genomics, proteomics), component type (KP, ARA, TRAPI, BTE), and tags.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search query to find relevant APIs (e.g., 'protein', 'drug', 'disease')"
        },
        domain: {
          type: "string",
          enum: ["translator", "biothings", "clinical", "genomics", "proteomics"],
          description: "Biomedical domain to focus the search"
        },
        component_type: {
          type: "string",
          enum: ["KP", "ARA", "TRAPI", "BTE"],
          description: "Type of component (Knowledge Provider, Autonomous Relay Agent, etc.)"
        },
        max_results: {
          type: "number",
          minimum: 1,
          maximum: 100,
          default: 20,
          description: "Maximum number of APIs to return"
        },
        tags: {
          type: "array",
          items: { type: "string" },
          description: "Additional tags to filter by (e.g., ['trapi', 'biolink'])"
        }
      },
      required: ["query"]
    }
  },
  {
    name: "get-smartapi-details",
    description: "Get detailed information about a specific SmartAPI-registered API, including its OpenAPI specification, endpoints, and metadata.",
    inputSchema: {
      type: "object",
      properties: {
        api_id: {
          type: "string",
          description: "The SmartAPI ID of the API to get details for"
        },
        include_spec: {
          type: "boolean",
          default: false,
          description: "Whether to include the full OpenAPI specification"
        },
        include_examples: {
          type: "boolean",
          default: true,
          description: "Whether to include example requests and responses"
        }
      },
      required: ["api_id"]
    }
  },
  {
    name: "query-smartapi-registry",
    description: "Execute advanced queries against the SmartAPI registry using SmartAPI's native query syntax. Useful for complex filtering and discovery.",
    inputSchema: {
      type: "object",
      properties: {
        registry_query: {
          type: "string",
          description: "SmartAPI registry query string (e.g., 'tags.name:translator AND tags.name:trapi')"
        },
        size: {
          type: "number",
          minimum: 1,
          maximum: 1000,
          default: 100,
          description: "Number of results to return"
        },
        sort: {
          type: "string",
          enum: ["_seq_no", "title", "version"],
          default: "_seq_no",
          description: "Sort order for results"
        },
        fields: {
          type: "string",
          description: "Comma-separated list of fields to include in response"
        }
      },
      required: ["registry_query"]
    }
  },
  {
    name: "get-smartapi-metakg",
    description: "Get the SmartAPI Meta Knowledge Graph showing associations between different biomedical entities and the APIs that provide them.",
    inputSchema: {
      type: "object",
      properties: {
        subject: {
          type: "string",
          description: "Subject type of the metakg edge (e.g., 'Gene', 'Protein', 'Disease')"
        },
        object: {
          type: "string",
          description: "Object type of the metakg edge (e.g., 'Molecular Activity', 'Clinical Finding')"
        },
        predicate: {
          type: "string",
          description: "Predicate type of the metakg edge (e.g., 'physically_interacts_with')"
        },
        expand: {
          type: "array",
          items: { 
            type: "string",
            enum: ["subject", "object", "predicate", "node", "edge", "all"]
          },
          description: "Expand query to include additional query nodes or edges"
        },
        api_details: {
          type: "boolean",
          default: false,
          description: "Include API details in the response"
        },
        size: {
          type: "number",
          minimum: 1,
          maximum: 1000,
          default: 10,
          description: "Maximum number of associations to return"
        },
        format: {
          type: "string",
          enum: ["json", "yaml", "html", "msgpack", "graphml"],
          default: "json",
          description: "Response format"
        }
      }
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
    if (name === "search-smartapi-apis") {
      const searchParams = SmartAPISearchSchema.parse(args);
      const query = buildSmartAPIQuery(searchParams);
      const params = buildSmartAPIParams(searchParams);
      
      console.log(`[${SERVICE_NAME}] Searching SmartAPI with query: ${query}`);
      
      const searchData = await makeSmartAPIRequest(`/query/?q=${encodeURIComponent(query)}`, params);
      const records = searchData.hits || [];
      
      console.log(`[${SERVICE_NAME}] Found ${records.length} SmartAPI records`);
      
      if (records.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: `No SmartAPI-registered APIs found matching your criteria: "${searchParams.query}"`
            }
          ]
        };
      }

      const formattedRecords = records.map(formatSmartAPIRecordForModel).join("\n");
      const artifactData = formatSmartAPIArtifactData(records);

      return {
        content: [
          {
            type: "text",
            text: `# SmartAPI Search Results

Found ${records.length} biomedical APIs matching your criteria: "${searchParams.query}"

## Instructions for Using This Data
When working with these APIs:
1. **Check the SmartAPI UI links** for interactive documentation
2. **Review the contact information** for support and questions
3. **Examine the available endpoints** to understand capabilities
4. **Consider the tags** to understand the API's domain and purpose
5. **Verify the terms of service** before integration

${formattedRecords}

## Summary
- **Total APIs found:** ${records.length}
- **Domains represented:** ${artifactData.summary.domains.join(', ')}
- **Component types:** ${artifactData.summary.components.join(', ')}
- **Latest version:** ${artifactData.summary.latest_version}`
          }
        ],
        artifacts: [
          {
            type: "application/json",
            title: "SmartAPI Search Results",
            name: "smartapi_search_results.json",
            content: artifactData
          }
        ]
      };
    }

    if (name === "get-smartapi-details") {
      const detailsParams = SmartAPIDetailsSchema.parse(args);
      
      console.log(`[${SERVICE_NAME}] Getting SmartAPI details for: ${detailsParams.api_id}`);
      
      const apiData = await makeSmartAPIRequest(`/metadata/${detailsParams.api_id}`);
      
      if (!apiData) {
        return {
          content: [
            {
              type: "text",
              text: `SmartAPI with ID "${detailsParams.api_id}" not found. Please check the API ID and try again.`
            }
          ]
        };
      }

      const formattedDetails = formatSmartAPIRecordForModel(apiData);
      const artifactData = {
        api_info: apiData.info,
        servers: apiData.servers,
        paths: apiData.paths,
        components: apiData.components,
        tags: apiData.tags,
        meta: apiData._meta,
        full_spec: detailsParams.include_spec ? apiData : null
      };

      return {
        content: [
          {
            type: "text",
            text: `# SmartAPI Details: ${apiData.info?.title || 'Unknown'}

${formattedDetails}

## API Specification
- **OpenAPI Version:** ${apiData.openapi || 'Unknown'}
- **Available Endpoints:** ${Object.keys(apiData.paths || {}).length}
- **Server URLs:** ${apiData.servers?.map((s: any) => s.url).join(', ') || 'None'}

## Next Steps
1. **Review the API documentation** using the SmartAPI UI link above
2. **Test the endpoints** using the provided server URLs
3. **Check authentication requirements** in the API specification
4. **Consider rate limits** and terms of service before integration`
          }
        ],
        artifacts: [
          {
            type: "application/json",
            title: `SmartAPI Details - ${apiData.info?.title}`,
            name: `smartapi_details_${detailsParams.api_id}.json`,
            content: artifactData
          }
        ]
      };
    }

    if (name === "query-smartapi-registry") {
      const registryParams = SmartAPIRegistrySchema.parse(args);
      
      console.log(`[${SERVICE_NAME}] Executing SmartAPI registry query: ${registryParams.registry_query}`);
      
      const queryData = await makeSmartAPIRequest(`/query/?q=${encodeURIComponent(registryParams.registry_query)}`, {
        size: registryParams.size,
        sort: registryParams.sort,
        fields: registryParams.fields,
        raw: 1
      });
      
      const records = queryData.hits || [];
      
      if (records.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: `No results found for SmartAPI registry query: "${registryParams.registry_query}"`
            }
          ]
        };
      }

      const formattedRecords = records.map(formatSmartAPIRecordForModel).join("\n");
      const artifactData = formatSmartAPIArtifactData(records);

      return {
        content: [
          {
            type: "text",
            text: `# SmartAPI Registry Query Results

Query: "${registryParams.registry_query}"
Results: ${records.length} APIs found

${formattedRecords}

## Query Analysis
This advanced query returned ${records.length} APIs from the SmartAPI registry. Use the SmartAPI UI links to explore each API's capabilities and documentation.`
          }
        ],
        artifacts: [
          {
            type: "application/json",
            title: "SmartAPI Registry Query Results",
            name: "smartapi_registry_query.json",
            content: {
              query: registryParams.registry_query,
              results: artifactData,
              metadata: {
                total_found: records.length,
                query_params: registryParams
              }
            }
          }
        ]
      };
    }

    if (name === "get-smartapi-metakg") {
      const metakgParams = SmartAPIMetaKGSchema.parse(args);
      
      console.log(`[${SERVICE_NAME}] Getting SmartAPI MetaKG with params:`, metakgParams);
      
      const metakgResponse = await makeSmartAPIRequest('/metakg', metakgParams);
      const metakgData = metakgResponse.hits || [];
      
      if (!metakgData || metakgData.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: `No MetaKG associations found for the specified criteria. Try broader search terms or different entity types.`
            }
          ]
        };
      }

      const formattedAssociations = metakgData.map((assoc: any) => [
        `**Subject:** ${assoc.subject}`,
        `**Object:** ${assoc.object}`,
        `**Predicate:** ${assoc.predicate}`,
        `**APIs:** ${assoc.api?.map((apiItem: any) => apiItem.api?.name || 'Unknown').join(', ') || 'Unknown'}`,
        `**SmartAPI IDs:** ${assoc.api?.map((apiItem: any) => apiItem.api?.smartapi?.id || 'Unknown').join(', ') || 'Unknown'}`,
        "---"
      ].join("\n")).join("\n");

      // Generate markdown table from associations
      const associationsTable = generateAssociationsTable(metakgData);

      return {
        content: [
          {
            type: "text",
            text: `# SmartAPI Meta Knowledge Graph

Found ${metakgData.length} associations in the MetaKG:

${formattedAssociations}

## Understanding the MetaKG
- **Subject/Object:** The entities being connected (e.g., Gene, Protein, Disease)
- **Predicate:** The type of relationship (e.g., physically_interacts_with, treats)
- **Provided by:** The API that provides this association
- **API:** The specific API name and SmartAPI ID for more details

## Next Steps
1. **Use the SmartAPI UI links** to explore specific APIs
2. **Query specific APIs** using the get-smartapi-details tool
3. **Search for more associations** with different entity types`
          }
        ],
        artifacts: [
          {
            type: "application/json",
            title: "SmartAPI MetaKG Results",
            name: "smartapi_metakg.json",
            content: {
              associations: metakgData,
              metadata: {
                total_associations: metakgData.length,
                query_params: metakgParams
              }
            }
          },
          {
            type: "text/markdown",
            title: "SmartAPI MetaKG Table",
            name: "smartapi_metakg_table.md",
            content: `# SmartAPI Meta Knowledge Graph - Associations Table

Found ${metakgData.length} associations in the MetaKG.

## Associations Table

${associationsTable}

## Understanding the Table
- **Subject:** The source entity type (e.g., Gene, Protein, Disease)
- **Object:** The target entity type (e.g., Molecular Activity, Clinical Finding)
- **Predicate:** The type of relationship (e.g., physically_interacts_with, treats)
- **API Name:** The name of the API providing this association
- **SmartAPI ID:** Clickable link to the SmartAPI UI for more details

## Query Parameters
- **Subject:** ${metakgParams.subject || 'Any'}
- **Object:** ${metakgParams.object || 'Any'}
- **Predicate:** ${metakgParams.predicate || 'Any'}
- **API Details:** ${metakgParams.api_details ? 'Included' : 'Not included'}
- **Size:** ${metakgParams.size || 10}
- **Format:** ${metakgParams.format || 'json'}

## Next Steps
1. **Click on SmartAPI IDs** to explore specific APIs in the SmartAPI UI
2. **Use the get-smartapi-details tool** to get detailed information about specific APIs
3. **Modify query parameters** to find different types of associations
4. **Explore the JSON artifact** for programmatic access to the data`
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
  console.log(`[${SERVICE_NAME}] SmartAPI MCP server running on stdio`);
}

main().catch(console.error);