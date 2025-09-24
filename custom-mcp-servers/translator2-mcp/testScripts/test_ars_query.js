#!/usr/bin/env node

/**
 * Test script to query ARS (Autonomous Relay System) for NCATS Biomedical Data Translator
 * Tests querying information about gene NCBIGene:283635
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// ARS API endpoints
const ARS_BASE_URL = 'https://ars-prod.transltr.io';
const SUBMIT_ENDPOINT = '/ars/api/submit';
const MESSAGES_ENDPOINT = '/ars/api/messages';

// Test query for gene NCBIGene:283635
const testQuery = {
  "message": {
    "query_graph": {
      "nodes": {
        "n0": {
          "id": "NCBIGENE:283635",
          "category": "biolink:Gene"
        },
        "n1": {
          "category": "biolink:ChemicalSubstance"
        }
      },
      "edges": {
        "e01": {
          "subject": "n0",
          "object": "n1",
          "predicates": [
            "biolink:related_to"
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
  console.log('🧬 Testing ARS Query for NCBIGene:283635');
  console.log('📤 Submitting query to ARS...');
  
  try {
    const response = await makeRequest(
      ARS_BASE_URL + SUBMIT_ENDPOINT,
      testQuery,
      'POST'
    );
    
    console.log(`📊 Response Status: ${response.statusCode}`);
    
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
      const resultsFile = path.join(__dirname, `ars_results_${pk}.json`);
      fs.writeFileSync(resultsFile, JSON.stringify(response.data, null, 2));
      console.log(`💾 Results saved to: ${resultsFile}`);
      
      // Display summary
      const data = response.data.data;
      if (data && data.message && data.message.knowledge_graph) {
        const kg = data.message.knowledge_graph;
        console.log(`\n📊 Results Summary:`);
        console.log(`   Nodes: ${Object.keys(kg.nodes || {}).length}`);
        console.log(`   Edges: ${Object.keys(kg.edges || {}).length}`);
        
        // Show first few nodes
        const nodes = Object.values(kg.nodes || {});
        if (nodes.length > 0) {
          console.log(`\n🧬 Sample nodes:`);
          nodes.slice(0, 3).forEach((node, index) => {
            console.log(`   ${index + 1}. ${node.id || 'Unknown'} (${node.category || 'Unknown'})`);
          });
        }
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
  console.log('🚀 Starting ARS API Test');
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
