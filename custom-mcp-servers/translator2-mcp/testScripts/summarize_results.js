#!/usr/bin/env node

/**
 * Script to summarize ARS query results
 */

const fs = require('fs');
const path = require('path');

function summarizeResults(filename) {
  try {
    const data = JSON.parse(fs.readFileSync(filename, 'utf8'));
    
    console.log('🧬 ARS Query Results Summary');
    console.log('=' .repeat(50));
    
    // Basic info
    console.log(`📋 Query ID: ${data.pk}`);
    console.log(`📊 Status: ${data.fields.status}`);
    console.log(`⏰ Timestamp: ${data.fields.timestamp}`);
    console.log(`🔄 Updated: ${data.fields.updated_at}`);
    
    // Query details
    const queryGraph = data.fields.data.message.query_graph;
    console.log('\n🔍 Query Details:');
    console.log(`   Known Entity: ${queryGraph.nodes.n0.id} (${queryGraph.nodes.n0.category})`);
    console.log(`   Target Category: ${queryGraph.nodes.n1.category}`);
    console.log(`   Relationship: ${queryGraph.edges.e01.predicates.join(', ')}`);
    
    // Results summary
    const knowledgeGraph = data.fields.data.message.knowledge_graph;
    if (knowledgeGraph) {
      const nodeCount = Object.keys(knowledgeGraph.nodes || {}).length;
      const edgeCount = Object.keys(knowledgeGraph.edges || {}).length;
      
      console.log('\n📊 Results Summary:');
      console.log(`   Total Nodes: ${nodeCount}`);
      console.log(`   Total Edges: ${edgeCount}`);
      
      // Show sample nodes
      if (nodeCount > 0) {
        console.log('\n🧬 Sample Entities Found:');
        const nodes = Object.values(knowledgeGraph.nodes);
        nodes.slice(0, 5).forEach((node, index) => {
          const name = node.name || 'Unknown';
          const category = node.category || 'Unknown';
          console.log(`   ${index + 1}. ${name} (${node.id}) - ${category}`);
        });
        
        if (nodeCount > 5) {
          console.log(`   ... and ${nodeCount - 5} more entities`);
        }
      }
      
      // Show sample edges
      if (edgeCount > 0) {
        console.log('\n🔗 Sample Relationships:');
        const edges = Object.values(knowledgeGraph.edges);
        edges.slice(0, 3).forEach((edge, index) => {
          const subject = knowledgeGraph.nodes[edge.subject]?.name || edge.subject;
          const object = knowledgeGraph.nodes[edge.object]?.name || edge.object;
          const predicate = edge.predicate || 'related_to';
          console.log(`   ${index + 1}. ${subject} --[${predicate}]--> ${object}`);
        });
        
        if (edgeCount > 3) {
          console.log(`   ... and ${edgeCount - 3} more relationships`);
        }
      }
    } else {
      console.log('\n❌ No knowledge graph found in results');
    }
    
    // Check for any errors or warnings
    if (data.fields.data.message.logs) {
      const logs = data.fields.data.message.logs;
      if (logs.length > 0) {
        console.log('\n⚠️  Logs/Warnings:');
        logs.forEach((log, index) => {
          console.log(`   ${index + 1}. [${log.level}] ${log.message}`);
        });
      }
    }
    
  } catch (error) {
    console.error('❌ Error reading results file:', error.message);
  }
}

// Get the most recent results file
const files = fs.readdirSync(__dirname)
  .filter(file => file.startsWith('ars_results_') && file.endsWith('.json'))
  .sort()
  .reverse();

if (files.length > 0) {
  const latestFile = path.join(__dirname, files[0]);
  console.log(`📁 Analyzing: ${files[0]}\n`);
  summarizeResults(latestFile);
} else {
  console.log('❌ No ARS results files found');
  console.log('Run the test script first: node test_ars_query.js');
}
