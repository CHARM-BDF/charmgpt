const { spawn } = require('child_process');

// Test the variant-domain MCP with visualization output
async function testVisualization() {
  console.log('Testing variant-domain MCP visualization output...\n');
  
  // Start the MCP server
  const server = spawn('node', ['dist/index.js'], {
    stdio: ['pipe', 'pipe', 'pipe']
  });

  // Handle server output
  let output = '';
  server.stdout.on('data', (data) => {
    output += data.toString();
  });

  server.stderr.on('data', (data) => {
    console.error('Server error:', data.toString());
  });

  // Send initialization
  const initRequest = {
    jsonrpc: "2.0",
    method: "initialize",
    params: {
      protocolVersion: "2024-11-05",
      capabilities: {}
    },
    id: 1
  };

  server.stdin.write(JSON.stringify(initRequest) + '\n');

  // Wait a bit for initialization
  await new Promise(resolve => setTimeout(resolve, 500));

  // Test visualization output
  const testRequest = {
    jsonrpc: "2.0",
    method: "tools/call",
    params: {
      name: "map-variant-to-domains",
      arguments: {
        transcript_id: "NM_005228.3",
        gene_symbol: "EGFR",
        protein_change: "p.Leu858Arg",
        coding_change: "c.2573T>G",
        output_format: "visualization"
      }
    },
    id: 2
  };

  console.log('Sending test request for EGFR L858R with visualization output...\n');
  server.stdin.write(JSON.stringify(testRequest) + '\n');

  // Wait for response (longer timeout for NCBI calls)
  await new Promise(resolve => setTimeout(resolve, 10000));

  // Parse and display results
  const lines = output.split('\n').filter(line => line.trim());
  for (const line of lines) {
    try {
      const json = JSON.parse(line);
      if (json.id === 2) {
        console.log('Response received!');
        if (json.result) {
          console.log('\nArtifacts:', JSON.stringify(json.result.artifacts, null, 2));
          
          // Check if we got the expected visualization artifact
          const artifact = json.result.artifacts?.[0];
          if (artifact && artifact.type === 'application/vnd.protein-visualization') {
            console.log('\n✅ SUCCESS: Visualization artifact created!');
            console.log('Artifact type:', artifact.type);
            console.log('Title:', artifact.title);
            
            // Parse and check content structure
            const content = JSON.parse(artifact.content);
            console.log('\nVisualization data structure:');
            console.log('- Protein ID:', content.proteinId);
            console.log('- Sequence length:', content.length);
            console.log('- Number of tracks:', content.tracks.length);
            content.tracks.forEach(track => {
              console.log(`  - ${track.label}: ${track.features.length} features`);
            });
          } else {
            console.log('\n❌ ERROR: Expected visualization artifact not found');
          }
        } else if (json.error) {
          console.log('\n❌ ERROR:', json.error);
        }
      }
    } catch (e) {
      // Ignore non-JSON lines
    }
  }

  // Kill the server
  server.kill();
}

// Run the test
testVisualization().catch(console.error); 