const { spawn } = require('child_process');

// Test the snippet view functionality
async function testSnippetView() {
  console.log('🧪 Testing PubTator Snippet View...\n');
  
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
    // Test 1: List tools
    console.log('📋 Testing list-tools...');
    const listToolsRequest = {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/list',
      params: {}
    };
    
    mcpProcess.stdin.write(JSON.stringify(listToolsRequest) + '\n');
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Test 2: Search with snippet view
    console.log('🔍 Testing search-pubtator-papers with snippet view...');
    const searchRequest = {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: {
        name: 'search-pubtator-papers',
        arguments: {
          text: '@DISEASE_Developmental_Disabilities AND @GENE_FAM177A1',
          search_type: 'relations',
          max_results: 2,
          page: 1,
          include_facets: true
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
    
    // Check if snippet view artifact was created
    if (output.includes('application/vnd.snippet-view')) {
      console.log('\n🎉 SUCCESS: Snippet view artifact type found in output!');
    } else {
      console.log('\n⚠️  WARNING: Snippet view artifact type not found in output');
    }
    
    if (output.includes('snippets')) {
      console.log('🎉 SUCCESS: Snippet data found in output!');
    } else {
      console.log('⚠️  WARNING: Snippet data not found in output');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    mcpProcess.kill();
  }
}

testSnippetView().catch(console.error);
