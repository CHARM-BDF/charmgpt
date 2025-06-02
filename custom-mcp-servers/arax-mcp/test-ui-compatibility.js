#!/usr/bin/env node

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Comprehensive test to verify UI compatibility
async function testUICompatibility() {
  console.log('🧬 Testing ARAX MCP Server UI Compatibility');
  console.log('=' .repeat(60));
  console.log('This test verifies that ARAX MCP outputs the exact same');
  console.log('format as medik-mcp2 so the UI can use both servers.');
  console.log('');

  try {
    // Test 1: List tools to verify server works
    console.log('📋 Test 1: Server responds to tools/list');
    const toolsResponse = await sendMCPRequest({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/list',
      params: {}
    });

    if (toolsResponse && toolsResponse.result && toolsResponse.result.tools) {
      console.log('✅ Server responds correctly');
      console.log(`   Found ${toolsResponse.result.tools.length} tools`);
      toolsResponse.result.tools.forEach(tool => {
        console.log(`   • ${tool.name}: ${tool.description}`);
      });
    } else {
      throw new Error('Server did not return tools properly');
    }

    console.log('');

    // Test 2: Real query to verify output format
    console.log('🔍 Test 2: Real query with format validation');
    console.log('   Querying: FAM177A1 effects (same as our original test)');
    
    const queryResponse = await sendMCPRequest({
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

    if (!queryResponse || !queryResponse.result) {
      throw new Error('Query failed to return results');
    }

    console.log('✅ Query executed successfully');

    // Validate MCP response structure
    const result = queryResponse.result;
    
    console.log('');
    console.log('📦 Validating MCP Response Format:');
    
    // Check content array
    if (!result.content || !Array.isArray(result.content)) {
      throw new Error('Missing or invalid content array');
    }
    console.log('✅ Has content array');

    // Check artifacts array (like medik-mcp2)
    if (!result.artifacts || !Array.isArray(result.artifacts)) {
      throw new Error('Missing or invalid artifacts array');
    }
    console.log('✅ Has artifacts array (matches medik-mcp2)');

    // Check artifact structure
    const artifact = result.artifacts[0];
    if (!artifact || artifact.type !== 'application/vnd.knowledge-graph') {
      throw new Error('Invalid artifact type');
    }
    console.log('✅ Correct artifact type: application/vnd.knowledge-graph');

    // Parse and validate knowledge graph structure
    let knowledgeGraph;
    try {
      knowledgeGraph = JSON.parse(artifact.content);
    } catch (e) {
      throw new Error('Artifact content is not valid JSON');
    }
    console.log('✅ Artifact content is valid JSON');

    console.log('');
    console.log('📊 Validating Knowledge Graph Structure:');

    // Check top-level properties (medik-mcp2 format)
    if (!Array.isArray(knowledgeGraph.nodes)) {
      throw new Error('Missing or invalid nodes array');
    }
    console.log('✅ Has nodes array');

    if (!Array.isArray(knowledgeGraph.links)) {
      throw new Error('Missing or invalid links array');
    }
    console.log('✅ Has links array');

    if (typeof knowledgeGraph.filteredCount !== 'number') {
      throw new Error('Missing or invalid filteredCount');
    }
    console.log('✅ Has filteredCount (medik-mcp2 format)');

    if (typeof knowledgeGraph.filteredNodeCount !== 'number') {
      throw new Error('Missing or invalid filteredNodeCount');
    }
    console.log('✅ Has filteredNodeCount (medik-mcp2 format)');

    // Validate node structure
    if (knowledgeGraph.nodes.length > 0) {
      const node = knowledgeGraph.nodes[0];
      const requiredNodeProps = ['id', 'name', 'entityType', 'group', 'isStartingNode', 'val', 'connections'];
      
      for (const prop of requiredNodeProps) {
        if (!(prop in node)) {
          throw new Error(`Node missing required property: ${prop}`);
        }
      }
      console.log('✅ Node structure matches medik-mcp2 format');
      console.log(`   • Has entityType: "${node.entityType}" (not entity_type)`);
      console.log(`   • Has isStartingNode: ${node.isStartingNode}`);
    }

    // Validate link structure  
    if (knowledgeGraph.links.length > 0) {
      const link = knowledgeGraph.links[0];
      const requiredLinkProps = ['source', 'target', 'label', 'value', 'evidence'];
      
      for (const prop of requiredLinkProps) {
        if (!(prop in link)) {
          throw new Error(`Link missing required property: ${prop}`);
        }
      }
      console.log('✅ Link structure matches medik-mcp2 format');
      console.log(`   • Has label: "${link.label}" (not predicate)`);
      console.log(`   • Has value: ${link.value} (not confidence)`);
    }

    console.log('');
    console.log('📈 Query Results Summary:');
    console.log(`   • Nodes: ${knowledgeGraph.nodes.length}`);
    console.log(`   • Links: ${knowledgeGraph.links.length}`);
    console.log(`   • Filtered count: ${knowledgeGraph.filteredCount}`);
    console.log(`   • Filtered node count: ${knowledgeGraph.filteredNodeCount}`);

    if (knowledgeGraph.nodes.length > 0) {
      console.log('   • Sample entities:');
      knowledgeGraph.nodes.slice(0, 3).forEach((node, i) => {
        console.log(`     ${i + 1}. ${node.name} (${node.entityType}) [Starting: ${node.isStartingNode}]`);
      });
    }

    console.log('');
    console.log('🎉 UI COMPATIBILITY TEST: PASSED ✅');
    console.log('');
    console.log('🔄 Format Verification Results:');
    console.log('✅ Uses artifacts array (same as medik-mcp2)');
    console.log('✅ Knowledge graph structure identical to medik-mcp2');
    console.log('✅ Node properties: entityType, isStartingNode, etc.');
    console.log('✅ Link properties: label, value, evidence');
    console.log('✅ Top-level properties: filteredCount, filteredNodeCount');

  } catch (error) {
    console.error('');
    console.error('❌ UI COMPATIBILITY TEST: FAILED');
    console.error('💥 Error:', error.message);
    console.error('');
    console.error('🔧 This indicates the format is not compatible with the UI.');
    console.error('   The UI expects the medik-mcp2 format exactly.');
  }
}

function sendMCPRequest(request) {
  return new Promise((resolve, reject) => {
    const serverPath = join(__dirname, 'dist', 'index.js');
    const child = spawn('node', [serverPath], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';
    let resolved = false;

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      if (resolved) return;
      resolved = true;
      
      if (code === 0) {
        try {
          const lines = stdout.trim().split('\n');
          for (const line of lines) {
            if (line.trim()) {
              try {
                const response = JSON.parse(line);
                if (response.id === request.id) {
                  resolve(response);
                  return;
                }
              } catch (e) {
                // Skip non-JSON lines
              }
            }
          }
          reject(new Error('No matching response found'));
        } catch (error) {
          reject(error);
        }
      } else {
        reject(new Error(`Server exit code: ${code}. Stderr: ${stderr}`));
      }
    });

    // Send the request
    child.stdin.write(JSON.stringify(request) + '\n');
    child.stdin.end();

    // Timeout after 45 seconds (ARAX queries can be slow)
    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        child.kill();
        reject(new Error('Test timeout - query took too long'));
      }
    }, 45000);
  });
}

// Run the test
testUICompatibility().catch(error => {
  console.error('💥 Test suite failed:', error);
  process.exit(1);
}); 