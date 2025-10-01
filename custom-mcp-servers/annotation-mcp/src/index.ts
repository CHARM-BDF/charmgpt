import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

// =============================================================================
// CONFIGURATION SECTION - Translator Annotation Service
// =============================================================================

// Annotation Service Configuration
const API_BASE_URL = "https://biothings.ncats.io/annotator";
const TOOL_NAME = "annotation-service-mcp";
const SERVICE_NAME = "annotation-service";

// Environment variables (none required for public annotation service)
const USER_EMAIL = process.env.USER_EMAIL || 'anonymous@example.com';

// =============================================================================
// SCHEMA DEFINITIONS - Annotation Service Input Schemas
// =============================================================================

// Single annotation by curie ID
const AnnotateSingleSchema = z.object({
  curie_id: z.string().min(1, "Curie ID cannot be empty")
    .regex(/^[A-Za-z0-9]+:[A-Za-z0-9]+$/, "Invalid curie ID format. Expected format: PREFIX:ID"),
  raw: z.boolean().optional().default(false),
  fields: z.string().optional().default("all"),
});

// Batch annotation for multiple IDs
const AnnotateBatchSchema = z.object({
  ids: z.string().min(1, "IDs cannot be empty")
    .refine(
      (ids) => {
        const idList = ids.split(',').map(id => id.trim());
        return idList.length <= 1000 && idList.every(id => /^[A-Za-z0-9]+:[A-Za-z0-9]+$/.test(id));
      },
      "Invalid IDs format. Expected comma-separated curie IDs (max 1000). Format: PREFIX:ID"
    ),
  append: z.boolean().optional().default(false),
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

async function makeAnnotationRequest(endpoint: string, method: 'GET' | 'POST' = 'GET', body?: any, params?: Record<string, any>): Promise<any> {
  const url = new URL(`${API_BASE_URL}${endpoint}`);
  
  // Add query parameters for GET requests
  if (method === 'GET' && params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.append(key, value.toString());
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

  console.log(`[${SERVICE_NAME}] Making annotation request to: ${url.toString()}`);

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
        throw new Error(`Annotation not found. The curie ID may be unknown or unsupported.`);
      }
      if (response.status === 400) {
        const errorText = await response.text();
        throw new Error(`Invalid request format: ${errorText}`);
      }
      throw new Error(`Annotation request failed: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`[${SERVICE_NAME}] Annotation request error:`, error);
    throw error;
  }
}

// =============================================================================
// DATA FORMATTING FUNCTIONS
// =============================================================================

// Format annotation record for Claude consumption
function formatAnnotationForModel(curieId: string, annotationData: any): string {
  if (!annotationData || !Array.isArray(annotationData) || annotationData.length === 0) {
    return "No annotation data available";
  }

  const annotation = annotationData[0]; // Get the first (and usually only) result
  
  // Extract common annotation fields from the actual API response
  const name = annotation.name || annotation.symbol || 'Unknown';
  const description = annotation.summary || 'No description available';
  const synonyms = annotation.alias || [];
  const geneType = annotation.type_of_gene || 'Unknown type';
  const hgnc = annotation.HGNC || null;
  const mim = annotation.MIM || null;
  const interpro = annotation.interpro || [];

  return [
    `**Curie ID:** ${curieId}`,
    `**Name:** ${name}`,
    `**Symbol:** ${annotation.symbol || 'N/A'}`,
    `**Description:** ${description}`,
    `**Gene Type:** ${geneType}`,
    `**Synonyms:** ${Array.isArray(synonyms) ? synonyms.slice(0, 5).join(', ') + (synonyms.length > 5 ? ` (and ${synonyms.length - 5} more)` : '') : 'None'}`,
    `**HGNC ID:** ${hgnc || 'N/A'}`,
    `**MIM ID:** ${mim || 'N/A'}`,
    `**InterPro Domains:** ${interpro.length > 0 ? interpro.slice(0, 3).map((ip: any) => `${ip.id} (${ip.short_desc})`).join(', ') + (interpro.length > 3 ? ` (and ${interpro.length - 3} more)` : '') : 'None'}`,
    "---"
  ].filter(Boolean).join("\n");
}

// Format annotation data for artifacts
function formatAnnotationArtifactData(curieIds: string[], annotationResponses: any[]): any {
  const processedAnnotations = [];
  
  for (let i = 0; i < curieIds.length; i++) {
    const curieId = curieIds[i];
    const response = annotationResponses[i];
    
    if (response && response[curieId] && Array.isArray(response[curieId]) && response[curieId].length > 0) {
      const annotation = response[curieId][0];
      processedAnnotations.push({
        curie_id: curieId,
        name: annotation.name,
        symbol: annotation.symbol,
        description: annotation.summary,
        gene_type: annotation.type_of_gene,
        synonyms: annotation.alias,
        hgnc_id: annotation.HGNC,
        mim_id: annotation.MIM,
        interpro_domains: annotation.interpro,
        full_data: annotation,
      });
    }
  }

  return {
    summary: {
      total_annotations: processedAnnotations.length,
      total_requested: curieIds.length,
      success_rate: processedAnnotations.length / curieIds.length,
      gene_types: [...new Set(processedAnnotations.map(a => a.gene_type).filter(Boolean))],
      entities_with_descriptions: processedAnnotations.filter(a => a.description).length,
      entities_with_synonyms: processedAnnotations.filter(a => a.synonyms && a.synonyms.length > 0).length,
    },
    annotations: processedAnnotations
  };
}

// =============================================================================
// TOOL DEFINITIONS
// =============================================================================

const tools = [
  {
    name: "annotate-entity",
    description: "Annotate a single biomedical entity by its curie ID (e.g., NCBIGene:695, CHEBI:15365). Returns expanded annotation information including name, description, synonyms, categories, and external references.",
    inputSchema: {
      type: "object",
      properties: {
        curie_id: {
          type: "string",
          description: "Curie ID of the entity to annotate (format: PREFIX:ID, e.g., NCBIGene:695, CHEBI:15365, MONDO:0005148)"
        },
        raw: {
          type: "boolean",
          default: false,
          description: "When true, return annotation fields in their original data structure before transformation"
        },
        fields: {
          type: "string",
          default: "all",
          description: "Comma-separated fields to return, or 'all' for all available fields"
        }
      },
      required: ["curie_id"]
    }
  },
  {
    name: "annotate-entities-batch",
    description: "Annotate multiple biomedical entities by their curie IDs in a single request. Supports up to 1000 entities. Useful for bulk annotation of gene lists, drug lists, or disease lists.",
    inputSchema: {
      type: "object",
      properties: {
        ids: {
          type: "string",
          description: "Comma-separated list of curie IDs to annotate (max 1000, format: PREFIX:ID, e.g., 'NCBIGene:695,NCBIGene:1234,CHEBI:15365')"
        },
        append: {
          type: "boolean",
          default: false,
          description: "When true, append annotations to existing attributes field, otherwise overwrite"
        }
      },
      required: ["ids"]
    }
  }
];

// =============================================================================
// TOOL EXECUTION
// =============================================================================

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    if (name === "annotate-entity") {
      const annotationParams = AnnotateSingleSchema.parse(args);
      
      console.log(`[${SERVICE_NAME}] Annotating single entity: ${annotationParams.curie_id}`);
      
      const annotationData = await makeAnnotationRequest(
        `/${annotationParams.curie_id}`,
        'GET'
      );
      
      if (!annotationData || !annotationData[annotationParams.curie_id] || !Array.isArray(annotationData[annotationParams.curie_id]) || annotationData[annotationParams.curie_id].length === 0) {
        return {
          content: [
            {
              type: "text",
              text: `No annotation found for curie ID: "${annotationParams.curie_id}". This entity may not be supported by the annotation service.`
            }
          ]
        };
      }

      const formattedAnnotation = formatAnnotationForModel(annotationParams.curie_id, annotationData[annotationParams.curie_id]);
      const artifactData = formatAnnotationArtifactData([annotationParams.curie_id], [annotationData]);

      return {
        content: [
          {
            type: "text",
            text: `# Entity Annotation: ${annotationParams.curie_id}

${formattedAnnotation}

## Annotation Details
- **Service:** Translator Annotation Service (BioThings)
- **Raw Mode:** ${annotationParams.raw ? 'Enabled' : 'Disabled'}
- **Fields:** ${annotationParams.fields}

## Usage Instructions
This annotation provides expanded information about the biomedical entity. Use this data to:
1. **Understand entity properties** - name, description, categories
2. **Find related entities** - through synonyms and external references
3. **Validate entity IDs** - confirm the entity exists and is properly formatted
4. **Enrich datasets** - add semantic information to your biomedical data

## Next Steps
- Use synonyms to find alternative names for this entity
- Check external references for links to other databases
- Use categories to understand the entity type and classification`
          }
        ],
        artifacts: [
          {
            type: "application/json",
            title: `Annotation - ${annotationParams.curie_id}`,
            name: `annotation_${annotationParams.curie_id.replace(':', '_')}.json`,
            content: artifactData
          }
        ]
      };
    }

    if (name === "annotate-entities-batch") {
      const batchParams = AnnotateBatchSchema.parse(args);
      const curieIds = batchParams.ids.split(',').map(id => id.trim());
      
      console.log(`[${SERVICE_NAME}] Annotating batch of entities: ${curieIds.length} IDs`);
      
      // For batch requests, we need to make individual requests since the API doesn't support true batch
      const annotationPromises = curieIds.map(async (curieId) => {
        try {
          const response = await makeAnnotationRequest(
            `/${curieId}`,
            'GET'
          );
          return { curieId, response };
        } catch (error) {
          console.warn(`[${SERVICE_NAME}] Failed to annotate ${curieId}:`, error);
          return { curieId, response: null };
        }
      });
      
      const annotationResults = await Promise.all(annotationPromises);
      const successfulAnnotations = annotationResults.filter(result => result.response !== null);
      
      if (successfulAnnotations.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: `No annotations found for the provided IDs. Please check the curie ID formats and try again.`
            }
          ]
        };
      }

      const formattedAnnotations = successfulAnnotations.map(({ curieId, response }) => 
        formatAnnotationForModel(curieId, response[curieId])
      ).join("\n");
      
      const artifactData = formatAnnotationArtifactData(
        successfulAnnotations.map(r => r.curieId),
        successfulAnnotations.map(r => r.response)
      );

      return {
        content: [
          {
            type: "text",
            text: `# Batch Entity Annotations

Successfully annotated ${successfulAnnotations.length} out of ${curieIds.length} entities from your input list.

## Summary
- **Total Annotations:** ${successfulAnnotations.length}
- **Total Requested:** ${curieIds.length}
- **Success Rate:** ${(artifactData.summary.success_rate * 100).toFixed(1)}%
- **Gene Types:** ${artifactData.summary.gene_types.join(', ')}
- **Entities with Descriptions:** ${artifactData.summary.entities_with_descriptions}
- **Entities with Synonyms:** ${artifactData.summary.entities_with_synonyms}

## Annotations

${formattedAnnotations}

## Usage Instructions
This batch annotation provides expanded information for multiple biomedical entities. Use this data to:
1. **Enrich entity lists** - add names, descriptions, and gene types
2. **Find relationships** - identify entities of the same type or function
3. **Validate datasets** - confirm all entities exist and are properly formatted
4. **Build knowledge graphs** - use InterPro domains and external references to connect entities

## Next Steps
- Filter entities by gene type for focused analysis
- Use synonyms to find alternative names across your dataset
- Check InterPro domains to understand protein functions
- Export the structured data for further analysis or integration`
          }
        ],
        artifacts: [
          {
            type: "application/json",
            title: "Batch Annotations",
            name: "batch_annotations.json",
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
  console.log(`[${SERVICE_NAME}] Annotation Service MCP server running on stdio`);
}

main().catch((error) => {
  console.error(`[${SERVICE_NAME}] Server error:`, error);
  process.exit(1);
});