# Plan: Implementing Grant and Research Modes

## Overview
This plan outlines the steps needed to implement separate Grant and Research modes in the MCP system, including UI changes, feature segregation, and mode-specific behaviors.

## Phase 1: Mode Infrastructure

### 1.1 Create Mode Types and State Management
- Define mode types (Grant/Research) in TypeScript
- Create mode context and provider
- Implement mode switching logic
- Add mode persistence in local storage

### 1.2 UI Mode Indicators
- Add mode selection icons to the interface
  - Grant Mode: Document/Grant icon
  - Research Mode: DNA/Atomic icon
- Implement mode switching animation
- Add mode-specific color themes/styling

## Phase 2: Feature Matrix Definition

### 2.1 Document Feature Availability
Create a feature matrix showing availability across modes:

| Feature Category | Grant Mode | Research Mode | Both |
|-----------------|------------|---------------|------|
| File Management | ✓ Specific Aims<br>✓ Grant Proposals | ✓ Lab Data<br>✓ Research Notes | ✓ General Files |
| Chat Interface | ✓ Grant Review<br>✓ Proposal Feedback | ✓ Research Analysis<br>✓ Data Interpretation | ✓ General Chat |
| MCP Servers | ✓ aims-review-mcp<br>✓ grant-fetch-mcp | ✓ research-analysis-mcp<br>✓ data-processing-mcp | ✓ Core Services |

### 2.2 Define Mode-Specific Behaviors
Document how shared features behave differently in each mode:
- File upload defaults
- Search behavior
- Chat context handling
- Tool availability

## Phase 3: Implementation Steps

### 3.1 UI Components
1. Create mode selector component
2. Implement mode-specific styling
3. Add mode-aware components
4. Update existing components for mode awareness

### 3.2 Feature Implementation
1. Update file management system
   - Add mode-specific file types
   - Implement mode-specific storage
   - Update file viewers

2. Modify chat interface
   - Add mode context to chat
   - Implement mode-specific prompts
   - Update message handling

3. Update MCP server integration
   - Add mode awareness to API calls
   - Implement mode-specific endpoints
   - Update response handling

### 3.3 Testing Requirements
1. Mode switching functionality
2. Feature availability verification
3. Data isolation between modes
4. UI/UX consistency
5. Performance impact assessment

## Phase 4: Documentation Updates

### 4.1 User Documentation
1. Update README files
2. Create mode-specific guides
3. Update troubleshooting guides
4. Add mode-specific examples

### 4.2 Developer Documentation
1. Document mode implementation
2. Update API documentation
3. Add mode-specific development guides
4. Update testing guidelines

## Implementation Order

1. **Foundation (Week 1)**
   - Create mode infrastructure
   - Add basic UI indicators
   - Implement mode switching

2. **Core Features (Week 2)**
   - Update file management
   - Modify chat interface
   - Add mode-specific styling

3. **Integration (Week 3)**
   - Update MCP server integration
   - Implement feature matrix
   - Add mode-specific behaviors

4. **Polish (Week 4)**
   - Complete documentation
   - Perform testing
   - Add final UI polish

## Questions to Resolve

1. How should user preferences be handled across modes?
2. What is the default mode on first launch?
3. How to handle mode-specific data migration?
4. What are the performance implications?
5. How to handle mode-specific errors?

## Next Steps

1. Review and approve feature matrix
2. Begin Phase 1 implementation
3. Create detailed technical specifications
4. Set up testing environment
5. Begin UI component development

Would you like to proceed with any specific phase or need more details about any part of the plan? 