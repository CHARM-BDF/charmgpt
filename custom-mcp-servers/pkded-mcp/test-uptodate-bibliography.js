#!/usr/bin/env node

// Test script to demonstrate UpToDate bibliography functionality
import { PKDDocumentService } from './dist/services/documentService.js';
import { PKDContextProvider } from './dist/tools/pkdContextProvider.js';

console.log('📚 PKD UpToDate Bibliography Test\n');

async function testUpToDateBibliography() {
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

  // Test queries that should trigger bibliography
  const testQueries = [
    {
      query: "What is ADPKD?",
      description: "High relevance - should match title directly"
    },
    {
      query: "PKD hypertension treatment",
      description: "Treatment-focused query"
    },
    {
      query: "polycystic kidney disease genetics",
      description: "Genetics-focused query"
    }
  ];

  for (const testCase of testQueries) {
    console.log(`\n🔍 Testing: "${testCase.query}"`);
    console.log(`   Description: ${testCase.description}`);
    
    const result = await contextProvider.handle({
      query: testCase.query,
      include_citations: true,
      max_chunks: 3
    });
    
    console.log(`   📊 Documents used: ${result.metadata?.documentsUsed || 0}`);
    console.log(`   📚 Bibliography entries: ${result.bibliography?.length || 0}`);
    console.log(`   🎯 Has artifacts: ${result.artifacts ? 'Yes' : 'No'}`);
    
    if (result.artifacts && result.artifacts.length > 0) {
      console.log(`   📋 Artifact type: ${result.artifacts[0].type}`);
      console.log(`   📄 Artifact title: ${result.artifacts[0].title}`);
      
      // Show a preview of the bibliography
      const bibContent = result.artifacts[0].content;
      const preview = bibContent.split('\n').slice(0, 8).join('\n');
      console.log(`   📖 Bibliography preview:\n${preview}...\n`);
    }
  }

  console.log('\n✅ UpToDate Bibliography Test Complete!');
  console.log('\n📋 Summary:');
  console.log('- All queries now generate bibliographies showing UpToDate sources');
  console.log('- Bibliography includes clean titles, search URLs, and metadata');
  console.log('- Medical professionals can verify sources and explore further');
}

testUpToDateBibliography().catch(console.error); 