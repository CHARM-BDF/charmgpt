const fetch = require('node-fetch');

// Test visualization data structure with real UniProt data
async function testVisualizationData() {
  console.log('Testing visualization data structure...\n');
  
  const UNIPROT_BASE_URL = "https://rest.uniprot.org/uniprotkb";
  const geneSymbol = "EGFR";
  
  try {
    // Get UniProt data
    const searchUrl = `${UNIPROT_BASE_URL}/search?query=gene:${geneSymbol}+AND+organism_id:9606&format=json&size=1`;
    const searchResponse = await fetch(searchUrl);
    const searchData = await searchResponse.json();
    const entry = searchData.results[0];
    const uniprotId = entry.primaryAccession;
    
    // Get sequence
    const seqUrl = `${UNIPROT_BASE_URL}/${uniprotId}?format=json`;
    const seqResponse = await fetch(seqUrl);
    const seqData = await seqResponse.json();
    const sequence = seqData.sequence.value;
    
    // Extract domains and features (same logic as in our MCP)
    const domains = [];
    const features = [];

    function getColorForDomain(index) {
      const colors = [
        "#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4", "#FECA57",
        "#FF9FF3", "#54A0FF", "#48DBFB", "#0ABDE3", "#00D2D3"
      ];
      return colors[index % colors.length];
    }

    function getColorForFeatureType(type) {
      const colorMap = {
        "Active site": "#FF5252",
        "Binding site": "#536DFE",
        "Site": "#FFAB40",
        "Motif": "#7C4DFF",
        "Region": "#64FFDA",
        "Default": "#9E9E9E"
      };
      return colorMap[type] || colorMap.Default;
    }

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

    // Mock variant position (EGFR L858R is at position 858)
    const variantPosition = 858;
    const proteinChange = "p.Leu858Arg";
    const codingChange = "c.2573T>G";
    
    // Create visualization data structure
    const visualizationData = {
      proteinId: uniprotId,
      sequence: sequence,
      length: sequence.length,
      tracks: [
        {
          type: "domain",
          label: "Protein Domains",
          features: domains.map((domain, idx) => ({
            accession: `domain_${idx}`,
            start: domain.begin,
            end: domain.end,
            color: getColorForDomain(idx),
            description: domain.description,
            evidence: domain.evidence
          }))
        },
        {
          type: "variant",
          label: "Variant Position",
          features: [{
            accession: "variant",
            start: variantPosition,
            end: variantPosition,
            color: "#FF0000",
            description: `${proteinChange} (${codingChange})`,
            shape: "diamond"
          }]
        },
        {
          type: "feature",
          label: "Functional Features",
          features: features.map((feature, idx) => ({
            accession: `feature_${idx}`,
            start: feature.begin,
            end: feature.end,
            color: getColorForFeatureType(feature.type),
            description: `${feature.type}: ${feature.description}`,
            shape: feature.begin === feature.end ? "circle" : "rectangle"
          }))
        }
      ]
    };
    
    console.log('✅ Visualization Data Structure Created Successfully!\n');
    console.log('📊 Data Summary:');
    console.log(`- Protein ID: ${visualizationData.proteinId}`);
    console.log(`- Sequence Length: ${visualizationData.length} amino acids`);
    console.log(`- Number of Tracks: ${visualizationData.tracks.length}`);
    
    visualizationData.tracks.forEach(track => {
      console.log(`  - ${track.label}: ${track.features.length} features`);
      if (track.features.length > 0) {
        track.features.forEach(feature => {
          console.log(`    * ${feature.description} (${feature.start}-${feature.end}) [${feature.color}]`);
        });
      }
    });
    
    // Test JSON serialization (what would be stored in artifact)
    const jsonString = JSON.stringify(visualizationData);
    console.log(`\n📝 JSON Size: ${(jsonString.length / 1024).toFixed(1)}KB`);
    
    // Test if it can be parsed back
    const parsed = JSON.parse(jsonString);
    console.log(`✅ JSON serialization/parsing works correctly`);
    
    // Create the artifact structure that our MCP would return
    const artifact = {
      type: "application/vnd.protein-visualization",
      title: `${geneSymbol} Domain Visualization`,
      content: jsonString
    };
    
    console.log('\n🎯 Final Artifact Structure:');
    console.log(`- Type: ${artifact.type}`);
    console.log(`- Title: ${artifact.title}`);
    console.log(`- Content: ${artifact.content.length} characters`);
    
    console.log('\n✅ SUCCESS: Visualization data structure is ready for Nightingale!');
    
  } catch (error) {
    console.error('❌ ERROR:', error.message);
  }
}

// Run the test
testVisualizationData(); 