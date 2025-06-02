#!/usr/bin/env node

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Test the MCP server by simulating MCP requests
async function testMCPServer() {
  console.log('🧬 Testing ARAX MCP Server');
  console.log('=' .repeat(50));

  const serverPath = join(__dirname, 'dist', 'index.js');
  
  // Test 1: List tools
  console.log('\n📋 Test 1: List available tools');
  await testMCPRequest({
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/list',
    params: {}
  });

  // Test 2: Query entity effects
  console.log('\n🔍 Test 2: Query FAM177A1 effects');
  await testMCPRequest({
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/call',
    params: {
      name: 'query-entity-effects',
      arguments: {
        entity: 'NCBIGene:283635'
      }
    }
  });

  console.log('\n✅ MCP Server testing completed!');
}

function testMCPRequest(request) {
  return new Promise((resolve, reject) => {
    const serverPath = join(__dirname, 'dist', 'index.js');
    const child = spawn('node', [serverPath], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      if (code === 0) {
        try {
          const lines = stdout.trim().split('\n');
          for (const line of lines) {
            if (line.trim()) {
              try {
                const response = JSON.parse(line);
                console.log('📦 Response:', JSON.stringify(response, null, 2));
              } catch (e) {
                console.log('📝 Output:', line);
              }
            }
          }
          resolve();
        } catch (error) {
          console.error('❌ Parse error:', error);
          reject(error);
        }
      } else {
        console.error('❌ Server error:', stderr);
        reject(new Error(`Server exit code: ${code}`));
      }
    });

    // Send the request
    child.stdin.write(JSON.stringify(request) + '\n');
    child.stdin.end();

    // Timeout after 30 seconds
    setTimeout(() => {
      child.kill();
      reject(new Error('Test timeout'));
    }, 30000);
  });
}

// Run the tests
testMCPServer().catch(error => {
  console.error('💥 Test failed:', error);
  process.exit(1);
}); 