# Plan: Implementing Grant and Research Modes

## Overview
This plan outlines the steps needed to implement separate Grant and Research modes in the MCP system, including UI changes, feature segregation, and mode-specific behaviors.

## Progress Tracking

✅ = Completed
🔄 = In Progress
⏳ = Not Started

## Phase 1: Mode Infrastructure

### 1.1 Create Mode Types and State Management
- ✅ Define mode types (Grant/Research) in TypeScript
- ✅ Create mode context and provider (using Zustand)
- ✅ Implement mode switching logic
- ⏳ Add mode persistence in local storage

### 1.2 UI Mode Indicators
- ✅ Add mode selection icons to the interface
  - ✅ Grant Mode: Document/Grant icon
  - ✅ Research Mode: DNA/Atomic icon
- 🔄 Implement mode switching animation
- ⏳ Add mode-specific color themes/styling

## Next Immediate Steps
1. Add ModeSwitcher to main layout
2. Test mode switching functionality
3. Add local storage persistence
4. Complete mode switching animation

## Phase 2: Feature Matrix Definition

### 2.1 Document Feature Availability
Create a feature matrix showing availability across modes:

| Feature Category | Grant Mode | Research Mode | Both |
|-----------------|------------|---------------|------|
| File Management | ✓ Specific Aims<br>✓ Grant Proposals | ✓ Lab Data<br>✓ Research Notes | ✓ General Files |
| Chat Interface | ✓ Grant Review<br>✓ Proposal Feedback | ✓ Research Analysis<br>✓ Data Interpretation | ✓ General Chat |
| MCP Servers | ✅ aims-review-mcp<br>✅ grant-fetch-mcp | ⏳ research-analysis-mcp<br>⏳ data-processing-mcp | ✓ Core Services |

### 2.2 Define Mode-Specific Behaviors
Document how shared features behave differently in each mode:
- 🔄 File upload defaults
- ⏳ Search behavior
- ⏳ Chat context handling
- ⏳ Tool availability

## Phase 3: Implementation Steps

### 3.1 UI Components
1. ✅ Create mode selector component
2. 🔄 Implement mode-specific styling
3. 🔄 Add mode-aware components (ProjectDrawer implemented)
4. ⏳ Update existing components for mode awareness

### 3.2 Feature Implementation
1. 🔄 Update file management system
   - ✅ Add mode-specific file types
   - 🔄 Implement mode-specific storage
   - ⏳ Update file viewers

2. ⏳ Modify chat interface
   - ⏳ Add mode context to chat
   - ⏳ Implement mode-specific prompts
   - ⏳ Update message handling

3. ⏳ Update MCP server integration
   - ⏳ Add mode awareness to API calls
   - ⏳ Implement mode-specific endpoints
   - ⏳ Update response handling

### 3.3 Testing Requirements
1. ⏳ Mode switching functionality
2. ⏳ Feature availability verification
3. ⏳ Data isolation between modes
4. ⏳ UI/UX consistency
5. ⏳ Performance impact assessment

## Phase 4: Project Structure Implementation

### 4.1 Project Data Model
Define the core project structure:
```typescript
interface Project {
  id: string;
  name: string;
  description?: string;
  created: Date;
  lastModified: Date;
  type: 'grant' | 'research';
  status: 'active' | 'archived' | 'completed';
  metadata: {
    grantType?: string;          // For grant projects
    grantDeadline?: Date;        // For grant projects
    researchArea?: string;       // For research projects
    collaborators?: string[];    // For both types
    tags?: string[];            // For categorization
    customFields?: Record<string, any>; // For extensibility
  };
  // Sections organize both files and related conversations
  sections: {
    id: string;
    name: string;
    type: 'aims' | 'background' | 'methods' | 'results' | 'custom';
    files: FileEntry[];
    conversations: {
      id: string;              // Reference to conversation in chat store
      title: string;
      lastUpdated: Date;
      summary?: string;        // AI-generated or user-provided summary
      context?: string;        // Section-specific context for the conversation
      artifacts?: string[];    // IDs of artifacts generated in this conversation
    }[];
    notes?: string;           // Section-specific notes
  }[];
  // Project-wide conversations not tied to specific sections
  conversations: {
    id: string;
    title: string;
    type: 'planning' | 'review' | 'general';
    lastUpdated: Date;
    summary?: string;
    artifacts?: string[];
  }[];
  relationships: {
    relatedProjects?: string[];  // IDs of related projects
    dependencies?: string[];     // IDs of projects this depends on
    citations?: string[];       // References to other projects/papers
  };
}

// Example of how conversations link back to projects
interface ConversationMetadata {
  id: string;
  projectId?: string;     // Link to parent project if any
  sectionId?: string;     // Link to specific section if any
  type: 'project' | 'section' | 'standalone';
  context?: {
    projectName?: string;
    sectionName?: string;
    projectType?: 'grant' | 'research';
  };
}
```

### 4.2 Project Store Structure (Planned)
- Project state management:
  - ⏳ Active projects list
  - ⏳ Project metadata
  - ⏳ Project sections and organization
  - ⏳ Project-conversation relationships
  - ⏳ Project-specific settings
  - ⏳ Conversation context management

### 4.3 Project Operations (Planned)
1. Project Lifecycle Management:
   - Project Creation Flow:
     ```typescript
     interface ProjectInitialization {
       // Initial Project Setup
       step1_basics: {
         name: string;
         type: 'grant' | 'research';
         description?: string;
       };
       // Template Selection (optional)
       step2_template?: {
         templateId?: string;
         useDefaultSections: boolean;
       };
       // Initial Conversation Setup
       step3_conversation: {
         title: string;         // e.g., "Project Planning"
         initialPrompt?: string; // Optional AI conversation starter
         context: {
           purpose: 'project_planning' | 'aims_definition' | 'custom';
           customContext?: string;
         };
       };
     }
     ```

   - Project Creation Results:
     - New project created with basic metadata
     - Initial sections created (from template or defaults)
     - New conversation started in chat interface
     - Project drawer updated to show new project
     - Chat context set to new project

   Other Lifecycle Operations:
   - ⏳ Archive project
   - ⏳ Complete project
   - ⏳ Delete project
   - ⏳ Clone/Template project

2. Project Organization:
   - ⏳ Create/Edit sections
   - ⏳ Organize files within sections
   - ⏳ Manage project metadata
   - ⏳ Set project relationships

3. Project Collaboration:
   - ⏳ Add/Remove collaborators
   - ⏳ Set permissions
   - ⏳ Share project resources

### 4.4 UI Components Needed
1. Project Management:
   - Project Creation:
     - ⏳ "New Project" button in ProjectDrawer header
     - ⏳ Project creation wizard dialog
     - ⏳ Template selection interface
     - ⏳ Initial conversation setup
   - ⏳ Project dashboard
   - ⏳ Project settings panel
   - ⏳ Section manager

2. File Organization:
   - ⏳ Section-based file browser
   - ⏳ File upload per section
   - ⏳ Drag-and-drop organization

3. Project Navigation:
   - ⏳ Project breadcrumbs
   - ⏳ Section navigation
   - ⏳ Related projects view

### 4.5 Storage Implementation (Planned)
1. Project Data:
   - ⏳ Project metadata storage
   - ⏳ Section organization
   - ⏳ File associations
   - ⏳ Relationship mapping

2. Data Migration:
   - ⏳ Migrate existing tagged files
   - ⏳ Create initial project structure
   - ⏳ Set up default sections

### 4.6 Project-Chat Integration
1. Project Creation Flow:
   ```mermaid
   graph TD
     A[Click New Project] --> B[Open Creation Wizard]
     B --> C[Enter Basic Info]
     C --> D[Select Template]
     D --> E[Setup Initial Chat]
     E --> F[Create Project]
     F --> G[Open New Chat]
     G --> H[AI Starts Planning]
   ```

2. Chat Context Management:
   - Chat knows current project context
   - AI can access project metadata
   - Conversations automatically tagged with project
   - Artifacts saved to correct project section

3. Project-Chat Synchronization:
   - Chat updates reflect in project structure
   - Project changes update chat context
   - Artifacts automatically organized
   - Cross-referencing between chats and files

## Next Steps for Project Implementation
1. Create project data model and types
2. Implement project store with Zustand
3. Add project creation and management
4. Develop section-based organization
5. Build project relationship system

## Dependencies and Considerations
1. Storage Service Integration:
   - Extend current storage service for project structure
   - Add project-specific queries and filters
   - Implement section-based file organization

2. Mode Integration:
   - Project type based on current mode
   - Mode-specific project templates
   - Mode-specific section defaults

3. Performance Considerations:
   - Lazy loading of project data
   - Efficient file organization
   - Optimized relationship queries

## Current Status
We are currently in Phase 1 and early Phase 3, with:
- Basic mode infrastructure implemented
- Mode switcher UI created
- Project drawer component created
- Mode-aware rendering implemented

## Next Priority Steps
1. Add ModeSwitcher to main layout
2. Implement mode persistence in local storage
3. Complete mode switching animation
4. Test current implementation
5. Begin implementing remaining Phase 1 items

Would you like to proceed with any of these next steps? 