import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import fetch from "node-fetch";

// =============================================================================
// CONFIGURATION SECTION - NCBI and UniProt API Configuration
// =============================================================================

const NCBI_BASE_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";
const UNIPROT_BASE_URL = "https://rest.uniprot.org/uniprotkb";
const EMAIL = "mcp-tool@example.com";
const TOOL_NAME = "variant-domain-mcp";
const SERVICE_NAME = "variant-domain-mapper";

// Rate limiting
const RATE_LIMIT_DELAY = 1000; // 1 second between NCBI requests

// =============================================================================
// SCHEMA DEFINITIONS
// =============================================================================

const MapVariantSchema = z.object({
  transcript_id: z.string().describe("RefSeq transcript ID (e.g., NM_005228.3)"),
  gene_symbol: z.string().describe("Gene symbol (e.g., EGFR)"),
  protein_change: z.string().describe("Protein change in HGVS format (e.g., p.Leu883Ser)"),
  coding_change: z.string().optional().describe("Coding change in HGVS format (e.g., c.2648T>C)"),
  output_format: z.enum(["markdown", "visualization"]).optional().default("markdown").describe("Output format: 'markdown' for text or 'visualization' for Nightingale visualization")
});

const GetProteinDomainsSchema = z.object({
  gene_symbol: z.string().describe("Gene symbol to get domain information for"),
  uniprot_id: z.string().optional().describe("UniProt ID (if known)")
});

const BatchMapVariantsSchema = z.object({
  variants: z.array(z.object({
    transcript_id: z.string(),
    gene_symbol: z.string(),
    protein_change: z.string(),
    coding_change: z.string().optional()
  })).describe("Array of variants to map")
});

// =============================================================================
// TYPES
// =============================================================================

interface VariantInfo {
  geneSymbol: string;
  proteinChange: string;
  codingChange?: string;
}

interface ParsedVariant {
  fromAA: string;
  position: number;
  toAA: string;
}

interface DomainData {
  domains: Domain[];
  features: Feature[];
  uniprotIds: string[];
  gene: {
    geneId: string;
    geneName: string;
  };
}

interface Domain {
  begin: number;
  end: number;
  description: string;
  evidence: string[];
}

interface Feature {
  type: string;
  begin: number;
  end: number;
  description: string;
}

interface Alignment {
  sequence1: {
    name: string;
    sequence: string;
    length: number;
  };
  sequence2: {
    name: string;
    sequence: string;
    length: number;
  };
  identical: boolean;
  differences: any[];
  positionMapping: { [key: number]: number };
}

interface DomainImpact {
  hasImpact: boolean;
  domains: (Domain & { index: number })[];
  features: (Feature & { index: number })[];
  position: number;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function parseVariantPosition(proteinChange: string): ParsedVariant {
  const match = proteinChange.match(/p\.([A-Za-z]{3})(\d+)([A-Za-z]{3})/);
  if (!match) {
    throw new Error(`Invalid protein change format: ${proteinChange}`);
  }

  return {
    fromAA: match[1],
    position: parseInt(match[2]),
    toAA: match[3]
  };
}

// =============================================================================
// NCBI API FUNCTIONS
// =============================================================================

async function getProteinFromTranscript(transcriptId: string): Promise<string | null> {
  try {
    console.log(`🔍 Converting transcript ${transcriptId} to protein accession...`);
    await sleep(RATE_LIMIT_DELAY);
    
    // Search for the transcript
    const searchUrl = `${NCBI_BASE_URL}/esearch.fcgi`;
    const searchParams = new URLSearchParams({
      db: 'nuccore',
      term: transcriptId,
      retmode: 'json',
      email: EMAIL,
      tool: TOOL_NAME
    });

    const searchResponse = await fetch(`${searchUrl}?${searchParams}`);
    const searchData = await searchResponse.json() as any;
    let nucleotideId = searchData.esearchresult.idlist[0];
    
    if (!nucleotideId) {
      // Try without version number
      const baseTranscript = transcriptId.split('.')[0];
      console.log(`⚠️  Transcript ${transcriptId} not found, trying ${baseTranscript}...`);
      
      const altSearchParams = new URLSearchParams({
        db: 'nuccore',
        term: baseTranscript,
        retmode: 'json',
        email: EMAIL,
        tool: TOOL_NAME
      });

      await sleep(RATE_LIMIT_DELAY);
      const altSearchResponse = await fetch(`${searchUrl}?${altSearchParams}`);
      const altSearchData = await altSearchResponse.json() as any;
      nucleotideId = altSearchData.esearchresult.idlist[0];
      
      if (!nucleotideId) {
        throw new Error(`Transcript ${transcriptId} not found`);
      }
    }

    // Check if transcript was replaced with newer version
    await sleep(RATE_LIMIT_DELAY);
    const summaryUrl = `${NCBI_BASE_URL}/esummary.fcgi`;
    const summaryParams = new URLSearchParams({
      db: 'nuccore',
      id: nucleotideId,
      retmode: 'json',
      email: EMAIL,
      tool: TOOL_NAME
    });

    const summaryResponse = await fetch(`${summaryUrl}?${summaryParams}`);
    const summaryData = await summaryResponse.json() as any;
    const summary = summaryData.result[nucleotideId];
    
    if (summary?.replacedby) {
      console.log(`⚠️  Transcript ${transcriptId} was replaced by ${summary.replacedby}`);
      console.log(`🔄 Using current version: ${summary.replacedby}`);
      return await getProteinFromTranscript(summary.replacedby);
    }

    // Approach 1: Try elink
    let proteinAccession: string | null = null;
    try {
      await sleep(RATE_LIMIT_DELAY);
      const linkUrl = `${NCBI_BASE_URL}/elink.fcgi`;
      const linkParams = new URLSearchParams({
        dbfrom: 'nuccore',
        db: 'protein',
        id: nucleotideId,
        retmode: 'json',
        email: EMAIL,
        tool: TOOL_NAME
      });

      const linkResponse = await fetch(`${linkUrl}?${linkParams}`);
      const linkData = await linkResponse.json() as any;
      const links = linkData.linksets[0]?.linksetdbs?.find((db: any) => db.dbto === 'protein');
      
      if (links && links.links && links.links.length > 0) {
        const proteinId = links.links[0];

        await sleep(RATE_LIMIT_DELAY);
        const protSummaryParams = new URLSearchParams({
          db: 'protein',
          id: proteinId,
          retmode: 'json',
          email: EMAIL,
          tool: TOOL_NAME
        });

        const protSummaryResponse = await fetch(`${summaryUrl}?${protSummaryParams}`);
        const protSummaryData = await protSummaryResponse.json() as any;
        proteinAccession = protSummaryData.result[proteinId].caption;
        
        console.log(`✅ Found protein via elink: ${proteinAccession}`);
        return proteinAccession;
      }
    } catch (linkError) {
      console.log(`⚠️  elink approach failed: ${linkError}`);
    }

    // Approach 2: Try direct protein search (NM_ → NP_)
    try {
      const transcriptBase = transcriptId.split('.')[0].replace('NM_', 'NP_');
      console.log(`🔄 Trying direct protein search: ${transcriptBase}`);
      
      await sleep(RATE_LIMIT_DELAY);
      const protSearchParams = new URLSearchParams({
        db: 'protein',
        term: transcriptBase,
        retmode: 'json',
        email: EMAIL,
        tool: TOOL_NAME
      });

      const protSearchResponse = await fetch(`${searchUrl}?${protSearchParams}`);
      const protSearchData = await protSearchResponse.json() as any;
      
      if (protSearchData.esearchresult.idlist.length > 0) {
        const proteinId = protSearchData.esearchresult.idlist[0];
        
        await sleep(RATE_LIMIT_DELAY);
        const protSummaryParams = new URLSearchParams({
          db: 'protein',
          id: proteinId,
          retmode: 'json',
          email: EMAIL,
          tool: TOOL_NAME
        });

        const protSummaryResponse = await fetch(`${summaryUrl}?${protSummaryParams}`);
        const protSummaryData = await protSummaryResponse.json() as any;
        proteinAccession = protSummaryData.result[proteinId].caption;
        
        console.log(`✅ Found protein via direct search: ${proteinAccession}`);
        return proteinAccession;
      }
    } catch (directError) {
      console.log(`⚠️  Direct search approach failed: ${directError}`);
    }

    throw new Error(`No protein found for transcript ${transcriptId} using any method`);
  } catch (error) {
    console.error(`Error converting transcript to protein:`, error);
    return null;
  }
}

async function getProteinSequence(proteinAccession: string): Promise<string> {
  await sleep(RATE_LIMIT_DELAY);
  
  const fetchUrl = `${NCBI_BASE_URL}/efetch.fcgi`;
  const fetchParams = new URLSearchParams({
    db: 'protein',
    id: proteinAccession,
    rettype: 'fasta',
    retmode: 'text',
    email: EMAIL,
    tool: TOOL_NAME
  });

  const response = await fetch(`${fetchUrl}?${fetchParams}`);
  const fastaText = await response.text();
  
  // Extract sequence from FASTA
  const lines = fastaText.split('\n');
  const sequence = lines.slice(1).join('').replace(/\s/g, '');
  
  return sequence;
}

// =============================================================================
// UNIPROT API FUNCTIONS
// =============================================================================

async function getUniprotData(geneSymbol: string): Promise<DomainData | null> {
  try {
    // Search UniProt by gene name using the REST API
    const searchUrl = `${UNIPROT_BASE_URL}/search?query=gene:${geneSymbol}+AND+organism_id:9606&format=json&size=1`;
    const searchResponse = await fetch(searchUrl);
    
    if (!searchResponse.ok) {
      console.error(`UniProt search failed: ${searchResponse.status} ${searchResponse.statusText}`);
      return null;
    }
    
    const searchData = await searchResponse.json() as any;
    
    if (!searchData.results || searchData.results.length === 0) {
      return null;
    }

    const entry = searchData.results[0];
    const uniprotId = entry.primaryAccession;

    // The search response already contains the full entry data
    const detailData = entry;

    // Extract domains and features
    const domains: Domain[] = [];
    const features: Feature[] = [];

    if (detailData.features) {
      detailData.features.forEach((feature: any) => {
        if (feature.type === 'Domain') {
          domains.push({
            begin: feature.location.start.value,
            end: feature.location.end.value,
            description: feature.description || 'Domain',
            evidence: feature.evidences?.map((e: any) => e.code) || []
          });
        } else if (['Region', 'Motif', 'Site', 'Active site', 'Binding site'].includes(feature.type)) {
          features.push({
            type: feature.type,
            begin: feature.location.start.value,
            end: feature.location.end.value,
            description: feature.description || feature.type
          });
        }
      });
    }

    return {
      domains,
      features,
      uniprotIds: [uniprotId],
      gene: {
        geneId: entry.genes?.[0]?.geneName || geneSymbol,
        geneName: geneSymbol
      }
    };
  } catch (error) {
    console.error('Error fetching UniProt data:', error);
    return null;
  }
}

async function getUniprotSequence(uniprotId: string): Promise<string> {
  const url = `${UNIPROT_BASE_URL}/${uniprotId}?format=json`;
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch UniProt sequence: ${response.status} ${response.statusText}`);
  }
  
  const data = await response.json() as any;
  return data.sequence.value;
}

// =============================================================================
// VISUALIZATION HELPER FUNCTIONS
// =============================================================================

function getColorForDomain(index: number): string {
  const colors = [
    "#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4", "#FECA57",
    "#FF9FF3", "#54A0FF", "#48DBFB", "#0ABDE3", "#00D2D3"
  ];
  return colors[index % colors.length];
}

function getColorForFeatureType(type: string): string {
  const colorMap: Record<string, string> = {
    "Active site": "#FF5252",
    "Binding site": "#536DFE",
    "Site": "#FFAB40",
    "Motif": "#7C4DFF",
    "Region": "#64FFDA",
    "Default": "#9E9E9E"
  };
  return colorMap[type] || colorMap.Default;
}

// =============================================================================
// CORE MAPPING FUNCTIONS
// =============================================================================

function alignSequences(seq1: string, seq2: string, seq1Name: string, seq2Name: string): Alignment {
  const alignment: Alignment = {
    sequence1: {
      name: seq1Name,
      sequence: seq1,
      length: seq1.length
    },
    sequence2: {
      name: seq2Name,
      sequence: seq2,
      length: seq2.length
    },
    identical: seq1 === seq2,
    differences: [],
    positionMapping: {}
  };

  if (seq1 === seq2) {
    // Create 1:1 position mapping
    for (let i = 1; i <= seq1.length; i++) {
      alignment.positionMapping[i] = i;
    }
  } else {
    // Simple alignment assuming minimal gaps
    const minLength = Math.min(seq1.length, seq2.length);
    
    for (let i = 0; i < minLength; i++) {
      if (seq1[i] !== seq2[i]) {
        alignment.differences.push({
          position1: i + 1,
          position2: i + 1,
          aa1: seq1[i],
          aa2: seq2[i]
        });
      }
      alignment.positionMapping[i + 1] = i + 1;
    }
  }

  return alignment;
}

function checkDomainImpact(position: number, domainData: DomainData): DomainImpact {
  const impactedDomains: (Domain & { index: number })[] = [];
  const impactedFeatures: (Feature & { index: number })[] = [];

  // Check domains
  domainData.domains.forEach((domain, index) => {
    if (position >= domain.begin && position <= domain.end) {
      impactedDomains.push({
        ...domain,
        index: index + 1
      });
    }
  });

  // Check features
  domainData.features.forEach((feature, index) => {
    if (position >= feature.begin && position <= feature.end) {
      impactedFeatures.push({
        ...feature,
        index: index + 1
      });
    }
  });

  return {
    hasImpact: impactedDomains.length > 0 || impactedFeatures.length > 0,
    domains: impactedDomains,
    features: impactedFeatures,
    position
  };
}

// =============================================================================
// FORMATTING FUNCTIONS
// =============================================================================

function formatVariantMappingAsMarkdown(result: any): string {
  let markdown = `# Variant-to-Domain Mapping Results\n\n`;
  
  // Input Summary
  markdown += `## Input Information\n\n`;
  markdown += `- **Transcript ID**: ${result.input.transcriptId}\n`;
  markdown += `- **Protein Accession**: ${result.input.proteinAccession}\n`;
  markdown += `- **Gene Symbol**: ${result.input.variant.geneSymbol}\n`;
  markdown += `- **Protein Change**: ${result.input.variant.proteinChange}\n`;
  if (result.input.variant.codingChange) {
    markdown += `- **Coding Change**: ${result.input.variant.codingChange}\n`;
  }
  markdown += `\n`;

  // Sequence Information
  markdown += `## Sequence Information\n\n`;
  markdown += `- **Transcript Protein**: ${result.alignment.sequence1.length} amino acids\n`;
  markdown += `- **UniProt Reference**: ${result.alignment.sequence2.length} amino acids\n`;
  markdown += `- **Sequences Identical**: ${result.alignment.identical ? '✅ Yes' : '❌ No'}\n`;
  
  if (!result.alignment.identical && result.alignment.differences.length > 0) {
    markdown += `- **Differences Found**: ${result.alignment.differences.length}\n\n`;
    if (result.alignment.differences.length <= 5) {
      markdown += `### Sequence Differences\n\n`;
      markdown += `| Position | RefSeq | UniProt |\n`;
      markdown += `|----------|--------|----------|\n`;
      result.alignment.differences.forEach((diff: any) => {
        markdown += `| ${diff.position1} | ${diff.aa1} | ${diff.aa2} |\n`;
      });
      markdown += `\n`;
    }
  }

  // Position Mapping
  markdown += `## Variant Position Mapping\n\n`;
  markdown += `- **Original Position**: ${result.mapping.transcriptPosition} (${result.input.proteinAccession})\n`;
  markdown += `- **UniProt Position**: ${result.mapping.uniprotPosition} (${result.uniprotData.uniprotIds[0]})\n`;
  markdown += `- **Amino Acid Change**: ${result.mapping.aminoAcidChange.original} → ${result.mapping.aminoAcidChange.mutated}\n\n`;

  // Domain Impact
  markdown += `## Domain Impact Analysis\n\n`;
  if (result.domainImpact.hasImpact) {
    markdown += `### ✅ VARIANT IMPACTS FUNCTIONAL REGIONS\n\n`;
    
    if (result.domainImpact.domains.length > 0) {
      markdown += `#### Impacted Protein Domains (${result.domainImpact.domains.length})\n\n`;
      result.domainImpact.domains.forEach((domain: any) => {
        markdown += `**${domain.index}. ${domain.description}**\n`;
        markdown += `- Domain Range: ${domain.begin} - ${domain.end}\n`;
        markdown += `- Variant Position: ${result.mapping.uniprotPosition}\n`;
        markdown += `- Evidence: ${domain.evidence.join(', ') || 'N/A'}\n\n`;
      });
    }

    if (result.domainImpact.features.length > 0) {
      markdown += `#### Impacted Structural Features (${result.domainImpact.features.length})\n\n`;
      result.domainImpact.features.forEach((feature: any) => {
        markdown += `**${feature.index}. ${feature.type}: ${feature.description}**\n`;
        markdown += `- Feature Range: ${feature.begin} - ${feature.end}\n`;
        markdown += `- Variant Position: ${result.mapping.uniprotPosition}\n\n`;
      });
    }
  } else {
    markdown += `### ❌ No Domain Impact Detected\n\n`;
    markdown += `Position ${result.mapping.uniprotPosition} is outside all annotated domains and features.\n\n`;
  }

  // Domain Map
  markdown += `## Domain Map Visualization\n\n`;
  markdown += formatDomainMap(result);

  // External Resources
  markdown += `## External Resources\n\n`;
  markdown += `- [NCBI Protein](https://www.ncbi.nlm.nih.gov/protein/${result.input.proteinAccession})\n`;
  markdown += `- [UniProt](https://www.uniprot.org/uniprot/${result.uniprotData.uniprotIds[0]})\n`;
  if (result.uniprotData.gene.geneId) {
    markdown += `- [NCBI Gene](https://www.ncbi.nlm.nih.gov/gene/${result.uniprotData.gene.geneId})\n`;
  }

  return markdown;
}

function formatDomainMap(result: any): string {
  const proteinLength = result.alignment.sequence2.length;
  const variantPos = result.mapping.uniprotPosition;
  const domains = result.uniprotData.domains || [];

  let markdown = "```\n";
  markdown += `Protein: 1 ${'─'.repeat(60)} ${proteinLength}\n\n`;
  
  domains.forEach((domain: any, index: number) => {
    const scale = proteinLength / 60;
    const startPos = Math.round(domain.begin / scale);
    const endPos = Math.round(domain.end / scale);
    
    let map = ' '.repeat(70);
    let mapArray = map.split('');
    
    // Mark domain
    for (let i = startPos; i <= endPos && i < 60; i++) {
      mapArray[i] = '█';
    }
    
    // Mark variant position if in this domain
    const variantMapPos = Math.round(variantPos / scale);
    if (variantPos >= domain.begin && variantPos <= domain.end) {
      if (variantMapPos < 60) {
        mapArray[variantMapPos] = '↑';
      }
    }
    
    markdown += `Domain ${index + 1}: ${mapArray.join('')}\n`;
    markdown += `${domain.description} (${domain.begin}-${domain.end})\n`;
    
    if (variantPos >= domain.begin && variantPos <= domain.end) {
      markdown += `*** VARIANT IMPACT: Position ${variantPos} ***\n`;
    }
    markdown += '\n';
  });
  
  markdown += "```\n";
  return markdown;
}

function formatDomainsAsMarkdown(domainData: DomainData, geneSymbol: string): string {
  let markdown = `# Protein Domain Information for ${geneSymbol}\n\n`;
  
  // UniProt Information
  markdown += `## UniProt Information\n\n`;
  markdown += `- **UniProt ID**: ${domainData.uniprotIds[0]}\n`;
  markdown += `- **Gene Name**: ${domainData.gene.geneName}\n\n`;

  // Domains
  if (domainData.domains.length > 0) {
    markdown += `## Protein Domains (${domainData.domains.length})\n\n`;
    domainData.domains.forEach((domain, index) => {
      markdown += `### ${index + 1}. ${domain.description}\n`;
      markdown += `- **Position**: ${domain.begin} - ${domain.end}\n`;
      markdown += `- **Length**: ${domain.end - domain.begin + 1} amino acids\n`;
      markdown += `- **Evidence**: ${domain.evidence.join(', ') || 'Not specified'}\n\n`;
    });
  } else {
    markdown += `## No Protein Domains Found\n\n`;
  }

  // Features
  if (domainData.features.length > 0) {
    markdown += `## Structural Features (${domainData.features.length})\n\n`;
    const featureTypes = [...new Set(domainData.features.map(f => f.type))];
    
    featureTypes.forEach(type => {
      const typeFeatures = domainData.features.filter(f => f.type === type);
      markdown += `### ${type} (${typeFeatures.length})\n\n`;
      typeFeatures.forEach(feature => {
        markdown += `- **${feature.description}**: ${feature.begin} - ${feature.end}\n`;
      });
      markdown += `\n`;
    });
  }

  // External Links
  markdown += `## External Resources\n\n`;
  markdown += `- [UniProt Entry](https://www.uniprot.org/uniprot/${domainData.uniprotIds[0]})\n`;
  markdown += `- [InterPro](https://www.ebi.ac.uk/interpro/search/text/${geneSymbol})\n`;
  markdown += `- [Pfam](https://www.ebi.ac.uk/interpro/search/text/${geneSymbol}/?filter=pfam)\n`;

  return markdown;
}

// =============================================================================
// MAIN MAPPING FUNCTION
// =============================================================================

async function mapVariantToDomains(
  transcriptId: string,
  variantInfo: VariantInfo
): Promise<any> {
  // Step 1: Convert transcript to protein accession
  let proteinAccession: string | null = null;
  let transcriptSequence: string | null = null;
  let useUniprotFallback = false;
  
  try {
    proteinAccession = await getProteinFromTranscript(transcriptId);
    if (proteinAccession) {
      // Step 2: Get transcript-specific protein sequence
      transcriptSequence = await getProteinSequence(proteinAccession);
    }
  } catch (error) {
    console.warn(`NCBI lookup failed for transcript ${transcriptId}, using UniProt fallback`);
    useUniprotFallback = true;
  }
  
  // Step 3: Get UniProt data
  const uniprotData = await getUniprotData(variantInfo.geneSymbol);
  if (!uniprotData || !uniprotData.domains) {
    throw new Error(`Could not retrieve UniProt domain data for: ${variantInfo.geneSymbol}`);
  }

  // Step 4: Get UniProt sequence
  const uniprotSequence = await getUniprotSequence(uniprotData.uniprotIds[0]);
  
  // Use UniProt sequence if NCBI failed
  if (useUniprotFallback || !transcriptSequence) {
    transcriptSequence = uniprotSequence;
    console.log(`Using UniProt sequence as fallback for ${variantInfo.geneSymbol}`);
  }

  // Ensure we have a valid sequence
  if (!transcriptSequence) {
    throw new Error(`Could not retrieve protein sequence for ${variantInfo.geneSymbol}`);
  }

  // Step 5: Parse variant position
  const variantPosition = parseVariantPosition(variantInfo.proteinChange);

  // Step 6: Perform sequence alignment
  const refName = proteinAccession || transcriptId;
  const alignment = alignSequences(transcriptSequence, uniprotSequence, refName, uniprotData.uniprotIds[0]);

  // Step 7: Map variant position
  const mappedPosition = alignment.positionMapping[variantPosition.position];
  if (!mappedPosition) {
    throw new Error(`Could not map position ${variantPosition.position}`);
  }

  // Step 8: Check domain impact
  const domainImpact = checkDomainImpact(mappedPosition, uniprotData);

  // Step 9: Create result
  return {
    input: {
      transcriptId,
      proteinAccession,
      variant: variantInfo
    },
    alignment,
    mapping: {
      transcriptPosition: variantPosition.position,
      uniprotPosition: mappedPosition,
      aminoAcidChange: {
        original: variantPosition.fromAA,
        mutated: variantPosition.toAA
      }
    },
    domainImpact,
    uniprotData
  };
}

// =============================================================================
// SERVER IMPLEMENTATION
// =============================================================================

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

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "map-variant-to-domains",
        description: "Map a genetic variant to protein domains using transcript ID and protein change notation",
        inputSchema: {
          type: "object",
          properties: {
            transcript_id: { type: "string", description: "RefSeq transcript ID (e.g., NM_005228.3)" },
            gene_symbol: { type: "string", description: "Gene symbol (e.g., EGFR)" },
            protein_change: { type: "string", description: "Protein change in HGVS format (e.g., p.Leu858Arg)" },
            coding_change: { type: "string", description: "Coding change in HGVS format (optional, e.g., c.2573T>G)" },
            output_format: { 
              type: "string", 
              enum: ["markdown", "visualization"],
              description: "Output format: 'markdown' for text or 'visualization' for Nightingale visualization (default: markdown)" 
            },
          },
          required: ["transcript_id", "gene_symbol", "protein_change"],
        },
      },
      {
        name: "get-protein-domains",
        description: "Get all protein domains for a gene symbol",
        inputSchema: {
          type: "object",
          properties: {
            gene_symbol: { type: "string", description: "Gene symbol (e.g., EGFR)" },
          },
          required: ["gene_symbol"],
        },
      },
      {
        name: "batch-map-variants",
        description: "Map multiple variants to protein domains in batch",
        inputSchema: {
          type: "object",
          properties: {
            variants: {
              type: "array",
              description: "Array of variants to map",
              items: {
                type: "object",
                properties: {
                  transcript_id: { type: "string", description: "RefSeq transcript ID" },
                  gene_symbol: { type: "string", description: "Gene symbol" },
                  protein_change: { type: "string", description: "Protein change in HGVS format" },
                  coding_change: { type: "string", description: "Coding change in HGVS format (optional)" },
                },
                required: ["transcript_id", "gene_symbol", "protein_change"],
              },
            },
          },
          required: ["variants"],
        },
      }
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    if (name === "map-variant-to-domains") {
      const params = MapVariantSchema.parse(args);
      
      const variantInfo: VariantInfo = {
        geneSymbol: params.gene_symbol,
        proteinChange: params.protein_change,
        codingChange: params.coding_change
      };

      const result = await mapVariantToDomains(params.transcript_id, variantInfo);
      
      // Check output format
      if (params.output_format === "visualization") {
        // Get UniProt sequence for visualization
        const uniprotSequence = await getUniprotSequence(result.uniprotData.uniprotIds[0]);
        
        // Create visualization data
        const visualizationData = {
          proteinId: result.uniprotData.uniprotIds[0],
          sequence: uniprotSequence,
          length: uniprotSequence.length,
          tracks: [
            {
              type: "domain",
              label: "Protein Domains",
              features: result.domainImpact.domains.map((domain: any, idx: number) => ({
                accession: `domain_${idx}`,
                start: domain.begin,
                end: domain.end,
                color: getColorForDomain(idx),
                description: domain.description,
                evidence: domain.evidence
              }))
            },
            {
              type: "variant",
              label: "Variant Position",
              features: [{
                accession: "variant",
                start: result.mapping.uniprotPosition,
                end: result.mapping.uniprotPosition,
                color: "#FF0000",
                description: `${params.protein_change} (${params.coding_change || 'N/A'})`,
                shape: "diamond"
              }]
            },
            {
              type: "feature",
              label: "Functional Features",
              features: result.domainImpact.features.map((feature: any, idx: number) => ({
                accession: `feature_${idx}`,
                start: feature.begin,
                end: feature.end,
                color: getColorForFeatureType(feature.type),
                description: `${feature.type}: ${feature.description}`,
                shape: feature.begin === feature.end ? "circle" : "rectangle"
              }))
            }
          ]
        };
        
        const summaryInstructions = `Visualizing variant ${params.protein_change} on ${params.gene_symbol} protein. The visualization shows:
1. Protein domains in different colors
2. Variant position marked with a red diamond
3. Functional features like active sites and binding sites
Please describe what the visualization reveals about the variant's location relative to functional regions.`;

        return {
          content: [
            {
              type: "text",
              text: `${summaryInstructions}\n\nThe interactive protein visualization is shown in the artifact below.`,
            }
          ],
          artifacts: [
            {
              type: "application/vnd.protein-visualization",
              title: `${params.gene_symbol} Domain Visualization`,
              content: JSON.stringify(visualizationData)
            }
          ],
        };
      } else {
        // Default markdown output
        const markdownContent = formatVariantMappingAsMarkdown(result);

        // Create summarization instructions
        const summaryInstructions = `Based on the conversation context, summarize the variant mapping results focusing on:
1. Whether the variant ${params.protein_change} impacts any functional protein domains
2. The specific domains or features affected (if any)
3. The clinical or functional significance of the affected regions
4. The position mapping between transcript and UniProt coordinates`;

        return {
          content: [
            {
              type: "text",
              text: `${summaryInstructions}\n\nThe full variant mapping analysis is available in the artifact below.`,
            }
          ],
          artifacts: [
            {
              type: "text/markdown",
              title: `Variant Domain Mapping: ${params.gene_symbol} ${params.protein_change}`,
              content: markdownContent
            }
          ],
        };
      }
    }

    if (name === "get-protein-domains") {
      const params = GetProteinDomainsSchema.parse(args);
      
      const domainData = await getUniprotData(params.gene_symbol);
      if (!domainData) {
        throw new Error(`No domain data found for gene: ${params.gene_symbol}`);
      }

      const markdownContent = formatDomainsAsMarkdown(domainData, params.gene_symbol);

      const summaryInstructions = `Based on the conversation context, summarize the protein domain information for ${params.gene_symbol}, highlighting:
1. The key functional domains present in the protein
2. Important structural features (active sites, binding sites, etc.)
3. The relevance of these domains to the protein's function`;

      return {
        content: [
          {
            type: "text",
            text: `${summaryInstructions}\n\nThe complete domain information is available in the artifact below.`,
          }
        ],
        artifacts: [
          {
            type: "text/markdown",
            title: `Protein Domains: ${params.gene_symbol}`,
            content: markdownContent
          }
        ],
      };
    }

    if (name === "batch-map-variants") {
      const params = BatchMapVariantsSchema.parse(args);
      
      let batchMarkdown = `# Batch Variant-to-Domain Mapping Results\n\n`;
      batchMarkdown += `Processing ${params.variants.length} variants...\n\n`;

      const results = [];
      
      for (const variant of params.variants) {
        try {
          const variantInfo: VariantInfo = {
            geneSymbol: variant.gene_symbol,
            proteinChange: variant.protein_change,
            codingChange: variant.coding_change
          };

          const result = await mapVariantToDomains(variant.transcript_id, variantInfo);
          results.push({
            success: true,
            variant,
            domainImpact: result.domainImpact.hasImpact,
            impactedDomains: result.domainImpact.domains.length,
            impactedFeatures: result.domainImpact.features.length
          });

          batchMarkdown += `---\n\n`;
          batchMarkdown += `## ${variant.gene_symbol} ${variant.protein_change}\n\n`;
          batchMarkdown += `- **Status**: ✅ Success\n`;
          batchMarkdown += `- **Domain Impact**: ${result.domainImpact.hasImpact ? 'Yes' : 'No'}\n`;
          if (result.domainImpact.hasImpact) {
            batchMarkdown += `- **Impacted Domains**: ${result.domainImpact.domains.length}\n`;
            batchMarkdown += `- **Impacted Features**: ${result.domainImpact.features.length}\n`;
          }
          batchMarkdown += `\n`;

        } catch (error) {
          results.push({
            success: false,
            variant,
            error: error instanceof Error ? error.message : 'Unknown error'
          });

          batchMarkdown += `---\n\n`;
          batchMarkdown += `## ${variant.gene_symbol} ${variant.protein_change}\n\n`;
          batchMarkdown += `- **Status**: ❌ Failed\n`;
          batchMarkdown += `- **Error**: ${error instanceof Error ? error.message : 'Unknown error'}\n\n`;
        }
      }

      // Summary
      const successful = results.filter(r => r.success).length;
      const withImpact = results.filter(r => r.success && r.domainImpact).length;
      
      batchMarkdown = `# Batch Variant-to-Domain Mapping Results\n\n` +
        `## Summary\n\n` +
        `- **Total Variants**: ${params.variants.length}\n` +
        `- **Successfully Mapped**: ${successful}\n` +
        `- **With Domain Impact**: ${withImpact}\n` +
        `- **Failed**: ${params.variants.length - successful}\n\n` +
        batchMarkdown;

      const summaryInstructions = `Summarize the batch variant mapping results:
1. How many variants were successfully mapped
2. How many variants impact functional domains
3. Any patterns in domain impacts across variants
4. Any failures and their reasons`;

      return {
        content: [
          {
            type: "text",
            text: `${summaryInstructions}\n\nDetailed results for all ${params.variants.length} variants are in the artifact below.`,
          }
        ],
        artifacts: [
          {
            type: "text/markdown",
            title: `Batch Variant Mapping Results (${params.variants.length} variants)`,
            content: batchMarkdown
          }
        ],
      };
    }

    throw new Error(`Unknown tool: ${name}`);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(`Invalid arguments: ${error.errors.map(e => `${e.path}: ${e.message}`).join(", ")}`);
    }
    throw error;
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
}); 