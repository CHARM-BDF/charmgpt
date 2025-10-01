// Debug script to check what snippet data looks like
const testSnippet = "This delay is phenocopied by the loss of @<m>GENE_FAM177A1</m> @GENE_100126028 @@@FAM177A1@@@, a Golgi complex protein of unknown function reported to be a @GENE_LOC101882151 @GENE_101882151 @@@VPS13B@@@ interactor and whose mutations also result in a @<m>DISEASE_Developmental_Disabilities</m> @DISEASE_MESH:D002658 @@@developmental disorder@@@.";

console.log('🧪 Testing Snippet Data Processing...\n');

// Simulate the server processing
function processSnippetData(results) {
  return results.map(result => {
    // Clean up the text_hl field and add @@@ markers for clickable entities
    let cleanSnippet = result.text_hl || '';
    
    // Add @@@ markers around entity names that should be clickable
    // This converts @<m>GENE_FAM177A1</m> to @<m>GENE_FAM177A1</m> @@@FAM177A1@@@
    cleanSnippet = cleanSnippet
      .replace(/@<m>([^<]+)<\/m>/g, (match, entityId) => {
        // Extract the readable name from the entity ID
        // e.g., GENE_FAM177A1 -> FAM177A1, DISEASE_COVID_19 -> COVID-19
        let readableName = entityId;
        
        // Remove prefixes like GENE_, DISEASE_, CHEMICAL_, etc.
        readableName = readableName.replace(/^(GENE_|DISEASE_|CHEMICAL_|SPECIES_|CELL_LINE_|CELL_TYPE_|ORGAN_|TISSUE_|ANATOMY_)/, '');
        
        // Convert underscores to spaces for better readability
        readableName = readableName.replace(/_/g, ' ');
        
        // Return the original markup plus the clickable marker
        return `${match} @@@${readableName}@@@`;
      })
      .replace(/\s+/g, ' ')                 // Normalize whitespace
      .trim();
    
    return {
      snippet: cleanSnippet,
      authors: result.authors || [],
      title: result.title || 'Untitled',
      journal: result.journal || 'Unknown Journal',
      year: '2022',
      pmid: result.pmid?.toString() || '',
    };
  });
}

// Test data
const testResults = [
  {
    text_hl: testSnippet,
    authors: ['Test Author'],
    title: 'Test Title',
    journal: 'Test Journal',
    pmid: '12345'
  }
];

console.log('📥 Input data:');
console.log(JSON.stringify(testResults, null, 2));

const processedData = processSnippetData(testResults);

console.log('\n📤 Processed data:');
console.log(JSON.stringify(processedData, null, 2));

console.log('\n🔍 Snippet content:');
console.log(processedData[0].snippet);

console.log('\n✅ Test Complete!');