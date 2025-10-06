import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

// =============================================================================
// PFOCR MCP SERVER CONFIGURATION
// =============================================================================

// PFOCR API Configuration based on SmartAPI specs
const API_BASE_URL = "https://biothings.ncats.io/pfocr"; // Production server
const TOOL_NAME = "pfocr-mcp";
const SERVICE_NAME = "pfocr";

// Environment variables
const USER_EMAIL = process.env.PFOCR_USER_EMAIL || 'anonymous@example.com';
const API_KEY = process.env.PFOCR_API_KEY; // Currently not required for PFOCR
const RATE_LIMIT_MS = parseInt(process.env.PFOCR_RATE_LIMIT_MS || '1000');
const TIMEOUT_MS = parseInt(process.env.PFOCR_TIMEOUT_MS || '30000');

// =============================================================================
// SCHEMA DEFINITIONS
// =============================================================================

// Search/Query schema for PFOCR pathway data
const PFOCRSearchSchema = z.object({
  query: z.string().min(1, "Query cannot be empty"),
  max_results: z.number().min(1).max(1000).optional().default(10),
  fields: z.string().optional().default("all"),
  from: z.number().min(0).optional().default(0),
  sort: z.array(z.string()).optional(),
  facets: z.array(z.string()).optional(),
  fetch_all: z.boolean().optional().default(false),
  scroll_id: z.string().optional(),
});

// Get geneset details schema
const PFOCRGenesetSchema = z.object({
  id: z.string().min(1, "Geneset ID cannot be empty"),
  fields: z.string().optional().default("all"),
});

// Batch geneset query schema
const PFOCRBatchGenesetSchema = z.object({
  ids: z.array(z.string()).min(1, "At least one ID required").max(1000, "Maximum 1000 IDs allowed"),
  fields: z.string().optional().default("all"),
});

// Metadata schema
const PFOCRMetadataSchema = z.object({
  include_fields: z.boolean().optional().default(false),
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

async function makePFOCRRequest(endpoint: string, method: 'GET' | 'POST' = 'GET', body?: any): Promise<any> {
  const url = new URL(`${API_BASE_URL}${endpoint}`);
  
  const headers: Record<string, string> = {
    'Accept': 'application/json',
    'User-Agent': `${SERVICE_NAME}-mcp/1.0.0`,
  };

  // CRITICAL: Only add Content-Type for POST requests
  if (method === 'POST') {
    headers['Content-Type'] = 'application/json';
  }

  // Add user email for usage tracking
  if (USER_EMAIL) {
    url.searchParams.set('email', USER_EMAIL);
  }

  // Add API key if available
  if (API_KEY) {
    headers['Authorization'] = `Bearer ${API_KEY}`;
  }

  console.log(`[${SERVICE_NAME}] Making PFOCR request to: ${url.toString()}`);

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
        throw new Error(`PFOCR resource not found: ${endpoint}`);
      }
      if (response.status === 400) {
        const errorText = await response.text();
        throw new Error(`Invalid request: ${errorText}`);
      }
      if (response.status === 413) {
        throw new Error(`Payload too large. Batch size exceeded limit.`);
      }
      if (response.status === 429) {
        throw new Error(`Rate limit exceeded. Please wait before retrying.`);
      }
      if (response.status === 500) {
        throw new Error(`Internal server error in PFOCR service.`);
      }
      if (response.status === 501) {
        throw new Error(`PFOCR endpoint not implemented: ${endpoint}`);
      }
      throw new Error(`PFOCR API request failed: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`[${SERVICE_NAME}] PFOCR API request error:`, error);
    throw error;
  }
}

// =============================================================================
// DATA FORMATTING FUNCTIONS
// =============================================================================

// Format PFOCR geneset record for Claude consumption
function formatPFOCRGenesetForModel(record: any): string {
  const id = record._id || 'Unknown';
  const title = record.title || 'No title';
  const description = record.description || 'No description available';
  const pmc = record.pmc || 'N/A';
  const figureUrl = record.figureUrl || '';
  const pfocrUrl = record.pfocrUrl || '';
  const associatedWith = record.associatedWith || {};
  
  // Extract mentions
  const mentions = associatedWith.mentions || {};
  const genes = mentions.genes?.ncbigene || [];
  const chemicals = mentions.chemicals || {};
  const diseases = mentions.diseases || {};
  
  const meshChemicals = chemicals.mesh || [];
  const chebiChemicals = chemicals.chebi || [];
  const meshDiseases = diseases.mesh || [];
  const doidDiseases = diseases.doid || [];

  return [
    `**Geneset ID:** ${id}`,
    `**Title:** ${title}`,
    `**Description:** ${description}`,
    `**PMC ID:** ${pmc}`,
    figureUrl ? `**Figure URL:** ${figureUrl}` : "",
    pfocrUrl ? `**PFOCR URL:** ${pfocrUrl}` : "",
    genes.length > 0 ? `**Genes:** ${genes.slice(0, 5).join(', ')}${genes.length > 5 ? ` (and ${genes.length - 5} more)` : ''}` : "",
    meshChemicals.length > 0 ? `**MeSH Chemicals:** ${meshChemicals.slice(0, 3).join(', ')}${meshChemicals.length > 3 ? ` (and ${meshChemicals.length - 3} more)` : ''}` : "",
    chebiChemicals.length > 0 ? `**ChEBI Chemicals:** ${chebiChemicals.slice(0, 3).join(', ')}${chebiChemicals.length > 3 ? ` (and ${chebiChemicals.length - 3} more)` : ''}` : "",
    meshDiseases.length > 0 ? `**MeSH Diseases:** ${meshDiseases.slice(0, 3).join(', ')}${meshDiseases.length > 3 ? ` (and ${meshDiseases.length - 3} more)` : ''}` : "",
    doidDiseases.length > 0 ? `**DOID Diseases:** ${doidDiseases.slice(0, 3).join(', ')}${doidDiseases.length > 3 ? ` (and ${doidDiseases.length - 3} more)` : ''}` : "",
    "---"
  ].filter(Boolean).join("\n");
}

// Format PFOCR data for artifacts
function formatPFOCRArtifactData(records: any[]): any {
  return {
    summary: {
      total_genesets: records.length,
      genesets_with_genes: records.filter(r => r.associatedWith?.mentions?.genes?.ncbigene?.length > 0).length,
      genesets_with_chemicals: records.filter(r => 
        (r.associatedWith?.mentions?.chemicals?.mesh?.length > 0) || 
        (r.associatedWith?.mentions?.chemicals?.chebi?.length > 0)
      ).length,
      genesets_with_diseases: records.filter(r => 
        (r.associatedWith?.mentions?.diseases?.mesh?.length > 0) || 
        (r.associatedWith?.mentions?.diseases?.doid?.length > 0)
      ).length,
    },
    genesets: records.map(record => ({
      id: record._id,
      title: record.title,
      description: record.description,
      pmc: record.pmc,
      figureUrl: record.figureUrl,
      pfocrUrl: record.pfocrUrl,
      associatedWith: record.associatedWith,
      mentions: record.associatedWith?.mentions || {},
    }))
  };
}


// =============================================================================
// QUERY BUILDING FUNCTIONS
// =============================================================================

// Build PFOCR query parameters
function buildPFOCRQueryParams(searchParams: any): Record<string, any> {
  const { query, max_results, fields, from, sort, facets, fetch_all, scroll_id } = searchParams;
  
  const params: Record<string, any> = {
    q: query,
    size: max_results || 10,
    from: from || 0,
  };
  
  if (fields && fields !== 'all') {
    params.fields = fields;
  }
  
  if (sort && sort.length > 0) {
    params.sort = sort.join(',');
  }
  
  if (facets && facets.length > 0) {
    params.facets = facets.join(',');
  }
  
  if (fetch_all) {
    params.fetch_all = true;
  }
  
  if (scroll_id) {
    params.scroll_id = scroll_id;
  }
  
  return params;
}

// =============================================================================
// TOOL DEFINITIONS
// =============================================================================

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "search-pfocr-pathways",
        description: "Search PFOCR (Pathway Figure OCR) database for pathway figures and associated genes, chemicals, and diseases from scientific literature. Returns geneset records with biomedical annotations. REQUIRES field-specific syntax: Genes: 'associatedWith.mentions.genes.ncbigene:{NCBI_ID}', Diseases: 'associatedWith.mentions.diseases.mesh:{MESH_ID}' or 'associatedWith.mentions.diseases.doid:{DOID_ID}', Chemicals: 'associatedWith.mentions.chemicals.mesh:{MESH_ID}' or 'associatedWith.mentions.chemicals.chebi:{CHEBI_ID}'. Text searches like 'cancer' or 'BRCA1' return no results.",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Field-specific search query. Examples: 'associatedWith.mentions.genes.ncbigene:672' (BRCA1), 'associatedWith.mentions.diseases.mesh:D045169' (COVID-19), 'associatedWith.mentions.chemicals.mesh:D008550' (MeSH chemical), 'associatedWith.mentions.chemicals.chebi:16796' (ChEBI chemical)"
            },
            max_results: {
              type: "number",
              minimum: 1,
              maximum: 1000,
              default: 10,
              description: "Maximum number of geneset records to return"
            },
            fields: {
              type: "string",
              default: "all",
              description: "Comma-separated fields to return (default: all fields)"
            },
            from: {
              type: "number",
              minimum: 0,
              default: 0,
              description: "Number of results to skip (for pagination)"
            },
            sort: {
              type: "array",
              items: { type: "string" },
              description: "Fields to sort by (prefix with '-' for descending)"
            },
            facets: {
              type: "array",
              items: { type: "string" },
              description: "Fields to return facets for"
            },
            fetch_all: {
              type: "boolean",
              default: false,
              description: "Fetch all results using scrolling (returns scroll_id for pagination)"
            }
          },
          required: ["query"]
        }
      },
      {
        name: "get-pfocr-geneset",
        description: "Get detailed information about a specific PFOCR geneset by ID, including all associated genes, chemicals, and diseases.",
        inputSchema: {
          type: "object",
          properties: {
            id: {
              type: "string",
              description: "The PFOCR geneset ID (e.g., 'PMC9278000__gr2_lrg')"
            },
            fields: {
              type: "string",
              default: "all",
              description: "Comma-separated fields to return (default: all fields)"
            }
          },
          required: ["id"]
        }
      },
      {
        name: "batch-pfocr-genesets",
        description: "Get multiple PFOCR genesets by their IDs in a single request (up to 1000 IDs).",
        inputSchema: {
          type: "object",
          properties: {
            ids: {
              type: "array",
              items: { type: "string" },
              minItems: 1,
              maxItems: 1000,
              description: "Array of PFOCR geneset IDs to retrieve"
            },
            fields: {
              type: "string",
              default: "all",
              description: "Comma-separated fields to return (default: all fields)"
            }
          },
          required: ["ids"]
        }
      },
      {
        name: "get-pfocr-metadata",
        description: "Get metadata about the PFOCR database, including available fields and data statistics.",
        inputSchema: {
          type: "object",
          properties: {
            include_fields: {
              type: "boolean",
              default: false,
              description: "Whether to include detailed field information"
            }
          }
        }
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
    if (name === "search-pfocr-pathways") {
      const searchParams = PFOCRSearchSchema.parse(args);
      const queryParams = buildPFOCRQueryParams(searchParams);
      
      console.log(`[${SERVICE_NAME}] Searching PFOCR with query: ${searchParams.query}`);
      
      // Build query string
      const queryString = new URLSearchParams(queryParams).toString();
      const searchData = await makePFOCRRequest(`/query?${queryString}`);
      
      const records = searchData.hits || [];
      
      console.log(`[${SERVICE_NAME}] Found ${records.length} PFOCR genesets`);
      
      if (records.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: `No PFOCR genesets found matching your query: "${searchParams.query}"`
            }
          ]
        };
      }

      const formattedRecords = records.map(formatPFOCRGenesetForModel).join("\n");
      const artifactData = formatPFOCRArtifactData(records);

      return {
        content: [
          {
            type: "text",
            text: `# PFOCR Pathway Search Results

Found ${records.length} pathway figures matching your query: "${searchParams.query}"

## Instructions for Using This Data
When working with these pathway figures:
1. **Review the geneset IDs** for direct access to specific figures
2. **Check the associated genes, chemicals, and diseases** for pathway analysis
3. **Use the PMC and figure URLs** to access the original literature
4. **Consider the PFOCR URLs** for detailed pathway information

${formattedRecords}

## Summary
- **Total genesets found:** ${records.length}
- **Genesets with gene annotations:** ${artifactData.summary.genesets_with_genes}
- **Genesets with chemical annotations:** ${artifactData.summary.genesets_with_chemicals}
- **Genesets with disease annotations:** ${artifactData.summary.genesets_with_diseases}`
          }
        ],
        artifacts: [
          {
            type: "pfocr",
            title: "PFOCR Search Results",
            name: "pfocr_search_results.json",
            content: artifactData
          }
        ]
      };
    }

    if (name === "get-pfocr-geneset") {
      const { id, fields } = PFOCRGenesetSchema.parse(args);
      
      console.log(`[${SERVICE_NAME}] Getting PFOCR geneset: ${id}`);
      
      const genesetData = await makePFOCRRequest(`/geneset/${id}?fields=${fields}`);
      
      if (!genesetData) {
        return {
          content: [
            {
              type: "text",
              text: `PFOCR geneset with ID "${id}" not found. Please check the geneset ID and try again.`
            }
          ]
        };
      }

      const formattedGeneset = formatPFOCRGenesetForModel(genesetData);

      return {
        content: [
          {
            type: "text",
            text: `# PFOCR Geneset Details: ${id}

${formattedGeneset}

## Next Steps
1. **Use the geneset ID** for batch queries if you need related genesets
2. **Check the associated genes, chemicals, and diseases** for pathway analysis
3. **Access the original literature** using the PMC ID and figure URL
4. **Explore the PFOCR URL** for detailed pathway visualization`
          }
        ],
        artifacts: [
          {
            type: "pfocr",
            title: `PFOCR Geneset - ${id}`,
            name: `pfocr_geneset_${id}.json`,
            content: genesetData
          }
        ]
      };
    }

    if (name === "batch-pfocr-genesets") {
      const { ids, fields } = PFOCRBatchGenesetSchema.parse(args);
      
      console.log(`[${SERVICE_NAME}] Getting ${ids.length} PFOCR genesets`);
      
      const batchData = await makePFOCRRequest('/geneset', 'POST', {
        ids: ids,
        fields: fields
      });
      
      if (!batchData || !Array.isArray(batchData)) {
        return {
          content: [
            {
              type: "text",
              text: "Failed to retrieve batch geneset data from PFOCR API"
            }
          ]
        };
      }

      const formattedGenesets = batchData.map(formatPFOCRGenesetForModel).join("\n");
      const artifactData = formatPFOCRArtifactData(batchData);

      return {
        content: [
          {
            type: "text",
            text: `# PFOCR Batch Geneset Results

Retrieved ${batchData.length} genesets from PFOCR database.

${formattedGenesets}

## Batch Analysis
- **Total genesets retrieved:** ${batchData.length}
- **Genesets with gene annotations:** ${artifactData.summary.genesets_with_genes}
- **Genesets with chemical annotations:** ${artifactData.summary.genesets_with_chemicals}
- **Genesets with disease annotations:** ${artifactData.summary.genesets_with_diseases}`
          }
        ],
        artifacts: [
          {
            type: "pfocr",
            title: "PFOCR Batch Geneset Results",
            name: "pfocr_batch_genesets.json",
            content: artifactData
          }
        ]
      };
    }

    if (name === "get-pfocr-metadata") {
      const { include_fields } = PFOCRMetadataSchema.parse(args);
      
      console.log(`[${SERVICE_NAME}] Getting PFOCR metadata`);
      
      const metadata = await makePFOCRRequest('/metadata');
      const fieldsMetadata = include_fields ? await makePFOCRRequest('/metadata/fields') : null;
      
      if (!metadata) {
        return {
          content: [
            {
              type: "text",
              text: "Failed to retrieve PFOCR metadata"
            }
          ]
        };
      }

      const metadataText = [
        `# PFOCR Database Metadata`,
        ``,
        `**Database Information:**`,
        `- **Total genesets:** ${metadata.total || 'Unknown'}`,
        `- **Last updated:** ${metadata.last_updated || 'Unknown'}`,
        `- **Version:** ${metadata.version || 'Unknown'}`,
        ``,
        `**Available Data:**`,
        `- **Genes:** Associated with pathway figures`,
        `- **Chemicals:** MeSH and ChEBI annotations`,
        `- **Diseases:** MeSH and DOID annotations`,
        `- **Literature:** PMC IDs and figure URLs`,
        ``,
        include_fields && fieldsMetadata ? `**Available Fields:**\n${Object.keys(fieldsMetadata).map(field => `- ${field}`).join('\n')}` : ''
      ].filter(Boolean).join('\n');

      return {
        content: [
          {
            type: "text",
            text: metadataText
          }
        ],
        artifacts: [
          {
            type: "pfocr",
            title: "PFOCR Database Metadata",
            name: "pfocr_metadata.json",
            content: {
              metadata,
              fields: fieldsMetadata
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
    
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to execute ${name}: ${errorMessage}`);
  }
});

// =============================================================================
// SERVER STARTUP
// =============================================================================

async function main() {
  console.log(`[${SERVICE_NAME}] PFOCR MCP Server starting...`);
  console.log(`[${SERVICE_NAME}] Using email: ${USER_EMAIL}`);
  console.log(`[${SERVICE_NAME}] API Base URL: ${API_BASE_URL}`);
  
  if (API_KEY) {
    console.log(`[${SERVICE_NAME}] API Key found, using authenticated requests`);
  } else {
    console.log(`[${SERVICE_NAME}] No API Key found, using public access`);
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.log(`[${SERVICE_NAME}] PFOCR MCP Server running on stdio`);
}

main().catch((error) => {
  console.error(`[${SERVICE_NAME}] Fatal error in main():`, error);
  process.exit(1);
});
