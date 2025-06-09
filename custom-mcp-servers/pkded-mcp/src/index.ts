#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  CallToolRequest,
  ListToolsRequest,
  Tool,
  TextContent,
  LoggingLevel
} from '@modelcontextprotocol/sdk/types.js';
import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, dirname, extname } from 'path';
import { fileURLToPath } from 'url';

// Import PKD Education components
import { PKDDocumentService } from './services/documentService.js';
import { PKDContextProvider } from './tools/pkdContextProvider.js';

// Get the directory where this script is located
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Types for documentation structure
interface DocumentInfo {
  title: string;
  content: string;
  path: string;
  category: string;
  tags: string[];
  lastModified: Date;
}

interface SearchResult {
  document: DocumentInfo;
  relevanceScore: number;
  matchedSections: string[];
}

// MCP logging utility
let mcpServer: Server | null = null;

function log(message: string, data?: any): void {
  const timestamp = new Date().toISOString();
  const fullMessage = data ? `${message} | Data: ${JSON.stringify(data)}` : message;
  
  if (mcpServer) {
    mcpServer.sendLoggingMessage({
      level: 'info' as LoggingLevel,
      logger: 'pkded-mcp',
      data: {
        message: fullMessage,
        timestamp: timestamp,
        traceId: Math.random().toString(36).substring(2, 8),
        ...data
      }
    }).catch((error: any) => {
      console.error(`[${timestamp}] PKDED: ${fullMessage}`);
    });
  } else {
    console.error(`[${timestamp}] PKDED: ${fullMessage}`);
  }
}

// Documentation storage
class DocumentationStore {
  private documents: Map<string, DocumentInfo> = new Map();
  private docsPath: string;

  constructor() {
    // Look for docs folder relative to the current directory
    this.docsPath = join(process.cwd(), 'docs');
    if (!existsSync(this.docsPath)) {
      // Try relative to the package directory
      this.docsPath = join(__dirname, '..', 'docs');
    }
    if (!existsSync(this.docsPath)) {
      // Create an empty docs directory as placeholder
      log(`Warning: No docs directory found. Please create: ${this.docsPath}`);
    }
    this.loadDocuments();
  }

  private loadDocuments(): void {
    if (!existsSync(this.docsPath)) {
      log(`Docs directory not found: ${this.docsPath}`);
      return;
    }

    log(`Loading documents from: ${this.docsPath}`);
    
    try {
      this.scanDirectory(this.docsPath, '');
      log(`Loaded ${this.documents.size} documents`);
    } catch (error) {
      log(`Error loading documents: ${error}`);
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
      } else if (this.isDocumentFile(item)) {
        // Load document file
        this.loadDocument(fullPath, category);
      }
    }
  }

  private isDocumentFile(filename: string): boolean {
    const ext = extname(filename).toLowerCase();
    return ['.md', '.txt', '.rst', '.adoc'].includes(ext);
  }

  private loadDocument(filePath: string, category: string): void {
    try {
      const content = readFileSync(filePath, 'utf-8');
      const stat = statSync(filePath);
      const filename = filePath.split('/').pop() || filePath;
      
      // Extract title from first line or filename
      const lines = content.split('\n');
      let title = filename.replace(/\.[^/.]+$/, ''); // Remove extension
      
      // Try to extract title from markdown header or first line
      if (lines.length > 0) {
        const firstLine = lines[0].trim();
        if (firstLine.startsWith('# ')) {
          title = firstLine.substring(2).trim();
        } else if (firstLine.startsWith('=')) {
          // reStructuredText style
          if (lines.length > 1) {
            title = lines[1].trim();
          }
        } else if (firstLine.length > 0 && firstLine.length < 100) {
          // Use first line if it's reasonable title length
          title = firstLine;
        }
      }

      // Extract tags from content (look for common tag patterns)
      const tags = this.extractTags(content);

      const docInfo: DocumentInfo = {
        title,
        content,
        path: filePath,
        category: category || 'general',
        tags,
        lastModified: stat.mtime
      };

      const docId = this.generateDocId(filePath);
      this.documents.set(docId, docInfo);
      
      log(`Loaded document: ${title} (${category})`);
    } catch (error) {
      log(`Error loading document ${filePath}: ${error}`);
    }
  }

  private extractTags(content: string): string[] {
    const tags: string[] = [];
    
    // Look for various tag patterns
    const tagPatterns = [
      /tags?:\s*([^\n]+)/i,           // tags: tag1, tag2
      /keywords?:\s*([^\n]+)/i,       // keywords: word1, word2
      /#([a-zA-Z0-9_-]+)/g,          // #hashtag
    ];

    for (const pattern of tagPatterns) {
      const matches = content.match(pattern);
      if (matches) {
        if (pattern.global) {
          // For global patterns like hashtags
          for (const match of matches) {
            tags.push(match.replace('#', ''));
          }
        } else {
          // For single matches like "tags: ..."
          const tagList = matches[1].split(',').map(tag => tag.trim());
          tags.push(...tagList);
        }
      }
    }

    return [...new Set(tags)]; // Remove duplicates
  }

  private generateDocId(filePath: string): string {
    return filePath.replace(this.docsPath, '').replace(/^\//, '');
  }

  // Search documents based on query
  searchDocuments(query: string, limit: number = 10): SearchResult[] {
    const results: SearchResult[] = [];
    const queryLower = query.toLowerCase();
    const queryWords = queryLower.split(/\s+/).filter(word => word.length > 2);

    for (const [id, doc] of this.documents) {
      let relevanceScore = 0;
      const matchedSections: string[] = [];

      // Check title match (higher weight)
      if (doc.title.toLowerCase().includes(queryLower)) {
        relevanceScore += 10;
        matchedSections.push(`Title: ${doc.title}`);
      }

      // Check category match
      if (doc.category.toLowerCase().includes(queryLower)) {
        relevanceScore += 5;
        matchedSections.push(`Category: ${doc.category}`);
      }

      // Check tag matches
      for (const tag of doc.tags) {
        if (tag.toLowerCase().includes(queryLower)) {
          relevanceScore += 3;
          matchedSections.push(`Tag: ${tag}`);
        }
      }

      // Check content matches
      const contentLower = doc.content.toLowerCase();
      for (const word of queryWords) {
        const wordCount = (contentLower.match(new RegExp(word, 'g')) || []).length;
        relevanceScore += wordCount * 1;
      }

      // Find matching sections in content
      const lines = doc.content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (queryWords.some(word => line.toLowerCase().includes(word))) {
          // Get context around the match
          const start = Math.max(0, i - 1);
          const end = Math.min(lines.length, i + 2);
          const context = lines.slice(start, end).join('\n');
          matchedSections.push(`Content: ...${context}...`);
          
          // Limit the number of content matches per document
          if (matchedSections.filter(s => s.startsWith('Content:')).length >= 3) {
            break;
          }
        }
      }

      if (relevanceScore > 0) {
        results.push({
          document: doc,
          relevanceScore,
          matchedSections: matchedSections.slice(0, 5) // Limit matched sections
        });
      }
    }

    // Sort by relevance score and return top results
    return results
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, limit);
  }

  // Get document by ID or path
  getDocument(identifier: string): DocumentInfo | null {
    // Try direct ID lookup first
    if (this.documents.has(identifier)) {
      return this.documents.get(identifier)!;
    }

    // Try finding by title or partial path
    for (const [id, doc] of this.documents) {
      if (doc.title.toLowerCase() === identifier.toLowerCase() ||
          doc.path.includes(identifier)) {
        return doc;
      }
    }

    return null;
  }

  // List all available documents
  listDocuments(): DocumentInfo[] {
    return Array.from(this.documents.values())
      .sort((a, b) => a.title.localeCompare(b.title));
  }

  // Get documents by category
  getDocumentsByCategory(category: string): DocumentInfo[] {
    return Array.from(this.documents.values())
      .filter(doc => doc.category.toLowerCase().includes(category.toLowerCase()))
      .sort((a, b) => a.title.localeCompare(b.title));
  }

  // Get all categories
  getCategories(): string[] {
    const categories = new Set<string>();
    for (const doc of this.documents.values()) {
      categories.add(doc.category);
    }
    return Array.from(categories).sort();
  }

  // Refresh document store
  refresh(): void {
    this.documents.clear();
    this.loadDocuments();
  }
}

// Create the documentation store
const docStore = new DocumentationStore();

// Create the PKD education services
const pkdDocumentService = new PKDDocumentService();
const pkdContextProvider = new PKDContextProvider(pkdDocumentService);

// Create the MCP server
const server = new Server({
  name: 'pkded-mcp',
  version: '1.0.0',
}, {
  capabilities: {
    tools: {},
    logging: {},
  },
});

// Set the global server reference
mcpServer = server;
log("✅ PKDED MCP server created and reference assigned");

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async (): Promise<{ tools: Tool[] }> => {
  log('Tools list requested');
  
  return {
    tools: [
      {
        name: 'search-docs',
        description: 'Search through documentation based on a query. Returns relevant documents with context.',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search query to find relevant documentation',
            },
            limit: {
              type: 'number',
              description: 'Maximum number of results to return (default: 10)',
              minimum: 1,
              maximum: 50,
              default: 10
            },
          },
          required: ['query'],
        },
      },
      {
        name: 'get-document',
        description: 'Get a specific document by its identifier, title, or path.',
        inputSchema: {
          type: 'object',
          properties: {
            identifier: {
              type: 'string',
              description: 'Document identifier, title, or partial path',
            },
          },
          required: ['identifier'],
        },
      },
      {
        name: 'list-documents',
        description: 'List all available documents with their titles and categories.',
        inputSchema: {
          type: 'object',
          properties: {
            category: {
              type: 'string',
              description: 'Optional: filter by category',
            },
          },
        },
      },
      {
        name: 'list-categories',
        description: 'List all available document categories.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'refresh-docs',
        description: 'Refresh the documentation store by reloading all documents.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      // PKD Education Tools
      {
        name: 'pkd-context-provider',
        description: 'Search PKD medical knowledge base and provide relevant context for LLM responses. Returns medical information about polycystic kidney disease that will be used to enhance the assistant\'s responses.',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Medical question or topic to search for in the PKD knowledge base',
            },
            context_type: {
              type: 'string',
              description: 'Type of medical context to focus on',
              enum: ['diagnosis', 'treatment', 'genetics', 'lifestyle', 'research', 'complications', 'general'],
              default: 'general'
            },
            max_chunks: {
              type: 'number',
              description: 'Maximum number of document chunks to return (default: 3)',
              minimum: 1,
              maximum: 10,
              default: 3
            },
            include_citations: {
              type: 'boolean',
              description: 'Whether to include medical citations in the context',
              default: false
            },
            difficulty: {
              type: 'string',
              description: 'Preferred difficulty level of medical information',
              enum: ['basic', 'intermediate', 'advanced']
            }
          },
          required: ['query'],
        },
      },
      {
        name: 'pkd-document-stats',
        description: 'Get statistics about the PKD knowledge base including available categories, topics, and document counts.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'pkd-export-metadata',
        description: 'Export all PKD document metadata to a JSON file for inspection and analysis. Useful for debugging and understanding document processing.',
        inputSchema: {
          type: 'object',
          properties: {
            output_path: {
              type: 'string',
              description: 'Optional custom path for the output file. If not provided, will use pkd-documents-metadata.json in current directory.'
            }
          },
        },
      },
      {
        name: 'pkd-export-single-document',
        description: 'Export a single PKD document with full content and detailed analysis to a JSON file for inspection.',
        inputSchema: {
          type: 'object',
          properties: {
            document_id: {
              type: 'string',
              description: 'ID of the document to export (e.g., "adpkd_overview.md")',
            },
            output_path: {
              type: 'string',
              description: 'Optional custom path for the output file. If not provided, will auto-generate filename.'
            }
          },
          required: ['document_id'],
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request: CallToolRequest) => {
  const { name, arguments: args } = request.params;
  
  log(`🔥 TOOL CALL RECEIVED: ${name}`, args);
  
  try {
    if (name === 'search-docs') {
      const query = args?.query as string;
      const limit = (args?.limit as number) || 10;
      
      if (!query) {
        throw new Error('Query parameter is required');
      }
      
      log(`🔍 Searching documents for: "${query}"`);
      
      const results = docStore.searchDocuments(query, limit);
      
      if (results.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: `# No Documentation Found\n\nNo documents were found matching your query: **"${query}"**\n\nTry:\n- Using different keywords\n- Checking spelling\n- Using broader search terms\n- Using the \`list-documents\` tool to see available documentation`
            } as TextContent
          ]
        };
      }
      
      // Format search results
      let response = `# Documentation Search Results\n\nFound ${results.length} relevant documents for: **"${query}"**\n\n`;
      
      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        const doc = result.document;
        
        response += `## ${i + 1}. ${doc.title}\n`;
        response += `**Category:** ${doc.category}  \n`;
        response += `**Relevance Score:** ${result.relevanceScore}  \n`;
        response += `**Path:** \`${doc.path}\`  \n`;
        
        if (doc.tags.length > 0) {
          response += `**Tags:** ${doc.tags.join(', ')}  \n`;
        }
        
        response += `**Last Modified:** ${doc.lastModified.toLocaleDateString()}\n\n`;
        
        if (result.matchedSections.length > 0) {
          response += `**Relevant Sections:**\n`;
          for (const section of result.matchedSections) {
            response += `- ${section}\n`;
          }
          response += '\n';
        }
        
        response += '---\n\n';
      }
      
      log(`✅ Found ${results.length} search results`);
      
      return {
        content: [
          {
            type: 'text',
            text: response
          } as TextContent
        ]
      };
      
    } else if (name === 'get-document') {
      const identifier = args?.identifier as string;
      
      if (!identifier) {
        throw new Error('Identifier parameter is required');
      }
      
      log(`📄 Getting document: "${identifier}"`);
      
      const doc = docStore.getDocument(identifier);
      
      if (!doc) {
        return {
          content: [
            {
              type: 'text',
              text: `# Document Not Found\n\nNo document was found with identifier: **"${identifier}"**\n\nUse the \`list-documents\` tool to see available documentation.`
            } as TextContent
          ]
        };
      }
      
      let response = `# ${doc.title}\n\n`;
      response += `**Category:** ${doc.category}  \n`;
      response += `**Path:** \`${doc.path}\`  \n`;
      
      if (doc.tags.length > 0) {
        response += `**Tags:** ${doc.tags.join(', ')}  \n`;
      }
      
      response += `**Last Modified:** ${doc.lastModified.toLocaleDateString()}\n\n`;
      response += '---\n\n';
      response += doc.content;
      
      log(`✅ Retrieved document: ${doc.title}`);
      
      return {
        content: [
          {
            type: 'text',
            text: response
          } as TextContent
        ]
      };
      
    } else if (name === 'list-documents') {
      const category = args?.category as string;
      
      log(`📋 Listing documents${category ? ` in category: ${category}` : ''}`);
      
      const docs = category ? 
        docStore.getDocumentsByCategory(category) : 
        docStore.listDocuments();
      
      if (docs.length === 0) {
        const message = category ? 
          `No documents found in category: **"${category}"**` :
          'No documents found in the documentation store.';
          
        return {
          content: [
            {
              type: 'text',
              text: `# ${category ? 'Category Empty' : 'No Documents'}\n\n${message}\n\n${!category ? 'Please add documentation files to the `docs` directory.' : 'Try listing all categories with `list-categories`.'}`
            } as TextContent
          ]
        };
      }
      
      let response = `# Available Documentation\n\n`;
      
      if (category) {
        response += `**Category:** ${category}\n\n`;
      }
      
      response += `Found ${docs.length} document${docs.length === 1 ? '' : 's'}:\n\n`;
      
      // Group by category if showing all documents
      if (!category) {
        const categories = new Map<string, DocumentInfo[]>();
        
        for (const doc of docs) {
          if (!categories.has(doc.category)) {
            categories.set(doc.category, []);
          }
          categories.get(doc.category)!.push(doc);
        }
        
        for (const [cat, catDocs] of categories) {
          response += `## ${cat}\n\n`;
          for (const doc of catDocs) {
            response += `- **${doc.title}**`;
            if (doc.tags.length > 0) {
              response += ` (${doc.tags.join(', ')})`;
            }
            response += `  \n  Path: \`${doc.path}\`  \n  Modified: ${doc.lastModified.toLocaleDateString()}\n\n`;
          }
        }
      } else {
        for (const doc of docs) {
          response += `- **${doc.title}**`;
          if (doc.tags.length > 0) {
            response += ` (${doc.tags.join(', ')})`;
          }
          response += `  \n  Path: \`${doc.path}\`  \n  Modified: ${doc.lastModified.toLocaleDateString()}\n\n`;
        }
      }
      
      log(`✅ Listed ${docs.length} documents`);
      
      return {
        content: [
          {
            type: 'text',
            text: response
          } as TextContent
        ]
      };
      
    } else if (name === 'list-categories') {
      log(`📂 Listing categories`);
      
      const categories = docStore.getCategories();
      
      if (categories.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: `# No Categories Found\n\nNo document categories found in the documentation store.\n\nPlease add documentation files to the \`docs\` directory.`
            } as TextContent
          ]
        };
      }
      
      let response = `# Document Categories\n\nFound ${categories.length} categor${categories.length === 1 ? 'y' : 'ies'}:\n\n`;
      
      for (const category of categories) {
        const count = docStore.getDocumentsByCategory(category).length;
        response += `- **${category}** (${count} document${count === 1 ? '' : 's'})\n`;
      }
      
      response += `\nUse \`list-documents\` with a category parameter to see documents in a specific category.`;
      
      log(`✅ Listed ${categories.length} categories`);
      
      return {
        content: [
          {
            type: 'text',
            text: response
          } as TextContent
        ]
      };
      
    } else if (name === 'refresh-docs') {
      log(`🔄 Refreshing documentation store`);
      
      const beforeCount = docStore.listDocuments().length;
      docStore.refresh();
      const afterCount = docStore.listDocuments().length;
      
      const response = `# Documentation Refreshed\n\n` +
        `Documentation store has been refreshed.\n\n` +
        `**Before:** ${beforeCount} documents  \n` +
        `**After:** ${afterCount} documents  \n\n` +
        `${afterCount > beforeCount ? '✅ New documents loaded' : 
          afterCount < beforeCount ? '⚠️ Some documents removed' : 
          '📄 No changes detected'}`;
      
      log(`✅ Refreshed docs: ${beforeCount} -> ${afterCount}`);
      
      return {
        content: [
          {
            type: 'text',
            text: response
          } as TextContent
        ]
      };
      
    } else if (name === 'pkd-context-provider') {
      log(`🧠 PKD Context Provider called with query: "${args?.query}"`);
      
      const result = await pkdContextProvider.handle(args as any);
      
      log(`✅ PKD Context Provider returned ${result.content.length} content items`);
      if (result.metadata) {
        log(`📊 PKD Metadata: ${JSON.stringify(result.metadata)}`);
      }
      
      return result;
      
    } else if (name === 'pkd-document-stats') {
      log(`📊 PKD Document Stats requested`);
      
      try {
        await pkdDocumentService.loadDocuments();
        const stats = pkdDocumentService.getDocumentStats();
        const searchStats = pkdContextProvider.getSearchStats();
        
        let response = `# PKD Knowledge Base Statistics\n\n`;
        response += `**Total PKD Documents**: ${stats.totalDocuments}\n\n`;
        
        response += `## Document Categories\n`;
        for (const [category, count] of Object.entries(stats.categoriesCount)) {
          response += `- **${category}**: ${count} document${count === 1 ? '' : 's'}\n`;
        }
        
        response += `\n## Difficulty Levels\n`;
        for (const [difficulty, count] of Object.entries(stats.difficultyCount)) {
          response += `- **${difficulty}**: ${count} document${count === 1 ? '' : 's'}\n`;
        }
        
        response += `\n## Top Medical Topics\n`;
        for (const { topic, count } of stats.topTopics) {
          response += `- **${topic}**: ${count} mention${count === 1 ? '' : 's'}\n`;
        }
        
        response += `\n## Available Categories for Context Search\n`;
        for (const category of searchStats.categoriesAvailable) {
          response += `- ${category}\n`;
        }
        
        response += `\n*Use the \`pkd-context-provider\` tool to search for specific PKD medical information.*`;
        
        log(`✅ PKD Stats: ${stats.totalDocuments} documents across ${Object.keys(stats.categoriesCount).length} categories`);
        
        return {
          content: [
            {
              type: 'text',
              text: response
            } as TextContent
          ]
        };
        
      } catch (error) {
        log(`❌ Error getting PKD stats: ${error}`);
        
        return {
          content: [
            {
              type: 'text',
              text: `# PKD Knowledge Base Statistics\n\nError loading PKD document statistics: ${error instanceof Error ? error.message : 'Unknown error'}\n\nPlease ensure PKD documents are available in the \`data/markdown\` directory.`
            } as TextContent
          ]
        };
      }
      
    } else if (name === 'pkd-export-metadata') {
      log(`📁 PKD Export Metadata called with output_path: "${args?.output_path}"`);
      
      try {
        const metadata = await pkdDocumentService.exportDocumentMetadata(args?.output_path as string);
        log(`✅ PKD Metadata exported to: ${metadata}`);
        
        return {
          content: [
            {
              type: 'text',
              text: `# PKD Metadata Exported\n\nPKD document metadata has been successfully exported to: **"${metadata}"**`
            } as TextContent
          ]
        };
      } catch (error) {
        log(`❌ Error exporting PKD metadata: ${error}`);
        
        return {
          content: [
            {
              type: 'text',
              text: `# PKD Metadata Export Error\n\nError exporting PKD document metadata: ${error instanceof Error ? error.message : 'Unknown error'}\n\nPlease ensure PKD documents are available in the \`data/markdown\` directory.`
            } as TextContent
          ]
        };
      }
      
    } else if (name === 'pkd-export-single-document') {
      log(`📁 PKD Export Single Document called with document_id: "${args?.document_id}" and output_path: "${args?.output_path}"`);
      
      try {
        const documentId = args?.document_id as string;
        const outputPath = args?.output_path as string;
        
        if (!documentId) {
          throw new Error('Document ID parameter is required');
        }
        
        // Check if document exists in PKD service first
        const document = await pkdDocumentService.getDocument(documentId);
        
        if (!document) {
          throw new Error(`Document with ID: "${documentId}" not found in the PKD knowledge base.`);
        }
        
        const exportPath = await pkdDocumentService.exportSingleDocument(documentId, outputPath);
        log(`✅ PKD Document exported to: ${exportPath}`);
        
        return {
          content: [
            {
              type: 'text',
              text: `# PKD Document Exported\n\nPKD document with ID: **"${documentId}"** has been successfully exported to: **"${exportPath}"**`
            } as TextContent
          ]
        };
      } catch (error) {
        log(`❌ Error exporting PKD document: ${error}`);
        
        return {
          content: [
            {
              type: 'text',
              text: `# PKD Document Export Error\n\nError exporting PKD document: ${error instanceof Error ? error.message : 'Unknown error'}\n\nPlease ensure PKD documents are available in the \`data/markdown\` directory.`
            } as TextContent
          ]
        };
      }
      
    } else {
      throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error: any) {
    const errorMessage = `Error in tool ${name}: ${error}`;
    log(`❌ ${errorMessage}`);
    throw error;
  }
});

// Start the server
async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  
  log('🚀 Starting PKDED MCP Server v1.0.0 (Documentation + PKD Education Server)');
  log('✅ PKDED MCP Server connected and ready');
  log(`📁 General docs path: ${docStore['docsPath']}`);
  log(`📚 Loaded ${docStore.listDocuments().length} general documents`);
  
  // Initialize PKD education system
  try {
    const pkdDocs = await pkdDocumentService.loadDocuments();
    log(`🧬 PKD Education System initialized`);
    log(`📚 Loaded ${pkdDocs.length} PKD medical documents`);
    
    if (pkdDocs.length > 0) {
      const stats = pkdDocumentService.getDocumentStats();
      log(`📊 PKD Categories: ${Object.keys(stats.categoriesCount).join(', ')}`);
      log(`🏥 PKD System ready for medical context provision`);
    } else {
      log(`⚠️ No PKD documents found. Please add PKD documents to data/markdown/ directory`);
    }
  } catch (error) {
    log(`❌ Error initializing PKD system: ${error}`);
  }
}

main().catch((error: any) => {
  log(`💥 Server startup error: ${error}`);
  process.exit(1);
}); 