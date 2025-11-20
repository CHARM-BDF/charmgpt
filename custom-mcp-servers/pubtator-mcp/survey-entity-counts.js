#!/usr/bin/env node

/**
 * Survey script to get publication counts for all entities from FAM177A1 test results
 * Uses PubTator search API to get counts for each entity
 */

import fs from 'fs';

const baseUrl = process.env.PUBTATOR_BASE_URL || 'https://www.ncbi.nlm.nih.gov/research/pubtator3-api';
const API_KEY = process.env.PUBTATOR_API_KEY;
const USER_EMAIL = process.env.PUBTATOR_USER_EMAIL;

// Helper function to make PubTator API requests
async function makePubTatorRequest(endpoint, method = 'GET', params = {}) {
  const url = new URL(`${baseUrl}${endpoint}`);
  
  // Add query parameters for GET requests
  if (method === 'GET' && params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        if (Array.isArray(value)) {
          url.searchParams.set(key, value.join(','));
        } else {
          url.searchParams.set(key, String(value));
        }
      }
    });
  }
  
  const headers = {
    'Accept': 'application/json',
    'User-Agent': 'pubtator-survey/1.0.0',
  };
  
  if (API_KEY) {
    headers['X-API-Key'] = API_KEY;
  }
  
  if (USER_EMAIL) {
    headers['X-User-Email'] = USER_EMAIL;
  }
  
  const response = await fetch(url.toString(), { method, headers });
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  
  return await response.json();
}

// Get publication count for an entity using PubTator search
async function getEntityPublicationCount(entityName) {
  try {
    const endpoint = '/search/';
    const params = {
      text: entityName,
      page_size: 1,  // We only need the count, not the results
      page: 1
    };
    
    const result = await makePubTatorRequest(endpoint, 'GET', params);
    return {
      entityName,
      count: result.count || 0,
      status: 'success'
    };
  } catch (error) {
    console.error(`   ⚠️  Error fetching count for "${entityName}": ${error.message}`);
    return {
      entityName,
      count: 0,
      status: 'error',
      error: error.message
    };
  }
}

// Extract all unique entities from test results
function extractAllEntities(results) {
  const entityMap = new Map(); // name -> { name, type, id }
  
  // Extract from allNodes if available (preferred - has all 512 nodes)
  if (results.nodes && results.nodes.allNodes) {
    results.nodes.allNodes.forEach(node => {
      if (node.name && !entityMap.has(node.name)) {
        entityMap.set(node.name, {
          name: node.name,
          type: node.type || 'unknown',
          id: node.id
        });
      }
    });
  } else if (results.nodes && results.nodes.topNodes) {
    // Fallback to topNodes if allNodes not available
    results.nodes.topNodes.forEach(node => {
      if (node.name && !entityMap.has(node.name)) {
        entityMap.set(node.name, {
          name: node.name,
          type: node.type || 'unknown',
          id: node.id
        });
      }
    });
  }
  
  // Also extract from edges to catch any entities not in nodes
  if (results.edges && results.edges.sample) {
    results.edges.sample.forEach(edge => {
      if (edge.sourceName && !entityMap.has(edge.sourceName)) {
        entityMap.set(edge.sourceName, {
          name: edge.sourceName,
          type: 'unknown', // Type not always available in edges
          id: edge.source
        });
      }
      if (edge.targetName && !entityMap.has(edge.targetName)) {
        entityMap.set(edge.targetName, {
          name: edge.targetName,
          type: 'unknown',
          id: edge.target
        });
      }
    });
  }
  
  return Array.from(entityMap.values());
}

// Main survey function
async function surveyEntityCounts() {
  console.log('📊 ============================================');
  console.log('📊 Entity Publication Count Survey');
  console.log('📊 ============================================\n');
  
  // Read test results
  const resultsFile = 'test-fam177a1-results.json';
  console.log(`📖 Reading entities from: ${resultsFile}...`);
  
  if (!fs.existsSync(resultsFile)) {
    console.error(`❌ Error: ${resultsFile} not found. Please run test-fam177a1-comprehensive.js first.`);
    process.exit(1);
  }
  
  const results = JSON.parse(fs.readFileSync(resultsFile, 'utf-8'));
  
  // Extract all unique entities
  const entities = extractAllEntities(results);
  console.log(`✅ Extracted ${entities.length} unique entities\n`);
  
  // Show entity breakdown by type
  const byType = {};
  entities.forEach(e => {
    const type = e.type || 'unknown';
    byType[type] = (byType[type] || 0) + 1;
  });
  
  console.log('📋 Entity breakdown by type:');
  Object.entries(byType)
    .sort(([,a], [,b]) => b - a)
    .forEach(([type, count]) => {
      console.log(`   ${type}: ${count} entities`);
    });
  console.log('');
  
  // Get counts for each entity
  console.log('🔍 Querying PubTator for publication counts...\n');
  const entityCounts = [];
  let processed = 0;
  
  for (const entity of entities) {
    processed++;
    process.stdout.write(`   [${processed}/${entities.length}] Querying "${entity.name}"... `);
    
    const result = await getEntityPublicationCount(entity.name);
    result.type = entity.type;
    result.id = entity.id;
    entityCounts.push(result);
    
    if (result.status === 'success') {
      console.log(`✅ ${result.count} publications`);
    } else {
      console.log(`❌ Error: ${result.error}`);
    }
    
    // Rate limiting - wait 100ms between requests
    if (processed < entities.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  // Sort by count (descending)
  entityCounts.sort((a, b) => b.count - a.count);
  
  // Generate distribution report
  console.log('\n\n📊 ============================================');
  console.log('📊 PUBLICATION COUNT DISTRIBUTION');
  console.log('📊 ============================================\n');
  
  // Count distribution
  const distribution = {
    '0': 0,
    '1-10': 0,
    '11-100': 0,
    '101-1000': 0,
    '1001-10000': 0,
    '10001-100000': 0,
    '100000+': 0
  };
  
  entityCounts.forEach(e => {
    const count = e.count;
    if (count === 0) distribution['0']++;
    else if (count <= 10) distribution['1-10']++;
    else if (count <= 100) distribution['11-100']++;
    else if (count <= 1000) distribution['101-1000']++;
    else if (count <= 10000) distribution['1001-10000']++;
    else if (count <= 100000) distribution['10001-100000']++;
    else distribution['100000+']++;
  });
  
  console.log('📈 Count Distribution:');
  Object.entries(distribution)
    .sort((a, b) => {
      // Sort by range midpoint
      const getMidpoint = (range) => {
        if (range === '0') return 0;
        if (range === '100000+') return 200000;
        const [min, max] = range.split('-').map(Number);
        return (min + max) / 2;
      };
      return getMidpoint(a[0]) - getMidpoint(b[0]);
    })
    .forEach(([range, count]) => {
      const percentage = ((count / entities.length) * 100).toFixed(1);
      console.log(`   ${range.padEnd(12)}: ${count.toString().padStart(4)} entities (${percentage}%)`);
    });
  
  // Show top entities by count
  console.log('\n\n🏆 Top 20 Entities by Publication Count:');
  entityCounts.slice(0, 20).forEach((entity, idx) => {
    console.log(`   ${(idx + 1).toString().padStart(2)}. ${entity.entityName.padEnd(40)} (${entity.type.padEnd(10)}) - ${entity.count.toLocaleString()} publications`);
  });
  
  // Show entities with 0 or very low counts
  const lowCountEntities = entityCounts.filter(e => e.count <= 5 && e.count > 0);
  if (lowCountEntities.length > 0) {
    console.log('\n\n🔍 Entities with Low Counts (1-5 publications):');
    lowCountEntities.forEach((entity, idx) => {
      console.log(`   ${(idx + 1).toString().padStart(3)}. ${entity.entityName.padEnd(40)} (${entity.type.padEnd(10)}) - ${entity.count} publications`);
    });
  }
  
  const zeroCountEntities = entityCounts.filter(e => e.count === 0);
  if (zeroCountEntities.length > 0) {
    console.log(`\n\n⚠️  Entities with 0 Publications (${zeroCountEntities.length}):`);
    zeroCountEntities.slice(0, 20).forEach((entity, idx) => {
      console.log(`   ${(idx + 1).toString().padStart(3)}. ${entity.entityName} (${entity.type})`);
    });
    if (zeroCountEntities.length > 20) {
      console.log(`   ... and ${zeroCountEntities.length - 20} more`);
    }
  }
  
  // Statistics by type
  console.log('\n\n📊 Statistics by Entity Type:');
  const byTypeStats = {};
  entityCounts.forEach(e => {
    const type = e.type || 'unknown';
    if (!byTypeStats[type]) {
      byTypeStats[type] = {
        count: 0,
        totalPublications: 0,
        min: Infinity,
        max: 0,
        avg: 0
      };
    }
    byTypeStats[type].count++;
    byTypeStats[type].totalPublications += e.count;
    byTypeStats[type].min = Math.min(byTypeStats[type].min, e.count);
    byTypeStats[type].max = Math.max(byTypeStats[type].max, e.count);
  });
  
  Object.entries(byTypeStats).forEach(([type, stats]) => {
    stats.avg = Math.round(stats.totalPublications / stats.count);
    console.log(`\n   ${type}:`);
    console.log(`      Entities: ${stats.count}`);
    console.log(`      Total Publications: ${stats.totalPublications.toLocaleString()}`);
    console.log(`      Average: ${stats.avg.toLocaleString()}`);
    console.log(`      Range: ${stats.min === Infinity ? 0 : stats.min} - ${stats.max.toLocaleString()}`);
  });
  
  // Save results to JSON
  const outputFile = 'entity-count-survey.json';
  const output = {
    timestamp: new Date().toISOString(),
    totalEntities: entities.length,
    distribution,
    entityCounts,
    statistics: {
      byType: byTypeStats,
      overall: {
        totalPublications: entityCounts.reduce((sum, e) => sum + e.count, 0),
        averageCount: Math.round(entityCounts.reduce((sum, e) => sum + e.count, 0) / entityCounts.length),
        maxCount: entityCounts[0]?.count || 0,
        minCount: entityCounts[entityCounts.length - 1]?.count || 0
      }
    }
  };
  
  fs.writeFileSync(outputFile, JSON.stringify(output, null, 2));
  console.log(`\n\n💾 Results saved to: ${outputFile}`);
  
  console.log('\n\n✅ ============================================');
  console.log('✅ Survey completed successfully!');
  console.log('✅ ============================================\n');
}

// Run the survey
surveyEntityCounts().catch(error => {
  console.error('\n\n❌ ============================================');
  console.error('❌ Survey failed with error:');
  console.error('❌ ============================================');
  console.error(error);
  process.exit(1);
});

