import { FileEntry, FileMetadata, OperationType, BranchInfo, SchemaInfo } from '../../types/fileManagement';

/**
 * Interface defining core storage operations for the file management system
 */
export interface IStorageService {
  // Basic File Operations
  createFile(content: Uint8Array | string, metadata: Partial<FileMetadata>): Promise<FileEntry>;
  readFile(id: string): Promise<{ content: Uint8Array; entry: FileEntry }>;
  updateFile(id: string, content: Uint8Array | string, metadata?: Partial<FileMetadata>): Promise<FileEntry>;
  deleteFile(id: string): Promise<void>;
  
  // Metadata Operations
  getMetadata(id: string): Promise<FileMetadata>;
  updateMetadata(id: string, metadata: Partial<FileMetadata>): Promise<FileMetadata>;
  
  // Query Operations
  listFiles(options?: {
    status?: FileEntry['status'];
    tags?: string[];
    owner?: string;
    type?: string;
    branch?: string;
  }): Promise<FileEntry[]>;
  
  searchFiles(query: {
    text?: string;
    tags?: string[];
    metadata?: Partial<FileMetadata>;
    dateRange?: {
      start: Date;
      end: Date;
    };
  }): Promise<FileEntry[]>;
  
  // Version Control Operations
  createBranch(params: {
    name: string;
    parentBranch: string;
    description: string;
    tags?: string[];
  }): Promise<BranchInfo>;
  
  mergeBranch(params: {
    source: string;
    target: string;
    strategy: 'fast-forward' | 'recursive' | 'ours' | 'theirs';
  }): Promise<void>;
  
  getBranchHistory(branchName: string): Promise<BranchInfo>;
  
  // File Operations
  performOperation(params: {
    type: OperationType;
    sourceId: string;
    parameters: Record<string, unknown>;
    description: string;
  }): Promise<FileEntry>;
  
  // Relationship Operations
  addRelationship(sourceId: string, targetId: string, type: string): Promise<void>;
  removeRelationship(sourceId: string, targetId: string, type: string): Promise<void>;
  getRelatedFiles(id: string, type?: string): Promise<FileEntry[]>;
  
  // Analysis Operations
  analyzeFile(id: string): Promise<FileMetadata['analysisInfo']>;
  validateFile(id: string, schema?: SchemaInfo): Promise<{
    isValid: boolean;
    errors: Array<{
      path: string;
      message: string;
    }>;
  }>;
  
  // Utility Operations
  generateHash(content: Uint8Array, algorithm: 'sha256' | 'sha512'): Promise<string>;
  getStorageStats(): Promise<{
    totalFiles: number;
    totalSize: number;
    filesByType: Record<string, number>;
    filesByStatus: Record<FileEntry['status'], number>;
  }>;
} 