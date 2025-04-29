// Script to test MediK MCP and pretty-print the tools list response
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import fs from 'fs';
import path from 'path';

// Get the directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to the built JS file - updated to match actual build output
const mcpPath = path.join(__dirname, 'dist', 'medik-mcp', 'src', 'index.js');

console.log(`Using MCP path: ${mcpPath}`);
console.log(`File exists: ${fs.existsSync(mcpPath)}`);

// Create output directory
const outputDir = path.join(__dirname, 'output');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

console.log('Starting MediK MCP server for testing...');

// Spawn the MCP server
const mcp = spawn('node', [mcpPath], {
  stdio: ['pipe', 'pipe', 'pipe']
});

// Keep a buffer of output lines
const outputBuffer = [];

// Handle server output
mcp.stdout.on('data', (data) => {
  const lines = data.toString().split('\n').filter(line => line.trim() !== '');
  
  lines.forEach(line => {
    outputBuffer.push(line);
    console.log(`Server output: ${line}`);
    
    try {
      // Try to parse the line as JSON
      const json = JSON.parse(line);
      if (json.method === 'tools/list' || json.result?.tools) {
        console.log('\n=== TOOLS LIST RESPONSE DETECTED ===\n');
        console.log('Tools found:');
        
        const tools = json.result?.tools || [];
        tools.forEach(tool => {
          console.log(`- ${tool.name}: ${tool.description.substring(0, 50)}...`);
        });
        
        // Write the response to a file
        const timestamp = new Date().toISOString()
          .replace(/:/g, '-')
          .replace(/\..+/, '')
          .replace('T', '_');
        const outputFile = path.join(outputDir, `tools-response_${timestamp}.json`);
        fs.writeFileSync(outputFile, JSON.stringify(json, null, 2));
        console.log(`\nResponse written to ${outputFile}`);
      }
    } catch (error) {
      // Not valid JSON or another error, ignore
    }
  });
});

mcp.stderr.on('data', (data) => {
  console.error(`Server error: ${data}`);
});

// Wait for the server to start
setTimeout(() => {
  console.log('\nSending tools list request...');
  
  // Send request for tools list
  const listToolsRequest = JSON.stringify({
    method: 'tools/list',
    params: {},
    jsonrpc: '2.0',
    id: 1
  }) + '\n';
  
  mcp.stdin.write(listToolsRequest);
  
  // Wait for response
  setTimeout(() => {
    console.log('\nTest complete. Terminating MCP server.');
    
    // Write all output to a log file
    const logFile = path.join(outputDir, 'test-run.log');
    fs.writeFileSync(logFile, outputBuffer.join('\n'));
    console.log(`Full output written to ${logFile}`);
    
    mcp.kill();
  }, 2000);
}, 1000);

// Handle process exit
mcp.on('close', (code) => {
  console.log(`MCP server exited with code ${code}`);
}); 