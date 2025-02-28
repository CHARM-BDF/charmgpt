// Demo script for the mediKanren MCP server knowledge graph visualization
import { spawn } from 'child_process';
import { createInterface } from 'readline';
import fs from 'fs';
import path from 'path';

// Query for drugs that treat gastrointestinal stromal tumor
const query = {
  jsonrpc: "2.0",
  id: "query-1",
  method: "tools/call",
  params: {
    name: "run-query",
    arguments: {
      e1: "X->Known",
      e2: "biolink:treats",
      e3: "MONDO:0011719"  // gastrointestinal stromal tumor
    }
  }
};

console.log('Starting mediKanren MCP server...');

// Start the MCP server process
const serverProcess = spawn('node', ['dist/index.js']);

// Create readline interfaces for reading server output and errors
const stdout = createInterface({
  input: serverProcess.stdout,
  crlfDelay: Infinity
});

const stderr = createInterface({
  input: serverProcess.stderr,
  crlfDelay: Infinity
});

// Listen for server logs
stderr.on('line', (line) => {
  console.log(`Server log: ${line}`);
});

// Process server responses
stdout.on('line', (line) => {
  try {
    const response = JSON.parse(line);
    console.log(`\nReceived response for ID: ${response.id}`);
    
    if (response.id === 'query-1' && response.result) {
      // Extract knowledge graph artifact
      if (response.result.artifacts && response.result.artifacts.length > 0) {
        const artifact = response.result.artifacts.find(a => a.type === 'application/vnd.knowledge-graph');
        
        if (artifact) {
          try {
            // Parse the knowledge graph data
            const graphData = JSON.parse(artifact.content);
            
            console.log(`\nKnowledge Graph extracted:`);
            console.log(`- Nodes: ${graphData.nodes.length}`);
            console.log(`- Links: ${graphData.links.length}`);
            
            // Remove publication evidence to simplify the graph
            graphData.links.forEach(link => {
              delete link.evidence;
            });
            
            // Save the knowledge graph data for the viewer
            const outputPath = '../../src/data/medikanren-knowledge-graph.json';
            fs.mkdirSync(path.dirname(outputPath), { recursive: true });
            fs.writeFileSync(outputPath, JSON.stringify(graphData, null, 2));
            
            // Also save a local copy
            fs.writeFileSync('knowledge-graph-viewer.json', JSON.stringify(graphData, null, 2));
            
            console.log(`\nKnowledge graph saved to:`);
            console.log(`- ${outputPath} (for the viewer component)`);
            console.log(`- knowledge-graph-viewer.json (local copy)`);
            
            // Display sample nodes and links
            console.log('\nSample nodes:');
            graphData.nodes.slice(0, 5).forEach(node => {
              console.log(`- ${node.name} (${node.entityType})`);
            });
            
            console.log('\nSample links:');
            graphData.links.slice(0, 5).forEach(link => {
              const source = graphData.nodes.find(n => n.id === link.source);
              const target = graphData.nodes.find(n => n.id === link.target);
              console.log(`- ${source?.name} ${link.label} ${target?.name}`);
            });
          } catch (error) {
            console.error(`Error processing knowledge graph: ${error.message}`);
          }
        } else {
          console.log('No knowledge graph artifact found in the response');
        }
      }
      
      // Terminate the server after processing
      console.log('\nDemo completed. Terminating server...');
      serverProcess.kill();
      process.exit(0);
    }
  } catch (error) {
    console.error(`Error parsing response: ${error.message}`);
    console.error(`Raw response: ${line}`);
  }
});

// Wait for server to start up, then send the query
setTimeout(() => {
  console.log('Sending query for gastrointestinal stromal tumor treatments...');
  serverProcess.stdin.write(JSON.stringify(query) + '\n');
}, 2000);

// Handle errors
serverProcess.on('error', (error) => {
  console.error(`Error: ${error.message}`);
  process.exit(1);
});

// Handle server process exit
serverProcess.on('exit', (code, signal) => {
  if (code !== null) {
    console.log(`Server process exited with code ${code}`);
  } else if (signal !== null) {
    console.log(`Server process was killed with signal ${signal}`);
  }
}); 