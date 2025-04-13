import { Artifact } from './artifacts';

/**
 * Core file entry structure representing a single file in the system
 */
export interface FileEntry {
  id: string;                 // Unique identifier (UUID v4)
  name: string;               // Original filename
  path: string;               // Relative storage path
  mimeType: string;           // File type
  size: number;               // File size in bytes
  hash: {                     // Content hash
    algorithm: "sha256" | "sha512";
    value: string;
  };
  status: "active" | "deleted" | "archived";
  owner: string;              // Owner identifier
  created: Date;              // Creation timestamp
  modified: Date;             // Last modified timestamp
  lastAccessed: Date;         // Last accessed timestamp
  tags: string[];             // Required searchable tags
  llmNotes: string;           // Notes for LLM understanding
  metadata: FileMetadata;     // Additional metadata
  artifact?: Artifact;        // Associated artifact if any
}

/**
 * Schema information for data files
 */
export interface SchemaInfo {
  type: "tabular" | "json";  // Limited to tabular and JSON
  format: string;            // File format (e.g., "csv", "parquet", "json")
  encoding: string;          // File encoding (default: "utf-8")
  sampleData: string;        // Representative sample for LLM analysis
  
  // For tabular data
  tabular?: {
    rowCount: number;
    columns: Array<{
      name: string;
      type: string;          // Data type
      nullable: boolean;
      description?: string;  // Column description for LLM
      sample?: string[];     // Sample values for LLM understanding
    }>;
    hasHeader: boolean;
    delimiter?: string;      // For CSV-like files
  };
  
  // For JSON data
  json?: {
    rootType: "object" | "array";
    schema: object;          // JSON schema
    keyPaths: string[];      // Available key paths
    sampleKeys: {           // Sample key-value pairs for LLM
      path: string;
      samples: string[];
    }[];
  };
}

/**
 * Primary metadata structure for file entries
 */
export interface FileMetadata {
  description: string;        // Required description
  schema: SchemaInfo;        // Schema information (required)
  origin: {                  // Required origin information
    type: "upload" | "derived";
    sourceId?: string;       // Parent file ID if derived
    operation?: OperationType; // Operation that created this file
    parameters?: Record<string, unknown>; // Operation parameters
    timestamp: Date;         // When the operation occurred
  };
  version: {                // Required version information
    major: number;          // Major version
    minor: number;          // Minor version
    patch: number;          // Patch version
    branch: {              // Branch information
      name: string;        // Branch name
      parent: string;      // Parent branch name
      created: Date;       // Branch creation date
      description: string; // Branch purpose
    };
    history: Array<{       // Version history
      id: string;          // Version identifier
      timestamp: Date;     // Version timestamp
      message: string;     // Version message
      user: string;        // User who created version
      branch: string;      // Branch name
      parent: string;      // Parent version ID
    }>;
  };
  analysisInfo: {           // Required analysis information
    rowCount?: number;      // For tabular data
    summary: {              // Statistical or structural summary
      numeric?: Record<string, {
        min: number;
        max: number;
        mean: number;
        nullCount: number;
      }>;
      categorical?: Record<string, {
        uniqueCount: number;
        topValues: string[];
        nullCount: number;
      }>;
    };
    quality: {              // Data quality metrics
      nullCount: number;
      duplicateCount: number;
      errorCount: number;
      completeness: number; // Percentage of non-null values
    };
  };
  textExtraction?: {        // Text extraction information
    status: 'pending' | 'completed' | 'failed';
    error?: string;         // Error message if extraction failed
    content?: string;       // Extracted text content
    format: string;         // Original file format (pdf, docx, etc.)
    extractedAt?: Date;     // When the text was extracted
    metadata?: {            // Format-specific metadata
      pageCount?: number;   // For PDFs
      wordCount?: number;   // For text-based documents
      charCount?: number;   // For text-based documents
    };
  };
  lastAccessed?: Date;      // Last accessed timestamp
  status?: "active" | "deleted" | "archived"; // File status
}

/**
 * Supported operation types
 */
export type OperationType = 
  | "transform"             // Data transformation
  | "aggregate"             // Data aggregation
  | "filter"               // Data filtering
  | "merge"                // Data merging
  | "split"                // Data splitting
  | "clean"                // Data cleaning
  | "analyze"              // Data analysis
  | "branch"               // Branch creation
  | "custom";              // Custom operation

/**
 * Operation metadata structure
 */
export interface OperationMetadata {
  type: OperationType;
  description: string;
  parameters: Record<string, unknown>;
  timestamp: Date;
  user: string;
  llmNotes?: string;       // Notes for LLM about the operation
  status: "pending" | "running" | "completed" | "failed";
  duration?: number;       // Operation duration in milliseconds
  resources?: {
    memoryUsage: number;
    cpuUsage: number;
  };
}

/**
 * Branch information structure
 */
export interface BranchInfo {
  name: string;            // Branch name
  created: Date;           // Creation timestamp
  creator: string;         // User who created the branch
  description: string;     // Branch purpose
  parent: {               // Parent branch information
    name: string;         // Parent branch name
    version: string;      // Parent version ID at branch point
  };
  status: "active" | "merged" | "abandoned";
  tags: string[];         // Branch-specific tags
  llmNotes: string;      // Notes for LLM about branch purpose
}

/**
 * Supported relationship types between files
 */
export type RelationType = 
  | "parent"           // Parent-child relationship (e.g., source file -> derived file)
  | "reference"        // File references another file
  | "version"          // Version relationship
  | "dependency"       // File depends on another file
  | "composition"      // File is composed of other files
  | "custom";          // Custom relationship type

/**
 * Relationship metadata structure
 */
export interface RelationshipMetadata {
  type: RelationType;
  description: string;
  properties?: Record<string, unknown>;
  created: Date;
  creator: string;
  llmNotes?: string;        // Notes for LLM about the relationship
}

/**
 * File relationship structure
 */
export interface FileRelationship {
  id: string;               // Unique identifier for the relationship
  sourceId: string;         // ID of the source file
  targetId: string;         // ID of the target file
  metadata: RelationshipMetadata;
  status: "active" | "deleted";
  created: Date;
  modified: Date;
} 