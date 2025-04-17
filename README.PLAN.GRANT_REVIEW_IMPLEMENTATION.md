# Grant Review System Implementation Plan

## Completed Steps ✅
1. Added grant review icon to ConversationDrawer
   - Added BeakerIcon initially for testing
   - Replaced with grant mode icon from `/logos/grantmode_icon.png`
   - Sized appropriately (w-8 h-8)
   - Added hover effects to match other icons
   - Added tooltip with fast transition
   - Positioned correctly in the collapsed drawer view

## Next Step: Add Grant Review Section to Expanded Drawer
1. **Update Expanded View** (`src/components/conversations/ConversationDrawer.tsx`)
   ```typescript
   // Add grant review projects section after Recent Projects
   const grantReviewProjects = projects
     ?.filter(p => p.type === 'grant_review')
     .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
     .slice(0, 3) || [];

   // Add new section in expanded view:
   <div className="mb-4">
     <div className="flex justify-between items-center mb-2">
       <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
         Grant Reviews
       </h3>
       {grantReviewProjects.length > 0 && (
         <button
           onClick={() => setShowGrantReviewList?.(true)}
           className="text-xs text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300"
         >
           View All
         </button>
       )}
     </div>
     
     <div className="space-y-1 text-sm">
       {grantReviewProjects.length > 0 ? (
         grantReviewProjects.map(project => (
           <button
             key={project.id}
             onClick={() => openProject(project.id)}
             className="w-full text-left px-3 py-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 
                      flex items-center gap-2 transition-colors"
           >
             <img 
               src="/logos/grantmode_icon.png" 
               alt="Grant Review"
               className="w-4 h-4 opacity-80" 
             />
             <span className="truncate">{project.name}</span>
           </button>
         ))
       ) : (
         <div className="text-gray-400 px-3 py-2 italic text-xs">
           No grant reviews yet.
         </div>
       )}
     </div>
   </div>
   ```

## Remaining Steps
1. Update Project interface and store
2. Create GrantReviewListView
3. Implement grant review project creation
4. Add document requirement tracking
5. Create specialized views for grant reviews
6. Testing and integration

Would you like me to proceed with implementing the expanded drawer view for grant reviews?

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
   ```typescript
   // Add to ProjectStore
   interface ProjectState {
     // ... existing fields ...
     getGrantReviewProjects: () => Project[];  // New selector for grant review projects
     addProject: (project: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>) => void;
   }
   ```

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

### 4. UI Components Update

1. **Update ProjectDrawer** (`src/components/projects/ProjectDrawer.tsx`)
   ```typescript
   // Add new state and handlers
   const [showGrantReviewList, setShowGrantReviewList] = useState(false);
   
   // Add under the Projects header:
   <div className="flex flex-col items-center">
     <button
       onClick={() => setShowGrantReviewList(true)}
       className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
       title="Grant Review Projects"
     >
       <img 
         src="/logos/grantmode_icon.png" 
         alt="Grant Review" 
         className="w-5 h-5"
       />
     </button>
     <span className="text-[10px] text-gray-400">Grant Review</span>
   </div>
   ```

2. **Create GrantReviewListView** (`src/components/projects/GrantReviewListView.tsx`)
   ```typescript
   interface GrantReviewListViewProps {
     onClose: () => void;
     showGrantReviewList: boolean;
   }
   ```
   - Reuse ProjectListView structure but:
     - Only show grant review projects
     - Specialized creation flow for grant review projects
     - Custom header and descriptions

3. **Update ProjectListView**
   - Add type filter to exclude grant review projects
   - Update project creation to set correct type

### 5. Navigation Flow
1. **Project Type Separation**
   - Regular projects in main ProjectListView
   - Grant review projects in GrantReviewListView
   - Each view handles its own type of projects

2. **Access Points**
   - Main projects via Projects icon
   - Grant review projects via new Grant Review icon
   - Both accessible from ProjectDrawer

## Implementation Steps

### Week 1: Foundation
1. Update Project interface and store
2. Add grant review project selectors
3. Create basic GrantReviewListView

### Week 2: UI Integration
1. Add Grant Review icon to ProjectDrawer
2. Implement GrantReviewListView
3. Update navigation flow

### Week 3: Basic UI
1. Implement template selection
2. Create grant project creation flow
3. Update project list view
4. Add basic document tracking

### Week 4: Grant Review UI
1. Create GrantReviewProjectView
2. Implement document requirement panel
3. Add review progress tracking
4. Create navigation system

### Week 5: Integration and Testing
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

### 4. Test Proper Separation of Project Types
- Verify that regular projects and grant review projects are correctly separated

### 5. Test Navigation Between Different Project Views
- Verify that users can navigate between regular projects and grant review projects

### 6. Verify Correct Project Type Creation
- Ensure that project creation correctly sets the project type

## Success Criteria
1. Users can create grant review projects from templates
2. Required documents can be uploaded and tracked
3. Review progress can be monitored
4. Project state persists correctly
5. UI adapts appropriately to grant review mode
6. Document versions are tracked properly
7. Navigation between review sections works smoothly
8. Users can easily distinguish between regular and grant review projects
9. Navigation between project types is intuitive
10. Project creation correctly sets project type

## Rollback Plan
1. Maintain type compatibility with existing projects
2. Keep separate routes for grant review features
3. Implement feature flags for gradual rollout
4. Store version information for state migrations

### 3. **Update ProjectDrawer Component** (`src/components/projects/ProjectDrawer.tsx`)
   - Add new grant review button under Projects header
   - Add separate dialog for grant review project creation
   - Update project creation logic to handle both types 

## Phase 2: UI Specialization

### 1. UI Updates

1. **Update ConversationDrawer** (`src/components/conversations/ConversationDrawer.tsx`)
   - Add grant review icon in collapsed state
   - Add grant review section in expanded state
   - Update navigation logic for grant review projects

   Changes needed:
   ```typescript
   // Add to imports
   import { BeakerIcon } from '@heroicons/react/24/outline';

   // Add to ConversationDrawerProps
   interface ConversationDrawerProps {
     // ... existing props ...
     setShowGrantReviewList?: (show: boolean) => void;
   }

   // Add to component state
   const [showGrantReviewList, setShowGrantReviewList] = useState(false);

   // Add grant review projects section
   const grantReviewProjects = projects
     ?.filter(p => p.type === 'grant_review')
     .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
     .slice(0, 3) || [];
   ```

2. **Create GrantReviewListView** (`src/components/projects/GrantReviewListView.tsx`)
   - Similar to ProjectListView but specialized for grant reviews
   - Filter to show only grant review projects
   - Add grant-specific creation flow

### 2. Navigation Flow
1. **Project Type Navigation**
   - Regular projects via folder icon
   - Grant review projects via beaker icon
   - Both accessible from ConversationDrawer

2. **View Organization**
   - Projects and grant reviews in separate lists
   - Each type has its own creation flow
   - Shared base functionality but specialized UI

## Implementation Steps

### Week 1: Foundation
1. Update Project interface and store
2. Add grant review project selectors
3. Update ConversationDrawer with grant review icon

### Week 2: UI Integration
1. Add grant review section to ConversationDrawer
2. Create GrantReviewListView
3. Update navigation flow

### Week 3: Grant Review UI
1. Implement grant review project creation
2. Add document requirement tracking
3. Create specialized views for grant reviews

### Week 4: Integration and Testing
1. Connect all components
2. Implement state persistence
3. Add error handling
4. Test all workflows

## Testing Strategy

### 1. Unit Tests
- Project type system
- Navigation between views
- Project creation flows

### 2. Integration Tests
- ConversationDrawer interactions
- Project type switching
- Document management

### 3. UI Tests
- Icon visibility and interaction
- Navigation between views
- Project creation flows

## Success Criteria
1. Users can create both regular and grant review projects
2. Clear visual distinction between project types
3. Intuitive navigation between different project types
4. Document tracking for grant reviews
5. Proper state management and persistence
6. Smooth transitions between views

## Next Steps
1. Update ConversationDrawer to add grant review icon
2. Implement project type filtering
3. Create grant review list view
4. Add document tracking functionality 