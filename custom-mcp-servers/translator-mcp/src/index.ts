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
import * as fs from 'fs';
import * as path from 'path';

// Environment URLs mapping (equivalent to url_dict in Python)
const URL_DICT = {
  'test': 'https://ars.test.transltr.io',
  'CI': 'https://ars.ci.transltr.io',
  'dev': 'https://ars-dev.transltr.io',
  'prod': 'https://ars-prod.transltr.io'
};

// Interfaces for Translator API response data
interface KnowledgeGraphNode {
  name?: string;
  categories?: string[];
  [key: string]: any;
}

interface KnowledgeGraphEdge {
  subject: string;
  object: string;
  predicate: string;
  sources?: Array<{
    resource_role: string;
    resource_id: string;
  }>;
  attributes?: Array<{
    attribute_type_id: string;
    value: any;
  }>;
  qualifiers?: Array<{
    qualifier_type_id: string;
    qualifier_value: string;
  }>;
  [key: string]: any;
}

interface TranslatorResult {
  rank?: number;
  sugeno?: number;
  weighted_mean?: number;
  normalized_score?: number;
  ordering_components?: {
    novelty?: number;
    confidence?: number;
    clinical_evidence?: number;
  };
  node_bindings: { [key: string]: Array<{ id: string }> };
  analyses: Array<{
    resource_id: string;
    score?: number;
    edge_bindings: { [key: string]: Array<{ id: string }> };
  }>;
}

interface TranslatorMessage {
  results: TranslatorResult[];
  knowledge_graph: {
    nodes: { [key: string]: KnowledgeGraphNode };
    edges: { [key: string]: KnowledgeGraphEdge };
  };
  auxiliary_graphs?: { [key: string]: { edges: string[] } };
}

interface ProcessedRow {
  pk: string;
  ara: string;
  result_subjectNode_name: string;
  result_subjectNode_id: string;
  result_subjectNode_cat: string;
  result_objectNode_name: string;
  result_objectNode_id: string;
  result_objectNode_cat: string;
  rank: number | string;
  sugeno_score: number | string;
  comp_confidence_score: number | string;
  comp_novelty_score: number | string;
  comp_clinical_evidence_score: number | string;
  weighted_mean_score: number | string;
  normalized_score: number | string;
  ARAX: boolean;
  ARAX_score: number;
  unsecret: boolean;
  unsecret_score: number;
  improving_agent: boolean;
  improving_agent_score: number;
  biothings_explorer: boolean;
  biothings_explorer_score: number;
  aragorn: boolean;
  aragorn_score: number;
  ARA_list: string[];
  ARA_count: number;
  result_counter: number;
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
  edge_type: string;
  qualified_predicate: string;
  causal_mechanism_qualifier: string;
  subject_direction_qualifier: string;
  subject_aspect_qualifier: string;
  subject_form_or_variant_qualifier: string;
  object_direction_qualifier: string;
  object_aspect_qualifier: string;
  object_form_or_variant_qualifier: string;
  publications: string[];
  publications_count: number;
  phrase: string;
  primary_source?: string;
  agg1?: string;
  agg2?: string;
}

// Global variables (equivalent to Python globals)
let allRows: ProcessedRow[] = [];
let edges: { [key: string]: KnowledgeGraphEdge } = {};
let nodes: { [key: string]: KnowledgeGraphNode } = {};
let auxiliaryGraphs: { [key: string]: { edges: string[] } } = {};
let processedEdgeIds: Set<string> = new Set(); // Track processed edges

// MCP logging utility
let mcpServer: Server | null = null;

function log(message: string, data?: any): void {
  const timestamp = new Date().toISOString();
  const fullMessage = data ? `${message} | Data: ${JSON.stringify(data)}` : message;
  
  if (mcpServer) {
    mcpServer.sendLoggingMessage({
      level: 'info' as LoggingLevel,
      logger: 'translator-mcp',
      data: {
        message: fullMessage,
        timestamp: timestamp,
        traceId: Math.random().toString(36).substring(2, 8),
        ...data
      }
    }).catch(() => {
      console.error(`[${timestamp}] TRANSLATOR: ${fullMessage}`);
    });
  } else {
    console.error(`[${timestamp}] TRANSLATOR: ${fullMessage}`);
  }
}

// Make API request to Translator/ARS
async function makeTranslatorRequest(url: string): Promise<any | null> {
  log(`Making API request to Translator`, { url });
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout
    
    const response = await fetch(url, { 
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Translator-MCP/1.0.0'
      }
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      log(`API request failed with status ${response.status}: ${response.statusText}`);
      return null;
    }
    
    const data = await response.json();
    log(`API request successful`);
    return data;
  } catch (error: any) {
    if (error.name === 'AbortError') {
      log(`API request timed out after 60 seconds`);
    } else {
      log(`API request error: ${error}`);
    }
    return null;
  }
}

// Equivalent to recombobulation function in Python
function recombobulation(edgeData: Partial<ProcessedRow>): string {
  const objectNodeName = edgeData.edge_objectNode_name || '';
  const subjectNodeName = edgeData.edge_subjectNode_name || '';
  let direction = '';
  let objectAspect = '';
  let subjectAspect = '';
  let objectOf = '';
  
  // Set variable to hold the predicate to be used in the phrase
  let predicateUsed = (edgeData.predicate || '').replace('biolink:', '');
  
  // Replace the predicate with a qualified if exists
  if (edgeData.qualified_predicate) {
    predicateUsed = edgeData.qualified_predicate.replace('biolink:', '');
  }
  
  // Get the aspect that is referred to for the object
  if (edgeData.object_aspect_qualifier) {
    objectAspect = edgeData.object_aspect_qualifier;
    if (objectAspect === 'abundance') {
      objectAspect = 'the abundance';
    }
  }
  
  // Get the aspect that is referred to for the subject
  if (edgeData.subject_aspect_qualifier) {
    subjectAspect = edgeData.subject_aspect_qualifier;
    if (subjectAspect === 'abundance') {
      subjectAspect = 'the abundance';
    }
  }
  
  // If there is an object_direction_qualifier then the predicate reads better if there is a qualified predicate causes
  if (edgeData.object_direction_qualifier) {
    direction = edgeData.object_direction_qualifier;
    predicateUsed = 'causes';
    if (edgeData.object_direction_qualifier === 'downregulated') {
      predicateUsed = 'downregulated';
    }
  }
  
  // Add the 'of' to make the phrase better
  if (edgeData.object_aspect_qualifier) {
    objectOf = 'of';
  }
  
  // Default phrase
  let inferredPhrase = "DEFAULT PHRASE";
  
  // Put the phrase together
  if (edgeData.qualified_predicate === "causes") {
    inferredPhrase = `${subjectNodeName} ${predicateUsed} ${direction} ${objectAspect} ${objectOf} ${objectNodeName}`;
  } else if (edgeData.qualified_predicate === "caused_by") {
    inferredPhrase = `${edgeData.subject_direction_qualifier || ''} ${edgeData.subject_aspect_qualifier || ''} of ${objectNodeName} is ${edgeData.qualified_predicate} ${subjectNodeName}`;
  } else {
    inferredPhrase = `${subjectNodeName} ${predicateUsed} ${objectNodeName}`;
  }
  
  // Remove double spaces and underscores
  inferredPhrase = inferredPhrase.replace(/ +/g, ' ').replace(/_/g, ' ').trim();
  
  return inferredPhrase;
}

// Equivalent to get_edge function in Python
function getEdge(rowResultData: Partial<ProcessedRow>, edgeId: string): void {
  log(`Processing edge: ${edgeId}`);
  
  try {
    const edge = edges[edgeId];
    if (!edge) {
      log(`KeyError: The key ${edgeId} was not found in the 'edges' dictionary`);
      return;
    }
    
    // Mark this edge as processed
    processedEdgeIds.add(edgeId);
    
    const edgeObjectNodeId = edge.object;
    const edgeSubjectNodeId = edge.subject;
    
    // Get node information
    const edgeSubjectNode = nodes[edgeSubjectNodeId];
    const edgeObjectNode = nodes[edgeObjectNodeId];
    
    const edgeSubjectNodeName = edgeSubjectNode?.name || 'not provided';
    const edgeSubjectNodeCats = edgeSubjectNode?.categories || ['not provided'];
    const edgeObjectNodeName = edgeObjectNode?.name || 'not provided';
    const edgeObjectNodeCats = edgeObjectNode?.categories || ['not provided'];
    
    // Initialize qualified predicate data
    let qualifiedPredicate = '';
    let causalMechanismQualifier = '';
    let objectDirectionQualifier = '';
    let subjectDirectionQualifier = '';
    let subjectFormOrVariantQualifier = '';
    let objectFormOrVariantQualifier = '';
    let objectAspectQualifier = '';
    let subjectAspectQualifier = '';
    
    // Process qualifiers
    const qualifiers = edge.qualifiers || [];
    for (const qualifier of qualifiers) {
      const qualifierType = qualifier.qualifier_type_id.split(':').pop();
      const qualifierValue = qualifier.qualifier_value.split(':').pop();
      
      switch (qualifierType) {
        case 'qualified_predicate':
          qualifiedPredicate = qualifierValue || '';
          break;
        case 'causal_mechanism_qualifier':
          causalMechanismQualifier = qualifierValue || '';
          break;
        case 'object_direction_qualifier':
          objectDirectionQualifier = qualifierValue || '';
          break;
        case 'subject_direction_qualifier':
          subjectDirectionQualifier = qualifierValue || '';
          break;
        case 'subject_form_or_variant_qualifier':
          subjectFormOrVariantQualifier = qualifierValue || '';
          break;
        case 'object_form_or_variant_qualifier':
          objectFormOrVariantQualifier = qualifierValue || '';
          break;
        case 'object_aspect_qualifier':
          objectAspectQualifier = qualifierValue || '';
          break;
        case 'subject_aspect_qualifier':
          subjectAspectQualifier = qualifierValue || '';
          break;
      }
    }
    
    const edgeData: Partial<ProcessedRow> = {
      edge_id: edgeId,
      edge_object: edge.object,
      edge_objectNode_name: edgeObjectNodeName,
      edge_objectNode_cats: edgeObjectNodeCats,
      edge_objectNode_cat: edgeObjectNodeCats[0],
      edge_subject: edge.subject,
      edge_subjectNode_name: edgeSubjectNodeName,
      edge_subjectNode_cats: edgeSubjectNodeCats,
      edge_subjectNode_cat: edgeSubjectNodeCats[0],
      predicate: edge.predicate,
      edge_type: 'one-hop',
      qualified_predicate: qualifiedPredicate,
      causal_mechanism_qualifier: causalMechanismQualifier,
      subject_direction_qualifier: subjectDirectionQualifier,
      subject_aspect_qualifier: subjectAspectQualifier,
      subject_form_or_variant_qualifier: subjectFormOrVariantQualifier,
      object_direction_qualifier: objectDirectionQualifier,
      object_aspect_qualifier: objectAspectQualifier,
      object_form_or_variant_qualifier: objectFormOrVariantQualifier,
      publications: []
    };
    
    // Get phrase
    edgeData.phrase = recombobulation(edgeData);
    
    // Get source information
    let aggCounter = 1;
    const sources = edge.sources || [];
    
    for (const source of sources) {
      const role = source.resource_role;
      const resourceId = source.resource_id;
      
      if (role === "primary_knowledge_source") {
        edgeData.primary_source = resourceId;
      } else if (role === "aggregator_knowledge_source" && aggCounter <= 2) {
        if (aggCounter === 1) edgeData.agg1 = resourceId;
        if (aggCounter === 2) edgeData.agg2 = resourceId;
        aggCounter++;
      }
    }
    
    // Process attributes
    const attributes = edge.attributes || [];
    let hasSupportGraphs = false;
    let supportGraphsIds: string[] = [];
    
    for (const attribute of attributes) {
      if (attribute.attribute_type_id === "biolink:support_graphs") {
        edgeData.edge_type = 'creative';
        hasSupportGraphs = true;
        supportGraphsIds = attribute.value;
      }
      if (attribute.attribute_type_id === "biolink:publications") {
        edgeData.publications = attribute.value;
      }
    }
    
    edgeData.publications_count = (edgeData.publications || []).length;
    
    // Combine with row result data
    const resultEdgeData = { ...rowResultData, ...edgeData } as ProcessedRow;
    allRows.push(resultEdgeData);
    
    // Process support graphs if they exist
    if (hasSupportGraphs) {
      for (const supportGraphId of supportGraphsIds) {
        try {
          const auxGraph = auxiliaryGraphs[supportGraphId];
          if (auxGraph && auxGraph.edges) {
            for (const supportEdge of auxGraph.edges) {
              getEdge(rowResultData, supportEdge);
            }
          }
        } catch (error) {
          log(`Error processing support graph ${supportGraphId}: ${error}`);
        }
      }
    }
  } catch (error) {
    log(`Error processing edge ${edgeId}: ${error}`);
  }
}

// Main processing function (equivalent to run_on_click in Python)
async function processTranslatorData(pk: string, environment: string = 'prod'): Promise<ProcessedRow[]> {
  log(`Starting Translator data processing for pk: ${pk} in environment: ${environment}`);
  
  // Reset global variables
  allRows = [];
  edges = {};
  nodes = {};
  auxiliaryGraphs = {};
  processedEdgeIds = new Set(); // Reset processed edges tracking
  
  const baseUrl = URL_DICT[environment as keyof typeof URL_DICT] || URL_DICT.prod;
  
  try {
    // Fetch data from the ARS API with trace
    log(`Fetching data with trace from: ${baseUrl}/ars/api/messages/${pk}?trace=y`);
    const response = await makeTranslatorRequest(`${baseUrl}/ars/api/messages/${pk}?trace=y`);
    
    if (!response) {
      throw new Error('Failed to fetch initial data from ARS API');
    }
    
    const mergedVersion = response.merged_version;
    if (!mergedVersion) {
      throw new Error('No merged version found in response');
    }
    
    log(`Getting merged data from: ${baseUrl}/ars/api/messages/${mergedVersion}`);
    const mergedResponse = await makeTranslatorRequest(`${baseUrl}/ars/api/messages/${mergedVersion}`);
    
    if (!mergedResponse) {
      throw new Error('Failed to fetch merged data from ARS API');
    }
    
    const message: TranslatorMessage = mergedResponse.fields?.data?.message;
    if (!message) {
      throw new Error('No message data found in merged response');
    }
    
    // Extract components
    const results = message.results || [];
    nodes = message.knowledge_graph?.nodes || {};
    edges = message.knowledge_graph?.edges || {};
    auxiliaryGraphs = message.auxiliary_graphs || {};
    
    log(`Processing ${results.length} results with ${Object.keys(nodes).length} nodes and ${Object.keys(edges).length} edges`);
    
    // Process each result
    let resultCounter = 0;
    for (const result of results) {
      resultCounter++;
      
      // Get result data with defaults
      const rank = result.rank ?? 'N/A';
      const sugeno = result.sugeno ?? 'N/A';
      const weightedMean = result.weighted_mean ?? 'N/A';
      const normalizedScore = result.normalized_score ?? 'N/A';
      
      let compNovelty: number | string = 'N/A';
      let compConfidence: number | string = 'N/A';
      let compClinicalEvidence: number | string = 'N/A';
      
      if (result.ordering_components) {
        compNovelty = result.ordering_components.novelty ?? 'N/A';
        compConfidence = result.ordering_components.confidence ?? 'N/A';
        compClinicalEvidence = result.ordering_components.clinical_evidence ?? 'N/A';
      }
      
      // Get node information
      const nodeBindings = result.node_bindings;
      const nodeBindingKeys = Object.keys(nodeBindings);
      
      let nodeGroupOne = '';
      let nodeGroupTwo = '';
      let nodeGroupOneNames = '';
      let nodeGroupTwoNames = '';
      let nodeGroupOneCat: string[] = ['N/A'];
      let nodeGroupTwoCat: string[] = ['N/A'];
      
      // Process node bindings
      let nodeGroupCounter = 1;
      for (const key of nodeBindingKeys) {
        const nodeGroupArray = nodeBindings[key];
        
        for (const nodeGroup of nodeGroupArray) {
          const nodeId = nodeGroup.id;
          const node = nodes[nodeId];
          
          if (nodeGroupCounter === 1) {
            nodeGroupOne = nodeId;
            nodeGroupOneNames = node?.name || 'N/A';
            nodeGroupOneCat = node?.categories || ['N/A'];
          } else if (nodeGroupCounter === 2) {
            nodeGroupTwo = nodeId;
            nodeGroupTwoNames = node?.name || 'N/A';
            nodeGroupTwoCat = node?.categories || ['N/A'];
          }
        }
        nodeGroupCounter++;
      }
      
      // Initialize ARA flags
      let improvingAgent = false;
      let improvingAgentScore = -0.0001;
      let ARAX = false;
      let ARAxScore = -0.0001;
      let unsecret = false;
      let unsecretScore = -0.0001;
      let biothingsExplorer = false;
      let biothingsExplorerScore = -0.0001;
      let aragorn = false;
      let aragornScore = -0.0001;
      
      const aras: string[] = [];
      
      // Process analyses
      const analyses = result.analyses || [];
      let ara = '';
      
      for (const analysis of analyses) {
        ara = analysis.resource_id;
        const score = analysis.score || -0.0001;
        
        switch (analysis.resource_id) {
          case "infores:improving-agent":
            aras.push("infores:improving-agent");
            improvingAgent = true;
            improvingAgentScore = score;
            break;
          case "infores:rtx-kg2":
            aras.push("infores:ARAX_rtx-kg2");
            ARAX = true;
            ARAxScore = score;
            break;
          case "infores:biothings-explorer":
            aras.push("infores:biothings-explorer");
            biothingsExplorer = true;
            biothingsExplorerScore = score;
            break;
          case "infores:unsecret-agent":
            aras.push("infores:unsecret-agent");
            unsecret = true;
            unsecretScore = score;
            break;
          case "infores:aragorn":
            aras.push("infores:aragorn");
            aragorn = true;
            aragornScore = score;
            break;
          default:
            aras.push(analysis.resource_id);
        }
      }
      
      // Create row result data
      const rowResultData: Partial<ProcessedRow> = {
        pk,
        ara,
        result_subjectNode_name: nodeGroupTwoNames,
        result_subjectNode_id: nodeGroupTwo,
        result_subjectNode_cat: nodeGroupTwoCat[0],
        result_objectNode_name: nodeGroupOneNames,
        result_objectNode_id: nodeGroupOne,
        result_objectNode_cat: nodeGroupOneCat[0],
        rank: typeof rank === 'number' ? Math.round(rank * 1000) / 1000 : rank,
        sugeno_score: typeof sugeno === 'number' ? Math.round(sugeno * 1000) / 1000 : sugeno,
        comp_confidence_score: typeof compConfidence === 'number' ? Math.round(compConfidence * 1000) / 1000 : compConfidence,
        comp_novelty_score: typeof compNovelty === 'number' ? Math.round(compNovelty * 1000) / 1000 : compNovelty,
        comp_clinical_evidence_score: typeof compClinicalEvidence === 'number' ? Math.round(compClinicalEvidence * 1000) / 1000 : compClinicalEvidence,
        weighted_mean_score: typeof weightedMean === 'number' ? Math.round(weightedMean * 1000) / 1000 : weightedMean,
        normalized_score: typeof normalizedScore === 'number' ? Math.round(normalizedScore * 1000) / 1000 : normalizedScore,
        ARAX,
        ARAX_score: Math.round(ARAxScore * 1000) / 1000,
        unsecret,
        unsecret_score: Math.round(unsecretScore * 1000) / 1000,
        improving_agent: improvingAgent,
        improving_agent_score: Math.round(improvingAgentScore * 1000) / 1000,
        biothings_explorer: biothingsExplorer,
        biothings_explorer_score: Math.round(biothingsExplorerScore * 1000) / 1000,
        aragorn,
        aragorn_score: Math.round(aragornScore * 1000) / 1000,
        ARA_list: aras,
        ARA_count: aras.length,
        result_counter: resultCounter
      };
      
      // Process edge bindings for each analysis
      for (const analysis of analyses) {
        const edgeBindings = analysis.edge_bindings;
        const edgeBindingKeys = Object.keys(edgeBindings);
        
        for (const edgeBindingKey of edgeBindingKeys) {
          const edgeObjects = edgeBindings[edgeBindingKey];
          
          for (const edgeObject of edgeObjects) {
            const edgeId = edgeObject.id;
            getEdge(rowResultData, edgeId);
          }
        }
      }
    }
    
    log(`Processed ${allRows.length} result-specific edges from ${results.length} results`);
    
    // Now process ALL remaining edges in the knowledge graph for complete coverage
    const totalEdges = Object.keys(edges).length;
    const remainingEdges = totalEdges - processedEdgeIds.size;
    log(`Processing remaining ${remainingEdges} edges from knowledge graph for complete coverage...`);
    
    let additionalEdgeCounter = 0;
    for (const [edgeId, edge] of Object.entries(edges)) {
      if (!processedEdgeIds.has(edgeId)) {
        additionalEdgeCounter++;
        
        // Create background knowledge row data
        const backgroundRowData: Partial<ProcessedRow> = {
          pk,
          ara: 'knowledge-graph-background',
          result_subjectNode_name: nodes[edge.subject]?.name || edge.subject,
          result_subjectNode_id: edge.subject,
          result_subjectNode_cat: (nodes[edge.subject]?.categories || ['N/A'])[0],
          result_objectNode_name: nodes[edge.object]?.name || edge.object,
          result_objectNode_id: edge.object,
          result_objectNode_cat: (nodes[edge.object]?.categories || ['N/A'])[0],
          rank: 'N/A',
          sugeno_score: 'N/A',
          comp_confidence_score: 'N/A',
          comp_novelty_score: 'N/A',
          comp_clinical_evidence_score: 'N/A',
          weighted_mean_score: 'N/A',
          normalized_score: 'N/A',
          ARAX: false,
          ARAX_score: 0,
          unsecret: false,
          unsecret_score: 0,
          improving_agent: false,
          improving_agent_score: 0,
          biothings_explorer: false,
          biothings_explorer_score: 0,
          aragorn: false,
          aragorn_score: 0,
          ARA_list: ['knowledge-graph-background'],
          ARA_count: 1,
          result_counter: results.length + additionalEdgeCounter
        };
        
        // Process this background edge
        getEdge(backgroundRowData, edgeId);
      }
    }
    
    log(`Processing complete. Generated ${allRows.length} total rows:`);
    log(`- ${allRows.filter(row => row.ara !== 'knowledge-graph-background').length} result-referenced edges`);
    log(`- ${allRows.filter(row => row.ara === 'knowledge-graph-background').length} background knowledge edges`);
    
    return allRows;
    
  } catch (error) {
    log(`Error processing Translator data: ${error}`);
    throw error;
  }
}

// Simple CSV writer using built-in fs
function escapeCSVField(field: any): string {
  const str = String(field || '');
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

// Save data to CSV file
async function saveToCSV(data: ProcessedRow[], filename: string): Promise<string> {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const csvFilename = `${filename}_${timestamp}.csv`;
    const csvPath = path.join(process.cwd(), csvFilename);
    
    if (data.length === 0) {
      log('No data to save to CSV');
      return csvPath;
    }
    
    // Define CSV headers
    const headers = [
      'PK', 'ARA', 'Subject Node Name', 'Subject Node ID', 'Subject Node Category',
      'Object Node Name', 'Object Node ID', 'Object Node Category', 'Rank',
      'Sugeno Score', 'Confidence Score', 'Novelty Score', 'Clinical Evidence Score',
      'Weighted Mean Score', 'Normalized Score', 'ARAX', 'ARAX Score',
      'Unsecret', 'Unsecret Score', 'Improving Agent', 'Improving Agent Score',
      'BioThings Explorer', 'BioThings Explorer Score', 'Aragorn', 'Aragorn Score',
      'ARA Count', 'Result Counter', 'Edge ID', 'Edge Object', 'Edge Object Node Name',
      'Edge Object Node Category', 'Edge Subject', 'Edge Subject Node Name',
      'Edge Subject Node Category', 'Predicate', 'Edge Type', 'Qualified Predicate',
      'Human Readable Phrase', 'Publications Count', 'Primary Source', 'Aggregator 1', 'Aggregator 2'
    ];
    
    // Build CSV content
    let csvContent = headers.map(escapeCSVField).join(',') + '\n';
    
    for (const row of data) {
      const values = [
        row.pk, row.ara, row.result_subjectNode_name, row.result_subjectNode_id,
        row.result_subjectNode_cat, row.result_objectNode_name, row.result_objectNode_id,
        row.result_objectNode_cat, row.rank, row.sugeno_score, row.comp_confidence_score,
        row.comp_novelty_score, row.comp_clinical_evidence_score, row.weighted_mean_score,
        row.normalized_score, row.ARAX, row.ARAX_score, row.unsecret, row.unsecret_score,
        row.improving_agent, row.improving_agent_score, row.biothings_explorer,
        row.biothings_explorer_score, row.aragorn, row.aragorn_score, row.ARA_count,
        row.result_counter, row.edge_id, row.edge_object, row.edge_objectNode_name,
        row.edge_objectNode_cat, row.edge_subject, row.edge_subjectNode_name,
        row.edge_subjectNode_cat, row.predicate, row.edge_type, row.qualified_predicate,
        row.phrase, row.publications_count, row.primary_source, row.agg1, row.agg2
      ];
      
      csvContent += values.map(escapeCSVField).join(',') + '\n';
    }
    
    // Write to file
    fs.writeFileSync(csvPath, csvContent, 'utf8');
    log(`CSV file saved: ${csvPath}`);
    return csvPath;
    
  } catch (error) {
    log(`Error saving CSV: ${error}`);
    throw error;
  }
}

// Interfaces for knowledge graph format (compatible with medik-mcp)
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

interface TranslatorKnowledgeGraph {
  nodes: GraphNode[];
  links: GraphLink[];
  filteredCount: number;
  filteredNodeCount: number;
}

// Entity type classification based on CURIE prefix (compatible with medik-mcp)
function getEntityTypeFromCurie(curie: string): { type: string; group: number } {
  const prefix = curie.split(':')[0];
  
  switch (prefix) {
    case 'DRUGBANK':
    case 'CHEBI':
    case 'PUBCHEM.COMPOUND':
      return { type: 'Drug/Chemical', group: 1 };
    case 'NCBIGene':
    case 'HGNC':
    case 'ENSEMBL':
      return { type: 'Gene', group: 2 };
    case 'MONDO':
    case 'HP':
    case 'DOID':
    case 'UMLS':
      return { type: 'Disease/Phenotype', group: 3 };
    case 'GO':
      return { type: 'Biological Process', group: 4 };
    case 'REACT':
      return { type: 'Pathway', group: 5 };
    case 'NCIT':
      return { type: 'Cancer Concept', group: 6 };
    case 'UniProtKB':
      return { type: 'Protein', group: 7 };
    default:
      return { type: 'Other', group: 8 };
  }
}

// Convert translator processed data to knowledge graph format
function createTranslatorKnowledgeGraph(processedData: ProcessedRow[], queryPk: string): TranslatorKnowledgeGraph {
  log(`Creating knowledge graph from ${processedData.length} processed relationships`);
  
  const nodeMap = new Map<string, GraphNode>();
  const linkMap = new Map<string, GraphLink>();
  
  // Process each relationship to build nodes and links
  for (const row of processedData) {
    // Create subject node
    if (!nodeMap.has(row.result_subjectNode_id)) {
      const entityInfo = getEntityTypeFromCurie(row.result_subjectNode_id);
      nodeMap.set(row.result_subjectNode_id, {
        id: row.result_subjectNode_id,
        name: row.result_subjectNode_name || row.result_subjectNode_id,
        entityType: entityInfo.type,
        group: entityInfo.group,
        isStartingNode: false, // Will be updated later if needed
        val: 10, // Base size, will be adjusted based on connections
        connections: 0
      });
    }
    
    // Create object node
    if (!nodeMap.has(row.result_objectNode_id)) {
      const entityInfo = getEntityTypeFromCurie(row.result_objectNode_id);
      nodeMap.set(row.result_objectNode_id, {
        id: row.result_objectNode_id,
        name: row.result_objectNode_name || row.result_objectNode_id,
        entityType: entityInfo.type,
        group: entityInfo.group,
        isStartingNode: false, // Will be updated later if needed
        val: 10, // Base size, will be adjusted based on connections
        connections: 0
      });
    }
    
    // Create link (use edge_id as unique key, fallback to source-target combination)
    const linkKey = row.edge_id || `${row.result_subjectNode_id}-${row.result_objectNode_id}`;
    if (!linkMap.has(linkKey)) {
      // Convert predicate to human-readable label
      const label = row.qualified_predicate || 
                   row.predicate.replace('biolink:', '').replace(/_/g, ' ') || 
                   'related to';
      
      // Calculate link value based on scores (normalized to 1-10 range)
      let linkValue = 1;
      if (typeof row.normalized_score === 'number') {
        linkValue = Math.max(1, Math.min(10, row.normalized_score / 10));
      }
      
      linkMap.set(linkKey, {
        source: row.result_subjectNode_id,
        target: row.result_objectNode_id,
        label: label,
        value: linkValue,
        evidence: row.publications || []
      });
      
      // Increment connection counts
      const sourceNode = nodeMap.get(row.result_subjectNode_id)!;
      const targetNode = nodeMap.get(row.result_objectNode_id)!;
      sourceNode.connections++;
      targetNode.connections++;
    }
  }
  
  // Adjust node sizes based on connection counts (5-25 range)
  const nodes = Array.from(nodeMap.values());
  nodes.forEach(node => {
    node.val = Math.min(25, Math.max(5, 5 + node.connections * 2));
  });
  
  const links = Array.from(linkMap.values());
  
  log(`Knowledge graph created: ${nodes.length} nodes, ${links.length} links`);
  
  return {
    nodes,
    links,
    filteredCount: 0, // Could track filtered relationships if needed
    filteredNodeCount: 0 // Could track filtered nodes if needed
  };
}

// Create the MCP server
const server = new Server({
  name: 'translator-mcp',
  version: '1.0.0',
}, {
  capabilities: {
    tools: {},
    logging: {},
  },
});

// Set the global server reference
mcpServer = server;
log("✅ Translator MCP server created and reference assigned");

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async (): Promise<{ tools: Tool[] }> => {
  log('Tools list requested');
  
  return {
    tools: [
      {
        name: 'process-translator-query',
        description: 'Process a Translator/ARS query by PK (primary key) and return structured biomedical relationship data',
        inputSchema: {
          type: 'object',
          properties: {
            pk: {
              type: 'string',
              description: 'The primary key (PK) of the Translator query to process (e.g., "992cc304-b1cd-4e9d-b317-f65effe150e1")',
            },
            environment: {
              type: 'string',
              enum: ['test', 'CI', 'dev', 'prod'],
              description: 'The Translator environment to query (default: prod)',
              default: 'prod'
            },
            save_csv: {
              type: 'boolean',
              description: 'Whether to save results to a CSV file (default: true)',
              default: true
            },
            filename_prefix: {
              type: 'string',
              description: 'Prefix for the output filename (default: "translator_results")',
              default: 'translator_results'
            }
          },
          required: ['pk'],
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
    if (name === 'process-translator-query') {
      const pk = args?.pk as string;
      const environment = (args?.environment as string) || 'prod';
      const saveCsv = (args?.save_csv as boolean) ?? true;
      const filenamePrefix = (args?.filename_prefix as string) || 'translator_results';
      
      if (!pk) {
        throw new Error('PK parameter is required');
      }
      
      log(`🚨 STARTING process-translator-query for PK: ${pk} in environment: ${environment}`);
      
      // Send status update to UI
      await server.sendLoggingMessage({
        level: 'info',
        logger: 'translator-mcp',
        data: {
          message: `Starting Translator query processing for PK: ${pk}...`,
          timestamp: new Date().toISOString(),
          traceId: Math.random().toString(36).substring(2, 8)
        }
      });
      
      // Process the Translator data
      const processedData = await processTranslatorData(pk, environment);
      
      if (processedData.length === 0) {
        const message = `No results found for PK: ${pk}`;
        log(`❌ ${message}`);
        
        await server.sendLoggingMessage({
          level: 'warning',
          logger: 'translator-mcp',
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
              text: `# No Results Found\n\nNo biomedical relationships were found for PK: **${pk}**\n\nThis could mean:\n- The PK doesn't exist in the Translator/ARS system\n- The query returned no results\n- There was an API connectivity issue\n\nPlease verify the PK is correct and exists in the ${environment} environment.`
            } as TextContent
          ]
        };
      }
      
      await server.sendLoggingMessage({
        level: 'info',
        logger: 'translator-mcp',
        data: {
          message: `Found ${processedData.length} processed relationships`,
          timestamp: new Date().toISOString(),
          traceId: Math.random().toString(36).substring(2, 8)
        }
      });
      
      let csvPath = '';
      if (saveCsv) {
        try {
          csvPath = await saveToCSV(processedData, filenamePrefix);
          await server.sendLoggingMessage({
            level: 'info',
            logger: 'translator-mcp',
            data: {
              message: `CSV file saved: ${csvPath}`,
              timestamp: new Date().toISOString(),
              traceId: Math.random().toString(36).substring(2, 8)
            }
          });
        } catch (csvError) {
          log(`Warning: Could not save CSV file: ${csvError}`);
        }
      }
      
      // Create summary statistics
      const uniqueResults = new Set(processedData.map(row => row.result_counter)).size;
      const uniqueNodes = new Set([
        ...processedData.map(row => row.result_subjectNode_id),
        ...processedData.map(row => row.result_objectNode_id)
      ]).size;
      const uniquePredicates = new Set(processedData.map(row => row.predicate)).size;
      const creativeEdges = processedData.filter(row => row.edge_type === 'creative').length;
      const oneHopEdges = processedData.filter(row => row.edge_type === 'one-hop').length;
      const backgroundEdges = processedData.filter(row => row.ara === 'knowledge-graph-background').length;
      const resultReferencedEdges = processedData.filter(row => row.ara !== 'knowledge-graph-background').length;
      
      // Get all unique node names categorized
      const allNodeNames = new Set([
        ...processedData.map(row => row.result_subjectNode_name),
        ...processedData.map(row => row.result_objectNode_name)
      ]);
      const allNodeNamesArray = Array.from(allNodeNames).filter(name => name !== 'N/A').sort();
      
      // Check for specific genes of interest
      const geneNodes = allNodeNamesArray.filter(name => 
        processedData.some(row => 
          (row.result_subjectNode_name === name || row.result_objectNode_name === name) &&
          (row.result_subjectNode_cat === 'biolink:Gene' || row.result_objectNode_cat === 'biolink:Gene')
        )
      );
      
      // Check if SLC7A10 is included
      const hasSLC7A10 = allNodeNamesArray.includes('SLC7A10');
      const slc7a10Status = hasSLC7A10 ? '✅ **SLC7A10 IS INCLUDED**' : '❌ SLC7A10 not found';
      
      // Get most common target
      const objectNames = processedData.map(row => row.result_objectNode_name);
      const mostCommonObject = objectNames.reduce((acc, name) => {
        acc[name] = (acc[name] || 0) + 1;
        return acc;
      }, {} as { [key: string]: number });
      const topObject = Object.entries(mostCommonObject).sort(([,a], [,b]) => b - a)[0];
      
      log(`✅ SUCCESS: Processed ${processedData.length} relationships from ${uniqueResults} results`);
      
      const title = `Translator Query Results: ${pk}`;
      const summary = `Processed ${processedData.length} biomedical relationships including both result-specific and background knowledge.`;
      
      // Create knowledge graph for artifact
      const knowledgeGraph = createTranslatorKnowledgeGraph(processedData, pk);
      
      await server.sendLoggingMessage({
        level: 'info',
        logger: 'translator-mcp',
        data: {
          message: `Knowledge graph created: ${knowledgeGraph.nodes.length} nodes, ${knowledgeGraph.links.length} links`,
          timestamp: new Date().toISOString(),
          traceId: Math.random().toString(36).substring(2, 8)
        }
      });
      
      return {
        content: [
          {
            type: 'text',
            text: `# ${title}\n\n${summary}\n\n## Statistics\n- **Total Relationships**: ${processedData.length}\n- **Result-Referenced Edges**: ${resultReferencedEdges}\n- **Background Knowledge Edges**: ${backgroundEdges}\n- **Unique Results**: ${uniqueResults}\n- **Unique Nodes**: ${uniqueNodes}\n- **Unique Predicates**: ${uniquePredicates}\n- **Creative Edges**: ${creativeEdges}\n- **One-hop Edges**: ${oneHopEdges}\n- **Most Common Target**: ${topObject ? `${topObject[0]} (${topObject[1]} relationships)` : 'N/A'}\n- **Environment**: ${environment}\n${csvPath ? `- **CSV File**: ${csvPath}\n` : ''}\n\n## Gene Status\n${slc7a10Status}\n\n## All Included Nodes (${allNodeNamesArray.length} total)\n\n### Gene Nodes (${geneNodes.length})\n${geneNodes.slice(0, 20).map(name => `- ${name}`).join('\n')}${geneNodes.length > 20 ? `\n- ... and ${geneNodes.length - 20} more genes` : ''}\n\n### All Node Names (Sample)\n${allNodeNamesArray.slice(0, 30).map(name => `- ${name}`).join('\n')}${allNodeNamesArray.length > 30 ? `\n- ... and ${allNodeNamesArray.length - 30} more nodes` : ''}\n\n## Sample Relationships\n${processedData.slice(0, 5).map(row => `- **${row.phrase}** (${row.predicate}) [${row.ara === 'knowledge-graph-background' ? 'Background' : 'Result-Referenced'}]`).join('\n')}\n\nThe data includes both query-specific results and comprehensive background knowledge from the knowledge graph. A knowledge graph visualization is available in the attached artifact.`
          } as TextContent
        ],
        artifacts: [
          {
            type: 'application/vnd.knowledge-graph',
            title: title,
            content: JSON.stringify(knowledgeGraph)
          }
        ]
      };
    } else {
      throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error: any) {
    const errorMessage = `Error in tool ${name}: ${error}`;
    log(`❌ ${errorMessage}`);
    
    await server.sendLoggingMessage({
      level: 'error',
      logger: 'translator-mcp',
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
  
  log('🚀 Starting Translator MCP Server v1.0.0');
  log('✅ Translator MCP Server connected and ready');
  
  // Send startup confirmation
  await mcpServer!.sendLoggingMessage({
    level: 'info',
    logger: 'startup',
    data: {
      message: 'Translator MCP Server startup complete - ready to process queries',
      timestamp: new Date().toISOString(),
      traceId: Math.random().toString(36).substring(2, 8)
    }
  });
}

main().catch((error: any) => {
  log(`💥 Server startup error: ${error}`);
  process.exit(1);
}); 