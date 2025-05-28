#!/usr/bin/env node

// Simple test script to verify the new MediKanren endpoint
async function testEndpoint() {
  console.log('🧪 Testing MediKanren endpoint...');
  
  // Test the new endpoint format
  const testEntity = 'HGNC:8651'; // PCBP3 gene
  const predicate = 'biolink:affects';
  
  // Test Query 1: subject -> object (what HGNC:8651 affects)
  const url1 = `https://medikanren.metareflective.systems/query0?subject=${encodeURIComponent(testEntity)}&predicate=${encodeURIComponent(predicate)}&object=`;
  console.log(`\n📡 Testing Query 1: ${testEntity} -> X`);
  console.log(`URL: ${url1}`);
  
  try {
    const response1 = await fetch(url1);
    if (response1.ok) {
      const data1 = await response1.json();
      console.log(`✅ Query 1 successful: ${data1.length} relationships found`);
      if (data1.length > 0) {
        console.log(`   Sample result: ${data1[0][0]} -> ${data1[0][2]} -> ${data1[0][3]}`);
      }
    } else {
      console.log(`❌ Query 1 failed: ${response1.status} ${response1.statusText}`);
    }
  } catch (error) {
    console.log(`❌ Query 1 error: ${error.message}`);
  }
  
  // Test Query 2: object <- subject (what affects HGNC:8651)
  const url2 = `https://medikanren.metareflective.systems/query0?subject=&predicate=${encodeURIComponent(predicate)}&object=${encodeURIComponent(testEntity)}`;
  console.log(`\n📡 Testing Query 2: X -> ${testEntity}`);
  console.log(`URL: ${url2}`);
  
  try {
    const response2 = await fetch(url2);
    if (response2.ok) {
      const data2 = await response2.json();
      console.log(`✅ Query 2 successful: ${data2.length} relationships found`);
      if (data2.length > 0) {
        console.log(`   Sample result: ${data2[0][0]} -> ${data2[0][2]} -> ${data2[0][3]}`);
      }
    } else {
      console.log(`❌ Query 2 failed: ${response2.status} ${response2.statusText}`);
    }
  } catch (error) {
    console.log(`❌ Query 2 error: ${error.message}`);
  }
  
  console.log('\n🏁 Test complete!');
}

// Run the test
testEndpoint().catch(console.error); 