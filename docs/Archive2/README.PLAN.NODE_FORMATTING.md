# Plan: Move Node Formatting to Templates

## Current State
- Node colors are currently assigned in `formatters.ts` using `getColorForEntityType`
- Starting nodes are marked with `isStartingNode` flag
- Node formatting is scattered between formatters and viewer

## Goal
- Move node formatting to templates
- Ensure starting nodes have visible outlines
- Make minimal changes to achieve this

## Implementation Steps

### Step 1: Create Node Template Interface
1. Create new file `src/types/nodeTemplate.ts`
   - Define interface for node templates
   - Include color, stroke, strokeWidth properties
   - Export default templates for each node type

### Step 2: Modify Formatters (Minimal Changes)
1. Update `formatters.ts`:
   - Remove `getColorForEntityType` function
   - Keep `isStartingNode` flag setting
   - Remove color assignments

### Step 3: Update ReagraphKnowledgeGraphViewer
1. Modify `graphData` transformation:
   - Apply node templates based on entityType
   - Add stroke properties for starting nodes
   - Keep existing node structure

### Step 4: Test and Verify
1. Test with existing knowledge graphs
2. Verify starting nodes show outlines
3. Verify node colors are preserved

## Files to Modify
1. `src/types/nodeTemplate.ts` (new)
2. `custom-mcp-servers/medik-mcp/src/formatters.ts`
3. `src/components/artifacts/ReagraphKnowledgeGraphViewer.tsx`

## Risks and Considerations
- Maintain backward compatibility
- Preserve existing node identification
- Ensure minimal impact on other features

## Success Criteria
- Starting nodes have visible outlines
- Node formatting controlled by templates
- No disruption to existing functionality 