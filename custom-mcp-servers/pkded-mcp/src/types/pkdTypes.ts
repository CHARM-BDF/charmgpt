// PKD Education MCP Types
// Type definitions for PKD documents, chunks, and search functionality

export interface Citation {
  pmid?: string;
  doi?: string;
  url?: string;
  title: string;
  authors: string[];
  journal?: string;
  year?: number;
}

export interface PKDDocument {
  id: string;
  title: string;
  content: string;
  filePath: string;
  category: 'diagnosis' | 'treatment' | 'genetics' | 'lifestyle' | 'research' | 'complications';
  medicalTopic: string[];
  difficulty: 'basic' | 'intermediate' | 'advanced';
  lastModified: Date;
  citations?: Citation[];
  tags: string[];
}

export interface PKDChunk {
  id: string;
  documentId: string;
  content: string;
  section: string;
  subsection?: string;
  startLine: number;
  endLine: number;
  tokenCount: number;
  medicalConcepts: string[];
  category: PKDDocument['category'];
  difficulty: PKDDocument['difficulty'];
  embedding?: number[];
}

export interface EmbeddedChunk extends PKDChunk {
  embedding: number[];
}

export interface SearchResult {
  chunk: PKDChunk;
  score: number;
  relevanceReason?: string;
}

export interface RankedResult extends SearchResult {
  boostedScore: number;
  medicalTermMatches: string[];
  contextRelevance: number;
}

export interface RetrievalOptions {
  contextType?: 'diagnosis' | 'treatment' | 'genetics' | 'general';
  maxResults: number;
  minRelevanceScore: number;
  preferredDifficulty?: 'basic' | 'intermediate' | 'advanced';
  includeRelatedConcepts?: boolean;
}

export interface PKDResponse {
  contextText: string;
  chunksUsed: number;
  avgRelevanceScore: number;
  topicsConvered: string[];
  medicalConcepts: string[];
  responseTime: number;
  accuracy?: number;
}

export interface PKDKnowledgeGraph {
  nodes: Array<{
    id: string;
    label: string;
    type: 'symptom' | 'treatment' | 'gene' | 'complication' | 'diagnosis' | 'lifestyle';
    description: string;
    severity?: 'low' | 'medium' | 'high';
    category: PKDDocument['category'];
  }>;
  links: Array<{
    source: string;
    target: string;
    relationship: 'causes' | 'treats' | 'diagnoses' | 'related_to' | 'prevents' | 'increases_risk';
    strength: number;
    evidence?: string;
  }>;
}

export interface PKDMetrics {
  queriesProcessed: number;
  contextsRetrieved: number;
  avgContextRelevance: number;
  topMedicalTopics: string[];
  responseQualityRating: number;
  cacheHitRate: number;
  avgResponseTime: number;
}

// Configuration types
export interface EmbeddingConfig {
  provider: 'openai' | 'local';
  model: string;
  batchSize: number;
  cacheEnabled: boolean;
  cacheTTL: number;
}

export interface VectorStoreConfig {
  provider: 'qdrant' | 'faiss';
  url?: string;
  collection: string;
  searchLimit: number;
  minScore: number;
}

export interface PKDConfig {
  embedding: EmbeddingConfig;
  vectorStore: VectorStoreConfig;
  performance: {
    maxConcurrentQueries: number;
    queryTimeout: number;
    enableMetrics: boolean;
  };
} 