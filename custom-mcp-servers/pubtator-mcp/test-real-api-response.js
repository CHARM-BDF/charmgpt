// Test script to check what the real PubTator API returns
const https = require('https');

console.log('🧪 Testing Real PubTator API Response...\n');

// Test with a simple search
const searchText = 'BRCA1';
const url = `https://www.ncbi.nlm.nih.gov/research/pubtator3-api/search/?text=${encodeURIComponent(searchText)}&page_size=3&current=1`;

console.log(`🔍 Searching for: "${searchText}"`);
console.log(`📡 URL: ${url}\n`);

https.get(url, (res) => {
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    try {
      const response = JSON.parse(data);
      
      console.log('📥 API Response Structure:');
      console.log(`- Total results: ${response.count || 'N/A'}`);
      console.log(`- Results returned: ${response.results ? response.results.length : 0}\n`);
      
      if (response.results && response.results.length > 0) {
        const firstResult = response.results[0];
        
        console.log('📄 First Result Structure:');
        console.log(`- PMID: ${firstResult.pmid || 'N/A'}`);
        console.log(`- Title: ${firstResult.title || 'N/A'}`);
        console.log(`- Journal: ${firstResult.journal || 'N/A'}`);
        console.log(`- Has text_hl: ${firstResult.text_hl ? 'YES' : 'NO'}\n`);
        
        if (firstResult.text_hl) {
          console.log('🔍 text_hl content:');
          console.log(`"${firstResult.text_hl}"\n`);
          
          // Check for @@@ markers
          const hasAtAtAt = firstResult.text_hl.includes('@@@');
          const hasAtM = firstResult.text_hl.includes('@<m>');
          
          console.log('📊 Markup Analysis:');
          console.log(`- Contains @@@ markers: ${hasAtAtAt ? 'YES' : 'NO'}`);
          console.log(`- Contains @<m> markers: ${hasAtM ? 'YES' : 'NO'}`);
          
          if (hasAtM) {
            const atMMatches = firstResult.text_hl.match(/@<m>[^<]+<\/m>/g);
            console.log(`- @<m> entities found: ${atMMatches ? atMMatches.length : 0}`);
            if (atMMatches) {
              console.log(`- Examples: ${atMMatches.slice(0, 3).join(', ')}`);
            }
          }
        }
      }
      
      console.log('\n✅ Test Complete!');
      
    } catch (error) {
      console.error('❌ Error parsing response:', error.message);
      console.log('Raw response:', data.substring(0, 500) + '...');
    }
  });
  
}).on('error', (error) => {
  console.error('❌ Request error:', error.message);
});
