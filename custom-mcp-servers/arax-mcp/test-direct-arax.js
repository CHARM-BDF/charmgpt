#!/usr/bin/env node

import fetch from 'node-fetch';

// Exact working payload from user's example
const workingPayload = {
  "message": {
    "query_graph": {
      "nodes": {
        "n0": {
          "ids": ["NCBIGene:283635"]
        },
        "n1": {
          "ids": ["NCBIGene:28514"]
        }
      },
      "paths": {
        "p0": {
          "subject": "n0",
          "object": "n1",
          "predicates": ["biolink:related_to"]
        }
      }
    }
  },
  "submitter": "ARAX MCP Test",
  "stream_progress": false,  // Use simple mode for testing
  "query_options": {
    "kp_timeout": "30",
    "prune_threshold": "50"
  }
};

async function testDirectArax() {
  console.log('🧬 Direct ARAX API Test with Working Format');
  console.log('=' .repeat(55));
  console.log('Testing exact payload that works on arax.ncats.io');
  console.log('');
  
  console.log('📤 Payload:');
  console.log(JSON.stringify(workingPayload, null, 2));
  console.log('');
  
  try {
    console.log('🚀 Sending request to ARAX...');
    
    const response = await fetch('https://arax.ncats.io/api/arax/v1.4/query', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'ARAX-MCP-Test/1.0'
      },
      body: JSON.stringify(workingPayload)
    });
    
    console.log(`📡 Response: ${response.status} ${response.statusText}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Error response:', errorText);
      return;
    }
    
    const data = await response.json();
    
    console.log('✅ Response received!');
    console.log('📊 Response structure:');
    console.log(`   - Status: ${data.status}`);
    console.log(`   - Has message: ${data.message ? 'Yes' : 'No'}`);
    
    if (data.message?.knowledge_graph) {
      const kg = data.message.knowledge_graph;
      const nodeCount = Object.keys(kg.nodes || {}).length;
      const edgeCount = Object.keys(kg.edges || {}).length;
      
      console.log(`   - Nodes: ${nodeCount}`);
      console.log(`   - Edges: ${edgeCount}`);
      
      if (nodeCount > 0) {
        console.log('');
        console.log('🎯 SUCCESS: ARAX returned knowledge graph!');
        console.log('🔗 Path found between NCBIGene:283635 and NCBIGene:28514');
        
        // Show first few nodes
        const nodeIds = Object.keys(kg.nodes).slice(0, 3);
        console.log('📋 Sample nodes:');
        nodeIds.forEach(id => {
          const node = kg.nodes[id];
          console.log(`   - ${id}: ${node.name || 'Unknown'}`);
        });
      }
    } else {
      console.log('⚠️  No knowledge graph in response');
    }
    
  } catch (error) {
    console.error('❌ Request failed:', error.message);
  }
}

testDirectArax()
  .then(() => {
    console.log('\n🎉 Direct ARAX test completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Direct ARAX test failed:', error.message);
    process.exit(1);
  }); 