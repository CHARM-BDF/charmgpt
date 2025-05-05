/**
 * Test script for find-pathway functionality
 * 
 * This script directly calls the find-pathway functionality to test the new filtering
 * without having to go through the MCP interface.
 */

import { runBidirectionalQuery } from './index';
import { formatKnowledgeGraphArtifact } from './formatters';

// Sample test CURIEs (you can replace these with any valid CURIEs)
const SOURCE_CURIE = 'NCBIGene:5594'; // MAPK1
const TARGET_CURIE = 'NCBIGene:841';  // CASP8

/**
 * Function to filter low connectivity nodes
 * Copy of the function from index.ts to avoid circular imports
 */
function filterLowConnectivityNodes(graph: any, startingNodeIds: Set<string>): any {
  if (!graph || !graph.nodes || !graph.links || !Array.isArray(graph.nodes) || !Array.isArray(graph.links)) {
    console.error(`Invalid graph structure for filtering: ${JSON.stringify(graph)}`);
    return graph;
  }

  console.log(`Filtering knowledge graph: ${graph.nodes.length} nodes, ${graph.links.length} links`);
  
  // Count connections for each node
  const connectionCounts = new Map<string, number>();
  
  // Initialize all nodes with 0 connections
  graph.nodes.forEach((node: any) => {
    connectionCounts.set(node.id, 0);
  });
  
  // Count connections from links
  graph.links.forEach((link: any) => {
    connectionCounts.set(link.source, (connectionCounts.get(link.source) || 0) + 1);
    connectionCounts.set(link.target, (connectionCounts.get(link.target) || 0) + 1);
  });
  
  // Determine which nodes to keep (starting nodes or those with >1 connection)
  const nodesToKeep = new Set<string>();
  
  connectionCounts.forEach((count, nodeId) => {
    // Keep starting nodes regardless of connection count
    if (startingNodeIds.has(nodeId)) {
      nodesToKeep.add(nodeId);
      console.log(`Keeping starting node: ${nodeId}`);
    } 
    // Keep nodes with more than 1 connection
    else if (count > 1) {
      nodesToKeep.add(nodeId);
    }
  });
  
  console.log(`Nodes to keep: ${nodesToKeep.size} out of ${graph.nodes.length}`);
  
  // Filter nodes
  const filteredNodes = graph.nodes.filter((node: any) => nodesToKeep.has(node.id));
  
  // Filter links (only keep links where both source and target are kept)
  const filteredLinks = graph.links.filter((link: any) => 
    nodesToKeep.has(link.source) && nodesToKeep.has(link.target)
  );
  
  console.log(`Filtered graph: ${filteredNodes.length} nodes, ${filteredLinks.length} links`);
  
  // Return new graph object
  return {
    nodes: filteredNodes,
    links: filteredLinks
  };
}

/**
 * Test the pathway filtering logic
 */
async function testPathwayFiltering() {
  console.log(`Testing pathway between ${SOURCE_CURIE} and ${TARGET_CURIE}`);
  
  try {
    // Get neighborhood data
    console.log("Fetching source neighborhood data...");
    const sourceNeighborhood = await runBidirectionalQuery({ curie: SOURCE_CURIE });
    console.log("Fetching target neighborhood data...");
    const targetNeighborhood = await runBidirectionalQuery({ curie: TARGET_CURIE });
    
    if (!sourceNeighborhood || !targetNeighborhood) {
      console.error("Failed to retrieve neighborhoods");
      return;
    }
    
    if (!Array.isArray(sourceNeighborhood) || !Array.isArray(targetNeighborhood)) {
      console.error("Invalid neighborhood data");
      return;
    }
    
    console.log(`Source neighborhood: ${sourceNeighborhood.length} relationships`);
    console.log(`Target neighborhood: ${targetNeighborhood.length} relationships`);
    
    // Combine the data
    const combinedResults = [...sourceNeighborhood, ...targetNeighborhood];
    const startingNodeIds = new Set([SOURCE_CURIE, TARGET_CURIE]);
    
    // Format as a knowledge graph
    console.log("Formatting as knowledge graph...");
    const graphResult = await formatKnowledgeGraphArtifact(
      combinedResults,
      {
        e1: "PathwayAnalysis",
        e2: "pathway-between",
        e3: `${SOURCE_CURIE}_to_${TARGET_CURIE}`
      },
      startingNodeIds
    );
    
    if (!graphResult.artifacts || graphResult.artifacts.length === 0) {
      console.error("No graph artifact created");
      return;
    }
    
    const knowledgeGraphArtifact = graphResult.artifacts.find(
      (a: any) => a.type === 'application/vnd.knowledge-graph'
    );
    
    if (!knowledgeGraphArtifact || !knowledgeGraphArtifact.content) {
      console.error("No graph content found");
      return;
    }
    
    // Parse the graph
    const graph = typeof knowledgeGraphArtifact.content === 'string' 
      ? JSON.parse(knowledgeGraphArtifact.content) 
      : knowledgeGraphArtifact.content;
    
    console.log(`Original graph: ${graph.nodes.length} nodes, ${graph.links.length} links`);
    
    // Apply standard filtering
    const standardFilteredGraph = filterLowConnectivityNodes(graph, startingNodeIds);
    console.log(`Standard filtered graph: ${standardFilteredGraph.nodes.length} nodes, ${standardFilteredGraph.links.length} links`);
    
    // Apply enhanced pathway filtering
    let filteredGraph = standardFilteredGraph;
    
    // Track which nodes are connected to source and target
    const connectedToSource = new Set<string>([SOURCE_CURIE]);
    const connectedToTarget = new Set<string>([TARGET_CURIE]);
    
    // First pass: identify nodes connected to source or target (direct neighbors)
    filteredGraph.links.forEach((link: any) => {
      if (link.source === SOURCE_CURIE) {
        connectedToSource.add(link.target);
      } else if (link.target === SOURCE_CURIE) {
        connectedToSource.add(link.source);
      }
      
      if (link.source === TARGET_CURIE) {
        connectedToTarget.add(link.target);
      } else if (link.target === TARGET_CURIE) {
        connectedToTarget.add(link.source);
      }
    });
    
    console.log(`Nodes connected to source: ${connectedToSource.size}`);
    console.log(`Nodes connected to target: ${connectedToTarget.size}`);
    
    // Find nodes that connect to both source and target (potential pathway nodes)
    const pathwayNodes = new Set<string>([SOURCE_CURIE, TARGET_CURIE]);
    connectedToSource.forEach(nodeId => {
      if (connectedToTarget.has(nodeId)) {
        pathwayNodes.add(nodeId);
      }
    });
    
    console.log(`Nodes connected to both source and target: ${pathwayNodes.size - 2}`);
    
    // Second pass: expand to include nodes that connect to pathway nodes
    const expandedPathwayNodes = new Set(pathwayNodes);
    filteredGraph.links.forEach((link: any) => {
      if (pathwayNodes.has(link.source) && pathwayNodes.has(link.target)) {
        expandedPathwayNodes.add(link.source);
        expandedPathwayNodes.add(link.target);
      }
    });
    
    console.log(`Expanded pathway nodes: ${expandedPathwayNodes.size}`);
    
    // Keep only nodes that are on potential pathways
    const pathwayFilteredNodes = filteredGraph.nodes.filter((node: any) => 
      expandedPathwayNodes.has(node.id)
    );
    
    // Keep only links between pathway nodes
    const pathwayFilteredLinks = filteredGraph.links.filter((link: any) => 
      expandedPathwayNodes.has(link.source) && expandedPathwayNodes.has(link.target)
    );
    
    console.log(`Enhanced pathway filtered graph: ${pathwayFilteredNodes.length} nodes, ${pathwayFilteredLinks.length} links`);
    
    // Output summary of node and link reduction
    console.log("\nFilter Effectiveness:");
    console.log(`- Original graph: ${graph.nodes.length} nodes, ${graph.links.length} links`);
    console.log(`- After standard filtering: ${standardFilteredGraph.nodes.length} nodes (${(standardFilteredGraph.nodes.length / graph.nodes.length * 100).toFixed(1)}% of original)`);
    console.log(`- After enhanced pathway filtering: ${pathwayFilteredNodes.length} nodes (${(pathwayFilteredNodes.length / graph.nodes.length * 100).toFixed(1)}% of original)`);
    
    // Write filtered graph to a file for inspection
    const fs = require('fs');
    const enhancedFilteredGraph = {
      nodes: pathwayFilteredNodes,
      links: pathwayFilteredLinks
    };
    
    fs.writeFileSync(
      './pathwayTest-result.json', 
      JSON.stringify(enhancedFilteredGraph, null, 2)
    );
    console.log("Filtered graph saved to pathwayTest-result.json");
    
  } catch (error) {
    console.error("Error testing pathway filtering:", error);
  }
}

// Run the test
testPathwayFiltering().then(() => console.log("Test completed")).catch(console.error); 