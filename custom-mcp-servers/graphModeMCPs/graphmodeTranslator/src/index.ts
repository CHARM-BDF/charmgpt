import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

// =============================================================================
// CONFIGURATION SECTION
// =============================================================================
const TOOL_NAME = "graphmode-translator";
const SERVICE_NAME = "translator-mcp";
const DEFAULT_API_BASE_URL = process.env.API_BASE_URL || "http://localhost:3001";

// Translator API base URLs
const TRANSLATOR_URLS = {
  prod: 'https://ars-prod.transltr.io',
  test: 'https://ars.test.transltr.io',
  CI: 'https://ars.ci.transltr.io',
  dev: 'https://ars-dev.transltr.io'
};

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================
interface TranslatorNode {
  name?: string;
  categories?: string[];
}

interface TranslatorEdge {
  subject: string;
  object: string;
  predicate: string;
  qualifiers?: Qualifier[];
  attributes?: EdgeAttribute[];
  sources?: EdgeSource[];
}

interface Qualifier {
  qualifier_type_id: string;
  qualifier_value: string;
}

interface EdgeAttribute {
  attribute_type_id: string;
  value: any;
}

interface EdgeSource {
  resource_role: string;
  resource_id: string;
}

interface AuxiliaryGraph {
  edges: string[];
}

interface EdgeData {
  edge_id: string;
  edge_object: string;
  edge_objectNode_name: string;
  edge_objectNode_cats: string[];
  edge_objectNode_cat: string;
  edge_subject: string;
  edge_subjectNode_name: string;
  edge_subjectNode_cats: string[];
  edge_subjectNode_cat: string;
  predicate: string;
  qualifiers: Qualifier[];
  qualified_predicate: string;
  causal_mechanism_qualifier: string;
  subject_direction_qualifier: string;
  subject_aspect_qualifier: string;
  subject_form_or_variant_qualifier: string;
  object_direction_qualifier: string;
  object_aspect_qualifier: string;
  object_form_or_variant_qualifier: string;
  publications: string[];
  primary_source?: string;
  agg1?: string;
  agg2?: string;
  phrase: string;
  edge_type: 'one-hop' | 'creative';
}

interface GraphModeNode {
  id: string;
  label: string;
  type: string;
  data: any;
  position: { x: number; y: number };
}

interface GraphModeEdge {
  source: string;
  target: string;
  label: string;
  data: any;
}

// =============================================================================
// SCHEMA DEFINITIONS (REQUIRED)
// =============================================================================
const DatabaseContextSchema = z.object({
  conversationId: z.string().min(1, "conversationId is required"),
  artifactId: z.string().optional().describe("Artifact ID for Graph Mode"),
  apiBaseUrl: z.string().url().optional(),
  accessToken: z.string().optional(),
});

const TranslatorToolArgumentsSchema = z.object({
  pk: z.string().min(1, "PK (Primary Key) is required"),
  environment: z.enum(['prod', 'test', 'CI', 'dev']).optional().default('prod'),
  databaseContext: DatabaseContextSchema,
});

// =============================================================================
// SERVER SETUP
// =============================================================================
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

// =============================================================================
// API REQUEST HELPER (REQUIRED)
// =============================================================================
async function makeAPIRequest(
  endpoint: string,
  context: { conversationId: string; apiBaseUrl?: string; accessToken?: string },
  options: RequestInit = {}
): Promise<any> {
  try {
    const baseUrl = context.apiBaseUrl || DEFAULT_API_BASE_URL;
    const url = `${baseUrl}/api/graph/${context.conversationId}${endpoint}`;

    console.error(`[${SERVICE_NAME}] Making request to: ${url}`);
    console.error(`[${SERVICE_NAME}] Method: ${options.method || 'GET'}`);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': TOOL_NAME,
    };

    if (context.accessToken) {
      headers['Authorization'] = `Bearer ${context.accessToken}`;
    }

    const response = await fetch(url, { ...options, headers });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`[${SERVICE_NAME}] API request failed:`, error);
    throw error;
  }
}

// =============================================================================
// TRANSLATOR API INTEGRATION
// =============================================================================
async function fetchTranslatorData(pk: string, preferredEnvironment: string): Promise<any> {
  // Try environments in order: preferred, prod, test, CI
  const environments = [
    preferredEnvironment,
    ...['prod', 'test', 'CI'].filter(env => env !== preferredEnvironment)
  ];

  let lastError: Error | null = null;

  for (const env of environments) {
    try {
      const baseUrl = TRANSLATOR_URLS[env as keyof typeof TRANSLATOR_URLS];
      console.error(`[${SERVICE_NAME}] Trying environment: ${env} (${baseUrl})`);

      // First, fetch the message with trace
      const traceUrl = `${baseUrl}/ars/api/messages/${pk}?trace=y`;
      console.error(`[${SERVICE_NAME}] Fetching: ${traceUrl}`);
      
      const traceResponse = await fetch(traceUrl);
      
      if (!traceResponse.ok) {
        throw new Error(`HTTP ${traceResponse.status}: ${traceResponse.statusText}`);
      }

      const traceData = await traceResponse.json();
      const mergedVersion = traceData.merged_version;

      if (!mergedVersion) {
        throw new Error('No merged_version found in trace response');
      }

      console.error(`[${SERVICE_NAME}] Found merged_version: ${mergedVersion}`);

      // Fetch the merged version
      const mergedUrl = `${baseUrl}/ars/api/messages/${mergedVersion}`;
      console.error(`[${SERVICE_NAME}] Fetching merged data: ${mergedUrl}`);

      const mergedResponse = await fetch(mergedUrl);
      
      if (!mergedResponse.ok) {
        throw new Error(`HTTP ${mergedResponse.status}: ${mergedResponse.statusText}`);
      }

      const mergedData = await mergedResponse.json();
      console.error(`[${SERVICE_NAME}] Successfully fetched data from ${env}`);
      
      return mergedData;
    } catch (error) {
      console.error(`[${SERVICE_NAME}] Failed to fetch from ${env}:`, error);
      lastError = error as Error;
      continue;
    }
  }

  throw new Error(`All Translator environments failed. Last error: ${lastError?.message}`);
}

// =============================================================================
// PHRASE GENERATION (RECOMBOBULATION)
// =============================================================================
function recombobulation(edgeData: EdgeData): string {
  const objectNode_name = edgeData.edge_objectNode_name;
  const subjectNode_name = edgeData.edge_subjectNode_name;
  let direction = '';
  let object_aspect = '';
  let subject_aspect = '';
  let object_of = '';

  // SET VARIABLE TO HOLD THE PREDICATE TO BE USED IN THE PHRASE
  let predicate_used = edgeData.predicate.replace('biolink:', '');

  // GET REPLACE THE PREDICATE WITH A QUALIFIED IF EXISTS
  if (edgeData.qualified_predicate !== '') {
    predicate_used = edgeData.qualified_predicate.replace('biolink:', '');
  }

  // GET THE ASPECT THAT IS REFERRED TO FOR THE OBJECT
  if (edgeData.object_aspect_qualifier !== '') {
    object_aspect = edgeData.object_aspect_qualifier;
    if (object_aspect === 'abundance') {
      object_aspect = 'the abundance';
    }
  }

  // GET THE ASPECT THAT IS REFERRED TO FOR THE SUBJECT
  if (edgeData.subject_aspect_qualifier !== '') {
    subject_aspect = edgeData.subject_aspect_qualifier;
    if (subject_aspect === 'abundance') {
      subject_aspect = 'the abundance';
    }
  }

  // IF THERE IS AN object_direction_qualifier THEN THE PREDICATE READS BETTER IF THERE IS A QUALIFIED PREDICATE CAUSES
  if (edgeData.object_direction_qualifier !== '') {
    direction = edgeData.object_direction_qualifier;
    predicate_used = 'causes';
    if (edgeData.object_direction_qualifier === 'downregulated') {
      predicate_used = 'downregulated';
    }
  }

  // ADD THE 'OF' TO MAKE THE PHRASE BETTER
  if (edgeData.object_aspect_qualifier !== '') {
    object_of = 'of';
  }

  // CHANGE THE TENSE OF qualified_predicate
  if (edgeData.qualified_predicate === '' && edgeData.object_direction_qualifier !== '') {
    direction = direction.slice(0, -1) + 's';
  }

  // DEFAULT PHRASE
  let infered_phrase = "DEFAULT PHRASE";
  
  // PUT THE PHRASE TOGETHER
  if (edgeData.qualified_predicate === "causes") {
    infered_phrase = `${subjectNode_name} ${predicate_used} ${direction} ${object_aspect} ${object_of} ${objectNode_name}`;
  } else if (edgeData.qualified_predicate === "caused_by") {
    infered_phrase = `${edgeData.subject_direction_qualifier} ${edgeData.subject_aspect_qualifier} of ${objectNode_name} is ${edgeData.qualified_predicate} ${subjectNode_name}`;
  } else {
    // Fallback for other predicates
    infered_phrase = `${subjectNode_name} ${predicate_used} ${objectNode_name}`;
  }

  // THE PROCESS ABOVE CAN RESULT IN DOUBLE SPACES - THIS REMOVES THEM
  infered_phrase = infered_phrase.replace(/\s+/g, ' ');
  infered_phrase = infered_phrase.replace(/_/g, ' ');
  infered_phrase = infered_phrase.trim();

  return infered_phrase;
}

// =============================================================================
// DATA PROCESSING PIPELINE
// =============================================================================
async function processEdge(
  edgeId: string,
  nodes: Record<string, TranslatorNode>,
  edges: Record<string, TranslatorEdge>,
  auxiliaryGraphs: Record<string, AuxiliaryGraph>,
  processedNodes: Set<string>,
  createdNodes: GraphModeNode[],
  createdEdges: GraphModeEdge[],
  databaseContext: any
): Promise<void> {
  try {
    // Get edge from edges dictionary
    const edge = edges[edgeId];
    if (!edge) {
      console.error(`[${SERVICE_NAME}] Edge ${edgeId} not found in edges dictionary`);
      return;
    }

    const edge_objectNode_id = edge.object;
    const edge_subjectNode_id = edge.subject;

    // Get node information
    let edge_subjectNode_name = 'not provided';
    let edge_subjectNode_cats: string[] = ['not provided'];
    let edge_objectNode_name = 'not provided';
    let edge_objectNode_cats: string[] = ['not provided'];

    if (nodes[edge_subjectNode_id]) {
      edge_subjectNode_name = nodes[edge_subjectNode_id].name || 'not provided';
      edge_subjectNode_cats = nodes[edge_subjectNode_id].categories || ['not provided'];
    } else {
      console.error(`[${SERVICE_NAME}] Node id ${edge_subjectNode_id} not found in nodes`);
    }

    if (nodes[edge_objectNode_id]) {
      edge_objectNode_name = nodes[edge_objectNode_id].name || 'not provided';
      edge_objectNode_cats = nodes[edge_objectNode_id].categories || ['not provided'];
    } else {
      console.error(`[${SERVICE_NAME}] Node id ${edge_objectNode_id} not found in nodes`);
    }

    const qualifiers = edge.qualifiers || [];

    // INITIALIZE QUALIFIED PREDICATE DATA
    let qualified_predicate = '';
    let causal_mechanism_qualifier = '';
    let object_direction_qualifier = '';
    let subject_direction_qualifier = '';
    let subject_form_or_variant_qualifier = '';
    let object_form_or_variant_qualifier = '';
    let object_aspect_qualifier = '';
    let subject_aspect_qualifier = '';

    // Parse qualifiers
    if (qualifiers && qualifiers.length > 0) {
      for (const qualifier of qualifiers) {
        const qualifierType = qualifier.qualifier_type_id.split(':').pop() || '';
        
        switch (qualifierType) {
          case 'qualified_predicate':
            qualified_predicate = qualifier.qualifier_value.split(':').pop() || '';
            break;
          case 'causal_mechanism_qualifier':
            causal_mechanism_qualifier = qualifier.qualifier_value.split(':').pop() || '';
            break;
          case 'object_direction_qualifier':
            object_direction_qualifier = qualifier.qualifier_value.split(':').pop() || '';
            break;
          case 'subject_direction_qualifier':
            subject_direction_qualifier = qualifier.qualifier_value.split(':').pop() || '';
            break;
          case 'subject_form_or_variant_qualifier':
            subject_form_or_variant_qualifier = qualifier.qualifier_value.split(':').pop() || '';
            break;
          case 'object_form_or_variant_qualifier':
            object_form_or_variant_qualifier = qualifier.qualifier_value.split(':').pop() || '';
            break;
          case 'object_aspect_qualifier':
            object_aspect_qualifier = qualifier.qualifier_value.split(':').pop() || '';
            break;
          case 'subject_aspect_qualifier':
            subject_aspect_qualifier = qualifier.qualifier_value.split(':').pop() || '';
            break;
        }
      }
    }

    // Build edge data
    const edgeData: EdgeData = {
      edge_id: edgeId,
      edge_object: edge.object,
      edge_objectNode_name,
      edge_objectNode_cats,
      edge_objectNode_cat: edge_objectNode_cats[0],
      edge_subject: edge.subject,
      edge_subjectNode_name,
      edge_subjectNode_cats,
      edge_subjectNode_cat: edge_subjectNode_cats[0],
      predicate: edge.predicate,
      qualifiers,
      qualified_predicate,
      causal_mechanism_qualifier,
      subject_direction_qualifier,
      subject_aspect_qualifier,
      subject_form_or_variant_qualifier,
      object_direction_qualifier,
      object_aspect_qualifier,
      object_form_or_variant_qualifier,
      publications: [],
      phrase: '',
      edge_type: 'one-hop'
    };

    // Generate phrase
    edgeData.phrase = recombobulation(edgeData);

    // GET SOURCE INFORMATION (primary_source, aggregators)
    const sources = edge.sources || [];
    let agg_counter = 1;
    
    for (const source of sources) {
      const role = source.resource_role;
      const resource_id = source.resource_id;
      
      if (role === "primary_knowledge_source") {
        edgeData.primary_source = resource_id;
      } else if (role === "aggregator_knowledge_source" && agg_counter <= 2) {
        if (agg_counter === 1) {
          edgeData.agg1 = resource_id;
        } else if (agg_counter === 2) {
          edgeData.agg2 = resource_id;
        }
        agg_counter++;
      }
    }

    // Extract publications and check for support graphs
    const attributes = edge.attributes || [];
    let has_supportgraphs = false;
    const support_graphs_ids: string[] = [];

    for (const attribute of attributes) {
      if (attribute.attribute_type_id === "biolink:support_graphs") {
        edgeData.edge_type = 'creative';
        has_supportgraphs = true;
        support_graphs_ids.push(...(Array.isArray(attribute.value) ? attribute.value : [attribute.value]));
      }
      if (attribute.attribute_type_id === "biolink:publications") {
        edgeData.publications = Array.isArray(attribute.value) ? attribute.value : [attribute.value];
      }
    }

    // Create nodes for both source and target (CRITICAL!)
    if (!processedNodes.has(edge_subjectNode_id)) {
      const subjectNode = await createNodeInDatabase(
        edge_subjectNode_id,
        edge_subjectNode_name,
        edge_subjectNode_cats,
        nodes[edge_subjectNode_id],
        databaseContext
      );
      if (subjectNode) {
        createdNodes.push(subjectNode);
        processedNodes.add(edge_subjectNode_id);
      }
    }

    if (!processedNodes.has(edge_objectNode_id)) {
      const objectNode = await createNodeInDatabase(
        edge_objectNode_id,
        edge_objectNode_name,
        edge_objectNode_cats,
        nodes[edge_objectNode_id],
        databaseContext
      );
      if (objectNode) {
        createdNodes.push(objectNode);
        processedNodes.add(edge_objectNode_id);
      }
    }

    // Create edge in database
    const graphModeEdge = await createEdgeInDatabase(edgeData, databaseContext);
    if (graphModeEdge) {
      createdEdges.push(graphModeEdge);
    }

    // Process support graphs recursively
    if (has_supportgraphs && support_graphs_ids.length > 0) {
      for (const support_graph_id of support_graphs_ids) {
        try {
          const aux_graph = auxiliaryGraphs[support_graph_id];
          if (aux_graph && aux_graph.edges) {
            const support_edges = aux_graph.edges;
            for (const support_edge of support_edges) {
              await processEdge(
                support_edge,
                nodes,
                edges,
                auxiliaryGraphs,
                processedNodes,
                createdNodes,
                createdEdges,
                databaseContext
              );
            }
          }
        } catch (error) {
          console.error(`[${SERVICE_NAME}] Error processing support graph ${support_graph_id}:`, error);
        }
      }
    }
  } catch (error) {
    console.error(`[${SERVICE_NAME}] Error processing edge ${edgeId}:`, error);
  }
}

// =============================================================================
// NODE CREATION
// =============================================================================
async function createNodeInDatabase(
  nodeId: string,
  nodeName: string,
  nodeCategories: string[],
  originalNodeData: TranslatorNode,
  databaseContext: any
): Promise<GraphModeNode | null> {
  try {
    // Extract type from first category
    const firstCategory = nodeCategories[0] || 'biolink:NamedThing';
    const nodeType = firstCategory.includes(':') 
      ? firstCategory.split(':').pop() || 'Unknown'
      : firstCategory;

    const graphModeNode: GraphModeNode = {
      id: nodeId,
      label: nodeName,
      type: nodeType,
      data: {
        categories: nodeCategories,
        originalId: nodeId,
        source: 'translator',
        ...originalNodeData
      },
      position: { x: 0, y: 0 }
    };

    console.error(`[${SERVICE_NAME}] Creating node: ${nodeId} (${nodeName})`);

    const response = await makeAPIRequest('/nodes', databaseContext, {
      method: 'POST',
      body: JSON.stringify(graphModeNode)
    });

    return graphModeNode;
  } catch (error) {
    console.error(`[${SERVICE_NAME}] Failed to create node ${nodeId}:`, error);
    return null;
  }
}

// =============================================================================
// EDGE CREATION
// =============================================================================
async function createEdgeInDatabase(
  edgeData: EdgeData,
  databaseContext: any
): Promise<GraphModeEdge | null> {
  try {
    const graphModeEdge: GraphModeEdge = {
      source: edgeData.edge_subject,
      target: edgeData.edge_object,
      label: edgeData.predicate.replace('biolink:', ''),
      data: {
        phrase: edgeData.phrase,
        publications: edgeData.publications,
        primary_source: edgeData.primary_source,
        agg1: edgeData.agg1,
        agg2: edgeData.agg2,
        qualifiers: edgeData.qualifiers,
        source: 'translator',
        edgeType: edgeData.edge_type,
        qualified_predicate: edgeData.qualified_predicate,
        causal_mechanism_qualifier: edgeData.causal_mechanism_qualifier,
        subject_direction_qualifier: edgeData.subject_direction_qualifier,
        subject_aspect_qualifier: edgeData.subject_aspect_qualifier,
        object_direction_qualifier: edgeData.object_direction_qualifier,
        object_aspect_qualifier: edgeData.object_aspect_qualifier
      }
    };

    console.error(`[${SERVICE_NAME}] Creating edge: ${edgeData.edge_subject} -> ${edgeData.edge_object} (${edgeData.predicate})`);

    const response = await makeAPIRequest('/edges', databaseContext, {
      method: 'POST',
      body: JSON.stringify(graphModeEdge)
    });

    return graphModeEdge;
  } catch (error) {
    console.error(`[${SERVICE_NAME}] Failed to create edge ${edgeData.edge_id}:`, error);
    return null;
  }
}

// =============================================================================
// MAIN PROCESSING FUNCTION
// =============================================================================
async function processTranslatorData(
  translatorData: any,
  databaseContext: any
): Promise<{ nodes: GraphModeNode[]; edges: GraphModeEdge[] }> {
  const createdNodes: GraphModeNode[] = [];
  const createdEdges: GraphModeEdge[] = [];
  const processedNodes = new Set<string>();

  try {
    // Extract components from Translator response
    const message = translatorData.fields?.data?.message || translatorData.message;
    
    if (!message) {
      throw new Error('Invalid Translator data structure: no message found');
    }

    const results = message.results || [];
    const nodes = message.knowledge_graph?.nodes || {};
    const edges = message.knowledge_graph?.edges || {};
    const auxiliaryGraphs = message.auxiliary_graphs || {};

    console.error(`[${SERVICE_NAME}] Processing ${results.length} results`);
    console.error(`[${SERVICE_NAME}] Knowledge graph has ${Object.keys(nodes).length} nodes and ${Object.keys(edges).length} edges`);

    // Loop through results
    for (let resultIndex = 0; resultIndex < results.length; resultIndex++) {
      const result = results[resultIndex];
      console.error(`[${SERVICE_NAME}] Processing result ${resultIndex + 1}/${results.length}`);

      // Get analyses
      const analyses = result.analyses || [];

      // Go through all analyses and get edge bindings
      for (const analysis of analyses) {
        const edgeBindings = analysis.edge_bindings || {};
        
        // Check for edge bindings
        for (const edgeBindingKey of Object.keys(edgeBindings)) {
          const edgeObjects = edgeBindings[edgeBindingKey];
          
          // Get edge IDs
          for (const edgeObject of edgeObjects) {
            const edgeId = edgeObject.id;
            await processEdge(
              edgeId,
              nodes,
              edges,
              auxiliaryGraphs,
              processedNodes,
              createdNodes,
              createdEdges,
              databaseContext
            );
          }
        }
      }
    }

    console.error(`[${SERVICE_NAME}] Processing complete: ${createdNodes.length} nodes, ${createdEdges.length} edges`);

    return { nodes: createdNodes, edges: createdEdges };
  } catch (error) {
    console.error(`[${SERVICE_NAME}] Error processing Translator data:`, error);
    throw error;
  }
}

// =============================================================================
// TOOL DEFINITIONS
// =============================================================================
server.setRequestHandler(ListToolsRequestSchema, async () => {
  const tools = [
    {
      name: "fetchTranslatorGraph",
      description: "Fetch and process a Translator knowledge graph using a PK (primary key). Creates nodes and edges from Translator results including support graphs and qualifiers.",
      inputSchema: {
        type: "object",
        properties: {
          pk: {
            type: "string",
            description: "The Translator message PK (primary key) to fetch"
          },
          environment: {
            type: "string",
            enum: ["prod", "test", "CI", "dev"],
            description: "Translator environment to query (defaults to prod, with automatic fallback)"
          },
          databaseContext: {
            type: "object",
            properties: {
              conversationId: { type: "string" },
              artifactId: { type: "string" },
              apiBaseUrl: { type: "string" },
              accessToken: { type: "string" }
            },
            required: ["conversationId"]
          }
        },
        required: ["pk", "databaseContext"]
      }
    }
  ];

  return { tools };
});

// =============================================================================
// TOOL HANDLERS (REQUIRED PATTERN)
// =============================================================================
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    if (name === "fetchTranslatorGraph") {
      console.error(`[${SERVICE_NAME}] Tool called: fetchTranslatorGraph`);
      
      const queryParams = TranslatorToolArgumentsSchema.parse(args);
      const { pk, environment, databaseContext } = queryParams;

      console.error(`[${SERVICE_NAME}] PK: ${pk}`);
      console.error(`[${SERVICE_NAME}] Environment: ${environment}`);
      console.error(`[${SERVICE_NAME}] ConversationId: ${databaseContext.conversationId}`);

      // Fetch data from Translator API
      console.error(`[${SERVICE_NAME}] Fetching Translator data...`);
      const translatorData = await fetchTranslatorData(pk, environment || 'prod');

      // Process the data and create nodes/edges
      console.error(`[${SERVICE_NAME}] Processing Translator data...`);
      const result = await processTranslatorData(translatorData, databaseContext);

      const successMessage = `✅ Successfully imported Translator graph!\n\n` +
        `📊 Statistics:\n` +
        `- Created ${result.nodes.length} nodes\n` +
        `- Created ${result.edges.length} edges\n` +
        `- Source: Translator PK ${pk}\n\n` +
        `The graph has been added to your workspace and should now be visible.`;

      return {
        content: [{
          type: "text",
          text: successMessage
        }],
        refreshGraph: true
      };
    }

    throw new Error(`Unknown tool: ${name}`);
  } catch (error) {
    console.error(`[${SERVICE_NAME}] Tool execution failed:`, error);

    const errorMessage = error instanceof Error ? error.message : String(error);

    return {
      content: [{
        type: "text",
        text: `❌ Error: ${errorMessage}\n\nPlease check that the PK is valid and try again.`
      }]
    };
  }
});

// =============================================================================
// SERVER STARTUP
// =============================================================================
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`[${SERVICE_NAME}] MCP Server running on stdio`);
}

main().catch(console.error);

