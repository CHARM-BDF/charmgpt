#!/usr/bin/env node

// Test script to demonstrate PKD document processing
import { PKDDocumentService } from './dist/services/documentService.js';
import { readFileSync } from 'fs';
import { join } from 'path';

console.log('🧬 PKD Document Processing Pipeline Demonstration\n');

async function demonstrateProcessing() {
  const service = new PKDDocumentService();
  
  console.log('📁 STEP 1: Loading sample document content...');
  const samplePath = join(process.cwd(), 'data', 'markdown', 'adpkd_overview.md');
  const content = readFileSync(samplePath, 'utf-8');
  
  console.log('📄 Sample Document Preview:');
  console.log(content.substring(0, 200) + '...\n');
  
  console.log('🔍 STEP 2: Loading all documents through service...');
  const documents = await service.loadDocuments();
  
  console.log(`✅ Loaded ${documents.length} documents\n`);
  
  // Find our sample document
  const sampleDoc = documents.find(doc => doc.title.includes('ADPKD Overview'));
  
  if (sampleDoc) {
    console.log('📊 STEP 3: Document Processing Results');
    console.log('=====================================');
    console.log(`🏷️  Title: ${sampleDoc.title}`);
    console.log(`📂 Category: ${sampleDoc.category}`);
    console.log(`🎯 Difficulty: ${sampleDoc.difficulty}`);
    console.log(`🏥 Medical Topics: ${sampleDoc.medicalTopic.join(', ')}`);
    console.log(`🏷️  Tags: ${sampleDoc.tags.join(', ')}`);
    console.log(`📚 Citations: ${sampleDoc.citations.length} found`);
    
    if (sampleDoc.citations.length > 0) {
      console.log('   Citation details:');
      sampleDoc.citations.forEach(citation => {
        console.log(`   - PMID: ${citation.pmid}`);
      });
    }
    
    console.log(`📁 File Path: ${sampleDoc.filePath}`);
    console.log(`📅 Last Modified: ${sampleDoc.lastModified.toISOString()}\n`);
  }
  
  console.log('📈 STEP 4: Overall Statistics');
  console.log('============================');
  const stats = service.getDocumentStats();
  console.log(`📚 Total Documents: ${stats.totalDocuments}`);
  console.log('📂 Categories:', Object.entries(stats.categoriesCount).map(([cat, count]) => `${cat}(${count})`).join(', '));
  console.log('🎯 Difficulty Levels:', Object.entries(stats.difficultyCount).map(([diff, count]) => `${diff}(${count})`).join(', '));
  console.log('🔥 Top Topics:');
  stats.topTopics.slice(0, 5).forEach(({ topic, count }) => {
    console.log(`   • ${topic}: ${count} mentions`);
  });
}

demonstrateProcessing().catch(console.error); 