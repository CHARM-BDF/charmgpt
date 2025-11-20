#!/usr/bin/env node

/**
 * Fast function to get all PMIDs for a search term in a single optimized call
 * This fetches all pages in parallel (with rate limiting) to get all PMIDs quickly
 */

const baseUrl = process.env.PUBTATOR_BASE_URL || 'https://www.ncbi.nlm.nih.gov/research/pubtator3-api';

async function getAllPMIDsForTerm(searchTerm) {
  console.log(`\n🔍 Fetching all PMIDs for: "${searchTerm}"...\n`);
  
  // First, get the total count
  const firstPageUrl = `${baseUrl}/search/?text=${encodeURIComponent(searchTerm)}&page_size=100&page=1`;
  const firstResponse = await fetch(firstPageUrl);
  const firstData = await firstResponse.json();
  
  const totalCount = firstData.count || 0;
  const resultsPerPage = firstData.results?.length || 10;
  const totalPages = Math.ceil(totalCount / resultsPerPage);
  
  console.log(`   Total papers: ${totalCount}`);
  console.log(`   Results per page: ${resultsPerPage}`);
  console.log(`   Total pages needed: ${totalPages}\n`);
  
  // Extract PMIDs from first page
  const allPMIDs = new Set();
  firstData.results?.forEach(paper => {
    if (paper.pmid) allPMIDs.add(paper.pmid.toString());
  });
  
  console.log(`   ✅ Page 1: Got ${firstData.results?.length || 0} papers (${allPMIDs.size} unique PMIDs)`);
  
  // Fetch remaining pages in parallel (with small delays to respect rate limits)
  const pagePromises = [];
  for (let page = 2; page <= totalPages; page++) {
    const pageUrl = `${baseUrl}/search/?text=${encodeURIComponent(searchTerm)}&page_size=100&page=${page}`;
    
    // Stagger requests slightly to avoid overwhelming the API
    const delay = (page - 2) * 200; // 200ms between requests
    
    pagePromises.push(
      new Promise(resolve => setTimeout(resolve, delay))
        .then(() => fetch(pageUrl))
        .then(res => res.json())
        .then(data => {
          const pagePMIDs = new Set();
          data.results?.forEach(paper => {
            if (paper.pmid) {
              const pmid = paper.pmid.toString();
              pagePMIDs.add(pmid);
              allPMIDs.add(pmid);
            }
          });
          console.log(`   ✅ Page ${page}: Got ${data.results?.length || 0} papers (${pagePMIDs.size} unique PMIDs)`);
          return pagePMIDs;
        })
        .catch(err => {
          console.error(`   ❌ Page ${page} error: ${err.message}`);
          return new Set();
        })
    );
  }
  
  // Wait for all pages
  await Promise.all(pagePromises);
  
  const pmidsArray = Array.from(allPMIDs).sort((a, b) => parseInt(b) - parseInt(a)); // Most recent first
  
  console.log(`\n   ✅ Total unique PMIDs: ${pmidsArray.length}`);
  console.log(`   📋 All PMIDs: ${pmidsArray.join(', ')}\n`);
  
  return pmidsArray;
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const searchTerm = process.argv[2] || 'FAM177A1';
  getAllPMIDsForTerm(searchTerm)
    .then(pmids => {
      console.log(`\n✅ Successfully retrieved ${pmids.length} PMIDs`);
      console.log(`\n📄 First 10 PMIDs: ${pmids.slice(0, 10).join(', ')}`);
      console.log(`📄 Last 10 PMIDs: ${pmids.slice(-10).join(', ')}`);
    })
    .catch(console.error);
}

export { getAllPMIDsForTerm };

