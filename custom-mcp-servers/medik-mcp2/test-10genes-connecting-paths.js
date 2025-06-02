#!/usr/bin/env node

// Test connecting paths between 10 genes
const TEST_ENTITIES = [
  'HGNC:17378',
  'HGNC:12851',
  'HGNC:11375', 
  'HGNC:5359',
  'HGNC:3349',
  'HGNC:3763',
  'HGNC:13519',
  'HGNC:3354',  // EGR1 from previous test
  'HGNC:2364',  // CEBPB from previous test
  'HGNC:19829'
];

// Cache for API responses to avoid duplicate calls
const responseCache = new Map();

async function makeAPICall(url, retryCount = 0) {
  if (responseCache.has(url)) {
    return responseCache.get(url);
  }
  
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    responseCache.set(url, data);
    return data;
  } catch (error) {
    if (error.message.includes('timeout') && retryCount < 2) {
      console.log(`    ⏳ Timeout, retrying... (attempt ${retryCount + 1})`);
      await new Promise(resolve => setTimeout(resolve, 2000));
      return makeAPICall(url, retryCount + 1);
    }
    throw error;
  }
}

async function getNeighbors(entityId) {
  const neighbors = [];
  const predicate = 'biolink:affects';
  
  // Query 1: entity -> X
  const url1 = `https://medikanren.metareflective.systems/query0?subject=${encodeURIComponent(entityId)}&predicate=${encodeURIComponent(predicate)}&object=`;
  
  try {
    const result1 = await makeAPICall(url1);
    for (const tuple of result1) {
      neighbors.push({
        id: tuple[3],           // target ID
        name: tuple[4] || tuple[3], // target name or fallback to ID
        predicate: tuple[2],
        direction: 'outgoing'
      });
    }
  } catch (error) {
    console.log(`    ❌ Error in outgoing query: ${error.message}`);
  }
  
  // Query 2: X -> entity
  const url2 = `https://medikanren.metareflective.systems/query0?subject=&predicate=${encodeURIComponent(predicate)}&object=${encodeURIComponent(entityId)}`;
  
  try {
    const result2 = await makeAPICall(url2);
    for (const tuple of result2) {
      const sourceId = tuple[0];
      if (!neighbors.find(n => n.id === sourceId)) {
        neighbors.push({
          id: sourceId,           // source ID
          name: tuple[1] || sourceId, // source name or fallback to ID
          predicate: tuple[2],
          direction: 'incoming'
        });
      }
    }
  } catch (error) {
    console.log(`    ❌ Error in incoming query: ${error.message}`);
  }
  
  return neighbors;
}

async function collect2HopNeighborhoodParallel(startEntities) {
  console.log(`🔍 PHASE 1: Fetching direct neighbors of ${startEntities.length} entities...`);
  
  const allNodes = new Map(); // ID -> {id, name, level, isStart}
  const adjacencyList = new Map(); // ID -> Set<neighborID>
  
  // Initialize start entities
  for (const entity of startEntities) {
    allNodes.set(entity, {
      id: entity,
      name: entity,
      level: 0,
      isStart: true
    });
    adjacencyList.set(entity, new Set());
  }
  
  // Phase 1: Get all Level 1 neighbors in parallel
  const level1Promises = startEntities.map(async entity => {
    console.log(`  Processing ${entity}...`);
    try {
      const neighbors = await getNeighbors(entity);
      console.log(`    ✅ Found ${neighbors.length} neighbors`);
      
      for (const neighbor of neighbors) {
        // Add to allNodes if not already present
        if (!allNodes.has(neighbor.id)) {
          allNodes.set(neighbor.id, {
            id: neighbor.id,
            name: neighbor.name,
            level: 1,
            isStart: false
          });
        }
        
        // Add bidirectional edge
        if (!adjacencyList.has(neighbor.id)) {
          adjacencyList.set(neighbor.id, new Set());
        }
        adjacencyList.get(entity).add(neighbor.id);
        adjacencyList.get(neighbor.id).add(entity);
      }
      
      return neighbors;
    } catch (error) {
      console.log(`    ❌ Failed: ${error.message}`);
      return [];
    }
  });
  
  await Promise.allSettled(level1Promises);
  
  const level1Nodes = Array.from(allNodes.values()).filter(n => n.level === 1);
  console.log(`\nLevel 1 complete: ${level1Nodes.length} nodes`);
  
  // Phase 2: Get Level 2 neighbors with improved retry strategy
  console.log(`\n🔍 PHASE 2: Fetching level 2 neighbors with retry strategy...`);
  
  // First try all in parallel
  const level2Promises = level1Nodes.map(async node => {
    try {
      const neighbors = await getNeighbors(node.id);
      return { nodeId: node.id, neighbors, success: true };
    } catch (error) {
      return { nodeId: node.id, error: error.message, success: false };
    }
  });
  
  const level2Results = await Promise.allSettled(level2Promises);
  const failedNodes = [];
  
  // Process successful results
  for (const result of level2Results) {
    if (result.status === 'fulfilled' && result.value.success) {
      const { nodeId, neighbors } = result.value;
      console.log(`  Processing level 1 node: ${nodeId}`);
      
      let addedCount = 0;
      for (const neighbor of neighbors) {
        if (!allNodes.has(neighbor.id)) {
          allNodes.set(neighbor.id, {
            id: neighbor.id,
            name: neighbor.name,
            level: 2,
            isStart: false
          });
          addedCount++;
        }
        
        // Add bidirectional edge
        if (!adjacencyList.has(neighbor.id)) {
          adjacencyList.set(neighbor.id, new Set());
        }
        adjacencyList.get(nodeId).add(neighbor.id);
        adjacencyList.get(neighbor.id).add(nodeId);
      }
      
      console.log(`    ✅ Added ${addedCount} level 2 neighbors`);
    } else if (result.status === 'fulfilled' && !result.value.success) {
      failedNodes.push(result.value);
    }
  }
  
  // Retry failed nodes sequentially with delay
  console.log(`\n🔄 RETRYING FAILED NODES (${failedNodes.length})...`);
  let retrySuccesses = 0;
  
  for (const { nodeId, error } of failedNodes) {
    console.log(`  Retrying ${nodeId} (failed with: ${error})...`);
    await new Promise(resolve => setTimeout(resolve, 1500)); // 1.5s delay
    
    try {
      const neighbors = await getNeighbors(nodeId);
      let addedCount = 0;
      
      for (const neighbor of neighbors) {
        if (!allNodes.has(neighbor.id)) {
          allNodes.set(neighbor.id, {
            id: neighbor.id,
            name: neighbor.name,
            level: 2,
            isStart: false
          });
          addedCount++;
        }
        
        // Add bidirectional edge
        if (!adjacencyList.has(neighbor.id)) {
          adjacencyList.set(neighbor.id, new Set());
        }
        adjacencyList.get(nodeId).add(neighbor.id);
        adjacencyList.get(neighbor.id).add(nodeId);
      }
      
      console.log(`    ✅ Retry success: ${addedCount} level 2 neighbors`);
      retrySuccesses++;
    } catch (retryError) {
      console.log(`    ❌ Retry failed: ${retryError.message}`);
    }
  }
  
  console.log(`Level 2 complete: ${retrySuccesses}/${failedNodes.length} retries succeeded`);
  
  return { allNodes, adjacencyList };
}

function findConnectingPaths(allNodes, adjacencyList, startEntities) {
  console.log(`\n🔗 ANALYZING CONNECTING PATHS...`);
  
  const startSet = new Set(startEntities);
  const paths = [];
  
  // Check 2-hop paths (1 intermediate)
  console.log(`  Checking 2-hop paths (1 intermediate):`);
  let twoHopPaths = 0;
  
  for (const [intermediateId, intermediate] of allNodes) {
    if (intermediate.isStart) continue;
    
    const neighbors = adjacencyList.get(intermediateId) || new Set();
    const connectedStarts = Array.from(neighbors).filter(n => startSet.has(n));
    
    if (connectedStarts.length >= 2) {
      // This intermediate connects multiple start nodes
      for (let i = 0; i < connectedStarts.length; i++) {
        for (let j = i + 1; j < connectedStarts.length; j++) {
          paths.push({
            start1: connectedStarts[i],
            start2: connectedStarts[j],
            intermediates: [intermediateId],
            length: 2
          });
          twoHopPaths++;
        }
      }
    }
  }
  
  console.log(`    🔗 ${twoHopPaths} unique 2-hop paths found`);
  
  // Check 3-hop paths (2 intermediates)
  console.log(`  Checking 3-hop paths (2 intermediates):`);
  let threeHopPaths = 0;
  
  const level1Nodes = Array.from(allNodes.values()).filter(n => n.level === 1);
  const level2Nodes = Array.from(allNodes.values()).filter(n => n.level === 2);
  
  for (const start1 of startEntities) {
    for (const start2 of startEntities) {
      if (start1 >= start2) continue; // Avoid duplicates
      
      // Find paths: start1 -> level1 -> level2 -> start2
      const start1Neighbors = adjacencyList.get(start1) || new Set();
      const start2Neighbors = adjacencyList.get(start2) || new Set();
      
      for (const level1Id of start1Neighbors) {
        if (startSet.has(level1Id)) continue; // Skip if level1 is a start node
        
        const level1Neighbors = adjacencyList.get(level1Id) || new Set();
        
        for (const level2Id of level1Neighbors) {
          if (startSet.has(level2Id) || level2Id === level1Id) continue;
          
          const level2Neighbors = adjacencyList.get(level2Id) || new Set();
          
          if (level2Neighbors.has(start2)) {
            paths.push({
              start1: start1,
              start2: start2,
              intermediates: [level1Id, level2Id],
              length: 3
            });
            threeHopPaths++;
          }
        }
      }
    }
  }
  
  console.log(`    🔗 ${threeHopPaths} unique 3-hop paths found`);
  
  return paths;
}

function filterToConnectingNodes(allNodes, adjacencyList, paths) {
  console.log(`\n🎯 FINAL FILTERING: Keeping only nodes on connecting paths...`);
  
  const pathNodes = new Set();
  
  // Add all nodes that are on connecting paths
  for (const path of paths) {
    pathNodes.add(path.start1);
    pathNodes.add(path.start2);
    for (const intermediate of path.intermediates) {
      pathNodes.add(intermediate);
    }
  }
  
  // Create filtered structures
  const filteredNodes = new Map();
  const filteredAdjList = new Map();
  
  for (const nodeId of pathNodes) {
    if (allNodes.has(nodeId)) {
      filteredNodes.set(nodeId, allNodes.get(nodeId));
      filteredAdjList.set(nodeId, new Set());
    }
  }
  
  // Add edges between path nodes
  for (const nodeId of pathNodes) {
    const neighbors = adjacencyList.get(nodeId) || new Set();
    for (const neighborId of neighbors) {
      if (pathNodes.has(neighborId)) {
        filteredAdjList.get(nodeId).add(neighborId);
      }
    }
  }
  
  console.log(`  Total nodes discovered: ${allNodes.size}`);
  console.log(`  Nodes on connecting paths: ${filteredNodes.size}`);
  console.log(`  Nodes pruned: ${allNodes.size - filteredNodes.size} (${Math.round((allNodes.size - filteredNodes.size) / allNodes.size * 100)}%)`);
  
  return { filteredNodes, filteredAdjList };
}

async function runConnectingPathsTest() {
  console.log('================================================================================');
  console.log('10-GENE CONNECTING PATHS TEST');
  console.log('================================================================================');
  console.log(`Test Date: ${new Date().toISOString()}`);
  console.log(`Test Entities: ${TEST_ENTITIES.join(', ')}`);
  console.log(`Strategy: Two-phase (parallel + sequential retry) with comprehensive path analysis\n`);
  
  try {
    // Collect 2-hop neighborhood
    const { allNodes, adjacencyList } = await collect2HopNeighborhoodParallel(TEST_ENTITIES);
    
    // Find all connecting paths
    const paths = findConnectingPaths(allNodes, adjacencyList, TEST_ENTITIES);
    
    // Filter to only path nodes
    const { filteredNodes, filteredAdjList } = filterToConnectingNodes(allNodes, adjacencyList, paths);
    
    // Report results
    console.log(`\n🎯 FINAL RESULTS`);
    console.log('========================================');
    console.log(`Total connecting paths found: ${paths.length}`);
    
    const twoHopPaths = paths.filter(p => p.length === 2);
    const threeHopPaths = paths.filter(p => p.length === 3);
    
    console.log(`  - 2-hop paths: ${twoHopPaths.length}`);
    console.log(`  - 3-hop paths: ${threeHopPaths.length}`);
    
    console.log(`\n📋 ALL CONNECTING PATHS:`);
    console.log('----------------------------------------');
    
    if (twoHopPaths.length > 0) {
      console.log(`\n2-HOP PATHS (${twoHopPaths.length}):`);
      twoHopPaths.forEach((path, i) => {
        const intermediate = allNodes.get(path.intermediates[0]);
        console.log(`  ${i+1}. ${path.start1} ↔ ${path.intermediates[0]} (${intermediate?.name || 'Unknown'}) ↔ ${path.start2}`);
      });
    }
    
    if (threeHopPaths.length > 0) {
      console.log(`\n3-HOP PATHS (${threeHopPaths.length}):`);
      threeHopPaths.forEach((path, i) => {
        const int1 = allNodes.get(path.intermediates[0]);
        const int2 = allNodes.get(path.intermediates[1]);
        console.log(`  ${i+1}. ${path.start1} → ${path.intermediates[0]} (${int1?.name || 'Unknown'}) → ${path.intermediates[1]} (${int2?.name || 'Unknown'}) → ${path.start2}`);
      });
    }
    
    console.log(`\n📊 FINAL GRAPH STATISTICS:`);
    console.log(`  - Total nodes discovered: ${allNodes.size}`);
    console.log(`  - Nodes in final graph: ${filteredNodes.size}`);
    console.log(`  - Total edges in final graph: ${Array.from(filteredAdjList.values()).reduce((sum, set) => sum + set.size, 0) / 2}`);
    console.log(`  - Starting entities with connections: ${TEST_ENTITIES.filter(e => filteredNodes.has(e)).length}/${TEST_ENTITIES.length}`);
    console.log(`  - API calls cached: ${responseCache.size}`);
    
    console.log(`\n🏁 10-gene connecting paths test complete!`);
    console.log('================================================================================\n');
    
  } catch (error) {
    console.error(`❌ Test failed: ${error.message}`);
    console.error(error.stack);
  }
}

// Run the test
runConnectingPathsTest().catch(console.error); 