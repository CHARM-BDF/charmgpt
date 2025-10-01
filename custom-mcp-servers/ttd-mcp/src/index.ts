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

// TTD MCP Configuration
const API_BASE_URL = process.env.TTD_BASE_URL || "https://biothings.ncats.io/ttd";
const TOOL_NAME = "ttd-mcp";
const SERVICE_NAME = "ttd";

// TTD Query Schema
const TTDQuerySchema = z.object({
  query: z.string().min(1, "Query cannot be empty"),
  fields: z.string().optional().default("all"),
  size: z.number().min(1).max(1000).optional().default(10),
  from: z.number().min(0).optional().default(0),
  sort: z.array(z.string()).optional(),
  scopes: z.array(z.string()).optional(),
  format: z.enum(['json', 'jsonld', 'html']).optional().default('json'),
});

// TTD Association Schema
const TTDAssociationSchema = z.object({
  association_id: z.string().min(1, "Association ID cannot be empty"),
  fields: z.string().optional().default("all"),
  format: z.enum(['json', 'jsonld', 'html']).optional().default('json'),
});

// TTD Batch Association Schema
const TTDBatchAssociationSchema = z.object({
  association_ids: z.array(z.string()).min(1, "At least one association ID is required").max(1000, "Maximum 1000 associations per request"),
  fields: z.string().optional().default("all"),
  format: z.enum(['json', 'jsonld', 'html']).optional().default('json'),
});

// TTD Metadata Schema
const TTDMetadataSchema = z.object({
  format: z.enum(['json', 'jsonld', 'html']).optional().default('json'),
});

// TTD Fields Schema
const TTDFieldsSchema = z.object({
  search: z.string().optional(),
  prefix: z.string().optional(),
  format: z.enum(['json', 'jsonld', 'html']).optional().default('json'),
});

// Make TTD API request
async function makeTTDRequest(endpoint: string, method: 'GET' | 'POST' = 'GET', body?: any, params?: Record<string, any>): Promise<any> {
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

  // Only add Content-Type for POST requests
  if (method === 'POST') {
    headers['Content-Type'] = 'application/json';
  }

  console.log(`[${SERVICE_NAME}] Making TTD request to: ${url.toString()}`);

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
        throw new Error(`TTD resource not found: ${endpoint}`);
      }
      if (response.status === 400) {
        const errorText = await response.text();
        throw new Error(`Invalid TTD request: ${errorText}`);
      }
      if (response.status === 413) {
        throw new Error(`Payload too large. Batch size exceeds limit of 1000.`);
      }
      if (response.status === 429) {
        throw new Error(`Rate limit exceeded. Please wait before retrying.`);
      }
      if (response.status === 500) {
        throw new Error(`Internal server error in TTD service.`);
      }
      throw new Error(`TTD request failed: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`[${SERVICE_NAME}] TTD request error:`, error);
    throw error;
  }
}

// Format TTD query response for Claude consumption
function formatTTDQueryForModel(response: any, query: string): string {
  const hits = response.hits || [];
  const total = response.total || 0;
  
  let output = [
    `**TTD Query Results**`,
    `**Query:** ${query}`,
    `**Total Results:** ${total}`,
    `**Returned:** ${hits.length}`,
    ""
  ];

  if (hits.length > 0) {
    output.push("## Association Results");
    hits.slice(0, 10).forEach((hit: any, index: number) => {
      const association = hit.association || {};
      const subject = hit.subject || {};
      const object = hit.object || {};
      
      output.push(`### Result ${index + 1}`);
      output.push(`**Association ID:** ${hit._id || 'Unknown'}`);
      output.push(`**Predicate:** ${association.predicate || 'Unknown'}`);
      output.push(`**Subject:** ${subject.name || 'Unknown'} (${subject.id || 'No ID'})`);
      output.push(`**Object:** ${object.name || 'Unknown'} (${object.id || 'No ID'})`);
      
      if (association.clinical_trial) {
        output.push(`**Clinical Trial Status:** ${association.clinical_trial.status || 'Unknown'}`);
      }
      
      output.push("");
    });
    
    if (hits.length > 10) {
      output.push(`... and ${hits.length - 10} more results`);
    }
  } else {
    output.push("No associations found matching your query.");
  }

  return output.join("\n");
}

// Format TTD association response for Claude consumption
function formatTTDAssociationForModel(response: any, associationId: string): string {
  const association = response.association || {};
  const subject = response.subject || {};
  const object = response.object || {};
  
  let output = [
    `**TTD Association Details**`,
    `**Association ID:** ${associationId}`,
    `**Predicate:** ${association.predicate || 'Unknown'}`,
    "",
    "## Subject Information",
    `**Name:** ${subject.name || 'Unknown'}`,
    `**ID:** ${subject.id || 'No ID'}`,
    `**Type:** ${subject.type || 'Unknown'}`,
    "",
    "## Object Information", 
    `**Name:** ${object.name || 'Unknown'}`,
    `**ID:** ${object.id || 'No ID'}`,
    `**Type:** ${object.type || 'Unknown'}`,
    ""
  ];

  if (association.clinical_trial) {
    output.push("## Clinical Trial Information");
    output.push(`**Status:** ${association.clinical_trial.status || 'Unknown'}`);
    if (association.clinical_trial.phase) {
      output.push(`**Phase:** ${association.clinical_trial.phase}`);
    }
    if (association.clinical_trial.nct_id) {
      output.push(`**NCT ID:** ${association.clinical_trial.nct_id}`);
    }
    output.push("");
  }

  if (association.evidence) {
    output.push("## Evidence");
    output.push(`**Source:** ${association.evidence.source || 'Unknown'}`);
    if (association.evidence.reference) {
      output.push(`**Reference:** ${association.evidence.reference}`);
    }
  }

  return output.join("\n");
}

// Format TTD metadata for Claude consumption
function formatTTDMetadataForModel(response: any): string {
  const stats = response.stats || {};
  const build = response.build || {};
  
  let output = [
    `**TTD Database Metadata**`,
    `**Build Date:** ${build.timestamp || 'Unknown'}`,
    `**Version:** ${build.version || 'Unknown'}`,
    "",
    "## Database Statistics",
    `**Total Associations:** ${stats.total_associations || 'Unknown'}`,
    `**Total Drugs:** ${stats.total_drugs || 'Unknown'}`,
    `**Total Targets:** ${stats.total_targets || 'Unknown'}`,
    `**Total Diseases:** ${stats.total_diseases || 'Unknown'}`,
    ""
  ];

  if (response.available_fields) {
    output.push("## Available Fields");
    const fields = Object.keys(response.available_fields).slice(0, 20);
    fields.forEach(field => {
      output.push(`- ${field}`);
    });
    if (Object.keys(response.available_fields).length > 20) {
      output.push(`... and ${Object.keys(response.available_fields).length - 20} more fields`);
    }
  }

  return output.join("\n");
}

// Format TTD data for artifacts
function formatTTDArtifactData(response: any, queryParams: any, queryType: string): any {
  return {
    query_type: queryType,
    query_params: queryParams,
    response: {
      total: response.total || 0,
      hits_count: response.hits?.length || 0,
      max_score: response.max_score,
      took: response.took,
    },
    data: response,
    metadata: {
      timestamp: new Date().toISOString(),
      service: "BioThings TTD API",
      endpoint: API_BASE_URL,
      version: "1.0",
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
    name: "query-ttd",
    description: "Query the Therapeutic Target Database for drug-disease, target-disease, drug-protein target, and biomarker-disease associations using BioThings query syntax.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "BioThings query string (e.g., 'object.mondo:0005083', 'subject.pubchem_compound:126565')"
        },
        fields: {
          type: "string",
          default: "all",
          description: "Comma-separated list of fields to return (default: 'all')"
        },
        size: {
          type: "number",
          minimum: 1,
          maximum: 1000,
          default: 10,
          description: "Maximum number of results to return (default: 10, max: 1000)"
        },
        from: {
          type: "number",
          minimum: 0,
          default: 0,
          description: "Number of results to skip for pagination (default: 0)"
        },
        sort: {
          type: "array",
          items: { type: "string" },
          description: "Fields to sort by (prefix with '-' for descending order)"
        },
        scopes: {
          type: "array",
          items: { type: "string" },
          description: "Fields to search in (default: '_id')"
        },
        format: {
          type: "string",
          enum: ["json", "jsonld", "html"],
          default: "json",
          description: "Response format (default: 'json')"
        }
      },
      required: ["query"]
    }
  },
  {
    name: "get-ttd-association",
    description: "Get detailed information about a specific association by its ID from the Therapeutic Target Database.",
    inputSchema: {
      type: "object",
      properties: {
        association_id: {
          type: "string",
          description: "The association ID (e.g., '101481444_interacts_with_O60885')"
        },
        fields: {
          type: "string",
          default: "all",
          description: "Comma-separated list of fields to return (default: 'all')"
        },
        format: {
          type: "string",
          enum: ["json", "jsonld", "html"],
          default: "json",
          description: "Response format (default: 'json')"
        }
      },
      required: ["association_id"]
    }
  },
  {
    name: "get-ttd-associations-batch",
    description: "Get detailed information about multiple associations by their IDs from the Therapeutic Target Database (up to 1000 associations).",
    inputSchema: {
      type: "object",
      properties: {
        association_ids: {
          type: "array",
          items: { type: "string" },
          minItems: 1,
          maxItems: 1000,
          description: "Array of association IDs (max 1000)"
        },
        fields: {
          type: "string",
          default: "all",
          description: "Comma-separated list of fields to return (default: 'all')"
        },
        format: {
          type: "string",
          enum: ["json", "jsonld", "html"],
          default: "json",
          description: "Response format (default: 'json')"
        }
      },
      required: ["association_ids"]
    }
  },
  {
    name: "get-ttd-metadata",
    description: "Get metadata about the Therapeutic Target Database including statistics, build information, and available fields.",
    inputSchema: {
      type: "object",
      properties: {
        format: {
          type: "string",
          enum: ["json", "jsonld", "html"],
          default: "json",
          description: "Response format (default: 'json')"
        }
      }
    }
  },
  {
    name: "get-ttd-fields",
    description: "Get information about available data fields in the Therapeutic Target Database with optional search and filtering.",
    inputSchema: {
      type: "object",
      properties: {
        search: {
          type: "string",
          description: "Search for fields containing this text"
        },
        prefix: {
          type: "string",
          description: "Filter fields by prefix"
        },
        format: {
          type: "string",
          enum: ["json", "jsonld", "html"],
          default: "json",
          description: "Response format (default: 'json')"
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
    if (name === "query-ttd") {
      const queryParams = TTDQuerySchema.parse(args);
      
      console.log(`[${SERVICE_NAME}] Querying TTD with: ${queryParams.query}`);
      
      const params: Record<string, any> = {
        q: queryParams.query,
        fields: queryParams.fields,
        size: queryParams.size,
        from: queryParams.from,
        format: queryParams.format,
      };

      if (queryParams.sort) {
        params.sort = queryParams.sort;
      }
      if (queryParams.scopes) {
        params.scopes = queryParams.scopes;
      }

      const response = await makeTTDRequest("/query", "GET", undefined, params);
      
      const formattedResponse = formatTTDQueryForModel(response, queryParams.query);
      const artifactData = formatTTDArtifactData(response, queryParams, "query");

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
            title: "TTD Query Results",
            name: "ttd_query_results.json",
            content: artifactData
          }
        ]
      };
    }

    if (name === "get-ttd-association") {
      const associationParams = TTDAssociationSchema.parse(args);
      
      console.log(`[${SERVICE_NAME}] Getting TTD association: ${associationParams.association_id}`);
      
      const params: Record<string, any> = {
        fields: associationParams.fields,
        format: associationParams.format,
      };

      const response = await makeTTDRequest(`/association/${associationParams.association_id}`, "GET", undefined, params);
      
      const formattedResponse = formatTTDAssociationForModel(response, associationParams.association_id);
      const artifactData = formatTTDArtifactData(response, associationParams, "association");

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
            title: "TTD Association Details",
            name: `ttd_association_${associationParams.association_id}.json`,
            content: artifactData
          }
        ]
      };
    }

    if (name === "get-ttd-associations-batch") {
      const batchParams = TTDBatchAssociationSchema.parse(args);
      
      console.log(`[${SERVICE_NAME}] Getting TTD associations batch: ${batchParams.association_ids.length} associations`);
      
      const body = {
        ids: batchParams.association_ids
      };

      const params: Record<string, any> = {
        fields: batchParams.fields,
        format: batchParams.format,
      };

      const response = await makeTTDRequest("/association", "POST", body, params);
      
      const formattedResponse = [
        `**TTD Batch Association Results**`,
        `**Requested:** ${batchParams.association_ids.length} associations`,
        `**Returned:** ${Object.keys(response).length} associations`,
        "",
        "## Association Summary"
      ];

      Object.entries(response).forEach(([id, data]: [string, any]) => {
        const association = data.association || {};
        const subject = data.subject || {};
        const object = data.object || {};
        
        formattedResponse.push(`### ${id}`);
        formattedResponse.push(`**Predicate:** ${association.predicate || 'Unknown'}`);
        formattedResponse.push(`**Subject:** ${subject.name || 'Unknown'}`);
        formattedResponse.push(`**Object:** ${object.name || 'Unknown'}`);
        formattedResponse.push("");
      });

      const artifactData = formatTTDArtifactData(response, batchParams, "batch_associations");

      return {
        content: [
          {
            type: "text",
            text: formattedResponse.join("\n")
          }
        ],
        artifacts: [
          {
            type: "application/json",
            title: "TTD Batch Association Results",
            name: "ttd_batch_associations.json",
            content: artifactData
          }
        ]
      };
    }

    if (name === "get-ttd-metadata") {
      const metadataParams = TTDMetadataSchema.parse(args);
      
      console.log(`[${SERVICE_NAME}] Getting TTD metadata`);
      
      const params: Record<string, any> = {
        format: metadataParams.format,
      };

      const response = await makeTTDRequest("/metadata", "GET", undefined, params);
      
      const formattedResponse = formatTTDMetadataForModel(response);
      const artifactData = formatTTDArtifactData(response, metadataParams, "metadata");

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
            title: "TTD Database Metadata",
            name: "ttd_metadata.json",
            content: artifactData
          }
        ]
      };
    }

    if (name === "get-ttd-fields") {
      const fieldsParams = TTDFieldsSchema.parse(args);
      
      console.log(`[${SERVICE_NAME}] Getting TTD fields`);
      
      const params: Record<string, any> = {
        format: fieldsParams.format,
      };

      if (fieldsParams.search) {
        params.search = fieldsParams.search;
      }
      if (fieldsParams.prefix) {
        params.prefix = fieldsParams.prefix;
      }

      const response = await makeTTDRequest("/metadata/fields", "GET", undefined, params);
      
      const formattedResponse = [
        `**TTD Available Fields**`,
        `**Total Fields:** ${Object.keys(response).length}`,
        ""
      ];

      if (fieldsParams.search) {
        formattedResponse.push(`**Search Term:** ${fieldsParams.search}`);
      }
      if (fieldsParams.prefix) {
        formattedResponse.push(`**Prefix Filter:** ${fieldsParams.prefix}`);
      }
      formattedResponse.push("");

      const fields = Object.keys(response).slice(0, 50);
      formattedResponse.push("## Field List");
      fields.forEach(field => {
        formattedResponse.push(`- ${field}`);
      });
      
      if (Object.keys(response).length > 50) {
        formattedResponse.push(`... and ${Object.keys(response).length - 50} more fields`);
      }

      const artifactData = formatTTDArtifactData(response, fieldsParams, "fields");

      return {
        content: [
          {
            type: "text",
            text: formattedResponse.join("\n")
          }
        ],
        artifacts: [
          {
            type: "application/json",
            title: "TTD Available Fields",
            name: "ttd_fields.json",
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