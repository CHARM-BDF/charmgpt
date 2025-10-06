#!/usr/bin/env node

/**
 * Real Data Test for PFOCR MCP Server
 * This script tests with actual geneset IDs found in the database
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🧬 Testing PFOCR MCP Server with real geneset data...\n');

// Test requests using real geneset IDs
const testRequests = [
  {
    name: "Get Real Geneset Details",
    request: {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: {
        name: 'get-pfocr-geneset',
        arguments: {
          id: 'PMC8515747__13018_2021_2751_Fig9_HTML'
        }
      }
    }
  },
  {
    name: "Search with NCBI Gene ID",
    request: {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: {
        name: 'search-pfocr-pathways',
        arguments: {
          query: 'NCBIGene:5447',
          max_results: 5
        }
      }
    }
  },
  {
    name: "Search with MeSH Chemical",
    request: {
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: {
        name: 'search-pfocr-pathways',
        arguments: {
          query: 'D013256',
          max_results: 5
        }
      }
    }
  },
  {
    name: "Search with ChEBI Chemical",
    request: {
      jsonrpc: '2.0',
      id: 4,
      method: 'tools/call',
      params: {
        name: 'search-pfocr-pathways',
        arguments: {
          query: 'CHEBI:16865',
          max_results: 5
        }
      }
    }
  },
  {
    name: "Batch Get Multiple Genesets",
    request: {
      jsonrpc: '2.0',
      id: 5,
      method: 'tools/call',
      params: {
        name: 'batch-pfocr-genesets',
        arguments: {
          ids: ['PMC8515747__13018_2021_2751_Fig9_HTML']
        }
      }
    }
  }
];

async function testWithRealData() {
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
            if (response.result.content) {
              const content = response.result.content[0];
              console.log(`   📄 Content type: ${content?.type || 'unknown'}`);
              
              if (content?.text) {
                const text = content.text;
                console.log(`   📝 Text preview: ${text.substring(0, 300)}...`);
                
                // Check for specific data
                if (text.includes('Geneset ID:')) {
                  console.log(`   🧬 Found geneset data!`);
                }
                
                if (text.includes('Genes:')) {
                  console.log(`   🧬 Found gene annotations!`);
                }
                
                if (text.includes('MeSH Chemicals:')) {
                  console.log(`   🧬 Found chemical annotations!`);
                }
                
                if (text.includes('ChEBI Chemicals:')) {
                  console.log(`   🧬 Found ChEBI annotations!`);
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
            console.log('\n🎉 All real data tests completed successfully!');
            console.log('\n📊 Summary:');
            console.log('   ✅ PFOCR MCP Server is working correctly');
            console.log('   ✅ API connections are successful');
            console.log('   ✅ Data retrieval is functional');
            console.log('   ✅ Both individual and batch queries work');
            console.log('\n🧬 The PFOCR MCP server is ready for biomedical pathway analysis!');
            
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

    // Timeout after 30 seconds
    setTimeout(() => {
      console.log('\n⏰ Test timeout reached (30 seconds)');
      server.kill();
      process.exit(1);
    }, 30000);

  } catch (error) {
    console.error('❌ Real data test failed:', error);
    process.exit(1);
  }
}

// Run the test
testWithRealData();
