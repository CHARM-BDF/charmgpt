#!/usr/bin/env node

import fs from 'fs';

// Helper function to add delay
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Helper function to make a single API request with error handling
async function makeApiRequest(url, description) {
  try {
    const response = await fetch(url);
    if (response.ok) {
      const data = await response.json();
      return { success: true, data, url, description };
    } else {
      return { success: false, error: `HTTP ${response.status}`, url, description };
    }
  } catch (error) {
    return { success: false, error: error.message, url, description };
  }
}

// Two-phase neighbor fetching: parallel first, then sequential retry
async function fetchNeighborsWithRetry(nodeId, maxRetries = 2) {
  const forwardUrl = `https://medikanren.metareflective.systems/query0?subject=${encodeURIComponent(nodeId)}&predicate=${encodeURIComponent('biolink:affects')}&object=`;
  const reverseUrl = `https://medikanren.metareflective.systems/query0?subject=&predicate=${encodeURIComponent('biolink:affects')}&object=${encodeURIComponent(nodeId)}`;
  
  // Phase 1: Try parallel requests
  const [forwardResult, reverseResult] = await Promise.allSettled([
    makeApiRequest(forwardUrl, `${nodeId} forward`),
    makeApiRequest(reverseUrl, `${nodeId} reverse`)
  ]);
  
  const neighbors = [];
  const failedRequests = [];
  
  // Process successful parallel results
  if (forwardResult.status === 'fulfilled' && forwardResult.value.success) {
    for (const tuple of forwardResult.value.data) {
      const targetId = tuple[3];
      if (targetId && targetId !== nodeId) {
        neighbors.push({
          id: targetId,
          name: tuple[4] || targetId,
          predicate: tuple[2],
          direction: 'outgoing'
        });
      }
    }
  } else {
    failedRequests.push({ url: forwardUrl, description: `${nodeId} forward`, type: 'forward' });
  }
  
  if (reverseResult.status === 'fulfilled' && reverseResult.value.success) {
    for (const tuple of reverseResult.value.data) {
      const sourceId = tuple[0];
      if (sourceId && sourceId !== nodeId && !neighbors.find(n => n.id === sourceId)) {
        neighbors.push({
          id: sourceId,
          name: tuple[1] || sourceId,
          predicate: tuple[2],
          direction: 'incoming'
        });
      }
    }
  } else {
    failedRequests.push({ url: reverseUrl, description: `${nodeId} reverse`, type: 'reverse' });
  }
  
  // Phase 2: Sequential retry of failed requests
  if (failedRequests.length > 0) {
    for (const failedReq of failedRequests) {
      let retryCount = 0;
      let success = false;
      
      while (retryCount < maxRetries && !success) {
        await delay(1500); // Wait 1.5 seconds between retries
        retryCount++;
        
        const retryResult = await makeApiRequest(failedReq.url, `${failedReq.description} (retry ${retryCount})`);
        
        if (retryResult.success) {
          success = true;
          
          // Process retry data
          for (const tuple of retryResult.data) {
            if (failedReq.type === 'forward') {
              const targetId = tuple[3];
              if (targetId && targetId !== nodeId && !neighbors.find(n => n.id === targetId)) {
                neighbors.push({
                  id: targetId,
                  name: tuple[4] || targetId,
                  predicate: tuple[2],
                  direction: 'outgoing'
                });
              }
            } else { // reverse
              const sourceId = tuple[0];
              if (sourceId && sourceId !== nodeId && !neighbors.find(n => n.id === sourceId)) {
                neighbors.push({
                  id: sourceId,
                  name: tuple[1] || sourceId,
                  predicate: tuple[2],
                  direction: 'incoming'
                });
              }
            }
          }
        }
      }
      
      if (!success) {
        console.log(`    ⚠️  Failed to fetch ${failedReq.description} after ${maxRetries} retries`);
      } else {
        console.log(`    ✅ Retry successful for ${failedReq.description}`);
      }
    }
  }
  
  return neighbors;
}

// Test script for 3-hop connecting paths with improved retry strategy
async function test3HopGenes() {
  console.log('🧪 Testing 3-hop connecting paths with two-phase strategy...');
  
  // Test entities - specific genes requested
  const testEntities = [
    'HGNC:2908',    // DDIT3 (DNA damage inducible transcript 3)
    'HGNC:2364',    // CEBPB (CCAAT enhancer binding protein beta)
    'HGNC:3354'     // EGR1 (early growth response 1)
  ];
  
  console.log(`\n📡 Testing 3-hop connecting paths between: ${testEntities.join(', ')}`);
  
  // Create output file for results
  const outputFile = '3hop-genes-improved-results.txt';
  let output = '';
  
  function writeOutput(text) {
    output += text + '\n';
    console.log(text);
  }
  
  writeOutput('='.repeat(80));
  writeOutput('3-HOP CONNECTING PATHS TEST RESULTS (IMPROVED STRATEGY)');
  writeOutput('='.repeat(80));
  writeOutput(`Test Date: ${new Date().toISOString()}`);
  writeOutput(`Test Entities: ${testEntities.join(', ')}`);
  writeOutput('Strategy: Two-phase (parallel + sequential retry) with final filtering');
  writeOutput('HGNC:2908 = DDIT3 (DNA damage inducible transcript 3)');
  writeOutput('HGNC:2364 = CEBPB (CCAAT enhancer binding protein beta)');
  writeOutput('HGNC:3354 = EGR1 (early growth response 1)');
  writeOutput('');
  
  // Phase 1: Fetch direct neighbors of start entities
  writeOutput('🔍 PHASE 1: Fetching direct neighbors of start entities...');
  const entityNeighbors = new Map();
  
  for (const entity of testEntities) {
    writeOutput(`  Processing ${entity}...`);
    const neighbors = await fetchNeighborsWithRetry(entity);
    entityNeighbors.set(entity, neighbors);
    writeOutput(`    ✅ Found ${neighbors.length} neighbors`);
  }
  
  writeOutput('');
  
  // Build level 1 adjacency list
  const allNodes = new Set(testEntities);
  const adjacencyList = new Map();
  const nodeDepth = new Map();
  
  // Initialize with start nodes
  for (const entity of testEntities) {
    adjacencyList.set(entity, new Set());
    nodeDepth.set(entity, 0);
  }
  
  // Add level 1 neighbors
  const level1Nodes = new Set();
  for (const [entity, neighbors] of entityNeighbors) {
    for (const neighbor of neighbors.slice(0, 15)) { // Limit to prevent overload
      allNodes.add(neighbor.id);
      level1Nodes.add(neighbor.id);
      nodeDepth.set(neighbor.id, 1);
      
      if (!adjacencyList.has(entity)) {
        adjacencyList.set(entity, new Set());
      }
      if (!adjacencyList.has(neighbor.id)) {
        adjacencyList.set(neighbor.id, new Set());
      }
      
      adjacencyList.get(entity).add(neighbor.id);
      adjacencyList.get(neighbor.id).add(entity);
    }
  }
  
  writeOutput(`Level 1 complete: ${level1Nodes.size} nodes`);
  writeOutput('');
  
  // Phase 2: Fetch level 2 neighbors (for 3-hop paths) with improved strategy
  writeOutput('🔍 PHASE 2: Fetching level 2 neighbors with retry strategy...');
  
  const level1Array = Array.from(level1Nodes).slice(0, 8); // Limit to prevent server overload
  let level2Count = 0;
  let successfulLevel2 = 0;
  let failedLevel2 = 0;
  
  for (const level1Node of level1Array) {
    writeOutput(`  Processing level 1 node: ${level1Node}`);
    
    const level2Neighbors = await fetchNeighborsWithRetry(level1Node);
    
    if (level2Neighbors.length > 0) {
      successfulLevel2++;
      
      // Add level 2 neighbors (limit to prevent explosion)
      for (const neighbor of level2Neighbors.slice(0, 5)) {
        if (!allNodes.has(neighbor.id)) {
          allNodes.add(neighbor.id);
          nodeDepth.set(neighbor.id, 2);
          level2Count++;
          
          if (!adjacencyList.has(level1Node)) {
            adjacencyList.set(level1Node, new Set());
          }
          if (!adjacencyList.has(neighbor.id)) {
            adjacencyList.set(neighbor.id, new Set());
          }
          
          adjacencyList.get(level1Node).add(neighbor.id);
          adjacencyList.get(neighbor.id).add(level1Node);
        }
      }
      writeOutput(`    ✅ Added ${Math.min(level2Neighbors.length, 5)} level 2 neighbors`);
    } else {
      failedLevel2++;
      writeOutput(`    ❌ No level 2 neighbors found`);
    }
  }
  
  writeOutput(`Level 2 complete: ${level2Count} nodes added`);
  writeOutput(`Success rate: ${successfulLevel2}/${level1Array.length} level 1 nodes processed`);
  writeOutput('');
  
  // Find connecting paths
  writeOutput('🔗 ANALYZING CONNECTING PATHS...');
  const paths = [];
  
  // Check for 2-hop paths
  writeOutput('  Checking 2-hop paths (1 intermediate):');
  for (let i = 0; i < testEntities.length; i++) {
    for (let j = i + 1; j < testEntities.length; j++) {
      const entity1 = testEntities[i];
      const entity2 = testEntities[j];
      
      const neighbors1 = adjacencyList.get(entity1) || new Set();
      const neighbors2 = adjacencyList.get(entity2) || new Set();
      
      const shared1Hop = [...neighbors1].filter(n => neighbors2.has(n) && nodeDepth.get(n) === 1);
      
      if (shared1Hop.length > 0) {
        writeOutput(`    🔗 ${shared1Hop.length} paths: ${entity1} ↔ [intermediate] ↔ ${entity2}`);
        for (const shared of shared1Hop) {
          paths.push({
            start: entity1,
            end: entity2,
            intermediates: [shared],
            path: `${entity1} ↔ ${shared} ↔ ${entity2}`,
            hops: 2
          });
        }
      }
    }
  }
  
  // Check for 3-hop paths
  writeOutput('  Checking 3-hop paths (2 intermediates):');
  for (let i = 0; i < testEntities.length; i++) {
    for (let j = i + 1; j < testEntities.length; j++) {
      const entity1 = testEntities[i];
      const entity2 = testEntities[j];
      
      const neighbors1 = adjacencyList.get(entity1) || new Set();
      const neighbors2 = adjacencyList.get(entity2) || new Set();
      
      let found3Hop = 0;
      for (const intermediate1 of neighbors1) {
        if (nodeDepth.get(intermediate1) === 1) {
          const intermediate1Neighbors = adjacencyList.get(intermediate1) || new Set();
          for (const intermediate2 of intermediate1Neighbors) {
            if (nodeDepth.get(intermediate2) === 2 && neighbors2.has(intermediate2)) {
              paths.push({
                start: entity1,
                end: entity2,
                intermediates: [intermediate1, intermediate2],
                path: `${entity1} ↔ ${intermediate1} ↔ ${intermediate2} ↔ ${entity2}`,
                hops: 3
              });
              found3Hop++;
            }
          }
        }
      }
      
      if (found3Hop > 0) {
        writeOutput(`    🔗 ${found3Hop} paths: ${entity1} ↔ [int1] ↔ [int2] ↔ ${entity2}`);
      }
    }
  }
  
  writeOutput('');
  
  // FINAL FILTERING: Only keep nodes and edges on connecting paths
  writeOutput('🎯 FINAL FILTERING: Keeping only nodes on connecting paths...');
  
  const pathNodes = new Set(testEntities);
  const pathEdges = new Set();
  
  for (const path of paths) {
    // Add all intermediate nodes
    for (const intermediate of path.intermediates) {
      pathNodes.add(intermediate);
    }
    
    // Add edges for this path
    if (path.hops === 2) {
      const [start, intermediate, end] = [path.start, path.intermediates[0], path.end];
      pathEdges.add(`${start}↔${intermediate}`);
      pathEdges.add(`${intermediate}↔${end}`);
    } else if (path.hops === 3) {
      const [start, int1, int2, end] = [path.start, path.intermediates[0], path.intermediates[1], path.end];
      pathEdges.add(`${start}↔${int1}`);
      pathEdges.add(`${int1}↔${int2}`);
      pathEdges.add(`${int2}↔${end}`);
    }
  }
  
  const totalNodesDiscovered = allNodes.size;
  const finalNodeCount = pathNodes.size;
  const prunedNodes = totalNodesDiscovered - finalNodeCount;
  
  writeOutput(`  Total nodes discovered: ${totalNodesDiscovered}`);
  writeOutput(`  Nodes on connecting paths: ${finalNodeCount}`);
  writeOutput(`  Nodes pruned: ${prunedNodes} (${Math.round(prunedNodes/totalNodesDiscovered*100)}%)`);
  writeOutput('');
  
  // Final results
  writeOutput('🎯 FINAL RESULTS (MCP-STYLE OUTPUT)');
  writeOutput('='.repeat(40));
  writeOutput(`Connecting paths found: ${paths.length}`);
  
  const paths2Hop = paths.filter(p => p.hops === 2);
  const paths3Hop = paths.filter(p => p.hops === 3);
  writeOutput(`  - 2-hop paths: ${paths2Hop.length}`);
  writeOutput(`  - 3-hop paths: ${paths3Hop.length}`);
  writeOutput('');
  
  if (paths.length > 0) {
    writeOutput('📋 CONNECTING PATHS (FINAL OUTPUT):');
    writeOutput('-'.repeat(40));
    
    if (paths2Hop.length > 0) {
      writeOutput('2-HOP PATHS:');
      paths2Hop.forEach((path, index) => {
        writeOutput(`  ${index + 1}. ${path.path}`);
      });
      writeOutput('');
    }
    
    if (paths3Hop.length > 0) {
      writeOutput('3-HOP PATHS:');
      paths3Hop.slice(0, 10).forEach((path, index) => {
        writeOutput(`  ${index + 1}. ${path.path}`);
      });
      if (paths3Hop.length > 10) {
        writeOutput(`  ... and ${paths3Hop.length - 10} more`);
      }
    }
    
    writeOutput('');
    writeOutput('📊 FINAL GRAPH STATISTICS:');
    writeOutput(`  - Nodes in final graph: ${finalNodeCount}`);
    writeOutput(`  - Edges in final graph: ${pathEdges.size}`);
    writeOutput(`  - Starting entities: ${testEntities.length}`);
    writeOutput(`  - Intermediate nodes: ${finalNodeCount - testEntities.length}`);
    
  } else {
    writeOutput('❌ No connecting paths found');
  }
  
  writeOutput('');
  writeOutput('🎯 STRATEGY PERFORMANCE:');
  writeOutput(`✅ Two-phase fetching implemented`);
  writeOutput(`✅ Sequential retry for failed requests`);
  writeOutput(`✅ Final filtering to path-only nodes`);
  writeOutput(`✅ MCP-style output (only relevant results)`);
  writeOutput(`✅ Server-friendly request pattern`);
  
  writeOutput('');
  writeOutput('🏁 Improved 3-hop test complete!');
  writeOutput('='.repeat(80));
  
  // Write to file
  fs.writeFileSync(outputFile, output);
  console.log(`\n📄 Results written to: ${outputFile}`);
}

// Run the test
test3HopGenes().catch(console.error); 