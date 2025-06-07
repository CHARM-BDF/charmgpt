#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  CallToolRequest,
  ListToolsRequest,
  Tool,
  TextContent,
  LoggingLevel
} from '@modelcontextprotocol/sdk/types.js';

// ARAX API Types (based on our test script)
interface AraxQueryNode {
  ids?: string[];
  categories?: string[];  // Make optional since working format doesn't always include them
  is_set?: boolean;
  name?: string;
}

interface AraxQueryEdge {
  predicates?: string[];  // Make optional since optimal format doesn't use predicates
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
      edges?: Record<string, AraxQueryEdge>;  // Make optional
      paths?: Record<string, AraxQueryPath>;  // Add paths support
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

// Knowledge Graph Types for MCP output (matching medik-mcp2 format)
interface GraphNode {
  id: string;
  name: string;
  entityType: string;      // ← Changed from entity_type to match medik-mcp2
  group: number;
  isStartingNode: boolean; // ← Added to match medik-mcp2  
  val: number;
  connections: number;
}

interface GraphLink {
  source: string;
  target: string;
  label: string;           // ← Changed from predicate to match medik-mcp2
  value: number;           // ← Changed from confidence to match medik-mcp2
  evidence: string[];
}

interface KnowledgeGraph {
  nodes: GraphNode[];
  links: GraphLink[];
  filteredCount: number;      // ← Changed from metadata to match medik-mcp2
  filteredNodeCount: number;  // ← Added to match medik-mcp2
}

// ARAX API Configuration
const ARAX_API_URL = 'https://arax.ncats.io/api/arax/v1.4/query';

// MCP logging utility
let mcpServer: Server | null = null;

function log(message: string, data?: any): void {
  const timestamp = new Date().toISOString();
  const fullMessage = data ? `${message} | Data: ${JSON.stringify(data)}` : message;
  
  if (mcpServer) {
    mcpServer.sendLoggingMessage({
      level: 'info' as LoggingLevel,
      logger: 'arax-mcp',
      data: {
        message: fullMessage,
        timestamp: timestamp,
        traceId: Math.random().toString(36).substring(2, 8),
        ...data
      }
    }).catch(() => {
      console.error(`[${timestamp}] ARAX: ${fullMessage}`);
    });
  } else {
    console.error(`[${timestamp}] ARAX: ${fullMessage}`);
  }
}

// Entity type classification based on biolink categories
function classifyEntity(categories: string[]): { type: string; group: number } {
  if (categories.some(cat => cat.includes('Gene'))) {
    return { type: 'Gene', group: 1 };
  }
  if (categories.some(cat => cat.includes('Drug') || cat.includes('ChemicalEntity'))) {
    return { type: 'Drug', group: 2 };
  }
  if (categories.some(cat => cat.includes('Disease') || cat.includes('Phenotypic'))) {
    return { type: 'Disease', group: 3 };
  }
  if (categories.some(cat => cat.includes('Protein'))) {
    return { type: 'Protein', group: 4 };
  }
  if (categories.some(cat => cat.includes('Pathway'))) {
    return { type: 'Pathway', group: 5 };
  }
  return { type: 'Other', group: 6 };
}

// Parse entity ID from various formats
function parseEntityId(entity: string): { id: string; name?: string } {
  // Handle formats like "NCBIGene:283635" or "FAM177A1 (NCBIGene:283635)"
  const curieMatch = entity.match(/([A-Z0-9]+:\d+)/);
  const nameMatch = entity.match(/^([^(]+)\s*\(/);
  
  if (curieMatch) {
    return {
      id: curieMatch[1],
      name: nameMatch ? nameMatch[1].trim() : undefined
    };
  }
  
  // If no CURIE found, assume it's a gene name and try common prefixes
  const cleanEntity = entity.trim();
  return { id: cleanEntity, name: cleanEntity };
}

// Send ARAX query
async function queryArax(query: AraxQuery): Promise<any> {
  log('Sending ARAX query', { 
    query_graph: query.message.query_graph,
    stream_progress: query.stream_progress 
  });

  try {
    const response = await fetch(ARAX_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'ARAX-MCP-Server/1.0'
      },
      body: JSON.stringify(query)
    });

    if (!response.ok) {
      throw new Error(`ARAX API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    log('ARAX response received', { 
      status: data.status, 
      total_results: data.total_results_count 
    });
    
    return data;
  } catch (error) {
    log('ARAX query failed', { error: String(error) });
    throw error;
  }
}

// Convert ARAX response to knowledge graph
function convertToKnowledgeGraph(araxResponse: any, queryType: string, sourceEntity: string, targetEntity?: string): KnowledgeGraph {
  const nodes: GraphNode[] = [];
  const links: GraphLink[] = [];
  const nodeMap = new Map<string, GraphNode>();

  if (!araxResponse.message?.knowledge_graph) {
    return {
      nodes: [],
      links: [],
      filteredCount: 0,
      filteredNodeCount: 0
    };
  }

  const kg = araxResponse.message.knowledge_graph;

  // Process nodes
  Object.entries(kg.nodes || {}).forEach(([nodeId, nodeData]: [string, any]) => {
    const entityInfo = classifyEntity(nodeData.categories || []);
    
    const node: GraphNode = {
      id: nodeId,
      name: nodeData.name || nodeId,
      entityType: entityInfo.type,
      group: entityInfo.group,
      isStartingNode: nodeId === sourceEntity || nodeId === targetEntity,
      val: 10, // Default size
      connections: 0, // Will be calculated
    };
    
    nodes.push(node);
    nodeMap.set(nodeId, node);
  });

  // Process edges
  Object.entries(kg.edges || {}).forEach(([edgeId, edgeData]: [string, any]) => {
    const sourceNode = nodeMap.get(edgeData.subject);
    const targetNode = nodeMap.get(edgeData.object);
    
    if (sourceNode && targetNode) {
      sourceNode.connections++;
      targetNode.connections++;
      
      const link: GraphLink = {
        source: edgeData.subject,
        target: edgeData.object,
        label: edgeData.predicate || 'unknown',
        value: 1.0, // Default value
        evidence: edgeData.sources?.map((s: any) => s.resource_id) || [],
      };
      
      links.push(link);
    }
  });

  // Update node sizes based on connections
  nodes.forEach(node => {
    node.val = Math.max(5, Math.min(20, node.connections * 2));
  });

  return {
    nodes,
    links,
    filteredCount: links.length,
    filteredNodeCount: 0
  };
}

// Create optimized entity query using the discovered optimal format
function createEntityQuery(entityId: string, entityName?: string): AraxQuery {
  // Determine entity category based on CURIE prefix
  let sourceCategory = 'biolink:NamedThing';
  if (entityId.startsWith('NCBIGene:')) {
    sourceCategory = 'biolink:Gene';
  } else if (entityId.startsWith('DRUGBANK:') || entityId.startsWith('CHEBI:')) {
    sourceCategory = 'biolink:Drug';
  } else if (entityId.startsWith('MONDO:') || entityId.startsWith('DOID:')) {
    sourceCategory = 'biolink:Disease';
  } else if (entityId.startsWith('UniProtKB:')) {
    sourceCategory = 'biolink:Protein';
  }

  return {
    message: {
      query_graph: {
        edges: {
          e0: {
            subject: 'n0',
            object: 'n1'
            // NO predicates - this is key for the optimal format
          }
        },
        nodes: {
          n0: {
            ids: [entityId],
            categories: [sourceCategory],
            is_set: false,
            name: entityName || entityId
          },
          n1: {
            categories: [
              'biolink:Disease',
              'biolink:Drug', 
              'biolink:Gene',
              'biolink:Protein'
            ],
            is_set: false
          }
        }
      }
    },
    submitter: 'ARAX MCP Server',
    stream_progress: false,
    query_options: {
      kp_timeout: '30',
      prune_threshold: '50'
    }
  };
}

// Create connecting path query between two entities
function createConnectingPathQuery(entityA: string, entityB: string, nameA?: string, nameB?: string): AraxQuery {
  return {
    message: {
      query_graph: {
        nodes: {
          n0: {
            ids: [entityA]
          },
          n1: {
            ids: [entityB]
          }
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
    submitter: 'ARAX MCP Server',
    stream_progress: false,
    query_options: {
      kp_timeout: '30',
      prune_threshold: '50'
    }
  };
}

// Main server setup
const server = new Server(
  {
    name: 'arax-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
      logging: {}
    },
  }
);

mcpServer = server;

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  const tools: Tool[] = [
    {
      name: 'query-entity-effects',
      description: 'Query ALL connections to/from a biomedical entity in both directions using ARAX knowledge graph (what it affects AND what affects it)',
      inputSchema: {
        type: 'object',
        properties: {
          entity: {
            type: 'string',
            description: 'Entity to query in CURIE format (e.g., "NCBIGene:283635", "DRUGBANK:DB00001") or gene name'
          }
        },
        required: ['entity']
      }
    },
    {
      name: 'find-connecting-path',
      description: 'Find connecting paths between two biomedical entities through intermediate entities',
      inputSchema: {
        type: 'object',
        properties: {
          entity_a: {
            type: 'string',
            description: 'First entity in CURIE format or name'
          },
          entity_b: {
            type: 'string',
            description: 'Second entity in CURIE format or name'
          }
        },
        required: ['entity_a', 'entity_b']
      }
    },
    {
      name: 'custom-query',
      description: 'Execute a custom ARAX query with specific predicates and categories',
      inputSchema: {
        type: 'object',
        properties: {
          source_entity: {
            type: 'string',
            description: 'Source entity in CURIE format'
          },
          target_categories: {
            type: 'array',
            items: { type: 'string' },
            description: 'Target biolink categories to search for',
            default: ['biolink:Disease', 'biolink:Drug', 'biolink:Gene', 'biolink:Protein']
          },
          predicates: {
            type: 'array',
            items: { type: 'string' },
            description: 'Biolink predicates to use in the query',
            default: ['biolink:affects']
          }
        },
        required: ['source_entity']
      }
    }
  ];

  return { tools };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request: CallToolRequest) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'query-entity-effects': {
        const { entity } = args as { entity: string };
        const parsedEntity = parseEntityId(entity);
        
        log('Executing bidirectional entity query', { entity: parsedEntity });
        
        const query = createEntityQuery(parsedEntity.id, parsedEntity.name);
        const araxResponse = await queryArax(query);
        const knowledgeGraph = convertToKnowledgeGraph(
          araxResponse, 
          'bidirectional-entity', 
          parsedEntity.id
        );

        const title = `Knowledge Graph: All bidirectional relationships for ${entity}`;
        const summary = `Found ${knowledgeGraph.links.length} bidirectional relationships connecting ${knowledgeGraph.nodes.length} biomedical entities (what ${entity} affects AND what affects ${entity}).`;

        // Ensure content is always a string (like medik-mcp format)
        const stringifiedContent = JSON.stringify(knowledgeGraph);

        return {
          content: [
            {
              type: 'text',
              text: `# ${title}\n\n${summary}\n\n## Statistics\n- **Nodes**: ${knowledgeGraph.nodes.length}\n- **Relationships**: ${knowledgeGraph.links.length}\n- **Filtered out**: ${knowledgeGraph.filteredCount} basic relationships, ${knowledgeGraph.filteredNodeCount} unreliable nodes\n\n## Entity Types Found\n${Array.from(new Set(knowledgeGraph.nodes.map(n => n.entityType))).map(type => `- ${type}`).join('\n')}\n\n## Bidirectional Coverage\nThis query finds:\n- **Outgoing**: What ${entity} affects, treats, causes, regulates\n- **Incoming**: What affects, treats, causes, regulates ${entity}\n\nThe knowledge graph has been generated and can be visualized using the attached artifact.`
            } as TextContent
          ],
          artifacts: [
            {
              type: 'application/vnd.knowledge-graph',
              title,
              content: stringifiedContent
            }
          ]
        };
      }

      case 'find-connecting-path': {
        const { entity_a, entity_b } = args as { entity_a: string; entity_b: string };
        const parsedA = parseEntityId(entity_a);
        const parsedB = parseEntityId(entity_b);
        
        log('Executing connecting path query', { 
          entity_a: parsedA, 
          entity_b: parsedB 
        });
        
        const query = createConnectingPathQuery(
          parsedA.id, 
          parsedB.id, 
          parsedA.name, 
          parsedB.name
        );
        const araxResponse = await queryArax(query);
        const knowledgeGraph = convertToKnowledgeGraph(
          araxResponse, 
          'connecting-path', 
          parsedA.id,
          parsedB.id
        );

        const title = `Knowledge Graph: Connecting paths between ${entity_a} and ${entity_b}`;
        const summary = `Found ${knowledgeGraph.links.length} connecting paths through ${knowledgeGraph.nodes.length} biomedical entities.`;

        // Ensure content is always a string (like medik-mcp format)
        const stringifiedContent = JSON.stringify(knowledgeGraph);

        return {
          content: [
            {
              type: 'text',
              text: `# ${title}\n\n${summary}\n\n## Statistics\n- **Nodes**: ${knowledgeGraph.nodes.length}\n- **Relationships**: ${knowledgeGraph.links.length}\n- **Filtered out**: ${knowledgeGraph.filteredCount} basic relationships, ${knowledgeGraph.filteredNodeCount} unreliable nodes\n\n## Entity Types Found\n${Array.from(new Set(knowledgeGraph.nodes.map(n => n.entityType))).map(type => `- ${type}`).join('\n')}\n\nThe knowledge graph has been generated and can be visualized using the attached artifact.`
            } as TextContent
          ],
          artifacts: [
            {
              type: 'application/vnd.knowledge-graph',
              title,
              content: stringifiedContent
            }
          ]
        };
      }

      case 'custom-query': {
        const { 
          source_entity, 
          target_categories = ['biolink:Disease', 'biolink:Drug', 'biolink:Gene', 'biolink:Protein'],
          predicates = ['biolink:affects']
        } = args as { 
          source_entity: string; 
          target_categories?: string[]; 
          predicates?: string[] 
        };
        
        const parsedEntity = parseEntityId(source_entity);
        
        log('Executing custom query', { 
          entity: parsedEntity, 
          predicates, 
          target_categories 
        });
        
        const customQuery: AraxQuery = {
          message: {
            query_graph: {
              edges: {
                e0: {
                  predicates,
                  subject: 'n0',
                  object: 'n1'
                }
              },
              nodes: {
                n0: {
                  ids: [parsedEntity.id],
                  categories: ['biolink:Gene', 'biolink:Drug', 'biolink:Disease'],
                  is_set: false,
                  ...(parsedEntity.name && { name: parsedEntity.name })
                },
                n1: {
                  categories: target_categories,
                  is_set: false
                }
              }
            }
          },
          submitter: 'ARAX MCP Server',
          stream_progress: false,
          query_options: {
            kp_timeout: '30',
            prune_threshold: '50'
          }
        };
        
        const araxResponse = await queryArax(customQuery);
        const knowledgeGraph = convertToKnowledgeGraph(
          araxResponse, 
          'custom-query', 
          parsedEntity.id
        );

        const title = `Knowledge Graph: Custom query for ${source_entity}`;
        const summary = `Found ${knowledgeGraph.links.length} relationships using predicates [${predicates.join(', ')}] connecting ${knowledgeGraph.nodes.length} biomedical entities.`;

        // Ensure content is always a string (like medik-mcp format)
        const stringifiedContent = JSON.stringify(knowledgeGraph);

        return {
          content: [
            {
              type: 'text',
              text: `# ${title}\n\n${summary}\n\n## Query Parameters\n- **Predicates**: ${predicates.join(', ')}\n- **Target categories**: ${target_categories.join(', ')}\n\n## Statistics\n- **Nodes**: ${knowledgeGraph.nodes.length}\n- **Relationships**: ${knowledgeGraph.links.length}\n- **Filtered out**: ${knowledgeGraph.filteredCount} basic relationships, ${knowledgeGraph.filteredNodeCount} unreliable nodes\n\n## Entity Types Found\n${Array.from(new Set(knowledgeGraph.nodes.map(n => n.entityType))).map(type => `- ${type}`).join('\n')}\n\nThe knowledge graph has been generated and can be visualized using the attached artifact.`
            } as TextContent
          ],
          artifacts: [
            {
              type: 'application/vnd.knowledge-graph',
              title,
              content: stringifiedContent
            }
          ]
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    log('Tool execution failed', { tool: name, error: String(error) });
    throw error;
  }
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  log('ARAX MCP Server started');
}

main().catch((error) => {
  log('Server startup failed', { error: String(error) });
  process.exit(1);
}); 