#!/usr/bin/env node

// Test script to check relationship counts for specific genes
const genes = [
  'JAK1',  // Test with JAK1 first since we know it works
  'BRCA1',
  'TP53',
  'EGFR',
  'MYC',
  'AKT1'
];

const baseUrl = 'https://www.ncbi.nlm.nih.gov/research/pubtator3-api';

async function findGeneId(geneName) {
  try {
    const url = `${baseUrl}/entity/autocomplete/?query=${encodeURIComponent(geneName)}&concept=gene`;
    const response = await fetch(url);
    
    if (!response.ok) {
      return null;
    }
    
    const data = await response.json();
    
    if (Array.isArray(data) && data.length > 0) {
      // Find exact match or best match
      const exactMatch = data.find(entity => 
        entity.name.toUpperCase() === geneName.toUpperCase()
      );
      
      if (exactMatch) {
        return exactMatch._id;
      }
      
      // Return first match if no exact match
      return data[0]._id;
    }
    
    return null;
  } catch (error) {
    return null;
  }
}

async function getGeneRelationships(geneName) {
  try {
    console.log(`\n🔍 Testing ${geneName}...`);
    
    // First, find the gene ID
    const geneId = await findGeneId(geneName);
    
    if (!geneId) {
      console.log(`❌ Could not find gene ID for ${geneName}`);
      return null;
    }
    
    console.log(`✅ Found gene ID: ${geneId}`);
    
    const url = `${baseUrl}/relations?e1=${geneId}`;
    console.log(`URL: ${url}`);
    
    const response = await fetch(url);
    
    if (!response.ok) {
      console.log(`❌ HTTP ${response.status}: ${response.statusText}`);
      return null;
    }
    
    const data = await response.json();
    
    // Count total relationships
    let totalRelationships = 0;
    
    if (Array.isArray(data)) {
      totalRelationships = data.length;
    }
    
    console.log(`✅ Found ${totalRelationships} total relationships`);
    
    // Show breakdown by relation type
    if (Array.isArray(data)) {
      const relationTypeCounts = {};
      data.forEach(relation => {
        const type = relation.type || 'unknown';
        relationTypeCounts[type] = (relationTypeCounts[type] || 0) + 1;
      });
      
      console.log('📊 Breakdown by relation type:');
      Object.entries(relationTypeCounts)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10) // Show top 10
        .forEach(([type, count]) => {
          console.log(`   ${type}: ${count}`);
        });
    }
    
    // Analyze publication counts for edge width scaling
    if (Array.isArray(data)) {
      const publicationCounts = data.map(relation => relation.publications || 0);
      const buckets = {
        '1': 0,
        '2-5': 0,
        '6-10': 0,
        '11-50': 0,
        '51-100': 0,
        '101-500': 0,
        '501-1000': 0,
        '>1000': 0
      };
      
      publicationCounts.forEach(count => {
        if (count === 1) buckets['1']++;
        else if (count >= 2 && count <= 5) buckets['2-5']++;
        else if (count >= 6 && count <= 10) buckets['6-10']++;
        else if (count >= 11 && count <= 50) buckets['11-50']++;
        else if (count >= 51 && count <= 100) buckets['51-100']++;
        else if (count >= 101 && count <= 500) buckets['101-500']++;
        else if (count >= 501 && count <= 1000) buckets['501-1000']++;
        else if (count > 1000) buckets['>1000']++;
      });
      
      console.log('📈 Edge width distribution (by publication count):');
      Object.entries(buckets).forEach(([range, count]) => {
        if (count > 0) {
          console.log(`   ${range} publications: ${count} edges`);
        }
      });
      
      // Show some statistics
      const maxPubs = Math.max(...publicationCounts);
      const minPubs = Math.min(...publicationCounts.filter(c => c > 0));
      const avgPubs = (publicationCounts.reduce((a, b) => a + b, 0) / publicationCounts.length).toFixed(1);
      
      console.log(`📊 Publication count stats: min=${minPubs}, max=${maxPubs}, avg=${avgPubs}`);
    }
    
    return totalRelationships;
    
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
    return null;
  }
}

async function main() {
  console.log('🧬 Testing PubTator relationship counts for genes...\n');
  
  const results = [];
  
  for (const gene of genes) {
    const count = await getGeneRelationships(gene);
    if (count !== null) {
      results.push({ gene, count });
    }
    
    // Add a small delay to be respectful to the API
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('\n📈 SUMMARY RESULTS:');
  console.log('==================');
  
  // Sort by count
  results.sort((a, b) => b.count - a.count);
  
  for (const result of results) {
    console.log(`${result.gene.padEnd(10)}: ${result.count.toString().padStart(4)} relationships`);
  }
  
  // Count ranges
  const ranges = {
    '0-5': 0,
    '6-10': 0,
    '11-50': 0,
    '51-100': 0,
    '>100': 0
  };
  
  for (const result of results) {
    const count = result.count;
    if (count <= 5) ranges['0-5']++;
    else if (count <= 10) ranges['6-10']++;
    else if (count <= 50) ranges['11-50']++;
    else if (count <= 100) ranges['51-100']++;
    else ranges['>100']++;
  }
  
  console.log('\n📊 DISTRIBUTION BY RANGE:');
  console.log('========================');
  for (const [range, count] of Object.entries(ranges)) {
    console.log(`${range.padEnd(8)}: ${count} genes`);
  }
  
  console.log('\n✅ Analysis complete!');
}

main().catch(console.error);
