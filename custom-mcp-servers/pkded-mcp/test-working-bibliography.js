#!/usr/bin/env node

// Focused test to show bibliography working with PMID citations
import { PKDDocumentService } from './dist/services/documentService.js';
import { PKDContextProvider } from './dist/tools/pkdContextProvider.js';

console.log('📚 PKD Bibliography - Focused Test (PMID Citations)\n');

async function testWorkingBibliography() {
  const documentService = new PKDDocumentService();
  const contextProvider = new PKDContextProvider(documentService);
  
  console.log('📄 Loading PKD documents...');
  const documents = await documentService.loadDocuments();
  console.log(`✅ Loaded ${documents.length} documents\n`);
  
  // Check which documents have citations
  console.log('🔍 Checking for documents with citations...');
  let docsWithCitations = 0;
  for (const doc of documents) {
    if (doc.citations && doc.citations.length > 0) {
      console.log(`   📋 "${doc.title}": ${doc.citations.length} citation(s)`);
      doc.citations.forEach(citation => {
        console.log(`      - PMID: ${citation.pmid}, Title: ${citation.title}`);
      });
      docsWithCitations++;
    }
  }
  
  if (docsWithCitations === 0) {
    console.log('   ❌ No documents found with PMID citations');
    console.log('   💡 This means our UpToDate HTML docs don\'t have the expected "PMID: 12345" format');
    return;
  }
  
  console.log(`\n✅ Found ${docsWithCitations} document(s) with citations\n`);
  
  // Test query that should find the document with citations
  console.log('🧬 Testing query: "ADPKD Overview" (should find our sample doc with PMIDs)');
  
  try {
    const result = await contextProvider.handle({
      query: "ADPKD Overview",
      include_citations: true,
      max_chunks: 3
    });
    
    console.log(`📊 Results:`);
    console.log(`   Documents used: ${result.metadata?.documentsUsed || 0}`);
    console.log(`   Citations found: ${result.metadata?.citationsFound || 0}`);
    console.log(`   Response time: ${result.metadata?.responseTime || 0}ms`);
    
    if (result.bibliography && result.bibliography.length > 0) {
      console.log(`\n🎉 SUCCESS! Bibliography created with ${result.bibliography.length} citations:`);
      result.bibliography.forEach((citation, index) => {
        console.log(`   ${index + 1}. PMID: ${citation.pmid || 'N/A'}`);
        console.log(`      Title: ${citation.title}`);
        console.log(`      Authors: ${citation.authors?.join(', ') || 'N/A'}`);
      });
      
      if (result.artifacts && result.artifacts.length > 0) {
        console.log(`\n📄 Bibliography Artifact Created:`);
        console.log(`   Type: ${result.artifacts[0].type}`);
        console.log(`   Title: ${result.artifacts[0].title}`);
        console.log(`\n📋 Full Artifact Content:`);
        console.log('----------------------------------------');
        console.log(result.artifacts[0].content);
        console.log('----------------------------------------');
      }
    } else {
      console.log(`\n📚 No bibliography created - include_citations may be false or no citations found`);
    }
    
  } catch (error) {
    console.error(`❌ Error testing query: ${error}`);
  }
}

testWorkingBibliography().catch(console.error); 