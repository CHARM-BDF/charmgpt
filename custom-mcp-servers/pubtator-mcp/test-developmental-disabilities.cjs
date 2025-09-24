const { spawn } = require('child_process');

// Test the new search tool with Developmental Disabilities and FAM177A1
async function testDevelopmentalDisabilities() {
  console.log('🧪 Testing PubTator Search: Developmental Disabilities + FAM177A1\n');
  
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

  // Test 1: General search (broader results)
  console.log('🔍 Test 1: General search for Developmental Disabilities AND FAM177A1...');
  mcp.stdin.write(JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method: "tools/call",
    params: {
      name: "search-pubtator-papers",
      arguments: {
        text: "@DISEASE_Developmental_Disabilities AND @GENE_FAM177A1",
        search_type: "general",
        max_results: 10
      }
    }
  }) + '\n');

  await new Promise(resolve => setTimeout(resolve, 3000));

  // Test 2: Relations search (more specific results)
  console.log('\n🎯 Test 2: Relations search for Developmental Disabilities AND FAM177A1...');
  mcp.stdin.write(JSON.stringify({
    jsonrpc: "2.0",
    id: 2,
    method: "tools/call",
    params: {
      name: "search-pubtator-papers",
      arguments: {
        text: "@DISEASE_Developmental_Disabilities AND @GENE_FAM177A1",
        search_type: "relations",
        max_results: 10
      }
    }
  }) + '\n');

  await new Promise(resolve => setTimeout(resolve, 3000));

  // Test 3: Try just FAM177A1 gene to see what's available
  console.log('\n🧬 Test 3: General search for FAM177A1 gene only...');
  mcp.stdin.write(JSON.stringify({
    jsonrpc: "2.0",
    id: 3,
    method: "tools/call",
    params: {
      name: "search-pubtator-papers",
      arguments: {
        text: "@GENE_FAM177A1",
        search_type: "general",
        max_results: 5
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

testDevelopmentalDisabilities().catch(console.error);
