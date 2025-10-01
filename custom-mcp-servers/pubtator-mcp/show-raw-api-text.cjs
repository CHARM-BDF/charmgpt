// Show the raw text_hl content from PubTator API
const https = require('https');

console.log('🔍 Showing Raw PubTator API Text Content...\n');

// Test with BRCA1 search (same as your test)
const searchText = 'BRCA1';
const url = `https://www.ncbi.nlm.nih.gov/research/pubtator3-api/search/?text=${encodeURIComponent(searchText)}&page_size=5&current=1`;

console.log(`📡 Searching for: "${searchText}"`);
console.log(`🌐 URL: ${url}\n`);

https.get(url, (res) => {
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    try {
      const response = JSON.parse(data);
      
      if (response.results && response.results.length > 0) {
        console.log(`📥 Found ${response.results.length} results\n`);
        
        response.results.forEach((result, index) => {
          console.log(`📄 Result ${index + 1}:`);
          console.log(`- PMID: ${result.pmid}`);
          console.log(`- Title: ${result.title}`);
          console.log(`- Journal: ${result.journal}`);
          
          if (result.text_hl) {
            console.log(`\n📝 Raw text_hl content:`);
            console.log(`"${result.text_hl}"`);
            
            // Show all the different entity types found
            console.log(`\n🔍 Entity Analysis:`);
            
            // Find all @GENE_ entities
            const geneMatches = result.text_hl.match(/@GENE_[A-Z0-9_]+/g);
            if (geneMatches) {
              console.log(`- @GENE_ entities: ${geneMatches.join(', ')}`);
            }
            
            // Find all @DISEASE_ entities  
            const diseaseMatches = result.text_hl.match(/@DISEASE_[A-Z0-9_:]+/g);
            if (diseaseMatches) {
              console.log(`- @DISEASE_ entities: ${diseaseMatches.join(', ')}`);
            }
            
            // Find all @CHEMICAL_ entities
            const chemicalMatches = result.text_hl.match(/@CHEMICAL_[A-Z0-9_]+/g);
            if (chemicalMatches) {
              console.log(`- @CHEMICAL_ entities: ${chemicalMatches.join(', ')}`);
            }
            
            // Find all @@@ markers
            const atAtAtMatches = result.text_hl.match(/@@@[^@]+@@@/g);
            if (atAtAtMatches) {
              console.log(`- @@@ markers: ${atAtAtMatches.join(', ')}`);
            }
            
            // Find all @<m> entities
            const atMMatches = result.text_hl.match(/@<m>[^<]+<\/m>/g);
            if (atMMatches) {
              console.log(`- @<m> entities: ${atMMatches.join(', ')}`);
            }
            
            // Show what would be clickable vs not clickable
            console.log(`\n🎯 Clickability Analysis:`);
            const clickableTerms = atAtAtMatches ? atAtAtMatches.map(m => m.replace(/@@@/g, '')) : [];
            const nonClickableTerms = [];
            
            // Find entities that are NOT in @@@ markers
            const allEntities = [
              ...(geneMatches || []),
              ...(diseaseMatches || []),
              ...(chemicalMatches || [])
            ];
            
            allEntities.forEach(entity => {
              const entityId = entity.replace(/^@[A-Z_]+_/, '');
              if (!clickableTerms.some(term => term.includes(entityId))) {
                nonClickableTerms.push(entity);
              }
            });
            
            if (clickableTerms.length > 0) {
              console.log(`- Clickable terms: ${clickableTerms.join(', ')}`);
            }
            if (nonClickableTerms.length > 0) {
              console.log(`- Non-clickable entities: ${nonClickableTerms.join(', ')}`);
            }
            
          } else {
            console.log(`- No text_hl field`);
          }
          
          console.log('\n' + '='.repeat(80) + '\n');
        });
        
      } else {
        console.log('❌ No results returned from API');
      }
      
      console.log('✅ Raw text analysis complete!');
      
    } catch (error) {
      console.error('❌ Error parsing response:', error.message);
    }
  });
  
}).on('error', (error) => {
  console.error('❌ Request error:', error.message);
});
