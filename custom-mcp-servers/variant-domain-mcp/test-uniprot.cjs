const fetch = require('node-fetch');

// Test UniProt data retrieval directly
async function testUniprotData() {
  console.log('Testing UniProt domain data retrieval...\n');
  
  const UNIPROT_BASE_URL = "https://rest.uniprot.org/uniprotkb";
  const geneSymbol = "EGFR";
  
  try {
    console.log(`Searching UniProt for gene: ${geneSymbol}`);
    
    // Search UniProt by gene name using the REST API
    const searchUrl = `${UNIPROT_BASE_URL}/search?query=gene:${geneSymbol}+AND+organism_id:9606&format=json&size=1`;
    console.log(`URL: ${searchUrl}\n`);
    
    const searchResponse = await fetch(searchUrl);
    
    if (!searchResponse.ok) {
      console.error(`❌ UniProt search failed: ${searchResponse.status} ${searchResponse.statusText}`);
      return;
    }
    
    const searchData = await searchResponse.json();
    
    if (!searchData.results || searchData.results.length === 0) {
      console.log('❌ No results found for gene:', geneSymbol);
      return;
    }

    console.log(`✅ Found UniProt entry for ${geneSymbol}`);
    const entry = searchData.results[0];
    const uniprotId = entry.primaryAccession;
    console.log(`UniProt ID: ${uniprotId}`);
    
    // Check if features exist
    if (!entry.features) {
      console.log('❌ No features found in UniProt entry');
      return;
    }
    
    console.log(`\nFound ${entry.features.length} total features`);
    
    // Extract domains and features
    const domains = [];
    const features = [];

    entry.features.forEach((feature) => {
      if (feature.type === 'Domain') {
        domains.push({
          begin: feature.location.start.value,
          end: feature.location.end.value,
          description: feature.description || 'Domain',
          evidence: feature.evidences?.map((e) => e.code) || []
        });
      } else if (['Region', 'Motif', 'Site', 'Active site', 'Binding site'].includes(feature.type)) {
        features.push({
          type: feature.type,
          begin: feature.location.start.value,
          end: feature.location.end.value,
          description: feature.description || feature.type
        });
      }
    });

    console.log(`\n📊 Domain Data Summary:`);
    console.log(`- Protein Domains: ${domains.length}`);
    console.log(`- Functional Features: ${features.length}`);
    
    if (domains.length > 0) {
      console.log(`\n🧬 Protein Domains:`);
      domains.forEach((domain, idx) => {
        console.log(`  ${idx + 1}. ${domain.description} (${domain.begin}-${domain.end})`);
      });
    }
    
    if (features.length > 0) {
      console.log(`\n⚡ Functional Features:`);
      features.slice(0, 5).forEach((feature, idx) => {
        console.log(`  ${idx + 1}. ${feature.type}: ${feature.description} (${feature.begin}-${feature.end})`);
      });
      if (features.length > 5) {
        console.log(`  ... and ${features.length - 5} more features`);
      }
    }
    
    // Test sequence retrieval
    console.log(`\n🧪 Testing sequence retrieval...`);
    const seqUrl = `${UNIPROT_BASE_URL}/${uniprotId}?format=json`;
    const seqResponse = await fetch(seqUrl);
    
    if (seqResponse.ok) {
      const seqData = await seqResponse.json();
      if (seqData.sequence && seqData.sequence.value) {
        console.log(`✅ Sequence retrieved: ${seqData.sequence.value.length} amino acids`);
        console.log(`First 50 AAs: ${seqData.sequence.value.substring(0, 50)}...`);
      }
    } else {
      console.log(`❌ Failed to retrieve sequence: ${seqResponse.status}`);
    }
    
    console.log(`\n✅ SUCCESS: UniProt data retrieval working correctly!`);
    
  } catch (error) {
    console.error('❌ ERROR testing UniProt data:', error.message);
  }
}

// Run the test
testUniprotData(); 