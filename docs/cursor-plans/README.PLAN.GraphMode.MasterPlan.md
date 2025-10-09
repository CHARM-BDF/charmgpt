# Graph Mode Master Implementation Plan

## Overview

This master plan breaks down the comprehensive Graph Mode data flow fixes into three manageable, sequential plans. Each plan builds on the previous one, allowing for incremental testing and validation.

## Current Status

✅ **Database Schema Fixed** - The P2022 error with `originalCreatedAt` column has been resolved. Mock data now loads successfully.

## Implementation Phases

### Phase 1: Critical Fixes & Basic Functionality
**Status:** Ready to Implement  
**Priority:** HIGH  
**Time:** 1-2 hours  
**Dependencies:** None (database schema already fixed)

**Problems to Solve:**
- Graph Mode context not injected into MCP tools
- deleteNode/deleteEdge API bugs (missing graphId parameter)
- Basic UI refresh reliability
- Cancer dataset intermittent loading issues

**Key Changes:**
1. Implement universal Graph Mode conversation detection
2. Fix database context injection for all MCPs in Graph Mode
3. Fix deleteNode and deleteEdge API routes
4. Add refresh flags to MCP responses
5. Verify cancer dataset loads reliably

**Files to Modify:**
- `backend-mcp-client/src/services/chat/index.ts`
- `backend-mcp-client/src/routes/graph.ts`
- `custom-mcp-servers/graphModeMCPs/graphmodeBaseMCP/src/index.ts`

**Success Criteria:**
- ✅ All MCPs in Graph Mode conversations receive database context
- ✅ Node/edge deletion works correctly
- ✅ Cancer dataset loads without errors
- ✅ UI refreshes after MCP operations

**Plan File:** Create `docs/cursor-plans/README.PLAN.GraphMode.Phase1.CriticalFixes.md`

---

### Phase 2: Enhanced UX & Reliability
**Status:** Pending Phase 1  
**Priority:** MEDIUM  
**Time:** 1-2 hours  
**Dependencies:** Phase 1 complete

**Problems to Solve:**
- No loading indicators during operations
- No user feedback for success/errors
- No manual refresh capability
- Generic error messages

**Key Changes:**
1. Add loading states and spinners
2. Implement toast/notification system
3. Add manual refresh button
4. Improve error messages with specific guidance
5. Add retry logic for failed operations

**Files to Modify:**
- `frontend-client/src/components/artifacts/GraphModeViewer.tsx`
- `frontend-client/src/store/chatStore.ts` (optional)

**Success Criteria:**
- ✅ Loading indicators during refresh
- ✅ Success/error notifications
- ✅ Manual refresh button functional
- ✅ Clear, actionable error messages

**Plan File:** Create `docs/cursor-plans/README.PLAN.GraphMode.Phase2.EnhancedUX.md`

---

### Phase 3: Advanced SSE Implementation (Optional)
**Status:** Pending Phase 1 & 2 evaluation  
**Priority:** LOW (only if race conditions persist)  
**Time:** 3-4 hours  
**Dependencies:** Phases 1 & 2 complete, confirmed race condition issues

**Problems to Solve:**
- Race conditions between database commits and UI refresh
- No real-time progress for complex operations
- Timeout issues with large graphs

**Key Changes:**
1. Convert API routes to Server-Sent Events (SSE)
2. Add progress callbacks to database service
3. Implement SSE client in frontend
4. Add real-time progress UI components
5. Ensure UI only refreshes when operations fully complete

**Files to Modify:**
- `backend-mcp-client/src/routes/graph.ts`
- `backend-mcp-client/src/services/database.ts`
- `frontend-client/src/components/artifacts/GraphModeViewer.tsx`
- `custom-mcp-servers/graphModeMCPs/graphmodeBaseMCP/src/index.ts`

**Success Criteria:**
- ✅ Zero race conditions
- ✅ Real-time progress feedback
- ✅ Works with large graphs (100+ nodes)
- ✅ Operations complete reliably

**Decision Point:** Only implement Phase 3 if:
- Race conditions still occur after Phase 1
- Users need progress feedback for long operations
- Graph sizes exceed 50+ nodes regularly

**Plan File:** Create `docs/cursor-plans/README.PLAN.GraphMode.Phase3.SSE.md`

---

## Implementation Strategy

### Sequential Approach
1. **Implement Phase 1** → Test thoroughly
2. **Evaluate results** → Does it solve the cancer dataset issue?
3. **Implement Phase 2** → Add polish and user experience
4. **Evaluate results** → Are race conditions still occurring?
5. **Conditionally implement Phase 3** → Only if needed

### Testing Between Phases
After each phase:
- Test with diabetes dataset (simple case)
- Test with cancer dataset (complex case)
- Test node/edge creation via MCP
- Test node/edge deletion via MCP
- Verify UI refresh timing
- Check for console errors

### Rollback Strategy
Each phase is independent, so if issues occur:
- Phase 2 issues → Keep Phase 1, fix Phase 2
- Phase 3 issues → Keep Phases 1 & 2, remove Phase 3

---

## Detailed Plan Breakdown

### Phase 1 Detailed Steps

#### Step 1.1: Add Graph Mode Detection Method
**File:** `backend-mcp-client/src/services/chat/index.ts`

```typescript
private async checkIfGraphModeConversation(conversationId?: string): Promise<boolean> {
  if (!conversationId) return false;
  
  try {
    // Check if graph project exists
    const graphProject = await this.graphDb?.getGraphProject(conversationId);
    return !!graphProject;
  } catch (error) {
    console.error('Error checking Graph Mode conversation:', error);
    return false;
  }
}
```

#### Step 1.2: Update Tool Execution Context Injection
**File:** `backend-mcp-client/src/services/chat/index.ts` (executeToolCall method)

```typescript
// Before calling MCP tool, check for Graph Mode
const isGraphModeConversation = await this.checkIfGraphModeConversation(this.currentConversationId);

if (isGraphModeConversation && this.currentConversationId) {
  console.log('🔧 Graph Mode detected - adding database context');
  toolInput = {
    ...toolInput,
    databaseContext: {
      conversationId: this.currentConversationId,
      apiBaseUrl: process.env.API_BASE_URL || 'http://localhost:3001',
      accessToken: process.env.ACCESS_TOKEN
    }
  };
}
```

#### Step 1.3: Fix deleteNode API Route
**File:** `backend-mcp-client/src/routes/graph.ts` (line ~169)

Add graphProject lookup and pass graphId to deleteNode.

#### Step 1.4: Fix deleteEdge API Route
**File:** `backend-mcp-client/src/routes/graph.ts` (line ~201)

Add graphProject lookup and pass graphId to deleteEdge.

#### Step 1.5: Add Refresh Flags to MCP Tools
**File:** `custom-mcp-servers/graphModeMCPs/graphmodeBaseMCP/src/index.ts`

Add `refreshGraph: true` to all tool responses.

---

### Phase 2 Detailed Steps

#### Step 2.1: Add Loading State Management
**File:** `frontend-client/src/components/artifacts/GraphModeViewer.tsx`

Add `isRefreshing` state and wrap loadGraphDataFromDatabase.

#### Step 2.2: Create Notification System
**File:** `frontend-client/src/components/artifacts/GraphModeViewer.tsx`

Add notification state and showNotification function.

#### Step 2.3: Add Manual Refresh Button
**File:** `frontend-client/src/components/artifacts/GraphModeViewer.tsx`

Add button to toolbar with RefreshCw icon.

#### Step 2.4: Enhance Error Messages
**File:** `frontend-client/src/components/artifacts/GraphModeViewer.tsx`

Replace generic errors with specific, actionable messages.

---

### Phase 3 Detailed Steps (Conditional)

#### Step 3.1: Implement SSE API Endpoints
Convert POST/DELETE routes to SSE streams.

#### Step 3.2: Add Progress Callbacks
Enhance database methods with progress reporting.

#### Step 3.3: Build SSE Client
Add EventSource management in frontend.

#### Step 3.4: Create Progress UI
Add visual progress indicators.

---

## Risk Assessment

### Phase 1 Risks
- **Low Risk**: Straightforward bug fixes and feature additions
- **Mitigation**: Thorough testing with both datasets

### Phase 2 Risks
- **Low Risk**: UI-only changes, no business logic impact
- **Mitigation**: Visual testing and user feedback

### Phase 3 Risks
- **Medium Risk**: Complex SSE implementation, potential for new bugs
- **Mitigation**: Only implement if absolutely necessary, extensive testing

---

## Success Metrics

### Phase 1
- 100% success rate for cancer dataset loading
- Zero deleteNode/deleteEdge errors
- All MCPs receive database context in Graph Mode

### Phase 2
- Users receive feedback within 100ms of action
- Zero user confusion about operation status
- Manual refresh works 100% of time

### Phase 3
- Zero race conditions under stress testing
- Progress updates every 500ms for long operations
- Works with graphs up to 200 nodes

---

## Time Estimates

- **Phase 1:** 1-2 hours implementation + 30 min testing = **2.5 hours total**
- **Phase 2:** 1-2 hours implementation + 30 min testing = **2.5 hours total**
- **Phase 3:** 3-4 hours implementation + 1 hour testing = **5 hours total** (if needed)

**Total Time (Phases 1-2):** ~5 hours  
**Total Time (All Phases):** ~10 hours

---

## Next Steps

1. **Create Phase 1 detailed plan** using the outline above
2. **Implement Phase 1** in agent mode
3. **Test thoroughly** with both datasets
4. **Evaluate success** - does it solve the issues?
5. **Create Phase 2 plan** if Phase 1 successful
6. **Repeat process** for Phase 2
7. **Decide on Phase 3** based on results

---

## Reference Documents

- **Original Comprehensive Plan:** `docs/cursor-plans/README.PLAN.GraphMode.MCP_addingData.md`
- **Database Fix Plan (Complete):** Database schema issues resolved
- **UI Reload Reference:** `docs/cursor-plans/README.PLAN.graphMode.mcp_reloadUI.md`
- **Main Architecture:** `docs/cursor-plans/README.PLAN.Graphmode2.md`
