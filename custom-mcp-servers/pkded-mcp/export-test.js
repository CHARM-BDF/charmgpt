#!/usr/bin/env node

// Test script to export PKD document metadata for inspection
import { PKDDocumentService } from './dist/services/documentService.js';

console.log('📁 PKD Document Metadata Export Test\n');

async function testExport() {
  const service = new PKDDocumentService();
  
  console.log('🔍 Step 1: Loading PKD documents...');
  const documents = await service.loadDocuments();
  console.log(`✅ Loaded ${documents.length} documents\n`);
  
  if (documents.length === 0) {
    console.log('❌ No documents found. Please ensure you have PKD documents in data/markdown/');
    return;
  }
  
  console.log('📊 Step 2: Exporting all document metadata...');
  try {
    const metadataPath = await service.exportDocumentMetadata();
    console.log(`✅ All metadata exported to: ${metadataPath}\n`);
  } catch (error) {
    console.error(`❌ Error exporting metadata: ${error}\n`);
  }
  
  // Export the first document as an example
  if (documents.length > 0) {
    const firstDoc = documents[0];
    console.log(`📄 Step 3: Exporting single document example: "${firstDoc.title}"`);
    try {
      const singleDocPath = await service.exportSingleDocument(firstDoc.id);
      console.log(`✅ Single document exported to: ${singleDocPath}\n`);
    } catch (error) {
      console.error(`❌ Error exporting single document: ${error}\n`);
    }
  }
  
  console.log('🎉 Export test complete!');
  console.log('📋 Files created:');
  console.log('   • pkd-documents-metadata.json - Complete metadata for all documents');
  console.log('   • pkd-document-*.json - Detailed analysis of single document');
  console.log('\n💡 You can now open these JSON files to inspect the document metadata structure!');
}

testExport().catch(console.error); 