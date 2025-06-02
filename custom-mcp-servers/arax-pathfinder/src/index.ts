#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import fetch from 'node-fetch';

// TypeScript interfaces for ARAX API
interface AraxQueryNode {
  ids?: string[];
  categories?: string[];
  is_set?: boolean;
  name?: string;
}

interface AraxQueryEdge {
  subject: string;
  object: string;
}

interface AraxQueryPath {
  subject: string;
  object: string;
  predicates: string[];
}

interface AraxQuery {
  message: {
    query_graph: {
      edges?: Record<string, AraxQueryEdge>;
      paths?: Record<string, AraxQueryPath>;
      nodes: Record<string, AraxQueryNode>;
    };
  };
  submitter?: string;
  stream_progress?: boolean;
  query_options?: {
    kp_timeout?: string;
    prune_threshold?: string;
  };
}

// Knowledge graph interfaces (matching medik-mcp2 format)
interface GraphNode {
  id: string;
  name: string;
  entityType: string;
  group: number;
  isStartingNode: boolean;
  val: number;
  connections: number;
}

interface GraphLink {
  source: string;
  target: string;
  label: string;
  value: number;
  evidence: string[];
}

interface KnowledgeGraph {
  nodes: GraphNode[];
  links: GraphLink[];
  filteredCount: number;
  filteredNodeCount: number;
}

// Utility functions
function log(message: string, data?: any): void {
  const timestamp = new Date().toISOString();
  console.error(`[${timestamp}] [ARAX-PATHFINDER] ${message}`);
  if (data !== undefined) {
    console.error(`[${timestamp}] [ARAX-PATHFINDER] Data:`, JSON.stringify(data, null, 2));
  }
}

function classifyEntity(categories: string[]): { type: string; group: number } {
  const categoryMap: Record<string, { type: string; group: number }> = {
    'biolink:Disease': { type: 'Disease', group: 1 },
    'biolink:Drug': { type: 'Drug', group: 2 },
    'biolink:Gene': { type: 'Gene', group: 3 },
    'biolink:Protein': { type: 'Protein', group: 4 },
    'biolink:ChemicalEntity': { type: 'Chemical', group: 2 },
    'biolink:BiologicalProcess': { type: 'Process', group: 5 },
    'biolink:MolecularActivity': { type: 'Activity', group: 5 },
    'biolink:CellularComponent': { type: 'Component', group: 5 },
    'biolink:Pathway': { type: 'Pathway', group: 6 },
    'biolink:AnatomicalEntity': { type: 'Anatomy', group: 7 },
    'biolink:PhenotypicFeature': { type: 'Phenotype', group: 8 }
  };

  for (const category of categories) {
    if (categoryMap[category]) {
      return categoryMap[category];
    }
  }
  return { type: 'Unknown', group: 0 };
}

function parseEntityId(entity: string): { id: string; name?: string } {
  if (entity.includes(':')) {
    return { id: entity };
  }
  // If it's just a name, try to convert to CURIE format
  return { id: entity, name: entity };
}

async function queryArax(query: AraxQuery): Promise<any> {
  const url = 'https://arax.ncats.io/api/arax/v1.4/query';
  
  log('🔄 Sending query to ARAX API', { url, query });
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify(query),
  });

  if (!response.ok) {
    const errorText = await response.text();
    log('❌ ARAX API error', { status: response.status, error: errorText });
    throw new Error(`ARAX API error: ${response.status} - ${errorText}`);
  }

  const result = await response.json() as any;
  log('✅ ARAX API response received', { 
    hasNodes: !!result?.message?.knowledge_graph?.nodes,
    hasEdges: !!result?.message?.knowledge_graph?.edges,
    nodeCount: Object.keys(result?.message?.knowledge_graph?.nodes || {}).length,
    edgeCount: Object.keys(result?.message?.knowledge_graph?.edges || {}).length
  });
  
  return result;
}

function convertToKnowledgeGraph(araxResponse: any, queryType: string, sourceEntity: string, targetEntity?: string): KnowledgeGraph {
  const nodes: GraphNode[] = [];
  const links: GraphLink[] = [];
  
  if (!araxResponse?.message?.knowledge_graph) {
    log('⚠️ No knowledge graph in ARAX response');
    return { nodes, links, filteredCount: 0, filteredNodeCount: 0 };
  }

  const kg = araxResponse.message.knowledge_graph;
  const nodeMap = new Map<string, GraphNode>();

  // Process nodes
  if (kg.nodes) {
    Object.entries(kg.nodes).forEach(([nodeId, nodeData]: [string, any]) => {
      const categories = nodeData.categories || [];
      const { type, group } = classifyEntity(categories);
      
      const isStartingNode = nodeId === sourceEntity || nodeId === targetEntity;
      
      const graphNode: GraphNode = {
        id: nodeId,
        name: nodeData.name || nodeId,
        entityType: type,
        group,
        isStartingNode,
        val: isStartingNode ? 10 : 5,
        connections: 0
      };
      
      nodeMap.set(nodeId, graphNode);
    });
  }

  // Process edges
  if (kg.edges) {
    Object.entries(kg.edges).forEach(([edgeId, edgeData]: [string, any]) => {
      const sourceId = edgeData.subject;
      const targetId = edgeData.object;
      
      if (nodeMap.has(sourceId) && nodeMap.has(targetId)) {
        // Update connection counts
        const sourceNode = nodeMap.get(sourceId)!;
        const targetNode = nodeMap.get(targetId)!;
        sourceNode.connections++;
        targetNode.connections++;

        const evidence = edgeData.sources?.map((source: any) => 
          source.resource_id || source.resource_role || 'unknown'
        ) || ['unknown'];

        const link: GraphLink = {
          source: sourceId,
          target: targetId,
          label: edgeData.predicate || 'unknown',
          value: edgeData.confidence || 1,
          evidence
        };
        
        links.push(link);
      }
    });
  }

  // Convert map to array
  nodes.push(...nodeMap.values());

  log(`📊 Converted knowledge graph: ${nodes.length} nodes, ${links.length} links`);
  
  return {
    nodes,
    links,
    filteredCount: links.length,
    filteredNodeCount: nodes.length
  };
}

// Create connecting path query using the working "paths" format
function createConnectingPathQuery(entityA: string, entityB: string, nameA?: string, nameB?: string): AraxQuery {
  return {
    message: {
      query_graph: {
        nodes: {
          n0: { ids: [entityA] },
          n1: { ids: [entityB] }
        },
        paths: {
          p0: {
            subject: 'n0',
            object: 'n1',
            predicates: ['biolink:related_to']
          }
        }
      }
    },
    submitter: 'ARAX Pathfinder MCP',
    stream_progress: false,
    query_options: {
      kp_timeout: '30',
      prune_threshold: '50'
    }
  };
}

// MCP Server setup
const server = new Server(
  {
    name: 'arax-pathfinder',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'find-connecting-path',
        description: 'Find connecting paths between two biomedical entities using ARAX knowledge graph',
        inputSchema: {
          type: 'object',
          properties: {
            entity_a: {
              type: 'string',
              description: 'First entity (use CURIE format like NCBIGene:283635)',
            },
            entity_b: {
              type: 'string',
              description: 'Second entity (use CURIE format like NCBIGene:28514)',
            },
            name_a: {
              type: 'string',
              description: 'Optional human-readable name for first entity',
            },
            name_b: {
              type: 'string',
              description: 'Optional human-readable name for second entity',
            },
          },
          required: ['entity_a', 'entity_b'],
        },
      } as Tool,
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'find-connecting-path': {
        const { entity_a, entity_b, name_a, name_b } = args as {
          entity_a: string;
          entity_b: string;
          name_a?: string;
          name_b?: string;
        };

        log(`🔍 Finding connecting path between ${entity_a} and ${entity_b}`);

        const parsedA = parseEntityId(entity_a);
        const parsedB = parseEntityId(entity_b);
        
        try {
          const query = createConnectingPathQuery(
            parsedA.id,
            parsedB.id,
            name_a || parsedA.name,
            name_b || parsedB.name
          );
          
          const araxResponse = await queryArax(query);
          const knowledgeGraph = convertToKnowledgeGraph(
            araxResponse,
            'connecting-path',
            parsedA.id,
            parsedB.id
          );

          // Create success message with node and edge counts
          const successMessage = `## ARAX Connecting Path Results

**Query**: Finding connections between ${entity_a}${name_a ? ` (${name_a})` : ''} and ${entity_b}${name_b ? ` (${name_b})` : ''}

**Status**: ✅ Success

**Results**: 
- **${knowledgeGraph.nodes.length} nodes** found in the knowledge graph
- **${knowledgeGraph.links.length} connections** between entities
- **${knowledgeGraph.filteredCount} total relationships** discovered

The knowledge graph visualization shows all connecting paths and intermediate entities between your specified biomedical entities.

---
**Query completed successfully. The graph visualization below contains the full results.**`;

          return {
            content: [
              {
                type: "text",
                text: successMessage,
              },
            ],
            artifacts: [
              {
                name: 'connecting-path-results',
                type: 'application/json',
                content: JSON.stringify(knowledgeGraph, null, 2),
              },
            ],
          };
        } catch (queryError) {
          // Handle ARAX API or processing errors
          const errorMessage = `## ARAX Connecting Path Results

**Query**: Finding connections between ${entity_a}${name_a ? ` (${name_a})` : ''} and ${entity_b}${name_b ? ` (${name_b})` : ''}

**Status**: ❌ Error

**Error Details**: ${queryError instanceof Error ? queryError.message : String(queryError)}

**Possible Causes**:
- Invalid CURIE identifiers (ensure proper format like NCBIGene:283635)
- Entities not found in ARAX knowledge graph
- Network connectivity issues
- ARAX API temporarily unavailable

**Recommendations**:
- Verify CURIE format and existence using id-finder tools
- Try alternative entity identifiers
- Check if entities exist in biomedical databases

---
**Query failed. Please check the error details above and try again with valid CURIEs.**`;

          log('❌ Error in find-connecting-path execution', { error: queryError instanceof Error ? queryError.message : queryError });

          return {
            content: [
              {
                type: "text",
                text: errorMessage,
              },
            ],
          };
        }
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    // Handle validation or unexpected errors
    const errorMessage = `## ARAX Pathfinder Error

**Status**: ❌ Critical Error

**Error**: ${error instanceof Error ? error.message : String(error)}

**Details**: Failed to process the request due to a system error.

---
**Please check your input parameters and try again.**`;

    log('❌ Tool execution error', { error: error instanceof Error ? error.message : error });
    
    return {
      content: [
        {
          type: "text",
          text: errorMessage,
        },
      ],
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  log('🚀 ARAX Pathfinder MCP Server started successfully');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    log('💥 Fatal error starting server', error);
    process.exit(1);
  });
} 