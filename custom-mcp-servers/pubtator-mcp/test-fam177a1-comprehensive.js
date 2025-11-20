#!/usr/bin/env node

/**
 * Comprehensive test for FAM177A1 term:
 * 1. Gets papers for the term
 * 2. Gets edges/relationships for the term
 * 3. Gets entity distribution showing count for each entity based on publication co-occurrence
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
    'User-Agent': 'pubtator-mcp-test/1.0.0',
  };
  
  if (API_KEY) {
    headers['X-API-Key'] = API_KEY;
  }
  
  if (USER_EMAIL) {
    headers['X-User-Email'] = USER_EMAIL;
  }
  
  console.log(`\n📡 Request: ${method} ${url.toString()}`);
  
  const response = await fetch(url.toString(), { method, headers });
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  
  return await response.json();
}

// 1. Search for papers containing FAM177A1
async function getPapersForTerm(searchTerm, maxResults = 100) {
  console.log(`\n📄 STEP 1: Searching for top ${maxResults} most recent papers containing "${searchTerm}"...`);
  
  const endpoint = '/search/';
  const params = {
    text: searchTerm,
    page_size: Math.min(maxResults, 100), // Max page size for PubTator API is 100
    page: 1
  };
  
  console.log(`   Fetching papers...`);
  const results = await makePubTatorRequest(endpoint, 'GET', params);
  
  // Debug: Check what we got back
  console.log(`   API Response - count: ${results.count}, results length: ${results.results?.length || 0}`);
  
  let papers = results.results || [];
  const totalCount = results.count || papers.length;
  const estimatedPages = Math.ceil(Math.min(maxResults, totalCount) / 10);
  console.log(`   📄 Working on PAGE 1 of ~${estimatedPages} (requesting up to ${maxResults} papers, ${totalCount} available)...`);
  console.log(`   ✅ PAGE 1 complete: Got ${papers.length} papers`);
  
  // If we got fewer papers than requested and there are more available, try to fetch more
  if (papers.length < maxResults && totalCount > papers.length) {
    console.log(`   ⚠️  Only got ${papers.length} papers, but ${totalCount} are available. Trying to fetch more...`);
    
    // Try fetching additional pages
    // Note: The API might have a default limit of 10 results per page
    // We'll try fetching multiple pages to get up to maxResults
    const neededPages = Math.ceil(Math.min(maxResults, totalCount) / 10); // Assuming 10 per page default
    console.log(`   Will try to fetch up to ${neededPages} pages...`);
    
    // Track PMIDs we've already seen to detect API pagination issues
    const seenPMIDs = new Set(papers.map(p => p.pmid?.toString() || ''));
    
    for (let page = 2; page <= neededPages && papers.length < maxResults; page++) {
      console.log(`\n   📄 Working on PAGE ${page} of ${neededPages} (${papers.length}/${maxResults} papers so far, ${seenPMIDs.size} unique)...`);
      
      const pageParams = {
        text: searchTerm,
        page_size: 100, // Try requesting 100, but API might limit it
        page: page
      };
      
      console.log(`   Fetching page ${page}...`);
      try {
        const pageResults = await makePubTatorRequest(endpoint, 'GET', pageParams);
        const pagePapers = pageResults.results || [];
        
        console.log(`   Page ${page} response: count=${pageResults.count}, results=${pagePapers.length}`);
        
        if (pagePapers.length === 0) {
          console.log(`   No more papers on page ${page}, stopping pagination`);
          break;
        }
        
        // Debug: Show first 3 PMIDs from this page to check for duplicates
        const pagePMIDs = pagePapers.slice(0, 3).map(p => p.pmid).join(', ');
        console.log(`   Page ${page} first 3 PMIDs: ${pagePMIDs}`);
        
        // Check if this page contains only duplicates (API pagination issue)
        const newPMIDs = pagePapers.map(p => p.pmid?.toString() || '').filter(pmid => !seenPMIDs.has(pmid));
        const duplicateCount = pagePapers.length - newPMIDs.length;
        
        if (duplicateCount === pagePapers.length) {
          console.log(`   ⚠️  WARNING: Page ${page} contains only duplicates! API pagination may not be working.`);
          console.log(`   ⚠️  Stopping pagination - API appears to be returning the same results on every page.`);
          console.log(`   ℹ️  This is likely an API limitation. You may need an API key for proper pagination.`);
          break;
        }
        
        // Add new PMIDs to the set and only add new papers to avoid duplicates
        const newPapers = pagePapers.filter(p => {
          const pmid = p.pmid?.toString() || '';
          if (!pmid || seenPMIDs.has(pmid)) {
            return false;
          }
          seenPMIDs.add(pmid);
          return true;
        });
        
        papers = papers.concat(newPapers);
        console.log(`   ✅ PAGE ${page} complete: Got ${pagePapers.length} papers (${newPapers.length} new, ${duplicateCount} duplicates, total: ${papers.length}/${maxResults}, unique: ${seenPMIDs.size})`);
        
        // Rate limiting - only if we got new papers and might continue
        if (newPapers.length > 0 && papers.length < maxResults) {
          console.log(`   ⏳ Waiting 1 second before next page...`);
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } catch (error) {
        console.log(`   Error fetching page ${page}: ${error.message}`);
        break;
      }
    }
  }
  
  // Final deduplication (should already be done, but ensure no duplicates)
  console.log(`   Before final deduplication: ${papers.length} papers`);
  const finalSeenPMIDs = new Set();
  papers = papers.filter(paper => {
    const pmid = paper.pmid?.toString() || '';
    if (!pmid || finalSeenPMIDs.has(pmid)) {
      return false;
    }
    finalSeenPMIDs.add(pmid);
    return true;
  });
  console.log(`   After final deduplication: ${papers.length} unique papers`);
  
  // Sort by date (most recent first) - extract year from date field
  papers = papers.sort((a, b) => {
    const dateA = a.date || a.meta_date_publication || '';
    const dateB = b.date || b.meta_date_publication || '';
    
    // Extract year from date string (format can vary)
    const yearA = parseInt(dateA.match(/\d{4}/)?.[0] || '0');
    const yearB = parseInt(dateB.match(/\d{4}/)?.[0] || '0');
    
    // Most recent first (descending order)
    return yearB - yearA;
  });
  
  // Limit to maxResults
  papers = papers.slice(0, maxResults);
  
  const pmids = papers.map(paper => paper.pmid?.toString() || '').filter(pmid => pmid !== '');
  
  console.log(`✅ Found ${totalCount} total papers`);
  console.log(`✅ Retrieved top ${papers.length} most recent papers`);
  console.log(`✅ Extracted ${pmids.length} PMIDs`);
  
  return {
    papers,
    pmids,
    totalCount
  };
}

// 2. Get edges/relationships for FAM177A1
async function getEdgesForTerm(searchTerm) {
  console.log(`\n🔗 STEP 2: Getting edges/relationships for "${searchTerm}"...`);
  
  // First, find the entity ID using autocomplete
  console.log(`   Finding entity ID for "${searchTerm}"...`);
  const autocompleteEndpoint = `/entity/autocomplete/?query=${encodeURIComponent(searchTerm)}&concept=gene`;
  const entities = await makePubTatorRequest(autocompleteEndpoint);
  
  if (!Array.isArray(entities) || entities.length === 0) {
    console.log(`   ⚠️  No entities found for "${searchTerm}"`);
    return { entity: null, edges: [] };
  }
  
  // Find exact match or best match
  const exactMatch = entities.find(e => 
    e.name.toUpperCase() === searchTerm.toUpperCase()
  ) || entities[0];
  
  console.log(`   ✅ Found entity: ${exactMatch.name} (ID: ${exactMatch._id})`);
  
  // Get relationships for this entity
  console.log(`   Fetching relationships...`);
  const relationsEndpoint = `/relations?e1=${encodeURIComponent(exactMatch._id)}`;
  const relations = await makePubTatorRequest(relationsEndpoint);
  
  const edges = Array.isArray(relations) ? relations : [];
  
  console.log(`   ✅ Found ${edges.length} relationships`);
  
  // Show breakdown by relationship type
  if (edges.length > 0) {
    const typeCounts = {};
    edges.forEach(edge => {
      const type = edge.type || 'unknown';
      typeCounts[type] = (typeCounts[type] || 0) + 1;
    });
    
    console.log(`   📊 Relationship types:`);
    Object.entries(typeCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .forEach(([type, count]) => {
        console.log(`      ${type}: ${count}`);
      });
  }
  
  return {
    entity: exactMatch,
    edges
  };
}

// 3. Get nodes and edges from papers with publication tracking
async function getEntityDistribution(pmids) {
  console.log(`\n📊 STEP 3: Getting nodes and edges from ${pmids.length} papers...`);
  
  if (pmids.length === 0) {
    console.log(`   ⚠️  No PMIDs to process`);
    return { nodes: [], edges: [] };
  }
  
  // Annotate papers in batches (max 100 per request)
  const batchSize = 100;
  const nodeMap = new Map(); // entityId -> { id, name, type, publications: Set }
  const edgeMap = new Map(); // edgeKey -> { source, target, type, sourceName, targetName, publications: Set }
  
  for (let i = 0; i < pmids.length; i += batchSize) {
    const batch = pmids.slice(i, i + batchSize);
    console.log(`   Processing batch ${Math.floor(i / batchSize) + 1} (${batch.length} PMIDs)...`);
    
    const endpoint = '/publications/export/biocjson';
    const params = {
      pmids: batch.join(',')
    };
    
    const biocData = await makePubTatorRequest(endpoint, 'GET', params);
    
    // Parse BioC JSON to extract entities (nodes) and relations (edges)
    if (biocData.PubTator3 && Array.isArray(biocData.PubTator3)) {
      for (const doc of biocData.PubTator3) {
        const pmid = doc.pmid || doc.id || 'unknown';
        const allAnnotations = doc.passages?.flatMap((p) => p.annotations || []) || [];
        
        // Extract entities (nodes) from all passages
        for (const annotation of allAnnotations) {
          // Use accession if available, otherwise identifier, otherwise text
          const entityId = annotation.infons?.accession || 
                          annotation.infons?.identifier || 
                          annotation.text;
          const entityName = annotation.text || annotation.infons?.name || entityId;
          const entityType = annotation.infons?.type || 'unknown';
          const database = annotation.infons?.database || null;
          
          // Track which publications contain this entity
          if (!nodeMap.has(entityId)) {
            nodeMap.set(entityId, {
              id: entityId,
              name: entityName,
              type: entityType,
              database: database,
              publications: new Set()
            });
          }
          
          nodeMap.get(entityId).publications.add(pmid);
        }
        
        // Extract relations (edges) from document level only
        if (doc.relations && Array.isArray(doc.relations)) {
          for (const relation of doc.relations) {
            const relationType = relation.infons?.type || '';
            const role1 = relation.infons?.role1;
            const role2 = relation.infons?.role2;
            
            // Use accession for entity IDs (this is the PubTator format)
            const sourceId = role1?.accession || role1?.identifier || '';
            const targetId = role2?.accession || role2?.identifier || '';
            const sourceName = role1?.name || sourceId;
            const targetName = role2?.name || targetId;
            
            if (relationType && sourceId && targetId) {
              // Create a unique key for this edge (handles bidirectional relationships)
              const edgeKey = `${sourceId}|||${targetId}|||${relationType}`;
              const reverseEdgeKey = `${targetId}|||${sourceId}|||${relationType}`;
              
              // Use the canonical key (alphabetically sorted to handle bidirectionality)
              const canonicalKey = sourceId < targetId ? edgeKey : reverseEdgeKey;
              
              if (!edgeMap.has(canonicalKey)) {
                edgeMap.set(canonicalKey, {
                  source: sourceId,
                  target: targetId,
                  type: relationType,
                  sourceName: sourceName,
                  targetName: targetName,
                  publications: new Set()
                });
              }
              
              edgeMap.get(canonicalKey).publications.add(pmid);
            }
          }
        }
      }
    }
    
    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Convert maps to arrays with publications as arrays
  const nodes = Array.from(nodeMap.values()).map(node => ({
    id: node.id,
    name: node.name,
    type: node.type,
    database: node.database,
    publications: Array.from(node.publications)
  }));
  
  const edges = Array.from(edgeMap.values()).map(edge => ({
    source: edge.source,
    target: edge.target,
    type: edge.type,
    sourceName: edge.sourceName,
    targetName: edge.targetName,
    publications: Array.from(edge.publications)
  }));
  
  console.log(`   ✅ Found ${nodes.length} unique nodes`);
  console.log(`   ✅ Found ${edges.length} unique edges`);
  
  return { nodes, edges };
}

// Analyze co-occurrence patterns between nodes
function analyzeCoOccurrence(nodes) {
  console.log(`\n🔍 Analyzing co-occurrence patterns for ${nodes.length} nodes...`);
  
  const coOccurrences = [];
  
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const node1 = nodes[i];
      const node2 = nodes[j];
      
      // Find intersection of publications using Set for efficiency
      const set1 = new Set(node1.publications);
      const shared = node2.publications.filter(pmid => set1.has(pmid));
      
      // Only include if they co-occur in 2+ publications
      if (shared.length >= 2) {
        coOccurrences.push({
          node1: { id: node1.id, name: node1.name, type: node1.type },
          node2: { id: node2.id, name: node2.name, type: node2.type },
          coOccurrenceCount: shared.length,
          publications: shared
        });
      }
    }
  }
  
  // Sort by co-occurrence count (descending)
  const sorted = coOccurrences.sort((a, b) => b.coOccurrenceCount - a.coOccurrenceCount);
  
  console.log(`   ✅ Found ${sorted.length} co-occurring pairs (2+ shared publications)`);
  
  return sorted;
}

// Main test function
async function testFAM177A1() {
  const searchTerm = 'FAM177A1';
  
  console.log('🧬 ============================================');
  console.log(`🧬 Comprehensive Test for: ${searchTerm}`);
  console.log('🧬 ============================================\n');
  
  try {
    // 1. Get top 100 most recent papers
    const { papers, pmids, totalCount } = await getPapersForTerm(searchTerm, 100);
    
    // 2. Get nodes and edges from papers (extracted from BioC JSON)
    const { nodes, edges } = await getEntityDistribution(pmids);
    
    // 3. Analyze co-occurrence patterns
    const coOccurrences = analyzeCoOccurrence(nodes);
    
    // Generate comprehensive report
    console.log('\n\n📋 ============================================');
    console.log('📋 COMPREHENSIVE TEST RESULTS');
    console.log('📋 ============================================\n');
    
    // Papers summary
    console.log('📄 PAPERS SUMMARY:');
    console.log(`   Total papers found: ${totalCount}`);
    console.log(`   Papers processed: ${papers.length}`);
    console.log(`   PMIDs extracted: ${pmids.length}`);
    console.log('\n   Sample papers (first 5):');
    papers.slice(0, 5).forEach((paper, idx) => {
      console.log(`   ${idx + 1}. PMID: ${paper.pmid}`);
      console.log(`      Title: ${paper.title?.substring(0, 80)}...`);
      console.log(`      Journal: ${paper.journal || 'N/A'}`);
      console.log(`      Date: ${paper.date || paper.meta_date_publication || 'N/A'}`);
    });
    
    // Edges summary
    console.log('\n\n🔗 EDGES/RELATIONSHIPS SUMMARY:');
    console.log(`   Total relationships: ${edges.length}`);
    
    if (edges.length > 0) {
      // Group by relationship type
      const typeGroups = {};
      edges.forEach(edge => {
        const type = edge.type || 'unknown';
        if (!typeGroups[type]) {
          typeGroups[type] = [];
        }
        typeGroups[type].push(edge);
      });
      
      console.log('\n   Relationship types:');
      for (const [type, typeEdges] of Object.entries(typeGroups).sort(([,a], [,b]) => b.length - a.length)) {
        console.log(`      ${type}: ${typeEdges.length} relationships`);
        // Show top 3 by publication count
        const topEdges = typeEdges
          .sort((a, b) => b.publications.length - a.publications.length)
          .slice(0, 3);
        
        for (const edge of topEdges) {
          const targetName = edge.targetName || edge.target?.replace(/^@[A-Z]+_/, '').replace(/_/g, ' ') || edge.target;
          const pmidsStr = edge.publications.join(', ');
          console.log(`         → ${targetName} (${edge.publications.length} pubs) - PMIDs: ${pmidsStr}`);
        }
      }
    }
    
    // Entity distribution summary (from nodes)
    console.log('\n\n📊 ENTITY DISTRIBUTION SUMMARY:');
    console.log(`   Total unique entities: ${nodes.length}`);
    
    // Sort by publication count
    const sortedNodes = [...nodes].sort((a, b) => b.publications.length - a.publications.length);
    
    // Group by entity type
    const byType = {};
    sortedNodes.forEach(node => {
      const type = node.type || 'unknown';
      if (!byType[type]) {
        byType[type] = [];
      }
      byType[type].push(node);
    });
    
    console.log('\n   Distribution by entity type:');
    Object.entries(byType)
      .sort(([,a], [,b]) => b.length - a.length)
      .forEach(([type, entities]) => {
        console.log(`      ${type}: ${entities.length} entities`);
      });
    
    console.log('\n   Top 20 entities by publication count:');
    sortedNodes.slice(0, 20).forEach((node, idx) => {
      console.log(`      ${idx + 1}. ${node.name} (${node.type})`);
      console.log(`         Appears in ${node.publications.length} publication(s)`);
      console.log(`         ID: ${node.id}`);
    });
    
    // Publication count distribution
    const pubCountRanges = {
      '1': 0,
      '2-5': 0,
      '6-10': 0,
      '11-20': 0,
      '21-50': 0,
      '>50': 0
    };
    
    sortedNodes.forEach(node => {
      const count = node.publications.length;
      if (count === 1) pubCountRanges['1']++;
      else if (count >= 2 && count <= 5) pubCountRanges['2-5']++;
      else if (count >= 6 && count <= 10) pubCountRanges['6-10']++;
      else if (count >= 11 && count <= 20) pubCountRanges['11-20']++;
      else if (count >= 21 && count <= 50) pubCountRanges['21-50']++;
      else pubCountRanges['>50']++;
    });
    
    console.log('\n   Publication count distribution:');
    Object.entries(pubCountRanges).forEach(([range, count]) => {
      if (count > 0) {
        console.log(`      ${range} publication(s): ${count} entities`);
      }
    });
    
    // Co-occurrence analysis summary
    console.log('\n\n📊 CO-OCCURRENCE ANALYSIS:');
    console.log(`   Total co-occurring pairs (2+ shared pubs): ${coOccurrences.length}`);
    
    if (coOccurrences.length > 0) {
      // Calculate distribution by count
      const byCount = {
        '2': 0,
        '3-5': 0,
        '6-10': 0,
        '11-20': 0,
        '>20': 0
      };
      
      coOccurrences.forEach(pair => {
        const count = pair.coOccurrenceCount;
        if (count === 2) byCount['2']++;
        else if (count >= 3 && count <= 5) byCount['3-5']++;
        else if (count >= 6 && count <= 10) byCount['6-10']++;
        else if (count >= 11 && count <= 20) byCount['11-20']++;
        else byCount['>20']++;
      });
      
      console.log('\n   Distribution by co-occurrence count:');
      Object.entries(byCount).forEach(([range, count]) => {
        if (count > 0) {
          console.log(`      ${range} shared publication(s): ${count} pairs`);
        }
      });
      
      console.log('\n   Top 20 most frequent co-occurrences:');
      coOccurrences.slice(0, 20).forEach((pair, idx) => {
        const pmidsStr = pair.publications.length > 10 
          ? pair.publications.slice(0, 10).join(', ') + `, ... (${pair.publications.length} total)`
          : pair.publications.join(', ');
        console.log(`      ${idx + 1}. ${pair.node1.name} (${pair.node1.type}) ↔ ${pair.node2.name} (${pair.node2.type})`);
        console.log(`         Co-occurs in ${pair.coOccurrenceCount} publication(s)`);
        console.log(`         PMIDs: ${pmidsStr}`);
      });
    }
    
    // Collect unique database values from nodes
    const uniqueDatabases = new Set();
    nodes.forEach(node => {
      if (node.database) {
        uniqueDatabases.add(node.database);
      }
    });
    const databasesList = Array.from(uniqueDatabases).sort();
    
    // Database summary
    console.log('\n\n📚 DATABASE SUMMARY:');
    console.log(`   Total unique databases: ${databasesList.length}`);
    if (databasesList.length > 0) {
      console.log('\n   Databases found:');
      databasesList.forEach((db, idx) => {
        const nodeCount = nodes.filter(n => n.database === db).length;
        console.log(`      ${idx + 1}. ${db} (${nodeCount} nodes)`);
      });
    } else {
      console.log('   No database information found in nodes');
    }
    
    // Collect OMIM IDs and names
    const omimNodes = nodes.filter(n => n.database === 'omim')
      .map(n => ({ id: n.id, name: n.name }))
      .sort((a, b) => {
        // Sort by ID (extract numeric part if possible)
        const aNum = parseInt(a.id.replace(/\D/g, '')) || 0;
        const bNum = parseInt(b.id.replace(/\D/g, '')) || 0;
        return aNum - bNum;
      });
    
    // Collect MeSH IDs and names
    const meshNodes = nodes.filter(n => n.database === 'ncbi_mesh')
      .map(n => ({ id: n.id, name: n.name }))
      .sort((a, b) => {
        // Sort by ID (alphabetically, but handle MESH: prefix)
        const aId = a.id.replace(/^MESH:/i, '');
        const bId = b.id.replace(/^MESH:/i, '');
        return aId.localeCompare(bId);
      });
    
    // OMIM list
    console.log('\n\n🧬 OMIM IDs AND NAMES:');
    if (omimNodes.length > 0) {
      console.log(`   Total OMIM entries: ${omimNodes.length}`);
      console.log('\n   OMIM entries:');
      omimNodes.forEach((node, idx) => {
        console.log(`      ${idx + 1}. ${node.id} - ${node.name}`);
      });
    } else {
      console.log('   No OMIM entries found');
    }
    
    // MeSH list
    console.log('\n\n📖 MeSH IDs AND NAMES:');
    if (meshNodes.length > 0) {
      console.log(`   Total MeSH entries: ${meshNodes.length}`);
      console.log('\n   MeSH entries:');
      meshNodes.forEach((node, idx) => {
        console.log(`      ${idx + 1}. ${node.id} - ${node.name}`);
      });
    } else {
      console.log('   No MeSH entries found');
    }
    
    // Save results to JSON file
    const results = {
      searchTerm,
      timestamp: new Date().toISOString(),
      papers: {
        total: totalCount,
        processed: papers.length,
        pmids: pmids,
        sample: papers.slice(0, 10).map(p => ({
          pmid: p.pmid,
          title: p.title,
          journal: p.journal,
          date: p.date || p.meta_date_publication
        }))
      },
      nodes: {
        total: nodes.length,
        byType: nodes.reduce((acc, node) => {
          const type = node.type || 'unknown';
          acc[type] = (acc[type] || 0) + 1;
          return acc;
        }, {}),
        topNodes: sortedNodes.slice(0, 50).map(n => ({
          id: n.id,
          name: n.name,
          type: n.type,
          publicationCount: n.publications.length,
          publications: n.publications
        })),
        allNodes: nodes.map(n => ({
          id: n.id,
          name: n.name,
          type: n.type,
          publicationCount: n.publications.length,
          publications: n.publications
        })),
        publicationCountDistribution: pubCountRanges
      },
      edges: {
        total: edges.length,
        byType: edges.reduce((acc, edge) => {
          const type = edge.type || 'unknown';
          acc[type] = (acc[type] || 0) + 1;
          return acc;
        }, {}),
        sample: edges.slice(0, 20).map(e => ({
          source: e.source,
          target: e.target,
          type: e.type,
          sourceName: e.sourceName,
          targetName: e.targetName,
          publications: e.publications
        }))
      },
      coOccurrences: {
        total: coOccurrences.length,
        minPublications: 2,
        topPairs: coOccurrences.slice(0, 50).map(pair => ({
          node1: pair.node1,
          node2: pair.node2,
          coOccurrenceCount: pair.coOccurrenceCount,
          publications: pair.publications
        })),
        byCount: (() => {
          const byCount = {
            '2': 0,
            '3-5': 0,
            '6-10': 0,
            '11-20': 0,
            '>20': 0
          };
          coOccurrences.forEach(pair => {
            const count = pair.coOccurrenceCount;
            if (count === 2) byCount['2']++;
            else if (count >= 3 && count <= 5) byCount['3-5']++;
            else if (count >= 6 && count <= 10) byCount['6-10']++;
            else if (count >= 11 && count <= 20) byCount['11-20']++;
            else byCount['>20']++;
          });
          return byCount;
        })()
      },
      databases: {
        total: databasesList.length,
        list: databasesList,
        byDatabase: databasesList.reduce((acc, db) => {
          acc[db] = nodes.filter(n => n.database === db).length;
          return acc;
        }, {})
      },
      omim: {
        total: omimNodes.length,
        entries: omimNodes
      },
      mesh: {
        total: meshNodes.length,
        entries: meshNodes
      }
    };
    
    const outputFile = 'test-fam177a1-results.json';
    fs.writeFileSync(outputFile, JSON.stringify(results, null, 2));
    console.log(`\n\n💾 Results saved to: ${outputFile}`);
    
    console.log('\n\n✅ ============================================');
    console.log('✅ Test completed successfully!');
    console.log('✅ ============================================\n');
    
  } catch (error) {
    console.error('\n\n❌ ============================================');
    console.error('❌ Test failed with error:');
    console.error('❌ ============================================');
    console.error(error);
    process.exit(1);
  }
}

// Run the test
testFAM177A1().catch(console.error);

