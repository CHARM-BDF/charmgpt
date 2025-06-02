#!/usr/bin/env node

async function getUMLSNames() {
  const concepts = [
    'UMLS:C0037083', // Intermediate in DDIT3 ↔ ? ↔ CEBPB
    'UMLS:C0007634', // Intermediate in DDIT3 ↔ ? ↔ CEBPB  
    'UMLS:C0017262'  // Intermediate in DDIT3 ↔ ? ↔ EGR1
  ];
  
  console.log('🔍 Fetching names for UMLS intermediate nodes...\n');
  
  for (const concept of concepts) {
    console.log(`Checking ${concept}:`);
    
    // Try as subject to see if we can get its name from relationships
    const url = `https://medikanren.metareflective.systems/query0?subject=${encodeURIComponent(concept)}&predicate=biolink%3Aaffects&object=`;
    
    try {
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        if (data.length > 0) {
          const name = data[0][1]; // Source name should be in position 1
          console.log(`  ✅ Name: ${name}`);
          console.log(`  📋 Sample relationship: ${concept} -> ${data[0][2]} -> ${data[0][3]}`);
          console.log(`  📊 Total relationships: ${data.length}`);
        } else {
          console.log(`  ❌ No relationships found as subject`);
          
          // Try as object instead
          const reverseUrl = `https://medikanren.metareflective.systems/query0?subject=&predicate=biolink%3Aaffects&object=${encodeURIComponent(concept)}`;
          const reverseResponse = await fetch(reverseUrl);
          if (reverseResponse.ok) {
            const reverseData = await reverseResponse.json();
            if (reverseData.length > 0) {
              const name = reverseData[0][4]; // Target name should be in position 4
              console.log(`  ✅ Name (from reverse): ${name}`);
              console.log(`  📋 Sample relationship: ${reverseData[0][0]} -> ${reverseData[0][2]} -> ${concept}`);
            }
          }
        }
      } else {
        console.log(`  ❌ Failed: HTTP ${response.status}`);
      }
    } catch (error) {
      console.log(`  ❌ Error: ${error.message}`);
    }
    
    console.log(''); // Empty line between concepts
  }
}

getUMLSNames().catch(console.error); 