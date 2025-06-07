#!/usr/bin/env node

import * as fs from 'fs';
import * as path from 'path';

// Import the interfaces and functions we need for testing
// Since we can't import from TypeScript directly, we'll recreate the necessary functions

// Interfaces for knowledge graph format (copied from main file)
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

// Entity type classification (copied from main file)
function getEntityTypeFromCurie(curie) {
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

// Knowledge graph creation function (copied from main file)
function createTranslatorKnowledgeGraph(processedData, queryPk) {
  console.log(`Creating knowledge graph from ${processedData.length} processed relationships`);
  
  const nodeMap = new Map();
  const linkMap = new Map();
  
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
        isStartingNode: false,
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
        isStartingNode: false,
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
      const sourceNode = nodeMap.get(row.result_subjectNode_id);
      const targetNode = nodeMap.get(row.result_objectNode_id);
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
  
  console.log(`Knowledge graph created: ${nodes.length} nodes, ${links.length} links`);
  
  return {
    nodes,
    links,
    filteredCount: 0,
    filteredNodeCount: 0
  };
}

// Simplified data processing function (simulate what the main server does)
function simulateProcessTranslatorData(jsonData) {
  console.log('Starting data processing simulation...');
  
  const processedRows = [];
  const processedEdgeIds = new Set(); // Track which edges we've already processed
  
  // Extract the message from the JSON structure
  const message = jsonData.fields?.data?.message;
  if (!message) {
    throw new Error('No message data found in JSON');
  }
  
  const results = message.results || [];
  const nodes = message.knowledge_graph?.nodes || {};
  const edges = message.knowledge_graph?.edges || {};
  const auxiliaryGraphs = message.auxiliary_graphs || {};
  
  console.log(`Processing ${results.length} results with ${Object.keys(nodes).length} nodes and ${Object.keys(edges).length} edges`);
  
  // First, process all result-specific edges (like the MCP server does)
  let resultCounter = 0;
  for (const result of results) {
    resultCounter++;
    
    // Get node information
    const nodeBindings = result.node_bindings;
    const nodeBindingKeys = Object.keys(nodeBindings);
    
    let nodeGroupOne = '';
    let nodeGroupTwo = '';
    let nodeGroupOneNames = '';
    let nodeGroupTwoNames = '';
    let nodeGroupOneCat = ['N/A'];
    let nodeGroupTwoCat = ['N/A'];
    
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
        }
        else if (nodeGroupCounter === 2) {
          nodeGroupTwo = nodeId;
          nodeGroupTwoNames = node?.name || 'N/A';
          nodeGroupTwoCat = node?.categories || ['N/A'];
        }
      }
      nodeGroupCounter++;
    }
    
    // Process analyses (simplified)
    const analyses = result.analyses || [];
    let ara = '';
    
    // Just get first analysis for simplicity
    if (analyses.length > 0) {
      ara = analyses[0].resource_id;
      
      // Process edge bindings for each analysis
      for (const analysis of analyses) {
        const edgeBindings = analysis.edge_bindings;
        const edgeBindingKeys = Object.keys(edgeBindings);
        
        for (const edgeBindingKey of edgeBindingKeys) {
          const edgeObjects = edgeBindings[edgeBindingKey];
          
          for (const edgeObject of edgeObjects) {
            const edgeId = edgeObject.id;
            const edge = edges[edgeId];
            
            if (edge && !processedEdgeIds.has(edgeId)) {
              processedEdgeIds.add(edgeId); // Mark as processed
              
              // Create a processed row for this edge
              const processedRow = {
                pk: 'test-pk',
                ara: ara,
                result_subjectNode_name: nodeGroupTwoNames,
                result_subjectNode_id: nodeGroupTwo,
                result_subjectNode_cat: nodeGroupTwoCat[0],
                result_objectNode_name: nodeGroupOneNames,
                result_objectNode_id: nodeGroupOne,
                result_objectNode_cat: nodeGroupOneCat[0],
                rank: result.rank || 'N/A',
                sugeno_score: result.sugeno || 'N/A',
                comp_confidence_score: result.ordering_components?.confidence || 'N/A',
                comp_novelty_score: result.ordering_components?.novelty || 'N/A',
                comp_clinical_evidence_score: result.ordering_components?.clinical_evidence || 'N/A',
                weighted_mean_score: result.weighted_mean || 'N/A',
                normalized_score: result.normalized_score || 'N/A',
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
                ARA_list: [ara],
                ARA_count: 1,
                result_counter: resultCounter,
                edge_id: edgeId,
                edge_object: edge.object,
                edge_objectNode_name: nodes[edge.object]?.name || edge.object,
                edge_objectNode_cats: nodes[edge.object]?.categories || ['N/A'],
                edge_objectNode_cat: (nodes[edge.object]?.categories || ['N/A'])[0],
                edge_subject: edge.subject,
                edge_subjectNode_name: nodes[edge.subject]?.name || edge.subject,
                edge_subjectNode_cats: nodes[edge.subject]?.categories || ['N/A'],
                edge_subjectNode_cat: (nodes[edge.subject]?.categories || ['N/A'])[0],
                predicate: edge.predicate,
                edge_type: 'result-referenced',
                qualified_predicate: '',
                causal_mechanism_qualifier: '',
                subject_direction_qualifier: '',
                subject_aspect_qualifier: '',
                subject_form_or_variant_qualifier: '',
                object_direction_qualifier: '',
                object_aspect_qualifier: '',
                object_form_or_variant_qualifier: '',
                publications: [],
                publications_count: 0,
                phrase: `${nodes[edge.subject]?.name || edge.subject} ${edge.predicate.replace('biolink:', '').replace(/_/g, ' ')} ${nodes[edge.object]?.name || edge.object}`,
                primary_source: '',
                agg1: '',
                agg2: ''
              };
              
              processedRows.push(processedRow);
            }
          }
        }
      }
    }
  }
  
  console.log(`Processed ${processedRows.length} result-specific edges from ${resultCounter} results`);
  
  // Now process ALL remaining edges in the knowledge graph
  console.log(`Processing remaining ${Object.keys(edges).length - processedEdgeIds.size} edges from knowledge graph...`);
  
  let additionalEdgeCounter = 0;
  for (const [edgeId, edgeData] of Object.entries(edges)) {
    if (!processedEdgeIds.has(edgeId)) {
      additionalEdgeCounter++;
      
      // Cast the edge to the expected type
      const edge = edgeData as any;
      
      // Create a processed row for this additional edge
      const processedRow = {
        pk: 'test-pk',
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
        result_counter: resultCounter + additionalEdgeCounter,
        edge_id: edgeId,
        edge_object: edge.object,
        edge_objectNode_name: nodes[edge.object]?.name || edge.object,
        edge_objectNode_cats: nodes[edge.object]?.categories || ['N/A'],
        edge_objectNode_cat: (nodes[edge.object]?.categories || ['N/A'])[0],
        edge_subject: edge.subject,
        edge_subjectNode_name: nodes[edge.subject]?.name || edge.subject,
        edge_subjectNode_cats: nodes[edge.subject]?.categories || ['N/A'],
        edge_subjectNode_cat: (nodes[edge.subject]?.categories || ['N/A'])[0],
        predicate: edge.predicate,
        edge_type: 'background-knowledge',
        qualified_predicate: '',
        causal_mechanism_qualifier: '',
        subject_direction_qualifier: '',
        subject_aspect_qualifier: '',
        subject_form_or_variant_qualifier: '',
        object_direction_qualifier: '',
        object_aspect_qualifier: '',
        object_form_or_variant_qualifier: '',
        publications: [],
        publications_count: 0,
        phrase: `${nodes[edge.subject]?.name || edge.subject} ${edge.predicate.replace('biolink:', '').replace(/_/g, ' ')} ${nodes[edge.object]?.name || edge.object}`,
        primary_source: '',
        agg1: '',
        agg2: ''
      };
      
      processedRows.push(processedRow);
    }
  }
  
  console.log(`Processing complete. Generated ${processedRows.length} total rows:`);
  console.log(`- ${processedRows.filter(r => r.edge_type === 'result-referenced').length} result-referenced edges`);
  console.log(`- ${processedRows.filter(r => r.edge_type === 'background-knowledge').length} background knowledge edges`);
  
  return processedRows;
}

// Main test function
async function testArtifactCreation() {
  try {
    console.log('🧪 Starting Translator Knowledge Graph Artifact Test');
    console.log('================================================');
    
    // Load the JSON file
    const jsonFilePath = '/Users/dr.crouse/Downloads/YWHAE_80ea560d-1a2d-443f-a343-15f933f7ea90_2025_6_5_16_27.json';
    console.log(`Loading JSON file: ${jsonFilePath}`);
    
    const jsonData = JSON.parse(fs.readFileSync(jsonFilePath, 'utf8'));
    console.log('✅ JSON file loaded successfully');
    
    // Process the data
    console.log('\n📊 Processing Translator data...');
    const processedData = simulateProcessTranslatorData(jsonData);
    console.log(`✅ Processed ${processedData.length} relationships`);
    
    // Create knowledge graph
    console.log('\n🕸️  Creating knowledge graph...');
    const knowledgeGraph = createTranslatorKnowledgeGraph(processedData, 'test-pk');
    console.log(`✅ Knowledge graph created with ${knowledgeGraph.nodes.length} nodes and ${knowledgeGraph.links.length} links`);
    
    // Create output files
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    
    // Save processed data
    const processedDataFile = `test-processed-data-${timestamp}.json`;
    fs.writeFileSync(processedDataFile, JSON.stringify(processedData, null, 2));
    console.log(`✅ Processed data saved to: ${processedDataFile}`);
    
    // Save knowledge graph artifact
    const artifactFile = `test-knowledge-graph-artifact-${timestamp}.json`;
    fs.writeFileSync(artifactFile, JSON.stringify(knowledgeGraph, null, 2));
    console.log(`✅ Knowledge graph artifact saved to: ${artifactFile}`);
    
    // Create summary
    const summary = {
      input_file: jsonFilePath,
      processing_timestamp: timestamp,
      statistics: {
        total_relationships: processedData.length,
        unique_nodes: knowledgeGraph.nodes.length,
        unique_links: knowledgeGraph.links.length,
        entity_types: [...new Set(knowledgeGraph.nodes.map(n => n.entityType))],
        predicates: [...new Set(knowledgeGraph.links.map(l => l.label))].slice(0, 10) // Top 10
      },
      files_created: [
        processedDataFile,
        artifactFile
      ]
    };
    
    const summaryFile = `test-summary-${timestamp}.json`;
    fs.writeFileSync(summaryFile, JSON.stringify(summary, null, 2));
    console.log(`✅ Test summary saved to: ${summaryFile}`);
    
    console.log('\n📈 Test Results Summary:');
    console.log(`- Input file: ${path.basename(jsonFilePath)}`);
    console.log(`- Relationships processed: ${processedData.length}`);
    console.log(`- Knowledge graph nodes: ${knowledgeGraph.nodes.length}`);
    console.log(`- Knowledge graph links: ${knowledgeGraph.links.length}`);
    console.log(`- Entity types found: ${summary.statistics.entity_types.join(', ')}`);
    console.log(`- Sample predicates: ${summary.statistics.predicates.slice(0, 5).join(', ')}`);
    
    console.log('\n🎉 Test completed successfully!');
    console.log('Files created:');
    console.log(`  - ${processedDataFile}`);
    console.log(`  - ${artifactFile}`);
    console.log(`  - ${summaryFile}`);
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the test
testArtifactCreation(); 