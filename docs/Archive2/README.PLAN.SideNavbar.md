# Side Navigation Bar Implementation Plan

## Overview
Modify the existing `ConversationDrawer` component to become a fully-featured side navigation bar with the following characteristics:

- **Collapsed State**:
  - Narrow width showing only icons
  - Expand button to widen the sidebar
  - New chat button (plus icon in circle)
  - Projects icon linking to `ProjectListView`
  
- **Expanded State**:
  - Show 3 most recent projects
  - Display all conversations sorted by last modified time
  - Collapsible back to icon-only view

## Project Navigation Flow

### Component Interaction
The project navigation system works through the interaction of several components:

1. **ChatInterface.tsx** (Parent Component)
   - Manages main state:
     - `showProjectList` - controls ProjectListView visibility
     - `showProjectView` - controls ProjectView visibility
     - Passes these state setters to child components
   - Renders either ProjectListView or ProjectView based on state

2. **ConversationDrawer.tsx**
   - Has two project navigation paths:
     - "View All" button: Shows full project list
     - Individual project links: Shows specific project view
   - Uses props from ChatInterface:
     - `setShowProjectList` - to show project list
     - `setShowProjectView` - to show specific project
   - Uses ProjectStore for state management

3. **ProjectListView.tsx**
   - Shows list of all projects
   - Handles project selection
   - Automatically switches to ProjectView when a project is selected

4. **ProjectView.tsx**
   - Displays specific project details
   - Rendered when a project is selected and showProjectView is true

### Navigation Patterns

1. **"View All" Navigation**:
   ```typescript
   const navigateToProjects = () => {
     useProjectStore.getState().selectProject(null); // Clear selection
     setShowProjectList(true);                       // Show list view
   };
   ```

2. **Specific Project Navigation**:
   ```typescript
   const openProject = (projectId: string) => {
     useProjectStore.getState().selectProject(projectId); // Select project
     setShowProjectView(true);                           // Show project view
   };
   ```

## Implementation Steps

### 1. Update ConversationDrawer Structure
- Modify the drawer width logic to support collapsed/expanded states
- Add state management for tracking the expanded/collapsed state
- Update the activation zone and behavior

### 2. Create Icon-Only Collapsed View
- Implement the narrow view with appropriate styling
- Create the expand button
- Add the new chat button (reuse existing functionality)
- Add the projects button that links to ProjectListView

### 3. Implement Expanded View Features
- Create the recent projects section
  - Connect to the project store
  - Display the 3 most recent projects
  - Add click functionality to navigate to project
- Enhance the conversations list
  - Sort conversations by last modified time
  - Update styling for the expanded view

### 4. Connect Projects and Conversations
- Establish proper state management between ProjectListView and ConversationDrawer
- Ensure navigation between projects and conversations works seamlessly
- Handle state persistence when switching between views

### 5. Improve Transition Animations
- Add smooth animations for expanding/collapsing
- Ensure proper transitions for content appearing/disappearing
- Optimize performance for transitions

### 6. Testing and Refinement
- Test navigation flow between states
- Verify correct display of projects and conversations
- Ensure mobile responsiveness
- Check for edge cases (empty states, etc.)

## Technical Considerations

### State Management
- Need to connect `useChatStore` and `useProjectStore`
- May need to update store interfaces to support:
  - Tracking last modified time for conversations
  - Getting recent projects

### Component Interfaces
- Update `ConversationDrawer` props if needed
- Potential modifications to `ConversationList` for sorting
- Possible shared components between project and conversation views

### Styling and Animations
- Use consistent styling with the rest of the application
- Leverage Tailwind for responsive design
- Use CSS transitions for smooth state changes

## Next Steps
1. Begin with updating the basic structure of ConversationDrawer
2. Implement the collapsed view with icons
3. Add the expanded view with recent projects
4. Connect all the state management
5. Refine transitions and animations
6. Test thoroughly across scenarios 