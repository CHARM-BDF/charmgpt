import { v4 as uuidv4 } from 'uuid';
import {
    FileEntry,
    FileMetadata,
    OperationType,
    BranchInfo,
    SchemaInfo
} from '@charm-mcp/shared';
import { IStorageService } from './IStorageService';

/**
 * Abstract base class providing common functionality for storage implementations.
 * This class implements the core logic while leaving storage-specific operations
 * to concrete implementations.
 * 
 * Implementation follows a phased approach:
 * Phase 1: Core Storage - Basic file operations and metadata management
 * Phase 2: Relationships - File relationships and graph structure
 * Phase 3: Versioning - Branch management and version control
 * Phase 4: Advanced Features - Analysis, validation, and operations
 */
export abstract class BaseStorageService implements IStorageService {
    // =============================================
    // Phase 1: Core Abstract Methods
    // Status: Required Implementation
    // These methods must be implemented by storage backends
    // to provide basic storage functionality
    // =============================================
    
    protected abstract writeContent(id: string, content: Uint8Array, metadata: FileMetadata): Promise<string>;
    protected abstract readContent(id: string): Promise<Uint8Array>;
    protected abstract deleteContent(id: string): Promise<void>;
    protected abstract storeMetadata(id: string, metadata: FileMetadata): Promise<void>;
    protected abstract retrieveMetadata(id: string): Promise<FileMetadata>;
    protected abstract retrieveFileEntry(id: string): Promise<FileEntry>;
    protected abstract queryFiles(query: any): Promise<FileEntry[]>;

    // =============================================
    // Phase 1: Core Operations Implementation
    // Status: Implemented
    // These methods provide the common implementation
    // of core file operations
    // =============================================

    async createFile(content: Uint8Array | string, metadata: Partial<FileMetadata>): Promise<FileEntry> {
        const id = uuidv4();
        const contentArray = typeof content === 'string' ? new TextEncoder().encode(content) : content;

        const hash = await this.generateHash(contentArray, 'sha256');
        const timestamp = new Date();

        const fileMetadata = await this.initializeMetadata(metadata);

        const entry: FileEntry = {
            id,
            name: metadata.description || 'unknown',
            path: `/${id}`, // Implement proper path generation
            mimeType: metadata.schema?.format || 'application/octet-stream',
            size: contentArray.byteLength,
            hash: {
                algorithm: 'sha256',
                value: hash
            },
            status: 'active',
            owner: 'system', // Should come from auth context
            created: timestamp,
            modified: timestamp,
            lastAccessed: timestamp,
            tags: [],
            llmNotes: '',
            metadata: fileMetadata
        };

        const newId = await this.writeContent(id, contentArray, fileMetadata);
        entry.id = newId; // Use the ID returned from the server
        await this.storeMetadata(newId, entry.metadata);

        return entry;
    }

    async readFile(id: string): Promise<{ content: Uint8Array; entry: FileEntry }> {
        const content = await this.readContent(id);
        const entry = await this.retrieveFileEntry(id);

        // Update last accessed timestamp
        const updatedEntry = await this.updateFile(id, content, {
            ...entry.metadata,
            lastAccessed: new Date()
        });

        return { content, entry: updatedEntry };
    }

    async updateFile(
        id: string,
        content: Uint8Array | string,
        metadata?: Partial<FileMetadata>
    ): Promise<FileEntry> {
        const contentArray = typeof content === 'string' ? new TextEncoder().encode(content) : content;
        const hash = await this.generateHash(contentArray, 'sha256');
        const timestamp = new Date();

        const currentEntry = await this.retrieveFileEntry(id);
        const updatedMetadata = metadata ?
            await this.mergeMetadata(currentEntry.metadata, metadata) :
            currentEntry.metadata;

        const entry: FileEntry = {
            ...currentEntry,
            size: contentArray.byteLength,
            hash: {
                algorithm: 'sha256',
                value: hash
            },
            modified: timestamp,
            lastAccessed: timestamp,
            metadata: updatedMetadata
        };

        await this.writeContent(id, contentArray, updatedMetadata);
        await this.storeMetadata(id, entry.metadata);

        return entry;
    }

    async deleteFile(id: string): Promise<void> {
        // Soft delete - update status
        const entry = await this.retrieveFileEntry(id);
        await this.updateFile(id, await this.readContent(id), {
            ...entry.metadata,
            status: 'deleted' as const
        });
    }

    // =============================================
    // Phase 1: Metadata Management
    // Status: Implemented
    // These methods handle metadata operations and updates
    // =============================================

    async getMetadata(id: string): Promise<FileMetadata> {
        return this.retrieveMetadata(id);
    }

    async updateMetadata(id: string, metadata: Partial<FileMetadata>): Promise<FileMetadata> {
        const current = await this.retrieveMetadata(id);
        const updated = await this.mergeMetadata(current, metadata);
        await this.storeMetadata(id, updated);
        return updated;
    }

    // =============================================
    // Phase 1: Utility Methods
    // Status: Implemented
    // Core utility functions for file operations
    // =============================================

    async generateHash(content: Uint8Array, algorithm: 'sha256' | 'sha512'): Promise<string> {
        // Use Web Crypto API
        const hashBuffer = await crypto.subtle.digest(
            algorithm === 'sha256' ? 'SHA-256' : 'SHA-512',
            content
        );

        // Convert hash to hex string
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        return hashHex;
    }

    // =============================================
    // Phase 1: Helper Methods
    // Status: Implemented
    // Internal methods for metadata management
    // =============================================

    protected async initializeMetadata(partial: Partial<FileMetadata>): Promise<FileMetadata> {
        const timestamp = new Date();

        return {
            description: partial.description || '',
            schema: partial.schema || {
                type: 'json',
                format: 'json',
                encoding: 'utf-8',
                sampleData: ''
            },
            origin: {
                type: 'upload',
                timestamp
            },
            version: {
                major: 1,
                minor: 0,
                patch: 0,
                branch: {
                    name: 'main',
                    parent: '',
                    created: timestamp,
                    description: 'Initial version'
                },
                history: [{
                    id: uuidv4(),
                    timestamp,
                    message: 'Initial creation',
                    user: 'system',
                    branch: 'main',
                    parent: ''
                }]
            },
            analysisInfo: {
                summary: {},
                quality: {
                    nullCount: 0,
                    duplicateCount: 0,
                    errorCount: 0,
                    completeness: 100
                }
            },
            ...partial
        };
    }

    protected async mergeMetadata(
        current: FileMetadata,
        updates: Partial<FileMetadata>
    ): Promise<FileMetadata> {
        return {
            ...current,
            ...updates,
            version: {
                ...current.version,
                ...updates.version,
                history: [
                    ...current.version.history,
                    {
                        id: uuidv4(),
                        timestamp: new Date(),
                        message: 'Metadata update',
                        user: 'system',
                        branch: current.version.branch.name,
                        parent: current.version.history[current.version.history.length - 1].id
                    }
                ]
            }
        };
    }

    // =============================================
    // Abstract Methods for Future Phases
    // These methods must be implemented by concrete classes
    // according to their respective phases
    // =============================================

    // Phase 1: Query Operations
    abstract listFiles(options?: {
        status?: FileEntry['status'];
        tags?: string[];
        owner?: string;
        type?: string;
        branch?: string;
    }): Promise<FileEntry[]>;

    abstract searchFiles(query: {
        text?: string;
        tags?: string[];
        metadata?: Partial<FileMetadata>;
        dateRange?: {
            start: Date;
            end: Date;
        };
    }): Promise<FileEntry[]>;

    // Phase 2: Relationship Operations
    abstract addRelationship(sourceId: string, targetId: string, type: string): Promise<void>;
    abstract removeRelationship(sourceId: string, targetId: string, type: string): Promise<void>;
    abstract getRelatedFiles(id: string, type?: string): Promise<FileEntry[]>;

    // Phase 3: Version Control Operations
    abstract createBranch(params: {
        name: string;
        parentBranch: string;
        description: string;
        tags?: string[];
    }): Promise<BranchInfo>;

    abstract mergeBranch(params: {
        source: string;
        target: string;
        strategy: 'fast-forward' | 'recursive' | 'ours' | 'theirs';
    }): Promise<void>;

    abstract getBranchHistory(branchName: string): Promise<BranchInfo>;

    // Phase 4: Advanced Operations
    abstract performOperation(params: {
        type: OperationType;
        sourceId: string;
        parameters: Record<string, unknown>;
        description: string;
    }): Promise<FileEntry>;

    abstract analyzeFile(id: string): Promise<FileMetadata['analysisInfo']>;
    abstract validateFile(id: string, schema?: SchemaInfo): Promise<{
        isValid: boolean;
        errors: Array<{
            path: string;
            message: string;
        }>;
    }>;

    abstract getStorageStats(): Promise<{
        totalFiles: number;
        totalSize: number;
        filesByType: Record<string, number>;
        filesByStatus: Record<FileEntry['status'], number>;
    }>;
} 