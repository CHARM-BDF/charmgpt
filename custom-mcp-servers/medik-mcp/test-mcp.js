// Test script for mediKanren MCP server using the MCP SDK
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { spawn } from 'child_process';
import { createInterface } from 'readline';

async function main() {
  console.log('Starting mediKanren MCP server...');
  
  // Start the MCP server process
  const serverProcess = spawn('node', ['dist/index.js']);
  
  // Create readline interface for reading server logs
  const errRl = createInterface({
    input: serverProcess.stderr,
    crlfDelay: Infinity
  });
  
  // Listen for server logs
  errRl.on('line', (line) => {
    console.log(`Server log: ${line}`);
  });
  
  // Wait for server to start up
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  try {
    // Create MCP client with stdio transport
    const transport = new StdioClientTransport({
      input: serverProcess.stdout,
      output: serverProcess.stdin,
    });
    
    const client = new Client();
    await client.connect(transport);
    
    console.log('Connected to MCP server. Listing available tools...');
    
    // List available tools
    const tools = await client.listTools();
    console.log('\n=== AVAILABLE TOOLS ===');
    console.log(JSON.stringify(tools, null, 2));
    
    // Test run-query tool
    console.log('\nTesting run-query tool...');
    const queryResult = await client.callTool('run-query', {
      e1: 'Known->X',
      e2: 'biolink:treats',
      e3: 'MONDO:0005148' // Type 2 diabetes mellitus
    });
    
    console.log('\n=== QUERY RESULTS ===');
    console.log(JSON.stringify(queryResult, null, 2));
    
    console.log('\nTest completed successfully!');
  } catch (error) {
    console.error('Error during test:', error);
  } finally {
    // Clean up
    console.log('Terminating server...');
    serverProcess.kill();
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
}); 