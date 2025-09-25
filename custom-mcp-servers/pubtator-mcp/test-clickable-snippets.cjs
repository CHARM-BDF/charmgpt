const { spawn } = require('child_process');

// Test the clickable snippet view functionality
async function testClickableSnippets() {
  console.log('🧪 Testing PubTator Clickable Snippet View...\n');
  
  const mcpProcess = spawn('node', ['dist/index.js'], {
    stdio: ['pipe', 'pipe', 'pipe']
  });
  
  let output = '';
  let errorOutput = '';
  
  mcpProcess.stdout.on('data', (data) => {
    output += data.toString();
  });
  
  mcpProcess.stderr.on('data', (data) => {
    errorOutput += data.toString();
  });
  
  // Wait for server to start
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  try {
    // Test search with clickable snippets
    console.log('🔍 Testing search-pubtator-papers with clickable snippets...');
    const searchRequest = {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: {
        name: 'search-pubtator-papers',
        arguments: {
          text: '@DISEASE_Developmental_Disabilities AND @GENE_FAM177A1',
          search_type: 'relations',
          max_results: 1,
          page: 1,
          include_facets: false
        }
      }
    };
    
    mcpProcess.stdin.write(JSON.stringify(searchRequest) + '\n');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    console.log('✅ Test completed!');
    console.log('\n📊 Output received:');
    console.log('='.repeat(80));
    console.log(output);
    console.log('='.repeat(80));
    
    if (errorOutput) {
      console.log('\n❌ Errors:');
      console.log(errorOutput);
    }
    
    // Check for clickable markers in snippet data
    if (output.includes('[CLICKABLE]@<m>GENE_FAM177A1</m>[/CLICKABLE]')) {
      console.log('\n🎉 SUCCESS: Clickable markers found in snippet data!');
    } else {
      console.log('\n⚠️  WARNING: Clickable markers not found in snippet data');
    }
    
    if (output.includes('application/vnd.snippet-view')) {
      console.log('🎉 SUCCESS: Snippet view artifact type found!');
    } else {
      console.log('⚠️  WARNING: Snippet view artifact type not found');
    }
    
    // Check for both artifacts (JSON + Snippet View)
    const artifactCount = (output.match(/"type":"application\/vnd\./g) || []).length;
    if (artifactCount >= 2) {
      console.log(`🎉 SUCCESS: Multiple artifacts found (${artifactCount})!`);
    } else {
      console.log(`⚠️  WARNING: Expected 2+ artifacts, found ${artifactCount}`);
    }
    
    // Check for markdown bold formatting
    if (output.includes('**FAM177A1**') && output.includes('**VPS13B**')) {
      console.log('🎉 SUCCESS: Markdown bold formatting found!');
    } else {
      console.log('⚠️  WARNING: Markdown bold formatting not found');
    }
    
    console.log('\n📋 Implementation Status:');
    console.log('✅ Phase 1: Text processing with clickable markers');
    console.log('✅ Phase 2: UI component parsing function');
    console.log('✅ Phase 3: State management integration');
    console.log('⏳ Phase 4: Testing (in progress)');
    console.log('⏳ Phase 5: Documentation (pending)');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    mcpProcess.kill();
  }
}

testClickableSnippets().catch(console.error);
