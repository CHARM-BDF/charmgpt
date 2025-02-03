# Chat Message Scrolling Behavior Fix

## Issue Description
The BrainWaveCharm component appeared at different positions when:
- Streaming new messages
- Manually scrolling through chat history

## Root Cause
The `scrollIntoView` behavior was using `block: 'end'`, causing the reference point to align differently during streaming versus manual scrolling.

## Solution
Changed the scroll alignment in `ChatMessages.tsx`:
```typescript
const options: ScrollIntoViewOptions = { 
    behavior: behavior as ScrollBehavior,
    block: 'start' as ScrollLogicalPosition  // Changed from 'end' to 'start'
};
```

## Technical Implementation
1. `messagesEndRef`: Points to bottom div
2. `containerRef`: Main chat container
3. `scrollToBottom`: Handles scroll behavior
4. `isNearBottom`: Checks scroll position

The `block: 'start'` setting aligns the reference element with the viewport's top, creating consistent positioning in all scenarios.

## Scroll Triggers
Auto-scroll activates when:
- New message arrives
- User is near bottom (within 100px)
- User sends message
- Force scroll is needed

## Benefits
- Consistent BrainWaveCharm positioning
- Predictable scrolling behavior
- Improved user experience
- Smooth state transitions

## Adjustments
If needed, can modify:
- `isNearBottom` threshold (100px)
- Container padding/margins
- ScrollLogicalPosition values 