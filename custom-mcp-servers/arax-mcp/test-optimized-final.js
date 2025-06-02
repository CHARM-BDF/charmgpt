#!/usr/bin/env node

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function runOptimizedTests() {
  console.log('🚀 ARAX MCP Server - Optimized Performance Test');
  console.log('=' .repeat(60));
  console.log('Testing both tools with fast working format');
  console.log('');

  const tests = [
    {
      name: 'query-entity-effects',
      description: 'Find all connections for FAM177A1',
      request: {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: {
          name: 'query-entity-effects',
          arguments: {
            entity: 'NCBIGene:283635'
          }
        }
      }
    },
    {
      name: 'find-connecting-path', 
      description: 'Find path between two genes',
      request: {
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: {
          name: 'find-connecting-path',
          arguments: {
            entity_a: 'NCBIGene:283635',
            entity_b: 'NCBIGene:28514'
          }
        }
      }
    }
  ];

  for (const test of tests) {
    console.log(`🔧 Testing: ${test.name}`);
    console.log(`📝 ${test.description}`);
    
    const startTime = Date.now();
    
    try {
      const response = await sendMCPRequest(test.request);
      const duration = Date.now() - startTime;
      
      console.log(`⏱️  Duration: ${duration}ms`);
      console.log(`✅ Success!`);
      
      if (response.artifacts && response.artifacts.length > 0) {
        const artifact = response.artifacts[0];
        if (artifact.data) {
          const nodes = artifact.data.nodes?.length || 0;
          const links = artifact.data.links?.length || 0;
          console.log(`📊 Results: ${nodes} nodes, ${links} connections`);
          
          if (test.name === 'find-connecting-path') {
            const startingNodes = artifact.data.nodes?.filter(n => n.isStartingNode) || [];
            console.log(`🎯 Starting nodes: ${startingNodes.length}`);
          }
        }
      }
      
      // Check if it was fast enough (under 30 seconds)
      if (duration < 30000) {
        console.log('🏎️  FAST: Query completed in under 30 seconds!');
      } else {
        console.log('🐌 SLOW: Query took over 30 seconds');
      }
      
    } catch (error) {
      const duration = Date.now() - startTime;
      console.log(`⏱️  Duration: ${duration}ms`);
      console.error(`❌ Failed: ${error.message}`);
      
      if (error.message.includes('timeout')) {
        console.error('⏰ TIMEOUT: Query was too slow');
      }
    }
    
    console.log('');
  }
  
  console.log('🎉 Optimized performance test completed!');
}

async function sendMCPRequest(request) {
  return new Promise((resolve, reject) => {
    const child = spawn('node', ['dist/index.js'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: __dirname
    });

    let responseData = '';
    let errorData = '';
    let isResolved = false;

    // 60 second timeout for testing
    const timeout = setTimeout(() => {
      if (!isResolved) {
        isResolved = true;
        child.kill();
        reject(new Error('MCP request timed out after 60 seconds'));
      }
    }, 60000);

    child.stdout.on('data', (data) => {
      responseData += data.toString();
    });

    child.stderr.on('data', (data) => {
      errorData += data.toString();
    });

    child.on('close', (code) => {
      if (isResolved) return;
      isResolved = true;
      clearTimeout(timeout);

      if (code !== 0) {
        reject(new Error(`MCP server exited with code ${code}. Error: ${errorData}`));
        return;
      }

      try {
        const lines = responseData.trim().split('\n');
        const responseLine = lines.find(line => {
          try {
            const parsed = JSON.parse(line);
            return parsed.id === request.id && parsed.result;
          } catch {
            return false;
          }
        });

        if (responseLine) {
          const response = JSON.parse(responseLine);
          resolve(response.result);
        } else {
          reject(new Error('No valid response found'));
        }
      } catch (error) {
        reject(new Error(`Failed to parse response: ${error.message}`));
      }
    });

    // Send the request
    child.stdin.write(JSON.stringify(request) + '\n');
    child.stdin.end();
  });
}

runOptimizedTests()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n💥 Test suite failed:', error.message);
    process.exit(1);
  }); 