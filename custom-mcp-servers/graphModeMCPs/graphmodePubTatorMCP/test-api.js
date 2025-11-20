#!/usr/bin/env node

/**
 * Test script to verify PubTator API endpoints and response formats
 * Specifically tests searching for FAM177A1 gene
 */

const PUBTATOR_BASE_URL = "https://www.ncbi.nlm.nih.gov/research/pubtator3-api";

async function makeRequest(endpoint, method = 'GET', body = null) {
  const url = `${PUBTATOR_BASE_URL}${endpoint}`;
  console.log(`\n${'='.repeat(80)}`);
  console.log(`Making ${method} request to: ${url}`);
  console.log('='.repeat(80));
  
  const options = {
    method,
    headers: {
      'Accept': 'application/json',
      'User-Agent': 'test-script/1.0.0'
    }
  };
  
  if (method === 'POST' && body) {
    options.headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(body);
  }
  
  try {
    const response = await fetch(url, options);
    const data = await response.json();
    
    console.log(`\nResponse Status: ${response.status} ${response.statusText}`);
    console.log(`\nResponse Structure:`);
    console.log(`- Has data: ${!!data}`);
    console.log(`- Type: ${typeof data}`);
    console.log(`- Is Array: ${Array.isArray(data)}`);
    console.log(`- Keys: ${data && typeof data === 'object' && !Array.isArray(data) ? Object.keys(data).join(', ') : 'N/A'}`);
    
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      if (data.results) {
        console.log(`- Has 'results' array: true (length: ${Array.isArray(data.results) ? data.results.length : 'not an array'})`);
        if (Array.isArray(data.results) && data.results.length > 0) {
          console.log(`- First result keys: ${Object.keys(data.results[0]).join(', ')}`);
          console.log(`- First result sample:`, JSON.stringify(data.results[0], null, 2).substring(0, 500));
        }
      }
      if (data.count !== undefined) {
        console.log(`- Count: ${data.count}`);
      }
    }
    
    console.log(`\nFull Response (first 2000 chars):`);
    console.log(JSON.stringify(data, null, 2).substring(0, 2000));
    if (JSON.stringify(data, null, 2).length > 2000) {
      console.log(`\n... (truncated, total length: ${JSON.stringify(data, null, 2).length} chars)`);
    }
    
    return data;
  } catch (error) {
    console.error(`\nError:`, error.message);
    console.error(error.stack);
    return null;
  }
}

async function testEntityAutocomplete(query, concept = null) {
  console.log(`\n\n${'#'.repeat(80)}`);
  console.log(`TEST 1: Entity Autocomplete`);
  console.log(`Query: "${query}"${concept ? `, Concept: "${concept}"` : ''}`);
  console.log('#'.repeat(80));
  
  let endpoint = `/entity/autocomplete/?query=${encodeURIComponent(query)}`;
  if (concept) {
    endpoint += `&concept=${concept}`;
  }
  
  const data = await makeRequest(endpoint);
  
  if (Array.isArray(data) && data.length > 0) {
    console.log(`\n✅ Found ${data.length} entity matches`);
    console.log(`\nFirst 3 matches:`);
    data.slice(0, 3).forEach((entity, idx) => {
      console.log(`\n  Match ${idx + 1}:`);
      console.log(`    _id: ${entity._id}`);
      console.log(`    name: ${entity.name}`);
      console.log(`    type: ${entity.type}`);
      if (entity.mentions) {
        console.log(`    mentions: ${entity.mentions.length}`);
      }
    });
  } else {
    console.log(`\n❌ No matches found or unexpected response format`);
  }
  
  return data;
}

async function testSearch(searchTerm) {
  console.log(`\n\n${'#'.repeat(80)}`);
  console.log(`TEST 2: Search API`);
  console.log(`Search Term: "${searchTerm}"`);
  console.log('#'.repeat(80));
  
  const endpoint = `/search/?text=${encodeURIComponent(searchTerm)}`;
  const data = await makeRequest(endpoint);
  
  return data;
}

async function testExport(pmids) {
  console.log(`\n\n${'#'.repeat(80)}`);
  console.log(`TEST 3: Export Publications (BioC JSON)`);
  console.log(`PMIDs: ${pmids.join(', ')}`);
  console.log('#'.repeat(80));
  
  const endpoint = `/publications/export/biocjson?pmids=${pmids.join(',')}&full=true`;
  const data = await makeRequest(endpoint);
  
  if (data && data.documents) {
    console.log(`\n✅ Found ${data.documents.length} document(s)`);
    if (data.documents.length > 0) {
      const doc = data.documents[0];
      console.log(`\nFirst document structure:`);
      console.log(`  id: ${doc.id}`);
      console.log(`  passages: ${doc.passages?.length || 0}`);
      
      let totalAnnotations = 0;
      doc.passages?.forEach(p => {
        totalAnnotations += p.annotations?.length || 0;
      });
      console.log(`  total annotations: ${totalAnnotations}`);
      
      if (doc.passages && doc.passages.length > 0) {
        const abstractPassage = doc.passages.find(p => p.infons?.type === 'abstract') || doc.passages[0];
        if (abstractPassage) {
          console.log(`  abstract length: ${abstractPassage.text?.length || 0} chars`);
          console.log(`  abstract preview: ${abstractPassage.text?.substring(0, 200) || 'N/A'}`);
        }
      }
    }
  }
  
  return data;
}

async function runTests() {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`PubTator API Test Suite - Testing FAM177A1`);
  console.log('='.repeat(80));
  
  // Test 1: Entity Autocomplete
  const entityMatches = await testEntityAutocomplete('FAM177A1', 'gene');
  await new Promise(resolve => setTimeout(resolve, 1000)); // Rate limiting
  
  // Test 2: Search with free text
  console.log(`\n\nTesting search with free text "FAM177A1"...`);
  const searchResultsFreeText = await testSearch('FAM177A1');
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Test 3: If we got entity matches, try searching with entity ID
  if (entityMatches && Array.isArray(entityMatches) && entityMatches.length > 0) {
    const entityId = entityMatches[0]._id;
    const entityType = entityMatches[0].type?.toUpperCase() || 'GENE';
    const formattedId = entityId.startsWith('@') ? entityId : `@${entityType}_${entityId}`;
    
    console.log(`\n\nTesting search with entity ID "${formattedId}"...`);
    const searchResultsEntityId = await testSearch(formattedId);
    
    // Test 4: If we got search results, try exporting
    if (searchResultsEntityId && searchResultsEntityId.results && searchResultsEntityId.results.length > 0) {
      const pmids = searchResultsEntityId.results
        .slice(0, 3) // Just test with first 3
        .map(p => p.pmid)
        .filter(p => p);
      
      if (pmids.length > 0) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        await testExport(pmids);
      }
    } else if (searchResultsFreeText && searchResultsFreeText.results && searchResultsFreeText.results.length > 0) {
      const pmids = searchResultsFreeText.results
        .slice(0, 3)
        .map(p => p.pmid)
        .filter(p => p);
      
      if (pmids.length > 0) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        await testExport(pmids);
      }
    }
  }
  
  console.log(`\n\n${'='.repeat(80)}`);
  console.log(`Test Suite Complete`);
  console.log('='.repeat(80));
}

// Run the tests
runTests().catch(error => {
  console.error('\n\nFatal error:', error);
  process.exit(1);
});

