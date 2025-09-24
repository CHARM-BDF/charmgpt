#!/usr/bin/env node

/**
 * Script to summarize ARS query results v2
 */

const fs = require('fs');

function summarizeResults(filename) {
  try {
    const data = JSON.parse(fs.readFileSync(filename, 'utf8'));
    
    console.log('🧬 ARS Query Results Summary v2');
    console.log('=' .repeat(50));
    
    // Basic info
    console.log(`📋 Query ID: ${data.pk}`);
    console.log(`📊 Status: ${data.fields.status}`);
    console.log(`⏰ Timestamp: ${data.fields.timestamp}`);
    console.log(`🔄 Updated: ${data.fields.updated_at}`);
    
    // Query details
    const queryGraph = data.fields.data.message.query_graph;
    console.log('\n🔍 Query Details:');
    console.log(`   Gene: ${queryGraph.nodes.n0.name} (${queryGraph.nodes.n0.ids[0]})`);
    console.log(`   Categories: ${queryGraph.nodes.n0.categories.join(', ')}`);
    console.log(`   Target: Any related entities (no specific category)`);
    
    // Results summary
    const knowledgeGraph = data.fields.data.message.knowledge_graph;
    if (knowledgeGraph) {
      const nodeCount = Object.keys(knowledgeGraph.nodes || {}).length;
      const edgeCount = Object.keys(knowledgeGraph.edges || {}).length;
      
      console.log('\n📊 Results Summary:');
      console.log(`   Total Nodes: ${nodeCount}`);
      console.log(`   Total Edges: ${edgeCount}`);
      
      // Analyze node categories
      const nodeCategories = {};
      Object.values(knowledgeGraph.nodes).forEach(node => {
        if (node.categories) {
          node.categories.forEach(cat => {
            nodeCategories[cat] = (nodeCategories[cat] || 0) + 1;
          });
        }
      });
      
      console.log('\n🏷️  Node Categories Found:');
      Object.entries(nodeCategories)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .forEach(([category, count]) => {
          console.log(`   ${category}: ${count} nodes`);
        });
      
      // Show sample nodes
      if (nodeCount > 0) {
        console.log('\n🧬 Sample Entities Found:');
        const nodes = Object.entries(knowledgeGraph.nodes);
        nodes.slice(0, 8).forEach(([id, node], index) => {
          const name = node.name || 'Unknown';
          const primaryCategory = node.categories?.[0] || 'Unknown';
          console.log(`   ${index + 1}. ${name} (${id}) - ${primaryCategory}`);
        });
        
        if (nodeCount > 8) {
          console.log(`   ... and ${nodeCount - 8} more entities`);
        }
      }
      
      // Analyze edge predicates
      const edgePredicates = {};
      Object.values(knowledgeGraph.edges).forEach(edge => {
        if (edge.predicate) {
          edgePredicates[edge.predicate] = (edgePredicates[edge.predicate] || 0) + 1;
        }
      });
      
      console.log('\n🔗 Relationship Types Found:');
      Object.entries(edgePredicates)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .forEach(([predicate, count]) => {
          console.log(`   ${predicate}: ${count} relationships`);
        });
      
      // Show sample edges
      if (edgeCount > 0) {
        console.log('\n🔗 Sample Relationships:');
        const edges = Object.values(knowledgeGraph.edges);
        edges.slice(0, 5).forEach((edge, index) => {
          const subject = knowledgeGraph.nodes[edge.subject]?.name || edge.subject;
          const object = knowledgeGraph.nodes[edge.object]?.name || edge.object;
          const predicate = edge.predicate || 'related_to';
          console.log(`   ${index + 1}. ${subject} --[${predicate}]--> ${object}`);
        });
        
        if (edgeCount > 5) {
          console.log(`   ... and ${edgeCount - 5} more relationships`);
        }
      }
      
      // Check for specific gene information
      const geneNode = knowledgeGraph.nodes['NCBIGene:283635'];
      if (geneNode) {
        console.log('\n🧬 Gene Information:');
        console.log(`   Name: ${geneNode.name}`);
        console.log(`   Categories: ${geneNode.categories.join(', ')}`);
        if (geneNode.attributes && geneNode.attributes.length > 0) {
          console.log(`   Attributes: ${geneNode.attributes.length} found`);
        }
      }
      
    } else {
      console.log('\n❌ No knowledge graph found in results');
    }
    
  } catch (error) {
    console.error('❌ Error reading results file:', error.message);
  }
}

// Check for merged results file
if (fs.existsSync('merged_results.json')) {
  console.log('📁 Analyzing: merged_results.json\n');
  summarizeResults('merged_results.json');
} else {
  console.log('❌ No merged results file found');
  console.log('Run the test script first: node test_ars_query_v2.js');
}
