import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

// TODO: IMPORT ADDITIONAL LIBRARIES NEEDED FOR YOUR API
// Examples:
// - For XML parsing: import { DOMParser } from 'xmldom';
// - For JSON APIs: no additional imports needed
// - For HTML parsing: import * as cheerio from 'cheerio';
// - For date handling: import { format, parseISO } from 'date-fns';

// =============================================================================
// CONFIGURATION - Translator Endpoints
// =============================================================================

const TOOL_NAME = "translator3-mcp";
const SERVICE_NAME = "translator3";

// Public Translator endpoints (no auth required)
const NAME_RESOLVER_URL = "https://name-resolution-sri.renci.org/lookup";
const NODE_NORMALIZER_URL = "https://nodenormalization-sri.renci.org/1.5/get_normalized_nodes";
const GENETICS_KP_URL = "https://genetics-kp.transltr.io/genetics_provider/trapi/v1.5/query";

// Optional environment configuration
const USER_EMAIL = process.env.TRANSLATOR3_USER_EMAIL || 'anonymous@example.com';
const REQUEST_TIMEOUT_MS = Number(process.env.TRANSLATOR3_TIMEOUT_MS || 30000);

// =============================================================================
// SCHEMA DEFINITIONS - DEFINE YOUR TOOL INPUT SCHEMAS
// =============================================================================

// TODO: DEFINE SCHEMAS FOR EACH TOOL'S INPUT PARAMETERS
// Use Zod schemas for robust input validation
// Pattern: {ToolName}ArgumentsSchema

// Lookup Name (Name Resolver)
const LookupNameArgumentsSchema = z.object({
  string: z.string().min(1),
  autocomplete: z.boolean().optional().default(true),
  highlighting: z.boolean().optional().default(false),
  offset: z.number().int().min(0).optional().default(0),
  limit: z.number().int().min(1).max(100).optional().default(10),
  biolink_type: z.array(z.string()).optional(),
  only_prefixes: z.string().optional(),
  exclude_prefixes: z.string().optional(),
  only_taxa: z.string().optional()
});

// Node Normalizer
const NormalizeNodesArgumentsSchema = z.object({
  curies: z.array(z.string()).min(1),
  conflate: z.boolean().optional().default(true),
  drug_chemical_conflate: z.boolean().optional().default(false),
  description: z.boolean().optional().default(false),
  individual_types: z.boolean().optional().default(false)
});

// Genetics KP raw TRAPI query
const GeneticsKPQueryArgumentsSchema = z.object({
  query: z.record(z.any())
    .refine((q) => !!q && typeof q === 'object', { message: 'query must be an object' })
});

// Genetics KP convenience tool
const GeneticsKPArgumentsSchema = z.object({
  subject: z.string().optional().default(""),
  object: z.string().optional().default(""),
  predicate: z.enum([
    "biolink:condition_associated_with_gene",
    "biolink:gene_associated_with_condition",
    "biolink:genetic_association",
  ]),
  subject_categories: z.array(z.string()).min(1),
  object_categories: z.array(z.string()).min(1),
  attributes: z.array(z.record(z.any())).optional(),
  qualifiers: z.array(z.record(z.any())).optional(),
  summary_only: z.boolean().optional().default(true),
  max_results: z.number().int().min(1).max(200).optional().default(20),
  min_score: z.number().optional(),
  max_score: z.number().optional(),
  min_publications: z.number().int().optional(),
  knowledge_level: z.string().optional(),
  agent_type: z.string().optional(),
});

// =============================================================================
// SERVER SETUP - USUALLY NO CHANGES NEEDED
// =============================================================================

// Create server instance
const server = new Server(
  {
    name: SERVICE_NAME, // Uses the SERVICE_NAME constant defined above
    version: "1.0.0", // TODO: Update version as needed
  },
  {
    capabilities: {
      tools: {},
      logging: {
        level: "debug" // TODO: Change to "info" or "error" for production
      }
    },
  }
);

// =============================================================================
// REQUEST HELPERS
// =============================================================================

async function doGet(url: string, headers: Record<string, string> = {}): Promise<any> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, { method: 'GET', headers: { 'User-Agent': TOOL_NAME, ...headers }, signal: controller.signal });
    if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timeout);
  }
}

async function doPostJson(url: string, body: any, headers: Record<string, string> = {}): Promise<any> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'User-Agent': TOOL_NAME, ...headers }, body: JSON.stringify(body), signal: controller.signal });
    if (!res.ok) throw new Error(`POST ${url} -> ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timeout);
  }
}

// =============================================================================
// DATA FORMATTING FUNCTIONS - CUSTOMIZE FOR YOUR DATA STRUCTURE
// =============================================================================

// TODO: CREATE FUNCTIONS TO FORMAT YOUR API RESPONSE DATA

// Function to format individual records for Claude (text response)
function formatRecordForModel(record: any): string {
  const title = record.name || record.label || record.title || record.id || "Item";
  const id = record.id || record.curie || "";
  const category = Array.isArray(record.category) ? record.category.join(', ') : (record.category || "");
  const description = record.description || record.definition || "";
  return [
    title ? `**Title:** ${title}` : "",
    id ? `**ID:** ${id}` : "",
    category ? `**Category:** ${category}` : "",
    description ? `**Description:** ${description}` : "",
    "---"
  ].filter(Boolean).join("\n");
}

// Function to format data for artifacts (structured data)
function formatArtifactData(records: any[]): any {
  return records.map(record => ({
    id: record.id || record.curie || "",
    name: record.name || record.label || "",
    category: record.category || record.categories || undefined,
    description: record.description || record.definition || undefined,
    synonyms: record.synonyms || record.synonym || undefined
  }));
}

// TODO: ADD ADDITIONAL FORMATTING FUNCTIONS AS NEEDED
// Examples:
// - formatSummaryData() for overview information
// - formatDetailedRecord() for full record details
// - formatSearchResults() for search result listings
// - formatAnalyticsData() for statistical information

// =============================================================================
// QUERY/SEARCH HELPER FUNCTIONS - CUSTOMIZE FOR YOUR API
// =============================================================================

// TODO: CREATE HELPER FUNCTIONS TO TRANSFORM USER INPUT INTO API QUERIES
// This depends heavily on your API's query format

function buildNameResolverParams(args: z.infer<typeof LookupNameArgumentsSchema>): string {
  const params = new URLSearchParams();
  params.set('string', args.string);
  params.set('autocomplete', String(args.autocomplete));
  params.set('highlighting', String(args.highlighting));
  params.set('offset', String(args.offset));
  params.set('limit', String(args.limit));
  if (args.biolink_type?.length) params.set('biolink_type', args.biolink_type.join(','));
  if (args.only_prefixes) params.set('only_prefixes', args.only_prefixes);
  if (args.exclude_prefixes) params.set('exclude_prefixes', args.exclude_prefixes);
  if (args.only_taxa) params.set('only_taxa', args.only_taxa);
  return params.toString();
}

// =============================================================================
// TOOL DEFINITIONS - CUSTOMIZE YOUR TOOLS
// =============================================================================

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "lookup-name",
        description: "Lookup biomedical entities by name/synonym using Translator Name Resolver.",
        inputSchema: {
          type: "object",
          properties: {
            string: { type: "string", description: "Search term" },
            autocomplete: { type: "boolean" },
            highlighting: { type: "boolean" },
            offset: { type: "number", minimum: 0 },
            limit: { type: "number", minimum: 1, maximum: 100 },
            biolink_type: { type: "array", items: { type: "string" } },
            only_prefixes: { type: "string" },
            exclude_prefixes: { type: "string" },
            only_taxa: { type: "string" }
          },
          required: ["string"],
        },
      },
      {
        name: "normalize-nodes",
        description: "Normalize CURIEs to canonical identifiers and semantic types via Node Normalizer.",
        inputSchema: {
          type: "object",
          properties: {
            curies: { type: "array", items: { type: "string" }, description: "List of CURIEs" },
            conflate: { type: "boolean" },
            drug_chemical_conflate: { type: "boolean" },
            description: { type: "boolean" },
            individual_types: { type: "boolean" }
          },
          required: ["curies"],
        },
      },
      {
        name: "genetics-kp-query",
        description: "Submit a raw TRAPI query to Genetics KP and return the full response.",
        inputSchema: {
          type: "object",
          properties: {
            query: { type: "object", description: "TRAPI message wrapper with query_graph" }
          },
          required: ["query"],
        },
      },
      {
        name: "genetics-kp",
        description: "Convenience genetics KP query builder with optional summarization.",
        inputSchema: {
          type: "object",
          properties: {
            subject: { type: "string", description: "Subject CURIE (optional)" },
            object: { type: "string", description: "Object CURIE (optional)" },
            predicate: { type: "string", enum: [
              "biolink:condition_associated_with_gene",
              "biolink:gene_associated_with_condition",
              "biolink:genetic_association"
            ]},
            subject_categories: { type: "array", items: { type: "string" } },
            object_categories: { type: "array", items: { type: "string" } },
            attributes: { type: "array", items: { type: "object" } },
            qualifiers: { type: "array", items: { type: "object" } },
            summary_only: { type: "boolean" },
            max_results: { type: "number", minimum: 1, maximum: 200 },
            min_score: { type: "number" },
            max_score: { type: "number" },
            min_publications: { type: "number" },
            knowledge_level: { type: "string" },
            agent_type: { type: "string" }
          },
          required: ["predicate", "subject_categories", "object_categories"],
        },
      }
    ],
  };
});

// =============================================================================
// TOOL EXECUTION - CUSTOMIZE FOR YOUR API CALLS
// =============================================================================

// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    if (name === "lookup-name") {
      const params = LookupNameArgumentsSchema.parse(args);
      const queryString = buildNameResolverParams(params);
      const url = `${NAME_RESOLVER_URL}?${queryString}`;
      console.log(`[DEBUG] Name Resolver URL: ${url}`);
      const data = await doGet(url);
      const records = Array.isArray(data) ? data : [];
      const formatted = records.slice(0, params.limit).map(formatRecordForModel);
      return {
        content: [
          { type: "text", text: `# Name Resolver Results for "${params.string}"
Found ${records.length} matches.

${formatted.join("\n\n")}` }
        ],
        artifacts: [
          { type: "application/json", title: "Name Resolver Results", name: "name_resolver_results.json", content: records }
        ]
      };

    } else if (name === "normalize-nodes") {
      const p = NormalizeNodesArgumentsSchema.parse(args);
      const usp = new URLSearchParams();
      for (const c of p.curies) usp.append('curie', c);
      usp.append('conflate', String(p.conflate));
      usp.append('drug_chemical_conflate', String(p.drug_chemical_conflate));
      usp.append('description', String(p.description));
      usp.append('individual_types', String(p.individual_types));
      const url = `${NODE_NORMALIZER_URL}?${usp.toString()}`;
      console.log(`[DEBUG] Node Normalizer URL: ${url}`);
      const result = await doGet(url);
      return {
        content: [ { type: "text", text: `Normalized ${p.curies.length} CURIE(s).` } ],
        artifacts: [ { type: "application/json", title: "Node Normalizer Results", name: "node_normalizer_results.json", content: result } ]
      };

    } else if (name === "genetics-kp-query") {
      const { query } = GeneticsKPQueryArgumentsSchema.parse(args);
      if (!query.message || !query.message.query_graph) {
        throw new Error("Genetics KP query must include message.query_graph");
      }
      const full = await doPostJson(GENETICS_KP_URL, query);
      return {
        content: [ { type: "text", text: `Genetics KP query executed. Status: ${full?.status || 'unknown'}` } ],
        artifacts: [ { type: "application/json", title: "Genetics KP Full Response", name: "genetics_kp_response.json", content: full } ]
      };

    } else if (name === "genetics-kp") {
      const a = GeneticsKPArgumentsSchema.parse(args);
      const message: any = {
        message: {
          query_graph: {
            nodes: {
              n00: { categories: a.subject_categories },
              n01: { categories: a.object_categories }
            },
            edges: {
              e00: { subject: 'n00', object: 'n01', predicates: [a.predicate] }
            }
          }
        }
      };
      if (a.subject) message.message.query_graph.nodes.n00.ids = [a.subject];
      if (a.object) message.message.query_graph.nodes.n01.ids = [a.object];
      if (a.attributes) message.message.query_graph.edges.e00.attributes = a.attributes;
      if (a.qualifiers) message.message.query_graph.edges.e00.qualifiers = a.qualifiers;

      const constraints: any[] = [];
      if (a.min_score !== undefined) constraints.push({ id: 'biolink:score', name: 'Confidence Score', operator: '>=', value: a.min_score });
      if (a.max_score !== undefined) constraints.push({ id: 'biolink:score', name: 'Confidence Score', operator: '<=', value: a.max_score });
      if (a.min_publications !== undefined) constraints.push({ id: 'biolink:publication_count', name: 'Publication Count', operator: '>=', value: a.min_publications });
      if (a.knowledge_level) constraints.push({ id: 'biolink:knowledge_level', name: 'Knowledge Level', operator: '==', value: a.knowledge_level });
      if (a.agent_type) constraints.push({ id: 'biolink:agent_type', name: 'Agent Type', operator: '==', value: a.agent_type });
      if (constraints.length) message.message.query_graph.edges.e00.attribute_constraints = constraints;

      const full = await doPostJson(GENETICS_KP_URL, message);
      if (!a.summary_only) {
        return {
          content: [ { type: "text", text: `Full Genetics KP response returned. Status: ${full?.status || 'unknown'}` } ],
          artifacts: [ { type: "application/json", title: "Genetics KP Full Response", name: "genetics_kp_full.json", content: full } ]
        };
      }

      try {
        const results = full?.message?.results || [];
        const kg = full?.message?.knowledge_graph || {};
        const limited = results.slice(0, a.max_results);
        const top = [] as any[];
        for (const r of limited) {
          const target = r?.node_bindings?.n01?.[0]?.id || "";
          const analyses = r?.analyses || [];
          const score = analyses?.[0]?.score ?? undefined;
          const edgeId = analyses?.[0]?.edge_bindings?.e00?.[0]?.id || "";
          const edge = kg?.edges?.[edgeId] || {};
          let edgeScore: any = undefined;
          for (const attr of (edge.attributes || [])) {
            if (attr?.attribute_type_id === 'biolink:score') { edgeScore = attr.value; break; }
          }
          top.push({ target_id: target, analysis_score: score, edge_score: edgeScore, edge_id: edgeId });
        }
        const applied: Record<string, any> = {};
        if (a.min_score !== undefined) applied.min_score = a.min_score;
        if (a.max_score !== undefined) applied.max_score = a.max_score;
        if (a.min_publications !== undefined) applied.min_publications = a.min_publications;
        if (a.knowledge_level) applied.knowledge_level = a.knowledge_level;
        if (a.agent_type) applied.agent_type = a.agent_type;

        const summary = {
          query_info: {
            subject: a.subject,
            object: a.object || 'open_query',
            predicate: a.predicate,
            subject_categories: a.subject_categories,
            object_categories: a.object_categories
          },
          applied_constraints: Object.keys(applied).length ? applied : 'No filtering constraints applied',
          constraint_details: Object.keys(applied).length ? {
            description: 'Results were filtered using TRAPI attribute constraints',
            available_constraints: {
              min_score: 'Minimum confidence score (0-1)',
              max_score: 'Maximum confidence score (0-1)',
              min_publications: 'Minimum supporting publications',
              knowledge_level: 'Required knowledge level (e.g., statistical_association)',
              agent_type: 'Required agent type (e.g., data_analysis_pipeline)'
            }
          } : null,
          total_results: (full?.message?.results || []).length || 0,
          results_shown: top.length,
          top_results: top,
          status: full?.status || 'Unknown',
          description: full?.description || '',
          full_response_available: 'Set summary_only=false to get complete TRAPI response with all metadata'
        };

        return {
          content: [ { type: "text", text: `# Genetics KP Summary\nTotal results: ${summary.total_results}\nShowing: ${summary.results_shown}` } ],
          artifacts: [ { type: "application/json", title: "Genetics KP Summary", name: "genetics_kp_summary.json", content: summary } ]
        };
      } catch (e) {
        return {
          content: [ { type: "text", text: `Failed to create summary: ${(e as Error).message}. Returning full response.` } ],
          artifacts: [ { type: "application/json", title: "Genetics KP Full Response", name: "genetics_kp_full.json", content: full } ]
        };
      }

    } else {
      throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(
        `Invalid arguments: ${error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ')}`
      );
    }
    throw error;
  }
});

// =============================================================================
// SERVER STARTUP - USUALLY NO CHANGES NEEDED
// =============================================================================

// Start the server
async function main() {
  // Log configuration status
  console.log(`[${SERVICE_NAME}] Using email: ${USER_EMAIL}`);
  console.log(`[${SERVICE_NAME}] Endpoints: NameResolver=${NAME_RESOLVER_URL}, NodeNormalizer=${NODE_NORMALIZER_URL}, GeneticsKP=${GENETICS_KP_URL}`);

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.log(`[${SERVICE_NAME}] MCP Server running on stdio`);
}

main().catch((error) => {
  console.error(`[${SERVICE_NAME}] Fatal error in main():`, error);
  process.exit(1);
}); 