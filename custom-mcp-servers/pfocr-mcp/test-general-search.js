#!/usr/bin/env node

/**
 * General Search Test for PFOCR MCP Server
 * This script tests with broader search terms to see what data is available
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🧬 Testing PFOCR MCP Server with general pathway searches...\n');

// Test requests with broader terms
const testRequests = [
  {
    name: "Search Cancer Pathways",
    request: {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: {
        name: 'search-pfocr-pathways',
        arguments: {
          query: 'cancer',
          max_results: 5
        }
      }
    }
  },
  {
    name: "Search Metabolism Pathways",
    request: {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: {
        name: 'search-pfocr-pathways',
        arguments: {
          query: 'metabolism',
          max_results: 5
        }
      }
    }
  },
  {
    name: "Search Signaling Pathways",
    request: {
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: {
        name: 'search-pfocr-pathways',
        arguments: {
          query: 'signaling',
          max_results: 5
        }
      }
    }
  },
  {
    name: "Search with Gene Symbol TP53",
    request: {
      jsonrpc: '2.0',
      id: 4,
      method: 'tools/call',
      params: {
        name: 'search-pfocr-pathways',
        arguments: {
          query: 'TP53',
          max_results: 5
        }
      }
    }
  }
];

async function testGeneralSearch() {
  try {
    console.log('🚀 Starting PFOCR MCP Server...');
    
    const server = spawn('node', [join(__dirname, 'dist/index.js')], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let responseCount = 0;
    const expectedResponses = testRequests.length;
    let genesetIds = [];

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
            if (response.result.content) {
              const content = response.result.content[0];
              console.log(`   📄 Content type: ${content?.type || 'unknown'}`);
              
              if (content?.text) {
                const text = content.text;
                console.log(`   📝 Text preview: ${text.substring(0, 200)}...`);
                
                // Extract geneset IDs from search results
                if (text.includes('Geneset ID:')) {
                  const idMatches = text.match(/Geneset ID:\*\* ([^\n]+)/g);
                  if (idMatches) {
                    const ids = idMatches.map(match => match.replace('Geneset ID:** ', ''));
                    genesetIds.push(...ids);
                    console.log(`   🧬 Found geneset IDs: ${ids.join(', ')}`);
                  }
                }
                
                // Check if we found any results
                if (text.includes('Found') && text.includes('pathway figures')) {
                  const match = text.match(/Found (\d+) pathway figures/);
                  if (match) {
                    console.log(`   📊 Results found: ${match[1]} pathway figures`);
                  }
                }
              }
            }
            
            if (response.result.artifacts) {
              console.log(`   📊 Artifacts: ${response.result.artifacts.length} files`);
            }
          }
          
          console.log('   ' + '─'.repeat(50));
          
          if (responseCount >= expectedResponses) {
            console.log('\n🎉 All general search tests completed!');
            
            if (genesetIds.length > 0) {
              console.log(`\n🔍 Found ${genesetIds.length} geneset IDs total`);
              console.log(`   IDs: ${genesetIds.join(', ')}`);
              
              // Test getting details for the first geneset
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
              
              setTimeout(() => {
                console.log('\n✅ General search test completed with detailed geneset retrieval!');
                server.kill();
                process.exit(0);
              }, 3000);
            } else {
              console.log('\n⚠️  No geneset IDs found in any search results');
              console.log('   This might indicate the PFOCR database is empty or the search terms need adjustment');
              server.kill();
              process.exit(0);
            }
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

    // Timeout after 30 seconds
    setTimeout(() => {
      console.log('\n⏰ Test timeout reached (30 seconds)');
      server.kill();
      process.exit(1);
    }, 30000);

  } catch (error) {
    console.error('❌ General search test failed:', error);
    process.exit(1);
  }
}

// Run the test
testGeneralSearch();
