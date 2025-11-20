#!/usr/bin/env node

/**
 * Test script to understand ARAX API response format
 * This mimics exactly what our MCP is doing
 */

const ARAX_API_URL = "https://arax.ncats.io/api/arax/v1.4";

async function testAraxAPI() {
  console.log('🧪 Testing ARAX API Response Format');
  console.log('=====================================');

  // Test data - same as what our MCP sends
  const requestData = {
    message: {
      query_graph: {
        nodes: {
          n0: {
            ids: ["MONDO:0005147"]
          },
          n1: {
            ids: ["MONDO:0005406"]
          }
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
      kp_timeout: "30",
      prune_threshold: "50",
      max_pathfinder_paths: "5",
      max_path_length: "3"
    },
    stream_progress: true,
    submitter: "ARAX Test Script"
  };

  console.log('📤 Request Data:');
  console.log(JSON.stringify(requestData, null, 2));
  console.log('\n');

  try {
    console.log('🚀 Making request to ARAX API...');
    const response = await fetch(`${ARAX_API_URL}/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestData)
    });

    console.log('📊 Response Status:', response.status);
    console.log('📊 Response Headers:');
    console.log(JSON.stringify(Object.fromEntries(response.headers.entries()), null, 2));
    console.log('\n');

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ API Error:', errorText);
      return;
    }

    // Check if it's a streaming response
    const contentType = response.headers.get('content-type');
    console.log('📋 Content Type:', contentType);

    if (contentType && contentType.includes('text/event-stream')) {
      console.log('🌊 Processing streaming response...');
      await processStreamingResponse(response);
    } else {
      console.log('📄 Processing regular JSON response...');
      const data = await response.json();
      console.log('📦 Response Data:');
      console.log(JSON.stringify(data, null, 2));
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

async function processStreamingResponse(response) {
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('No response body reader available');
  }

  const decoder = new TextDecoder();
  let buffer = '';
  let lineCount = 0;
  let finalResponse = null;
  const maxLines = 100; // Limit for testing

  console.log('📝 Streaming Response Analysis:');
  console.log('===============================');

  try {
    while (true) {
      const { done, value } = await reader.read();
      
      if (done) {
        console.log('✅ Stream completed normally');
        break;
      }
      
      buffer += decoder.decode(value, { stream: true });
      
      // Process complete lines
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep incomplete line in buffer
      
      for (const line of lines) {
        if (line.trim() === '') continue;
        
        lineCount++;
        console.log(`\n📄 Line ${lineCount}:`);
        console.log('Raw:', line.substring(0, 200) + (line.length > 200 ? '...' : ''));
        
        // Check for Server-Sent Events format
        if (line.startsWith('data: ')) {
          const data = line.substring(6);
          console.log('📦 SSE Data:', data.substring(0, 100) + (data.length > 100 ? '...' : ''));
          
          if (data === '[DONE]') {
            console.log('🏁 Stream completed with [DONE] marker');
            break;
          }
          
          try {
            const parsed = JSON.parse(data);
            console.log('✅ Parsed JSON:', {
              hasMessage: !!parsed.message,
              hasKnowledgeGraph: !!parsed.message?.knowledge_graph,
              hasResults: !!parsed.message?.results,
              timestamp: parsed.timestamp,
              level: parsed.level,
              messageKeys: parsed.message ? Object.keys(parsed.message) : []
            });
            
            if (parsed.message && parsed.message.knowledge_graph) {
              console.log('🎯 Found complete response with knowledge graph!');
              finalResponse = parsed;
            }
          } catch (e) {
            console.log('❌ Failed to parse JSON:', e.message);
          }
        } else {
          // Try direct JSON parsing
          try {
            const parsed = JSON.parse(line);
            console.log('✅ Direct JSON:', {
              hasMessage: !!parsed.message,
              hasKnowledgeGraph: !!parsed.message?.knowledge_graph,
              hasResults: !!parsed.message?.results,
              timestamp: parsed.timestamp,
              level: parsed.level
            });
            
            if (parsed.message && parsed.message.knowledge_graph) {
              console.log('🎯 Found complete response with knowledge graph (direct)!');
              finalResponse = parsed;
            }
          } catch (e) {
            console.log('❌ Not JSON:', line.substring(0, 50));
          }
        }
        
        if (lineCount >= maxLines) {
          console.log('🛑 Reached max lines limit');
          break;
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  console.log('\n📊 Final Analysis:');
  console.log('==================');
  console.log('Total lines processed:', lineCount);
  console.log('Final response found:', !!finalResponse);
  
  if (finalResponse) {
    console.log('Final response structure:', {
      hasMessage: !!finalResponse.message,
      hasKnowledgeGraph: !!finalResponse.message?.knowledge_graph,
      hasNodes: !!finalResponse.message?.knowledge_graph?.nodes,
      hasEdges: !!finalResponse.message?.knowledge_graph?.edges,
      nodeCount: finalResponse.message?.knowledge_graph?.nodes ? Object.keys(finalResponse.message.knowledge_graph.nodes).length : 0,
      edgeCount: finalResponse.message?.knowledge_graph?.edges ? Object.keys(finalResponse.message.knowledge_graph.edges).length : 0
    });
  } else {
    console.log('❌ No valid response found');
    console.log('Buffer content:', buffer.substring(0, 500));
  }
}

// Run the test
testAraxAPI().catch(console.error);
