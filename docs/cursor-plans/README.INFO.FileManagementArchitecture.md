# File Management System Documentation

## Overview
The file management system is a comprehensive solution for handling file operations, metadata management, and file relationships. It follows a layered architecture with clear separation of concerns and is designed to be extensible.

## Architecture

### Core Components

#### 1. Storage Service Interface (`IStorageService.ts`)
- Defines the contract for all storage implementations
- Specifies required operations:
  - Basic file operations (CRUD)
  - Metadata management
  - File relationships
  - Search and query capabilities

#### 2. Base Storage Service (`BaseStorageService.ts`)
- Abstract base class implementing common functionality
- Handles core operations:
  ```typescript
  createFile(content: Uint8Array | string, metadata: Partial<FileMetadata>)
  readFile(id: string)
  updateFile(id: string, content: Uint8Array | string, metadata?: Partial<FileMetadata>)
  deleteFile(id: string)
  ```
- Manages metadata operations:
  ```typescript
  getMetadata(id: string)
  updateMetadata(id: string, metadata: Partial<FileMetadata>)
  ```
- Defines abstract methods for concrete implementations

#### 3. Concrete Implementations
##### FileSystemStorageService (`FileSystemStorageService.ts`)
- Implements storage using the local file system
- Directory structure:
  ```
  baseDir/
  ├── content/      # Actual file content
  ├── metadata/     # File metadata as JSON
  └── relationships/ # File relationships
  ```
- Handles physical file operations

##### APIStorageService (`APIStorageService.ts`)
- Client-side implementation
- Communicates with server via HTTP
- Endpoints:
  ```
  POST   /api/storage/files          # Upload file
  GET    /api/storage/files          # List files
  GET    /api/storage/files/:id      # Get file
  PUT    /api/storage/files/:id      # Update file
  DELETE /api/storage/files/:id      # Delete file
  ```

### Data Models

#### FileEntry
```typescript
interface FileEntry {
  id: string;
  name: string;
  path: string;
  mimeType: string;
  size: number;
  hash: {
    algorithm: "sha256" | "sha512";
    value: string;
  };
  status: "active" | "deleted" | "archived";
  owner: string;
  created: Date;
  modified: Date;
  lastAccessed: Date;
  tags: string[];
  llmNotes: string;
  metadata: FileMetadata;
}
```

#### FileMetadata
```typescript
interface FileMetadata {
  description?: string;
  schema?: {
    type: string;
    format: string;
    encoding: string;
    sampleData: string;
  };
  origin?: {
    type: string;
    timestamp: Date;
  };
  version?: {
    major: number;
    minor: number;
    patch: number;
    branch: {
      name: string;
      parent: string;
      created: Date;
      description: string;
    };
    history: Array<{
      id: string;
      timestamp: Date;
      message: string;
      user: string;
      branch: string;
      parent: string;
    }>;
  };
}
```

## Implementation Phases

### Phase 1: Core Storage (Implemented)
- Basic file operations
- Metadata management
- File listing and search
- Tag-based organization

### Phase 2: Relationships (In Progress)
- File relationships
- Graph structure
- Relationship types and metadata
- Related file queries

### Phase 3: Version Control (Planned)
- Branch management
- Version history
- Merge strategies
- Conflict resolution

### Phase 4: Advanced Features (Planned)
- File analysis
- Content validation
- Custom operations
- Storage statistics

## UI Components

### 1. FileManager (`FileManager.tsx`)
- Main file management interface
- Features:
  - File listing
  - Upload
  - Delete
  - Search
  - Relationship management

### 2. ProjectFilesTopDrawer (`ProjectFilesTopDrawer.tsx`)
- Project-specific file interface
- Features:
  - Project file listing
  - File upload within project context
  - File deletion
  - File renaming

### 3. ProjectDrawer (`ProjectDrawer.tsx`)
- Project management interface
- Integrates with storage service
- Handles project-specific file operations

## Common Operations

### File Upload Flow
1. User initiates upload in UI
2. UI component calls `APIStorageService.createFile()`
3. APIStorageService sends multipart request to server
4. Server routes handle upload via `storage.ts`
5. FileSystemStorageService writes file and metadata
6. Response returns to UI with file details

### File Deletion Flow
1. User triggers delete in UI
2. UI calls `APIStorageService.deleteFile()`
3. Request sent to server
4. Server processes deletion
5. File and metadata removed or marked as deleted
6. UI updates to reflect changes

### File Search Flow
1. User enters search criteria
2. UI calls `APIStorageService.searchFiles()`
3. Server processes search request
4. FileSystemStorageService queries files
5. Results filtered based on criteria
6. UI displays matching files

## Error Handling
- File not found handling
- Permission checks
- Validation errors
- Network error handling
- Duplicate file handling

## Security Considerations
- File access control
- Metadata validation
- Safe file handling
- Input sanitization
- Error message security

## Future Enhancements
1. Advanced search capabilities
2. File versioning
3. Collaborative features
4. File type previews
5. Automated file analysis
6. Enhanced metadata extraction
7. Integration with external storage services

## Best Practices
1. Always use appropriate error handling
2. Validate file types and content
3. Implement proper security measures
4. Follow naming conventions
5. Maintain consistent metadata
6. Use appropriate file operations
7. Implement proper cleanup procedures

## Troubleshooting
1. Check server logs for errors
2. Verify file permissions
3. Validate file paths
4. Check network connectivity
5. Verify storage space
6. Check file locks
7. Monitor file system events 