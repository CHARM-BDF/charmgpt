const { spawn } = require('child_process');

// Test just the relations search
async function testRelationsSearch() {
  console.log('🧪 Testing PubTator Relations Search\n');
  
  const mcp = spawn('node', ['dist/index.js'], {
    stdio: ['pipe', 'pipe', 'pipe']
  });

  let output = '';
  let errorOutput = '';

  mcp.stdout.on('data', (data) => {
    output += data.toString();
  });

  mcp.stderr.on('data', (data) => {
    errorOutput += data.toString();
  });

  // Test relations search
  console.log('🎯 Testing relations search for olaparib AND BRCA1...');
  mcp.stdin.write(JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method: "tools/call",
    params: {
      name: "search-pubtator-papers",
      arguments: {
        text: "@CHEMICAL_olaparib AND @GENE_BRCA1",
        search_type: "relations",
        max_results: 3
      }
    }
  }) + '\n');

  await new Promise(resolve => setTimeout(resolve, 5000));

  mcp.kill();

  console.log('\n📊 Test Results:');
  console.log('================');
  console.log(output);
  
  if (errorOutput) {
    console.log('\n⚠️  Error Output:');
    console.log('================');
    console.log(errorOutput);
  }
}

testRelationsSearch().catch(console.error);
