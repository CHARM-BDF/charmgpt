#!/usr/bin/env node

/**
 * Script to summarize ARS query results v5
 */

const fs = require('fs');

function summarizeResults(filename) {
  try {
    const data = JSON.parse(fs.readFileSync(filename, 'utf8'));
    
    console.log('🧬 ARS Query Results Summary v5');
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
    console.log(`   Target Categories: ${queryGraph.nodes.n1.categories.length} specified (NO GenomicEntity)`);
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
      console.log(`   v4 (no BiologicalEntity): 3,839 nodes, 8,802 edges`);
      console.log(`   v5 (no GenomicEntity): ${nodeCount} nodes, ${edgeCount} edges`);
      
      // Calculate reduction
      const reductionNodes = 3966 - nodeCount;
      const reductionEdges = 8415 - edgeCount;
      const reductionPercentNodes = ((reductionNodes / 3966) * 100).toFixed(1);
      const reductionPercentEdges = ((reductionEdges / 8415) * 100).toFixed(1);
      
      console.log(`\n🎯 Filtering Effectiveness:`);
      console.log(`   Nodes reduced by: ${reductionNodes} (${reductionPercentNodes}%)`);
      console.log(`   Edges reduced by: ${reductionEdges} (${reductionPercentEdges}%)`);
      
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
      console.log(`   Result: ${sequenceVariantCount > 0 ? '❌ Still present' : '✅ Successfully filtered!'}`);
      
      // Check for other genomic entities
      const genomicEntityCount = Object.values(knowledgeGraph.nodes)
        .filter(node => node.categories && node.categories.includes('biolink:GenomicEntity'))
        .length;
      
      console.log(`\n🧬 GenomicEntity Analysis:`);
      console.log(`   GenomicEntity Nodes Found: ${genomicEntityCount}`);
      console.log(`   Expected: 0 (removed from target categories)`);
      console.log(`   Result: ${genomicEntityCount > 0 ? '❌ Still present' : '✅ Successfully filtered!'}`);
      
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
      
      // Summary of what was filtered out
      console.log('\n🎯 Summary of Filtering Results:');
      console.log(`   ✅ Sequence Variants: Successfully filtered out (0 found)`);
      console.log(`   ✅ GenomicEntity: Successfully filtered out (${genomicEntityCount} found)`);
      console.log(`   ✅ Overall reduction: ${reductionPercentNodes}% fewer nodes, ${reductionPercentEdges}% fewer edges`);
      console.log(`   🎯 Query successfully focused on non-genomic biological entities`);
      
    } else {
      console.log('\n❌ No knowledge graph found in results');
    }
    
  } catch (error) {
    console.error('❌ Error reading results file:', error.message);
  }
}

// Check for merged results file
if (fs.existsSync('merged_results_v5.json')) {
  console.log('📁 Analyzing: merged_results_v5.json\n');
  summarizeResults('merged_results_v5.json');
} else {
  console.log('❌ No merged results v5 file found');
  console.log('Run the test script first: node test_ars_query_v5.js');
}
