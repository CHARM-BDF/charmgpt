// Comprehensive test script for the mediKanren MCP server
import { spawn } from 'child_process';
import { createInterface } from 'readline';
import fs from 'fs';

// Sample queries for testing
const queries = [
  {
    name: "Drugs that treat gastrointestinal stromal tumor",
    request: {
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
    }
  },
  {
    name: "PubMed abstract for imatinib study",
    request: {
      jsonrpc: "2.0",
      id: "pubmed-1",
      method: "tools/call",
      params: {
        name: "get-pubmed-abstract",
        arguments: {
          pubmed_id: "PMID:36281618"  // A PubMed ID from the query results
        }
      }
    }
  }
];

// First, let's list the available tools
const listToolsQuery = {
  jsonrpc: "2.0",
  id: "list-tools",
  method: "tools/list",
  params: {}
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

// Track responses by ID
const responses = {};
let currentQueryIndex = 0;

// Listen for server responses
stdout.on('line', (line) => {
  try {
    const response = JSON.parse(line);
    console.log(`\nReceived response for ID: ${response.id}`);
    
    responses[response.id] = response;
    
    // Process the response
    processResponse(response);
    
    // Move to the next query if available
    if (response.id === 'list-tools' || response.id.startsWith('query-') || response.id.startsWith('pubmed-')) {
      currentQueryIndex++;
      if (currentQueryIndex < queries.length + 1) { // +1 for listTools
        sendNextQuery();
      } else {
        // All queries completed
        console.log('\nAll tests completed. Saving results and terminating server...');
        
        // Save responses to a file
        fs.writeFileSync('test-results.json', JSON.stringify(responses, null, 2));
        console.log('Results saved to test-results.json');
        
        // Terminate the server
        serverProcess.kill();
        process.exit(0);
      }
    }
  } catch (error) {
    console.error(`Error parsing response: ${error.message}`);
    console.error(`Raw response: ${line}`);
  }
});

// Process and display response information
function processResponse(response) {
  if (response.id === 'list-tools') {
    console.log('\n=== AVAILABLE TOOLS ===');
    if (response.result && response.result.tools) {
      response.result.tools.forEach(tool => {
        console.log(`- ${tool.name}: ${tool.description}`);
      });
    }
  } else if (response.id.startsWith('query-')) {
    console.log('\n=== QUERY RESULTS ===');
    if (response.result) {
      // Display content
      if (response.result.content) {
        console.log('\nContent:');
        response.result.content.forEach(item => {
          if (item.type === 'text') {
            console.log(item.text);
          }
        });
      }
      
      // Display artifact information
      if (response.result.artifacts) {
        console.log('\nArtifacts:');
        response.result.artifacts.forEach(artifact => {
          console.log(`- Type: ${artifact.type}`);
          if (artifact.type === 'application/vnd.knowledge-graph') {
            try {
              const graph = JSON.parse(artifact.content);
              console.log(`  Nodes: ${graph.nodes.length}`);
              console.log(`  Links: ${graph.links.length}`);
              
              // Save the knowledge graph to a file
              fs.writeFileSync('knowledge-graph.json', artifact.content);
              console.log('  Knowledge graph saved to knowledge-graph.json');
            } catch (error) {
              console.error(`  Error parsing knowledge graph: ${error.message}`);
              console.log(`  Raw artifact data:`, JSON.stringify(artifact).substring(0, 200) + '...');
            }
          }
        });
      }
    }
  } else if (response.id.startsWith('pubmed-')) {
    console.log('\n=== PUBMED ABSTRACT ===');
    if (response.result && response.result.content) {
      response.result.content.forEach(item => {
        if (item.type === 'text') {
          console.log(item.text);
        }
      });
    }
  }
}

// Send the next query in the sequence
function sendNextQuery() {
  if (currentQueryIndex === 0) {
    console.log('Sending listTools request...');
    serverProcess.stdin.write(JSON.stringify(listToolsQuery) + '\n');
  } else {
    const query = queries[currentQueryIndex - 1];
    console.log(`\nSending ${query.name} request...`);
    serverProcess.stdin.write(JSON.stringify(query.request) + '\n');
  }
}

// Wait for server to start up, then send the first query
setTimeout(() => {
  sendNextQuery();
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
  
  if (currentQueryIndex < queries.length + 1) {
    console.error('Test did not complete successfully');
    process.exit(1);
  }
}); 