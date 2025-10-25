#!/usr/bin/env node

/**
 * Simple test to check ARAX API basic functionality
 */

async function simpleTest() {
  console.log('🧪 Simple ARAX API Test');
  console.log('========================');

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
    stream_progress: false, // Try without streaming first
    submitter: "Simple Test"
  };

  try {
    console.log('🚀 Making request...');
    const response = await fetch('https://arax.ncats.io/api/arax/v1.4/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestData)
    });

    console.log('📊 Status:', response.status);
    console.log('📊 Content-Type:', response.headers.get('content-type'));

    if (response.ok) {
      const text = await response.text();
      console.log('📄 Response length:', text.length);
      console.log('📄 First 500 chars:', text.substring(0, 500));
      
      try {
        const json = JSON.parse(text);
        console.log('✅ Valid JSON response');
        console.log('📦 Keys:', Object.keys(json));
        if (json.message) {
          console.log('📦 Message keys:', Object.keys(json.message));
        }
      } catch (e) {
        console.log('❌ Not JSON, raw text response');
      }
    } else {
      console.log('❌ Error response:', await response.text());
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

simpleTest();
