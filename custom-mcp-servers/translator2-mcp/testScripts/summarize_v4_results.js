#!/usr/bin/env node

/**
 * Script to summarize ARS query results v4
 */

const fs = require('fs');

function summarizeResults(filename) {
  try {
    const data = JSON.parse(fs.readFileSync(filename, 'utf8'));
    
    console.log('🧬 ARS Query Results Summary v4');
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
    console.log(`   Target Categories: ${queryGraph.nodes.n1.categories.length} specified (NO BiologicalEntity)`);
    queryGraph.nodes.n1.categories.forEach(cat => {
      console.log(`     - ${cat}`);
    });
    
    // Results summary
    const knowledgeGraph = data.fields.data.message.knowledge_graph;
    if (knowledgeGraph) {
      const nodeCount = Object.keys(knowledgeGraph.nodes || {}).length;
      const edgeCount = Object.keys(knowledgeGraph.edges || {}).length;
      
      console.log('\n📊 Results Summary:');
      console.log(`   Total Nodes: ${nodeCount}`);
      console.log(`   Total Edges: ${edgeCount}`);
      
      // Compare with previous versions
      console.log('\n📈 Comparison with Previous Versions:');
      console.log(`   v2 (no categories): 3,966 nodes, 8,415 edges`);
      console.log(`   v3 (with BiologicalEntity): 3,965 nodes, 8,845 edges`);
      console.log(`   v4 (no BiologicalEntity): ${nodeCount} nodes, ${edgeCount} edges`);
      
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
        .slice(0, 15)
        .forEach(([category, count]) => {
          const isTargetCategory = queryGraph.nodes.n1.categories.includes(category);
          const marker = isTargetCategory ? '✅' : '❌';
          console.log(`   ${marker} ${category}: ${count} nodes`);
        });
      
      // Check for sequence variants specifically
      const sequenceVariantCount = Object.values(knowledgeGraph.nodes)
        .filter(node => node.categories && node.categories.includes('biolink:SequenceVariant'))
        .length;
      
      console.log(`\n🧬 Sequence Variant Analysis:`);
      console.log(`   Sequence Variants Found: ${sequenceVariantCount}`);
      console.log(`   Expected: 0 (not in target categories)`);
      console.log(`   Result: ${sequenceVariantCount > 0 ? '❌ Still present' : '✅ Successfully filtered'}`);
      
      // Check if BiologicalEntity nodes are still present
      const biologicalEntityCount = Object.values(knowledgeGraph.nodes)
        .filter(node => node.categories && node.categories.includes('biolink:BiologicalEntity'))
        .length;
      
      console.log(`\n🧬 BiologicalEntity Analysis:`);
      console.log(`   BiologicalEntity Nodes Found: ${biologicalEntityCount}`);
      console.log(`   Expected: 0 (removed from target categories)`);
      console.log(`   Result: ${biologicalEntityCount > 0 ? '❌ Still present' : '✅ Successfully filtered'}`);
      
      // Show sample nodes by category
      console.log('\n🧬 Sample Entities by Target Category:');
      const targetCategories = queryGraph.nodes.n1.categories;
      
      targetCategories.slice(0, 5).forEach(targetCat => {
        const nodesInCategory = Object.values(knowledgeGraph.nodes)
          .filter(node => node.categories && node.categories.includes(targetCat))
          .slice(0, 3);
        
        if (nodesInCategory.length > 0) {
          console.log(`\n   ${targetCat}:`);
          nodesInCategory.forEach((node, index) => {
            const name = node.name || 'Unknown';
            console.log(`     ${index + 1}. ${name} (${node.id})`);
          });
        }
      });
      
      // Analyze edge predicates
      const edgePredicates = {};
      Object.values(knowledgeGraph.edges).forEach(edge => {
        if (edge.predicate) {
          edgePredicates[edge.predicate] = (edgePredicates[edge.predicate] || 0) + 1;
        }
      });
      
      console.log('\n🔗 Top Relationship Types:');
      Object.entries(edgePredicates)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .forEach(([predicate, count]) => {
          console.log(`   ${predicate}: ${count} relationships`);
        });
      
    } else {
      console.log('\n❌ No knowledge graph found in results');
    }
    
  } catch (error) {
    console.error('❌ Error reading results file:', error.message);
  }
}

// Check for merged results file
if (fs.existsSync('merged_results_v4.json')) {
  console.log('📁 Analyzing: merged_results_v4.json\n');
  summarizeResults('merged_results_v4.json');
} else {
  console.log('❌ No merged results v4 file found');
  console.log('Run the test script first: node test_ars_query_v4.js');
}
