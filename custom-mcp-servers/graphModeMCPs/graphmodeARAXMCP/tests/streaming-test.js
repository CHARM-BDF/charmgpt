#!/usr/bin/env node

/**
 * Test ARAX streaming response specifically
 */

async function testStreaming() {
  console.log('🌊 Testing ARAX Streaming Response');
  console.log('===================================');

  const requestData = {
    message: {
      query_graph: {
        nodes: {
          n0: { ids: ["MONDO:0005147"] },
          n1: { ids: ["MONDO:0005406"] }
        },
        edges: {
          e0: {
            subject: "n0",
            object: "n1",
            predicates: ["biolink:related_to"]
          }
        }
      }
    },
    query_options: {
      kp_timeout: "15",
      prune_threshold: "50",
      max_pathfinder_paths: "3",
      max_path_length: "2"
    },
    stream_progress: true,
    submitter: "Streaming Test"
  };

  try {
    console.log('🚀 Making streaming request...');
    const response = await fetch('https://arax.ncats.io/api/arax/v1.4/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestData)
    });

    console.log('📊 Status:', response.status);
    console.log('📊 Content-Type:', response.headers.get('content-type'));

    if (!response.ok) {
      console.log('❌ Error response:', await response.text());
      return;
    }

    // Process streaming response
    const reader = response.body?.getReader();
    if (!reader) {
      console.log('❌ No reader available');
      return;
    }

    const decoder = new TextDecoder();
    let buffer = '';
    let chunkCount = 0;
    let lineCount = 0;

    console.log('📝 Processing stream...');
    console.log('======================');

    try {
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          console.log('✅ Stream completed');
          break;
        }
        
        chunkCount++;
        buffer += decoder.decode(value, { stream: true });
        
        // Process complete lines
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          if (line.trim() === '') continue;
          
          lineCount++;
          console.log(`\n📄 Line ${lineCount}:`);
          
          // Check format
          if (line.startsWith('data: ')) {
            const data = line.substring(6);
            console.log('📦 SSE Data:', data.substring(0, 150));
            
            if (data === '[DONE]') {
              console.log('🏁 [DONE] marker found');
              break;
            }
            
            try {
              const parsed = JSON.parse(data);
              console.log('✅ JSON parsed successfully');
              console.log('📊 Structure:', {
                hasMessage: !!parsed.message,
                hasKnowledgeGraph: !!parsed.message?.knowledge_graph,
                hasResults: !!parsed.message?.results,
                timestamp: parsed.timestamp,
                level: parsed.level
              });
              
              if (parsed.message?.knowledge_graph) {
                console.log('🎯 KNOWLEDGE GRAPH FOUND!');
                console.log('📊 Nodes:', Object.keys(parsed.message.knowledge_graph.nodes || {}).length);
                console.log('📊 Edges:', Object.keys(parsed.message.knowledge_graph.edges || {}).length);
              }
            } catch (e) {
              console.log('❌ JSON parse error:', e.message);
            }
          } else {
            console.log('📄 Raw line:', line.substring(0, 100));
          }
          
          if (lineCount > 20) {
            console.log('🛑 Stopping after 20 lines for testing');
            break;
          }
        }
        
        if (chunkCount > 10) {
          console.log('🛑 Stopping after 10 chunks for testing');
          break;
        }
      }
    } finally {
      reader.releaseLock();
    }

    console.log('\n📊 Summary:');
    console.log('===========');
    console.log('Chunks processed:', chunkCount);
    console.log('Lines processed:', lineCount);
    console.log('Buffer remaining:', buffer.length);

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testStreaming();
