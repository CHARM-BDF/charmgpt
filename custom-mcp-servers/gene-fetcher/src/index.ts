import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from 'zod';
import axios from 'axios';
import { Parser } from 'xml2js';
import dotenv from 'dotenv';

dotenv.config();

// Update API endpoints and add source URLs
const API_ENDPOINTS = {
  GO_API: 'https://api.geneontology.org/api/bioentity/gene',
  KEGG_API: 'https://rest.kegg.jp',
  STRING_API: 'https://string-db.org/api/json/network',
  EUTILS_BASE: 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils'
};

// Add source URLs for linking
const SOURCE_URLS = {
  GO: 'http://amigo.geneontology.org/amigo/term',
  KEGG: 'https://www.genome.jp/dbget-bin/www_bget?pathway',
  STRING: 'https://string-db.org/network',
  CLINVAR: 'https://www.ncbi.nlm.nih.gov/clinvar/variation',
  GWAS: 'https://www.ncbi.nlm.nih.gov/projects/gap/cgi-bin/study.cgi?study_id='
};

// Configuration
const API_BASE_URL = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';
const TOOL_NAME = 'gene-fetcher';
const SERVICE_NAME = 'NCBI Gene Database';
const EMAIL = process.env.NCBI_EMAIL || 'your.email@example.com';

// XML Parser
const parser = new Parser();

// Input Schema Definitions
const GeneSearchSchema = z.object({
  gene_symbol: z.string().min(1).describe('Gene symbol to search for (e.g., BRCA1, TP53)'),
  include_ensembl: z.boolean().optional().default(true).describe('Whether to include Ensembl ID in the results'),
  organism: z.string().optional().default('Homo sapiens').describe('Organism name (default: Homo sapiens)'),
});

// Create server instance
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

// Update the interfaces to match the actual XML structure
interface GOTerm {
  id: string;
  name: string;
  evidence: string;
  category: string;
}

interface GOData {
  terms: GOTerm[];
}

interface InteractionData {
  database: string;
  id: string;
  partner?: string;
  description?: string;
  methods?: string[];
  url?: string;
}

interface GWASStudy {
  url: string;
  description: string;
  pmid?: string;
}

interface ExpressionData {
  summary: string;
  tissues: string[];
  category: string;
}

interface GeneRIF {
  text: string;
  pmid: string;
  category?: string;
}

// Old interfaces removed - using new interfaces defined above

// Helper Functions
async function makeRequest(endpoint: string, params: Record<string, string>) {
  try {
    const response = await axios.get(`${API_BASE_URL}/${endpoint}`, {
      params: {
        ...params,
        tool: TOOL_NAME,
        email: EMAIL,
      },
    });
    return response.data;
  } catch (error) {
    console.error(`Error making request to ${endpoint}:`, error);
    throw error;
  }
}

async function searchGene(geneSymbol: string, organism: string): Promise<string> {
  const params = {
    db: 'gene',
    term: `${geneSymbol}[Gene Name] AND "${organism}"[Organism]`,
    retmode: 'xml',
  };

  const data = await makeRequest('esearch.fcgi', params);
  const result = await parser.parseStringPromise(data);

  if (result.eSearchResult?.IdList?.[0]?.Id?.[0]) {
    return result.eSearchResult.IdList[0].Id[0];
  }
  throw new Error(`No gene found for symbol: ${geneSymbol}`);
}

async function getGeneSummary(geneId: string) {
  const params = {
    db: 'gene',
    id: geneId,
    retmode: 'xml',
  };

  const data = await makeRequest('esummary.fcgi', params);
  const result = await parser.parseStringPromise(data);

  if (result.eSummaryResult?.DocumentSummarySet?.[0]?.DocumentSummary?.[0]) {
    return parseGeneSummary(result.eSummaryResult.DocumentSummarySet[0].DocumentSummary[0]);
  }
  throw new Error(`No summary found for gene ID: ${geneId}`);
}

async function getEnsemblId(geneId: string): Promise<string | null> {
  const params = {
    db: 'gene',
    id: geneId,
    retmode: 'xml',
  };

  const data = await makeRequest('efetch.fcgi', params);
  const ensemblRegex = /<Object-id_str>(ENSG\d+)<\/Object-id_str>/;
  const match = data.match(ensemblRegex);
  return match ? match[1] : null;
}

function parseGeneSummary(docSum: any) {
  return {
    geneId: docSum.$.uid,
    symbol: docSum.Name?.[0] || 'N/A',
    description: docSum.Description?.[0] || 'N/A',
    organism: docSum.Organism?.[0]?.ScientificName?.[0] || 'N/A',
    chromosome: docSum.Chromosome?.[0] || 'N/A',
    mapLocation: docSum.MapLocation?.[0] || 'N/A',
    aliases: docSum.OtherAliases?.[0]?.split(', ') || [],
    summary: docSum.Summary?.[0] || 'N/A',
    nomenclatureSymbol: docSum.NomenclatureSymbol?.[0] || 'N/A',
    nomenclatureName: docSum.NomenclatureName?.[0] || 'N/A',
  };
}

function formatMarkdownContent(geneInfo: any): string {
  const summary = geneInfo.summary;
  const ensemblLink = geneInfo.ensemblId ? 
    `\n🔗 [Ensembl](https://www.ensembl.org/Homo_sapiens/Gene/Summary?g=${geneInfo.ensemblId})` : '';

  return `# Gene Information: ${summary.symbol}

## Basic Information
- **Gene ID:** ${summary.geneId}
- **Symbol:** ${summary.symbol}
- **Description:** ${summary.description}
- **Organism:** ${summary.organism}
- **Chromosome:** ${summary.chromosome}
- **Map Location:** ${summary.mapLocation}

## Identifiers
- **NCBI Gene ID:** ${summary.geneId}
${geneInfo.ensemblId ? `- **Ensembl ID:** ${geneInfo.ensemblId}` : ''}

## Nomenclature
- **Official Symbol:** ${summary.nomenclatureSymbol}
- **Official Name:** ${summary.nomenclatureName}
${summary.aliases && summary.aliases.length > 0 ? `- **Aliases:** ${summary.aliases.join(', ')}` : ''}

## Gene Ontology Annotations
### Source: NCBI Gene Database
${formatGOAnnotations(geneInfo.goAnnotations)}

## Expression Data
### Source: NCBI Representative Expression
${formatExpressionData(geneInfo.expressionData)}

## Protein Interactions
### Source: Multiple Interaction Databases
${formatInteractionData(geneInfo.interactionData)}

## GWAS Associations
### Source: EBI GWAS Catalog & Literature
${formatGWASData(geneInfo.gwasData)}

## Functional Annotations (Gene RIFs)
### Source: NCBI Gene References Into Functions
${formatGeneRIFs(geneInfo.geneRIFs)}

## Summary
${summary.summary}

## External Links
🔗 [NCBI Gene](https://www.ncbi.nlm.nih.gov/gene/${summary.geneId})${ensemblLink}

---
*Data retrieved from NCBI E-utilities on ${new Date().toISOString().split('T')[0]}*`;
}

function formatGeneInfo(geneInfo: any): string {
  return `# Instructions for Gene Information Response
When discussing this gene information:
1. Always refer to the gene using its official symbol
2. Include chromosome location when relevant
3. Use the provided links when referencing external databases
4. Maintain sections (Basic Information, Identifiers, Nomenclature, Summary) when presenting information
5. When referencing this gene in text, include its primary identifiers (e.g., "${geneInfo.summary.symbol} (NCBI:${geneInfo.summary.geneId}${geneInfo.ensemblId ? `, Ensembl:${geneInfo.ensemblId}` : ''})")
6. DO NOT create additional artifacts - a markdown artifact has already been provided

Below is the gene information:

${formatMarkdownContent(geneInfo)}`;
}

// Add new helper functions for additional data types
async function getGOAnnotations(geneId: string, taxonId: string): Promise<GOData | null> {
  try {
    const response = await axios.get(`${API_ENDPOINTS.GO_API}/${taxonId}/${geneId}/function`);
    return extractGOTerms(response.data);
  } catch (error) {
    console.error('Error fetching GO annotations:', error);
    return null;
  }
}

// Old functions removed - replaced with getFullGeneData function

// Update the XML parsing functions
function extractGOTerms(xmlData: any): GOData {
  const goTerms: GOTerm[] = [];
  
  try {
    const entrezgene = xmlData?.['Entrezgene-Set']?.['Entrezgene']?.[0];
    const comments = entrezgene?.['Entrezgene_comments']?.[0]?.['Gene-commentary'] || [];
    
    comments.forEach((comment: any) => {
      const heading = comment['Gene-commentary_heading']?.[0];
      if (heading === 'GeneOntology') {
        const subComments = comment['Gene-commentary_comment']?.[0]?.['Gene-commentary'] || [];
        
        subComments.forEach((categoryComment: any) => {
          const category = categoryComment['Gene-commentary_label']?.[0]; // Function, Process, Component
          const goItems = categoryComment['Gene-commentary_comment']?.[0]?.['Gene-commentary'] || [];
          
          goItems.forEach((goItem: any) => {
            const sources = goItem['Gene-commentary_source'] || [];
            let goId = '';
            let goName = '';
            
            // Extract GO ID from source
            sources.forEach((source: any) => {
              const otherSources = source['Other-source'] || [];
              otherSources.forEach((otherSource: any) => {
                const dbtags = otherSource['Other-source_src'] || [];
                dbtags.forEach((dbtagWrapper: any) => {
                  const dbtag = dbtagWrapper['Dbtag']?.[0];
                  if (dbtag && dbtag['Dbtag_db']?.[0] === 'GO') {
                    const idObj = dbtag['Dbtag_tag']?.[0]?.['Object-id']?.[0];
                    if (idObj?.['Object-id_id']?.[0]) {
                      goId = `GO:${idObj['Object-id_id'][0].padStart(7, '0')}`;
                    }
                  }
                });
              });
            });
            
            // Get GO term name from text or label
            goName = goItem['Gene-commentary_text']?.[0] || goItem['Gene-commentary_label']?.[0] || 'Unknown';
            
            if (goId && goName) {
              goTerms.push({
                id: goId,
                name: goName,
                evidence: 'IEA', // Default evidence code
                category: category || 'Unknown'
              });
            }
          });
        });
      }
    });
  } catch (error) {
    console.error('Error parsing GO terms:', error);
  }
  
  return { terms: goTerms };
}

function extractInteractionData(xmlData: any): InteractionData[] {
  const interactions: InteractionData[] = [];
  const interactionMap = new Map<string, InteractionData>(); // Use map to avoid duplicates
  
  try {
    const entrezgene = xmlData?.['Entrezgene-Set']?.['Entrezgene']?.[0];
    const comments = entrezgene?.['Entrezgene_comments']?.[0]?.['Gene-commentary'] || [];
    
    comments.forEach((comment: any) => {
      const heading = comment['Gene-commentary_heading']?.[0];
      
      // Look for interaction sections
      if (heading && heading.toLowerCase().includes('interaction')) {
        const subComments = comment['Gene-commentary_comment']?.[0]?.['Gene-commentary'] || [];
        
        subComments.forEach((subComment: any) => {
          const text = subComment['Gene-commentary_text']?.[0] || '';
          const sources = subComment['Gene-commentary_source'] || [];
          
          // Extract interaction partner and methods from text
          const methods = text.split(';').map((m: string) => m.trim()).filter(Boolean);
          
          sources.forEach((source: any) => {
            const otherSources = source['Other-source'] || [];
            otherSources.forEach((otherSource: any) => {
              const dbtags = otherSource['Other-source_src'] || [];
              const anchor = otherSource['Other-source_anchor']?.[0];
              
              dbtags.forEach((dbtagWrapper: any) => {
                const dbtag = dbtagWrapper['Dbtag']?.[0];
                const db = dbtag?.['Dbtag_db']?.[0];
                
                if (db && (db === 'BioGRID' || db === 'HPRD' || db === 'BIND')) {
                  const idObj = dbtag['Dbtag_tag']?.[0]?.['Object-id']?.[0];
                  const id = idObj?.['Object-id_id']?.[0] || '';
                  
                  // Extract partner from anchor text or comment
                  let partner = anchor || '';
                  if (partner.includes(':')) {
                    partner = partner.split(':')[1]?.trim() || partner;
                  }
                  
                  if (id && partner) {
                    const key = `${db}_${id}_${partner}`;
                    if (!interactionMap.has(key)) {
                      interactionMap.set(key, {
                        database: db,
                        id: id,
                        partner: partner,
                        methods: methods.length > 0 ? methods : ['Physical interaction'],
                        url: db === 'BioGRID' ? `https://thebiogrid.org/interaction/${id}` :
                             db === 'HPRD' ? `http://www.hprd.org/interactions?hprd_id=${id}` :
                             ''
                      });
                    }
                  }
                }
              });
            });
          });
        });
      }
    });
    
    // Convert map to array
    interactions.push(...interactionMap.values());
    
  } catch (error) {
    console.error('Error parsing interaction data:', error);
  }
  
  return interactions;
}

function extractGWASData(xmlData: any): GWASStudy[] {
  const gwasStudies: GWASStudy[] = [];
  
  try {
    const entrezgene = xmlData?.['Entrezgene-Set']?.['Entrezgene']?.[0];
    const comments = entrezgene?.['Entrezgene_comments']?.[0]?.['Gene-commentary'] || [];
    
    comments.forEach((comment: any) => {
      const subComments = comment['Gene-commentary_comment']?.[0]?.['Gene-commentary'] || [];
      
      subComments.forEach((subComment: any) => {
        const sources = subComment['Gene-commentary_source'] || [];
        sources.forEach((source: any) => {
          const otherSources = source['Other-source'] || [];
          otherSources.forEach((otherSource: any) => {
            const anchor = otherSource['Other-source_anchor']?.[0];
            const url = otherSource['Other-source_url']?.[0];
            
            if (anchor === 'EBI GWAS Catalog' && url) {
              const pmidMatch = url.match(/publications\/(\d+)/);
              gwasStudies.push({
                url: url,
                description: 'EBI GWAS Catalog study',
                pmid: pmidMatch ? pmidMatch[1] : ''
              });
            }
          });
        });
      });
      
      // Also check for GWAS mentions in comment text
      const text = comment['Gene-commentary_text']?.[0];
      if (text && (text.toLowerCase().includes('genome-wide') || text.toLowerCase().includes('gwas'))) {
        gwasStudies.push({
          url: '',
          description: text.substring(0, 200) + (text.length > 200 ? '...' : ''),
          pmid: ''
        });
      }
    });
  } catch (error) {
    console.error('Error parsing GWAS data:', error);
  }
  
  return gwasStudies;
}

function extractExpressionData(xmlData: any): ExpressionData | null {
  try {
    const entrezgene = xmlData?.['Entrezgene-Set']?.['Entrezgene']?.[0];
    const comments = entrezgene?.['Entrezgene_comments']?.[0]?.['Gene-commentary'] || [];
    
    for (const comment of comments) {
      const heading = comment['Gene-commentary_heading']?.[0];
      if (heading === 'Representative Expression') {
        const subComments = comment['Gene-commentary_comment']?.[0]?.['Gene-commentary'] || [];
        let summary = '';
        let tissues: string[] = [];
        let category = '';
        
        subComments.forEach((subComment: any) => {
          const label = subComment['Gene-commentary_label']?.[0];
          const text = subComment['Gene-commentary_text']?.[0];
          
          if (label === 'Text Summary') summary = text || '';
          if (label === 'Tissue List') tissues = text ? text.split('; ').filter(Boolean) : [];
          if (label === 'Category') category = text || '';
        });
        
        return { summary, tissues, category };
      }
    }
  } catch (error) {
    console.error('Error parsing expression data:', error);
  }
  
  return null;
}

function extractGeneRIFs(xmlData: any): GeneRIF[] {
  const generifs: GeneRIF[] = [];
  
  try {
    const entrezgene = xmlData?.['Entrezgene-Set']?.['Entrezgene']?.[0];
    const comments = entrezgene?.['Entrezgene_comments']?.[0]?.['Gene-commentary'] || [];
    
    comments.forEach((comment: any) => {
      const heading = comment['Gene-commentary_heading']?.[0];
      const text = comment['Gene-commentary_text']?.[0];
      
      // Look for Gene RIFs and functional annotations
      if (text && (heading?.includes('interactions') || text.length > 50)) {
        let pmid = '';
        
        // Extract PMID from refs
        const refs = comment['Gene-commentary_refs'] || [];
        refs.forEach((ref: any) => {
          const pubmed = ref['Pub']?.[0]?.['Pub_pmid']?.[0]?.['PubMedId']?.[0];
          if (pubmed) pmid = pubmed;
        });
        
        generifs.push({
          text: text,
          pmid: pmid,
          category: heading || 'Functional Annotation'
        });
      }
    });
  } catch (error) {
    console.error('Error parsing Gene RIFs:', error);
  }
  
  return generifs;
}

// Update the main handler to fetch and parse XML data
async function getFullGeneData(geneId: string) {
  const params = {
    db: 'gene',
    id: geneId,
    retmode: 'xml',
  };

  const data = await makeRequest('efetch.fcgi', params);
  const result = await parser.parseStringPromise(data);
  
  return {
    goAnnotations: extractGOTerms(result),
    interactionData: extractInteractionData(result),
    gwasData: extractGWASData(result),
    expressionData: extractExpressionData(result),
    geneRIFs: extractGeneRIFs(result)
  };
}

// Add the missing formatExpressionData function
function formatExpressionData(expressionData: ExpressionData | null): string {
  if (!expressionData) {
    return 'No expression data available.';
  }
  
  let content = `**${expressionData.category}**\n`;
  content += `- **Summary**: ${expressionData.summary}\n`;
  
  if (expressionData.tissues && expressionData.tissues.length > 0) {
    content += `- **Tissues**: ${expressionData.tissues.slice(0, 10).join(', ')}`;
    if (expressionData.tissues.length > 10) {
      content += ` and ${expressionData.tissues.length - 10} more`;
    }
  }
  
  return content;
}

// Update the main handler to use the new functions
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === "search-gene") {
    try {
      const params = GeneSearchSchema.parse(args);
      
      // Get gene ID
      const geneId = await searchGene(params.gene_symbol, params.organism);
      
      // Get gene summary
      const summary = await getGeneSummary(geneId);
      
      // Get Ensembl ID
      const ensemblId = await getEnsemblId(geneId);

      // Get additional data from XML
      const additionalData = await getFullGeneData(geneId);

      const geneInfo = {
        geneId,
        summary,
        ensemblId,
        goAnnotations: additionalData.goAnnotations,
        interactionData: additionalData.interactionData,
        gwasData: additionalData.gwasData,
        expressionData: additionalData.expressionData,
        geneRIFs: additionalData.geneRIFs
      };

      return {
        content: [
          {
            type: "text",
            text: `# Instructions for Gene Information Response
IMPORTANT: GENE-FETCHER-SEARCH-GENE HAS COMPLETED FOR ${params.gene_symbol}. DO NOT RUN THIS TOOL AGAIN FOR ${params.gene_symbol} AS ALL GENE DATA INCLUDING ENSEMBL ID, GO TERMS, EXPRESSION DATA, INTERACTIONS, AND GWAS ASSOCIATIONS HAS BEEN RETRIEVED.

When discussing this gene information:
1. Always refer to the gene using its official symbol
2. Include chromosome location when relevant
3. Use the provided links when referencing external databases
4. Maintain sections (Basic Information, Identifiers, Nomenclature, Summary) when presenting information
5. When referencing this gene in text, include its primary identifiers (e.g., "${summary.symbol} (NCBI:${summary.geneId}${ensemblId ? `, Ensembl:${ensemblId}` : ''})")
6. DO NOT create additional artifacts - a markdown artifact has already been provided

Below is the comprehensive gene information:

${formatMarkdownContent(geneInfo)}`
          }
        ],
        artifacts: [
          {
            type: 'text/markdown',
            title: `Gene Information: ${summary.symbol}`,
            name: `gene_data_${summary.symbol}.md`,
            content: formatMarkdownContent(geneInfo)
          },
          {
            type: 'application/json',
            title: `Gene Raw Data: ${summary.symbol}`,
            name: `gene_data_${summary.symbol}.json`,
            content: geneInfo
          }
        ],
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to retrieve gene information: ${error.message}`);
      }
      throw new Error('Failed to retrieve gene information: An unknown error occurred');
    }
  } else {
    throw new Error(`Unknown tool: ${name}`);
  }
});

// Helper functions to format the additional data
function formatGOAnnotations(goData: GOData | null): string {
  if (!goData || !goData.terms || goData.terms.length === 0) {
    return 'No Gene Ontology annotations found in NCBI data.';
  }
  
  return goData.terms.map(term => 
    `- **${term.category}**: ${term.name}\n  - Evidence: ${term.evidence}`
  ).join('\n');
}

// Old formatting functions removed

function formatInteractionData(interactions: InteractionData[] | null): string {
  if (!interactions || interactions.length === 0) {
    return 'No protein interaction data found.';
  }
  
  const grouped = interactions.reduce((acc, interaction) => {
    if (!acc[interaction.database]) acc[interaction.database] = [];
    acc[interaction.database].push(interaction);
    return acc;
  }, {} as Record<string, InteractionData[]>);
  
  let content = '';
  Object.entries(grouped).forEach(([db, interactions]) => {
    content += `\n#### ${db} Database\n`;
    const uniqueInteractions = interactions.slice(0, 10); // Limit to first 10
    content += uniqueInteractions.map(int => {
      let line = `- `;
      if (int.partner) {
        line += `**${int.partner}**`;
      }
      if (int.id) {
        line += ` (ID: ${int.id})`;
      }
      if (int.methods && int.methods.length > 0) {
        line += `\n  - Methods: ${int.methods.join('; ')}`;
      }
      if (int.url) {
        line += `\n  - [View in ${db}](${int.url})`;
      }
      return line;
    }).join('\n');
    if (interactions.length > 10) {
      content += `\n- *... and ${interactions.length - 10} more interactions*`;
    }
    content += '\n';
  });
  
  return content;
}

function formatGWASData(gwasStudies: GWASStudy[] | null): string {
  if (!gwasStudies || gwasStudies.length === 0) {
    return 'No GWAS associations found.';
  }
  
  return gwasStudies.slice(0, 5).map((study, index) => {
    let item = `${index + 1}. ${study.description}`;
    if (study.url) item += `\n   - URL: ${study.url}`;
    if (study.pmid) item += `\n   - PMID: ${study.pmid}`;
    return item;
  }).join('\n\n');
}

function formatGeneRIFs(geneRIFs: GeneRIF[] | null): string {
  if (!geneRIFs || geneRIFs.length === 0) {
    return 'No functional annotations found.';
  }
  
  const grouped = geneRIFs.reduce((acc, rif) => {
    const category = rif.category || 'General';
    if (!acc[category]) acc[category] = [];
    acc[category].push(rif);
    return acc;
  }, {} as Record<string, GeneRIF[]>);
  
  let content = '';
  Object.entries(grouped).forEach(([category, rifs]) => {
    content += `\n#### ${category}\n`;
    rifs.slice(0, 3).forEach((rif, index) => {
      content += `${index + 1}. ${rif.text}`;
      if (rif.pmid) content += ` (PMID: ${rif.pmid})`;
      content += '\n';
    });
    if (rifs.length > 3) {
      content += `*... and ${rifs.length - 3} more annotations*\n`;
    }
  });
  
  return content;
}

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "search-gene",
        description: "Search for gene information by gene symbol",
        inputSchema: {
          type: "object",
          properties: {
            gene_symbol: {
              type: "string",
              description: "Gene symbol to search for (e.g., BRCA1, TP53)",
            },
            include_ensembl: {
              type: "boolean",
              description: "Whether to include Ensembl ID in the results",
            },
            organism: {
              type: "string",
              description: "Organism name (default: Homo sapiens)",
            },
          },
          required: ["gene_symbol"],
        },
      },
    ],
  };
});

// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === "search-gene") {
    try {
      const params = GeneSearchSchema.parse(args);
      
      // Search for gene ID
      const geneId = await searchGene(params.gene_symbol, params.organism);
      
      // Get gene summary
      const summary = await getGeneSummary(geneId);
      
      // Get Ensembl ID if requested
      let ensemblId = null;
      if (params.include_ensembl) {
        ensemblId = await getEnsemblId(geneId);
      }

      const geneInfo = {
        geneId,
        summary,
        ensemblId,
      };

      return {
        content: [
          {
            type: "text",
            text: `# Instructions for Gene Information Response
IMPORTANT: GENE-FETCHER-SEARCH-GENE HAS COMPLETED FOR ${params.gene_symbol}. DO NOT RUN THIS TOOL AGAIN FOR ${params.gene_symbol} AS ALL GENE DATA INCLUDING ENSEMBL ID, ALIASES, AND DESCRIPTIONS HAS BEEN RETRIEVED.

When discussing this gene information:
1. Always refer to the gene using its official symbol
2. Include chromosome location when relevant
3. Use the provided links when referencing external databases
4. Maintain sections (Basic Information, Identifiers, Nomenclature, Summary) when presenting information
5. When referencing this gene in text, include its primary identifiers (e.g., "${geneInfo.summary.symbol} (NCBI:${geneInfo.summary.geneId}${geneInfo.ensemblId ? `, Ensembl:${geneInfo.ensemblId}` : ''})")
6. DO NOT create additional artifacts - a markdown artifact has already been provided

Below is the gene information:

${formatMarkdownContent(geneInfo)}`
          }
        ],
        artifacts: [
          {
            type: 'text/markdown',
            name: `gene_data_${params.gene_symbol}.md`,
            title: `Gene Information: ${params.gene_symbol}`,
            content: formatMarkdownContent(geneInfo),
          },
        ],
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to retrieve gene information: ${error.message}`);
      }
      throw new Error('Failed to retrieve gene information: An unknown error occurred');
    }
  } else {
    throw new Error(`Unknown tool: ${name}`);
  }
});

// Start the server
async function main() {
  if (process.env.NCBI_API_KEY) {
    console.log(`[${SERVICE_NAME}] API Key found, using authenticated requests`);
  }
  console.log(`[${SERVICE_NAME}] Using email: ${EMAIL}`);
  console.log(`[${SERVICE_NAME}] API Base URL: ${API_BASE_URL}`);

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.log(`[${SERVICE_NAME}] MCP Server running on stdio`);
}

main().catch((error) => {
  console.error(`[${SERVICE_NAME}] Fatal error in main():`, error);
  process.exit(1);
}); 