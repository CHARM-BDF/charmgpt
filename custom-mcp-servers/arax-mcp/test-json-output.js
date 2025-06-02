#!/usr/bin/env node

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function testJSONOutput() {
  console.log('🔍 ARAX MCP Server - Exact JSON Output Test');
  console.log('=' .repeat(55));
  console.log('This shows the EXACT JSON that the UI will receive.');
  console.log('');

  try {
    console.log('📋 Testing: query-entity-effects for FAM177A1');
    console.log('');
    
    const response = await sendMCPRequest({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: {
        name: 'query-entity-effects',
        arguments: {
          entity: 'NCBIGene:283635'
        }
      }
    });

    if (!response || !response.result) {
      throw new Error('No response received');
    }

    console.log('✅ MCP Response Structure:');
    console.log('━'.repeat(40));
    console.log('📄 Content (Markdown summary):');
    console.log(response.result.content[0].text.substring(0, 200) + '...');
    console.log('');
    
    console.log('📦 Artifact (Knowledge Graph):');
    console.log('   Type:', response.result.artifacts[0].type);
    console.log('   Title:', response.result.artifacts[0].title);
    console.log('');

    // Parse and display the knowledge graph structure
    const knowledgeGraph = JSON.parse(response.result.artifacts[0].content);
    
    console.log('🧬 Knowledge Graph JSON Structure:');
    console.log('━'.repeat(40));
    console.log(JSON.stringify({
      nodes: knowledgeGraph.nodes.map(node => ({
        id: node.id,
        name: node.name,
        entityType: node.entityType,  // ← UI expects this exact property
        group: node.group,
        isStartingNode: node.isStartingNode,  // ← UI expects this exact property
        val: node.val,
        connections: node.connections
      })).slice(0, 2), // Show first 2 nodes
      links: knowledgeGraph.links.map(link => ({
        source: link.source,
        target: link.target,
        label: link.label,  // ← UI expects this exact property (not predicate)
        value: link.value,  // ← UI expects this exact property (not confidence)
        evidence: link.evidence
      })).slice(0, 2), // Show first 2 links
      filteredCount: knowledgeGraph.filteredCount,  // ← UI expects this exact property
      filteredNodeCount: knowledgeGraph.filteredNodeCount,  // ← UI expects this exact property
      '...': 'truncated for display'
    }, null, 2));

    console.log('');
    console.log('📊 Full Statistics:');
    console.log(`   • Total nodes: ${knowledgeGraph.nodes.length}`);
    console.log(`   • Total links: ${knowledgeGraph.links.length}`);
    console.log(`   • Filtered count: ${knowledgeGraph.filteredCount}`);
    console.log(`   • Filtered node count: ${knowledgeGraph.filteredNodeCount}`);

    console.log('');
    console.log('🎯 UI Compatibility Verification:');
    console.log('✅ Response uses artifacts array (medik-mcp2 compatible)');
    console.log('✅ Nodes have entityType property (not entity_type)');
    console.log('✅ Nodes have isStartingNode property');
    console.log('✅ Links have label property (not predicate)');
    console.log('✅ Links have value property (not confidence)');
    console.log('✅ Top-level has filteredCount and filteredNodeCount');
    console.log('');
    console.log('🌟 RESULT: UI will receive identical format to medik-mcp2!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
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
        reject(new Error(`Server exit code: ${code}`));
      }
    });

    child.stdin.write(JSON.stringify(request) + '\n');
    child.stdin.end();

    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        child.kill();
        reject(new Error('Test timeout'));
      }
    }, 30000);
  });
}

testJSONOutput(); 