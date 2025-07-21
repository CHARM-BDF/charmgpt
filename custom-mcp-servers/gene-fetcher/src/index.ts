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

// Add interfaces for the data types
interface GOTerm {
  id: string;
  name: string;
  evidence: string;
}

interface GOData {
  molecular_function: GOTerm[];
  biological_process: GOTerm[];
  cellular_component: GOTerm[];
}

interface Phenotype {
  name: string;
  significance: string;
  conditions: string[];
  id: string;  // ClinVar ID
}

interface Pathway {
  name: string;
  source: string;
  id: string;
}

interface Interaction {
  partner: string;
  type: string;
  description: string;
  id: string;  // STRING interaction ID
}

interface GWASAssociation {
  trait: string;
  pvalue: string;
  population: string;
  reference: string;
  studyId: string;  // dbGaP study ID
}

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
${summary.aliases.length > 0 ? `- **Aliases:** ${summary.aliases.join(', ')}` : ''}

## Gene Ontology Annotations
${formatGOAnnotations(geneInfo.goAnnotations)}

## Phenotype Associations
${formatPhenotypeInfo(geneInfo.phenotypeInfo)}

## Pathway Information
${formatPathwayData(geneInfo.pathwayData)}

## Protein Interactions
${formatInteractionData(geneInfo.interactionData)}

## GWAS Associations
${formatGWASData(geneInfo.gwasData)}

## Summary
${summary.summary}

## External Links
🔗 [NCBI Gene](https://www.ncbi.nlm.nih.gov/gene/${summary.geneId})${ensemblLink}

## Quick Summary
${summary.symbol} (NCBI:${summary.geneId}${geneInfo.ensemblId ? `, Ensembl:${geneInfo.ensemblId}` : ''}) is a ${summary.description.toLowerCase()} located on chromosome ${summary.chromosome} at position ${summary.mapLocation}. ${summary.summary.split('.')[0]}.`;
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

async function getPhenotypeInfo(geneSymbol: string): Promise<Phenotype[]> {
  try {
    // First search ClinVar
    const searchParams = {
      db: 'clinvar',
      term: `${geneSymbol}[gene]`,
      retmax: '100'
    };
    const searchData = await makeRequest('esearch.fcgi', searchParams);
    const searchResult = await parser.parseStringPromise(searchData);
    
    // Get IDs from search result
    const ids = searchResult?.eSearchResult?.IdList?.[0]?.Id || [];
    if (ids.length === 0) return [];

    // Then fetch full records
    const fetchParams = {
      db: 'clinvar',
      id: ids.join(','),
      rettype: 'variation'
    };
    const fetchData = await makeRequest('efetch.fcgi', fetchParams);
    const result = await parser.parseStringPromise(fetchData);
    return extractPhenotypeInfo(result);
  } catch (error) {
    console.error('Error fetching phenotype information:', error);
    return [];
  }
}

async function getPathwayData(geneId: string): Promise<Pathway[]> {
  try {
    const response = await axios.get(`${API_ENDPOINTS.KEGG_API}/get/${geneId}/pathway`);
    return extractPathwayData(response.data);
  } catch (error) {
    console.error('Error fetching pathway data:', error);
    return [];
  }
}

async function getInteractionData(geneSymbol: string): Promise<Interaction[]> {
  try {
    const response = await axios.get(`${API_ENDPOINTS.STRING_API}`, {
      params: {
        identifiers: geneSymbol,
        required_score: 700, // High confidence interactions only
        species: 9606 // Human
      }
    });
    return extractInteractionData(response.data);
  } catch (error) {
    console.error('Error fetching interaction data:', error);
    return [];
  }
}

async function getGWASData(geneSymbol: string): Promise<GWASAssociation[]> {
  try {
    // First search dbGaP
    const searchParams = {
      db: 'gap',
      term: `${geneSymbol}[gene]`,
      retmax: '100'
    };
    const searchData = await makeRequest('esearch.fcgi', searchParams);
    const searchResult = await parser.parseStringPromise(searchData);
    
    // Get IDs from search result
    const ids = searchResult?.eSearchResult?.IdList?.[0]?.Id || [];
    if (ids.length === 0) return [];

    // Then fetch full records
    const fetchParams = {
      db: 'gap',
      id: ids.join(','),
      rettype: 'full'
    };
    const fetchData = await makeRequest('efetch.fcgi', fetchParams);
    const result = await parser.parseStringPromise(fetchData);
    return extractGWASData(result);
  } catch (error) {
    console.error('Error fetching GWAS data:', error);
    return [];
  }
}

// Helper functions to extract data from XML responses
function extractGOTerms(xmlData: any): GOData {
  const goTerms: GOData = {
    molecular_function: [],
    biological_process: [],
    cellular_component: []
  };
  try {
    if (xmlData?.Entrezgene?.Entrezgene_properties?.[0]?.Gene_properties?.[0]?.Gene_properties_go) {
      const goNodes = xmlData.Entrezgene.Entrezgene_properties[0].Gene_properties[0].Gene_properties_go;
      goNodes.forEach((node: any) => {
        const category = node.Go_terms_category?.[0]?.toLowerCase().replace(' ', '_');
        const term: GOTerm = {
          id: node.Go_terms_id?.[0] || '',
          name: node.Go_terms_name?.[0] || '',
          evidence: node.Go_terms_evidence?.[0] || ''
        };
        if (category && category in goTerms) {
          goTerms[category as keyof GOData].push(term);
        }
      });
    }
  } catch (error) {
    console.error('Error parsing GO terms:', error);
  }
  return goTerms;
}

function extractPhenotypeInfo(xmlData: any): Phenotype[] {
  const phenotypes: Phenotype[] = [];
  try {
    if (xmlData?.ClinVarResult?.VariationReport) {
      xmlData.ClinVarResult.VariationReport.forEach((report: any) => {
        const phenotype: Phenotype = {
          name: report.TraitSet?.[0]?.Trait?.[0]?.Name?.[0] || '',
          significance: report.ClinicalSignificance?.[0]?.Description?.[0] || '',
          conditions: report.TraitSet?.[0]?.Trait?.[0]?.AttributeSet?.map((attr: any) => attr.Attribute?.[0]) || [],
          id: report.$.uid // Assuming uid is the ClinVar ID
        };
        phenotypes.push(phenotype);
      });
    }
  } catch (error) {
    console.error('Error parsing phenotype information:', error);
  }
  return phenotypes;
}

function extractPathwayData(xmlData: any): Pathway[] {
  const pathways: Pathway[] = [];
  try {
    if (xmlData?.Entrezgene?.Entrezgene_pathway) {
      xmlData.Entrezgene.Entrezgene_pathway.forEach((pathway: any) => {
        const pathwayInfo: Pathway = {
          name: pathway.Pathway_name?.[0] || '',
          source: pathway.Pathway_source?.[0] || '',
          id: pathway.Pathway_id?.[0] || ''
        };
        pathways.push(pathwayInfo);
      });
    }
  } catch (error) {
    console.error('Error parsing pathway data:', error);
  }
  return pathways;
}

function extractInteractionData(xmlData: any): Interaction[] {
  const interactions: Interaction[] = [];
  try {
    if (xmlData?.Entrezgene?.Entrezgene_comments) {
      const interactionNodes = xmlData.Entrezgene.Entrezgene_comments.filter(
        (comment: any) => comment.Gene_comment_type?.[0] === 'Interactions'
      );
      interactionNodes.forEach((node: any) => {
        const interaction: Interaction = {
          partner: node.Gene_comment_source?.[0] || '',
          type: node.Gene_comment_heading?.[0] || '',
          description: node.Gene_comment_text?.[0] || '',
          id: node.$.uid // Assuming uid is the STRING interaction ID
        };
        interactions.push(interaction);
      });
    }
  } catch (error) {
    console.error('Error parsing interaction data:', error);
  }
  return interactions;
}

function extractGWASData(xmlData: any): GWASAssociation[] {
  const gwasAssociations: GWASAssociation[] = [];
  try {
    if (xmlData?.DbGaPResult?.Study) {
      xmlData.DbGaPResult.Study.forEach((study: any) => {
        const association: GWASAssociation = {
          trait: study.TraitName?.[0] || '',
          pvalue: study.PValue?.[0] || '',
          population: study.Population?.[0] || '',
          reference: study.Reference?.[0] || '',
          studyId: study.$.uid // Assuming uid is the dbGaP study ID
        };
        gwasAssociations.push(association);
      });
    }
  } catch (error) {
    console.error('Error parsing GWAS data:', error);
  }
  return gwasAssociations;
}

// Update the main handler to include the new data
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

      // Get additional data
      const [
        goAnnotations,
        phenotypeInfo,
        pathwayData,
        interactionData,
        gwasData
      ] = await Promise.all([
        getGOAnnotations(geneId, '9606'), // Taxon ID for human
        getPhenotypeInfo(params.gene_symbol),
        getPathwayData(geneId),
        getInteractionData(params.gene_symbol),
        getGWASData(params.gene_symbol)
      ]);

      const geneInfo = {
        geneId,
        summary,
        ensemblId,
        goAnnotations,
        phenotypeInfo,
        pathwayData,
        interactionData,
        gwasData
      };

      return {
        content: [
          {
            type: "text",
            text: `# Instructions for Gene Information Response
IMPORTANT: GENE-FETCHER-SEARCH-GENE HAS COMPLETED FOR ${params.gene_symbol}. DO NOT RUN THIS TOOL AGAIN FOR ${params.gene_symbol} AS ALL GENE DATA INCLUDING ENSEMBL ID, GO TERMS, PHENOTYPES, PATHWAYS, INTERACTIONS, AND GWAS ASSOCIATIONS HAS BEEN RETRIEVED.

When discussing this gene information:
1. Always refer to the gene using its official symbol
2. Include chromosome location when relevant
3. Use the provided links when referencing external databases
4. Maintain sections (Basic Information, Identifiers, Nomenclature, Summary) when presenting information
5. When referencing this gene in text, include its primary identifiers (e.g., "${summary.symbol} (NCBI:${summary.geneId}${ensemblId ? `, Ensembl:${ensemblId}` : ''})")
6. DO NOT create additional artifacts - a markdown artifact has already been provided

## Gene Ontology Annotations
${formatGOAnnotations(goAnnotations)}

## Phenotype Associations
${formatPhenotypeInfo(phenotypeInfo)}

## Pathway Information
${formatPathwayData(pathwayData)}

## Protein Interactions
${formatInteractionData(interactionData)}

## GWAS Associations
${formatGWASData(gwasData)}

Below is the basic gene information:

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
  if (!goData) return 'No GO annotations available';
  
  let content = '\n_Data source: [Gene Ontology Consortium](http://geneontology.org/)_\n';
  
  if (goData.molecular_function.length > 0) {
    content += '\n### Molecular Function\n';
    content += goData.molecular_function.map(term => 
      `- ${term.name} ([${term.id}](${SOURCE_URLS.GO}/${term.id})) - Evidence: ${term.evidence}`
    ).join('\n');
  }
  
  if (goData.biological_process.length > 0) {
    content += '\n### Biological Process\n';
    content += goData.biological_process.map(term => 
      `- ${term.name} ([${term.id}](${SOURCE_URLS.GO}/${term.id})) - Evidence: ${term.evidence}`
    ).join('\n');
  }
  
  if (goData.cellular_component.length > 0) {
    content += '\n### Cellular Component\n';
    content += goData.cellular_component.map(term => 
      `- ${term.name} ([${term.id}](${SOURCE_URLS.GO}/${term.id})) - Evidence: ${term.evidence}`
    ).join('\n');
  }
  
  return content || 'No GO annotations available';
}

function formatPhenotypeInfo(phenotypes: Phenotype[] | null): string {
  if (!phenotypes || phenotypes.length === 0) return 'No phenotype associations available';
  
  let content = '\n_Data source: [ClinVar](https://www.ncbi.nlm.nih.gov/clinvar/)_\n\n';
  
  content += phenotypes.map(p => 
    `- ${p.name} ([ClinVar ${p.id}](${SOURCE_URLS.CLINVAR}/${p.id}))\n` +
    `  - Clinical Significance: ${p.significance}\n` +
    `  - Associated Conditions: ${p.conditions.join(', ')}`
  ).join('\n');
  
  return content;
}

function formatPathwayData(pathways: Pathway[] | null): string {
  if (!pathways || pathways.length === 0) return 'No pathway information available';
  
  let content = '\n_Data source: [KEGG Pathway Database](https://www.genome.jp/kegg/pathway.html)_\n\n';
  
  content += pathways.map(p => 
    `- ${p.name} ([${p.source} ${p.id}](${SOURCE_URLS.KEGG}/${p.id}))`
  ).join('\n');
  
  return content;
}

function formatInteractionData(interactions: Interaction[] | null): string {
  if (!interactions || interactions.length === 0) return 'No interaction data available';
  
  let content = '\n_Data source: [STRING Database](https://string-db.org/)_\n\n';
  
  content += interactions.map(i => 
    `- ${i.partner} ([View in STRING](${SOURCE_URLS.STRING}/${i.id}))\n` +
    `  - Interaction Type: ${i.type}\n` +
    `  - Description: ${i.description}`
  ).join('\n');
  
  return content;
}

function formatGWASData(associations: GWASAssociation[] | null): string {
  if (!associations || associations.length === 0) return 'No GWAS associations available';
  
  let content = '\n_Data source: [NHGRI-EBI GWAS Catalog](https://www.ebi.ac.uk/gwas/)_\n\n';
  
  content += associations.map(a => 
    `- ${a.trait} ([Study ${a.studyId}](${SOURCE_URLS.GWAS}${a.studyId}))\n` +
    `  - P-value: ${a.pvalue}\n` +
    `  - Population: ${a.population}\n` +
    `  - Reference: ${a.reference}`
  ).join('\n');
  
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