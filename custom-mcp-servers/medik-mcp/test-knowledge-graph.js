// Test script for the mediKanren MCP server knowledge graph formatter
import { runQuery } from './dist/index.js';

async function main() {
  try {
    console.log("Testing mediKanren query with knowledge graph formatting...");
    
    // Query for drugs that treat gastrointestinal stromal tumor
    const queryParams = {
      e1: 'X->Known',
      e2: 'biolink:treats',
      e3: 'MONDO:0011719'  // gastrointestinal stromal tumor
    };
    
    console.log(`Running query with parameters: ${JSON.stringify(queryParams, null, 2)}`);
    
    const results = await runQuery(queryParams);
    
    if (!results) {
      console.error("No results returned from query");
      return;
    }
    
    if (!Array.isArray(results)) {
      console.error("Error in query:", results.error || "Unknown error");
      return;
    }
    
    console.log(`Query returned ${results.length} results`);
    
    // Import the formatter
    const { formatKnowledgeGraphArtifact } = await import('./dist/formatters.js');
    
    // Format the results
    const formattedResult = formatKnowledgeGraphArtifact(results, queryParams);
    
    // Display the human-readable text
    console.log("\nHuman-readable text:");
    console.log(formattedResult.content[0].text);
    
    // Display information about the knowledge graph
    console.log("\nKnowledge Graph Artifact:");
    if (formattedResult.artifacts && formattedResult.artifacts.length > 0) {
      const artifact = formattedResult.artifacts[0];
      console.log(`Type: ${artifact.type}`);
      console.log(`Title: ${artifact.title}`);
      
      // Parse the graph data to show summary
      const graph = JSON.parse(artifact.content);
      console.log(`Nodes: ${graph.nodes.length}`);
      console.log(`Links: ${graph.links.length}`);
      
      // Show a sample of nodes and links
      console.log("\nSample nodes:");
      graph.nodes.slice(0, 3).forEach(node => {
        console.log(`- ${node.name} (${node.id}, type: ${node.entityType})`);
      });
      
      console.log("\nSample links:");
      graph.links.slice(0, 3).forEach(link => {
        const sourceNode = graph.nodes.find(n => n.id === link.source);
        const targetNode = graph.nodes.find(n => n.id === link.target);
        console.log(`- ${sourceNode?.name} ${link.label} ${targetNode?.name}`);
      });
    } else {
      console.log("No artifacts generated");
    }
    
    console.log("\nTest completed successfully!");
  } catch (error) {
    console.error("Error in test:", error);
  }
}

main(); 