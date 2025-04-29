// Simple test script to check available tools in MediK MCP
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to the built JS file
const mcpPath = path.join(__dirname, 'dist', 'index.js');

// Check if build exists
if (!fs.existsSync(mcpPath)) {
  console.error('Error: Built MCP server not found. Run npm run build first.');
  process.exit(1);
}

console.log('Starting MediK MCP server for testing...');

// Spawn the MCP server
const mcp = spawn('node', [mcpPath], {
  stdio: ['pipe', 'pipe', 'pipe']
});

// Handle server output
mcp.stdout.on('data', (data) => {
  console.log(`MCP stdout: ${data}`);
});

mcp.stderr.on('data', (data) => {
  console.error(`MCP stderr: ${data}`);
});

// Wait 1 second for the server to start
setTimeout(() => {
  console.log('Sending tools list request...');
  
  // Send request for tools list
  const listToolsRequest = JSON.stringify({
    method: 'tools/list',
    params: {}
  }) + '\n';
  
  mcp.stdin.write(listToolsRequest);
  
  // Wait 1 second for response
  setTimeout(() => {
    console.log('Test complete. Terminating MCP server.');
    mcp.kill();
  }, 1000);
}, 1000);

// Handle process exit
mcp.on('close', (code) => {
  console.log(`MCP server exited with code ${code}`);
}); 