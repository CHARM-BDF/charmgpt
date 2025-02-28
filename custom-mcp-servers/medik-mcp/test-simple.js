// Simple test script for mediKanren MCP server
import { spawn } from 'child_process';
import { createInterface } from 'readline';

// Start the server process
const server = spawn('node', ['dist/index.js']);

// Create interfaces for reading stdout and stderr
const stdout = createInterface({ input: server.stdout, crlfDelay: Infinity });
const stderr = createInterface({ input: server.stderr, crlfDelay: Infinity });

// Log server output
stderr.on('line', line => console.log(`Server log: ${line}`));

// Process server responses
stdout.on('line', line => {
  try {
    const response = JSON.parse(line);
    console.log('Received response:');
    console.log(JSON.stringify(response, null, 2));
  } catch (error) {
    console.error(`Error parsing response: ${error.message}`);
    console.error(`Raw response: ${line}`);
  }
});

// Wait for server to start
setTimeout(() => {
  console.log('Sending listTools request...');
  
  // Send listTools request
  const listToolsRequest = {
    jsonrpc: '2.0',
    id: '1',
    method: 'mcp.listTools',
    params: {}
  };
  
  server.stdin.write(JSON.stringify(listToolsRequest) + '\n');
  
  // Wait before sending the query request
  setTimeout(() => {
    console.log('Sending run-query request...');
    
    // Send run-query request
    const queryRequest = {
      jsonrpc: '2.0',
      id: '2',
      method: 'mcp.callTool',
      params: {
        name: 'run-query',
        arguments: {
          e1: 'Known->X',
          e2: 'biolink:treats',
          e3: 'MONDO:0005148' // Type 2 diabetes mellitus
        }
      }
    };
    
    server.stdin.write(JSON.stringify(queryRequest) + '\n');
    
    // Wait before terminating
    setTimeout(() => {
      console.log('Test completed. Terminating server...');
      server.kill();
      process.exit(0);
    }, 5000);
  }, 2000);
}, 2000);

// Handle errors
server.on('error', error => {
  console.error(`Server error: ${error.message}`);
  process.exit(1);
});

// Handle server exit
server.on('exit', (code, signal) => {
  if (code) console.log(`Server exited with code ${code}`);
  if (signal) console.log(`Server was killed with signal ${signal}`);
}); 