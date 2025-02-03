import { BaseStorageService } from './BaseStorageService';
import { 
    FileEntry, 
    FileMetadata, 
    BranchInfo, 
    OperationType,
    SchemaInfo 
} from '../../types/fileManagement';

export class APIStorageService extends BaseStorageService {
    private readonly baseUrl: string;

    constructor(baseUrl: string = '/api/storage') {
        super();
        this.baseUrl = baseUrl;
    }

    protected async writeContent(id: string, content: Uint8Array, metadata?: Partial<FileMetadata>): Promise<void> {
        const formData = new FormData();
        const blob = new Blob([content], { type: metadata?.schema?.format || 'application/octet-stream' });
        
        // Create a file with the original name
        const fileName = metadata?.description || 'unknown';
        const file = new File([blob], fileName, { type: blob.type });
        formData.append('file', file);
        
        // Add metadata
        formData.append('metadata', JSON.stringify({
            description: metadata?.description || fileName,
            schema: {
                type: 'json',
                format: blob.type || 'application/octet-stream',
                encoding: 'utf-8',
                sampleData: ''
            },
            ...metadata
        }));
        
        // Use POST for initial file creation
        await fetch(`${this.baseUrl}/files`, {
            method: 'POST',
            body: formData
        });
    }

    protected async readContent(id: string): Promise<Uint8Array> {
        const response = await fetch(`${this.baseUrl}/files/${id}/content`);
        const blob = await response.blob();
        return new Uint8Array(await blob.arrayBuffer());
    }

    protected async deleteContent(id: string): Promise<void> {
        await fetch(`${this.baseUrl}/files/${id}`, {
            method: 'DELETE'
        });
    }

    protected async storeMetadata(id: string, metadata: FileMetadata): Promise<void> {
        await fetch(`${this.baseUrl}/files/${id}/metadata`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(metadata)
        });
    }

    protected async retrieveMetadata(id: string): Promise<FileMetadata> {
        const response = await fetch(`${this.baseUrl}/files/${id}/metadata`);
        return response.json();
    }

    protected async retrieveFileEntry(id: string): Promise<FileEntry> {
        const response = await fetch(`${this.baseUrl}/files/${id}/metadata`);
        return response.json();
    }

    protected async queryFiles(query: any): Promise<FileEntry[]> {
        const params = new URLSearchParams(query);
        const response = await fetch(`${this.baseUrl}/files?${params}`);
        return response.json();
    }

    async listFiles(options?: {
        status?: FileEntry['status'];
        tags?: string[];
        owner?: string;
        type?: string;
        branch?: string;
    }): Promise<FileEntry[]> {
        const params = new URLSearchParams();
        if (options) {
            if (options.status) params.append('status', options.status);
            if (options.owner) params.append('owner', options.owner);
            if (options.type) params.append('type', options.type);
            if (options.branch) params.append('branch', options.branch);
            if (options.tags) options.tags.forEach(tag => params.append('tags', tag));
        }
        const response = await fetch(`${this.baseUrl}/files?${params}`);
        return response.json();
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
        const response = await fetch(`${this.baseUrl}/files/search`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(query)
        });
        return response.json();
    }

    // Phase 2: Relationship Operations
    async addRelationship(sourceId: string, targetId: string, type: string): Promise<void> {
        await fetch(`${this.baseUrl}/files/${sourceId}/relationships`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ targetId, type })
        });
    }

    async removeRelationship(sourceId: string, targetId: string, type: string): Promise<void> {
        await fetch(`${this.baseUrl}/files/${sourceId}/relationships/${targetId}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ type })
        });
    }

    async getRelatedFiles(id: string, type?: string): Promise<FileEntry[]> {
        const params = new URLSearchParams();
        if (type) params.append('type', type);
        const response = await fetch(`${this.baseUrl}/files/${id}/relationships?${params}`);
        return response.json();
    }

    // Phase 3: Version Control Operations
    async createBranch(params: {
        name: string;
        parentBranch: string;
        description: string;
        tags?: string[];
    }): Promise<BranchInfo> {
        const response = await fetch(`${this.baseUrl}/branches`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(params)
        });
        return response.json();
    }

    async mergeBranch(params: {
        source: string;
        target: string;
        strategy: 'fast-forward' | 'recursive' | 'ours' | 'theirs';
    }): Promise<void> {
        await fetch(`${this.baseUrl}/branches/merge`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(params)
        });
    }

    async getBranchHistory(branchName: string): Promise<BranchInfo> {
        const response = await fetch(`${this.baseUrl}/branches/${branchName}/history`);
        return response.json();
    }

    // Phase 4: Advanced Operations
    async performOperation(params: {
        type: OperationType;
        sourceId: string;
        parameters: Record<string, unknown>;
        description: string;
    }): Promise<FileEntry> {
        const response = await fetch(`${this.baseUrl}/files/${params.sourceId}/operations`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(params)
        });
        return response.json();
    }

    async analyzeFile(id: string): Promise<FileMetadata['analysisInfo']> {
        const response = await fetch(`${this.baseUrl}/files/${id}/analyze`);
        return response.json();
    }

    async validateFile(id: string, schema?: SchemaInfo): Promise<{
        isValid: boolean;
        errors: Array<{
            path: string;
            message: string;
        }>;
    }> {
        const response = await fetch(`${this.baseUrl}/files/${id}/validate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ schema })
        });
        return response.json();
    }

    async getStorageStats(): Promise<{
        totalFiles: number;
        totalSize: number;
        filesByType: Record<string, number>;
        filesByStatus: Record<FileEntry['status'], number>;
    }> {
        const response = await fetch(`${this.baseUrl}/stats`);
        return response.json();
    }

    // Implement other abstract methods as needed...
} 