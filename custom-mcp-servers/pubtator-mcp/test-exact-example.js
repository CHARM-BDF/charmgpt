// Test with the exact example provided by the user
const testSnippet = "This delay is phenocopied by the loss of @<m>GENE_FAM177A1</m> @GENE_100126028 [CLICKABLE_BOLD]FAM177A1[/CLICKABLE_BOLD], a Golgi complex protein of unknown function reported to be a @GENE_LOC101882151 @GENE_101882151 [CLICKABLE_BOLD]VPS13B[/CLICKABLE_BOLD] interactor and whose mutations also result in a @<m>DISEASE_Developmental_Disabilities</m> @DISEASE_MESH:D002658 [CLICKABLE_BOLD]developmental disorder[/CLICKABLE_BOLD].";

console.log('🧪 Testing with Exact User Example...\n');

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
    
    // Look backwards from the bold text to find @ symbols (up to 3 terms)
    // First find @<m>...</m> format
    const entityMatches = [...beforeThisBold.matchAll(/@<m>([^<]+)<\/m>/g)];
    // Then find simple @SYMBOL format
    const simpleMatches = [...beforeThisBold.matchAll(/@[A-Z_]+[A-Z0-9_:]*/g)];
    
    // Combine and sort by position
    const allMatches = [
      ...entityMatches.map(m => ({ match: m[0], pos: m.index })),
      ...simpleMatches.map(m => ({ match: m[0], pos: m.index }))
    ].sort((a, b) => a.pos - b.pos);
    
    const atSymbolMatches = allMatches.map(m => ({ 0: m.match, index: m.pos }));
    
    // Get the last 3 @ symbols before this bold text, but be more selective
    let recentAtSymbols = atSymbolMatches.slice(-3);
    
    // If we have more than 2 symbols, try to be more selective
    if (recentAtSymbols.length > 2) {
      // Find the last 2 @ symbols that are closest to the bold text
      recentAtSymbols = atSymbolMatches.slice(-2);
    }
    
    console.log(`\nBold text: "${boldText}"`);
    console.log(`@ symbols found: [${recentAtSymbols.map(m => m[0]).join(', ')}]`);
    
    // Clean up the terms by removing @<m> and </m> wrappers
    const cleanedTerms = recentAtSymbols.map(match => {
      let term = match[0]; // e.g., "@<m>GENE_FAM177A1</m>" or "@GENE_100126028"
      
      // Remove @<m> and </m> wrappers
      term = term.replace(/@<m>([^<]+)<\/m>/, '$1');
      
      // Remove the leading @ if it's still there
      term = term.replace(/^@/, '');
      
      return term;
    });
    
    const searchText = cleanedTerms.join(' ');
    
    console.log(`Cleaned terms: [${cleanedTerms.join(', ')}]`);
    console.log(`Final search text: "${searchText}"`);
    
    boldTextToTerms.set(boldText, searchText);
  });
  
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
