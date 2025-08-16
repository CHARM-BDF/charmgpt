# File Management System Documentation

## Overview
The file management system is a comprehensive solution that handles files, projects, conversations, and their relationships. It uses a combination of filesystem storage and browser localStorage to manage different types of data efficiently. The system is integrated with a mode-based architecture that supports both grant and research workflows.

## Storage Architecture

### 1. Project Storage
Projects are stored using Zustand with persist middleware in browser localStorage under 'project-storage'.

```typescript
interface Project {
  id: string;
  name: string;
  description: string;
  createdAt: Date;
  updatedAt: Date;
  conversations: ProjectConversation[];
  files: ProjectFile[];
}

interface ProjectFile {
  id: string;
  name: string;
  timestamp: Date;
}

interface ProjectState {
  projects: Project[];
  selectedProjectId: string | null;
  isLoading: boolean;
  error: string | null;
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
  analysisInfo?: {
    summary: Record<string, unknown>;
    quality: {
      nullCount: number;
      duplicateCount: number;
      errorCount: number;
      completeness: number;
    };
  };
  tags: string[];
  llmNotes?: string;
}
```

### 3. Conversation Storage
Conversations are stored using Zustand with persist middleware in browser localStorage under 'chat-storage'.

```typescript
interface ConversationState {
  currentConversationId: string | null;
  conversations: {
    [id: string]: Conversation;
  };
}

interface Conversation {
  metadata: {
    id: string;
    name: string;
    created: Date;
    lastUpdated: Date;
    messageCount: number;
  };
  messages: MessageWithThinking[];
  artifacts: Artifact[];
}

interface MessageWithThinking extends Message {
  thinking?: string;
  artifactIds?: string[];
  isStreaming?: boolean;
  statusUpdatesCollapsed?: boolean;
  statusUpdates?: StatusUpdate[];
  isLastStatusUpdate?: boolean;
}
```

### 4. Mode System
The system supports different operational modes through a mode store:

```typescript
type Mode = 'grant' | 'research';

interface ModeState {
  currentMode: Mode;
  setMode: (mode: Mode) => void;
}
```

## Relationships Between Components

### 1. Project-File Relationships
- Files are tagged with project IDs using the format `project:${projectId}`
- Files can be queried by project using these tags
- Project files are displayed based on the current mode
- Implementation:
  ```typescript
  // Example: Loading project files
  const projectFiles = await storageService.listFiles({
    tags: [`project:${selectedProjectId}`]
  });
  ```

### 2. Project-Conversation Relationships
- Each project maintains its own conversations array
- Conversations are created and managed within project context
- Mode-specific conversation handling
- Implementation:
  ```typescript
  // Example: Creating a new conversation
  const conversationId = startNewConversation(name);
  addConversationToProject(projectId, conversationId, title);
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
- Messages can reference multiple artifacts
- Supports streaming responses and status updates
- Implementation:
  ```typescript
  // Example: Adding an artifact
  const artifactId = addArtifact({
    type: ArtifactType,
    content: string,
    title: string,
    position: number
  });
  ```

## Best Practices

1. **File Operations**
   - Always use appropriate error handling
   - Validate file types and content
   - Implement proper security measures
   - Follow naming conventions
   - Maintain consistent metadata

2. **Mode Management**
   - Check current mode before operations
   - Handle mode-specific UI components
   - Maintain mode-appropriate file organization
   - Consider mode context in operations

3. **Project Organization**
   - Use clear project naming conventions
   - Maintain project-file relationships through tags
   - Clean up project resources when deleted
   - Keep project metadata up to date

4. **Conversation Management**
   - Link conversations to projects appropriately
   - Manage artifacts within conversation context
   - Handle streaming responses properly
   - Maintain status updates and thinking states

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