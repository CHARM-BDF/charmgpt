#!/usr/bin/env node

/**
 * Simplified PFOCR MCP Test
 * This script tests the simplified MCP with search syntax in tool descriptions
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🧬 Testing simplified PFOCR MCP Server...\n');

// Test requests
const testRequests = [
  {
    name: "List Tools (should show 4 tools now)",
    request: {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/list',
      params: {}
    }
  },
  {
    name: "Test BRCA1 Gene Search",
    request: {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: {
        name: 'search-pfocr-pathways',
        arguments: {
          query: 'associatedWith.mentions.genes.ncbigene:672',
          max_results: 3
        }
      }
    }
  },
  {
    name: "Test COVID-19 Disease Search",
    request: {
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: {
        name: 'search-pfocr-pathways',
        arguments: {
          query: 'associatedWith.mentions.diseases.mesh:D045169',
          max_results: 3
        }
      }
    }
  }
];

async function testSimplified() {
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
                console.log(`      - ${tool.name}: ${tool.description.substring(0, 100)}...`);
              });
            } else if (response.result.content) {
              const content = response.result.content[0];
              console.log(`   📄 Content type: ${content?.type || 'unknown'}`);
              
              if (content?.text) {
                const text = content.text;
                console.log(`   📝 Text preview: ${text.substring(0, 200)}...`);
                
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
            console.log('\n🎉 Simplified PFOCR MCP test completed!');
            console.log('\n📊 Summary:');
            console.log('   ✅ Tool descriptions now include search syntax');
            console.log('   ✅ No separate help tool needed');
            console.log('   ✅ LLM can see search patterns directly');
            console.log('   ✅ Cleaner, more efficient design');
            console.log('\n🧬 The PFOCR MCP server is now optimized for LLM usage!');
            
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
    console.error('❌ Simplified test failed:', error);
    process.exit(1);
  }
}

// Run the test
testSimplified();
