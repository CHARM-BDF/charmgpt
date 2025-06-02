const query = {
  message: {
    query_graph: {
      nodes: {
        n0: {
          ids: ['NCBIGene:283635']
        },
        n1: {
          // No categories specified - let ARAX find any connected entities
        }
      },
      paths: {
        p0: {
          subject: 'n0',
          object: 'n1',
          predicates: ['biolink:related_to']
        }
      }
    }
  },
  submitter: 'Single Entity No Categories Test',
  stream_progress: false,
  query_options: {
    kp_timeout: '30',
    prune_threshold: '50'
  }
};

console.log('🧬 Testing single entity query WITHOUT categories...');
console.log('📝 Query: What does NCBIGene:283635 connect to (any entity type)');

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
})
.catch(err => console.error('❌ Error:', err.message)); 