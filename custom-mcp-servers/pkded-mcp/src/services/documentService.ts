import { readFileSync, existsSync, readdirSync, statSync, watchFile, writeFileSync } from 'fs';
import { join, dirname, extname } from 'path';
import { fileURLToPath } from 'url';
import { PKDDocument, Citation } from '../types/pkdTypes.js';

export class PKDDocumentService {
  private documents: Map<string, PKDDocument> = new Map();
  private docsPath: string;
  private watchedFiles: Set<string> = new Set();

  constructor() {
    // Get current file location for ES modules
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    
    // Look for PKD docs folder
    this.docsPath = join(process.cwd(), 'data', 'markdown');
    if (!existsSync(this.docsPath)) {
      // Try relative to the package directory (go up from dist/services to root)
      this.docsPath = join(dirname(dirname(__dirname)), 'data', 'markdown');
    }
    if (!existsSync(this.docsPath)) {
      console.warn(`Warning: No PKD docs directory found. Please create: ${this.docsPath}`);
    }
  }

  async loadDocuments(): Promise<PKDDocument[]> {
    if (!existsSync(this.docsPath)) {
      console.log(`PKD docs directory not found: ${this.docsPath}`);
      return [];
    }

    console.log(`Loading PKD documents from: ${this.docsPath}`);
    
    try {
      this.documents.clear();
      this.scanDirectory(this.docsPath, '');
      console.log(`Loaded ${this.documents.size} PKD documents`);
      return Array.from(this.documents.values());
    } catch (error) {
      console.error(`Error loading PKD documents: ${error}`);
      return [];
    }
  }

  private scanDirectory(dirPath: string, category: string): void {
    const items = readdirSync(dirPath);
    
    for (const item of items) {
      const fullPath = join(dirPath, item);
      const stat = statSync(fullPath);
      
      if (stat.isDirectory()) {
        // Recursively scan subdirectories
        const subCategory = category ? `${category}/${item}` : item;
        this.scanDirectory(fullPath, subCategory);
      } else if (this.isPKDDocumentFile(item)) {
        // Load PKD document file
        this.loadDocument(fullPath, category);
      }
    }
  }

  private isPKDDocumentFile(filename: string): boolean {
    const ext = extname(filename).toLowerCase();
    return ['.md', '.txt', '.rst'].includes(ext);
  }

  private loadDocument(filePath: string, category: string): void {
    try {
      const content = readFileSync(filePath, 'utf-8');
      const stat = statSync(filePath);
      const filename = filePath.split('/').pop() || filePath;
      
      // Extract title from first line or filename
      const lines = content.split('\n');
      let title = filename.replace(/\.[^/.]+$/, ''); // Remove extension
      
      // Try to extract title from markdown header
      if (lines.length > 0) {
        const firstLine = lines[0].trim();
        if (firstLine.startsWith('# ')) {
          title = firstLine.substring(2).trim();
        } else if (firstLine.length > 0 && firstLine.length < 100) {
          title = firstLine;
        }
      }

      // Extract medical topics and metadata
      const { medicalTopic, difficulty, citations, tags } = this.extractMetadata(content);
      
      // Determine category from folder structure or content
      const documentCategory = this.categorizeDocument(category, content, filePath);

      const docInfo: PKDDocument = {
        id: this.generateDocId(filePath),
        title,
        content,
        filePath,
        category: documentCategory,
        medicalTopic,
        difficulty,
        lastModified: stat.mtime,
        citations,
        tags
      };

      this.documents.set(docInfo.id, docInfo);
      
      // Watch file for changes
      this.watchFileForChanges(filePath);
      
      console.log(`Loaded PKD document: ${title} (${documentCategory})`);
    } catch (error) {
      console.error(`Error loading PKD document ${filePath}: ${error}`);
    }
  }

  private extractMetadata(content: string): {
    medicalTopic: string[];
    difficulty: 'basic' | 'intermediate' | 'advanced';
    citations: Citation[];
    tags: string[];
  } {
    const medicalTopic: string[] = [];
    let difficulty: 'basic' | 'intermediate' | 'advanced' = 'intermediate';
    const citations: Citation[] = [];
    const tags: string[] = [];

    // Extract medical topics from headers and content
    const headerMatches = content.match(/^#{1,3}\s+(.+)$/gm);
    if (headerMatches) {
      for (const header of headerMatches) {
        const topic = header.replace(/^#+\s+/, '').toLowerCase();
        if (this.isMedicalTopic(topic)) {
          medicalTopic.push(topic);
        }
      }
    }

    // Determine difficulty based on technical terminology density
    const technicalTerms = this.countTechnicalTerms(content);
    if (technicalTerms < 10) {
      difficulty = 'basic';
    } else if (technicalTerms > 25) {
      difficulty = 'advanced';
    }

    // Extract citations (PMIDs, DOIs, etc.)
    const pmidMatches = content.match(/PMID:\s*(\d+)/gi);
    if (pmidMatches) {
      for (const match of pmidMatches) {
        const pmid = match.replace(/PMID:\s*/i, '');
        citations.push({
          pmid,
          title: `Reference PMID:${pmid}`,
          authors: []
        });
      }
    }

    // Extract tags
    const tagMatches = content.match(/(?:tags?|keywords?):\s*([^\n]+)/gi);
    if (tagMatches) {
      for (const match of tagMatches) {
        const tagList = match.replace(/(?:tags?|keywords?):\s*/i, '').split(',');
        tags.push(...tagList.map(tag => tag.trim()));
      }
    }

    // Add PKD-specific tags based on content
    this.addPKDSpecificTags(content, tags);

    return {
      medicalTopic: [...new Set(medicalTopic)],
      difficulty,
      citations,
      tags: [...new Set(tags)]
    };
  }

  private isMedicalTopic(topic: string): boolean {
    const medicalKeywords = [
      'diagnosis', 'treatment', 'symptoms', 'genetics', 'inheritance',
      'complications', 'management', 'therapy', 'prognosis', 'pathogenesis',
      'epidemiology', 'screening', 'monitoring', 'lifestyle', 'diet'
    ];
    return medicalKeywords.some(keyword => topic.includes(keyword));
  }

  private countTechnicalTerms(content: string): number {
    const technicalTerms = [
      'autosomal dominant', 'polycystic', 'nephrology', 'glomerular filtration',
      'creatinine', 'proteinuria', 'hypertension', 'angiomyolipoma',
      'pkd1', 'pkd2', 'polycystin', 'tuberous sclerosis', 'von hippel-lindau'
    ];
    
    let count = 0;
    const lowerContent = content.toLowerCase();
    for (const term of technicalTerms) {
      const matches = lowerContent.match(new RegExp(term, 'gi'));
      if (matches) count += matches.length;
    }
    return count;
  }

  private categorizeDocument(folderCategory: string, content: string, filePath: string): PKDDocument['category'] {
    const lowerContent = content.toLowerCase();
    const lowerPath = filePath.toLowerCase();

    // Check folder-based categorization first
    if (folderCategory.includes('diagnosis')) return 'diagnosis';
    if (folderCategory.includes('treatment')) return 'treatment';
    if (folderCategory.includes('genetic')) return 'genetics';
    if (folderCategory.includes('lifestyle')) return 'lifestyle';
    if (folderCategory.includes('research')) return 'research';
    if (folderCategory.includes('complication')) return 'complications';

    // Content-based categorization
    if (lowerContent.includes('diagnosis') || lowerContent.includes('screening')) {
      return 'diagnosis';
    }
    if (lowerContent.includes('treatment') || lowerContent.includes('therapy') || lowerContent.includes('management')) {
      return 'treatment';
    }
    if (lowerContent.includes('genetic') || lowerContent.includes('inheritance') || lowerContent.includes('pkd1') || lowerContent.includes('pkd2')) {
      return 'genetics';
    }
    if (lowerContent.includes('lifestyle') || lowerContent.includes('diet') || lowerContent.includes('exercise')) {
      return 'lifestyle';
    }
    if (lowerContent.includes('research') || lowerContent.includes('study') || lowerContent.includes('clinical trial')) {
      return 'research';
    }
    if (lowerContent.includes('complication') || lowerContent.includes('infection') || lowerContent.includes('kidney failure')) {
      return 'complications';
    }

    // Default to treatment if uncertain
    return 'treatment';
  }

  private addPKDSpecificTags(content: string, tags: string[]): void {
    const lowerContent = content.toLowerCase();
    
    if (lowerContent.includes('adpkd')) tags.push('ADPKD');
    if (lowerContent.includes('autosomal dominant')) tags.push('autosomal-dominant');
    if (lowerContent.includes('polycystic kidney')) tags.push('polycystic-kidney-disease');
    if (lowerContent.includes('kidney cyst')) tags.push('kidney-cysts');
    if (lowerContent.includes('pkd1')) tags.push('PKD1-gene');
    if (lowerContent.includes('pkd2')) tags.push('PKD2-gene');
    if (lowerContent.includes('tolvaptan')) tags.push('tolvaptan');
    if (lowerContent.includes('uti') || lowerContent.includes('urinary tract infection')) tags.push('UTI');
  }

  private generateDocId(filePath: string): string {
    return filePath.replace(this.docsPath, '').replace(/^\//, '').replace(/\//g, '_');
  }

  private watchFileForChanges(filePath: string): void {
    if (this.watchedFiles.has(filePath)) return;
    
    this.watchedFiles.add(filePath);
    watchFile(filePath, { interval: 5000 }, () => {
      console.log(`PKD document changed: ${filePath}`);
      this.loadDocument(filePath, '');
    });
  }

  // Public methods for document access
  async getDocument(id: string): Promise<PKDDocument | null> {
    // Try direct ID lookup first
    if (this.documents.has(id)) {
      return this.documents.get(id)!;
    }

    // Try finding by title or partial path
    for (const [docId, doc] of this.documents) {
      if (doc.title.toLowerCase() === id.toLowerCase() ||
          doc.filePath.includes(id)) {
        return doc;
      }
    }

    return null;
  }

  getDocumentsByTopic(topic: string): PKDDocument[] {
    return Array.from(this.documents.values())
      .filter(doc => 
        doc.medicalTopic.some(t => t.toLowerCase().includes(topic.toLowerCase())) ||
        doc.tags.some(tag => tag.toLowerCase().includes(topic.toLowerCase()))
      )
      .sort((a, b) => a.title.localeCompare(b.title));
  }

  getDocumentsByCategory(category: PKDDocument['category']): PKDDocument[] {
    return Array.from(this.documents.values())
      .filter(doc => doc.category === category)
      .sort((a, b) => a.title.localeCompare(b.title));
  }

  getDocumentsByDifficulty(difficulty: PKDDocument['difficulty']): PKDDocument[] {
    return Array.from(this.documents.values())
      .filter(doc => doc.difficulty === difficulty)
      .sort((a, b) => a.title.localeCompare(b.title));
  }

  listDocuments(): PKDDocument[] {
    return Array.from(this.documents.values())
      .sort((a, b) => a.title.localeCompare(b.title));
  }

  getCategories(): string[] {
    const categories = new Set<string>();
    for (const doc of this.documents.values()) {
      categories.add(doc.category);
    }
    return Array.from(categories).sort();
  }

  getTopics(): string[] {
    const topics = new Set<string>();
    for (const doc of this.documents.values()) {
      doc.medicalTopic.forEach(topic => topics.add(topic));
      doc.tags.forEach(tag => topics.add(tag));
    }
    return Array.from(topics).sort();
  }

  async refreshDocuments(): Promise<void> {
    console.log('Refreshing PKD documents...');
    await this.loadDocuments();
  }

  getDocumentStats(): {
    totalDocuments: number;
    categoriesCount: Record<string, number>;
    difficultyCount: Record<string, number>;
    topTopics: Array<{ topic: string; count: number }>;
  } {
    const docs = this.listDocuments();
    const categoriesCount: Record<string, number> = {};
    const difficultyCount: Record<string, number> = {};
    const topicCounts: Record<string, number> = {};

    for (const doc of docs) {
      categoriesCount[doc.category] = (categoriesCount[doc.category] || 0) + 1;
      difficultyCount[doc.difficulty] = (difficultyCount[doc.difficulty] || 0) + 1;
      
      for (const topic of [...doc.medicalTopic, ...doc.tags]) {
        topicCounts[topic] = (topicCounts[topic] || 0) + 1;
      }
    }

    const topTopics = Object.entries(topicCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([topic, count]) => ({ topic, count }));

    return {
      totalDocuments: docs.length,
      categoriesCount,
      difficultyCount,
      topTopics
    };
  }

  // Export all document metadata to a JSON file for inspection
  async exportDocumentMetadata(outputPath?: string): Promise<string> {
    const exportPath = outputPath || join(process.cwd(), 'pkd-documents-metadata.json');
    
    // Get all documents
    const allDocuments = this.listDocuments();
    
    // Create export data structure
    const exportData = {
      exportTimestamp: new Date().toISOString(),
      totalDocuments: allDocuments.length,
      docsPath: this.docsPath,
      summary: this.getDocumentStats(),
      documents: allDocuments.map(doc => ({
        // Include all metadata fields
        id: doc.id,
        title: doc.title,
        filePath: doc.filePath,
        category: doc.category,
        medicalTopic: doc.medicalTopic,
        difficulty: doc.difficulty,
        tags: doc.tags,
        citations: doc.citations || [],
        lastModified: doc.lastModified.toISOString(),
        
        // Add some computed stats for each document
        contentLength: doc.content.length,
        contentPreview: doc.content.substring(0, 200) + '...',
        wordCount: doc.content.split(/\s+/).length,
        lineCount: doc.content.split('\n').length,
        
        // Tag and topic analysis
        medicalTopicCount: doc.medicalTopic.length,
        tagCount: doc.tags.length,
        citationCount: (doc.citations || []).length,
        
        // Content analysis
        hasMarkdownHeaders: doc.content.includes('##'),
        hasBulletPoints: doc.content.includes('- ') || doc.content.includes('* '),
        hasNumberedLists: /^\d+\.\s/.test(doc.content),
        
        // PKD-specific analysis
        mentionsADPKD: doc.content.toLowerCase().includes('adpkd'),
        mentionsPKD1: doc.content.toLowerCase().includes('pkd1'),
        mentionsPKD2: doc.content.toLowerCase().includes('pkd2'),
        mentionsTolvaptan: doc.content.toLowerCase().includes('tolvaptan'),
      }))
    };
    
    try {
      // Write to file with pretty formatting
      writeFileSync(exportPath, JSON.stringify(exportData, null, 2), 'utf-8');
      
      console.log(`📁 Document metadata exported to: ${exportPath}`);
      console.log(`📊 Exported ${allDocuments.length} documents with complete metadata`);
      
      return exportPath;
    } catch (error) {
      console.error(`❌ Error exporting document metadata: ${error}`);
      throw error;
    }
  }

  // Export specific document with full content for detailed inspection
  async exportSingleDocument(documentId: string, outputPath?: string): Promise<string> {
    const doc = await this.getDocument(documentId);
    if (!doc) {
      throw new Error(`Document not found: ${documentId}`);
    }
    
    const exportPath = outputPath || join(process.cwd(), `pkd-document-${documentId.replace(/[^a-zA-Z0-9]/g, '_')}.json`);
    
    const exportData = {
      exportTimestamp: new Date().toISOString(),
      document: {
        ...doc,
        lastModified: doc.lastModified.toISOString(),
        
        // Add detailed content analysis
        analysis: {
          contentLength: doc.content.length,
          wordCount: doc.content.split(/\s+/).length,
          lineCount: doc.content.split('\n').length,
          paragraphCount: doc.content.split('\n\n').length,
          
          // Header analysis
          headers: {
            h1Count: (doc.content.match(/^# /gm) || []).length,
            h2Count: (doc.content.match(/^## /gm) || []).length,
            h3Count: (doc.content.match(/^### /gm) || []).length,
            allHeaders: (doc.content.match(/^#{1,3}\s+(.+)$/gm) || [])
          },
          
          // Medical term frequency
          medicalTermFrequency: this.analyzeMedicalTermFrequency(doc.content),
          
          // PKD-specific analysis
          pkdAnalysis: {
            adpkdMentions: (doc.content.toLowerCase().match(/adpkd/g) || []).length,
            pkd1Mentions: (doc.content.toLowerCase().match(/pkd1/g) || []).length,
            pkd2Mentions: (doc.content.toLowerCase().match(/pkd2/g) || []).length,
            polycystinMentions: (doc.content.toLowerCase().match(/polycystin/g) || []).length,
            tolvaptanMentions: (doc.content.toLowerCase().match(/tolvaptan/g) || []).length,
          }
        }
      }
    };
    
    try {
      writeFileSync(exportPath, JSON.stringify(exportData, null, 2), 'utf-8');
      console.log(`📄 Single document exported to: ${exportPath}`);
      return exportPath;
    } catch (error) {
      console.error(`❌ Error exporting single document: ${error}`);
      throw error;
    }
  }

  private analyzeMedicalTermFrequency(content: string): Record<string, number> {
    const medicalTerms = [
      'autosomal dominant', 'polycystic', 'kidney', 'cyst', 'hypertension',
      'proteinuria', 'creatinine', 'glomerular filtration', 'nephrology',
      'dialysis', 'transplant', 'genetic', 'inheritance', 'mutation',
      'diagnosis', 'treatment', 'therapy', 'management', 'prognosis'
    ];
    
    const frequency: Record<string, number> = {};
    const lowerContent = content.toLowerCase();
    
    for (const term of medicalTerms) {
      const matches = lowerContent.match(new RegExp(term, 'g'));
      frequency[term] = matches ? matches.length : 0;
    }
    
    return frequency;
  }
} 