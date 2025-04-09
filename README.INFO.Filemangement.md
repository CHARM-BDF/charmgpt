# File Management System Documentation

## Overview
The file management system is a comprehensive solution that handles files, projects, conversations, and their relationships. It uses a combination of filesystem storage and browser localStorage to manage different types of data efficiently.

## Storage Architecture

### 1. Project Storage
Projects are stored using Zustand with persist middleware in browser localStorage under 'project-storage'.

```typescript
interface Project {
  id: string;
  name: string;
  description?: string;
  type: 'grant' | 'research';
  created: Date;
  lastModified: Date;
}

interface ProjectState {
  projects: Project[];
  selectedProjectId: string | null;
}
```

### 2. File Storage
Files are stored in the filesystem using a three-directory structure:

```
baseDir/
├── content/      # Actual file contents
├── metadata/     # File metadata as JSON
└── relationships/ # File relationships
```

File Entry Structure:
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
  tags: string[];  // Contains project ID as tag
  metadata: FileMetadata;
}

interface FileMetadata {
  description?: string;
  schema?: {
    type: string;
    format: string;
    encoding: string;
  };
  version?: {
    major: number;
    minor: number;
    patch: number;
  };
}
```

### 3. Conversation Storage
Conversations are stored using Zustand with persist middleware in browser localStorage under 'chat-storage'.

```typescript
interface ConversationState {
  currentConversationId: string | null;
  conversations: {
    [id: string]: {
      metadata: {
        id: string;
        name: string;
        created: Date;
        lastUpdated: Date;
        messageCount: number;
      };
      messages: Message[];
      artifacts: Artifact[];
    }
  }
}
```

### 4. File Relationships
Relationships between files are stored in JSON files in the relationships directory.

```typescript
interface FileRelationship {
  id: string;
  sourceId: string;
  targetId: string;
  metadata: {
    type: RelationType;
    description: string;
    created: Date;
    creator: string;
    llmNotes?: string;
  };
  status: "active" | "deleted";
  created: Date;
  modified: Date;
}
```

## Relationships Between Components

### 1. Project-File Relationships
- Files are tagged with project IDs using the format `project:${projectId}`
- Files can be queried by project using these tags
- Project files are displayed in the ProjectFilesTopDrawer component
- Implementation:
  ```typescript
  // Example: Loading project files
  const projectFiles = await storageService.listFiles({
    tags: [`project:${selectedProjectId}`]
  });
  ```

### 2. Project-Conversation Relationships
- Each project can have multiple associated conversations
- Conversations store project context in their metadata
- New conversations are automatically created with new projects
- Implementation:
  ```typescript
  // Example: Creating a new project with conversation
  const projectId = createProject(name, type);
  startNewConversation(); // Creates conversation for project
  ```

### 3. File-File Relationships
- Files can be related to other files through the relationship system
- Relationships are bidirectional and typed
- Each relationship has metadata describing its nature
- Implementation:
  ```typescript
  // Example: Creating a file relationship
  await storageService.addRelationship(sourceId, targetId, type);
  ```

### 4. Conversation-Artifact Relationships
- Conversations can generate artifacts (code, images, etc.)
- Artifacts are stored with their parent conversation
- Messages can reference one or more artifacts
- Implementation:
  ```typescript
  // Example: Adding an artifact to a conversation
  const artifactId = addArtifact({
    type: ArtifactType,
    content: string,
    title: string
  });
  ```

## Storage Services

### 1. Base Storage Service
- Abstract class implementing common functionality
- Handles core operations (CRUD)
- Manages metadata operations
- Defines interface for concrete implementations

### 2. File System Storage Service
- Implements storage using the local file system
- Handles physical file operations
- Manages file relationships
- Implements query operations

### 3. API Storage Service
- Client-side implementation
- Communicates with server via HTTP
- Handles file uploads and downloads
- Manages metadata updates

## Best Practices

1. **File Operations**
   - Always use appropriate error handling
   - Validate file types and content
   - Implement proper security measures
   - Follow naming conventions
   - Maintain consistent metadata

2. **Relationship Management**
   - Validate both source and target files exist
   - Use consistent relationship types
   - Clean up relationships when files are deleted
   - Keep relationship metadata minimal and focused

3. **Project Organization**
   - Use clear project naming conventions
   - Maintain project-file relationships through tags
   - Clean up project resources when deleted
   - Keep project metadata up to date

4. **Conversation Management**
   - Link conversations to projects appropriately
   - Manage artifacts within conversation context
   - Clean up orphaned artifacts
   - Maintain conversation history properly

## Error Handling

1. **File Operations**
   - Handle file not found errors
   - Manage permission issues
   - Handle duplicate files
   - Validate file content

2. **Storage Limits**
   - Check available space
   - Handle quota exceeded errors
   - Implement cleanup strategies
   - Warn users about space limitations

3. **Relationship Errors**
   - Handle missing file references
   - Manage circular relationships
   - Clean up invalid relationships
   - Validate relationship types

## Future Enhancements

1. **Storage Improvements**
   - Implement file compression
   - Add file versioning
   - Enhance search capabilities
   - Add bulk operations

2. **Relationship Enhancements**
   - Add relationship visualization
   - Implement relationship validation rules
   - Add relationship impact analysis
   - Support complex relationship types

3. **Project Features**
   - Add project templates
   - Implement project sharing
   - Add project analytics
   - Enhance project organization

4. **Conversation Features**
   - Add conversation export/import
   - Implement conversation merging
   - Add conversation search
   - Enhance artifact management 