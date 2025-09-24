#!/usr/bin/env node

/**
 * Multi-gene ARS query: given a set of input gene CURIEs, return only related genes.
 *
 * Workflow:
 * 1) Submit TRAPI query to ARS with n0.ids = provided CURIEs, n1.categories = ["biolink:Gene"]
 * 2) Poll for completion
 * 3) Fetch detailed results and print a deduplicated list of related gene CURIEs (excluding inputs)
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// ARS API endpoints
const ARS_BASE_URL = 'https://ars-prod.transltr.io';
const SUBMIT_ENDPOINT = '/ars/api/submit';
const MESSAGES_ENDPOINT = '/ars/api/messages';

// Input genes (CURIEs) provided by user
const INPUT_GENES = [
  'NCBIGene:9244',  // CRLF1
  'NCBIGene:28514', // DLL1
  'NCBIGene:2022',  // ENG
  'NCBIGene:2027',  // ENO3
  'NCBIGene:283635',// FAM177A1
  'NCBIGene:2321',  // FLT1
  'NCBIGene:6782',  // HSPA13
  'NCBIGene:3396',  // MRPL58
  'NCBIGene:51172', // NAGPA
  'NCBIGene:59274', // TLNRD1
  'NCBIGene:7531'   // YWHAE
];

// Build TRAPI message: n0 = input gene ids, n1 = genes only (to "just return the genes")
function buildTrapiMessage(inputCurieList) {
  return {
    message: {
      query_graph: {
        edges: {
          e0: {
            subject: 'n0',
            object: 'n1'
          }
        },
        nodes: {
          n0: {
            ids: inputCurieList,
            categories: ['biolink:Gene'],
            is_set: false
          },
          n1: {
            is_set: false,
            categories: ['biolink:Gene']
          }
        }
      }
    }
  };
}

function makeRequest(url, data = null, method = 'GET') {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      port: 443,
      path: urlObj.pathname + urlObj.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    };

    let postData = null;
    if (data) {
      postData = JSON.stringify(data);
      options.headers['Content-Length'] = Buffer.byteLength(postData);
    }

    const req = https.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => { responseData += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(responseData);
          resolve({ statusCode: res.statusCode, headers: res.headers, data: parsed });
        } catch (_) {
          resolve({ statusCode: res.statusCode, headers: res.headers, data: responseData });
        }
      });
    });

    req.on('error', (err) => reject(err));
    if (postData) req.write(postData);
    req.end();
  });
}

async function submitQuery(trapiMessage) {
  console.log('🧬 Submitting multi-gene ARS query (genes → genes)');
  const response = await makeRequest(ARS_BASE_URL + SUBMIT_ENDPOINT, trapiMessage, 'POST');
  if (response.statusCode === 201 || response.statusCode === 202) {
    const pk = response.data.pk;
    console.log(`✅ Submitted. PK: ${pk} | Status: ${response.data.fields?.status}`);
    return pk;
  }
  console.error('❌ Submit failed:', response.statusCode, response.data);
  return null;
}

async function checkQueryStatus(pk, maxAttempts = 12, delayMs = 30000) {
  console.log(`🔍 Polling status for PK ${pk} (every ${delayMs/1000}s, max ${maxAttempts})`);
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const resp = await makeRequest(`${ARS_BASE_URL}${MESSAGES_ENDPOINT}/${pk}?trace=y`);
    if (resp.statusCode === 200) {
      const status = resp.data.status;
      console.log(`  Attempt ${attempt}: ${status}`);
      if (status === 'Done' || status === 'Error') return resp.data;
    } else {
      console.warn(`  Attempt ${attempt}: HTTP ${resp.statusCode}`);
    }
    if (attempt < maxAttempts) await new Promise(r => setTimeout(r, delayMs));
  }
  console.warn('⏰ Status polling timed out');
  return null;
}

async function getDetailedResults(pk) {
  const resp = await makeRequest(`${ARS_BASE_URL}${MESSAGES_ENDPOINT}/${pk}`);
  if (resp.statusCode !== 200) return null;

  // Persist raw results for offline inspection
  const file = path.join(__dirname, `ars_results_multi_genes_${pk}.json`);
  try {
    fs.writeFileSync(file, JSON.stringify(resp.data, null, 2));
    console.log(`💾 Saved results: ${file}`);
  } catch (_) {}
  return resp.data;
}

function extractRelatedGenes(data, inputCurieList) {
  const inputSet = new Set(inputCurieList);
  const related = new Map(); // curie -> name (if available)

  const kg = data?.data?.message?.knowledge_graph;
  if (!kg || !kg.nodes) return related;

  for (const [nodeId, node] of Object.entries(kg.nodes)) {
    const categories = node.categories || [];
    const isGene = categories.includes('biolink:Gene');
    if (!isGene) continue;

    if (!inputSet.has(nodeId)) {
      const name = node.name || node.attributes?.find?.(a => a.attribute_type_id === 'biolink:synonym')?.value || nodeId;
      related.set(nodeId, name);
    }
  }

  return related;
}

async function run() {
  const trapi = buildTrapiMessage(INPUT_GENES);
  const pk = await submitQuery(trapi);
  if (!pk) return process.exit(1);

  const status = await checkQueryStatus(pk);
  if (!status) return process.exit(1);
  if (status.status === 'Error') {
    console.error('❌ ARS returned error. See saved results if available.');
    return process.exit(1);
  }

  const detailed = await getDetailedResults(pk);
  if (!detailed) return process.exit(1);

  const related = extractRelatedGenes(detailed, INPUT_GENES);
  const list = Array.from(related.entries()).map(([curie, name]) => ({ curie, name }));

  console.log('\n🧾 Related genes (unique, excluding inputs):');
  list.forEach(({ curie, name }) => console.log(`  - ${curie}\t${name}`));

  // Also output as JSON (to stdout) for easy piping
  console.log('\nJSON_RESULT_START');
  console.log(JSON.stringify(list, null, 2));
  console.log('JSON_RESULT_END');
}

if (require.main === module) {
  run().catch((err) => {
    console.error('Unexpected error:', err);
    process.exit(1);
  });
}

module.exports = { run };







