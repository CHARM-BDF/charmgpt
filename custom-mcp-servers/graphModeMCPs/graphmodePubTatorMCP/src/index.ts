#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

// =============================================================================
// CONFIGURATION SECTION
// =============================================================================
const TOOL_NAME = "graphmode-pubtator-mcp";
const SERVICE_NAME = "graphmode-pubtator";

// PubTator API Configuration
const PUBTATOR_BASE_URL = process.env.PUBTATOR_BASE_URL || "https://www.ncbi.nlm.nih.gov/research/pubtator3-api";
const PUBTATOR_API_KEY = process.env.PUBTATOR_API_KEY;
const PUBTATOR_USER_EMAIL = process.env.PUBTATOR_USER_EMAIL;

// Rate limiting and timeout settings
const RATE_LIMIT_MS = parseInt(process.env.PUBTATOR_RATE_LIMIT_MS || "2000");
const TIMEOUT_MS = parseInt(process.env.PUBTATOR_TIMEOUT_MS || "60000");
const MAX_RETRIES = parseInt(process.env.PUBTATOR_MAX_RETRIES || "3");
const MAX_BATCH_SIZE = parseInt(process.env.PUBTATOR_MAX_BATCH_SIZE || "100");

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================
interface DatabaseContext {
  conversationId: string;
  artifactId?: string;
  apiBaseUrl?: string;
  accessToken?: string;
}

interface EntityType {
  type: string;
  group: number;
}

interface PubTatorEntity {
  id: string;
  name: string;
  type: string;
  mentions?: Array<{
    start: number;
    end: number;
    text: string;
  }>;
}

interface PubTatorRelation {
  id: string;
  type: string;
  e1: string;
  e2: string;
  pmid?: string;
}

interface NodeData {
  id: string;
  label: string;
  type: string;
  data: {
    pubtatorId?: string;
    source?: string;
    [key: string]: any;
  };
  position: {
    x: number;
    y: number;
  };
}

interface EdgeData {
  id: string;                 // ADD THIS - for bulk operations with composite IDs
  source: string;
  target: string;
  label: string;
  data: {
    type: string;
    source: string;           // MCP identifier
    primary_source: string;   // Knowledge source (PMID or pubtator)
    publications: string[];   // Array of PMIDs with prefix
    [key: string]: any;
  };
}

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

// Schema for addNodesFromPMIDs tool
const AddNodesFromPMIDsArgumentsSchema = z.object({
  pmids: z.array(z.string()).min(1, "At least one PMID is required").max(MAX_BATCH_SIZE, `Maximum ${MAX_BATCH_SIZE} PMIDs per request`),
  concepts: z.array(z.enum(["gene", "disease", "chemical", "species", "mutation", "cellline", "snp", "protein"]))
    .optional()
    .default(["gene", "disease", "chemical"]),
  databaseContext: DatabaseContextSchema,
});

// Schema for addNodesAndEdgesFromText tool
const AddNodesAndEdgesFromTextArgumentsSchema = z.object({
  text: z.string().min(1, "Text is required").max(100000, "Text too long (max 100,000 characters)"),
  concepts: z.array(z.enum(["gene", "disease", "chemical", "species", "mutation", "cellline", "snp", "protein"]))
    .optional()
    .default(["gene", "disease", "chemical"]),
  databaseContext: DatabaseContextSchema,
});

// Schema for addNodesFromEntityNetwork tool
const AddNodesFromEntityNetworkArgumentsSchema = z.object({
  query: z.string().min(1, "Search query is required"),
  concept: z.enum(["gene", "disease", "chemical", "species", "cellline", "variant"]),
  max_entities: z.number().min(1).max(50).optional().default(20),
  max_relations_per_entity: z.number().min(10).max(500).optional().default(200),
  relationship_types: z.array(z.enum(["associate", "inhibit", "negative_correlate", "positive_correlate", "interact", "stimulate"])).optional(),
  databaseContext: DatabaseContextSchema,
});

// Schema for findRelatedEntities tool
const FindRelatedEntitiesArgumentsSchema = z.object({
  sourceEntity: z.string().min(1, "Source entity name is required"),
  sourceType: z.enum(["gene", "disease", "chemical", "species", "cellline", "variant"]),
  targetType: z.enum(["gene", "disease", "chemical", "species", "cellline", "variant"]),
  relationshipTypes: z.array(z.enum(["associate", "inhibit", "negative_correlate", "positive_correlate", "interact", "stimulate"])).optional(),
  maxResults: z.number().min(1).max(100).optional().default(20),
  databaseContext: DatabaseContextSchema,
});

// Schema for findAllRelatedEntities tool
const FindAllRelatedEntitiesArgumentsSchema = z.object({
  sourceEntity: z.string().min(1, "Source entity name is required"),
  sourceType: z.enum(["gene", "disease", "chemical", "species", "cellline", "variant"]),
  relationshipTypes: z.array(z.enum(["associate", "inhibit", "negative_correlate", "positive_correlate", "interact", "stimulate"])).optional(),
  maxResults: z.number().min(1).max(100).optional().default(30),
  databaseContext: DatabaseContextSchema,
});

// Schema for findPublicationsForRelationship tool
const FindPublicationsForRelationshipArgumentsSchema = z.object({
  entity1Id: z.string().min(1, "Entity 1 ID is required"),
  entity1Name: z.string().min(1, "Entity 1 name is required"),
  entity2Id: z.string().min(1, "Entity 2 ID is required"),
  entity2Name: z.string().min(1, "Entity 2 name is required"),
  relationshipType: z.enum(["associate", "inhibit", "stimulate", "interact", "ANY"]).optional().default("ANY"),
  maxResults: z.number().min(1).max(20).optional().default(10)
});

// Schema for findPublicationsByTerm tool
const FindPublicationsByTermArgumentsSchema = z.object({
  searchTerm: z.string().min(1, "Search term is required"),
  maxResults: z.number().min(1).optional().default(10).transform((val) => Math.min(val, 50)), // Clamp to 50 max
  addEntitiesToGraph: z.boolean().optional().default(false),
  databaseContext: DatabaseContextSchema.optional(),
}).refine((data) => {
  // If addEntitiesToGraph is true, databaseContext is required
  if (data.addEntitiesToGraph && !data.databaseContext) {
    return false;
  }
  return true;
}, {
  message: "databaseContext is required when addEntitiesToGraph is true",
  path: ["databaseContext"]
});

// Schema for findSearchTermPublicationRelationships tool
const FindSearchTermPublicationRelationshipsArgumentsSchema = z.object({
  searchTerm: z.string().min(1, "Search term is required"),
  maxResults: z.number().min(1).optional().default(10).transform((val) => Math.min(val, 50)), // Clamp to 50 max
  relationshipTypes: z.array(z.enum(["Association", "associate", "inhibit", "negative_correlate", "positive_correlate", "interact", "stimulate", "treat", "cause", "cotreat", "convert", "compare", "prevent", "drug_interact"])).optional(),
  databaseContext: DatabaseContextSchema,
});

// Schema for addNodesByName tool
const AddNodesByNameArgumentsSchema = z.object({
  entityNames: z.array(z.string().min(1, "Entity name cannot be empty")).min(1, "At least one entity name is required").max(100, "Maximum 100 entities per request"),
  conceptType: z.enum(["gene", "disease", "chemical", "species", "cellline", "variant", "mutation", "snp", "protein"]).optional(),
  databaseContext: DatabaseContextSchema,
});

// =============================================================================
// PUBTATOR API FUNCTIONS
// =============================================================================
/**
 * Submit text for annotation using PubTator's RESTful endpoint (for free text)
 * This uses the legacy RESTful endpoint since PubTator3 doesn't have a direct POST /annotations/ endpoint
 */
async function annotateTextRESTful(text: string, bioconcepts: string[]): Promise<any> {
  const RESTFUL_BASE_URL = "https://www.ncbi.nlm.nih.gov/CBBresearch/Lu/Demo/RESTful";
  
  // Step 1: Submit text for annotation
  // Convert concepts array to comma-separated string (PubTator expects comma-separated or single value)
  // Use all concepts joined with comma, or just the first if we need a single value
  const bioconcept = bioconcepts.length > 0 ? bioconcepts.join(',') : 'Gene,Disease,Chemical';
  
  const submitUrl = `${RESTFUL_BASE_URL}/request.cgi`;
  const submitBody = new URLSearchParams({
    text: text,
    bioconcept: bioconcept
  });

  const submitResponse = await fetch(submitUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: submitBody.toString()
  });

  if (!submitResponse.ok) {
    throw new Error(`Failed to submit text for annotation: ${submitResponse.status} ${submitResponse.statusText}`);
  }

  const sessionData = await submitResponse.json();
  const sessionId = sessionData.id;

  if (!sessionId) {
    throw new Error('No session ID returned from PubTator annotation service');
  }

  console.error(`[PubTator] Submitted text for annotation. Session ID: ${sessionId}`);

  // Step 2: Poll for results (with timeout)
  const maxAttempts = 30; // Try for up to 30 seconds
  const pollInterval = 2000; // 2 seconds between attempts (give more time for processing)
  const initialWait = 3000; // Wait 3 seconds before first attempt to give API time to process

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    // IMPORTANT: Always wait before attempting retrieval to give PubTator time to process
    // Use longer wait on first attempt
    const waitTime = attempt === 0 ? initialWait : pollInterval;
    await new Promise(resolve => setTimeout(resolve, waitTime));
    
    const retrieveUrl = `${RESTFUL_BASE_URL}/retrieve.cgi`;
    const retrieveBody = new URLSearchParams({
      id: sessionId
    });

    try {
      const retrieveResponse = await fetch(retrieveUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: retrieveBody.toString()
      });

      // If 404, result is not ready yet (expected during processing - per PubTator API docs)
      if (retrieveResponse.status === 404) {
        console.error(`[PubTator] Attempt ${attempt + 1}/${maxAttempts}: Result not ready yet (404), will retry...`);
        continue;
      }

      // If 400, might be invalid session ID, expired session, or request format issue
      // The API sometimes returns 400 during processing, so we retry with exponential backoff
      if (retrieveResponse.status === 400) {
        const errorText = await retrieveResponse.text();
        console.error(`[PubTator] Attempt ${attempt + 1}/${maxAttempts}: Got 400 error`);

        // Check if it's an HTML error page (means endpoint rejected request)
        if (errorText.includes('400 Error') || errorText.includes('Bad Request')) {
          // If this is early in our attempts, the session might just need more time
          if (attempt < 3) {
            console.error(`[PubTator] Early 400 error, session might need more processing time. Retrying...`);
            continue;
          }
          // After several attempts, if still getting 400, the session is likely invalid/expired
          if (attempt < maxAttempts - 1) {
            console.error(`[PubTator] Continuing to retry despite 400 error (attempt ${attempt + 1}/${maxAttempts})`);
            continue;
          }
          throw new Error(`PubTator API returned 400 error after ${maxAttempts} attempts. The session may have expired, the endpoint may be unavailable, or the request format is incorrect. Session ID: ${sessionId}`);
        }
        throw new Error(`Bad request to PubTator service: ${errorText.substring(0, 200)}`);
      }

      if (!retrieveResponse.ok) {
        const errorText = await retrieveResponse.text();
        throw new Error(`Failed to retrieve annotation results: ${retrieveResponse.status} ${retrieveResponse.statusText}. ${errorText.substring(0, 200)}`);
      }

      // Check content type - might be HTML error or JSON
      const contentType = retrieveResponse.headers.get('content-type') || '';
      const responseText = await retrieveResponse.text();
      
      // If HTML, it's likely an error page
      if (contentType.includes('text/html') || responseText.trim().startsWith('<!')) {
        if (attempt < maxAttempts - 1) {
          continue; // Retry if we haven't exhausted attempts
        }
        throw new Error(`PubTator service returned HTML error page. The endpoint may not be available or the session expired.`);
      }

      // Try to parse as JSON (BioC format)
      try {
        const biocData = JSON.parse(responseText);
        console.error(`[PubTator] Successfully retrieved and parsed annotation results after ${attempt + 1} attempt(s)`);
        return biocData;
      } catch (parseError) {
        // If not JSON, might be other format - check if it looks like BioC
        if (responseText.includes('collection') || responseText.includes('documents') || responseText.includes('passages')) {
          // Might be valid but not JSON - try parsing differently
          throw new Error(`Unexpected response format from PubTator service. Expected JSON but got: ${contentType}`);
        }
        throw new Error(`Failed to parse PubTator response as JSON. Response: ${responseText.substring(0, 200)}`);
      }
    } catch (error: any) {
      // If it's a 404 or "not ready" error, continue polling
      if (error.message?.includes('404') || error.message?.includes('not ready')) {
        continue;
      }
      // If it's a network error, retry
      if (error.message?.includes('fetch') || error.message?.includes('network')) {
        if (attempt < maxAttempts - 1) {
          continue;
        }
      }
      throw error;
    }
  }

  throw new Error('Timeout waiting for annotation results after 30 attempts');
}

// Parse BioC JSON format for free text (no PMID required)
function parseBiocJsonForText(biocData: any): ParsedPublication[] {
  // RESTful endpoint returns BioC format, may be in different structure than PubTator3 export
  // Check for common BioC structures
  const documents = biocData?.PubTator3 || biocData?.documents || (biocData?.collection ? [biocData.collection] : []);
  
  // If it's a single document object, wrap it
  let docsToProcess: any[] = [];
  if (Array.isArray(documents)) {
    docsToProcess = documents;
  } else if (documents && typeof documents === 'object') {
    docsToProcess = [documents];
  } else if (biocData && typeof biocData === 'object' && !biocData.PubTator3 && !biocData.documents && !biocData.collection) {
    // Might be a direct document object
    docsToProcess = [biocData];
  }
  
  if (docsToProcess.length === 0) {
    console.error(`[${SERVICE_NAME}] parseBiocJsonForText: No documents found. Data structure:`, {
      dataKeys: biocData ? Object.keys(biocData) : [],
      dataType: typeof biocData,
      isArray: Array.isArray(biocData)
    });
    return [];
  }

  const publications: ParsedPublication[] = [];

  for (const doc of docsToProcess) {
    // For free text, we don't require a PMID - use empty string or generated ID
    let pmid = '';
    if (doc.infons?.article_id_pmid) {
      pmid = doc.infons.article_id_pmid;
    } else if (doc.id && doc.id.match(/\d+/)) {
      pmid = doc.id;
    } else {
      pmid = 'text_' + Date.now(); // Generate a temporary ID for text annotations
    }

    let textContent = '';
    const entities: Map<string, { id: string; name: string; type: string; pubtatorId: string }> = new Map();

    // Process all passages (for free text, we want all content)
    for (const passage of doc.passages || []) {
      const passageType = passage.infons?.type || '';
      
      // Collect all text content
      if (passage.text) {
        textContent += passage.text + ' ';
      }

      // Extract entity annotations from all passages
      for (const annotation of passage.annotations || []) {
        const entityType = annotation.infons?.type?.toLowerCase() || '';
        const entityId = annotation.infons?.identifier || annotation.id || '';
        const entityName = annotation.text || '';
        
        // Skip if we don't have enough info
        if (!entityId || !entityName || !entityType) continue;

        // Create PubTator ID format (e.g., @GENE_123)
        const pubtatorId = `@${entityType.toUpperCase()}_${entityId}`;

        // Use PubTator ID as key to avoid duplicates
        if (!entities.has(pubtatorId)) {
          entities.set(pubtatorId, {
            id: pubtatorId,
            name: entityName,
            type: entityType,
            pubtatorId: pubtatorId
          });
        }
      }
    }

    // Extract document-level relations (PRE-EXTRACTED by PubTator)
    const relations: ParsedPublicationRelation[] = [];
    if (doc.relations && Array.isArray(doc.relations)) {
      for (const relation of doc.relations) {
        const relationType = relation.infons?.type || '';
        const role1 = relation.infons?.role1;
        const role2 = relation.infons?.role2;
        
        // Skip if missing required data
        if (!relationType || !role1?.accession || !role2?.accession) {
          continue;
        }

        relations.push({
          type: relationType,
          entity1Id: role1.accession,
          entity1Name: role1.name || role1.accession,
          entity1Type: role1.type?.toLowerCase() || '',
          entity2Id: role2.accession,
          entity2Name: role2.name || role2.accession,
          entity2Type: role2.type?.toLowerCase() || '',
          score: relation.infons?.score
        });
      }
    }

    publications.push({
      pmid,
      abstract: textContent.trim(),
      entities: Array.from(entities.values()),
      relations: relations.length > 0 ? relations : undefined
    });
  }

  return publications;
}

// Make PubTator API request
async function makePubTatorRequest(
  endpoint: string, 
  method: 'GET' | 'POST' = 'GET', 
  body?: any, 
  params?: Record<string, any>
): Promise<any> {
  const url = new URL(`${PUBTATOR_BASE_URL}${endpoint}`);
  
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

  // Add API key if available (optional - PubTator API works without authentication)
  if (PUBTATOR_API_KEY) {
    headers['X-API-Key'] = PUBTATOR_API_KEY;
  }

  // Add user email if available (optional - PubTator API works without authentication)
  if (PUBTATOR_USER_EMAIL) {
    headers['X-User-Email'] = PUBTATOR_USER_EMAIL;
  }

  // Only add Content-Type for POST requests
  if (method === 'POST') {
    headers['Content-Type'] = 'application/json';
  }

  // console.error(`[${SERVICE_NAME}] Making PubTator request to: ${url.toString()}`);

  try {
    const requestOptions: RequestInit = {
      method,
      headers,
    };

    if (method === 'POST' && body) {
      requestOptions.body = JSON.stringify(body);
    }

    const response = await fetch(url.toString(), requestOptions);
    // console.error(`[${SERVICE_NAME}] Response status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`PubTator resource not found: ${endpoint}`);
      }
      if (response.status === 400) {
        const errorText = await response.text();
        throw new Error(`Invalid PubTator request: ${errorText}`);
      }
      if (response.status === 413) {
        throw new Error(`Text too long. Maximum 100,000 characters allowed.`);
      }
      if (response.status === 429) {
        throw new Error(`Rate limit exceeded. Please wait before retrying.`);
      }
      if (response.status === 500) {
        throw new Error(`Internal server error in PubTator service.`);
      }
      throw new Error(`PubTator request failed: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`[${SERVICE_NAME}] PubTator request error:`, error);
    throw error;
  }
}

// Make API request to Graph Mode backend
async function makeGraphModeAPIRequest(
  endpoint: string, 
  databaseContext: DatabaseContext, 
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET', 
  body?: any
): Promise<any> {
  const apiBaseUrl = databaseContext.apiBaseUrl || "http://localhost:3001";
  const url = `${apiBaseUrl}${endpoint}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (databaseContext.accessToken) {
    headers['Authorization'] = `Bearer ${databaseContext.accessToken}`;
  }

  // console.error(`[${SERVICE_NAME}] Making Graph Mode API request to: ${url}`);

  try {
    const requestOptions: RequestInit = {
      method,
      headers,
    };

    if (body && (method === 'POST' || method === 'DELETE')) {
      requestOptions.body = JSON.stringify(body);
    }

    const response = await fetch(url, requestOptions);
    // console.error(`[${SERVICE_NAME}] Graph Mode API response status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Graph Mode API request failed: ${response.status} ${response.statusText} - ${errorText}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`[${SERVICE_NAME}] Graph Mode API request error:`, error);
    throw error;
  }
}

// Entity autocomplete helper function
async function getEntityAutocomplete(query: string, concept?: string): Promise<PubTatorEntity[]> {
  let endpoint = `/entity/autocomplete/?query=${encodeURIComponent(query)}`;
  if (concept) {
    endpoint += `&concept=${concept}`;
  }
  const response = await makePubTatorRequest(endpoint);
  
  if (!Array.isArray(response)) {
    return [];
  }
  
  // Map PubTator response format to our interface
  // PubTator returns _id (already in @TYPE_ID format), but our interface expects id
  // Note: type might be undefined, but biotype might have the value
  return response.map((entity: any) => ({
    id: entity._id,  // Map _id to id (already formatted like @GENE_FAM177A1)
    name: entity.name,
    type: entity.type || entity.biotype || 'gene', // Use biotype as fallback
    mentions: entity.mentions
  }));
}

// Get entity relationships helper function
async function getEntityRelations(
  entityId: string, 
  maxResults: number = 100, 
  relationshipTypes?: string[]
): Promise<PubTatorRelation[]> {
  const endpoint = `/relations?e1=${encodeURIComponent(entityId)}`;
  const response = await makePubTatorRequest(endpoint);
  
  if (!Array.isArray(response)) {
    return [];
  }

  // Map PubTator response format to our interface
  // PubTator returns source/target, but our interface expects e1/e2
  let relations = response.map((rel: any) => ({
    id: rel.id || `${rel.source}_${rel.target}_${rel.type}`,
    type: rel.type,
    e1: rel.source,  // Map source to e1
    e2: rel.target,  // Map target to e2
    pmid: rel.pmid
  }));

  // console.error(`🔥 [PUBTATOR-DEBUG] Raw PubTator API response for ${entityId}:`, JSON.stringify(response, null, 2));
  // console.error(`🔥 [PUBTATOR-DEBUG] Mapped relations:`, JSON.stringify(relations, null, 2));

  // Filter by relationship types if specified
  if (relationshipTypes && relationshipTypes.length > 0) {
    relations = relations.filter((rel: PubTatorRelation) => relationshipTypes.includes(rel.type));
  }

  // Limit results
  return relations.slice(0, maxResults);
}

// =============================================================================
// BIOC JSON PARSING FUNCTIONS
// =============================================================================
interface BioCAnnotation {
  id: string;
  infons: {
    type: string;
    identifier?: string;
    [key: string]: any;
  };
  locations: Array<{
    offset: number;
    length: number;
  }>;
  text: string;
}

interface BioCPassage {
  infons: {
    type: string;
    [key: string]: any;
  };
  text: string;
  annotations?: BioCAnnotation[];
}

interface BioCRelation {
  id: string;
  infons: {
    type: string;
    score?: string;
    role1: {
      accession: string;
      name: string;
      type: string;
      [key: string]: any;
    };
    role2: {
      accession: string;
      name: string;
      type: string;
      [key: string]: any;
    };
    [key: string]: any;
  };
  nodes?: any[];
}

interface BioCDocument {
  id: string;
  infons: {
    [key: string]: any;
  };
  passages: BioCPassage[];
  relations?: BioCRelation[];
}

interface BioCCollection {
  documents: BioCDocument[];
}

interface ParsedPublicationRelation {
  type: string;
  entity1Id: string;
  entity1Name: string;
  entity1Type: string;
  entity2Id: string;
  entity2Name: string;
  entity2Type: string;
  score?: string;
}

interface ParsedPublication {
  pmid: string;
  abstract: string;
  entities: Array<{
    id: string;
    name: string;
    type: string;
    pubtatorId: string;
  }>;
  relations?: ParsedPublicationRelation[];
}

// Parse BioC JSON format to extract abstracts and entity annotations
function parseBiocJson(biocData: any): ParsedPublication[] {
  // PubTator API returns data in PubTator3 field, not documents
  const documents = biocData?.PubTator3 || biocData?.documents || [];
  
  if (!Array.isArray(documents) || documents.length === 0) {
    console.error(`[${SERVICE_NAME}] parseBiocJson: No documents found. Data structure:`, {
      hasPubTator3: !!biocData?.PubTator3,
      hasDocuments: !!biocData?.documents,
      dataKeys: biocData ? Object.keys(biocData) : []
    });
    return [];
  }

  const publications: ParsedPublication[] = [];

  for (const doc of documents) {
    // Extract PMID from various possible locations
    let pmid = '';
    if (doc.infons?.article_id_pmid) {
      pmid = doc.infons.article_id_pmid;
    } else if (doc.infons?.['article-id_pmid']) {
      pmid = doc.infons['article-id_pmid'];
    } else if (doc.id) {
      // ID might be in format "PMID:123" or "123|PMC123" or just "123"
      const idStr = doc.id.toString();
      const pmidMatch = idStr.match(/PMID:?(\d+)/) || idStr.match(/^(\d+)(?:\|PMC\d+)?$/);
      if (pmidMatch) {
        pmid = pmidMatch[1];
      } else {
        pmid = idStr.split('|')[0]; // Try first part if separated by |
      }
    }
    
    if (!pmid) {
      console.error(`[${SERVICE_NAME}] parseBiocJson: Could not extract PMID from document:`, {
        id: doc.id,
        infons: doc.infons
      });
      continue;
    }

    let abstractText = '';
    const entities: Map<string, { id: string; name: string; type: string; pubtatorId: string }> = new Map();

    // Iterate through passages to find abstract and collect annotations
    // Only process entities from 'title' and 'abstract' passages to avoid overwhelming the graph
    // with entities from full-text sections (introduction, methods, results, discussion, etc.)
    const allowedPassageTypes = ['title', 'abstract'];
    
    for (const passage of doc.passages || []) {
      const passageType = passage.infons?.type || '';
      
      // Collect abstract text (usually in passages with type "abstract")
      if (passageType === 'abstract' || (passageType === '' && passage.text)) {
        abstractText += passage.text || '';
      }

      // Extract entity annotations - ONLY from title and abstract passages
      if (allowedPassageTypes.includes(passageType.toLowerCase())) {
        for (const annotation of passage.annotations || []) {
          // BioC JSON structure: annotation.infons contains accession (PubTator ID), name, type
          const pubtatorId = annotation.infons?.accession || '';
          const entityName = annotation.infons?.name || annotation.text || '';
          const entityType = (annotation.infons?.type || '').toLowerCase();
          
          // Skip if we don't have enough info (need at least pubtatorId or name+type)
          if (!pubtatorId && (!entityName || !entityType)) continue;

          // If we have accession (PubTator ID), use it directly; otherwise construct it
          const finalPubtatorId = pubtatorId || (entityType ? `@${entityType.toUpperCase()}_${annotation.infons?.identifier || annotation.id || 'unknown'}` : '');
          
          if (!finalPubtatorId) continue;

          // Use PubTator ID as key to avoid duplicates
          if (!entities.has(finalPubtatorId)) {
            entities.set(finalPubtatorId, {
              id: finalPubtatorId,
              name: entityName,
              type: entityType,
              pubtatorId: finalPubtatorId
            });
          }
        }
      }
    }

    // Extract document-level relations (PRE-EXTRACTED by PubTator)
    const relations: ParsedPublicationRelation[] = [];
    if (doc.relations && Array.isArray(doc.relations)) {
      for (const relation of doc.relations) {
        const relationType = relation.infons?.type || '';
        const role1 = relation.infons?.role1;
        const role2 = relation.infons?.role2;
        
        // Skip if missing required data
        if (!relationType || !role1?.accession || !role2?.accession) {
          continue;
        }

        relations.push({
          type: relationType,
          entity1Id: role1.accession,
          entity1Name: role1.name || role1.accession,
          entity1Type: role1.type?.toLowerCase() || '',
          entity2Id: role2.accession,
          entity2Name: role2.name || role2.accession,
          entity2Type: role2.type?.toLowerCase() || '',
          score: relation.infons?.score
        });
      }
    }

    publications.push({
      pmid,
      abstract: abstractText.trim(),
      entities: Array.from(entities.values()),
      relations: relations.length > 0 ? relations : undefined
    });
  }

  return publications;
}

// Extract unique entities from parsed publications
function extractUniqueEntities(publications: ParsedPublication[]): Array<{
  id: string;
  name: string;
  type: string;
  pubtatorId: string;
}> {
  const entityMap = new Map<string, { id: string; name: string; type: string; pubtatorId: string }>();

  for (const pub of publications) {
    for (const entity of pub.entities) {
      if (!entityMap.has(entity.pubtatorId)) {
        entityMap.set(entity.pubtatorId, entity);
      }
    }
  }

  return Array.from(entityMap.values());
}

// =============================================================================
// NODE CREATION FUNCTIONS
// =============================================================================
// Create node in Graph Mode database
async function createNodeInDatabase(nodeData: Omit<NodeData, 'id'>, databaseContext: DatabaseContext): Promise<any> {
  // console.error(`🔥 [DEBUG] createNodeInDatabase called with:`, JSON.stringify(nodeData, null, 2));
  // console.error(`🔥 [DEBUG] Entity type: ${nodeData.type}`);
  
  const endpoint = `/api/graph/${databaseContext.conversationId}/nodes`;
  
  // Use PubTator ID as the canonical ID (like mock data does)
  const nodeWithId: NodeData = {
    id: nodeData.data?.pubtatorId || `pubtator_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    ...nodeData
  };

  // console.error(`[${SERVICE_NAME}] 🔍 Creating node with ID: ${nodeWithId.id}`);
  // console.error(`[${SERVICE_NAME}] 🔍 Node structure:`, JSON.stringify(nodeWithId, null, 2));
  // console.error(`[${SERVICE_NAME}] 🔍 Database context:`, JSON.stringify(databaseContext, null, 2));
  
  const result = await makeGraphModeAPIRequest(endpoint, databaseContext, 'POST', nodeWithId);
  // console.error(`[${SERVICE_NAME}] ✅ Node created successfully:`, result);
  return result;
}

// Create edge in Graph Mode database
async function createEdgeInDatabase(edgeData: EdgeData, databaseContext: DatabaseContext): Promise<any> {
  const endpoint = `/api/graph/${databaseContext.conversationId}/edges`;
  
  // console.error(`[${SERVICE_NAME}] 🔍 Creating edge: ${edgeData.source} → ${edgeData.target}`);
  // console.error(`[${SERVICE_NAME}] 🔍 Edge structure:`, JSON.stringify(edgeData, null, 2));
  
  const result = await makeGraphModeAPIRequest(endpoint, databaseContext, 'POST', edgeData);
  // console.error(`[${SERVICE_NAME}] ✅ Edge created successfully:`, result);
  return result;
}

/**
 * Bulk create nodes in Graph Mode database
 */
async function bulkCreateNodesInDatabase(
  nodes: Omit<NodeData, 'id'>[],
  databaseContext: DatabaseContext
): Promise<{ created: number; skipped: number; total: number }> {
  if (nodes.length === 0) {
    return { created: 0, skipped: 0, total: 0 };
  }

  const endpoint = `/api/graph/${databaseContext.conversationId}/nodes/bulk`;
  
  // Add IDs to nodes
  const nodesWithIds: NodeData[] = nodes.map(node => ({
    id: node.data?.pubtatorId || `pubtator_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    ...node
  }));

  // Batch nodes in groups of 500 to avoid payload size limits
  const batchSize = 500;
  let totalCreated = 0;
  let totalSkipped = 0;

  for (let i = 0; i < nodesWithIds.length; i += batchSize) {
    const batch = nodesWithIds.slice(i, i + batchSize);
    
    const result = await makeGraphModeAPIRequest(
      endpoint,
      databaseContext,
      'POST',
      { nodes: batch }
    );
    
    totalCreated += result.created || 0;
    totalSkipped += result.skipped || 0;
  }

  return {
    created: totalCreated,
    skipped: totalSkipped,
    total: nodesWithIds.length
  };
}

/**
 * Fetch existing edges from the graph database
 */
async function getExistingEdges(
  databaseContext: DatabaseContext,
  labelFilter?: string
): Promise<Map<string, EdgeData>> {
  try {
    const endpoint = `/api/graph/${databaseContext.conversationId}/state`;
    const result = await makeGraphModeAPIRequest(endpoint, databaseContext, 'GET');
    
    if (!result || !result.success || !result.data || !result.data.edges) {
      return new Map();
    }

    const edgeMap = new Map<string, EdgeData>();
    
    // Process edges and create a map by composite ID
    for (const edge of result.data.edges) {
      // Parse the edge data (stored as JSON string in database)
      const edgeData = typeof edge.data === 'string' ? JSON.parse(edge.data) : edge.data;
      
      // Only process edges from pubtator source
      if (edgeData?.source === 'pubtator' && edgeData?.primary_source === 'pubtator') {
        // If labelFilter is provided, only include edges with that label
        // Otherwise, include all pubtator edges
        if (labelFilter && edge.label !== labelFilter) {
          continue;
        }
        
        const edgeLabel = edge.label || edgeData.type || 'publishedTogether';
        const edgeId = generateCompositeEdgeId(
          databaseContext.conversationId,
          'pubtator',
          'pubtator',
          edge.source,
          edgeLabel,
          edge.target
        );
        
        edgeMap.set(edgeId, {
          id: edgeId,
          source: edge.source,
          target: edge.target,
          label: edgeLabel,
          data: {
            type: edgeData.type || edgeLabel,
            source: edgeData.source || 'pubtator',
            primary_source: edgeData.primary_source || 'pubtator',
            publications: edgeData.publications || []
          }
        });
      }
    }
    
    return edgeMap;
  } catch (error) {
    console.error(`[${SERVICE_NAME}] Error fetching existing edges:`, error);
    return new Map();
  }
}

/**
 * Merge publications arrays, removing duplicates
 */
function mergePublications(existing: string[], newPMIDs: string[]): string[] {
  const merged = new Set([...existing, ...newPMIDs]);
  return Array.from(merged).sort(); // Sort for consistent ordering
}

/**
 * Bulk create edges in Graph Mode database
 */
async function bulkCreateEdgesInDatabase(
  edges: EdgeData[],
  databaseContext: DatabaseContext
): Promise<{ created: number; skipped: number; total: number }> {
  if (edges.length === 0) {
    return { created: 0, skipped: 0, total: 0 };
  }

  const endpoint = `/api/graph/${databaseContext.conversationId}/edges/bulk`;

  // Batch edges in groups of 500 to avoid payload size limits
  const batchSize = 500;
  let totalCreated = 0;
  let totalSkipped = 0;

  for (let i = 0; i < edges.length; i += batchSize) {
    const batch = edges.slice(i, i + batchSize);
    
    const result = await makeGraphModeAPIRequest(
      endpoint,
      databaseContext,
      'POST',
      { edges: batch }
    );
    
    totalCreated += result.created || 0;
    totalSkipped += result.skipped || 0;
  }

  return {
    created: totalCreated,
    skipped: totalSkipped,
    total: edges.length
  };
}

/**
 * Bulk update edges in Graph Mode database
 */
async function bulkUpdateEdgesInDatabase(
  edges: EdgeData[],
  databaseContext: DatabaseContext
): Promise<{ updated: number; failed: number; total: number }> {
  if (edges.length === 0) {
    return { updated: 0, failed: 0, total: 0 };
  }

  const endpoint = `/api/graph/${databaseContext.conversationId}/edges/bulk-update`;

  // Batch edges in groups of 500 to avoid payload size limits
  const batchSize = 500;
  let totalUpdated = 0;
  let totalFailed = 0;

  for (let i = 0; i < edges.length; i += batchSize) {
    const batch = edges.slice(i, i + batchSize);
    
    try {
      const result = await makeGraphModeAPIRequest(
        endpoint,
        databaseContext,
        'PUT',
        { edges: batch }
      );
      
      totalUpdated += result.updated || 0;
      totalFailed += result.failed || 0;
    } catch (error) {
      console.error(`[${SERVICE_NAME}] Error updating edges batch:`, error);
      totalFailed += batch.length;
    }
  }

  return {
    updated: totalUpdated,
    failed: totalFailed,
    total: edges.length
  };
}

// Entity type classification based on entity type
function getEntityType(entityType: string): EntityType {
  switch (entityType.toLowerCase()) {
    case 'gene':
      return { type: 'Gene', group: 2 };
    case 'disease':
      return { type: 'Disease', group: 3 };
    case 'chemical':
      return { type: 'Drug', group: 1 };
    case 'species':
      return { type: 'Species', group: 4 };
    case 'mutation':
      return { type: 'Mutation', group: 5 };
    case 'cellline':
      return { type: 'Cell Line', group: 6 };
    case 'snp':
      return { type: 'SNP', group: 7 };
    case 'protein':
      return { type: 'Protein', group: 8 };
    default:
      return { type: 'Other', group: 9 };
  }
}

// Helper function to extract entity type from entity ID
function getEntityTypeFromId(entityId: string): EntityType {
  if (entityId.startsWith('@GENE_')) return { type: 'Gene', group: 2 };
  if (entityId.startsWith('@DISEASE_')) return { type: 'Disease', group: 3 };
  if (entityId.startsWith('@CHEMICAL_')) return { type: 'Drug', group: 1 };
  if (entityId.startsWith('@SPECIES_')) return { type: 'Species', group: 4 };
  if (entityId.startsWith('@CELLLINE_')) return { type: 'Cell Line', group: 6 };
  if (entityId.startsWith('@VARIANT_')) return { type: 'Variant', group: 7 };
  return { type: 'Other', group: 9 };
}

// Helper function to extract entity name from entity ID
function extractEntityName(entityId: string): string {
  return entityId.replace(/^@[A-Z]+_/, '').replace(/_/g, ' ');
}

// Helper function to map relationship types to human-readable labels
function mapRelationshipType(relationType: string): string {
  // Normalize to lowercase for comparison (BioC JSON uses "Association", API uses lowercase)
  const normalizedType = relationType.toLowerCase();
  
  const mapping: Record<string, string> = {
    'association': 'associated_with',
    'associate': 'associated_with',
    'inhibit': 'inhibits',
    'negative_correlate': 'negatively_correlates_with',
    'positive_correlate': 'positively_correlates_with',
    'interact': 'interacts_with',
    'stimulate': 'stimulates',
    'treat': 'treats',
    'cause': 'causes',
    'cotreat': 'cotreats',
    'convert': 'converts',
    'compare': 'compares',
    'prevent': 'prevents',
    'drug_interact': 'drug_interacts_with'
  };
  
  // Return mapped type or original if not found
  return mapping[normalizedType] || normalizedType;
}

/**
 * Generate composite edge ID for deduplication
 * Format: graphId|data.source|primary_source|source|label|target
 */
function generateCompositeEdgeId(
  graphId: string,
  dataSource: string,
  primarySource: string,
  source: string,
  label: string,
  target: string
): string {
  return [graphId, dataSource, primarySource, source, label, target].join('|');
}

// =============================================================================
// MCP SERVER SETUP
// =============================================================================
// Create the MCP server
const server = new Server({
  name: TOOL_NAME,
  version: "1.0.0",
}, {
  capabilities: {
    tools: {},
  },
});

// Define tools
const tools = [
  {
    name: "addNodesFromPMIDs",
    description: "Extract biomedical entities from PubMed articles by PMIDs and add them as nodes to the Graph Mode knowledge graph. Creates nodes for genes, diseases, chemicals, and other entities found in the literature.",
    inputSchema: {
      type: "object",
      properties: {
        pmids: {
          type: "array",
          items: { type: "string" },
          minItems: 1,
          maxItems: MAX_BATCH_SIZE,
          description: `Array of PubMed IDs (PMIDs) to annotate (max ${MAX_BATCH_SIZE})`
        },
        concepts: {
          type: "array",
          items: {
            type: "string",
            enum: ["gene", "disease", "chemical", "species", "mutation", "cellline", "snp", "protein"]
          },
          description: "Types of biomedical concepts to extract (default: gene, disease, chemical)"
        },
        databaseContext: {
          type: "object",
          properties: {
            conversationId: { type: "string" },
            artifactId: { type: "string" },
            apiBaseUrl: { type: "string" },
            accessToken: { type: "string" }
          },
          required: ["conversationId"]
        }
      },
      required: ["pmids", "databaseContext"]
    }
  },
  {
    name: "addNodesAndEdgesFromText",
    description: "Extract biomedical entities and their relationships from free text and add them to the Graph Mode knowledge graph. Uses PubTator's text annotation service to identify genes, diseases, chemicals, and other entities, as well as relationships between them. Note: This tool uses PubTator's legacy RESTful endpoint which may be unreliable or unavailable. If this tool fails, consider using findPublicationsByTerm to search for publications containing your text, then addNodesFromPMIDs to extract entities from specific publications.",
    inputSchema: {
      type: "object",
      properties: {
        text: {
          type: "string",
          minLength: 1,
          maxLength: 100000,
          description: "Text to analyze for biomedical entities (max 100,000 characters)"
        },
        concepts: {
          type: "array",
          items: {
            type: "string",
            enum: ["gene", "disease", "chemical", "species", "mutation", "cellline", "snp", "protein"]
          },
          description: "Types of biomedical concepts to extract (default: gene, disease, chemical)"
        },
        databaseContext: {
          type: "object",
          properties: {
            conversationId: { type: "string" },
            artifactId: { type: "string" },
            apiBaseUrl: { type: "string" },
            accessToken: { type: "string" }
          },
          required: ["conversationId"]
        }
      },
      required: ["text", "databaseContext"]
    }
  },
  {
    name: "addNodesFromEntityNetwork",
    description: "Build a network of related biomedical entities by searching for entities and their relationships. Creates nodes and edges showing how entities are connected in the literature.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          minLength: 1,
          description: "Search query to find entities (e.g., 'BRCA1', 'cancer', 'insulin')"
        },
        concept: {
          type: "string",
          enum: ["gene", "disease", "chemical", "species", "cellline", "variant"],
          description: "Type of entity to search for"
        },
        max_entities: {
          type: "number",
          minimum: 1,
          maximum: 50,
          default: 20,
          description: "Maximum number of entities to find (default: 20)"
        },
        max_relations_per_entity: {
          type: "number",
          minimum: 10,
          maximum: 500,
          default: 200,
          description: "Maximum number of relationships per entity (default: 200)"
        },
        relationship_types: {
          type: "array",
          items: {
            type: "string",
            enum: ["associate", "inhibit", "negative_correlate", "positive_correlate", "interact", "stimulate"]
          },
          description: "Optional: Filter by specific relationship types. If not specified, all relationship types are included."
        },
        databaseContext: {
          type: "object",
          properties: {
            conversationId: { type: "string" },
            artifactId: { type: "string" },
            apiBaseUrl: { type: "string" },
            accessToken: { type: "string" }
          },
          required: ["conversationId"]
        }
      },
      required: ["query", "concept", "databaseContext"]
    }
  },
  {
    name: "findRelatedEntities",
    description: "Find all entities of a specific type that are related to a given entity (e.g., find all genes related to a specific gene, or all diseases related to a chemical). Uses PubTator's relationship database to discover connections and adds them to the Graph Mode knowledge graph.",
    inputSchema: {
      type: "object",
      properties: {
        sourceEntity: {
          type: "string",
          minLength: 1,
          description: "Name of the source entity to find relationships from (e.g., 'FAM177A1', 'BRCA1', 'cancer')"
        },
        sourceType: {
          type: "string",
          enum: ["gene", "disease", "chemical", "species", "cellline", "variant"],
          description: "Type of the source entity"
        },
        targetType: {
          type: "string",
          enum: ["gene", "disease", "chemical", "species", "cellline", "variant"],
          description: "Type of entities to find relationships to (e.g., 'gene' to find all genes related to the source)"
        },
        relationshipTypes: {
          type: "array",
          items: {
            type: "string",
            enum: ["associate", "inhibit", "negative_correlate", "positive_correlate", "interact", "stimulate"]
          },
          description: "Optional: Filter by specific relationship types. If not specified, all relationship types are included."
        },
        maxResults: {
          type: "number",
          minimum: 1,
          maximum: 100,
          default: 20,
          description: "Maximum number of related entities to find and add to the graph (default: 20)"
        },
        databaseContext: {
          type: "object",
          properties: {
            conversationId: { type: "string" },
            artifactId: { type: "string" },
            apiBaseUrl: { type: "string" },
            accessToken: { type: "string" }
          },
          required: ["conversationId"]
        }
      },
      required: ["sourceEntity", "sourceType", "targetType", "databaseContext"]
    }
  },
  {
    name: "findAllRelatedEntities",
    description: "Find ALL entities related to a given entity across all types (genes, diseases, chemicals, etc.). Creates a comprehensive network showing all relationships regardless of entity type. Perfect for exploring the full relationship network of an entity.",
    inputSchema: {
      type: "object",
      properties: {
        sourceEntity: {
          type: "string",
          minLength: 1,
          description: "Name of the source entity to find relationships from (e.g., 'FAM177A1', 'BRCA1', 'cancer')"
        },
        sourceType: {
          type: "string",
          enum: ["gene", "disease", "chemical", "species", "cellline", "variant"],
          description: "Type of the source entity"
        },
        relationshipTypes: {
          type: "array",
          items: {
            type: "string",
            enum: ["associate", "inhibit", "negative_correlate", "positive_correlate", "interact", "stimulate"]
          },
          description: "Optional: Filter by specific relationship types. If not specified, all relationship types are included."
        },
        maxResults: {
          type: "number",
          minimum: 1,
          maximum: 100,
          default: 30,
          description: "Maximum number of related entities to find and add to the graph (default: 30)"
        },
        databaseContext: {
          type: "object",
          properties: {
            conversationId: { type: "string" },
            artifactId: { type: "string" },
            apiBaseUrl: { type: "string" },
            accessToken: { type: "string" }
          },
          required: ["conversationId"]
        }
      },
      required: ["sourceEntity", "sourceType", "databaseContext"]
    }
  },
  {
    name: "addNodesByName",
    description: "Look up biomedical entities by name and add them as nodes to the Graph Mode knowledge graph. Accepts a list of entity names (e.g., 'BRCA1', 'TP53', 'EGFR'), looks them up in PubTator, and adds them as individual nodes without creating edges. Perfect for adding specific entities without relationships.",
    inputSchema: {
      type: "object",
      properties: {
        entityNames: {
          type: "array",
          items: { type: "string" },
          minItems: 1,
          maxItems: 100,
          description: "Array of entity names to look up and add (e.g., ['BRCA1', 'TP53', 'EGFR'])"
        },
        conceptType: {
          type: "string",
          enum: ["gene", "disease", "chemical", "species", "cellline", "variant", "mutation", "snp", "protein"],
          description: "Optional: Filter by entity type. If not specified, searches all types and uses the best match for each name."
        },
        databaseContext: {
          type: "object",
          properties: {
            conversationId: { type: "string" },
            artifactId: { type: "string" },
            apiBaseUrl: { type: "string" },
            accessToken: { type: "string" }
          },
          required: ["conversationId"]
        }
      },
      required: ["entityNames", "databaseContext"]
    }
  },
  {
    name: "findPublicationsForRelationship",
    description: "Find publications that discuss the relationship between two biomedical entities. Returns abstracts and bibliography in markdown format.",
    inputSchema: {
      type: "object",
      properties: {
        entity1Id: {
          type: "string",
          description: "First entity ID (e.g., @GENE_MPO)"
        },
        entity1Name: {
          type: "string",
          description: "First entity name for display"
        },
        entity2Id: {
          type: "string",
          description: "Second entity ID (e.g., @DISEASE_Inflammation)"
        },
        entity2Name: {
          type: "string",
          description: "Second entity name for display"
        },
        relationshipType: {
          type: "string",
          enum: ["associate", "inhibit", "stimulate", "interact", "ANY"],
          default: "ANY",
          description: "Type of relationship to search for"
        },
        maxResults: {
          type: "number",
          minimum: 1,
          maximum: 20,
          default: 10,
          description: "Maximum number of publications to return"
        }
      },
      required: ["entity1Id", "entity1Name", "entity2Id", "entity2Name"]
    }
  },
  {
    name: "findPublicationsByTerm",
    description: "Search for publications containing a specific term, retrieve full abstracts, extract entities from abstracts, and optionally add entities to the Graph Mode knowledge graph. Entities from the same publication will be connected by 'publishedTogether' edges if added to the graph.",
    inputSchema: {
      type: "object",
      properties: {
        searchTerm: {
          type: "string",
          minLength: 1,
          description: "Search term to find publications (can be free text like 'BRCA1' or entity ID like '@GENE_672')"
        },
        maxResults: {
          type: "number",
          minimum: 1,
          default: 10,
          description: "Maximum number of publications to retrieve (default: 10). Values over 50 will be automatically clamped to 50."
        },
        addEntitiesToGraph: {
          type: "boolean",
          default: false,
          description: "If true, extract entities from abstracts and add them as nodes to the graph, with 'publishedTogether' edges connecting entities from the same publication"
        },
        databaseContext: {
          type: "object",
          properties: {
            conversationId: { type: "string" },
            artifactId: { type: "string" },
            apiBaseUrl: { type: "string" },
            accessToken: { type: "string" }
          },
          required: ["conversationId"],
          description: "Required when addEntitiesToGraph is true. Database context for graph operations."
        }
      },
      required: ["searchTerm"],
      additionalProperties: false
    }
  },
  {
    name: "findSearchTermPublicationRelationships",
    description: "Search for publications containing a specific term, extract pre-computed relationships between entities from those publications, and add them to the Graph Mode knowledge graph. Creates edges with actual relationship types (Association, inhibit, stimulate, interact, etc.) rather than generic 'publishedTogether' edges. Example: find the edges from papers about FAM177A1.",
    inputSchema: {
      type: "object",
      properties: {
        searchTerm: {
          type: "string",
          minLength: 1,
          description: "Search term to find publications (e.g., 'FAM177A1', gene name, entity name)"
        },
        maxResults: {
          type: "number",
          minimum: 1,
          maximum: 50,
          default: 10,
          description: "Maximum number of publications to process (default: 10, max: 50)"
        },
        relationshipTypes: {
          type: "array",
          items: {
            type: "string",
            enum: ["Association", "associate", "inhibit", "negative_correlate", "positive_correlate", "interact", "stimulate", "treat", "cause", "cotreat", "convert", "compare", "prevent", "drug_interact"]
          },
          description: "Optional: Filter by specific relationship types. If not specified, all relationship types are included."
        },
        databaseContext: {
          type: "object",
          properties: {
            conversationId: { type: "string" },
            artifactId: { type: "string" },
            apiBaseUrl: { type: "string" },
            accessToken: { type: "string" }
          },
          required: ["conversationId"],
          description: "Database context for graph operations"
        }
      },
      required: ["searchTerm", "databaseContext"],
      additionalProperties: false
    }
  }
];

// =============================================================================
// TOOL HANDLERS
// =============================================================================
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  
  try {
    if (name === "addNodesFromPMIDs") {
      const queryParams = AddNodesFromPMIDsArgumentsSchema.parse(args);
      const { pmids, concepts, databaseContext } = queryParams;

      // console.error(`[${SERVICE_NAME}] Processing ${pmids.length} PMIDs for concepts: ${concepts.join(', ')}`);

      // Use bulk export endpoint instead of individual annotation endpoints
      // This endpoint works more reliably and includes relations
      const exportEndpoint = `/publications/export/biocjson?pmids=${pmids.join(',')}&full=true`;
      const biocData = await makePubTatorRequest(exportEndpoint);

      // Parse BioC JSON to extract entities and relations
      const parsedPublications = parseBiocJson(biocData);

      if (parsedPublications.length === 0) {
        return {
          content: [{
            type: "text",
            text: `No annotations found for the provided PMIDs: ${pmids.join(', ')}. The publications may not be available in PubTator.`
          }]
        };
      }

      // Collect all nodes and edges first
      const nodesToCreate: Omit<NodeData, 'id'>[] = [];
      const edgesToCreate: EdgeData[] = [];
      const processedEntities = new Set<string>();

      // Process each parsed publication
      for (const pub of parsedPublications) {
        const pmid = pub.pmid;

        // Collect entities from this publication
        for (const entity of pub.entities) {
          // Filter by requested concepts (entity.type is lowercase like "disease", "chemical")
          if (!concepts.includes(entity.type as any)) continue;
          if (processedEntities.has(entity.pubtatorId)) continue;

          const entityType = getEntityType(entity.type);
          const nodeData: Omit<NodeData, 'id'> = {
            label: entity.name,
            type: entityType.type,
            data: {
              pubtatorId: entity.pubtatorId,
              source: 'pubtator',
              pmid: pmid,
              entityType: entity.type
            },
            position: {
              x: Math.random() * 800 + 100,
              y: Math.random() * 600 + 100
            }
          };

          nodesToCreate.push(nodeData);
          processedEntities.add(entity.pubtatorId);
        }

        // Collect relations from this publication
        if (pub.relations && pub.relations.length > 0) {
          for (const relation of pub.relations) {
            // Only create edges if both entities were processed (match concepts filter)
            const entity1Processed = processedEntities.has(relation.entity1Id);
            const entity2Processed = processedEntities.has(relation.entity2Id);

            if (entity1Processed && entity2Processed) {
              const edgeData: EdgeData = {
                id: generateCompositeEdgeId(
                  databaseContext.conversationId,
                  'pubtator',
                  `PMID:${pmid}`,
                  relation.entity1Id,
                  mapRelationshipType(relation.type),
                  relation.entity2Id
                ),
                source: relation.entity1Id,
                target: relation.entity2Id,
                label: mapRelationshipType(relation.type),
                data: {
                  type: relation.type,
                  source: 'pubtator',
                  primary_source: `PMID:${pmid}`,
                  publications: [`PMID:${pmid}`]
                }
              };
              edgesToCreate.push(edgeData);
            }
          }
        }
      }

      // Bulk create nodes and edges
      const nodeResult = await bulkCreateNodesInDatabase(nodesToCreate, databaseContext);
      const edgeResult = await bulkCreateEdgesInDatabase(edgesToCreate, databaseContext);

      return {
        content: [{
          type: "text",
          text: `Successfully added ${nodeResult.created} nodes and ${edgeResult.created} edges from ${pmids.length} PubMed articles to the Graph Mode knowledge graph.
Note: ${nodeResult.skipped} duplicate nodes and ${edgeResult.skipped} duplicate edges were automatically skipped.`
        }],
        refreshGraph: true
      };
    }

    if (name === "addNodesAndEdgesFromText") {
      const queryParams = AddNodesAndEdgesFromTextArgumentsSchema.parse(args);
      const { text, concepts, databaseContext } = queryParams;

      try {
        // Annotate text with PubTator using RESTful endpoint (PubTator3 doesn't have POST /annotations/)
        // This returns BioC JSON format
        const biocData = await annotateTextRESTful(text, concepts);

        // Parse BioC JSON format (same format as publication export)
        // For free text, we'll treat it as a single document without PMID
        const parsedPublications = parseBiocJsonForText(biocData);

        if (parsedPublications.length === 0 || parsedPublications[0].entities.length === 0) {
          return {
            content: [{
              type: "text",
              text: "No biomedical entities found in the provided text."
            }]
          };
        }

        // Collect nodes and edges for bulk creation
        const nodesToCreate: Omit<NodeData, 'id'>[] = [];
        const edgesToCreate: EdgeData[] = [];
        const processedEntities = new Set<string>();

        // Process entities from parsed publication
        const pub = parsedPublications[0];
        for (const entity of pub.entities) {
          if (!concepts.includes(entity.type as any)) continue;
          if (processedEntities.has(entity.pubtatorId)) continue;

          const entityType = getEntityType(entity.type);
          const nodeData: Omit<NodeData, 'id'> = {
            label: entity.name,
            type: entityType.type,
            data: {
              pubtatorId: entity.pubtatorId,
              source: 'pubtator',
              entityType: entity.type
            },
            position: {
              x: Math.random() * 800 + 100,
              y: Math.random() * 600 + 100
            }
          };

          nodesToCreate.push(nodeData);
          processedEntities.add(entity.pubtatorId);
        }

        // Process relations if available
        if (pub.relations && pub.relations.length > 0) {
          for (const relation of pub.relations) {
            // Only create edges if both entities were found in the text
            if (processedEntities.has(relation.entity1Id) && processedEntities.has(relation.entity2Id)) {
              const edgeData: EdgeData = {
                id: generateCompositeEdgeId(
                  databaseContext.conversationId,
                  'pubtator',
                  'infores:pubtator',
                  relation.entity1Id,
                  mapRelationshipType(relation.type),
                  relation.entity2Id
                ),
                source: relation.entity1Id,
                target: relation.entity2Id,
                label: mapRelationshipType(relation.type),
                data: {
                  type: relation.type,
                  source: 'pubtator',
                  primary_source: 'infores:pubtator',
                  publications: [] // Free text doesn't have PMIDs
                }
              };
              edgesToCreate.push(edgeData);
            }
          }
        }

        // Bulk create nodes
        const nodeResult = await bulkCreateNodesInDatabase(nodesToCreate, databaseContext);
        
        // Bulk create edges
        const edgeResult = await bulkCreateEdgesInDatabase(edgesToCreate, databaseContext);

        return {
          content: [{
            type: "text",
            text: `Successfully added ${nodeResult.created} biomedical entities and ${edgeResult.created} relationships from the text to the Graph Mode knowledge graph.
Note: ${nodeResult.skipped} duplicate entities and ${edgeResult.skipped} duplicate relationships were automatically skipped.`
          }],
          refreshGraph: true
        };
      } catch (error) {
        console.error(`[${SERVICE_NAME}] Error annotating text:`, error);
        return {
          content: [{
            type: "text",
            text: `Error processing text: ${error instanceof Error ? error.message : 'Unknown error'}. The PubTator text annotation service may be temporarily unavailable.`
          }]
        };
      }
    }

    if (name === "addNodesByName") {
      const queryParams = AddNodesByNameArgumentsSchema.parse(args);
      const { entityNames, conceptType, databaseContext } = queryParams;

      // console.error(`[${SERVICE_NAME}] Adding ${entityNames.length} entities by name: ${entityNames.join(', ')}`);

      // Collect nodes for bulk creation
      const nodesToCreate: Omit<NodeData, 'id'>[] = [];
      const processedEntities = new Set<string>();
      const notFoundEntities: string[] = [];
      const foundEntities: Array<{ name: string; pubtatorId: string; type: string }> = [];

      // Look up each entity name
      for (const entityName of entityNames) {
        try {
          // Use autocomplete to find the entity
          // If conceptType is specified, search only that type; otherwise search all types
          const entities = await getEntityAutocomplete(entityName, conceptType);

          if (entities.length === 0) {
            notFoundEntities.push(entityName);
            continue;
          }

          // Take the best match (first result from autocomplete)
          const bestMatch = entities[0];

          // Skip if we've already processed this entity ID
          if (processedEntities.has(bestMatch.id)) {
            continue;
          }

          // Determine entity type (use bestMatch.type if available, otherwise use conceptType or 'gene' as fallback)
          const entityTypeName = bestMatch.type || conceptType || 'gene';
          const entityType = getEntityType(entityTypeName);
          
          const nodeData: Omit<NodeData, 'id'> = {
            label: bestMatch.name,
            type: entityType.type,
            data: {
              pubtatorId: bestMatch.id,
              source: 'pubtator',
              entityType: entityTypeName,
              mentions: bestMatch.mentions || [],
              originalQuery: entityName // Store the original query name
            },
            position: {
              x: Math.random() * 800 + 100,
              y: Math.random() * 600 + 100
            }
          };

          nodesToCreate.push(nodeData);
          processedEntities.add(bestMatch.id);
          foundEntities.push({
            name: bestMatch.name,
            pubtatorId: bestMatch.id,
            type: entityTypeName
          });

          // Rate limiting to respect PubTator API limits
          await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_MS));

        } catch (error) {
          console.error(`[${SERVICE_NAME}] Error looking up entity "${entityName}":`, error);
          notFoundEntities.push(entityName);
        }
      }

      // Bulk create nodes
      const nodeResult = await bulkCreateNodesInDatabase(nodesToCreate, databaseContext);

      // Build response message
      let responseText = `Successfully added ${nodeResult.created} entity node(s) to the Graph Mode knowledge graph.\n`;
      
      if (foundEntities.length > 0) {
        responseText += `\nAdded entities:\n`;
        foundEntities.forEach(ent => {
          responseText += `- ${ent.name} (${ent.type}, PubTator ID: ${ent.pubtatorId})\n`;
        });
      }

      if (notFoundEntities.length > 0) {
        responseText += `\nCould not find: ${notFoundEntities.join(', ')}\n`;
      }

      if (nodeResult.skipped > 0) {
        responseText += `\nNote: ${nodeResult.skipped} duplicate entity(ies) were automatically skipped.`;
      }

      return {
        content: [{
          type: "text",
          text: responseText
        }],
        refreshGraph: true
      };
    }

    if (name === "addNodesFromEntityNetwork") {
      const queryParams = AddNodesFromEntityNetworkArgumentsSchema.parse(args);
      const { query, concept, max_entities, max_relations_per_entity, relationship_types, databaseContext } = queryParams;

      // console.error(`[${SERVICE_NAME}] Building entity network for query: ${query}, concept: ${concept}`);

      // Find entities using autocomplete
      const entities = await getEntityAutocomplete(query, concept);
      const limitedEntities = entities.slice(0, max_entities);

      if (limitedEntities.length === 0) {
        return {
          content: [{
            type: "text",
            text: `No entities found for query "${query}" and concept "${concept}".`
          }]
        };
      }

      // Collect all nodes and edges for bulk creation
      const nodesToCreate: Omit<NodeData, 'id'>[] = [];
      const edgesToCreate: EdgeData[] = [];
      const processedEntities = new Set<string>();

      // Collect nodes for found entities
      for (const entity of limitedEntities) {
        const entityType = getEntityType(concept);
        const nodeData: Omit<NodeData, 'id'> = {
          label: entity.name,
          type: entityType.type,
          data: {
            pubtatorId: entity.id,
            source: 'pubtator',
            entityType: concept,
            mentions: entity.mentions || []
          },
          position: {
            x: Math.random() * 800 + 100,
            y: Math.random() * 600 + 100
          }
        };

        nodesToCreate.push(nodeData);
        processedEntities.add(entity.id);
      }

      // Get relationships for each entity and collect nodes/edges
      for (const entity of limitedEntities) {
        try {
          const relations = await getEntityRelations(entity.id, max_relations_per_entity, relationship_types);
          
          for (const relation of relations) {
            // Skip relations with missing target entity
            if (!relation.e2) {
              console.error(`[${SERVICE_NAME}] Skipping relation with missing target entity:`, relation);
              continue;
            }
            
            // Collect target entity if it doesn't exist
            if (!processedEntities.has(relation.e2)) {
              const targetEntityType = getEntityTypeFromId(relation.e2);
              const targetNodeData: Omit<NodeData, 'id'> = {
                label: extractEntityName(relation.e2),
                type: targetEntityType.type,
                data: {
                  pubtatorId: relation.e2,
                  source: 'pubtator',
                  entityType: relation.e2.split('_')[0].replace('@', '').toLowerCase()
                },
                position: {
                  x: Math.random() * 800 + 100,
                  y: Math.random() * 600 + 100
                }
              };

              nodesToCreate.push(targetNodeData);
              processedEntities.add(relation.e2);
            }

            // Collect edge
            const edgeData: EdgeData = {
              id: generateCompositeEdgeId(
                databaseContext.conversationId,
                'pubtator',
                'infores:pubtator',
                relation.e1,
                mapRelationshipType(relation.type),
                relation.e2
              ),
              source: relation.e1,
              target: relation.e2,
              label: mapRelationshipType(relation.type),
              data: {
                type: relation.type,
                source: 'pubtator',
                primary_source: 'infores:pubtator',
                publications: [], // PubTator relations endpoint only provides counts, not actual PMIDs
                publication_count: relation.pmid || 0 // Store the count as metadata
              }
            };
            
            edgesToCreate.push(edgeData);
          }

          // Rate limiting
          await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_MS));

        } catch (error) {
          console.error(`[${SERVICE_NAME}] Error getting relations for entity ${entity.id}:`, error);
        }
      }

      // Bulk create nodes and edges
      const nodeResult = await bulkCreateNodesInDatabase(nodesToCreate, databaseContext);
      const edgeResult = await bulkCreateEdgesInDatabase(edgesToCreate, databaseContext);
      
      return {
        content: [{
          type: "text",
          text: `Successfully built entity network with ${nodeResult.created} nodes and ${edgeResult.created} edges for query "${query}".
Note: ${nodeResult.skipped} duplicate nodes and ${edgeResult.skipped} duplicate edges were automatically skipped.`
        }],
        refreshGraph: true
      };
    }

    if (name === "findRelatedEntities") {
      const queryParams = FindRelatedEntitiesArgumentsSchema.parse(args);
      const { sourceEntity, sourceType, targetType, relationshipTypes, maxResults, databaseContext } = queryParams;

      // console.error(`[${SERVICE_NAME}] Finding ${targetType} entities related to ${sourceEntity} (${sourceType})`);

      // Find the source entity using autocomplete
      const sourceEntities = await getEntityAutocomplete(sourceEntity, sourceType);
      if (sourceEntities.length === 0) {
        return {
          content: [{
            type: "text",
            text: `No ${sourceType} entity found with name "${sourceEntity}".`
          }]
        };
      }

      const sourceEntityData = sourceEntities[0];
      
      // Collect all nodes and edges for bulk creation
      const nodesToCreate: Omit<NodeData, 'id'>[] = [];
      const edgesToCreate: EdgeData[] = [];
      const processedEntities = new Set<string>();

      // Collect source entity node
      const sourceEntityType = getEntityType(sourceType);
      const sourceNodeData: Omit<NodeData, 'id'> = {
        label: sourceEntityData.name,
        type: sourceEntityType.type,
        data: {
          pubtatorId: sourceEntityData.id,
          source: 'pubtator',
          entityType: sourceType,
          mentions: sourceEntityData.mentions || []
        },
        position: {
          x: Math.random() * 800 + 100,
          y: Math.random() * 600 + 100
        }
      };

      nodesToCreate.push(sourceNodeData);
      processedEntities.add(sourceEntityData.id);

      // Get relationships for the source entity
      const relations = await getEntityRelations(sourceEntityData.id, maxResults * 2, relationshipTypes);
      
      // Filter relations to only include target type entities
      const filteredRelations = relations.filter(rel => {
        const targetEntityType = getEntityTypeFromId(rel.e2);
        return targetEntityType.type.toLowerCase() === targetType.toLowerCase();
      }).slice(0, maxResults);

      for (const relation of filteredRelations) {
        // Collect target entity if it doesn't exist
        if (!processedEntities.has(relation.e2)) {
          const targetEntityType = getEntityType(targetType);
          const targetNodeData: Omit<NodeData, 'id'> = {
            label: extractEntityName(relation.e2),
            type: targetEntityType.type,
            data: {
              pubtatorId: relation.e2,
              source: 'pubtator',
              entityType: targetType
            },
            position: {
              x: Math.random() * 800 + 100,
              y: Math.random() * 600 + 100
            }
          };

          nodesToCreate.push(targetNodeData);
          processedEntities.add(relation.e2);
        }

        // Collect edge
        const edgeData: EdgeData = {
          id: generateCompositeEdgeId(
            databaseContext.conversationId,
            'pubtator',
            'infores:pubtator',
            relation.e1,
            mapRelationshipType(relation.type),
            relation.e2
          ),
          source: relation.e1,
          target: relation.e2,
          label: mapRelationshipType(relation.type),
          data: {
            type: relation.type,
            source: 'pubtator',
            primary_source: 'infores:pubtator',
            publications: [], // PubTator relations endpoint only provides counts, not actual PMIDs
            publication_count: relation.pmid || 0 // Store the count as metadata
          }
        };
        
        edgesToCreate.push(edgeData);
      }

      // Bulk create nodes and edges
      const nodeResult = await bulkCreateNodesInDatabase(nodesToCreate, databaseContext);
      const edgeResult = await bulkCreateEdgesInDatabase(edgesToCreate, databaseContext);
      
      return {
        content: [{
          type: "text",
          text: `Found ${nodeResult.created - 1} ${targetType} entities related to ${sourceEntity}. Added ${nodeResult.created} nodes and ${edgeResult.created} edges to the graph.
Note: ${nodeResult.skipped} duplicate nodes and ${edgeResult.skipped} duplicate edges were automatically skipped.`
        }],
        refreshGraph: true
      };
    }

    if (name === "findAllRelatedEntities") {
      const queryParams = FindAllRelatedEntitiesArgumentsSchema.parse(args);
      const { sourceEntity, sourceType, relationshipTypes, maxResults, databaseContext } = queryParams;

      // console.error(`[${SERVICE_NAME}] Finding ALL entities related to ${sourceEntity} (${sourceType})`);

      // Find the source entity using autocomplete
      const sourceEntities = await getEntityAutocomplete(sourceEntity, sourceType);
      if (sourceEntities.length === 0) {
        return {
          content: [{
            type: "text",
            text: `No ${sourceType} entity found with name "${sourceEntity}".`
          }]
        };
      }

      const sourceEntityData = sourceEntities[0];
      
      // Collect all nodes and edges for bulk creation
      const nodesToCreate: Omit<NodeData, 'id'>[] = [];
      const edgesToCreate: EdgeData[] = [];
      const processedEntities = new Set<string>();

      // Collect source entity node
      const sourceEntityType = getEntityType(sourceType);
      const sourceNodeData: Omit<NodeData, 'id'> = {
        label: sourceEntityData.name,
        type: sourceEntityType.type,
        data: {
          pubtatorId: sourceEntityData.id,
          source: 'pubtator',
          entityType: sourceType,
          mentions: sourceEntityData.mentions || []
        },
        position: {
          x: Math.random() * 800 + 100,
          y: Math.random() * 600 + 100
        }
      };

      nodesToCreate.push(sourceNodeData);
      processedEntities.add(sourceEntityData.id);

      // Get ALL relationships for the source entity (no target type filtering)
      const relations = await getEntityRelations(sourceEntityData.id, maxResults, relationshipTypes);
      // console.error(`🔥 [PUBTATOR-DEBUG] Found ${relations.length} relations from PubTator API`);

      for (const relation of relations) {
        // Skip relations with missing target entity
        if (!relation.e2) {
          console.error(`[${SERVICE_NAME}] Skipping relation with missing target entity:`, relation);
          continue;
        }
        
        // Collect source entity if it doesn't exist
        if (!processedEntities.has(relation.e1)) {
          const sourceEntityType = getEntityTypeFromId(relation.e1);
          const sourceNodeData: Omit<NodeData, 'id'> = {
            label: extractEntityName(relation.e1),
            type: sourceEntityType.type,
            data: {
              pubtatorId: relation.e1,
              source: 'pubtator',
              entityType: relation.e1.split('_')[0].replace('@', '').toLowerCase()
            },
            position: {
              x: Math.random() * 800 + 100,
              y: Math.random() * 600 + 100
            }
          };

          nodesToCreate.push(sourceNodeData);
          processedEntities.add(relation.e1);
        }

        // Collect target entity if it doesn't exist
        if (!processedEntities.has(relation.e2)) {
          const targetEntityType = getEntityTypeFromId(relation.e2);
          const targetNodeData: Omit<NodeData, 'id'> = {
            label: extractEntityName(relation.e2),
            type: targetEntityType.type,
            data: {
              pubtatorId: relation.e2,
              source: 'pubtator',
              entityType: relation.e2.split('_')[0].replace('@', '').toLowerCase()
            },
            position: {
              x: Math.random() * 800 + 100,
              y: Math.random() * 600 + 100
            }
          };

          nodesToCreate.push(targetNodeData);
          processedEntities.add(relation.e2);
        }

        // Collect edge
        const edgeData: EdgeData = {
          id: generateCompositeEdgeId(
            databaseContext.conversationId,
            'pubtator',
            'infores:pubtator',
            relation.e1,
            mapRelationshipType(relation.type),
            relation.e2
          ),
          source: relation.e1,
          target: relation.e2,
          label: mapRelationshipType(relation.type),
          data: {
            type: relation.type,
            source: 'pubtator',
            primary_source: 'infores:pubtator',
            publications: [], // PubTator relations endpoint only provides counts, not actual PMIDs
            publication_count: relation.pmid || 0 // Store the count as metadata
          }
        };
        
        edgesToCreate.push(edgeData);
      }

      // Bulk create nodes and edges
      const nodeResult = await bulkCreateNodesInDatabase(nodesToCreate, databaseContext);
      const edgeResult = await bulkCreateEdgesInDatabase(edgesToCreate, databaseContext);
      
      return {
        content: [{
          type: "text",
          text: `Found comprehensive relationship network for ${sourceEntity}. Added ${nodeResult.created} nodes and ${edgeResult.created} edges across all entity types to the graph.
Note: ${nodeResult.skipped} duplicate nodes and ${edgeResult.skipped} duplicate edges were automatically skipped.`
        }],
        refreshGraph: true
      };
    }

    if (name === "findPublicationsForRelationship") {
      const queryParams = FindPublicationsForRelationshipArgumentsSchema.parse(args);
      const { entity1Id, entity1Name, entity2Id, entity2Name, relationshipType = "ANY", maxResults = 10 } = queryParams;
      
      // Search for publications using PubTator search API
      const searchQuery = `relations:${relationshipType}|${entity1Id}|${entity2Id}`;
      const searchEndpoint = `/search/?text=${encodeURIComponent(searchQuery)}`;
      
      try {
        const searchResults = await makePubTatorRequest(searchEndpoint);
        
        if (!searchResults || !searchResults.results || searchResults.results.length === 0) {
          return {
            content: [{
              type: "text",
              text: `No publications found for the relationship between ${entity1Name} and ${entity2Name}.`
            }]
          };
        }
        
        // Limit results
        const publications = searchResults.results.slice(0, maxResults);
        const pmids = publications.map((p: any) => p.pmid).filter((pmid: any) => pmid);
        
        if (pmids.length === 0) {
          return {
            content: [{
              type: "text",
              text: `No valid PMIDs found in search results for the relationship between ${entity1Name} and ${entity2Name}.`
            }]
          };
        }
        
        // Use the search results directly since they already contain all the metadata we need
        const detailedPublications = publications.map((pub: any) => ({
          pmid: pub.pmid,
          title: pub.title || 'Untitled',
          authors: pub.authors || [],
          journal: pub.journal || '',
          year: pub.date ? pub.date.split('-')[0] : '',
          abstract: pub.text_hl ? pub.text_hl.replace(/@<m>|<\/m>@|@GENE_\d+|@DISEASE_\d+|@CHEMICAL_\d+|@@@/g, '') : ''
        }));
        
        // Build markdown response
        let response = `# Publications: ${entity1Name} and ${entity2Name}\n\n`;
        response += `Found ${detailedPublications.length} publication(s) discussing the relationship between **${entity1Name}** and **${entity2Name}**.\n\n`;
        response += `---\n\n`;
        
        // Add each publication with abstract
        detailedPublications.forEach((pub: any, idx: number) => {
          response += `## ${idx + 1}. ${pub.title || 'Untitled'}\n\n`;
          response += `**PMID**: [${pub.pmid}](https://pubmed.ncbi.nlm.nih.gov/${pub.pmid})\n\n`;
          
          if (pub.authors && pub.authors.length > 0) {
            response += `**Authors**: ${pub.authors.join(', ')}\n\n`;
          }
          
          if (pub.journal) {
            response += `**Journal**: ${pub.journal}`;
            if (pub.year) {
              response += ` (${pub.year})`;
            }
            response += `\n\n`;
          }
          
          if (pub.abstract) {
            response += `**Abstract**: ${pub.abstract}\n\n`;
          }
          
          response += `---\n\n`;
        });
        
        // Add numbered bibliography section with proper citations
        response += `## References\n\n`;
        detailedPublications.forEach((pub: any, idx: number) => {
          const authors = pub.authors && pub.authors.length > 0 ? pub.authors.join(', ') : 'Unknown authors';
          const title = pub.title || 'Untitled';
          const journal = pub.journal || 'Unknown journal';
          const year = pub.year || 'Unknown year';
          const pmid = pub.pmid;
          
          response += `${idx + 1}. ${authors}. "${title}" *${journal}*. ${year}. [PMID: ${pmid}](https://pubmed.ncbi.nlm.nih.gov/${pmid})\n`;
        });
        
        return {
          content: [{
            type: "text",
            text: response
          }]
        };
      } catch (error) {
        console.error(`[${SERVICE_NAME}] Error finding publications:`, error);
        return {
          content: [{
            type: "text",
            text: `Error searching for publications: ${error instanceof Error ? error.message : 'Unknown error'}`
          }]
        };
      }
    }

    if (name === "findPublicationsByTerm") {
      const queryParams = FindPublicationsByTermArgumentsSchema.parse(args);
      const { searchTerm, maxResults = 10, addEntitiesToGraph = false, databaseContext } = queryParams;
      
      // Check if original request exceeded max and prepare message
      const originalMaxResults = (args as any)?.maxResults;
      const exceededLimit = originalMaxResults && originalMaxResults > 50;
      const limitMessage = exceededLimit 
        ? `\n\n**Note**: You requested ${originalMaxResults} publications, but the maximum is 50. The search has been performed with the maximum of 50 publications.\n`
        : '';

      try {
        // Phase 1: Search for publications
        // First, try direct search
        let searchEndpoint = `/search/?text=${encodeURIComponent(searchTerm)}`;
        let searchResults = await makePubTatorRequest(searchEndpoint);
        
        console.error(`[${SERVICE_NAME}] Search for "${searchTerm}" - Response structure:`, {
          hasResults: !!searchResults,
          hasResultsArray: !!(searchResults?.results),
          resultsLength: searchResults?.results?.length || 0,
          responseKeys: searchResults ? Object.keys(searchResults) : [],
          firstFewChars: searchResults ? JSON.stringify(searchResults).substring(0, 200) : 'null'
        });
        
        // If no results and search term is not already an entity ID, try looking up entity ID first
        if ((!searchResults || !searchResults.results || searchResults.results.length === 0) && !searchTerm.startsWith('@')) {
          // Helper to format entity ID for search
          const formatEntityIdForSearch = (entity: PubTatorEntity): string => {
            // If already in @TYPE_ID format, use as-is
            if (entity.id.startsWith('@')) {
              return entity.id;
            }
            // Otherwise, construct @TYPE_ID format from type and id
            const typeUpper = (entity.type || 'GENE').toUpperCase();
            return `@${typeUpper}_${entity.id}`;
          };
          
          // Try to find entity ID using autocomplete (try gene first, then without type filter)
          const entityMatches = await getEntityAutocomplete(searchTerm, 'gene');
          
          console.error(`[${SERVICE_NAME}] Entity autocomplete for "${searchTerm}" (gene):`, {
            matchCount: entityMatches.length,
            matches: entityMatches.slice(0, 3).map(e => ({ id: e.id, name: e.name, type: e.type }))
          });
          
          if (entityMatches.length > 0) {
            // Use the best match entity ID for search
            const entityId = formatEntityIdForSearch(entityMatches[0]);
            console.error(`[${SERVICE_NAME}] Searching with formatted entity ID: ${entityId}`);
            searchEndpoint = `/search/?text=${encodeURIComponent(entityId)}`;
            searchResults = await makePubTatorRequest(searchEndpoint);
            
            console.error(`[${SERVICE_NAME}] Search with entity ID "${entityId}" - Response:`, {
              hasResults: !!searchResults,
              hasResultsArray: !!(searchResults?.results),
              resultsLength: searchResults?.results?.length || 0
            });
            
            // If still no results, try without concept filter (search all types)
            if ((!searchResults || !searchResults.results || searchResults.results.length === 0)) {
              const allTypeMatches = await getEntityAutocomplete(searchTerm);
              if (allTypeMatches.length > 0) {
                const entityId2 = formatEntityIdForSearch(allTypeMatches[0]);
                searchEndpoint = `/search/?text=${encodeURIComponent(entityId2)}`;
                searchResults = await makePubTatorRequest(searchEndpoint);
              }
            }
          } else {
            // No entity match found, try searching without type filter
            const allTypeMatches = await getEntityAutocomplete(searchTerm);
            if (allTypeMatches.length > 0) {
              const entityId = formatEntityIdForSearch(allTypeMatches[0]);
              searchEndpoint = `/search/?text=${encodeURIComponent(entityId)}`;
              searchResults = await makePubTatorRequest(searchEndpoint);
            }
          }
        }

        if (!searchResults || !searchResults.results || searchResults.results.length === 0) {
          return {
            content: [{
              type: "text",
              text: `No publications found for search term "${searchTerm}". If this is a gene or entity name, try using the entity's PubTator ID format (e.g., @GENE_672) or ensure the spelling is correct.`
            }]
          };
        }

        // Limit results and extract PMIDs
        const publications = searchResults.results.slice(0, maxResults);
        const pmids = publications.map((p: any) => p.pmid).filter((pmid: any) => pmid);

        if (pmids.length === 0) {
          return {
            content: [{
              type: "text",
              text: `No valid PMIDs found in search results for "${searchTerm}".`
            }]
          };
        }

        // Phase 2: Batch fetch full abstracts with annotations (BATCH OPERATION)
        const exportEndpoint = `/publications/export/biocjson?pmids=${pmids.join(',')}&full=true`;
        const biocData = await makePubTatorRequest(exportEndpoint);

        // Phase 3: Parse BioC JSON to extract abstracts and entities
        const parsedPublications = parseBiocJson(biocData);
        
        // Create a map of PMID to publication metadata from search results
        const pubMetadataMap = new Map<string, any>();
        publications.forEach((pub: any) => {
          if (pub.pmid) {
            pubMetadataMap.set(pub.pmid.toString(), {
              title: pub.title || 'Untitled',
              authors: pub.authors || [],
              journal: pub.journal || '',
              year: pub.date ? pub.date.split('-')[0] : ''
            });
          }
        });

        // Phase 4: Extract entities and optionally add to graph
        const uniqueEntities = extractUniqueEntities(parsedPublications);
        let nodeResult = { created: 0, skipped: 0, total: 0 };
        let edgeResult = { created: 0, skipped: 0, total: 0 };

        if (addEntitiesToGraph && databaseContext) {
          // Create nodes for unique entities
          const nodesToCreate: Omit<NodeData, 'id'>[] = [];
          const processedEntityIds = new Set<string>();

          for (const entity of uniqueEntities) {
            if (processedEntityIds.has(entity.pubtatorId)) continue;

            const entityType = getEntityType(entity.type);
            const nodeData: Omit<NodeData, 'id'> = {
              label: entity.name,
              type: entityType.type,
              data: {
                pubtatorId: entity.pubtatorId,
                source: 'pubtator',
                entityType: entity.type
              },
              position: {
                x: Math.random() * 800 + 100,
                y: Math.random() * 600 + 100
              }
            };

            nodesToCreate.push(nodeData);
            processedEntityIds.add(entity.pubtatorId);
          }

          // Bulk create nodes
          nodeResult = await bulkCreateNodesInDatabase(nodesToCreate, databaseContext);

          // Create edges between entities - consolidate across all publications
          // Step 1: Collect all entity pairs and their PMIDs
          const entityPairToPMIDs = new Map<string, { entity1Id: string; entity2Id: string; pmids: Set<string> }>();

          for (const pub of parsedPublications) {
            const entitiesInPub = pub.entities;
            
            // Create edges between all pairs of entities in this publication
            for (let i = 0; i < entitiesInPub.length; i++) {
              for (let j = i + 1; j < entitiesInPub.length; j++) {
                const entity1 = entitiesInPub[i];
                const entity2 = entitiesInPub[j];
                
                // Create a consistent key for the entity pair (always smaller ID first)
                const entity1Id = entity1.pubtatorId;
                const entity2Id = entity2.pubtatorId;
                const pairKey = entity1Id < entity2Id
                  ? `${entity1Id}|${entity2Id}`
                  : `${entity2Id}|${entity1Id}`;
                
                if (!entityPairToPMIDs.has(pairKey)) {
                  entityPairToPMIDs.set(pairKey, {
                    entity1Id: entity1Id < entity2Id ? entity1Id : entity2Id,
                    entity2Id: entity1Id < entity2Id ? entity2Id : entity1Id,
                    pmids: new Set()
                  });
                }
                
                entityPairToPMIDs.get(pairKey)!.pmids.add(`PMID:${pub.pmid}`);
              }
            }
          }

          // Step 2: Fetch existing edges from database
          const existingEdges = await getExistingEdges(databaseContext);
          
          // Step 3: Create consolidated edge data, merging with existing edges
          const edgesToCreate: EdgeData[] = [];
          const edgesToUpdate: EdgeData[] = [];

          for (const [pairKey, pairData] of entityPairToPMIDs) {
            const edgeId = generateCompositeEdgeId(
              databaseContext.conversationId,
              'pubtator',
              'pubtator',
              pairData.entity1Id,
              'publishedTogether',
              pairData.entity2Id
            );
            
            const newPMIDs = Array.from(pairData.pmids);
            const existingEdge = existingEdges.get(edgeId);
            
            let finalPMIDs: string[];
            if (existingEdge) {
              // Merge with existing publications
              finalPMIDs = mergePublications(existingEdge.data.publications, newPMIDs);
              
              // Create update data
              const updatedEdge: EdgeData = {
                ...existingEdge,
                data: {
                  ...existingEdge.data,
                  publications: finalPMIDs
                }
              };
              edgesToUpdate.push(updatedEdge);
            } else {
              // New edge - use all PMIDs
              finalPMIDs = newPMIDs;
              
              const edgeData: EdgeData = {
                id: edgeId,
                source: pairData.entity1Id,
                target: pairData.entity2Id,
                label: 'publishedTogether',
                data: {
                  type: 'publishedTogether',
                  source: 'pubtator',
                  primary_source: 'pubtator',
                  publications: finalPMIDs
                }
              };
              edgesToCreate.push(edgeData);
            }
          }

          // Bulk create new edges
          const createResult = await bulkCreateEdgesInDatabase(edgesToCreate, databaseContext);
          
          // Update existing edges
          const updateResult = await bulkUpdateEdgesInDatabase(edgesToUpdate, databaseContext);
          
          edgeResult = {
            created: createResult.created,
            skipped: createResult.skipped + (edgesToUpdate.length - updateResult.updated),
            total: edgesToCreate.length + edgesToUpdate.length
          };
        }

        // Phase 5: Format response
        let response = `# Publications containing "${searchTerm}"\n\n`;
        if (limitMessage) {
          response += limitMessage;
        }
        response += `Found ${parsedPublications.length} publication(s).\n\n`;
        response += `---\n\n`;

        // Group entities by type for summary
        const entitiesByType: Record<string, Array<{ name: string; pubtatorId: string }>> = {};

        // Add each publication with abstract and entities
        parsedPublications.forEach((pub: ParsedPublication, idx: number) => {
          const metadata = pubMetadataMap.get(pub.pmid) || {
            title: 'Untitled',
            authors: [],
            journal: '',
            year: ''
          };

          response += `## ${idx + 1}. ${metadata.title}\n\n`;
          response += `**PMID**: [${pub.pmid}](https://pubmed.ncbi.nlm.nih.gov/${pub.pmid})\n\n`;

          if (metadata.authors && metadata.authors.length > 0) {
            response += `**Authors**: ${metadata.authors.join(', ')}\n\n`;
          }

          if (metadata.journal) {
            response += `**Journal**: ${metadata.journal}`;
            if (metadata.year) {
              response += ` (${metadata.year})`;
            }
            response += `\n\n`;
          }

          if (pub.abstract) {
            response += `**Abstract**: ${pub.abstract}\n\n`;
          }

          if (pub.entities.length > 0) {
            response += `**Entities found in abstract** (${pub.entities.length}):\n`;
            pub.entities.forEach(entity => {
              response += `- ${entity.name} (${entity.type}, ${entity.pubtatorId})\n`;
              
              // Group for summary
              if (!entitiesByType[entity.type]) {
                entitiesByType[entity.type] = [];
              }
              if (!entitiesByType[entity.type].some(e => e.pubtatorId === entity.pubtatorId)) {
                entitiesByType[entity.type].push({ name: entity.name, pubtatorId: entity.pubtatorId });
              }
            });
            response += `\n`;
          }

          response += `---\n\n`;
        });

        // Add entity summary
        response += `## Entity Summary\n\n`;
        const totalEntities = uniqueEntities.length;
        response += `Total unique entities found: ${totalEntities}\n\n`;

        Object.keys(entitiesByType).sort().forEach(type => {
          const entities = entitiesByType[type];
          const names = entities.map(e => e.name).slice(0, 10);
          const moreCount = entities.length > 10 ? ` and ${entities.length - 10} more` : '';
          response += `- **${type.charAt(0).toUpperCase() + type.slice(1)}**: ${entities.length} (${names.join(', ')}${moreCount})\n`;
        });

        if (addEntitiesToGraph && databaseContext) {
          response += `\n**Graph Addition**: Added ${nodeResult.created} entity node(s) and ${edgeResult.created} edge(s) to the graph.\n`;
          response += `Note: ${nodeResult.skipped} duplicate node(s) and ${edgeResult.skipped} duplicate edge(s) were automatically skipped.\n`;
          response += `Edges connect entities that appeared together in the same publication (publishedTogether).\n`;
        }

        return {
          content: [{
            type: "text",
            text: response
          }],
          refreshGraph: addEntitiesToGraph && databaseContext ? true : undefined
        };

      } catch (error) {
        console.error(`[${SERVICE_NAME}] Error in findPublicationsByTerm:`, error);
        return {
          content: [{
            type: "text",
            text: `Error searching for publications: ${error instanceof Error ? error.message : 'Unknown error'}`
          }]
        };
      }
    }

    if (name === "findSearchTermPublicationRelationships") {
      const queryParams = FindSearchTermPublicationRelationshipsArgumentsSchema.parse(args);
      const { searchTerm, maxResults = 10, relationshipTypes, databaseContext } = queryParams;
      
      // Check if original request exceeded max and prepare message
      const originalMaxResults = (args as any)?.maxResults;
      const exceededLimit = originalMaxResults && originalMaxResults > 50;
      const limitMessage = exceededLimit 
        ? `\n\n**Note**: You requested ${originalMaxResults} publications, but the maximum is 50. The search has been performed with the maximum of 50 publications.\n`
        : '';

      try {
        // Phase 1: Search for publications (same logic as findPublicationsByTerm)
        let searchEndpoint = `/search/?text=${encodeURIComponent(searchTerm)}`;
        let searchResults = await makePubTatorRequest(searchEndpoint);
        
        // If no results and search term is not already an entity ID, try looking up entity ID first
        if ((!searchResults || !searchResults.results || searchResults.results.length === 0) && !searchTerm.startsWith('@')) {
          const formatEntityIdForSearch = (entity: PubTatorEntity): string => {
            if (entity.id.startsWith('@')) {
              return entity.id;
            }
            const typeUpper = (entity.type || 'GENE').toUpperCase();
            return `@${typeUpper}_${entity.id}`;
          };
          
          const entityMatches = await getEntityAutocomplete(searchTerm, 'gene');
          
          if (entityMatches.length > 0) {
            const entityId = formatEntityIdForSearch(entityMatches[0]);
            searchEndpoint = `/search/?text=${encodeURIComponent(entityId)}`;
            searchResults = await makePubTatorRequest(searchEndpoint);
            
            if ((!searchResults || !searchResults.results || searchResults.results.length === 0)) {
              const allTypeMatches = await getEntityAutocomplete(searchTerm);
              if (allTypeMatches.length > 0) {
                const entityId2 = formatEntityIdForSearch(allTypeMatches[0]);
                searchEndpoint = `/search/?text=${encodeURIComponent(entityId2)}`;
                searchResults = await makePubTatorRequest(searchEndpoint);
              }
            }
          } else {
            const allTypeMatches = await getEntityAutocomplete(searchTerm);
            if (allTypeMatches.length > 0) {
              const entityId = formatEntityIdForSearch(allTypeMatches[0]);
              searchEndpoint = `/search/?text=${encodeURIComponent(entityId)}`;
              searchResults = await makePubTatorRequest(searchEndpoint);
            }
          }
        }

        if (!searchResults || !searchResults.results || searchResults.results.length === 0) {
          return {
            content: [{
              type: "text",
              text: `No publications found for search term "${searchTerm}". If this is a gene or entity name, try using the entity's PubTator ID format (e.g., @GENE_672) or ensure the spelling is correct.`
            }]
          };
        }

        // Limit results and extract PMIDs
        const publications = searchResults.results.slice(0, maxResults);
        const pmids = publications.map((p: any) => p.pmid).filter((pmid: any) => pmid);

        if (pmids.length === 0) {
          return {
            content: [{
              type: "text",
              text: `No valid PMIDs found in search results for "${searchTerm}".`
            }]
          };
        }

        // Phase 2: Batch fetch BioC JSON (relations are PRE-EXTRACTED in this response)
        const exportEndpoint = `/publications/export/biocjson?pmids=${pmids.join(',')}&full=true`;
        const biocData = await makePubTatorRequest(exportEndpoint);

        // Phase 3: Parse BioC JSON to extract entities and relations
        const parsedPublications = parseBiocJson(biocData);
        
        // Create a map of PMID to publication metadata from search results
        const pubMetadataMap = new Map<string, any>();
        publications.forEach((pub: any) => {
          if (pub.pmid) {
            pubMetadataMap.set(pub.pmid.toString(), {
              title: pub.title || 'Untitled',
              authors: pub.authors || [],
              journal: pub.journal || '',
              year: pub.date ? pub.date.split('-')[0] : ''
            });
          }
        });

        // Phase 4: Extract relations and entities, then add to graph
        let nodeResult = { created: 0, skipped: 0, total: 0 };
        let edgeResult = { created: 0, skipped: 0, total: 0 };
        let relationStats = {
          publicationsWithRelations: 0,
          publicationsWithoutRelations: 0,
          totalRelationsFound: 0,
          uniqueRelationEdges: 0,
          relationTypes: new Set<string>(),
          pmidsWithRelations: new Set<string>()
        };

        // Collect all entities and relations
        const nodesToCreate: Omit<NodeData, 'id'>[] = [];
        const processedEntityIds = new Set<string>();
        const relationMap = new Map<string, { 
          entity1Id: string; 
          entity2Id: string; 
          relationType: string; 
          pmids: Set<string>;
          entity1Name: string;
          entity2Name: string;
          entity1Type: string;
          entity2Type: string;
        }>();

        // Process each publication
        for (const pub of parsedPublications) {
          // Collect entities from title/abstract
          for (const entity of pub.entities) {
            if (!processedEntityIds.has(entity.pubtatorId)) {
              const entityType = getEntityType(entity.type);
              nodesToCreate.push({
                label: entity.name,
                type: entityType.type,
                data: {
                  pubtatorId: entity.pubtatorId,
                  source: 'pubtator',
                  entityType: entity.type
                },
                position: {
                  x: Math.random() * 800 + 100,
                  y: Math.random() * 600 + 100
                }
              });
              processedEntityIds.add(entity.pubtatorId);
            }
          }

          // Extract relations (PRE-EXTRACTED by PubTator)
          if (pub.relations && pub.relations.length > 0) {
            relationStats.publicationsWithRelations++;
            relationStats.pmidsWithRelations.add(pub.pmid);
            relationStats.totalRelationsFound += pub.relations.length;

            for (const relation of pub.relations) {
              // Filter by relationship types if specified
              const normalizedType = relation.type.toLowerCase();
              if (relationshipTypes && relationshipTypes.length > 0) {
                const typeMatches = relationshipTypes.some(rt => 
                  rt.toLowerCase() === normalizedType || 
                  rt.toLowerCase() === relation.type.toLowerCase()
                );
                if (!typeMatches) continue;
              }

              relationStats.relationTypes.add(normalizedType);

              // Create a consistent key for the relation (smaller ID first)
              const entity1Id = relation.entity1Id;
              const entity2Id = relation.entity2Id;
              const relationKey = entity1Id < entity2Id
                ? `${entity1Id}|${entity2Id}|${normalizedType}`
                : `${entity2Id}|${entity1Id}|${normalizedType}`;

              if (!relationMap.has(relationKey)) {
                relationMap.set(relationKey, {
                  entity1Id: entity1Id < entity2Id ? entity1Id : entity2Id,
                  entity2Id: entity1Id < entity2Id ? entity2Id : entity1Id,
                  relationType: normalizedType,
                  pmids: new Set(),
                  entity1Name: entity1Id < entity2Id ? relation.entity1Name : relation.entity2Name,
                  entity2Name: entity1Id < entity2Id ? relation.entity2Name : relation.entity1Name,
                  entity1Type: entity1Id < entity2Id ? relation.entity1Type : relation.entity2Type,
                  entity2Type: entity1Id < entity2Id ? relation.entity2Type : relation.entity1Type
                });
              }

              relationMap.get(relationKey)!.pmids.add(`PMID:${pub.pmid}`);
            }
          } else {
            relationStats.publicationsWithoutRelations++;
          }
        }

        // Add entities involved in relations (if not already added)
        for (const relationData of relationMap.values()) {
          // Add entity1 if not already processed
          if (!processedEntityIds.has(relationData.entity1Id)) {
            const entity1TypeObj = getEntityType(relationData.entity1Type);
            nodesToCreate.push({
              label: relationData.entity1Name,
              type: entity1TypeObj.type,
              data: {
                pubtatorId: relationData.entity1Id,
                source: 'pubtator',
                entityType: relationData.entity1Type
              },
              position: {
                x: Math.random() * 800 + 100,
                y: Math.random() * 600 + 100
              }
            });
            processedEntityIds.add(relationData.entity1Id);
          }

          // Add entity2 if not already processed
          if (!processedEntityIds.has(relationData.entity2Id)) {
            const entity2TypeObj = getEntityType(relationData.entity2Type);
            nodesToCreate.push({
              label: relationData.entity2Name,
              type: entity2TypeObj.type,
              data: {
                pubtatorId: relationData.entity2Id,
                source: 'pubtator',
                entityType: relationData.entity2Type
              },
              position: {
                x: Math.random() * 800 + 100,
                y: Math.random() * 600 + 100
              }
            });
            processedEntityIds.add(relationData.entity2Id);
          }
        }

        // Bulk create nodes
        nodeResult = await bulkCreateNodesInDatabase(nodesToCreate, databaseContext);
        relationStats.uniqueRelationEdges = relationMap.size;

        // Fetch existing relation edges from database
        const existingEdges = await getExistingEdges(databaseContext);
        
        // Create relation edges
        const edgesToCreate: EdgeData[] = [];
        const edgesToUpdate: EdgeData[] = [];

        for (const [relationKey, relationData] of relationMap) {
          const mappedRelationType = mapRelationshipType(relationData.relationType);
          const edgeId = generateCompositeEdgeId(
            databaseContext.conversationId,
            'pubtator',
            'pubtator',
            relationData.entity1Id,
            mappedRelationType,
            relationData.entity2Id
          );

          const newPMIDs = Array.from(relationData.pmids);
          const existingEdge = existingEdges.get(edgeId);
          
          let finalPMIDs: string[];
          if (existingEdge) {
            // Merge with existing publications
            finalPMIDs = mergePublications(existingEdge.data.publications, newPMIDs);
            
            const updatedEdge: EdgeData = {
              ...existingEdge,
              data: {
                ...existingEdge.data,
                publications: finalPMIDs
              }
            };
            edgesToUpdate.push(updatedEdge);
          } else {
            // New edge - use all PMIDs
            finalPMIDs = newPMIDs;
            
            const edgeData: EdgeData = {
              id: edgeId,
              source: relationData.entity1Id,
              target: relationData.entity2Id,
              label: mappedRelationType,
              data: {
                type: relationData.relationType,
                source: 'pubtator',
                primary_source: 'pubtator',
                publications: finalPMIDs
              }
            };
            edgesToCreate.push(edgeData);
          }
        }

        // Bulk create new edges
        const createResult = await bulkCreateEdgesInDatabase(edgesToCreate, databaseContext);
        
        // Update existing edges
        const updateResult = await bulkUpdateEdgesInDatabase(edgesToUpdate, databaseContext);
        
        edgeResult = {
          created: createResult.created,
          skipped: createResult.skipped + (edgesToUpdate.length - updateResult.updated),
          total: edgesToCreate.length + edgesToUpdate.length
        };

        // Phase 5: Format response (simplified - no abstracts)
        let response = `# Relationships from Publications: "${searchTerm}"\n\n`;
        if (limitMessage) {
          response += limitMessage;
        }
        response += `Found ${parsedPublications.length} publication(s).\n\n`;
        
        response += `## Publication Summary\n\n`;
        response += `- **Publications with relations**: ${relationStats.publicationsWithRelations}\n`;
        response += `- **Publications without relations**: ${relationStats.publicationsWithoutRelations}\n`;
        response += `- **PubMed IDs with relations**: ${Array.from(relationStats.pmidsWithRelations).sort().join(', ')}\n\n`;
        
        response += `## Extracted Relations Summary\n\n`;
        response += `- **Total relations found**: ${relationStats.totalRelationsFound}\n`;
        response += `- **Unique relation edges**: ${relationStats.uniqueRelationEdges}\n`;
        response += `- **Relationship types**: ${Array.from(relationStats.relationTypes).join(', ')}\n\n`;

        // List distinct nodes
        const distinctNodes = Array.from(processedEntityIds).sort();
        response += `## Distinct Nodes (${distinctNodes.length})\n\n`;
        distinctNodes.forEach((nodeId, idx) => {
          const node = nodesToCreate.find(n => n.data.pubtatorId === nodeId);
          if (node) {
            response += `${idx + 1}. ${node.label} (${node.data.pubtatorId})\n`;
          }
        });
        response += `\n`;

        // List edges (subject, predicate, object)
        response += `## Extracted Edges (${relationMap.size})\n\n`;
        let edgeIdx = 1;
        for (const [relationKey, relationData] of relationMap) {
          const mappedRelationType = mapRelationshipType(relationData.relationType);
          const pmidsList = Array.from(relationData.pmids).sort().join(', ');
          response += `${edgeIdx}. **Subject**: ${relationData.entity1Name} (${relationData.entity1Id})\n`;
          response += `   **Predicate**: ${mappedRelationType}\n`;
          response += `   **Object**: ${relationData.entity2Name} (${relationData.entity2Id})\n`;
          response += `   **Publications**: ${pmidsList}\n\n`;
          edgeIdx++;
        }

        response += `**Graph Addition**: Added ${nodeResult.created} entity node(s) and ${edgeResult.created} relation edge(s) to the graph.\n`;
        response += `Note: ${nodeResult.skipped} duplicate node(s) and ${edgeResult.skipped} duplicate edge(s) were automatically skipped.\n`;
        response += `Relationships were extracted from pre-computed PubTator relations in the publications.\n`;

        return {
          content: [{
            type: "text",
            text: response
          }],
          refreshGraph: true
        };

      } catch (error) {
        console.error(`[${SERVICE_NAME}] Error in findSearchTermPublicationRelationships:`, error);
        return {
          content: [{
            type: "text",
            text: `Error searching for publication relationships: ${error instanceof Error ? error.message : 'Unknown error'}`
          }]
        };
      }
    }

    throw new Error(`Unknown tool: ${name}`);
  } catch (error) {
    console.error(`[${SERVICE_NAME}] Tool execution failed:`, error);
    
    return {
      content: [{
        type: "text",
        text: `Error: ${error instanceof Error ? error.message : String(error)}`
      }]
    };
  }
});

// =============================================================================
// SERVER STARTUP
// =============================================================================
async function main() {
  console.error(`[${SERVICE_NAME}] Starting Graph Mode PubTator MCP Server...`);
  console.error(`[${SERVICE_NAME}] PubTator API Base URL: ${PUBTATOR_BASE_URL}`);
  console.error(`[${SERVICE_NAME}] PubTator API Key configured: ${PUBTATOR_API_KEY ? 'Yes' : 'No (not required)'}`);
  console.error(`[${SERVICE_NAME}] PubTator User Email: ${PUBTATOR_USER_EMAIL ? PUBTATOR_USER_EMAIL : 'Not set (not required)'}`);

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`[${SERVICE_NAME}] Graph Mode PubTator MCP Server running on stdio`);
}

main().catch(console.error);
