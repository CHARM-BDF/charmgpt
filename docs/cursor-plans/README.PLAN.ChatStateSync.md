# Chat State Synchronization Issue

## Issue Description
When submitting new chat prompts, previous message content and process steps disappear. This happens because:
1. The current view (`state.messages`) and long-term storage (`state.conversations`) get out of sync
2. Switching conversations loads from incomplete conversation storage
3. Results in loss of message content and status updates when navigating conversations

## Recent Fix Applied
We modified the state update logic in `chatStore.ts` to:
1. Create complete messages with all updates (content, status, artifacts)
2. Deep copy these complete messages for conversation storage
3. Keep both current view and long-term storage in sync

## Testing Steps
To verify the fix:
1. Start a new chat conversation
2. Submit a prompt that generates status updates (like searching papers)
3. Switch to another conversation
4. Switch back to verify content is preserved
5. Submit another prompt to verify content stays visible

## Expected Behavior
- Message content should remain visible after submitting new prompts
- Status updates should remain visible and toggleable
- Content should persist when switching between conversations
- All message properties (content, status, artifacts) should be preserved

## If Issues Persist
Note these details:
1. When does content disappear? (new prompt, switching conversations, etc.)
2. What specifically disappears? (message content, status updates, or both)
3. Does switching conversations temporarily fix or worsen the issue?

This will help identify if:
- The state synchronization fix is working as intended
- There are other state management issues to address
- The UI components need updates to handle the state properly 