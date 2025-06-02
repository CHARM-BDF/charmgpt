#!/usr/bin/env node

import fs from 'fs';

// Script to analyze existing state files and show connectivity data
function analyzeState() {
  console.log('🔍 Analyzing saved state files...');
  
  // Check for test state file
  if (fs.existsSync('medik-test-state.json')) {
    console.log('\n📄 Found test state file: medik-test-state.json');
    analyzeStateFile('medik-test-state.json');
  }
  
  // Check for MCP state file
  if (fs.existsSync('medik-query-state.json')) {
    console.log('\n📄 Found MCP state file: medik-query-state.json');
    analyzeStateFile('medik-query-state.json');
  }
  
  if (!fs.existsSync('medik-test-state.json') && !fs.existsSync('medik-query-state.json')) {
    console.log('\n❌ No state files found. Run a query first to generate data.');
  }
}

function analyzeStateFile(filename) {
  try {
    const stateData = fs.readFileSync(filename, 'utf8');
    const state = JSON.parse(stateData);
    
    console.log(`\n📊 State File Analysis: ${filename}`);
    console.log(`   ⏰ Timestamp: ${new Date(state.timestamp).toLocaleString()}`);
    console.log(`   🎯 Start entities: ${state.entities ? state.entities.join(', ') : state.startNodes ? state.startNodes.join(', ') : 'Unknown'}`);
    console.log(`   🔄 Processed: ${state.processedCount} nodes`);
    console.log(`   📦 Queue remaining: ${state.queue.length} nodes`);
    console.log(`   💾 Cached API calls: ${state.cache ? state.cache.length : state.neighborCache ? state.neighborCache.length : 0}`);
    console.log(`   🌐 Total nodes: ${state.allNodes.length}`);
    
    // Rebuild adjacency list for analysis
    const adjacencyList = new Map();
    state.adjacencyList.forEach(([key, value]) => {
      adjacencyList.set(key, new Set(value));
    });
    
    console.log(`   🔗 Total edges: ${Array.from(adjacencyList.values()).reduce((sum, set) => sum + set.size, 0) / 2}`);
    
    // Analyze connectivity
    const nodeConnections = Array.from(adjacencyList.entries())
      .map(([nodeId, neighbors]) => ({
        nodeId,
        connections: neighbors.size,
        type: getNodeType(nodeId)
      }))
      .sort((a, b) => b.connections - a.connections);
    
    // Show top 10 most connected nodes
    console.log(`\n🏆 Top 10 Most Connected Nodes:`);
    const startEntities = state.entities || state.startNodes || [];
    nodeConnections.slice(0, 10).forEach((node, index) => {
      const rank = index + 1;
      const isStart = startEntities.includes(node.nodeId);
      const marker = isStart ? '🎯' : '🔗';
      console.log(`   ${rank.toString().padStart(2)}. ${marker} ${node.nodeId.padEnd(20)} (${node.type.padEnd(12)}) - ${node.connections} connections`);
    });
    
    // Show connectivity by type
    console.log(`\n📈 Connectivity by Node Type:`);
    const typeStats = {};
    nodeConnections.forEach(node => {
      if (!typeStats[node.type]) {
        typeStats[node.type] = { count: 0, totalConnections: 0, maxConnections: 0 };
      }
      typeStats[node.type].count++;
      typeStats[node.type].totalConnections += node.connections;
      typeStats[node.type].maxConnections = Math.max(typeStats[node.type].maxConnections, node.connections);
    });
    
    Object.entries(typeStats).forEach(([type, stats]) => {
      stats.avgConnections = (stats.totalConnections / stats.count).toFixed(1);
    });
    
    Object.entries(typeStats)
      .sort((a, b) => b[1].avgConnections - a[1].avgConnections)
      .forEach(([type, stats]) => {
        console.log(`   ${type.padEnd(15)}: ${stats.count.toString().padStart(4)} nodes, avg: ${stats.avgConnections.toString().padStart(5)} connections, max: ${stats.maxConnections}`);
      });
      
    // Show highly connected UMLS concepts (these are usually the problematic ones)
    const umlsConcepts = nodeConnections.filter(node => node.type === 'UMLS Concept' && node.connections > 10);
    if (umlsConcepts.length > 0) {
      console.log(`\n⚠️  Highly Connected UMLS Concepts (>10 connections):`);
      umlsConcepts.slice(0, 15).forEach(node => {
        console.log(`   🔥 ${node.nodeId} - ${node.connections} connections`);
      });
      console.log(`   💡 These highly connected UMLS nodes are likely causing server timeouts`);
    }
    
  } catch (error) {
    console.log(`❌ Error analyzing ${filename}: ${error.message}`);
  }
}

function getNodeType(nodeId) {
  const prefix = nodeId.split(':')[0];
  switch (prefix) {
    case 'DRUGBANK': return 'Drug';
    case 'NCBIGene':
    case 'HGNC': return 'Gene';
    case 'MONDO':
    case 'HP':
    case 'DOID': return 'Disease';
    case 'UMLS': return 'UMLS Concept';
    case 'REACT': return 'Reaction';
    case 'NCIT': return 'Cancer Concept';
    default: return 'Other';
  }
}

// Run the analysis
analyzeState(); 