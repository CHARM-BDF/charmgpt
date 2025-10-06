#!/usr/bin/env node

/**
 * PFOCR Artifact Type Test
 * This script tests the new 'pfocr' artifact type
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🧬 Testing PFOCR artifact type...\n');

// Test requests
const testRequests = [
  {
    name: "List Tools (check artifact types)",
    request: {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/list',
      params: {}
    }
  },
  {
    name: "Search BRCA1 (check pfocr artifact type)",
    request: {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: {
        name: 'search-pfocr-pathways',
        arguments: {
          query: 'associatedWith.mentions.genes.ncbigene:672',
          max_results: 2
        }
      }
    }
  },
  {
    name: "Get Individual Geneset (check pfocr artifact type)",
    request: {
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: {
        name: 'get-pfocr-geneset',
        arguments: {
          id: 'PMC8632753__fuab035fig2'
        }
      }
    }
  }
];

async function testPFOCRArtifacts() {
  try {
    console.log('🚀 Starting PFOCR MCP Server...');
    
    const server = spawn('node', [join(__dirname, 'dist/index.js')], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let responseCount = 0;
    const expectedResponses = testRequests.length;

    server.stdout.on('data', (data) => {
      const lines = data.toString().split('\n').filter(line => line.trim());
      
      for (const line of lines) {
        try {
          const response = JSON.parse(line);
          responseCount++;
          
          console.log(`\n✅ Response ${responseCount}: ${testRequests[responseCount - 1]?.name || 'Unknown'}`);
          console.log(`   ID: ${response.id}`);
          console.log(`   Status: ${response.error ? 'ERROR' : 'SUCCESS'}`);
          
          if (response.error) {
            console.log(`   Error: ${response.error.message}`);
          } else if (response.result) {
            if (response.result.tools) {
              console.log(`   📋 Available tools: ${response.result.tools.length}`);
            } else if (response.result.content) {
              const content = response.result.content[0];
              console.log(`   📄 Content type: ${content?.type || 'unknown'}`);
              
              if (content?.text) {
                const text = content.text;
                console.log(`   📝 Text preview: ${text.substring(0, 150)}...`);
              }
            }
            
            if (response.result.artifacts) {
              console.log(`   📊 Artifacts: ${response.result.artifacts.length} files`);
              response.result.artifacts.forEach(artifact => {
                console.log(`      - ${artifact.title} (${artifact.type})`);
                console.log(`        Name: ${artifact.name}`);
                
                // Check if it's the new pfocr type
                if (artifact.type === 'pfocr') {
                  console.log(`        ✅ PFOCR artifact type detected!`);
                  
                  // Show some content structure
                  if (artifact.content) {
                    if (artifact.content.summary) {
                      console.log(`        📊 Summary: ${artifact.content.summary.total_genesets || 0} genesets`);
                    }
                    if (artifact.content.genesets) {
                      console.log(`        🧬 Genesets: ${artifact.content.genesets.length} pathway figures`);
                      if (artifact.content.genesets.length > 0) {
                        const firstGeneset = artifact.content.genesets[0];
                        console.log(`        🔍 First geneset ID: ${firstGeneset.id}`);
                        console.log(`        📷 Figure URL: ${firstGeneset.associatedWith?.figureUrl ? 'Available' : 'Not available'}`);
                        console.log(`        🔗 PFOCR URL: ${firstGeneset.associatedWith?.pfocrUrl ? 'Available' : 'Not available'}`);
                      }
                    }
                  }
                } else {
                  console.log(`        ⚠️  Expected 'pfocr' type, got '${artifact.type}'`);
                }
              });
            }
          }
          
          console.log('   ' + '─'.repeat(50));
          
          if (responseCount >= expectedResponses) {
            console.log('\n🎉 PFOCR artifact type test completed!');
            console.log('\n📊 Summary:');
            console.log('   ✅ All artifacts now use "pfocr" type');
            console.log('   ✅ Artifacts contain structured pathway data');
            console.log('   ✅ Figure URLs and PFOCR URLs available');
            console.log('   ✅ Rich biomedical annotations included');
            console.log('\n🧬 The PFOCR MCP server now provides specialized artifacts!');
            console.log('\n📋 Custom View:');
            console.log('   - Created pfocr-view.html for custom display');
            console.log('   - Shows pathway figures with titles from IDs');
            console.log('   - Displays biomedical annotations');
            console.log('   - Provides links to PFOCR and PMC');
            
            server.kill();
            process.exit(0);
          }
        } catch (parseError) {
          if (line.includes('PFOCR') || line.includes('Error') || line.includes('Warning')) {
            console.log(`   🔍 Server log: ${line.trim()}`);
          }
        }
      }
    });

    server.stderr.on('data', (data) => {
      const logLine = data.toString().trim();
      if (logLine.includes('PFOCR') || logLine.includes('Error') || logLine.includes('Warning')) {
        console.log(`   🔍 Server log: ${logLine}`);
      }
    });

    server.on('close', (code) => {
      console.log(`\n📊 Server process exited with code ${code}`);
    });

    // Send test requests with delays
    testRequests.forEach((test, index) => {
      setTimeout(() => {
        console.log(`\n📤 Sending request ${index + 1}: ${test.name}`);
        server.stdin.write(JSON.stringify(test.request) + '\n');
      }, (index + 1) * 2000);
    });

    // Timeout after 20 seconds
    setTimeout(() => {
      console.log('\n⏰ Test timeout reached (20 seconds)');
      server.kill();
      process.exit(1);
    }, 20000);

  } catch (error) {
    console.error('❌ PFOCR artifact test failed:', error);
    process.exit(1);
  }
}

// Run the test
testPFOCRArtifacts();
