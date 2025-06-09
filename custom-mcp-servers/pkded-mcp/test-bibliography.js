#!/usr/bin/env node

// Test script to demonstrate PKD bibliography artifact functionality
import { PKDDocumentService } from './dist/services/documentService.js';
import { PKDContextProvider } from './dist/tools/pkdContextProvider.js';

console.log('📚 PKD Bibliography Artifact Test\n');

async function testBibliography() {
  console.log('🔍 Step 1: Initializing PKD services...');
  const documentService = new PKDDocumentService();
  const contextProvider = new PKDContextProvider(documentService);
  
  console.log('📄 Step 2: Loading PKD documents...');
  const documents = await documentService.loadDocuments();
  console.log(`✅ Loaded ${documents.length} documents\n`);
  
  if (documents.length === 0) {
    console.log('❌ No documents found. Please ensure you have PKD documents in data/markdown/');
    return;
  }
  
  // Test various queries to show bibliography functionality
  const testQueries = [
    { query: "What is ADPKD?", include_citations: true },
    { query: "How do you treat PKD?", include_citations: true, context_type: "treatment" },
    { query: "PKD genetics", include_citations: false },
  ];
  
  for (const testQuery of testQueries) {
    console.log(`🧬 Step 3: Testing query: "${testQuery.query}"`);
    console.log(`   Include citations: ${testQuery.include_citations}`);
    console.log(`   Context type: ${testQuery.context_type || 'general'}\n`);
    
    try {
      const result = await contextProvider.handle(testQuery);
      
      console.log(`📊 Results:`);
      console.log(`   Documents used: ${result.metadata?.documentsUsed || 0}`);
      console.log(`   Citations found: ${result.metadata?.citationsFound || 0}`);
      console.log(`   Response time: ${result.metadata?.responseTime || 0}ms`);
      
      if (result.bibliography && result.bibliography.length > 0) {
        console.log(`\n📚 Bibliography (${result.bibliography.length} citations):`);
        result.bibliography.forEach((citation, index) => {
          console.log(`   ${index + 1}. PMID: ${citation.pmid || 'N/A'}`);
          console.log(`      Title: ${citation.title}`);
        });
        
        if (result.artifacts && result.artifacts.length > 0) {
          console.log(`\n🎨 Bibliography Artifact Created:`);
          console.log(`   Type: ${result.artifacts[0].type}`);
          console.log(`   Title: ${result.artifacts[0].title}`);
          console.log(`   Content preview: ${result.artifacts[0].content.substring(0, 150)}...`);
        }
      } else {
        console.log(`\n📚 No bibliography created (citations not included or none found)`);
      }
      
    } catch (error) {
      console.error(`❌ Error testing query: ${error}`);
    }
    
    console.log('\n' + '='.repeat(80) + '\n');
  }
  
  console.log('🎉 Bibliography test complete!');
  console.log('\n💡 Key features demonstrated:');
  console.log('   • Automatic citation extraction from PKD documents');
  console.log('   • Bibliography artifact creation with PubMed links');
  console.log('   • Conditional bibliography based on include_citations parameter');
  console.log('   • Unique citation deduplication across multiple documents');
  console.log('   • Source document tracking for citation context');
}

testBibliography().catch(console.error); 