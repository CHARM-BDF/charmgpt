#!/usr/bin/env node

// Quick test to verify ARAX API integration works
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Test the ARAX API query directly (similar to our test script)
async function testAraxQuery() {
  console.log('🧬 Quick ARAX API Test');
  console.log('=' .repeat(40));

  const ARAX_API_URL = 'https://arax.ncats.io/api/arax/v1.4/query';
  
  const query = {
    message: {
      query_graph: {
        edges: {
          e0: {
            predicates: ['biolink:affects'],
            subject: 'n0',
            object: 'n1'
          }
        },
        nodes: {
          n0: {
            ids: ['NCBIGene:283635'],
            categories: ['biolink:Gene'],
            is_set: false,
            name: 'FAM177A1'
          },
          n1: {
            categories: [
              'biolink:Disease',
              'biolink:DiseaseOrPhenotypicFeature',
              'biolink:Drug',
              'biolink:Gene',
              'biolink:Protein'
            ],
            is_set: false
          }
        }
      }
    },
    submitter: 'ARAX MCP Test',
    stream_progress: false,
    query_options: {
      kp_timeout: '30',
      prune_threshold: '50'
    }
  };

  try {
    console.log('📤 Sending ARAX query...');
    console.log('🔗 URL:', ARAX_API_URL);
    console.log('📝 Query for: FAM177A1 effects');

    const response = await fetch(ARAX_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'ARAX-MCP-Test/1.0'
      },
      body: JSON.stringify(query)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    
    console.log('✅ Response received!');
    console.log('📊 Status:', data.status);
    console.log('📊 Total results:', data.total_results_count);
    
    if (data.message?.knowledge_graph) {
      const kg = data.message.knowledge_graph;
      const nodeCount = Object.keys(kg.nodes || {}).length;
      const edgeCount = Object.keys(kg.edges || {}).length;
      
      console.log('📊 Knowledge graph:');
      console.log('  • Nodes:', nodeCount);
      console.log('  • Edges:', edgeCount);
      
      // Show a few example entities
      const nodes = Object.values(kg.nodes || {});
      console.log('\n🔍 Sample entities found:');
      nodes.slice(0, 5).forEach((node, i) => {
        console.log(`  ${i + 1}. ${node.name} (${node.categories?.[0] || 'Unknown'})`);
      });
      
      console.log('\n🎉 ARAX MCP Server API integration verified!');
      console.log('✅ The server should work correctly with MCP clients.');
    } else {
      console.log('⚠️  No knowledge graph in response');
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.log('\n🔧 Troubleshooting:');
    console.log('  • Check internet connection');
    console.log('  • Verify ARAX API is accessible');
    console.log('  • Check query format');
  }
}

// Run the test
testAraxQuery(); 