const query = {
  message: {
    query_graph: {
      edges: {
        e0: {
          subject: "n0",
          object: "n1"
        }
      },
      nodes: {
        n0: {
          ids: [
            "NCBIGene:283635"
          ],
          categories: [
            "biolink:Gene"
          ],
          is_set: false,
          name: "FAM177A1"
        },
        n1: {
          is_set: false
        }
      }
    }
  },
  submitter: 'User Format Test',
  stream_progress: false,
  query_options: {
    kp_timeout: '30',
    prune_threshold: '50'
  }
};

console.log('🧬 Testing user-provided format...');
console.log('📝 Query: FAM177A1 (NCBIGene:283635) connections with edges structure');

const startTime = Date.now();

fetch('https://arax.ncats.io/api/arax/v1.4/query', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  },
  body: JSON.stringify(query)
})
.then(res => {
  const endTime = Date.now();
  console.log('📡 Response status:', res.status);
  console.log('⏱️ Time taken:', (endTime - startTime) / 1000, 'seconds');
  return res.json();
})
.then(data => {
  console.log('✅ Success! Got', Object.keys(data.message?.knowledge_graph?.nodes || {}).length, 'nodes');
  console.log('✅ Got', Object.keys(data.message?.knowledge_graph?.edges || {}).length, 'edges');
  console.log('📊 Status:', data.status);
  
  if (data.message?.knowledge_graph?.nodes) {
    const nodeTypes = {};
    Object.values(data.message.knowledge_graph.nodes).forEach(node => {
      const category = node.categories?.[0] || 'Unknown';
      nodeTypes[category] = (nodeTypes[category] || 0) + 1;
    });
    console.log('📈 Entity types found:', nodeTypes);
  }
  
  if (data.status !== 'Success' && data.message) {
    console.log('⚠️ Response message:', data.message);
  }
})
.catch(err => console.error('❌ Error:', err.message)); 