#!/usr/bin/env node

/**
 * Debug script to see the full ARAX response structure
 */

async function debugResponse() {
  console.log('🔍 Debugging ARAX Response Structure');
  console.log('=====================================');

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
      kp_timeout: "10",
      prune_threshold: "50",
      max_pathfinder_paths: "3",
      max_path_length: "2"
    },
    stream_progress: true,
    submitter: "Debug Test"
  };

  try {
    console.log('🚀 Making request...');
    const response = await fetch('https://arax.ncats.io/api/arax/v1.4/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestData)
    });

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
    let lineCount = 0;
    let foundCompleteResponse = false;

    console.log('📝 Processing stream...');
    console.log('======================');

    try {
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        
        // Process complete lines
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          if (line.trim() === '') continue;
          
          lineCount++;
          
          try {
            const parsed = JSON.parse(line);
            
            // Look for responses with message field
            if (parsed.message) {
              console.log(`\n📄 Line ${lineCount} - Message Structure:`);
              console.log('Message type:', Array.isArray(parsed.message) ? 'ARRAY' : 'OBJECT');
              console.log('Message length/keys:', Array.isArray(parsed.message) ? parsed.message.length : Object.keys(parsed.message).length);
              
              if (Array.isArray(parsed.message)) {
                console.log('Array contents:');
                parsed.message.forEach((item, index) => {
                  console.log(`  [${index}]:`, typeof item, Object.keys(item || {}));
                });
              } else {
                console.log('Object keys:', Object.keys(parsed.message));
                if (parsed.message.knowledge_graph) {
                  console.log('🎯 KNOWLEDGE GRAPH FOUND!');
                  console.log('Nodes:', Object.keys(parsed.message.knowledge_graph.nodes || {}).length);
                  console.log('Edges:', Object.keys(parsed.message.knowledge_graph.edges || {}).length);
                  foundCompleteResponse = true;
                }
              }
            }
            
            // Also check for direct knowledge_graph
            if (parsed.knowledge_graph) {
              console.log('🎯 DIRECT KNOWLEDGE GRAPH FOUND!');
              console.log('Nodes:', Object.keys(parsed.knowledge_graph.nodes || {}).length);
              console.log('Edges:', Object.keys(parsed.knowledge_graph.edges || {}).length);
              foundCompleteResponse = true;
            }
            
          } catch (e) {
            // Skip non-JSON lines
          }
          
          if (lineCount > 50) {
            console.log('🛑 Stopping after 50 lines for debugging');
            break;
          }
        }
        
        if (foundCompleteResponse) {
          console.log('✅ Found complete response, stopping');
          break;
        }
      }
    } finally {
      reader.releaseLock();
    }

    console.log('\n📊 Summary:');
    console.log('===========');
    console.log('Lines processed:', lineCount);
    console.log('Complete response found:', foundCompleteResponse);

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

debugResponse();
