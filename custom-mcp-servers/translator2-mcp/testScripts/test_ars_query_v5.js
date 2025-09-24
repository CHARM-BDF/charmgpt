#!/usr/bin/env node

/**
 * Test script to query ARS (Autonomous Relay System) for NCATS Biomedical Data Translator
 * Tests querying information about gene NCBIGene:283635 (FAM177A1) with specific categories
 * This query removes GenomicEntity and other categories that might bring in sequence variants
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// ARS API endpoints
const ARS_BASE_URL = 'https://ars-prod.transltr.io';
const SUBMIT_ENDPOINT = '/ars/api/submit';
const MESSAGES_ENDPOINT = '/ars/api/messages';

// Updated test query for gene NCBIGene:283635 (FAM177A1) without GenomicEntity
const testQuery = {
  "message": {
    "query_graph": {
      "edges": {
        "e0": {
          "subject": "n0",
          "object": "n1"
        }
      },
      "nodes": {
        "n0": {
          "ids": [
            "NCBIGENE:283635"
          ],
          "categories": [
            "biolink:Gene"
          ],
          "is_set": false,
          "name": "FAM177A1"
        },
        "n1": {
          "is_set": false,
          "categories": [
            "biolink:ChemicalMixture",
            "biolink:DiseaseOrPhenotypicFeature",
            "biolink:Drug",
            "biolink:Gene",
            "biolink:MolecularMixture",
            "biolink:Pathway",
            "biolink:Protein",
            "biolink:ProteinFamily",
            "biolink:SmallMolecule"
          ]
        }
      }
    }
  }
};

/**
 * Make HTTP request to ARS API
 */
function makeRequest(url, data = null, method = 'GET') {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      port: 443,
      path: urlObj.pathname + urlObj.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    };

    if (data) {
      const postData = JSON.stringify(data);
      options.headers['Content-Length'] = Buffer.byteLength(postData);
    }

    const req = https.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        try {
          const parsedData = JSON.parse(responseData);
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            data: parsedData
          });
        } catch (error) {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            data: responseData
          });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

/**
 * Submit query to ARS
 */
async function submitQuery() {
  console.log('🧬 Testing ARS Query v5 for NCBIGene:283635 (FAM177A1)');
  console.log('📤 Submitting query WITHOUT GenomicEntity and other genomic categories...');
  console.log('🎯 Target categories (excluding GenomicEntity, BiologicalEntity, etc.):');
  testQuery.message.query_graph.nodes.n1.categories.forEach(cat => {
    console.log(`   - ${cat}`);
  });
  
  try {
    const response = await makeRequest(
      ARS_BASE_URL + SUBMIT_ENDPOINT,
      testQuery,
      'POST'
    );
    
    console.log(`\n📊 Response Status: ${response.statusCode}`);
    
    if (response.statusCode === 201 || response.statusCode === 202) {
      const pk = response.data.pk;
      console.log(`✅ Query submitted successfully!`);
      console.log(`🔑 Primary Key (PK): ${pk}`);
      console.log(`📋 Status: ${response.data.fields.status}`);
      console.log(`⏰ Timestamp: ${response.data.fields.timestamp}`);
      
      return pk;
    } else {
      console.error(`❌ Error submitting query: ${response.statusCode}`);
      console.error('Response:', JSON.stringify(response.data, null, 2));
      return null;
    }
  } catch (error) {
    console.error('❌ Error making request:', error.message);
    return null;
  }
}

/**
 * Check query status and get results
 */
async function checkQueryStatus(pk, maxAttempts = 12, delayMs = 30000) {
  console.log(`\n🔍 Checking query status for PK: ${pk}`);
  console.log(`⏳ Will check every ${delayMs/1000} seconds for up to ${maxAttempts} attempts...`);
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    console.log(`\n📊 Attempt ${attempt}/${maxAttempts}`);
    
    try {
      const response = await makeRequest(
        `${ARS_BASE_URL}${MESSAGES_ENDPOINT}/${pk}?trace=y`
      );
      
      if (response.statusCode === 200) {
        const status = response.data.status;
        console.log(`📋 Status: ${status}`);
        
        if (status === 'Done') {
          console.log('✅ Query completed successfully!');
          return response.data;
        } else if (status === 'Error') {
          console.log('❌ Query failed with error');
          console.log('Response:', JSON.stringify(response.data, null, 2));
          return response.data;
        } else {
          console.log(`⏳ Query still running... (${status})`);
        }
      } else {
        console.error(`❌ Error checking status: ${response.statusCode}`);
        console.error('Response:', JSON.stringify(response.data, null, 2));
      }
    } catch (error) {
      console.error('❌ Error checking status:', error.message);
    }
    
    if (attempt < maxAttempts) {
      console.log(`⏳ Waiting ${delayMs/1000} seconds before next check...`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  
  console.log('⏰ Timeout reached. Query may still be processing.');
  return null;
}

/**
 * Get detailed results
 */
async function getDetailedResults(pk) {
  console.log(`\n📋 Getting detailed results for PK: ${pk}`);
  
  try {
    const response = await makeRequest(
      `${ARS_BASE_URL}${MESSAGES_ENDPOINT}/${pk}`
    );
    
    if (response.statusCode === 200) {
      console.log('✅ Retrieved detailed results');
      
      // Save results to file
      const resultsFile = path.join(__dirname, `ars_results_v5_${pk}.json`);
      fs.writeFileSync(resultsFile, JSON.stringify(response.data, null, 2));
      console.log(`💾 Results saved to: ${resultsFile}`);
      
      // Display summary
      const data = response.data.data;
      if (data && data.message && data.message.knowledge_graph) {
        const kg = data.message.knowledge_graph;
        console.log(`\n📊 Results Summary:`);
        console.log(`   Nodes: ${Object.keys(kg.nodes || {}).length}`);
        console.log(`   Edges: ${Object.keys(kg.edges || {}).length}`);
        
        // Analyze node categories
        const nodeCategories = {};
        Object.values(kg.nodes || {}).forEach(node => {
          if (node.categories) {
            node.categories.forEach(cat => {
              nodeCategories[cat] = (nodeCategories[cat] || 0) + 1;
            });
          }
        });
        
        console.log(`\n🏷️  Node Categories Found:`);
        Object.entries(nodeCategories)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
          .forEach(([category, count]) => {
            console.log(`   ${category}: ${count} nodes`);
          });
        
        // Check for sequence variants specifically
        const sequenceVariantCount = Object.values(kg.nodes || {})
          .filter(node => node.categories && node.categories.includes('biolink:SequenceVariant'))
          .length;
        
        console.log(`\n🧬 Sequence Variant Analysis:`);
        console.log(`   Sequence Variants Found: ${sequenceVariantCount}`);
        console.log(`   Expected: 0 (not in target categories)`);
        console.log(`   Result: ${sequenceVariantCount > 0 ? '❌ Still present' : '✅ Successfully filtered'}`);
        
      } else {
        console.log('\n📋 No knowledge graph found in results');
        console.log('This could mean:');
        console.log('   - No relationships found for this gene');
        console.log('   - Query is still processing');
        console.log('   - Results are in a different format');
      }
      
      return response.data;
    } else {
      console.error(`❌ Error getting results: ${response.statusCode}`);
      return null;
    }
  } catch (error) {
    console.error('❌ Error getting results:', error.message);
    return null;
  }
}

/**
 * Main test function
 */
async function runTest() {
  console.log('🚀 Starting ARS API Test v5');
  console.log('=' .repeat(50));
  
  // Submit query
  const pk = await submitQuery();
  if (!pk) {
    console.log('❌ Failed to submit query. Exiting.');
    return;
  }
  
  // Check status
  const statusResult = await checkQueryStatus(pk);
  if (!statusResult) {
    console.log('❌ Failed to get status. Exiting.');
    return;
  }
  
  // Get detailed results
  const results = await getDetailedResults(pk);
  if (results) {
    console.log('\n✅ Test completed successfully!');
    console.log('📋 Check the saved JSON file for full results.');
  } else {
    console.log('\n❌ Test completed with errors.');
  }
}

// Run the test
if (require.main === module) {
  runTest().catch(console.error);
}

module.exports = {
  submitQuery,
  checkQueryStatus,
  getDetailedResults,
  runTest
};
