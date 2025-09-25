const { spawn } = require('child_process');

// Test the new search-pubtator-papers tool
async function testSearchPapers() {
  console.log('🧪 Testing PubTator Search Papers Tool\n');
  
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

  // Test 1: List tools to verify the new tool is available
  console.log('📋 Test 1: Listing available tools...');
  mcp.stdin.write(JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method: "tools/list"
  }) + '\n');

  await new Promise(resolve => setTimeout(resolve, 2000));

  // Test 2: General search (broader results)
  console.log('\n🔍 Test 2: General search for olaparib AND BRCA1...');
  mcp.stdin.write(JSON.stringify({
    jsonrpc: "2.0",
    id: 2,
    method: "tools/call",
    params: {
      name: "search-pubtator-papers",
      arguments: {
        text: "@CHEMICAL_olaparib AND @GENE_BRCA1",
        search_type: "general",
        max_results: 5
      }
    }
  }) + '\n');

  await new Promise(resolve => setTimeout(resolve, 3000));

  // Test 3: Relations search (more specific results)
  console.log('\n🎯 Test 3: Relations search for olaparib AND BRCA1...');
  mcp.stdin.write(JSON.stringify({
    jsonrpc: "2.0",
    id: 3,
    method: "tools/call",
    params: {
      name: "search-pubtator-papers",
      arguments: {
        text: "@CHEMICAL_olaparib AND @GENE_BRCA1",
        search_type: "relations",
        max_results: 5
      }
    }
  }) + '\n');

  await new Promise(resolve => setTimeout(resolve, 3000));

  // Test 4: Search with different entities
  console.log('\n🧬 Test 4: Relations search for COVID-19 AND PON1...');
  mcp.stdin.write(JSON.stringify({
    jsonrpc: "2.0",
    id: 4,
    method: "tools/call",
    params: {
      name: "search-pubtator-papers",
      arguments: {
        text: "@DISEASE_COVID_19 AND @GENE_PON1",
        search_type: "relations",
        max_results: 3
      }
    }
  }) + '\n');

  await new Promise(resolve => setTimeout(resolve, 3000));

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

testSearchPapers().catch(console.error);
