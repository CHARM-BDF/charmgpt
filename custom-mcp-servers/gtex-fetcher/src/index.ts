import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from 'zod';
import axios from 'axios';

// Configuration
const API_BASE_URL = 'https://gtexportal.org/api/v2';
const TOOL_NAME = 'gtex-fetcher';
const SERVICE_NAME = 'GTEx Portal';

// Input Schema Definitions
const GTExSearchSchema = z.object({
  gene_identifier: z.string().min(1).describe('Gene identifier (symbol or Ensembl ID)'),
});

// Helper Functions
async function getVersionedEnsemblId(geneIdentifier: string) {
  try {
    const response = await axios.get(`${API_BASE_URL}/reference/gene`, {
      params: { geneId: geneIdentifier }
    });

    if (response.data?.data?.[0]) {
      return {
        success: true,
        gencodeId: response.data.data[0].gencodeId,
        geneInfo: response.data.data[0]
      };
    }
    throw new Error(`No gene found for identifier: ${geneIdentifier}`);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to get versioned Ensembl ID: ${error.message}`);
    }
    throw new Error('Failed to get versioned Ensembl ID');
  }
}

async function getMedianGeneExpression(gencodeId: string) {
  try {
    const response = await axios.get(`${API_BASE_URL}/expression/medianGeneExpression`, {
      params: { gencodeId }
    });

    if (response.data?.data) {
      return {
        success: true,
        data: response.data.data,
        summary: summarizeExpressionData(response.data.data)
      };
    }
    throw new Error(`No expression data found for: ${gencodeId}`);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to get expression data: ${error.message}`);
    }
    throw new Error('Failed to get expression data');
  }
}

function summarizeExpressionData(expressionData: any[]) {
  if (!expressionData || expressionData.length === 0) return null;

  const sortedData = [...expressionData].sort((a, b) => b.median - a.median);
  const values = expressionData.map(d => d.median);
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const median = values.sort((a, b) => a - b)[Math.floor(values.length / 2)];
  const max = Math.max(...values);
  const min = Math.min(...values);

  const highExpression = sortedData.filter(d => d.median > mean + (max - mean) * 0.3);
  const lowExpression = sortedData.filter(d => d.median < mean * 0.3);
  const brainTissues = expressionData.filter(d => d.tissueSiteDetailId.includes('Brain'));
  const skinTissues = expressionData.filter(d => d.tissueSiteDetailId.includes('Skin'));

  return {
    statistics: {
      tissueCount: expressionData.length,
      meanExpression: Math.round(mean * 100) / 100,
      medianExpression: Math.round(median * 100) / 100,
      maxExpression: max,
      minExpression: min,
      unit: expressionData[0]?.unit || 'TPM'
    },
    topExpressingTissues: sortedData.slice(0, 5),
    lowestExpressingTissues: sortedData.slice(-5),
    highExpressingTissues: highExpression,
    lowExpressingTissues: lowExpression,
    brainExpression: brainTissues.length > 0 ? {
      tissueCount: brainTissues.length,
      meanExpression: Math.round((brainTissues.reduce((sum, t) => sum + t.median, 0) / brainTissues.length) * 100) / 100,
      tissues: brainTissues
    } : null,
    skinExpression: skinTissues.length > 0 ? {
      meanExpression: Math.round((skinTissues.reduce((sum, t) => sum + t.median, 0) / skinTissues.length) * 100) / 100,
      tissues: skinTissues
    } : null
  };
}

function formatGTExInfo(data: any): string {
  const { geneInfo, expressionSummary } = data;
  const stats = expressionSummary.statistics;

  let content = `# GTEx Expression Analysis: ${geneInfo.geneSymbol}

## Gene Information
- **Gene Symbol:** ${geneInfo.geneSymbol}
- **Gencode ID:** ${geneInfo.gencodeId}
- **Gene Type:** ${geneInfo.geneType}
- **Genome Build:** ${geneInfo.genomeBuild}
- **Location:** ${geneInfo.chromosome}:${geneInfo.start}-${geneInfo.end} (${geneInfo.strand})

## Expression Statistics
- **Number of Tissues:** ${stats.tissueCount}
- **Mean Expression:** ${stats.meanExpression} ${stats.unit}
- **Median Expression:** ${stats.medianExpression} ${stats.unit}
- **Expression Range:** ${stats.minExpression}-${stats.maxExpression} ${stats.unit}

## Top Expressing Tissues
${expressionSummary.topExpressingTissues.map((t: any, i: number) => 
  `${i + 1}. ${t.tissueSiteDetailId.replace(/_/g, ' ')}: ${t.median} ${t.unit}`
).join('\n')}`;

  if (expressionSummary.brainExpression) {
    content += `\n\n## Brain Expression
- **Brain Regions:** ${expressionSummary.brainExpression.tissueCount}
- **Mean Brain Expression:** ${expressionSummary.brainExpression.meanExpression} ${stats.unit}

${expressionSummary.brainExpression.tissues.map((t: any) =>
  `- ${t.tissueSiteDetailId.replace(/_/g, ' ')}: ${t.median} ${t.unit}`
).join('\n')}`;
  }

  if (expressionSummary.skinExpression) {
    content += `\n\n## Skin Expression
- **Mean Skin Expression:** ${expressionSummary.skinExpression.meanExpression} ${stats.unit}

${expressionSummary.skinExpression.tissues.map((t: any) =>
  `- ${t.tissueSiteDetailId.replace(/_/g, ' ')}: ${t.median} ${t.unit}`
).join('\n')}`;
  }

  content += `\n\n## External Links
🔗 [GTEx Portal](https://gtexportal.org/home/gene/${geneInfo.gencodeId})`;

  return content;
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
        name: "search-gtex",
        description: "Search GTEx Portal for gene expression data across tissues",
        inputSchema: {
          type: "object",
          properties: {
            gene_identifier: {
              type: "string",
              description: "Gene identifier (symbol or Ensembl ID)",
            }
          },
          required: ["gene_identifier"],
        },
      },
    ],
  };
});

// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === "search-gtex") {
    try {
      const params = GTExSearchSchema.parse(args);
      
      // Get versioned Ensembl ID
      const geneResult = await getVersionedEnsemblId(params.gene_identifier);
      
      // Get expression data
      const expressionResult = await getMedianGeneExpression(geneResult.gencodeId);

      const gtexData = {
        geneInfo: geneResult.geneInfo,
        expressionSummary: expressionResult.summary
      };

      // Get all tissues sorted by expression level
      interface TissueData {
        tissueSiteDetailId: string;
        median: number;
        unit: string;
      }

      interface FormattedTissue {
        tissue: string;
        median: number;
        unit: string;
      }

      const allTissues = expressionResult.data
        .sort((a: TissueData, b: TissueData) => b.median - a.median)
        .map((t: TissueData) => ({
          tissue: t.tissueSiteDetailId.replace(/_/g, ' '),
          median: t.median,
          unit: t.unit
        }));

      const formattedContent = formatGTExInfo(gtexData);

      return {
        content: [
          {
            type: "text",
            text: `# Instructions for GTEx Expression Data
IMPORTANT: THIS RESPONSE ALREADY CONTAINS COMPLETE EXPRESSION DATA FOR ${geneResult.geneInfo.geneSymbol}, INCLUDING ALL TISSUES. NO NEED TO CALL THIS TOOL AGAIN FOR THIS GENE.

When discussing this expression data:
1. Always include the gene symbol and Gencode ID when referencing the gene
2. Use TPM (Transcripts Per Million) units when discussing expression values
3. Reference specific tissue names as provided
4. DO NOT CREATE ADDITIONAL ARTIFACTS - AN ARTIFACT IS ALREADY PROVIDED THROUGH ANOTHER TOOL

## Complete Tissue Expression Data
Use this comprehensive list to create context-specific summaries based on the conversation.
For example:
- If specific tissues are mentioned by the user
- If a disease is discussed, focus on relevant affected tissues
- If discussing a body system, highlight related tissues
- If no disease is mentioned and you know of diseases with strong clear connections to this gene, then mention that and include measures from relevant tissues related to those diseases.

## Highest Expression Summary
The top 5 tissues with highest expression are:
${allTissues.slice(0, 5).map((t: FormattedTissue) => `- ${t.tissue}: ${t.median} ${t.unit}`).join('\n')}
This information should always be included in your response as a key summary point.

### All Tissues (Sorted by Expression Level):
${allTissues.map((t: FormattedTissue) => `- ${t.tissue}: ${t.median} ${t.unit}`).join('\n')}

${formattedContent}`
          }
        ],
        artifacts: [
          {
            type: 'text/markdown',
            title: `GTEx Expression: ${geneResult.geneInfo.geneSymbol}`,
            name: `gtex_expression_${geneResult.geneInfo.geneSymbol}.md`,
            content: formattedContent
          },
          {
            type: 'application/json',
            title: `GTEx Raw Data: ${geneResult.geneInfo.geneSymbol}`,
            name: `gtex_data_${geneResult.geneInfo.geneSymbol}.json`,
            content: gtexData
          }
        ],
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to retrieve GTEx data: ${error.message}`);
      }
      throw new Error('Failed to retrieve GTEx data: An unknown error occurred');
    }
  } else {
    throw new Error(`Unknown tool: ${name}`);
  }
});

// Start the server
async function main() {
  console.log(`[${SERVICE_NAME}] Starting MCP server`);
  console.log(`[${SERVICE_NAME}] API Base URL: ${API_BASE_URL}`);

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.log(`[${SERVICE_NAME}] MCP Server running on stdio`);
}

main().catch((error) => {
  console.error(`[${SERVICE_NAME}] Fatal error in main():`, error);
  process.exit(1);
}); 