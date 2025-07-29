import fs from 'fs/promises';
import path from 'path';
import { 
  FileEntry, 
  FileMetadata, 
  OperationType, 
  BranchInfo,
  SchemaInfo,
  FileRelationship,
  RelationType,
  RelationshipMetadata
} from '../../types/fileManagement';
import { BaseStorageService } from './BaseStorageService';
import { v4 as uuidv4 } from 'uuid';

/**
 * File system implementation of the storage service.
 * Implementation follows a phased approach:
 * Phase 1: Core Storage - Basic file operations and metadata management
 * Phase 2: Relationships - File relationships and graph structure
 * Phase 3: Versioning - Branch management and version control
 * Phase 4: Advanced Features - Analysis, validation, and operations
 */
export class FileSystemStorageService extends BaseStorageService {
  private readonly baseDir: string;
  private readonly contentDir: string;
  private readonly metadataDir: string;
  private readonly relationshipsDir: string;

  constructor(baseDir: string) {
    super();
    this.baseDir = baseDir;
    this.contentDir = path.join(baseDir, 'content');
    this.metadataDir = path.join(baseDir, 'metadata');
    this.relationshipsDir = path.join(baseDir, 'relationships');
    this.initializeDirectories();
  }

  // =============================================
  // Phase 1: Core Storage Implementation
  // Status: Implemented
  // These methods handle basic file operations
  // =============================================

  private async initializeDirectories() {
    await fs.mkdir(this.baseDir, { recursive: true });
    await fs.mkdir(this.contentDir, { recursive: true });
    await fs.mkdir(this.metadataDir, { recursive: true });
    await fs.mkdir(this.relationshipsDir, { recursive: true });
  }

  protected async writeContent(id: string, content: Buffer): Promise<string> {
    const filePath = path.join(this.contentDir, id);
    await fs.writeFile(filePath, content);
    return id;
  }

  protected async readContent(id: string): Promise<Buffer> {
    const filePath = path.join(this.contentDir, id);
    return fs.readFile(filePath);
  }

  protected async deleteContent(id: string): Promise<void> {
    const filePath = path.join(this.contentDir, id);
    await fs.unlink(filePath);
  }

  protected async storeMetadata(id: string, metadata: FileMetadata): Promise<void> {
    const filePath = path.join(this.metadataDir, `${id}.json`);
    await fs.writeFile(filePath, JSON.stringify(metadata, null, 2));
  }

  protected async retrieveMetadata(id: string): Promise<FileMetadata> {
    const filePath = path.join(this.metadataDir, `${id}.json`);
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content);
  }

  protected async retrieveFileEntry(id: string): Promise<FileEntry> {
    const metadata = await this.retrieveMetadata(id);
    const stats = await fs.stat(path.join(this.contentDir, id));

    return {
      id,
      name: metadata.schema.format || 'unknown',
      path: `/${id}`,
      mimeType: metadata.schema.format || 'application/octet-stream',
      size: stats.size,
      hash: {
        algorithm: 'sha256',
        value: '' // Would need to compute hash
      },
      status: metadata.status || 'active',
      owner: 'system',
      created: stats.birthtime,
      modified: stats.mtime,
      lastAccessed: stats.atime,
      tags: [],
      llmNotes: '',
      metadata
    };
  }

  // =============================================
  // Phase 1: Query and Search Implementation
  // Status: Implemented
  // These methods provide file discovery and search
  // =============================================

  protected async queryFiles(query: any): Promise<FileEntry[]> {
    // This is a basic implementation that delegates to searchFiles
    // In a real implementation, this would be optimized for the specific query type
    return this.searchFiles(query);
  }

  async listFiles(options?: {
    status?: FileEntry['status'];
    tags?: string[];
    owner?: string;
    type?: string;
    branch?: string;
  }): Promise<FileEntry[]> {
    const files = await fs.readdir(this.metadataDir);
    const entries: FileEntry[] = [];

    for (const file of files) {
      if (file.endsWith('.json')) {
        const id = file.replace('.json', '');
        const entry = await this.retrieveFileEntry(id);

        if (this.matchesOptions(entry, options)) {
          entries.push(entry);
        }
      }
    }

    return entries;
  }

  private matchesOptions(entry: FileEntry, options?: {
    status?: FileEntry['status'];
    tags?: string[];
    owner?: string;
    type?: string;
    branch?: string;
  }): boolean {
    if (!options) return true;

    if (options.status && entry.status !== options.status) return false;
    if (options.owner && entry.owner !== options.owner) return false;
    if (options.type && entry.mimeType !== options.type) return false;
    if (options.branch && entry.metadata.version.branch.name !== options.branch) return false;
    if (options.tags && options.tags.length > 0) {
      if (!options.tags.every(tag => entry.tags.includes(tag))) return false;
    }

    return true;
  }

  async searchFiles(query: {
    text?: string;
    tags?: string[];
    metadata?: Partial<FileMetadata>;
    dateRange?: {
      start: Date;
      end: Date;
    };
  }): Promise<FileEntry[]> {
    const allFiles = await this.listFiles();
    return allFiles.filter(entry => this.matchesSearch(entry, query));
  }

  private matchesSearch(entry: FileEntry, query: {
    text?: string;
    tags?: string[];
    metadata?: Partial<FileMetadata>;
    dateRange?: {
      start: Date;
      end: Date;
    };
  }): boolean {
    if (query.text) {
      const searchText = query.text.toLowerCase();
      const searchableText = [
        entry.name,
        entry.metadata.description,
        entry.llmNotes,
        ...entry.tags
      ].join(' ').toLowerCase();

      if (!searchableText.includes(searchText)) return false;
    }

    if (query.tags && !query.tags.every(tag => entry.tags.includes(tag))) {
      return false;
    }

    if (query.dateRange) {
      const modified = new Date(entry.modified);
      if (modified < query.dateRange.start || modified > query.dateRange.end) {
        return false;
      }
    }

    return true;
  }

  // =============================================
  // Phase 2: Relationship Storage Implementation
  // Status: In Progress
  // These methods handle relationship storage and retrieval
  // =============================================

  private async storeRelationship(relationship: FileRelationship): Promise<void> {
    const filePath = path.join(this.relationshipsDir, `${relationship.id}.json`);
    await fs.writeFile(filePath, JSON.stringify(relationship, null, 2));
  }

  private async retrieveRelationship(id: string): Promise<FileRelationship> {
    const filePath = path.join(this.relationshipsDir, `${id}.json`);
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content);
  }

  private async listRelationships(fileId: string, type?: RelationType): Promise<FileRelationship[]> {
    const files = await fs.readdir(this.relationshipsDir);
    const relationships: FileRelationship[] = [];

    for (const file of files) {
      if (file.endsWith('.json')) {
        const relationship = await this.retrieveRelationship(file.replace('.json', ''));
        if (relationship.status === 'active' &&
            (relationship.sourceId === fileId || relationship.targetId === fileId)) {
          if (!type || relationship.metadata.type === type) {
            relationships.push(relationship);
          }
        }
      }
    }

    return relationships;
  }

  // =============================================
  // Phase 2: Relationship Operations Implementation
  // Status: In Progress
  // These methods implement the relationship operations
  // =============================================

  async addRelationship(sourceId: string, targetId: string, type: RelationType): Promise<void> {
    // Verify both files exist
    await this.retrieveFileEntry(sourceId);
    await this.retrieveFileEntry(targetId);

    const relationship: FileRelationship = {
      id: uuidv4(),
      sourceId,
      targetId,
      metadata: {
        type,
        description: `${type} relationship from ${sourceId} to ${targetId}`,
        created: new Date(),
        creator: 'system'
      },
      status: 'active',
      created: new Date(),
      modified: new Date()
    };

    await this.storeRelationship(relationship);
  }

  async removeRelationship(sourceId: string, targetId: string, type: RelationType): Promise<void> {
    const relationships = await this.listRelationships(sourceId, type);
    const relationship = relationships.find(r => 
      r.sourceId === sourceId && 
      r.targetId === targetId && 
      r.metadata.type === type
    );

    if (relationship) {
      relationship.status = 'deleted';
      relationship.modified = new Date();
      await this.storeRelationship(relationship);
    }
  }

  async getRelatedFiles(id: string, type?: RelationType): Promise<FileEntry[]> {
    const relationships = await this.listRelationships(id, type);
    const relatedIds = relationships.map(r => 
      r.sourceId === id ? r.targetId : r.sourceId
    );

    const entries: FileEntry[] = [];
    for (const relatedId of relatedIds) {
      try {
        const entry = await this.retrieveFileEntry(relatedId);
        entries.push(entry);
      } catch (error) {
        // Skip entries that can't be retrieved
        console.warn(`Could not retrieve related file ${relatedId}`);
      }
    }

    return entries;
  }

  // =============================================
  // Phase 3: Version Control
  // Status: Planned
  // These methods will implement branching and
  // version management capabilities
  // =============================================

  async createBranch(params: {
    name: string;
    parentBranch: string;
    description: string;
    tags?: string[];
  }): Promise<BranchInfo> {
    throw new Error('Method not implemented.');
  }

  async mergeBranch(params: {
    source: string;
    target: string;
    strategy: 'fast-forward' | 'recursive' | 'ours' | 'theirs';
  }): Promise<void> {
    throw new Error('Method not implemented.');
  }

  async getBranchHistory(branchName: string): Promise<BranchInfo> {
    throw new Error('Method not implemented.');
  }

  // =============================================
  // Phase 4: Advanced Features
  // Status: Planned
  // These methods will implement data analysis,
  // validation, and transformation capabilities
  // =============================================

  async performOperation(params: {
    type: OperationType;
    sourceId: string;
    parameters: Record<string, unknown>;
    description: string;
  }): Promise<FileEntry> {
    throw new Error('Method not implemented.');
  }

  async analyzeFile(id: string): Promise<FileMetadata['analysisInfo']> {
    throw new Error('Method not implemented.');
  }

  async validateFile(id: string, schema?: SchemaInfo): Promise<{
    isValid: boolean;
    errors: Array<{
      path: string;
      message: string;
    }>;
  }> {
    throw new Error('Method not implemented.');
  }

  // =============================================
  // Utility Features
  // Status: Partially Implemented
  // These methods provide system-wide utilities
  // =============================================

  async getStorageStats(): Promise<{
    totalFiles: number;
    totalSize: number;
    filesByType: Record<string, number>;
    filesByStatus: Record<FileEntry['status'], number>;
  }> {
    const files = await this.listFiles();
    const stats = {
      totalFiles: files.length,
      totalSize: 0,
      filesByType: {} as Record<string, number>,
      filesByStatus: {
        active: 0,
        deleted: 0,
        archived: 0
      } as Record<FileEntry['status'], number>
    };

    for (const file of files) {
      stats.totalSize += file.size;
      stats.filesByType[file.mimeType] = (stats.filesByType[file.mimeType] || 0) + 1;
      stats.filesByStatus[file.status] = (stats.filesByStatus[file.status] || 0) + 1;
    }

    return stats;
  }
} 