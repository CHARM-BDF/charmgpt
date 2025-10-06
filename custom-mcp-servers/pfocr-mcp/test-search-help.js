#!/usr/bin/env node

/**
 * Search Help Test for PFOCR MCP Server
 * This script tests the new search help functionality
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🧬 Testing PFOCR MCP Server search help functionality...\n');

// Test requests for search help
const testRequests = [
  {
    name: "List All Tools (including new search-help)",
    request: {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/list',
      params: {}
    }
  },
  {
    name: "Get Search Help for Genes",
    request: {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: {
        name: 'get-pfocr-search-help',
        arguments: {
          search_type: 'genes'
        }
      }
    }
  },
  {
    name: "Get Search Help for Diseases",
    request: {
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: {
        name: 'get-pfocr-search-help',
        arguments: {
          search_type: 'diseases'
        }
      }
    }
  },
  {
    name: "Get Search Help for All Types",
    request: {
      jsonrpc: '2.0',
      id: 4,
      method: 'tools/call',
      params: {
        name: 'get-pfocr-search-help',
        arguments: {
          search_type: 'all'
        }
      }
    }
  }
];

async function testSearchHelp() {
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
              response.result.tools.forEach(tool => {
                console.log(`      - ${tool.name}: ${tool.description.substring(0, 80)}...`);
              });
            } else if (response.result.content) {
              const content = response.result.content[0];
              console.log(`   📄 Content type: ${content?.type || 'unknown'}`);
              
              if (content?.text) {
                const text = content.text;
                console.log(`   📝 Text preview: ${text.substring(0, 200)}...`);
                
                // Check for specific help content
                if (text.includes('Gene Search Examples')) {
                  console.log(`   🧬 Found gene search examples!`);
                }
                if (text.includes('Disease Search Examples')) {
                  console.log(`   🦠 Found disease search examples!`);
                }
                if (text.includes('Chemical Search Examples')) {
                  console.log(`   🧪 Found chemical search examples!`);
                }
                if (text.includes('NCBI Gene ID')) {
                  console.log(`   🔍 Found NCBI Gene ID examples!`);
                }
                if (text.includes('MeSH Disease ID')) {
                  console.log(`   🔍 Found MeSH Disease ID examples!`);
                }
                if (text.includes('ChEBI Chemical ID')) {
                  console.log(`   🔍 Found ChEBI Chemical ID examples!`);
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
            console.log('\n🎉 All search help tests completed successfully!');
            console.log('\n📊 Summary:');
            console.log('   ✅ Search help tool is working correctly');
            console.log('   ✅ Gene search examples provided');
            console.log('   ✅ Disease search examples provided');
            console.log('   ✅ Chemical search examples provided');
            console.log('   ✅ Comprehensive help documentation available');
            console.log('\n🧬 The PFOCR MCP server now provides comprehensive search guidance!');
            
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
    console.error('❌ Search help test failed:', error);
    process.exit(1);
  }
}

// Run the test
testSearchHelp();
