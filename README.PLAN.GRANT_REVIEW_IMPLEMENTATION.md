# Grant Review System Implementation Plan

## Phase 1: Foundation Setup

### 1. Project Type System Extension
1. **Update Project Interface** (`src/store/projectStore.ts`)
   ```typescript
   interface Project {
     // Existing fields remain unchanged
     id: string;
     name: string;
     description: string;
     createdAt: Date;
     updatedAt: Date;
     conversations: ProjectConversation[];
     files: ProjectFile[];
     
     // New fields
     type: 'project' | 'grant_review';  // 'project' is the existing project type
     grantMetadata?: {  // Only present when type is 'grant_review'
       requiredDocuments: Array<{
         name: string;
         description: string;
         required: boolean;
         uploadStatus: 'pending' | 'uploaded' | 'reviewed';
       }>;
     };
   }
   ```

2. **Create Grant Templates** (`src/data/grantTemplates.ts`)
   ```typescript
   interface GrantTemplate {
     id: string;
     name: string;
     description: string;
     requiredDocuments: Array<{
       name: string;
       description: string;
       required: boolean;
     }>;
   }
   ```

3. **Update Project Store Operations**
   - Add grant-specific CRUD operations
   - Add template selection functionality
   - Add document tracking methods

### 2. Mode System Extension
1. **Update Mode Store** (`src/store/modeStore.ts`)
   ```typescript
   type Mode = 'grant' | 'research' | 'grant_review';
   ```

2. **Add Mode-Specific Behaviors**
   - Create mode transition handlers
   - Add mode-specific UI triggers
   - Implement mode persistence

### 3. File Organization Updates
1. **Extend File Metadata**
   ```typescript
   interface FileMetadata {
     // Existing fields
     description?: string;
     schema?: {
       type: string;
       format: string;
       encoding: string;
     };
     
     // New fields
     grantContext?: {
       documentType: string;  // e.g., "RFA", "Specific_Aims"
       version: string;
       reviewStatus: 'pending' | 'reviewed';
     };
   }
   ```

2. **Create Grant-Specific File Organization**
   - Implement document category system
   - Add version tracking for grant documents
   - Create review status tracking

## Phase 2: UI Specialization

### 1. Grant Project Creation Interface
1. **Create GrantProjectCreation Component**
   - Template selection interface
   - Initial document checklist setup

2. **Update ProjectListView**
   - Add grant-specific project indicators
   - Implement template-based creation flow

### 2. Grant Review Project View
1. **Create GrantReviewProjectView Component**
   ```typescript
   interface GrantReviewProjectViewProps {
     projectId: string;
     onBack: () => void;
     onClose: () => void;
   }
   ```
   Features:
   - Document requirement dashboard
   - Upload status tracking
   - Review progress indicators

2. **Create Document Requirement Panel**
   - Required document checklist
   - Upload interface for each document type
   - Status indicators and progress tracking
   - Version history display

3. **Create Review Progress Tracking**
   - Overall progress dashboard
   - Document-specific review status
   - Comment and feedback system

### 3. Navigation and State Management
1. **Update Project Navigation**
   - Add grant-specific routing
   - Create review workflow paths

2. **State Management Extensions**
   - Add grant review specific selectors
   - Implement document tracking state
   - Add review progress persistence

## Implementation Steps

### Week 1: Foundation
1. Update Project and Mode interfaces
2. Create basic grant templates
3. Extend file metadata system
4. Update project store operations

### Week 2: Basic UI
1. Implement template selection
2. Create grant project creation flow
3. Update project list view
4. Add basic document tracking

### Week 3: Grant Review UI
1. Create GrantReviewProjectView
2. Implement document requirement panel
3. Add review progress tracking
4. Create navigation system

### Week 4: Integration and Testing
1. Connect all components
2. Implement state persistence
3. Add error handling
4. Test all workflows

## Testing Strategy

### 1. Unit Tests
- Template loading and validation
- Project type transitions
- Document status tracking
- Review state management

### 2. Integration Tests
- Project creation workflow
- Document upload process
- Review status updates
- Mode transitions

### 3. UI Tests
- Template selection interface
- Document requirement display
- Progress tracking visualization
- Navigation flows

## Success Criteria
1. Users can create grant review projects from templates
2. Required documents can be uploaded and tracked
3. Review progress can be monitored
4. Project state persists correctly
5. UI adapts appropriately to grant review mode
6. Document versions are tracked properly
7. Navigation between review sections works smoothly

## Rollback Plan
1. Maintain type compatibility with existing projects
2. Keep separate routes for grant review features
3. Implement feature flags for gradual rollout
4. Store version information for state migrations 