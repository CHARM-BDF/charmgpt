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
        console.log('[APIStorageService] Initialized with baseUrl:', baseUrl);
    }

    protected async writeContent(id: string, content: Uint8Array, metadata?: Partial<FileMetadata>): Promise<string> {
        console.log('[APIStorageService] writeContent called with:', {
            id,
            contentLength: content.length,
            metadata: metadata ? JSON.stringify(metadata) : 'undefined'
        });

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

        console.log('[APIStorageService] Making POST request to:', `${this.baseUrl}/files`);
        
        try {
            const response = await fetch(`${this.baseUrl}/files`, {
                method: 'POST',
                body: formData
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('[APIStorageService] File upload failed:', {
                    status: response.status,
                    statusText: response.statusText,
                    error: errorText
                });
                throw new Error(`File upload failed: ${response.status} ${response.statusText}`);
            }
            
            const { id: newId } = await response.json();
            console.log('[APIStorageService] File upload successful, got ID:', newId);
            return newId;
        } catch (error) {
            console.error('[APIStorageService] Network error during file upload:', error);
            throw error;
        }
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
        console.log('[APIStorageService] storeMetadata called with:', {
            id,
            metadata: JSON.stringify(metadata)
        });

        console.log('[APIStorageService] Making PUT request to:', `${this.baseUrl}/files/${id}/metadata`);
        
        try {
            const response = await fetch(`${this.baseUrl}/files/${id}/metadata`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(metadata)
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('[APIStorageService] Metadata update failed:', {
                    status: response.status,
                    statusText: response.statusText,
                    error: errorText
                });
                throw new Error(`Metadata update failed: ${response.status} ${response.statusText}`);
            }
            
            console.log('[APIStorageService] Metadata update successful');
        } catch (error) {
            console.error('[APIStorageService] Network error during metadata update:', error);
            throw error;
        }
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
        const response = await fetch(`${this.baseUrl}/files/${id}/analyze`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error('Failed to analyze file');
        }

        const result = await response.json();
        return result.analysis;
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

    async deleteFile(id: string): Promise<void> {
        // Override base class to just delete directly instead of soft delete
        await this.deleteContent(id);
    }

    // Implement other abstract methods as needed...
} 