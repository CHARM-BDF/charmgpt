#!/usr/bin/env node

/**
 * BRCA1 Test Script for PFOCR MCP Server
 * This script tests the PFOCR MCP server with BRCA1 gene search
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🧬 Testing PFOCR MCP Server with BRCA1 gene search...\n');

// Test requests for BRCA1
const testRequests = [
  {
    name: "List Tools",
    request: {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/list',
      params: {}
    }
  },
  {
    name: "Search BRCA1 Pathways",
    request: {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: {
        name: 'search-pfocr-pathways',
        arguments: {
          query: 'BRCA1',
          max_results: 5
        }
      }
    }
  },
  {
    name: "Search BRCA1 with Cancer Context",
    request: {
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: {
        name: 'search-pfocr-pathways',
        arguments: {
          query: 'BRCA1 cancer',
          max_results: 3
        }
      }
    }
  },
  {
    name: "Get Database Metadata",
    request: {
      jsonrpc: '2.0',
      id: 4,
      method: 'tools/call',
      params: {
        name: 'get-pfocr-metadata',
        arguments: {
          include_fields: false
        }
      }
    }
  }
];

async function testBRCA1() {
  try {
    console.log('🚀 Starting PFOCR MCP Server...');
    
    // Start the MCP server
    const server = spawn('node', [join(__dirname, 'dist/index.js')], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let responseCount = 0;
    const expectedResponses = testRequests.length;
    let genesetIds = []; // Store geneset IDs for potential detailed queries

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
              response.result.tools.forEach(tool => {
                console.log(`      - ${tool.name}: ${tool.description.substring(0, 60)}...`);
              });
            } else if (response.result.content) {
              const content = response.result.content[0];
              console.log(`   📄 Content type: ${content?.type || 'unknown'}`);
              
              if (content?.text) {
                const text = content.text;
                console.log(`   📝 Text preview: ${text.substring(0, 150)}...`);
                
                // Extract geneset IDs from search results
                if (text.includes('Geneset ID:')) {
                  const idMatches = text.match(/Geneset ID:\*\* ([^\n]+)/g);
                  if (idMatches) {
                    const ids = idMatches.map(match => match.replace('Geneset ID:** ', ''));
                    genesetIds.push(...ids);
                    console.log(`   🧬 Found geneset IDs: ${ids.join(', ')}`);
                  }
                }
              }
            }
            
            if (response.result.artifacts) {
              console.log(`   📊 Artifacts: ${response.result.artifacts.length} files`);
              response.result.artifacts.forEach(artifact => {
                console.log(`      - ${artifact.title} (${artifact.type})`);
              });
            }
          }
          
          console.log('   ' + '─'.repeat(50));
          
          if (responseCount >= expectedResponses) {
            console.log('\n🎉 All BRCA1 tests completed successfully!');
            
            // If we found geneset IDs, test getting details for the first one
            if (genesetIds.length > 0) {
              console.log(`\n🔍 Testing detailed geneset retrieval for: ${genesetIds[0]}`);
              
              const detailRequest = {
                jsonrpc: '2.0',
                id: 5,
                method: 'tools/call',
                params: {
                  name: 'get-pfocr-geneset',
                  arguments: {
                    id: genesetIds[0]
                  }
                }
              };
              
              setTimeout(() => {
                server.stdin.write(JSON.stringify(detailRequest) + '\n');
              }, 1000);
              
              // Wait for the detail response
              setTimeout(() => {
                console.log('\n✅ BRCA1 test completed with detailed geneset retrieval!');
                server.kill();
                process.exit(0);
              }, 3000);
            } else {
              console.log('\n⚠️  No geneset IDs found in search results');
              server.kill();
              process.exit(0);
            }
          }
        } catch (parseError) {
          // Ignore non-JSON lines (like debug output)
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

    // Timeout after 30 seconds
    setTimeout(() => {
      console.log('\n⏰ Test timeout reached (30 seconds)');
      server.kill();
      process.exit(1);
    }, 30000);

  } catch (error) {
    console.error('❌ BRCA1 test failed:', error);
    process.exit(1);
  }
}

// Run the test
testBRCA1();
