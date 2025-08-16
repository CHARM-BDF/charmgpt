# Project System Documentation

## Overview
The project system is a comprehensive solution for managing projects, their associated files, and conversations. It integrates with the chat interface and file management system to provide a cohesive project management experience.

## Core Components

### 1. Project Store (`src/store/projectStore.ts`)
The central state management for projects using Zustand with persistence.

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

interface ProjectConversation {
  id: string;
  title: string;
  lastMessageAt: Date;
}

interface ProjectFile {
  id: string;
  name: string;
  timestamp: Date;
}
```

Key Operations:
- CRUD operations for projects
- Conversation management (add/remove)
- File management (add/remove)
- Project selection
- Loading and error states

### 2. UI Components

#### ProjectListView (`src/components/projects/ProjectListView.tsx`)
- Main interface for viewing and managing projects
- Full-screen overlay layout
- Project creation and management
- Navigation to individual projects

#### ProjectView (`src/components/projects/ProjectView.tsx`)
- Detailed view of a single project
- Displays project files and conversations
- File management interface
- Conversation management
- Integration with chat system

#### ProjectDrawer (`src/components/projects/ProjectDrawer.tsx`)
- Side drawer for quick project access
- Mouse-activated drawer (activates when cursor reaches screen edge)
- Project list and selection
- File upload functionality
- Only available in 'grant' mode

#### ProjectChatInput (`src/components/projects/ProjectChatInput.tsx`)
- Specialized chat input for project context
- Handles file references and uploads
- Integrates with project-specific conversations

### 3. Integration with Other Systems

#### Chat System Integration
- Projects can contain multiple conversations
- Conversations are stored in ChatStore
- Project conversations are linked via IDs
- Chat interface adapts based on project context

```typescript
// Chat store integration with projects
interface ConversationState {
  currentConversationId: string | null;
  conversations: {
    [id: string]: Conversation;
  };
  getUnassociatedConversations: () => string[];
}
```

#### File Management Integration
- Files are tagged with project IDs (`project:${projectId}`)
- File storage uses APIStorageService
- Files are stored with metadata and relationships
- Project files are displayed in ProjectView

#### Mode System Integration
- Project functionality is mode-aware
- Different behaviors in 'grant' vs 'research' modes
- ProjectDrawer only available in 'grant' mode

### 4. File Structure and Organization

```
src/
├── components/
│   └── projects/
│       ├── ProjectListView.tsx   # Main project list interface
│       ├── ProjectView.tsx       # Single project view
│       ├── ProjectDrawer.tsx     # Side drawer component
│       └── ProjectChatInput.tsx  # Project-specific chat input
├── store/
│   ├── projectStore.ts          # Project state management
│   └── chatStore.ts             # Chat integration
└── types/
    └── fileManagement.ts        # File-related type definitions
```

### 5. Key Features

#### Project Management
- Create new projects
- Update project details
- Delete projects
- Project selection and navigation

#### File Management
- File upload to projects
- File deletion
- File renaming
- File content viewing
- Text content creation

#### Conversation Management
- Create new conversations in project context
- Switch between conversations
- View conversation history
- Link conversations to projects

#### UI/UX Features
- Mouse-activated project drawer
- Full-screen project views
- File manager integration
- Chat interface integration

### 6. State Persistence
- Project data persisted in localStorage
- File content stored in filesystem
- Conversations persisted in chat store
- Mode state maintained across sessions

### 7. Error Handling
- Loading states for async operations
- Error states for failed operations
- Graceful fallbacks for missing data
- Console logging for debugging

## Usage Example

1. Creating a Project:
```typescript
const { addProject } = useProjectStore();
addProject({
  name: "New Project",
  description: "Project description"
});
```

2. Adding a File to Project:
```typescript
const { addFileToProject } = useProjectStore();
addFileToProject(projectId, fileId, fileName);
```

3. Adding a Conversation:
```typescript
const { addConversationToProject } = useProjectStore();
addConversationToProject(projectId, conversationId, title);
```

## Implementation Notes

1. Project-File Relationship:
- Files are tagged with project IDs
- Files can be queried by project
- File metadata includes project context

2. Project-Conversation Relationship:
- Conversations are linked by ID
- Projects track conversation metadata
- Full conversation data in chat store

3. State Management:
- Zustand for state management
- Persistent storage for projects
- Real-time updates for files
- Integrated with chat system

4. Mode-Based Behavior:
- Different UI in different modes
- Mode-specific features
- Consistent state across modes 