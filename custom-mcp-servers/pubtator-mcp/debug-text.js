// Debug the text structure to understand why @ symbols aren't being found
const testSnippet = "This delay is phenocopied by the loss of [CLICKABLE_ENTITY]@<m>GENE_FAM177A1</m>[/CLICKABLE_ENTITY] @GENE_100126028 [CLICKABLE_BOLD]FAM177A1[/CLICKABLE_BOLD], a Golgi complex protein of unknown function reported to be a @GENE_LOC101882151 @GENE_101882151 [CLICKABLE_BOLD]VPS13B[/CLICKABLE_BOLD] interactor and whose mutations also result in a [CLICKABLE_ENTITY]@<m>DISEASE_Developmental_Disabilities</m>[/CLICKABLE_ENTITY] @DISEASE_MESH:D002658 [CLICKABLE_BOLD]developmental disorder[/CLICKABLE_BOLD].";

console.log('🔍 Debugging Text Structure...\n');

// Find VPS13B position
const vps13bMatch = testSnippet.match(/\[CLICKABLE_BOLD\]VPS13B\[\/CLICKABLE_BOLD\]/);
if (vps13bMatch) {
  const vps13bIndex = vps13bMatch.index;
  console.log('VPS13B found at index:', vps13bIndex);
  
  // Get text before VPS13B
  const beforeVPS13B = testSnippet.substring(0, vps13bIndex);
  console.log('\nText before VPS13B:');
  console.log(beforeVPS13B);
  
  // Get last 100 characters before VPS13B
  const recentText = beforeVPS13B.slice(-100);
  console.log('\nLast 100 characters before VPS13B:');
  console.log(recentText);
  
  // Find all @ symbols in recent text
  const atSymbolMatches = [...recentText.matchAll(/@[A-Z_]+:[A-Z0-9_]+/g)];
  console.log('\n@ symbols found in recent text:');
  atSymbolMatches.forEach((match, i) => {
    console.log(`${i + 1}. "${match[0]}" at position ${match.index}`);
  });
  
  // Find all @ symbols in the entire text before VPS13B
  const allAtSymbols = [...beforeVPS13B.matchAll(/@[A-Z_]+:[A-Z0-9_]+/g)];
  console.log('\nAll @ symbols before VPS13B:');
  allAtSymbols.forEach((match, i) => {
    console.log(`${i + 1}. "${match[0]}" at position ${match.index}`);
  });
}

console.log('\n✅ Debug Complete!');
