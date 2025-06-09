import { PKDDocumentService } from '../services/documentService.js';
import { PKDDocument } from '../types/pkdTypes.js';
import { TextContent } from '@modelcontextprotocol/sdk/types.js';
import { Citation } from '../types/pkdTypes.js';

export class PKDContextProvider {
  private documentService: PKDDocumentService;

  constructor(documentService: PKDDocumentService) {
    this.documentService = documentService;
  }

  async handle(args: {
    query: string;
    context_type?: 'diagnosis' | 'treatment' | 'genetics' | 'lifestyle' | 'research' | 'complications' | 'general';
    max_chunks?: number;
    include_citations?: boolean;
    difficulty?: 'basic' | 'intermediate' | 'advanced';
  }): Promise<{
    content: TextContent[];
    bibliography?: any[];
    artifacts?: {
      type: string;
      title: string;
      content: string;
    }[];
    metadata?: any;
  }> {
    const startTime = Date.now();
    
    try {
      // Extract search parameters
      const {
        query,
        context_type = 'general',
        max_chunks = 3,
        include_citations = false,
        difficulty
      } = args;

      console.log(`[PKD-CONTEXT] Processing query: "${query}" with type: ${context_type}`);

      // Perform basic text-based search (will be enhanced with vector search in Phase 2)
      const searchResults = await this.performBasicSearch(query, context_type, difficulty);
      
      // Limit results
      const limitedResults = searchResults.slice(0, max_chunks);
      
      // Format context for LLM injection
      const contextText = this.formatContextForLLM(limitedResults, include_citations);
      
      // Calculate metrics
      const responseTime = Date.now() - startTime;
      const medicalConcepts = this.extractMedicalConcepts(limitedResults);
      const topics = this.extractTopics(limitedResults);
      
      console.log(`[PKD-CONTEXT] Found ${limitedResults.length} relevant documents in ${responseTime}ms`);

      // Collect unique citations from all used documents
      const allCitations = this.collectUniqueCitations(limitedResults);
      
      // Create source document bibliography for UpToDate files used
      const sourceDocuments = this.createSourceDocumentBibliography(limitedResults);

      return {
        content: [{
          type: 'text' as const,
          text: contextText
        }],
        // Add bibliography - always create one showing source documents used
        bibliography: allCitations.length > 0 ? allCitations : sourceDocuments,
        artifacts: [{
          type: 'application/vnd.bibliography',
          title: 'PKD Medical References',
          content: allCitations.length > 0 
            ? this.formatBibliographyArtifact(allCitations)
            : this.formatSourceDocumentBibliography(limitedResults)
        }],
        metadata: {
          queryProcessed: query,
          contextType: context_type,
          documentsUsed: limitedResults.length,
          medicalConcepts,
          topicsConvered: topics,
          citationsFound: allCitations.length,
          sourceDocumentsUsed: limitedResults.length,
          responseTime,
          searchMethod: 'basic-text-search', // Will be 'vector-search' in Phase 2
          avgRelevanceScore: this.calculateBasicRelevanceScore(limitedResults, query)
        }
      };

    } catch (error) {
      console.error(`[PKD-CONTEXT] Error processing query: ${error}`);
      
      return {
        content: [{
          type: 'text' as const,
          text: `I apologize, but I encountered an error while searching the PKD knowledge base for information about "${args.query}". Please try rephrasing your question or contact support if the issue persists.`
        }],
        metadata: {
          error: error instanceof Error ? error.message : 'Unknown error',
          queryProcessed: args.query,
          contextType: args.context_type || 'general',
          responseTime: Date.now() - startTime
        }
      };
    }
  }

  private async performBasicSearch(
    query: string, 
    contextType: string, 
    difficulty?: string
  ): Promise<PKDDocument[]> {
    const queryLower = query.toLowerCase();
    const queryWords = queryLower.split(/\s+/).filter(word => word.length > 2);
    
    // Get all documents
    let documents = this.documentService.listDocuments();
    
    // Filter by context type if specified
    if (contextType && contextType !== 'general') {
      documents = documents.filter(doc => doc.category === contextType);
    }
    
    // Filter by difficulty if specified
    if (difficulty) {
      documents = documents.filter(doc => doc.difficulty === difficulty);
    }
    
    // Score documents based on query relevance
    const scoredDocuments = documents.map(doc => ({
      document: doc,
      score: this.calculateTextRelevanceScore(doc, queryWords)
    }));
    
    // Filter out low-scoring documents
    const relevantDocuments = scoredDocuments
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .map(({ document }) => document);
    
    return relevantDocuments;
  }

  private calculateTextRelevanceScore(document: PKDDocument, queryWords: string[]): number {
    let score = 0;
    const contentLower = document.content.toLowerCase();
    const titleLower = document.title.toLowerCase();
    
    // Title matches (higher weight)
    for (const word of queryWords) {
      if (titleLower.includes(word)) {
        score += 10;
      }
    }
    
    // Content matches
    for (const word of queryWords) {
      const matches = (contentLower.match(new RegExp(word, 'g')) || []).length;
      score += matches * 2;
    }
    
    // Medical topic matches
    for (const topic of document.medicalTopic) {
      for (const word of queryWords) {
        if (topic.toLowerCase().includes(word)) {
          score += 5;
        }
      }
    }
    
    // Tag matches
    for (const tag of document.tags) {
      for (const word of queryWords) {
        if (tag.toLowerCase().includes(word)) {
          score += 3;
        }
      }
    }
    
    return score;
  }

  private formatContextForLLM(documents: PKDDocument[], includeCitations: boolean): string {
    if (documents.length === 0) {
      return "No relevant PKD information found for this query.";
    }

    let context = "PKD Medical Knowledge Context:\n\n";
    
    for (let i = 0; i < documents.length; i++) {
      const doc = documents[i];
      
      context += `## Document ${i + 1}: ${doc.title}\n`;
      context += `**Category**: ${doc.category}\n`;
      context += `**Difficulty**: ${doc.difficulty}\n`;
      
      if (doc.medicalTopic.length > 0) {
        context += `**Medical Topics**: ${doc.medicalTopic.join(', ')}\n`;
      }
      
      context += `\n${doc.content}\n`;
      
      if (includeCitations && doc.citations && doc.citations.length > 0) {
        context += `\n**Citations**:\n`;
        for (const citation of doc.citations) {
          if (citation.pmid) {
            context += `- PMID: ${citation.pmid}\n`;
          }
          if (citation.doi) {
            context += `- DOI: ${citation.doi}\n`;
          }
        }
      }
      
      context += "\n---\n\n";
    }
    
    context += "Please use this PKD medical information to provide an accurate, evidence-based response. Do not mention that you have access to this context.";
    
    return context;
  }

  private extractMedicalConcepts(documents: PKDDocument[]): string[] {
    const concepts = new Set<string>();
    
    for (const doc of documents) {
      // Add topics and tags as medical concepts
      doc.medicalTopic.forEach(topic => concepts.add(topic));
      doc.tags.forEach(tag => concepts.add(tag));
      
      // Extract common PKD-related medical terms from content
      const content = doc.content.toLowerCase();
      const pkdTerms = [
        'adpkd', 'autosomal dominant', 'polycystic kidney disease',
        'kidney cysts', 'pkd1', 'pkd2', 'polycystin', 'tolvaptan',
        'hypertension', 'proteinuria', 'kidney function', 'creatinine',
        'glomerular filtration rate', 'end-stage renal disease'
      ];
      
      for (const term of pkdTerms) {
        if (content.includes(term)) {
          concepts.add(term);
        }
      }
    }
    
    return Array.from(concepts).slice(0, 10); // Limit to top 10 concepts
  }

  private extractTopics(documents: PKDDocument[]): string[] {
    const topics = new Set<string>();
    
    for (const doc of documents) {
      topics.add(doc.category);
      doc.medicalTopic.forEach(topic => topics.add(topic));
    }
    
    return Array.from(topics);
  }

  private calculateBasicRelevanceScore(documents: PKDDocument[], query: string): number {
    if (documents.length === 0) return 0;
    
    const queryWords = query.toLowerCase().split(/\s+/);
    let totalScore = 0;
    
    for (const doc of documents) {
      totalScore += this.calculateTextRelevanceScore(doc, queryWords);
    }
    
    return totalScore / documents.length;
  }

  // Utility method for debugging
  getSearchStats(): {
    totalDocuments: number;
    categoriesAvailable: string[];
    topicsAvailable: string[];
  } {
    const stats = this.documentService.getDocumentStats();
    
    return {
      totalDocuments: stats.totalDocuments,
      categoriesAvailable: Object.keys(stats.categoriesCount),
      topicsAvailable: stats.topTopics.map(t => t.topic).slice(0, 5)
    };
  }

  private collectUniqueCitations(documents: PKDDocument[]): Citation[] {
    const citationsMap = new Map<string, Citation>();
    
    for (const doc of documents) {
      if (doc.citations) {
        for (const citation of doc.citations) {
          // Use PMID as primary key, DOI as fallback
          const key = citation.pmid || citation.doi || citation.title;
          if (key && !citationsMap.has(key)) {
            // Create enhanced citation with source document info in title if not already present
            const enhancedCitation: Citation = {
              ...citation,
              title: citation.title.includes('Reference PMID:') 
                ? `${citation.title} (from ${doc.title})`
                : citation.title
            };
            citationsMap.set(key, enhancedCitation);
          }
        }
      }
    }
    
    return Array.from(citationsMap.values());
  }

  private formatBibliographyArtifact(citations: Citation[]): string {
    if (citations.length === 0) {
      return "No citations found in the selected PKD documents.";
    }

    let bibliography = "# PKD Medical References\n\n";
    bibliography += `Found ${citations.length} medical reference${citations.length === 1 ? '' : 's'} from PKD documents:\n\n`;
    
    citations.forEach((citation, index) => {
      bibliography += `${index + 1}. `;
      
      // Format based on available information
      if (citation.pmid) {
        bibliography += `**PMID: ${citation.pmid}**\n`;
        bibliography += `   📖 [View on PubMed](https://pubmed.ncbi.nlm.nih.gov/${citation.pmid}/)\n`;
        bibliography += `   📄 ${citation.title}\n`;
      } else if (citation.doi) {
        bibliography += `**DOI: ${citation.doi}**\n`;
        bibliography += `   📖 [View Article](https://doi.org/${citation.doi})\n`;
        bibliography += `   📄 ${citation.title}\n`;
      } else {
        bibliography += `**${citation.title}**\n`;
      }
      
      if (citation.authors && citation.authors.length > 0) {
        bibliography += `   👥 Authors: ${citation.authors.join(', ')}\n`;
      }
      
      if (citation.journal) {
        bibliography += `   📚 Journal: ${citation.journal}\n`;
      }
      
      if (citation.year) {
        bibliography += `   📅 Year: ${citation.year}\n`;
      }
      
      if (citation.url) {
        bibliography += `   🔗 URL: [${citation.url}](${citation.url})\n`;
      }
      
      bibliography += "\n";
    });
    
    bibliography += "\n---\n\n";
    bibliography += "*These medical references support the PKD information provided in the response. ";
    bibliography += "Click the links above to access the full articles on PubMed or publisher websites.*";
    
    return bibliography;
  }

  private createSourceDocumentBibliography(documents: PKDDocument[]): Citation[] {
    return documents.map((doc, index) => {
      // Extract UpToDate topic from title
      const upToDateTitle = this.extractUpToDateTitle(doc.title);
      
      return {
        title: upToDateTitle,
        authors: ["UpToDate"],
        journal: "UpToDate",
        url: this.generateUpToDateUrl(upToDateTitle),
        year: new Date().getFullYear(), // Current year as accessed date
        pmid: `source-${index + 1}`, // Unique identifier for source
      };
    });
  }

  private extractUpToDateTitle(title: string): string {
    // Clean up the title from file names like:
    // "Content from: html_webpages/Autosomal dominant polycystic kidney disease (ADPKD)_ Evaluation and management of hypertension - UpToDate.html"
    
    if (title.includes('UpToDate.html')) {
      // Extract the main topic part
      const parts = title.split('/');
      const lastPart = parts[parts.length - 1];
      const cleanTitle = lastPart
        .replace(' - UpToDate.html', '')
        .replace(/_/g, ' ')
        .replace(/\([^)]*\)/g, '') // Remove content in parentheses for cleaner title
        .trim();
      return cleanTitle || title;
    }
    
    return title;
  }

  private generateUpToDateUrl(title: string): string {
    // Generate a search URL for UpToDate (they don't have direct links to content)
    const searchTerm = encodeURIComponent(title.toLowerCase().replace(/\s+/g, ' '));
    return `https://www.uptodate.com/contents/search?search=${searchTerm}`;
  }

  private formatSourceDocumentBibliography(documents: PKDDocument[]): string {
    if (documents.length === 0) {
      return "No source documents found for the selected PKD documents.";
    }

    let bibliography = "# PKD Medical References\n\n";
    bibliography += `Found ${documents.length} UpToDate source document${documents.length === 1 ? '' : 's'} used for this PKD medical information:\n\n`;
    
    documents.forEach((doc, index) => {
      const upToDateTitle = this.extractUpToDateTitle(doc.title);
      const searchUrl = this.generateUpToDateUrl(upToDateTitle);
      
      bibliography += `${index + 1}. **${upToDateTitle}**\n`;
      bibliography += `   📖 UpToDate Medical Reference\n`;
      bibliography += `   🔗 [Search on UpToDate](${searchUrl})\n`;
      bibliography += `   📋 Category: ${doc.category}\n`;
      bibliography += `   🎯 Difficulty: ${doc.difficulty}\n`;
      
      if (doc.medicalTopic && doc.medicalTopic.length > 0) {
        bibliography += `   🏥 Medical Topics: ${doc.medicalTopic.join(', ')}\n`;
      }
      
      if (doc.tags && doc.tags.length > 0) {
        const relevantTags = doc.tags.slice(0, 5); // Limit to first 5 tags
        bibliography += `   🏷️  Tags: ${relevantTags.join(', ')}\n`;
      }
      
      bibliography += `   📅 Accessed: ${new Date().toLocaleDateString()}\n`;
      bibliography += "\n";
    });
    
    bibliography += "\n---\n\n";
    bibliography += "*These UpToDate medical references provided the authoritative clinical information for this PKD response. ";
    bibliography += "UpToDate is a leading evidence-based clinical decision support resource used by healthcare professionals worldwide.*";
    
    return bibliography;
  }
} 