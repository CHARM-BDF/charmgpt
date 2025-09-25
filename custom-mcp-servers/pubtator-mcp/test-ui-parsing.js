// Simple test to verify the UI parsing logic works correctly
const testSnippet = "This delay is phenocopied by the loss of [CLICKABLE_ENTITY]@<m>GENE_FAM177A1</m>[/CLICKABLE_ENTITY] @GENE_100126028 [CLICKABLE_BOLD]FAM177A1[/CLICKABLE_BOLD], a Golgi complex protein of unknown function reported to be a @GENE_LOC101882151 @GENE_101882151 [CLICKABLE_BOLD]VPS13B[/CLICKABLE_BOLD] interactor and whose mutations also result in a [CLICKABLE_ENTITY]@<m>DISEASE_Developmental_Disabilities</m>[/CLICKABLE_ENTITY] @DISEASE_MESH:D002658 [CLICKABLE_BOLD]developmental disorder[/CLICKABLE_BOLD].";

console.log('🧪 Testing UI Parsing Logic...\n');

// Simulate the improved parsing logic
function parseSnippetWithClickables(snippet, onEntityClick) {
  const clickableMatches = [...snippet.matchAll(/\[CLICKABLE_BOLD\]([^[]+)\[\/CLICKABLE_BOLD\]/g)];
  
  console.log('Found clickable bold text:', clickableMatches.map(m => m[1]));
  
  // Create a map of bold text to their associated terms
  const boldTextToTerms = new Map();
  
  clickableMatches.forEach((match, index) => {
    const boldText = match[1];
    const matchStart = match.index;
    
    // Find text before this specific bold text occurrence
    const beforeThisBold = snippet.substring(0, matchStart);
    
    // Find the most recent entity markup before this bold text
    const entityMatches = [...beforeThisBold.matchAll(/\[CLICKABLE_ENTITY\]([^[]+)\[\/CLICKABLE_ENTITY\]/g)];
    
    // Find @ symbols that are directly before this bold text (within the last 100 characters)
    const recentText = beforeThisBold.slice(-100);
    const atSymbolMatches = [...recentText.matchAll(/@[A-Z_]+[A-Z0-9_]*/g)];
    
    // Get the last entity and recent @ symbols before this bold text
    const lastEntity = entityMatches.length > 0 ? entityMatches[entityMatches.length - 1][1] : '';
    const recentAtSymbols = atSymbolMatches.slice(-2); // Get last 2 @ symbols from recent text
    
    const relatedTerms = [
      lastEntity,
      ...recentAtSymbols.map(m => m[0])
    ].filter(term => term !== '');
    
    const searchText = relatedTerms.join(' ');
    
    console.log(`\nBold text: "${boldText}"`);
    console.log(`Last entity: "${lastEntity}"`);
    console.log(`Recent @ symbols: [${recentAtSymbols.map(m => m[0]).join(', ')}]`);
    console.log(`Search text: "${searchText}"`);
    
    boldTextToTerms.set(boldText, searchText);
  });
  
  return boldTextToTerms;
}

// Test the parsing
const result = parseSnippetWithClickables(testSnippet, (text) => {
  console.log(`\n🎯 Clicked! Would add to search: "${text}"`);
});

console.log('\n✅ UI Parsing Test Complete!');
console.log('\n📋 Expected Behavior:');
console.log('- Clicking "FAM177A1" should add: "@<m>GENE_FAM177A1</m> @GENE_100126028"');
console.log('- Clicking "VPS13B" should add: "@GENE_LOC101882151 @GENE_101882151"');
console.log('- Clicking "developmental disorder" should add: "@<m>DISEASE_Developmental_Disabilities</m> @DISEASE_MESH:D002658"');
