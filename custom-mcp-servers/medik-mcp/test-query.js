// Test script for mediKanren MCP server run-query tool
import { spawn } from 'child_process';
import { createInterface } from 'readline';

// Sample query for testing - this mimics how the MCP SDK would format requests
const testQuery = {
  jsonrpc: "2.0",
  id: "test-1",
  method: "mcp.callTool",
  params: {
    name: "run-query",
    arguments: {
      e1: "Known->X",
      e2: "biolink:treats",
      e3: "MONDO:0005148"  // Type 2 diabetes mellitus
    }
  }
};

// First, let's list the available tools to verify our server is working
const listToolsQuery = {
  jsonrpc: "2.0",
  id: "list-tools",
  method: "mcp.listTools",
  params: {}
};

console.log('Starting mediKanren MCP server...');

// Start the MCP server process
const serverProcess = spawn('node', ['dist/index.js']);

// Create readline interface for reading server output
const rl = createInterface({
  input: serverProcess.stdout,
  crlfDelay: Infinity
});

// Create readline interface for reading server errors/logs
const errRl = createInterface({
  input: serverProcess.stderr,
  crlfDelay: Infinity
});

// Listen for server logs
errRl.on('line', (line) => {
  console.log(`Server log: ${line}`);
});

// Track responses by ID
const responses = {};
let testCompleted = false;

// Listen for server responses
rl.on('line', (line) => {
  try {
    const response = JSON.parse(line);
    console.log(`\nReceived response for ID: ${response.id}`);
    
    responses[response.id] = response;
    
    // If we've received both responses, print them and exit
    if (responses['list-tools'] && responses['test-1'] && !testCompleted) {
      testCompleted = true;
      
      console.log('\n=== AVAILABLE TOOLS ===');
      console.log(JSON.stringify(responses['list-tools'], null, 2));
      
      console.log('\n=== QUERY RESULTS ===');
      console.log(JSON.stringify(responses['test-1'], null, 2));
      
      console.log('\nTest completed. Terminating server...');
      serverProcess.kill();
      process.exit(0);
    }
  } catch (error) {
    console.error(`Error parsing response: ${error.message}`);
    console.error(`Raw response: ${line}`);
  }
});

// Wait for server to start up
setTimeout(() => {
  console.log('Sending listTools request...');
  serverProcess.stdin.write(JSON.stringify(listToolsQuery) + '\n');
  
  // Wait a bit before sending the query
  setTimeout(() => {
    console.log('Sending run-query request...');
    serverProcess.stdin.write(JSON.stringify(testQuery) + '\n');
  }, 1000);
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
  
  if (!testCompleted) {
    console.error('Test did not complete successfully');
    process.exit(1);
  }
}); 