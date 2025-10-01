// Test the new backwards parsing approach using @@@ boundaries
const testSnippet = "This delay is phenocopied by the loss of @<m>GENE_FAM177A1</m> @GENE_100126028 @@@FAM177A1@@@, a Golgi complex protein of unknown function reported to be a @GENE_LOC101882151 @GENE_101882151 @@@VPS13B@@@ interactor and whose mutations also result in a @<m>DISEASE_Developmental_Disabilities</m> @DISEASE_MESH:D002658 @@@developmental disorder@@@.";

console.log('🧪 Testing Backwards Parsing with @@@ Boundaries...\n');

// Simulate the new backwards parsing logic
function parseSnippetWithClickables(snippet, onEntityClick) {
  // Find all @@@ markers and work backwards from the end
  const atAtAtMatches = [...snippet.matchAll(/@@@([^@]+)@@@/g)];
  
  console.log('Found @@@ markers:', atAtAtMatches.map(m => m[1]));
  
  // Create a map of bold text to their associated terms
  const boldTextToTerms = new Map();
  
  // Work backwards through the @@@ markers
  for (let i = atAtAtMatches.length - 1; i >= 0; i--) {
    const currentMatch = atAtAtMatches[i];
    const boldText = currentMatch[1]; // The text between @@@ markers
    const currentStart = currentMatch.index;
    
    // Find the next @@@ marker (going backwards)
    let nextAtAtAtStart = -1;
    if (i > 0) {
      nextAtAtAtStart = atAtAtMatches[i - 1].index;
    }
    
    // Extract the text between the current @@@ and the next @@@ (or start of string)
    // But exclude the previous @@@ marker itself
    const searchStart = nextAtAtAtStart === -1 ? 0 : nextAtAtAtStart + 3; // +3 to skip past @@@
    const searchText = snippet.substring(searchStart, currentStart);
    
    console.log(`\nProcessing "${boldText}":`);
    console.log(`Search range: ${searchStart} to ${currentStart}`);
    console.log(`Search text: "${searchText}"`);
    
    // Find all @ symbols in this section
    const entityMatches = [...searchText.matchAll(/@<m>([^<]+)<\/m>/g)];
    const simpleMatches = [...searchText.matchAll(/@[A-Z_]+[A-Z0-9_:]*/g)];
    
    console.log(`Entity matches: [${entityMatches.map(m => m[0]).join(', ')}]`);
    console.log(`Simple matches: [${simpleMatches.map(m => m[0]).join(', ')}]`);
    
    // Combine and sort by position
    const allMatches = [
      ...entityMatches.map(m => ({ match: m[0], pos: m.index + searchStart })),
      ...simpleMatches.map(m => ({ match: m[0], pos: m.index + searchStart }))
    ].sort((a, b) => a.pos - b.pos);
    
    // Clean up the terms by removing @<m> and </m> wrappers
    const cleanedTerms = allMatches.map(match => {
      let term = match.match; // e.g., "@<m>GENE_FAM177A1</m>" or "@GENE_100126028"
      
      // Remove @<m> and </m> wrappers
      term = term.replace(/@<m>([^<]+)<\/m>/, '$1');
      
      // Remove the leading @ if it's still there
      term = term.replace(/^@/, '');
      
      return term;
    });
    
    const finalSearchText = cleanedTerms.join(' ');
    
    console.log(`Cleaned terms: [${cleanedTerms.join(', ')}]`);
    console.log(`Final search text: "${finalSearchText}"`);
    
    boldTextToTerms.set(boldText, finalSearchText);
  }
  
  return boldTextToTerms;
}

// Test the parsing
const result = parseSnippetWithClickables(testSnippet, (text) => {
  console.log(`\n🎯 Clicked! Would add to search: "${text}"`);
});

console.log('\n✅ Test Complete!');
console.log('\n📋 Expected Results:');
console.log('- Clicking "FAM177A1" should add: "GENE_FAM177A1 GENE_100126028"');
console.log('- Clicking "VPS13B" should add: "GENE_LOC101882151 GENE_101882151"');
console.log('- Clicking "developmental disorder" should add: "DISEASE_Developmental_Disabilities DISEASE_MESH:D002658"');
