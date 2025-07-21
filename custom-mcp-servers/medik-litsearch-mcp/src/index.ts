import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

// mediKanren API endpoint
const MEDIKANREN_BASE = "https://medikanren.metareflective.systems/query0";

// Function to extract CURIEs from input (handles both direct CURIE strings and id-finder JSON)
function extractCuries(input: string): string[] {
  // Try to parse as JSON first (id-finder format)
  try {
    const parsed = JSON.parse(input);
    
    // Handle array format from id-finder
    if (Array.isArray(parsed)) {
      return parsed
        .filter(item => item && typeof item === 'object' && item.curie)
        .map(item => item.curie);
    }
    
    // Handle single object format
    if (parsed && typeof parsed === 'object' && parsed.curie) {
      return [parsed.curie];
    }
    
    // If JSON parsing succeeded but no CURIEs found, return empty array
    return [];
  } catch {
    // Not JSON, treat as direct CURIE string
    return [input.trim()];
  }
}

// Type for mediKanren tuple response
type MediKanrenTuple = [string, string, string, string, string, Record<string, unknown> | unknown[], string[]];

// Input validation schema
const LiteratureSearchRequestSchema = z.object({
  curie: z.string().describe("CURIE identifier to search for (e.g., 'DRUGBANK:DB12411') OR JSON output from id-finder MCP"),
  predicate: z.string().optional().default("").describe("Biolink predicate to filter by (leave empty for all relationships)"),
  maxResults: z.number().min(1).max(100).optional().default(50).describe("Maximum number of results to return"),
  includeEvidence: z.boolean().optional().default(true).describe("Whether to include evidence sentences when available")
});

// Type for literature reference
interface LiteratureReference {
  pmid: string;
  relationship: string;
  subjectCurie: string;
  subjectName: string;
  predicate: string;
  objectCurie: string;
  objectName: string;
  evidence?: {
    sentence?: string;
    publicationDate?: string;
    subjectScore?: string;
    objectScore?: string;
  };
}

// Create server instance
const server = new Server(
  {
    name: "medik-litsearch",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Function to query mediKanren
async function queryMediKanren(curie: string, predicate: string): Promise<MediKanrenTuple[]> {
  const results: MediKanrenTuple[] = [];
  
  try {
    // Query 1: curie -> X (what the CURIE relates to)
    const forwardUrl = `${MEDIKANREN_BASE}?subject=${encodeURIComponent(curie)}&predicate=${encodeURIComponent(predicate)}&object=`;
    const forwardResponse = await fetch(forwardUrl, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'MediK-LitSearch-MCP/1.0.0'
      }
    });
    
    if (forwardResponse.ok) {
      const forwardData = await forwardResponse.json();
      if (Array.isArray(forwardData)) {
        results.push(...forwardData);
      }
    }
    
    // Query 2: X -> curie (what relates to the CURIE)
    const reverseUrl = `${MEDIKANREN_BASE}?subject=&predicate=${encodeURIComponent(predicate)}&object=${encodeURIComponent(curie)}`;
    const reverseResponse = await fetch(reverseUrl, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'MediK-LitSearch-MCP/1.0.0'
      }
    });
    
    if (reverseResponse.ok) {
      const reverseData = await reverseResponse.json();
      if (Array.isArray(reverseData)) {
        results.push(...reverseData);
      }
    }
    
    // Remove duplicates based on unique relationship
    const seen = new Set<string>();
    const deduplicated = results.filter((tuple) => {
      const key = `${tuple[0]}-${tuple[2]}-${tuple[3]}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
    
    return deduplicated;
  } catch (error) {
    console.error("Error querying mediKanren:", error);
    return [];
  }
}

// Function to extract literature references from mediKanren results
function extractLiteratureReferences(results: MediKanrenTuple[], includeEvidence: boolean = true): LiteratureReference[] {
  const references: LiteratureReference[] = [];
  
  for (const tuple of results) {
    const [subjectCurie, subjectName, predicate, objectCurie, objectName, evidence, pmids] = tuple;
    
    // Extract PMIDs/PMCs from the last element
    if (Array.isArray(pmids) && pmids.length > 0) {
      for (const pmid of pmids) {
        const ref: LiteratureReference = {
          pmid: pmid,
          relationship: `${subjectName} ${predicate.replace('biolink:', '')} ${objectName}`,
          subjectCurie,
          subjectName,
          predicate,
          objectCurie,
          objectName,
        };
        
        // Add evidence if available and requested
        if (includeEvidence && evidence && typeof evidence === 'object' && !Array.isArray(evidence)) {
          // Handle complex evidence object structure with PMID keys
          // Evidence format: { "PMID:12345": { "sentence": "...", "publication date": "...", ... } }
          const evidenceData = evidence[pmid];
          if (evidenceData && typeof evidenceData === 'object') {
            const evidenceObj = evidenceData as Record<string, unknown>;
            ref.evidence = {
              sentence: evidenceObj.sentence as string,
              publicationDate: evidenceObj['publication date'] as string,
              subjectScore: evidenceObj['subject score'] as string,
              objectScore: evidenceObj['object score'] as string,
            };
          } else {
            // Fallback: try to find any evidence data in the object
            const evidenceKeys = Object.keys(evidence);
            if (evidenceKeys.length > 0) {
              const firstKey = evidenceKeys[0];
              const evidenceObj = evidence[firstKey];
              if (evidenceObj && typeof evidenceObj === 'object') {
                const objData = evidenceObj as Record<string, unknown>;
                ref.evidence = {
                  sentence: objData.sentence as string,
                  publicationDate: objData['publication date'] as string,
                  subjectScore: objData['subject score'] as string,
                  objectScore: objData['object score'] as string,
                };
              }
            }
          }
        }
        
        references.push(ref);
      }
    }
  }
  
  return references;
}

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "search_literature",
        description: "Search mediKanren knowledge graph for literature references related to a CURIE identifier. " +
          "Returns bibliography artifacts with PMC/PMID references and relationship context. " +
          "By default, returns all relationships regardless of predicate type. " +
          "Can also accept a JSON array of objects with a 'curie' property (e.g., [{'curie': 'DRUGBANK:DB12411'}, {'curie': 'MONDO:0007254'}]).",
        inputSchema: {
          type: "object",
          properties: {
            curie: {
              type: "string",
              description: "CURIE identifier to search for (e.g., 'DRUGBANK:DB12411', 'MONDO:0007254') or a JSON array of objects with a 'curie' property."
            },
            predicate: {
              type: "string",
              default: "",
              description: "Biolink predicate to filter by (e.g., 'biolink:treats_or_applied_or_studied_to_treat', 'associated_with'). Leave empty for all relationships."
            },
            maxResults: {
              type: "number",
              minimum: 1,
              maximum: 100,
              default: 50,
              description: "Maximum number of results to return"
            },
            includeEvidence: {
              type: "boolean",
              default: true,
              description: "Whether to include evidence sentences when available"
            }
          },
          required: ["curie"]
        }
      }
    ]
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === "search_literature") {
    try {
      const { curie, predicate, maxResults, includeEvidence } = LiteratureSearchRequestSchema.parse(args);
      
      console.error(`[medik-litsearch] Searching for literature related to: ${curie}`);
      
      // Extract CURIEs from the input
      const curiesToSearch = extractCuries(curie);
      console.error(`[medik-litsearch] Extracted ${curiesToSearch.length} CURIEs from input:`, curiesToSearch);
      
      // Query mediKanren for each CURIE
      const allResults: MediKanrenTuple[] = [];
      for (const curie of curiesToSearch) {
        const results = await queryMediKanren(curie, predicate);
        allResults.push(...results);
      }
      console.error(`[medik-litsearch] Query completed. Found ${allResults.length} total results`);
      
      if (allResults.length === 0) {
        return {
          content: [{
            type: "text",
            text: `No literature references found for ${curie} with predicate ${predicate || 'all relationships'}.`
          }]
        };
      }
      
      // Extract literature references
      const references = extractLiteratureReferences(allResults, includeEvidence);
      console.error(`[medik-litsearch] Extracted ${references.length} references`);
      
      // Limit results
      const limitedReferences = references.slice(0, maxResults);
      console.error(`[medik-litsearch] Limited to ${limitedReferences.length} references`);
      
      // Create bibliography artifact
      const bibliographyData = limitedReferences.map(ref => {
        // Ensure pmid is a string and handle various formats
        const pmidStr = String(ref.pmid).trim();
        let url = "";
        let cleanPmid = pmidStr;
        
        if (pmidStr.startsWith('PMC:')) {
          const pmcId = pmidStr.replace('PMC:', '');
          url = `https://www.ncbi.nlm.nih.gov/pmc/articles/PMC${pmcId}/`;
          cleanPmid = pmidStr; // Keep PMC: format for display
        } else if (pmidStr.startsWith('PMID:')) {
          const pmidNum = pmidStr.replace('PMID:', '');
          url = `https://pubmed.ncbi.nlm.nih.gov/${pmidNum}/`;
          cleanPmid = pmidNum; // Remove PMID: for clean display
        } else if (pmidStr.match(/^\d+$/)) {
          // Raw number - assume it's a PMID
          url = `https://pubmed.ncbi.nlm.nih.gov/${pmidStr}/`;
          cleanPmid = pmidStr;
        } else {
          // Fallback - try to extract numbers or use as-is
          const numMatch = pmidStr.match(/(\d+)/);
          if (numMatch) {
            const pmidNum = numMatch[1];
            url = `https://pubmed.ncbi.nlm.nih.gov/${pmidNum}/`;
            cleanPmid = pmidNum;
          } else {
            url = `https://pubmed.ncbi.nlm.nih.gov/${pmidStr}/`;
            cleanPmid = pmidStr;
          }
        }
        
        return {
          pmid: cleanPmid,
          title: String(ref.evidence?.sentence || ref.relationship || ""),
          authors: [], // Not available from mediKanren
          journal: "", // Not available from mediKanren
          year: ref.evidence?.publicationDate ? String(ref.evidence.publicationDate).match(/\d{4}/)?.[0] || "" : "", // Extract year from publication date
          abstract: String(ref.evidence?.sentence ? "" : ref.relationship || ""), // Empty if sentence used as title, otherwise use relationship
          url: url,
          doi: cleanPmid,
          relationship: String(ref.relationship || ""),
          subjectCurie: String(ref.subjectCurie || ""),
          subjectName: String(ref.subjectName || ""),
          predicate: String(ref.predicate || ""),
          objectCurie: String(ref.objectCurie || ""),
          objectName: String(ref.objectName || "")
        };
      });

      console.error(`[medik-litsearch] Created bibliography with ${bibliographyData.length} entries`);
      console.error(`[medik-litsearch] Sample entry:`, JSON.stringify(bibliographyData[0] || {}, null, 2));
      
      // Count unique PMIDs
      const uniquePmids = new Set(limitedReferences.map(ref => ref.pmid));
      
      const responseText = `# mediKanren Literature Search Results

**Query**: ${curie}
**Predicate**: ${predicate || 'all relationships'}
**Total Relationships**: ${allResults.length}
**Unique Publications**: ${uniquePmids.size}
**References Returned**: ${limitedReferences.length}

Found ${limitedReferences.length} literature references from ${uniquePmids.size} unique publications related to **${curie}**.

Each reference includes:
- **PMC/PMID**: Publication identifier
- **Relationship**: How the entities are connected
- **Evidence**: Sentence context when available
- **Entities**: Subject and object CURIEs and names

Click the bibliography link below to view detailed references.`;

      console.error(`[medik-litsearch] Returning text content (${responseText.length} chars):`, responseText.substring(0, 200) + '...');
      
      return {
        content: [{
          type: "text",
          text: responseText
        }],
        artifacts: [{
          type: "application/vnd.bibliography",
          title: `Literature References for ${curie}`,
          content: bibliographyData
        }]
      };

    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error in literature search: ${error instanceof Error ? error.message : String(error)}`
        }]
      };
    }
  }

  throw new Error(`Unknown tool: ${name}`);
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("mediKanren Literature Search MCP server running on stdio");
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
