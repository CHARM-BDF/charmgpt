#!/usr/bin/env node

/**
 * Test script for the new build-entity-network tool
 */

const { spawn } = require('child_process');

async function testEntityNetwork() {
  console.log('🧬 Testing PubTator Entity Network Tool...\n');
  
  const mcpProcess = spawn('node', ['dist/index.js'], {
    stdio: ['pipe', 'pipe', 'pipe']
  });
  
  let output = '';
  let errorOutput = '';
  
  mcpProcess.stdout.on('data', (data) => {
    output += data.toString();
  });
  
  mcpProcess.stderr.on('data', (data) => {
    errorOutput += data.toString();
  });
  
  // Wait for server to start
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  try {
    // Test 1: List tools to verify the new tool is available
    console.log('📋 Test 1: Listing available tools...');
    const listToolsRequest = {
      jsonrpc: "2.0",
      id: 1,
      method: "tools/list",
      params: {}
    };
    
    mcpProcess.stdin.write(JSON.stringify(listToolsRequest) + '\n');
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Test 2: Build entity network for BRCA1 gene
    console.log('🔬 Test 2: Building entity network for BRCA1 gene...');
    const buildNetworkRequest = {
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: {
        name: "build-entity-network",
        arguments: {
          query: "BRCA1",
          concept: "gene",
          max_entities: 3,
          max_relations_per_entity: 50
        }
      }
    };
    
    mcpProcess.stdin.write(JSON.stringify(buildNetworkRequest) + '\n');
    await new Promise(resolve => setTimeout(resolve, 10000)); // Give it time to process
    
    // Test 3: Build entity network for cancer disease
    console.log('🏥 Test 3: Building entity network for cancer disease...');
    const buildNetworkRequest2 = {
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: {
        name: "build-entity-network",
        arguments: {
          query: "cancer",
          concept: "disease",
          max_entities: 2,
          max_relations_per_entity: 30
        }
      }
    };
    
    mcpProcess.stdin.write(JSON.stringify(buildNetworkRequest2) + '\n');
    await new Promise(resolve => setTimeout(resolve, 8000));
    
  } catch (error) {
    console.error('❌ Test error:', error);
  } finally {
    mcpProcess.kill();
  }
  
  console.log('\n📊 Test Results:');
  console.log('================');
  console.log('STDOUT:', output);
  if (errorOutput) {
    console.log('STDERR:', errorOutput);
  }
  
  console.log('\n✅ Entity Network Tool Test Complete!');
}

testEntityNetwork().catch(console.error);
