#!/usr/bin/env tsx

import { EventSource } from 'undici';

interface AraxQueryNode {
  ids?: string[];
  categories: string[];
  is_set?: boolean;
  name?: string;
}

interface AraxQueryEdge {
  predicates: string[];
  subject: string;
  object: string;
}

interface AraxQuery {
  message: {
    query_graph: {
      edges: Record<string, AraxQueryEdge>;
      nodes: Record<string, AraxQueryNode>;
    };
  };
  submitter?: string;
  stream_progress?: boolean;
  query_options?: {
    kp_timeout?: string;
    prune_threshold?: string;
  };
}

const ARAX_API_URL = 'https://arax.ncats.io/api/arax/v1.4/query';

// The query from your example - what does FAM177A1 affect?
const testQuery: AraxQuery = {
  message: {
    query_graph: {
      edges: {
        e0: {
          predicates: ['biolink:affects'],
          subject: 'n0',
          object: 'n1'
        }
      },
      nodes: {
        n0: {
          ids: ['NCBIGene:283635'],
          categories: ['biolink:Gene'],
          is_set: false,
          name: 'FAM177A1'
        },
        n1: {
          categories: [
            'biolink:Disease',
            'biolink:DiseaseOrPhenotypicFeature',
            'biolink:Drug',
            'biolink:Gene',
            'biolink:Protein'
          ],
          is_set: false
        }
      }
    }
  },
  submitter: 'ARAX Test Script',
  stream_progress: true,
  query_options: {
    kp_timeout: '30',
    prune_threshold: '50'
  }
};

async function testAraxQuery() {
  console.log('🧬 Testing ARAX Biomedical Query API');
  console.log('=' .repeat(50));
  console.log(`📝 Query: What does gene FAM177A1 (NCBIGene:283635) affect?`);
  console.log(`🔗 URL: ${ARAX_API_URL}`);
  console.log('');

  try {
    console.log('📤 Sending POST request...');
    const response = await fetch(ARAX_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
        'User-Agent': 'ARAX-Test-Script/1.0'
      },
      body: JSON.stringify(testQuery)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    console.log(`✅ Response received (${response.status})`);
    console.log(`📡 Content-Type: ${response.headers.get('content-type')}`);
    console.log('');

    // Handle streaming response
    if (response.headers.get('content-type')?.includes('text/event-stream')) {
      console.log('🌊 Processing streaming response...');
      console.log('-'.repeat(50));
      
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      
      if (!reader) {
        throw new Error('Unable to get response reader');
      }

      let buffer = '';
      let eventCount = 0;
      
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          console.log('🏁 Stream ended');
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            eventCount++;
            const data = line.slice(6); // Remove 'data: ' prefix
            
            try {
              const parsed = JSON.parse(data);
              console.log(`📦 Event ${eventCount}:`, JSON.stringify(parsed, null, 2));
            } catch (e) {
              console.log(`📦 Event ${eventCount} (raw):`, data);
            }
          } else if (line.trim()) {
            console.log(`📝 SSE Header:`, line);
          }
        }
      }
      
      console.log(`\n✨ Total events received: ${eventCount}`);
      
    } else {
      // Handle regular JSON response
      const data = await response.json();
      console.log('📦 Response data:');
      console.log(JSON.stringify(data, null, 2));
    }

  } catch (error) {
    console.error('❌ Error:', error);
    
    if (error instanceof Error) {
      console.error('📝 Error details:', error.message);
    }
  }
}

// Alternative function to send query without streaming
async function testAraxQuerySimple() {
  console.log('\n🔄 Testing simple (non-streaming) query...');
  
  const simpleQuery = { ...testQuery, stream_progress: false };
  
  try {
    const response = await fetch(ARAX_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(simpleQuery)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('📦 Simple response:');
    console.log(JSON.stringify(data, null, 2));
    
  } catch (error) {
    console.error('❌ Simple query error:', error);
  }
}

// Run the test
if (process.argv[1]?.endsWith('test-arax-query.ts') || process.argv[1]?.endsWith('test-arax-query.js')) {
  testAraxQuery()
    .then(() => testAraxQuerySimple())
    .then(() => {
      console.log('\n🎉 Test completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Fatal error:', error);
      process.exit(1);
    });
}

export { testAraxQuery, testAraxQuerySimple, testQuery }; 