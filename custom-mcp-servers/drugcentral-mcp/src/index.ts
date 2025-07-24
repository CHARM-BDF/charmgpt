#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { DrugCentralDatabase } from './database.js';

const server = new Server(
  {
    name: 'drugcentral-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

const db = new DrugCentralDatabase();

// Test database connection on startup
db.testConnection().then(connected => {
  if (connected) {
    console.error('✓ Connected to DrugCentral database');
  } else {
    console.error('✗ Failed to connect to DrugCentral database');
  }
});

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'search_drugs',
        description: 'Search for drugs by name, synonym, or CAS registry number',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search query for drug name, synonym, or CAS number',
            },
            limit: {
              type: 'number',
              description: 'Maximum number of results to return (default: 10)',
              default: 10,
            },
          },
          required: ['query'],
        },
      },
      {
        name: 'search_targets',
        description: 'Search for molecular targets by name, gene symbol, or UniProt accession',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search query for target name, gene symbol, or UniProt accession',
            },
            limit: {
              type: 'number',
              description: 'Maximum number of results to return (default: 10)',
              default: 10,
            },
          },
          required: ['query'],
        },
      },
      {
        name: 'get_mechanism_of_action',
        description: 'Get mechanism of action relationships between drugs and targets',
        inputSchema: {
          type: 'object',
          properties: {
            drug_id: {
              type: 'number',
              description: 'Optional: Filter by specific drug ID',
            },
            target_id: {
              type: 'number',
              description: 'Optional: Filter by specific target ID',
            },
            limit: {
              type: 'number',
              description: 'Maximum number of results to return (default: 20)',
              default: 20,
            },
          },
        },
      },
      {
        name: 'get_drug_targets',
        description: 'Get all molecular targets for a specific drug',
        inputSchema: {
          type: 'object',
          properties: {
            drug_id: {
              type: 'number',
              description: 'Drug ID to get targets for',
            },
          },
          required: ['drug_id'],
        },
      },
      {
        name: 'get_target_drugs',
        description: 'Get all drugs that target a specific molecular target',
        inputSchema: {
          type: 'object',
          properties: {
            target_id: {
              type: 'number',
              description: 'Target ID to get drugs for',
            },
          },
          required: ['target_id'],
        },
      },
      {
        name: 'search_bioactivity',
        description: 'Search bioactivity data for drug-target interactions',
        inputSchema: {
          type: 'object',
          properties: {
            drug_id: {
              type: 'number',
              description: 'Optional: Filter by specific drug ID',
            },
            target_id: {
              type: 'number',
              description: 'Optional: Filter by specific target ID',
            },
            activity_type: {
              type: 'string',
              description: 'Optional: Filter by activity type (e.g., Ki, IC50, EC50)',
            },
            limit: {
              type: 'number',
              description: 'Maximum number of results to return (default: 20)',
              default: 20,
            },
          },
        },
      },
      {
        name: 'get_drug_bioactivity',
        description: 'Get bioactivity data for a specific drug',
        inputSchema: {
          type: 'object',
          properties: {
            drug_id: {
              type: 'number',
              description: 'Drug ID to get bioactivity data for',
            },
            limit: {
              type: 'number',
              description: 'Maximum number of results to return (default: 20)',
              default: 20,
            },
          },
          required: ['drug_id'],
        },
      },
      {
        name: 'get_target_bioactivity',
        description: 'Get bioactivity data for a specific target',
        inputSchema: {
          type: 'object',
          properties: {
            target_id: {
              type: 'number',
              description: 'Target ID to get bioactivity data for',
            },
            limit: {
              type: 'number',
              description: 'Maximum number of results to return (default: 20)',
              default: 20,
            },
          },
          required: ['target_id'],
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'search_drugs': {
        const { query, limit = 10 } = args as { query: string; limit?: number };
        
        if (!query || query.trim().length === 0) {
          throw new McpError(ErrorCode.InvalidParams, 'Query parameter is required');
        }

        const drugs = await db.searchDrugs(query, limit);
        
        return {
          content: [
            {
              type: 'text',
              text: `Found ${drugs.length} drugs matching "${query}":\n\n` +
                drugs.map(drug => 
                  `**${drug.name}** (ID: ${drug.id})\n` +
                  `- CAS: ${drug.cas_reg_no || 'N/A'}\n` +
                  `- MW: ${drug.molecular_weight || 'N/A'}\n` +
                  `- Formula: ${drug.formula || 'N/A'}\n` +
                  `- Synonyms: ${drug.synonyms.slice(0, 3).join(', ')}${drug.synonyms.length > 3 ? '...' : ''}\n` +
                  (drug.smiles ? `- SMILES: ${drug.smiles.substring(0, 100)}${drug.smiles.length > 100 ? '...' : ''}\n` : '')
                ).join('\n'),
            },
          ],
        };
      }

      case 'search_targets': {
        const { query, limit = 10 } = args as { query: string; limit?: number };
        
        if (!query || query.trim().length === 0) {
          throw new McpError(ErrorCode.InvalidParams, 'Query parameter is required');
        }

        const targets = await db.searchTargets(query, limit);
        
        return {
          content: [
            {
              type: 'text',
              text: `Found ${targets.length} targets matching "${query}":\n\n` +
                targets.map(target => 
                  `**${target.name}** (ID: ${target.id})\n` +
                  `- Gene: ${target.gene || 'N/A'}\n` +
                  `- UniProt: ${target.uniprot || 'N/A'}\n` +
                  `- Class: ${target.target_class}\n` +
                  `- Organism: ${target.organism || 'N/A'}\n`
                ).join('\n'),
            },
          ],
        };
      }

      case 'get_mechanism_of_action': {
        const { drug_id, target_id, limit = 20 } = args as { 
          drug_id?: number; 
          target_id?: number; 
          limit?: number; 
        };

        const moa = await db.getMechanismOfAction(drug_id, target_id, limit);
        
        return {
          content: [
            {
              type: 'text',
              text: `Found ${moa.length} mechanism of action relationships:\n\n` +
                moa.map(m => 
                  `**${m.drug_name}** → **${m.target_name}**\n` +
                  `- Drug ID: ${m.drug_id}\n` +
                  `- Target ID: ${m.target_id}\n` +
                  `- Gene: ${m.target_gene || 'N/A'}\n` +
                  `- UniProt: ${m.uniprot || 'N/A'}\n` +
                  `- MoA Type: ${m.moa_type}\n` +
                  `- Evidence: ${m.evidence_source}\n`
                ).join('\n'),
            },
          ],
        };
      }

      case 'get_drug_targets': {
        const { drug_id } = args as { drug_id: number };
        
        if (!drug_id) {
          throw new McpError(ErrorCode.InvalidParams, 'drug_id parameter is required');
        }

        const targets = await db.getDrugTargetsByDrug(drug_id);
        
        return {
          content: [
            {
              type: 'text',
              text: `Found ${targets.length} targets for drug ID ${drug_id}:\n\n` +
                targets.map(target => 
                  `**${target.name}** (ID: ${target.id})\n` +
                  `- Gene: ${target.gene || 'N/A'}\n` +
                  `- UniProt: ${target.uniprot || 'N/A'}\n` +
                  `- Class: ${target.target_class}\n` +
                  `- Organism: ${target.organism || 'N/A'}\n`
                ).join('\n'),
            },
          ],
        };
      }

      case 'get_target_drugs': {
        const { target_id } = args as { target_id: number };
        
        if (!target_id) {
          throw new McpError(ErrorCode.InvalidParams, 'target_id parameter is required');
        }

        const drugs = await db.getDrugsByTarget(target_id);
        
        return {
          content: [
            {
              type: 'text',
              text: `Found ${drugs.length} drugs for target ID ${target_id}:\n\n` +
                drugs.map(drug => 
                  `**${drug.name}** (ID: ${drug.id})\n` +
                  `- CAS: ${drug.cas_reg_no || 'N/A'}\n` +
                  `- MW: ${drug.molecular_weight || 'N/A'}\n` +
                  `- Formula: ${drug.formula || 'N/A'}\n` +
                  `- Synonyms: ${drug.synonyms.slice(0, 3).join(', ')}${drug.synonyms.length > 3 ? '...' : ''}\n`
                ).join('\n'),
            },
          ],
        };
      }

      case 'search_bioactivity': {
        const { drug_id, target_id, activity_type, limit = 20 } = args as { 
          drug_id?: number; 
          target_id?: number; 
          activity_type?: string;
          limit?: number; 
        };

        const bioactivity = await db.getBioactivityData(drug_id, target_id, activity_type, limit);
        
        return {
          content: [
            {
              type: 'text',
              text: `Found ${bioactivity.length} bioactivity data points:\n\n` +
                bioactivity.map(bio => 
                  `**${bio.drug_name}** → **${bio.target_name}**\n` +
                  `- Activity: ${bio.activity_type} = ${bio.activity_value || 'N/A'} ${bio.activity_unit || ''}\n` +
                  `- Gene: ${bio.target_gene || 'N/A'}\n` +
                  `- Source: ${bio.source}\n` +
                  `- Organism: ${bio.organism || 'N/A'}\n` +
                  (bio.relation ? `- Relation: ${bio.relation}\n` : '')
                ).join('\n'),
            },
          ],
        };
      }

      case 'get_drug_bioactivity': {
        const { drug_id, limit = 20 } = args as { drug_id: number; limit?: number };
        
        if (!drug_id) {
          throw new McpError(ErrorCode.InvalidParams, 'drug_id parameter is required');
        }

        const bioactivity = await db.getBioactivityData(drug_id, undefined, undefined, limit);
        
        return {
          content: [
            {
              type: 'text',
              text: `Found ${bioactivity.length} bioactivity data points for drug ID ${drug_id}:\n\n` +
                bioactivity.map(bio => 
                  `**${bio.target_name}**\n` +
                  `- Activity: ${bio.activity_type} = ${bio.activity_value || 'N/A'} ${bio.activity_unit || ''}\n` +
                  `- Gene: ${bio.target_gene || 'N/A'}\n` +
                  `- Source: ${bio.source}\n` +
                  `- Organism: ${bio.organism || 'N/A'}\n` +
                  (bio.relation ? `- Relation: ${bio.relation}\n` : '')
                ).join('\n'),
            },
          ],
        };
      }

      case 'get_target_bioactivity': {
        const { target_id, limit = 20 } = args as { target_id: number; limit?: number };
        
        if (!target_id) {
          throw new McpError(ErrorCode.InvalidParams, 'target_id parameter is required');
        }

        const bioactivity = await db.getBioactivityData(undefined, target_id, undefined, limit);
        
        return {
          content: [
            {
              type: 'text',
              text: `Found ${bioactivity.length} bioactivity data points for target ID ${target_id}:\n\n` +
                bioactivity.map(bio => 
                  `**${bio.drug_name}**\n` +
                  `- Activity: ${bio.activity_type} = ${bio.activity_value || 'N/A'} ${bio.activity_unit || ''}\n` +
                  `- Source: ${bio.source}\n` +
                  `- Organism: ${bio.organism || 'N/A'}\n` +
                  (bio.relation ? `- Relation: ${bio.relation}\n` : '')
                ).join('\n'),
            },
          ],
        };
      }

      default:
        throw new McpError(ErrorCode.MethodNotFound, `Tool ${name} not found`);
    }
  } catch (error) {
    console.error(`Tool execution error: ${error}`);
    if (error instanceof McpError) {
      throw error;
    }
    throw new McpError(ErrorCode.InternalError, `Tool execution failed: ${error}`);
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('DrugCentral MCP server running on stdio');
}

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
}); 