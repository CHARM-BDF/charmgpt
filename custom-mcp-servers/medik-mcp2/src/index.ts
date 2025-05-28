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

// Types for our data structures
interface EntityInfo {
  type: string;
  group: number;
}

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

// API response tuple type
type MediKanrenTuple = [string, string, string, string, string, string, string[]];

// MCP logging utility - will be set after server creation
let mcpServer: Server | null = null;

function log(message: string, data?: any): void {
  const timestamp = new Date().toISOString();
  const fullMessage = data ? `${message} | Data: ${JSON.stringify(data)}` : message;
  
  // STEP 1 DEBUG: Log function called
  console.error(`[STEP-1-DEBUG] log() function called`);
  console.error(`[STEP-1-DEBUG] Message: ${message}`);
  console.error(`[STEP-1-DEBUG] Data: ${data ? JSON.stringify(data) : 'none'}`);
  console.error(`[STEP-1-DEBUG] mcpServer exists: ${mcpServer !== null}`);

  // Use MCP logging if server is available, fallback to console
  if (mcpServer) {
    console.error(`[STEP-1-DEBUG] Attempting to send MCP logging message`);
    const logPayload = {
      level: 'info' as LoggingLevel,
      logger: 'medik-mcp',
      data: {
        message: fullMessage,
        timestamp: timestamp,
        traceId: Math.random().toString(36).substring(2, 8),
        ...data
      }
    };
    
    console.error(`[STEP-1-DEBUG] Log payload:`, JSON.stringify(logPayload, null, 2));
    
    mcpServer.sendLoggingMessage(logPayload).then(() => {
      console.error(`[STEP-1-DEBUG] ✅ sendLoggingMessage() completed successfully`);
    }).catch((error: any) => {
      console.error(`[STEP-1-DEBUG] ❌ sendLoggingMessage() failed:`, error);
      // Fallback to console if MCP logging fails
      console.error(`[${timestamp}] MEDIK: ${fullMessage}`);
    });
  } else {
    console.error(`[STEP-1-DEBUG] ❌ mcpServer is null, using console fallback`);
    console.error(`[${timestamp}] MEDIK: ${fullMessage}`);
  }
}

// Entity type classification based on CURIE prefix
function getEntityType(curie: string): EntityInfo {
  const prefix = curie.split(':')[0];
  
  switch (prefix) {
    case 'DRUGBANK':
      return { type: 'Drug', group: 1 };
    case 'NCBIGene':
    case 'HGNC':
      return { type: 'Gene', group: 2 };
    case 'MONDO':
    case 'HP':
    case 'DOID':
      return { type: 'Disease', group: 3 };
    case 'UMLS':
      return { type: 'UMLS Concept', group: 4 };
    case 'REACT':
      return { type: 'Reaction', group: 5 };
    case 'NCIT':
      return { type: 'Cancer Concept', group: 6 };
    default:
      return { type: 'Other', group: 7 };
  }
}

// Make API request to MediKanren
async function makeMediKanrenRequest(subject: string, predicate: string, object: string): Promise<any[] | null> {
  const url = `https://medikanren.metareflective.systems/query0?subject=${encodeURIComponent(subject)}&predicate=${encodeURIComponent(predicate)}&object=${encodeURIComponent(object)}`;
  
  log(`Making API request to MediKanren`, { url, subject, predicate, object });
  
  try {
    const response = await fetch(url);
    if (!response.ok) {
      log(`API request failed with status ${response.status}: ${response.statusText}`);
      return null;
    }
    
    const data = await response.json();
    log(`API request successful, received ${data.length} relationships`);
    return data;
  } catch (error) {
    log(`API request error: ${error}`);
    return null;
  }
}

// Run bidirectional query (X->Known and Known->X)
export async function runBidirectionalQuery(targetEntity: string): Promise<MediKanrenTuple[]> {
  log(`Starting bidirectional query for entity: ${targetEntity}`);
  
  const predicate = "biolink:affects"; // Using a more specific predicate
  
  // Query 1: targetEntity -> X (what the target affects)
  log(`Query 1: ${targetEntity} -> X (what ${targetEntity} affects)`);
  const query1Results = await makeMediKanrenRequest(targetEntity, predicate, "");
  
  // Query 2: X -> targetEntity (what affects the target)
  log(`Query 2: X -> ${targetEntity} (what affects ${targetEntity})`);
  const query2Results = await makeMediKanrenRequest("", predicate, targetEntity);
  
  // Combine results
  const allResults: MediKanrenTuple[] = [];
  
  if (query1Results) {
    log(`Query 1 returned ${query1Results.length} relationships`);
    allResults.push(...query1Results);
  } else {
    log(`Query 1 failed or returned no results`);
  }
  
  if (query2Results) {
    log(`Query 2 returned ${query2Results.length} relationships`);
    allResults.push(...query2Results);
  } else {
    log(`Query 2 failed or returned no results`);
  }
  
  // Remove duplicates based on source-predicate-target combination
  const seen = new Set<string>();
  const deduplicated = allResults.filter((tuple: MediKanrenTuple) => {
    const key = `${tuple[0]}-${tuple[2]}-${tuple[3]}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
  
  log(`Combined and deduplicated: ${allResults.length} -> ${deduplicated.length} relationships`);
  return deduplicated;
}

// Run bidirectional query with custom predicate
export async function runBidirectionalQueryWithPredicate(targetEntity: string, predicate: string): Promise<MediKanrenTuple[]> {
  log(`Starting bidirectional query for entity: ${targetEntity} with predicate: ${predicate}`);
  
  // Query 1: targetEntity -> X (what the target relates to via predicate)
  log(`Query 1: ${targetEntity} -> X (${targetEntity} ${predicate} X)`);
  const query1Results = await makeMediKanrenRequest(targetEntity, predicate, "");
  
  // Query 2: X -> targetEntity (what relates to target via predicate)
  log(`Query 2: X -> ${targetEntity} (X ${predicate} ${targetEntity})`);
  const query2Results = await makeMediKanrenRequest("", predicate, targetEntity);
  
  // Combine results
  const allResults: MediKanrenTuple[] = [];
  
  if (query1Results) {
    log(`Query 1 returned ${query1Results.length} relationships`);
    allResults.push(...query1Results);
  } else {
    log(`Query 1 failed or returned no results`);
  }
  
  if (query2Results) {
    log(`Query 2 returned ${query2Results.length} relationships`);
    allResults.push(...query2Results);
  } else {
    log(`Query 2 failed or returned no results`);
  }
  
  // Remove duplicates based on source-predicate-target combination
  const seen = new Set<string>();
  const deduplicated = allResults.filter((tuple: MediKanrenTuple) => {
    const key = `${tuple[0]}-${tuple[2]}-${tuple[3]}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
  
  log(`Combined and deduplicated: ${allResults.length} -> ${deduplicated.length} relationships`);
  return deduplicated;
}

// Create knowledge graph from raw API data
function createKnowledgeGraph(rawData: MediKanrenTuple[], queryEntity: string): KnowledgeGraph {
  log(`Creating knowledge graph from ${rawData.length} relationships`);
  
  const nodes = new Map<string, GraphNode>();
  const links: GraphLink[] = [];
  let filteredCount = 0;
  let filteredNodeCount = 0;
  
  // Process each relationship tuple
  for (const tuple of rawData) {
    const [sourceId, sourceName, predicate, targetId, targetName, , evidence] = tuple;
    
    // Filter out CAID nodes (unreliable variant data)
    if (sourceId.startsWith('CAID:') || targetId.startsWith('CAID:')) {
      filteredNodeCount++;
      continue;
    }
    
    // Filter out basic transcription relationships
    if (predicate === 'biolink:transcribed_from') {
      filteredCount++;
      continue;
    }
    
    // Normalize UniProtKB versioned IDs
    const normalizedSourceId = sourceId.replace(/^(UniProtKB:[^-]+)-\d+$/, '$1');
    const normalizedTargetId = targetId.replace(/^(UniProtKB:[^-]+)-\d+$/, '$1');
    
    // Create source node
    if (!nodes.has(normalizedSourceId)) {
      const entityInfo = getEntityType(normalizedSourceId);
      nodes.set(normalizedSourceId, {
        id: normalizedSourceId,
        name: sourceName || normalizedSourceId,
        entityType: entityInfo.type,
        group: entityInfo.group,
        isStartingNode: normalizedSourceId === queryEntity,
        val: 10, // Default size, will be adjusted based on connections
        connections: 0
      });
    }
    
    // Create target node
    if (!nodes.has(normalizedTargetId)) {
      const entityInfo = getEntityType(normalizedTargetId);
      nodes.set(normalizedTargetId, {
        id: normalizedTargetId,
        name: targetName || normalizedTargetId,
        entityType: entityInfo.type,
        group: entityInfo.group,
        isStartingNode: normalizedTargetId === queryEntity,
        val: 10, // Default size, will be adjusted based on connections
        connections: 0
      });
    }
    
    // Increment connection counts
    nodes.get(normalizedSourceId)!.connections++;
    nodes.get(normalizedTargetId)!.connections++;
    
    // Create link
    const humanReadablePredicate = predicate.replace('biolink:', '').replace(/_/g, ' ');
    links.push({
      source: normalizedSourceId,
      target: normalizedTargetId,
      label: humanReadablePredicate,
      value: 1,
      evidence: evidence || []
    });
  }
  
  // Adjust node sizes based on connection count (5-20 range)
  const nodeArray = Array.from(nodes.values());
  nodeArray.forEach(node => {
    node.val = Math.min(20, Math.max(5, 5 + node.connections));
  });
  
  log(`Knowledge graph created:`, {
    nodes: nodeArray.length,
    links: links.length,
    filteredRelationships: filteredCount,
    filteredNodes: filteredNodeCount
  });
  
  return {
    nodes: nodeArray,
    links,
    filteredCount,
    filteredNodeCount
  };
}

// Create the MCP server
const server = new Server({
  name: 'medik-mcp',
  version: '2.0.0',
}, {
  capabilities: {
    tools: {},
    logging: {},
  },
});

// ✅ FIX #1: Set the global server reference IMMEDIATELY after creation
mcpServer = server;
log("✅ MCP server created and reference assigned");

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async (): Promise<{ tools: Tool[] }> => {
  log('Tools list requested');
  
  return {
    tools: [
      {
        name: 'get-everything',
        description: 'Get all biomedical relationships for a given entity using biolink:affects predicate (bidirectional query)',
        inputSchema: {
          type: 'object',
          properties: {
            entity: {
              type: 'string',
              description: 'The entity to query (CURIE format, e.g., "HGNC:8651", "NCBIGene:4893", "DRUGBANK:DB12411")',
            },
          },
          required: ['entity'],
        },
      },
      {
        name: 'query-with-predicate',
        description: 'Query biomedical relationships with a specific predicate (bidirectional)',
        inputSchema: {
          type: 'object',
          properties: {
            entity: {
              type: 'string',
              description: 'The entity to query (CURIE format, e.g., "HGNC:8651", "DRUGBANK:DB12411")',
            },
            predicate: {
              type: 'string',
              description: 'The biolink predicate to use (e.g., "biolink:treats", "biolink:affects", "biolink:related_to")',
            },
          },
          required: ['entity', 'predicate'],
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request: CallToolRequest) => {
  const { name, arguments: args } = request.params;
  
  log(`🔥 TOOL CALL RECEIVED: ${name}`, args);
  
  try {
    if (name === 'get-everything') {
      const entity = args?.entity as string;
      
      if (!entity) {
        throw new Error('Entity parameter is required');
      }
      
      log(`🚨 STARTING get-everything for entity: ${entity}`);
      
      // Send status update to UI
      await server.sendLoggingMessage({
        level: 'info',
        logger: 'medik-mcp',
        data: {
          message: `Starting bidirectional query for ${entity}...`,
          timestamp: new Date().toISOString(),
          traceId: Math.random().toString(36).substring(2, 8)
        }
      });
      
      // Run the bidirectional query
      const rawData = await runBidirectionalQuery(entity);
      
      if (rawData.length === 0) {
        const message = `No relationships found for entity: ${entity}`;
        log(`❌ ${message}`);
        
        await server.sendLoggingMessage({
          level: 'warning',
          logger: 'medik-mcp',
          data: {
            message: message,
            timestamp: new Date().toISOString(),
            traceId: Math.random().toString(36).substring(2, 8)
          }
        });
        
        return {
          content: [
            {
              type: 'text',
              text: `# No Results Found\n\nNo biomedical relationships were found for entity: **${entity}**\n\nThis could mean:\n- The entity doesn't exist in the MediKanren knowledge base\n- The entity has no known relationships\n- There was an API connectivity issue\n\nPlease verify the entity identifier is correct (should be in CURIE format like "HGNC:8651").`
            } as TextContent
          ]
        };
      }
      
      await server.sendLoggingMessage({
        level: 'info',
        logger: 'medik-mcp',
        data: {
          message: `Found ${rawData.length} raw relationships, creating knowledge graph...`,
          timestamp: new Date().toISOString(),
          traceId: Math.random().toString(36).substring(2, 8)
        }
      });
      
      // Create knowledge graph
      const graph = createKnowledgeGraph(rawData, entity);
      
      await server.sendLoggingMessage({
        level: 'info',
        logger: 'medik-mcp',
        data: {
          message: `Knowledge graph created: ${graph.nodes.length} nodes, ${graph.links.length} links`,
          timestamp: new Date().toISOString(),
          traceId: Math.random().toString(36).substring(2, 8)
        }
      });
      
      // Create response
      const title = `Knowledge Graph: All relationships for ${entity}`;
      const summary = `Found ${graph.links.length} relationships connecting ${graph.nodes.length} biomedical entities.`;
      
      if (graph.filteredCount > 0 || graph.filteredNodeCount > 0) {
        await server.sendLoggingMessage({
          level: 'info',
          logger: 'medik-mcp',
          data: {
            message: `Filtered out ${graph.filteredCount} basic relationships and ${graph.filteredNodeCount} unreliable variant nodes`,
            timestamp: new Date().toISOString(),
            traceId: Math.random().toString(36).substring(2, 8)
          }
        });
      }
      
      log(`✅ SUCCESS: Returning knowledge graph with ${graph.nodes.length} nodes and ${graph.links.length} links`);
      
      return {
        content: [
          {
            type: 'text',
            text: `# ${title}\n\n${summary}\n\n## Statistics\n- **Nodes**: ${graph.nodes.length}\n- **Relationships**: ${graph.links.length}\n- **Filtered out**: ${graph.filteredCount} basic relationships, ${graph.filteredNodeCount} unreliable nodes\n\n## Entity Types Found\n${Array.from(new Set(graph.nodes.map(n => n.entityType))).map(type => `- ${type}`).join('\n')}\n\nThe knowledge graph has been generated and can be visualized using the attached artifact.`
          } as TextContent
        ],
        artifacts: [
          {
            type: 'application/vnd.knowledge-graph',
            title,
            content: JSON.stringify(graph)
          }
        ]
      };
    } else if (name === 'query-with-predicate') {
      const entity = args?.entity as string;
      const predicate = args?.predicate as string;
      
      if (!entity || !predicate) {
        throw new Error('Both entity and predicate parameters are required');
      }
      
      log(`🚨 STARTING query-with-predicate for entity: ${entity} and predicate: ${predicate}`);
      
      // Send status update to UI
      await server.sendLoggingMessage({
        level: 'info',
        logger: 'medik-mcp',
        data: {
          message: `Starting bidirectional query for ${entity} with predicate ${predicate}...`,
          timestamp: new Date().toISOString(),
          traceId: Math.random().toString(36).substring(2, 8)
        }
      });
      
      // Run the bidirectional query with custom predicate
      const rawData = await runBidirectionalQueryWithPredicate(entity, predicate);
      
      if (rawData.length === 0) {
        const message = `No relationships found for entity: ${entity} with predicate: ${predicate}`;
        log(`❌ ${message}`);
        
        await server.sendLoggingMessage({
          level: 'warning',
          logger: 'medik-mcp',
          data: {
            message: message,
            timestamp: new Date().toISOString(),
            traceId: Math.random().toString(36).substring(2, 8)
          }
        });
        
        return {
          content: [
            {
              type: 'text',
              text: `# No Results Found\n\nNo biomedical relationships were found for entity: **${entity}** with predicate: **${predicate}**\n\nThis could mean:\n- The entity doesn't exist in the MediKanren knowledge base\n- The entity has no known relationships with the specified predicate\n- There was an API connectivity issue\n\nPlease verify the entity identifier and predicate are correct (should be in CURIE format like "HGNC:8651" and "biolink:affects").`
            } as TextContent
          ]
        };
      }
      
      await server.sendLoggingMessage({
        level: 'info',
        logger: 'medik-mcp',
        data: {
          message: `Found ${rawData.length} raw relationships, creating knowledge graph...`,
          timestamp: new Date().toISOString(),
          traceId: Math.random().toString(36).substring(2, 8)
        }
      });
      
      // Create knowledge graph
      const graph = createKnowledgeGraph(rawData, entity);
      
      await server.sendLoggingMessage({
        level: 'info',
        logger: 'medik-mcp',
        data: {
          message: `Knowledge graph created: ${graph.nodes.length} nodes, ${graph.links.length} links`,
          timestamp: new Date().toISOString(),
          traceId: Math.random().toString(36).substring(2, 8)
        }
      });
      
      // Create response
      const title = `Knowledge Graph: All relationships for ${entity} with predicate ${predicate}`;
      const summary = `Found ${graph.links.length} relationships connecting ${graph.nodes.length} biomedical entities.`;
      
      if (graph.filteredCount > 0 || graph.filteredNodeCount > 0) {
        await server.sendLoggingMessage({
          level: 'info',
          logger: 'medik-mcp',
          data: {
            message: `Filtered out ${graph.filteredCount} basic relationships and ${graph.filteredNodeCount} unreliable variant nodes`,
            timestamp: new Date().toISOString(),
            traceId: Math.random().toString(36).substring(2, 8)
          }
        });
      }
      
      log(`✅ SUCCESS: Returning knowledge graph with ${graph.nodes.length} nodes and ${graph.links.length} links`);
      
      return {
        content: [
          {
            type: 'text',
            text: `# ${title}\n\n${summary}\n\n## Statistics\n- **Nodes**: ${graph.nodes.length}\n- **Relationships**: ${graph.links.length}\n- **Filtered out**: ${graph.filteredCount} basic relationships, ${graph.filteredNodeCount} unreliable nodes\n\n## Entity Types Found\n${Array.from(new Set(graph.nodes.map(n => n.entityType))).map(type => `- ${type}`).join('\n')}\n\nThe knowledge graph has been generated and can be visualized using the attached artifact.`
          } as TextContent
        ],
        artifacts: [
          {
            type: 'application/vnd.knowledge-graph',
            title,
            content: JSON.stringify(graph)
          }
        ]
      };
    } else {
      throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    const errorMessage = `Error in tool ${name}: ${error}`;
    log(`❌ ${errorMessage}`);
    
    await server.sendLoggingMessage({
      level: 'error',
      logger: 'medik-mcp',
      data: {
        message: errorMessage,
        timestamp: new Date().toISOString(),
        traceId: Math.random().toString(36).substring(2, 8)
      }
    });
    
    throw error;
  }
});

// Start the server
async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  
  // ✅ FIX #2: Now that server is connected, we can safely use MCP logging
  log('🚀 Starting MediK MCP Server v2.0.0 (Simplified)');
  log('✅ MediK MCP Server connected and ready');
  
  // ✅ FIX #3: Add a forced test log to confirm end-to-end MCP logging flow
  mcpServer!.sendLoggingMessage({
    level: 'info',
    logger: 'startup',
    data: {
      message: 'Test MCP log message - server startup complete',
      timestamp: new Date().toISOString(),
      traceId: Math.random().toString(36).substring(2, 8)
    }
  });
  
  // ✅ DIAGNOSTIC: Add explicit test log message
  console.error('[DIAGNOSTIC] Sending explicit test log message...');
  await mcpServer!.sendLoggingMessage({
    level: 'info',
    logger: 'diagnostic',
    data: {
      message: '[TEST] Explicit diagnostic logging test - should appear in UI',
      timestamp: new Date().toISOString(),
      traceId: 'TEST-' + Math.random().toString(36).substring(2, 8)
    }
  });
  console.error('[DIAGNOSTIC] Test log message sent!');
}

main().catch((error: any) => {
  log(`💥 Server startup error: ${error}`);
  process.exit(1);
});