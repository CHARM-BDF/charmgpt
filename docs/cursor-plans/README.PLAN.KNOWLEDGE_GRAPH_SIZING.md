# Knowledge Graph Sizing Fix Plan

## Current Issue
The knowledge graph is not properly filling its container width in the ArtifactWindow. We need to systematically check each level of the component hierarchy to identify and fix the sizing issue.

## Test Environment
- Artifact Type: application/vnd.ant.knowledge-graph
- Using ReagraphKnowledgeGraphViewer component
- Testing with actual knowledge graph data

## Component Hierarchy (Detailed)
```
ArtifactWindow (w-1/2, min-w-0)
└── flex-1 flex min-h-0 min-w-0
    └── ArtifactContent
        └── w-full h-full min-h-[400px] flex flex-col
            └── ReagraphKnowledgeGraphViewer
                └── GraphCanvas
```

## What We've Learned So Far
1. Original issue had `minWidth: '900px'` which caused overflow
2. Reducing to `minWidth: '500px'` made the graph too small
3. Removing `minWidth` entirely didn't make the graph fill available space
4. ArtifactWindow has correct `w-1/2` and `min-w-0` classes
5. Background colors not visible in most containers suggests potential layout/rendering issues
6. The graph canvas is deeply nested in multiple flex containers

## Testing Plan

### Step 1: Verify Container Visibility ❌
- Added temporary background colors
- Results:
  - Yellow background not visible in ArtifactWindow
  - Green background not visible in content container
  - Blue background visible only in filters area
  - Suggests potential z-index or rendering order issues

### Step 2: Check Container Heights (Current Focus)
- Verify each container's height calculation:
  1. ArtifactWindow's `flex-col` and `min-w-0`
  2. Inner flex container's `min-h-0` and `min-w-0`
  3. ArtifactContent's `min-h-[400px]`
  4. ReagraphKnowledgeGraphViewer's height calculations

### Step 3: Investigate ResizeObserver
- Check if ResizeObserver in ReagraphKnowledgeGraphViewer is:
  1. Getting correct container dimensions
  2. Properly updating when parent containers resize
  3. Correctly applying dimensions to the canvas

### Step 4: Canvas Rendering
- Verify GraphCanvas component:
  1. Check actual rendered dimensions vs container dimensions
  2. Inspect canvas scaling and viewport settings
  3. Test with explicit width/height values

## Testing Strategy
1. Use browser dev tools to inspect computed styles
2. Add temporary borders instead of backgrounds if needed
3. Log ResizeObserver calculations
4. Test with different viewport sizes

## Potential Solutions (Prioritized)
1. Fix container visibility/rendering issues
2. Adjust container height calculations
3. Update ResizeObserver logic
4. Modify canvas rendering parameters

## Success Criteria
- All containers visible and properly sized
- Graph fills available width in ArtifactWindow
- No horizontal scrolling
- Responsive to window resizing 