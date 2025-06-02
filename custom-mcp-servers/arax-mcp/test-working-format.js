#!/usr/bin/env node

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function testWorkingFormat() {
  console.log('🧬 Testing ARAX MCP with Working Format');
  console.log('=' .repeat(55));
  console.log('Using the exact format that works on arax.ncats.io');
  console.log('');

  try {
    console.log('🔧 Testing: find-connecting-path with working format');
    console.log('📝 Query: NCBIGene:283635 → NCBIGene:28514');
    console.log('');
    
    const response = await sendMCPRequest({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: {
        name: 'find-connecting-path',
        arguments: {
          entity_a: 'NCBIGene:283635',
          entity_b: 'NCBIGene:28514'
        }
      }
    });

    console.log('✅ MCP Response received!');
    console.log('📊 Response structure:');
    console.log(`   - Type: ${typeof response}`);
    console.log(`   - Has artifacts: ${response.artifacts ? 'Yes' : 'No'}`);
    
    if (response.artifacts && response.artifacts.length > 0) {
      const artifact = response.artifacts[0];
      console.log(`   - Artifact type: ${artifact.type}`);
      console.log(`   - Data type: ${typeof artifact.data}`);
      
      if (artifact.data && typeof artifact.data === 'object') {
        console.log(`   - Nodes: ${artifact.data.nodes?.length || 0}`);
        console.log(`   - Links: ${artifact.data.links?.length || 0}`);
        console.log('');
        
        if (artifact.data.nodes?.length > 0) {
          console.log('🎯 SUCCESS: Found connecting path!');
          console.log(`📈 Network: ${artifact.data.nodes.length} nodes, ${artifact.data.links?.length || 0} connections`);
          
          // Show starting nodes
          const startingNodes = artifact.data.nodes.filter(n => n.isStartingNode);
          if (startingNodes.length === 2) {
            console.log('🎪 Starting nodes:');
            startingNodes.forEach(node => {
              console.log(`   - ${node.name} (${node.id}) - ${node.entityType}`);
            });
          }
        }
      }
    } else {
      console.log('⚠️  No artifacts in response');
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.timeout) {
      console.error('⏰ The query timed out - this suggests ARAX is still taking too long');
      console.error('💡 Try increasing timeout further or the format may still need adjustment');
    }
  }
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

    const timeout = setTimeout(() => {
      if (!isResolved) {
        isResolved = true;
        child.kill();
        reject(new Error('MCP request timed out after 90 seconds'));
      }
    }, 90000); // 90 second timeout

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

// Run the test
testWorkingFormat()
  .then(() => {
    console.log('\n🎉 Working format test completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Working format test failed:', error.message);
    process.exit(1);
  }); 