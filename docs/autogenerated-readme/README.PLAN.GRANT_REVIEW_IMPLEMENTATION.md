# Grant Review System Implementation Plan

## Completed Steps ✅
1. Added grant review icon to ConversationDrawer
   - Added grant mode icon from `/logos/grantmode_icon.png`
   - Sized appropriately (w-8 h-8)
   - Added hover effects to match other icons (blue on hover)
   - Added tooltip with fast transition
   - Positioned correctly in the collapsed drawer view

2. Added Grant Review section to expanded drawer
   - Shows recent grant review projects
   - Matches styling of Recent Projects section
   - Added "View All" button
   - Shows placeholder when no grant reviews exist

3. Project Store Updates
   - Project interface includes type field ('project' | 'grant_review')
   - Updated addProject to properly handle grant review type
   - Added getGrantReviewProjects selector

4. GrantReviewListView Component
   - Shows only grant review projects
   - Creates new grant reviews with correct type
   - Displays project details
   - Navigates to individual project view
   - Handles empty state
   - Matches project list styling

5. ProjectView Grant Review Mode ✅
   - Added "Expected Documents" guidance section
   - Lists required documents (RFA, Specific Aims, Research Proposal, Supplemental Information)
   - Added usage instructions for document management
   - Integrated with existing file upload system

## Next Steps: Project List View Updates

### 1. Update ProjectListView Component
1. Modify project filtering:
   - Filter out grant review projects from main project list
   - Update "New Project" button to create projects with type 'project'
   - Update component title to clarify these are regular projects

### 2. Update Project Creation Logic
1. Add type-specific project creation:
   - Update the "New Project" handler in ProjectListView
   - Set default type to 'project' for new projects
   - Ensure project type is preserved in store

### 3. Navigation Flow Updates
1. Update ConversationDrawer handlers:
   - Ensure grant review icon shows only grant review projects
   - Ensure projects icon shows only regular projects
   - Handle view transitions smoothly

### 4. Testing Steps
1. Verify project separation:
   - Regular projects appear only in ProjectListView
   - Grant reviews appear only in GrantReviewListView
   - Project creation sets correct type
   - Navigation between views works correctly

## Current Implementation
The grant review system uses the existing file management system with additional guidance for grant-specific documents:

1. Document Management
   - Uses existing file upload functionality
   - Uses existing document viewer
   - Uses existing file organization system
   - Adds visual guidance for expected grant documents

2. User Interface
   - Clear separation between regular and grant review projects
   - Intuitive navigation between project types
   - Document upload guidance specific to grant reviews
   - Consistent styling with the rest of the application

## Success Criteria ✅
1. Users can create and manage grant review projects
2. Clear visual distinction between project types
3. Easy navigation between different project types
4. Document upload and management functionality
5. Clear guidance for required grant documents
6. Consistent user experience across project types

The implementation has been simplified from the original plan to use the existing file management system with added guidance for grant review documents, rather than creating a separate document management system.

Would you like to proceed with any refinements to the current implementation?

Would you like me to proceed with implementing the ProjectListView updates? 