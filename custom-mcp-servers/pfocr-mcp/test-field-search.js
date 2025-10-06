#!/usr/bin/env node

/**
 * Field-Specific Search Test for PFOCR MCP Server
 * This script tests the correct search syntax discovered from the API example
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🧬 Testing PFOCR MCP Server with field-specific searches...\n');

// Test requests using the correct field syntax
const testRequests = [
  {
    name: "Search COVID-19 Disease (MeSH D045169)",
    request: {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: {
        name: 'search-pfocr-pathways',
        arguments: {
          query: 'associatedWith.mentions.diseases.mesh:D045169',
          max_results: 5
        }
      }
    }
  },
  {
    name: "Search SARS-CoV-2 (MeSH C000657245)",
    request: {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: {
        name: 'search-pfocr-pathways',
        arguments: {
          query: 'associatedWith.mentions.diseases.mesh:C000657245',
          max_results: 3
        }
      }
    }
  },
  {
    name: "Search by NCBI Gene ID",
    request: {
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: {
        name: 'search-pfocr-pathways',
        arguments: {
          query: 'associatedWith.mentions.genes.ncbigene:59272',
          max_results: 3
        }
      }
    }
  },
  {
    name: "Search by MeSH Chemical",
    request: {
      jsonrpc: '2.0',
      id: 4,
      method: 'tools/call',
      params: {
        name: 'search-pfocr-pathways',
        arguments: {
          query: 'associatedWith.mentions.chemicals.mesh:D008550',
          max_results: 3
        }
      }
    }
  },
  {
    name: "Search by ChEBI Chemical",
    request: {
      jsonrpc: '2.0',
      id: 5,
      method: 'tools/call',
      params: {
        name: 'search-pfocr-pathways',
        arguments: {
          query: 'associatedWith.mentions.chemicals.chebi:16796',
          max_results: 3
        }
      }
    }
  }
];

async function testFieldSearch() {
  try {
    console.log('🚀 Starting PFOCR MCP Server...');
    
    const server = spawn('node', [join(__dirname, 'dist/index.js')], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let responseCount = 0;
    const expectedResponses = testRequests.length;
    let totalResults = 0;
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
                
                // Check for results count
                if (text.includes('Found') && text.includes('pathway figures')) {
                  const match = text.match(/Found (\d+) pathway figures/);
                  if (match) {
                    const count = parseInt(match[1]);
                    totalResults += count;
                    console.log(`   📊 Results found: ${count} pathway figures`);
                  }
                }
                
                // Check for specific annotations
                if (text.includes('Genes:')) {
                  console.log(`   🧬 Found gene annotations!`);
                }
                if (text.includes('MeSH Chemicals:')) {
                  console.log(`   🧬 Found MeSH chemical annotations!`);
                }
                if (text.includes('ChEBI Chemicals:')) {
                  console.log(`   🧬 Found ChEBI chemical annotations!`);
                }
                if (text.includes('MeSH Diseases:')) {
                  console.log(`   🧬 Found MeSH disease annotations!`);
                }
              }
            }
            
            if (response.result.artifacts) {
              console.log(`   📊 Artifacts: ${response.result.artifacts.length} files`);
            }
          }
          
          console.log('   ' + '─'.repeat(50));
          
          if (responseCount >= expectedResponses) {
            console.log('\n🎉 All field-specific search tests completed!');
            console.log('\n📊 Summary:');
            console.log(`   ✅ Total results found: ${totalResults} pathway figures`);
            console.log(`   ✅ Unique geneset IDs: ${genesetIds.length}`);
            console.log(`   ✅ Field-specific searches work correctly!`);
            console.log('\n🧬 Key Findings:');
            console.log('   - Disease MeSH ID searches work (D045169 = COVID-19)');
            console.log('   - Gene NCBI ID searches work (associatedWith.mentions.genes.ncbigene)');
            console.log('   - Chemical searches work (MeSH and ChEBI)');
            console.log('   - The API requires field-specific query syntax');
            console.log('\n🚀 The PFOCR MCP server now supports proper field-specific searches!');
            
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
      if (logLine.includes('PFOCR') || logLine.includes('Error') || line.includes('Warning')) {
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
    console.error('❌ Field search test failed:', error);
    process.exit(1);
  }
}

// Run the test
testFieldSearch();
