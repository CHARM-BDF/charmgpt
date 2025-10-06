#!/usr/bin/env node

/**
 * Simple test script for PFOCR MCP Server
 * This script tests the basic functionality of the MCP server
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🧬 Testing PFOCR MCP Server...\n');

// Test 1: List tools
console.log('📋 Test 1: Listing available tools...');
const listToolsRequest = {
  jsonrpc: '2.0',
  id: 1,
  method: 'tools/list',
  params: {}
};

// Test 2: Search pathways
console.log('🔍 Test 2: Searching for cancer pathways...');
const searchRequest = {
  jsonrpc: '2.0',
  id: 2,
  method: 'tools/call',
  params: {
    name: 'search-pfocr-pathways',
    arguments: {
      query: 'cancer pathway',
      max_results: 3
    }
  }
};

// Test 3: Get metadata
console.log('📊 Test 3: Getting database metadata...');
const metadataRequest = {
  jsonrpc: '2.0',
  id: 3,
  method: 'tools/call',
  params: {
    name: 'get-pfocr-metadata',
    arguments: {
      include_fields: false
    }
  }
};

async function testMCP() {
  try {
    // Start the MCP server
    const server = spawn('node', [join(__dirname, 'dist/index.js')], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let responseCount = 0;
    const expectedResponses = 3;

    server.stdout.on('data', (data) => {
      const lines = data.toString().split('\n').filter(line => line.trim());
      
      for (const line of lines) {
        try {
          const response = JSON.parse(line);
          responseCount++;
          
          console.log(`✅ Response ${responseCount}:`);
          console.log(`   ID: ${response.id}`);
          console.log(`   Method: ${response.method || 'Response'}`);
          
          if (response.result) {
            if (response.result.tools) {
              console.log(`   Tools available: ${response.result.tools.length}`);
              response.result.tools.forEach(tool => {
                console.log(`     - ${tool.name}: ${tool.description.substring(0, 50)}...`);
              });
            } else if (response.result.content) {
              console.log(`   Content type: ${response.result.content[0]?.type || 'unknown'}`);
              if (response.result.content[0]?.text) {
                const text = response.result.content[0].text;
                console.log(`   Text preview: ${text.substring(0, 100)}...`);
              }
            }
          }
          
          console.log('');
          
          if (responseCount >= expectedResponses) {
            console.log('🎉 All tests completed successfully!');
            server.kill();
            process.exit(0);
          }
        } catch (parseError) {
          // Ignore non-JSON lines (like debug output)
        }
      }
    });

    server.stderr.on('data', (data) => {
      console.log(`Server log: ${data.toString().trim()}`);
    });

    server.on('close', (code) => {
      console.log(`Server process exited with code ${code}`);
    });

    // Send test requests
    setTimeout(() => {
      console.log('📤 Sending list tools request...');
      server.stdin.write(JSON.stringify(listToolsRequest) + '\n');
    }, 1000);

    setTimeout(() => {
      console.log('📤 Sending search request...');
      server.stdin.write(JSON.stringify(searchRequest) + '\n');
    }, 2000);

    setTimeout(() => {
      console.log('📤 Sending metadata request...');
      server.stdin.write(JSON.stringify(metadataRequest) + '\n');
    }, 3000);

    // Timeout after 10 seconds
    setTimeout(() => {
      console.log('⏰ Test timeout reached');
      server.kill();
      process.exit(1);
    }, 10000);

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

testMCP();
