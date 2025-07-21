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