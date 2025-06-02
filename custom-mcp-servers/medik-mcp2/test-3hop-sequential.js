#!/usr/bin/env node

import fs from 'fs';

// Test script for sequential 2-hop connecting paths to avoid overwhelming the server
async function testSequential2HopConnectingPaths() {
  console.log('🧪 Testing Sequential 2-Hop Connecting Paths...');
  
  // Test entities that should have connections (processed sequentially)
  const entities = [
    'HGNC:2908',  // DDIT3 (CCAAT/enhancer-binding protein homologous protein)
    'HGNC:2364',  // CEBPB (CCAAT/enhancer-binding protein beta)
    'HGNC:3354',  // EGR1 (Early growth response protein 1)
    'HGNC:11998', // TP53 (Tumor protein p53)
    'HGNC:1097',  // BRCA1 (Breast cancer 1)
    'HGNC:1101',  // BRCA2 (Breast cancer 2)
    'HGNC:3236',  // EGFR (Epidermal growth factor receptor)
    'HGNC:7989',  // MYC (MYC proto-oncogene)
    'HGNC:11892', // TNF (Tumor necrosis factor)
    'HGNC:6018'   // IL6 (Interleukin 6)
  ];
  
  console.log(`\n🎯 Target entities: ${entities.join(', ')}`);
  console.log('📝 These are well-known genes including transcription factors, tumor suppressors, and cytokines');
  console.log('🔍 Looking for connecting paths within 2 hops (1 intermediate node)');
  
  // Cache for API responses to avoid duplicate calls
  const cache = new Map();
  
  // State persistence functions
  function saveTestState(entities, allNodes, adjacencyList, visited, queue, cache, processedCount) {
    try {
      const state = {
        entities,
        allNodes: Array.from(allNodes),
        adjacencyList: Array.from(adjacencyList.entries()).map(([key, value]) => [key, Array.from(value)]),
        visited: Array.from(visited),
        queue,
        cache: Array.from(cache.entries()),
        processedCount,
        timestamp: Date.now()
      };
      
      const stateFile = 'medik-test-state.json';
      fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
      console.log(`📀 State saved (${processedCount} nodes processed)`);
    } catch (error) {
      console.log(`❌ Error saving state: ${error.message}`);
    }
  }
  
  function loadTestState() {
    try {
      const stateFile = 'medik-test-state.json';
      
      if (!fs.existsSync(stateFile)) {
        return null;
      }
      
      const stateData = fs.readFileSync(stateFile, 'utf8');
      const state = JSON.parse(stateData);
      
      // Check if state is recent (less than 24 hours old)
      const ageHours = (Date.now() - state.timestamp) / (1000 * 60 * 60);
      if (ageHours > 24) {
        console.log(`⏰ State file is ${ageHours.toFixed(1)} hours old, starting fresh`);
        return null;
      }
      
      console.log(`📀 Loaded saved state (${state.processedCount} nodes already processed)`);
      return state;
    } catch (error) {
      console.log(`❌ Error loading state: ${error.message}`);
      return null;
    }
  }
  
  function clearTestState() {
    try {
      const stateFile = 'medik-test-state.json';
      
      if (fs.existsSync(stateFile)) {
        fs.unlinkSync(stateFile);
        console.log(`🗑️  Cleared state file`);
      }
    } catch (error) {
      console.log(`❌ Error clearing state: ${error.message}`);
    }
  }
  
  // Sequential API call function with delay
  async function makeSequentialAPICall(subject, predicate, object) {
    const key = `${subject}-${predicate}-${object}`;
    if (cache.has(key)) {
      console.log(`📦 Cache hit: ${key}`);
      return cache.get(key);
    }
    
    const url = `https://medikanren.metareflective.systems/query0?subject=${encodeURIComponent(subject)}&predicate=${encodeURIComponent(predicate)}&object=${encodeURIComponent(object)}`;
    console.log(`📡 API call: ${subject || 'X'} -> ${predicate} -> ${object || 'X'}`);
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
      
      const response = await fetch(url, { 
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'MediK-Test-Sequential/1.0.0'
        }
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        console.log(`❌ API call failed: ${response.status} ${response.statusText}`);
        cache.set(key, null);
        return null;
      }
      
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        console.log(`❌ Non-JSON response, content-type: ${contentType}`);
        cache.set(key, null);
        return null;
      }
      
      const data = await response.json();
      console.log(`✅ Success: ${data.length} relationships found`);
      cache.set(key, data);
      
      // Wait 1 second before next API call to be courteous
      console.log('⏳ Waiting 1 second before next call...');
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      return data;
    } catch (error) {
      if (error.name === 'AbortError') {
        console.log('⏰ Request timed out');
      } else {
        console.log(`❌ Error: ${error.message}`);
      }
      cache.set(key, null);
      return null;
    }
  }
  
  // Collect neighbors sequentially
  async function getNeighborsSequential(nodeId) {
    // Skip CAID nodes entirely - they contain unreliable variant data
    if (nodeId.startsWith('CAID:')) {
      console.log(`⏭️  Skipping CAID node: ${nodeId}`);
      return [];
    }
    
    console.log(`\n🔍 Getting neighbors for: ${nodeId}`);
    const neighbors = [];
    
    // Query 1: nodeId -> X
    const result1 = await makeSequentialAPICall(nodeId, 'biolink:affects', '');
    if (result1) {
      for (const tuple of result1) {
        const targetId = tuple[3];
        // Filter out CAID nodes and self-references
        if (targetId && targetId !== nodeId && !targetId.startsWith('CAID:')) {
          neighbors.push(targetId);
        }
      }
    }
    
    // Query 2: X -> nodeId
    const result2 = await makeSequentialAPICall('', 'biolink:affects', nodeId);
    if (result2) {
      for (const tuple of result2) {
        const sourceId = tuple[0];
        // Filter out CAID nodes, self-references, and duplicates
        if (sourceId && sourceId !== nodeId && !sourceId.startsWith('CAID:') && !neighbors.includes(sourceId)) {
          neighbors.push(sourceId);
        }
      }
    }
    
    console.log(`📊 Found ${neighbors.length} neighbors for ${nodeId} (filtered out CAID nodes)`);
    return neighbors;
  }
  
  // Sequential BFS with 2-hop limit
  const allNodes = new Set();
  const adjacencyList = new Map();
  const visited = new Set();
  const queue = [];
  
  // Try to load existing state
  const savedState = loadTestState();
  let processedCount = 0;
  
  if (savedState && JSON.stringify(savedState.entities.sort()) === JSON.stringify(entities.sort())) {
    // Resume from saved state
    console.log(`🔄 Resuming from saved state...`);
    
    savedState.allNodes.forEach(node => allNodes.add(node));
    savedState.adjacencyList.forEach(([key, value]) => adjacencyList.set(key, new Set(value)));
    savedState.visited.forEach(node => visited.add(node));
    queue.push(...savedState.queue);
    savedState.cache.forEach(([key, value]) => cache.set(key, value));
    processedCount = savedState.processedCount;
    
    console.log(`📊 Restored: ${allNodes.size} nodes, ${queue.length} in queue, ${cache.size} cached calls`);
  } else {
    // Initialize with start nodes
    if (savedState) {
      console.log(`🆕 Starting fresh - saved state was for different entities`);
    }
    
    for (const entity of entities) {
      queue.push({nodeId: entity, depth: 0});
      visited.add(entity);
      allNodes.add(entity);
      adjacencyList.set(entity, new Set());
    }
  }
  
  console.log(`\n🚀 Starting sequential BFS from ${entities.length} start nodes (${queue.length} in queue)...`);
  const maxDepth = 2; // 2-hop = 1 intermediate node
  
  while (queue.length > 0) {
    const {nodeId, depth} = queue.shift();
    
    if (depth >= maxDepth) continue;
    
    processedCount++;
    console.log(`\n[${processedCount}] Processing ${nodeId} at depth ${depth} (queue: ${queue.length})`);
    
    try {
      const neighbors = await getNeighborsSequential(nodeId);
      
      for (const neighborId of neighbors) {
        // Skip CAID nodes entirely
        if (neighborId.startsWith('CAID:')) {
          continue;
        }
        
        allNodes.add(neighborId);
        
        // Add bidirectional edges
        if (!adjacencyList.has(nodeId)) {
          adjacencyList.set(nodeId, new Set());
        }
        if (!adjacencyList.has(neighborId)) {
          adjacencyList.set(neighborId, new Set());
        }
        adjacencyList.get(nodeId).add(neighborId);
        adjacencyList.get(neighborId).add(nodeId);
        
        // Queue for next level if not visited and within depth limit
        if (!visited.has(neighborId) && depth < maxDepth - 1) {
          visited.add(neighborId);
          queue.push({nodeId: neighborId, depth: depth + 1});
        }
      }
      
    } catch (error) {
      console.log(`❌ Error processing ${nodeId}: ${error.message}`);
    }
    
    // Save state every 10 nodes processed
    if (processedCount % 10 === 0) {
      saveTestState(entities, allNodes, adjacencyList, visited, queue, cache, processedCount);
      console.log(`📈 Progress: ${processedCount} nodes processed, ${allNodes.size} total nodes, ${queue.length} remaining`);
    }
  }
  
  console.log(`\n📊 Sequential BFS Complete:`);
  console.log(`   - Total nodes collected: ${allNodes.size}`);
  console.log(`   - Total edges: ${Array.from(adjacencyList.values()).reduce((sum, set) => sum + set.size, 0) / 2}`);
  console.log(`   - API calls made: ${cache.size}`);
  
  // Analyze node connectivity
  console.log(`\n🔍 Node Connectivity Analysis:`);
  const nodeConnections = Array.from(adjacencyList.entries())
    .map(([nodeId, neighbors]) => ({
      nodeId,
      connections: neighbors.size,
      type: getNodeType(nodeId)
    }))
    .sort((a, b) => b.connections - a.connections);
  
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
  
  // Show top 20 most connected nodes
  console.log(`\n🏆 Top 20 Most Connected Nodes:`);
  nodeConnections.slice(0, 20).forEach((node, index) => {
    const rank = index + 1;
    const isStart = entities.includes(node.nodeId);
    const marker = isStart ? '🎯' : '🔗';
    console.log(`   ${rank.toString().padStart(2)}. ${marker} ${node.nodeId.padEnd(20)} (${node.type.padEnd(12)}) - ${node.connections} connections`);
  });
  
  // Show connectivity by type
  console.log(`\n📈 Connectivity by Node Type:`);
  const typeStats = {};
  nodeConnections.forEach(node => {
    if (!typeStats[node.type]) {
      typeStats[node.type] = { count: 0, totalConnections: 0, maxConnections: 0, avgConnections: 0 };
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
  
  // Filter to keep only connecting paths
  console.log(`\n🔧 Filtering to keep only connecting paths...`);
  const startSet = new Set(entities);
  let removed = true;
  let iterations = 0;
  
  while (removed && iterations < 100) {
    removed = false;
    iterations++;
    
    const nodesToRemove = [];
    adjacencyList.forEach((neighbors, node) => {
      if (!startSet.has(node) && neighbors.size <= 1) {
        nodesToRemove.push(node);
      }
    });
    
    if (nodesToRemove.length > 0) {
      removed = true;
      for (const node of nodesToRemove) {
        const neighbors = adjacencyList.get(node) || new Set();
        neighbors.forEach(neighbor => {
          const neighborSet = adjacencyList.get(neighbor);
          if (neighborSet) {
            neighborSet.delete(node);
          }
        });
        adjacencyList.delete(node);
      }
      console.log(`   Iteration ${iterations}: Removed ${nodesToRemove.length} leaf nodes`);
    }
  }
  
  const finalNodes = Array.from(adjacencyList.keys());
  const finalEdges = Array.from(adjacencyList.values()).reduce((sum, set) => sum + set.size, 0) / 2;
  
  console.log(`\n🎯 Final Results:`);
  console.log(`   - Connecting path nodes: ${finalNodes.length}`);
  console.log(`   - Connecting path edges: ${finalEdges}`);
  
  // Check if we found any paths
  if (finalNodes.filter(node => startSet.has(node)).length >= 2) {
    console.log(`\n✅ SUCCESS: Found connecting paths between the entities!`);
    
    // Show some example paths
    const connectedStarts = finalNodes.filter(node => startSet.has(node));
    console.log(`   Connected start nodes: ${connectedStarts.join(', ')}`);
    
    // Show intermediate nodes
    const intermediates = finalNodes.filter(node => !startSet.has(node));
    if (intermediates.length > 0) {
      console.log(`   Intermediate nodes: ${intermediates.slice(0, 10).join(', ')}${intermediates.length > 10 ? '...' : ''}`);
    }
  } else {
    console.log(`\n❌ No connecting paths found within ${maxDepth}-hop limit`);
  }
  
  console.log(`\n🏁 2-hop test completed! Sequential approach processed ${processedCount} nodes with ${cache.size} API calls.`);
  
  // Clear state file on completion
  clearTestState();
}

// Run the test
testSequential2HopConnectingPaths().catch(console.error); 