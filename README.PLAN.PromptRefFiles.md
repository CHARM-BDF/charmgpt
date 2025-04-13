# File Reference in Prompts Implementation Plan

## Overview
Implement an @ mention system for referencing project files in chat prompts, providing real-time filtering and autocompletion as users type. This will enhance the chat experience by allowing users to easily reference specific files in their prompts.

## Implementation Phases

### Phase 1: File Reference Component
1. Create FileReferencePopup Component
   ```typescript
   interface FileReferencePopupProps {
     query: string;               // Current search query after @
     position: { x: number, y: number }; // Position to show popup
     onSelect: (file: FileEntry) => void; // Handle file selection
     onClose: () => void;        // Close popup
     projectId: string | null;    // Current project context
   }
   ```

2. Add File Search Logic
   - Use existing `storageService.listFiles()` to get project files
   - Implement fuzzy search for file matching
   - Sort results by relevance
   - Cache results for better performance

### Phase 2: Chat Input Integration

1. Modify ChatInput Component
   - Track @ symbol position
   - Manage file reference popup state
   - Handle file selection
   ```typescript
   interface ChatInputState {
     fileRefActive: boolean;
     fileRefQuery: string;
     fileRefPosition: { x: number, y: number };
     selectedRefs: FileEntry[];
   }
   ```

2. Update Input Handling
   - Detect @ symbol typing
   - Track cursor position
   - Handle backspace in references
   - Support multiple references

### Phase 3: Message Processing

1. Update Message Format
   ```typescript
   interface MessageWithFileRefs extends Message {
     fileRefs?: {
       id: string;
       name: string;
       position: number;
     }[];
   }
   ```

2. Modify Message Processing
   - Extract file references from message
   - Include file content/metadata in context
   - Update message display to show references

### Phase 4: UI Implementation

1. File Reference Display
   ```typescript
   // Styles for file references in input
   const fileRefStyles = {
     background: 'bg-blue-100 dark:bg-blue-900/30',
     padding: 'px-1 py-0.5',
     borderRadius: 'rounded',
     fontSize: 'text-sm',
   };
   ```

2. Popup Styling
   - Match existing UI theme
   - Show file icons based on type
   - Display file metadata
   - Implement keyboard navigation

## Technical Details

### File Reference Detection
```typescript
function detectFileReference(text: string): {
  isActive: boolean;
  query: string;
  position: number;
} {
  const match = text.match(/@(\w*)$/);
  return {
    isActive: !!match,
    query: match ? match[1] : '',
    position: match ? match.index! : -1
  };
}
```

### File Search Implementation
```typescript
async function searchFiles(query: string, projectId: string): Promise<FileEntry[]> {
  const files = await storageService.listFiles({
    tags: [`project:${projectId}`]
  });
  
  return files
    .filter(file => file.name.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => {
      // Prioritize files that start with the query
      const aStarts = a.name.toLowerCase().startsWith(query.toLowerCase());
      const bStarts = b.name.toLowerCase().startsWith(query.toLowerCase());
      if (aStarts && !bStarts) return -1;
      if (!aStarts && bStarts) return 1;
      return a.name.localeCompare(b.name);
    });
}
```

### Message Processing Updates
```typescript
interface ProcessedMessage {
  content: string;
  fileRefs: {
    id: string;
    content: string;
    metadata: FileMetadata;
  }[];
}

async function processMessageWithRefs(message: string): Promise<ProcessedMessage> {
  const fileRefs = extractFileRefs(message);
  const fileContents = await Promise.all(
    fileRefs.map(async ref => ({
      id: ref.id,
      ...(await storageService.readFile(ref.id))
    }))
  );
  
  return {
    content: message,
    fileRefs: fileContents
  };
}
```

## Implementation Steps

1. **File Reference Component (2 days)**
   - [ ] Create FileReferencePopup component
   - [ ] Implement file search and filtering
   - [ ] Add keyboard navigation
   - [ ] Style popup to match theme

2. **Chat Input Integration (2 days)**
   - [ ] Add @ symbol detection
   - [ ] Implement popup positioning
   - [ ] Handle file selection
   - [ ] Update input formatting

3. **Message Processing (2 days)**
   - [ ] Update message interface
   - [ ] Implement file content retrieval
   - [ ] Modify message processing
   - [ ] Add file context to prompts

4. **Testing and Refinement (1 day)**
   - [ ] Test with various file types
   - [ ] Test multiple references
   - [ ] Test error cases
   - [ ] Performance optimization

## Future Enhancements

1. **Advanced Features**
   - File preview in popup
   - Reference specific file sections
   - Support for file ranges
   - Rich file metadata display

2. **Performance Optimizations**
   - File list caching
   - Debounced search
   - Lazy loading of file contents
   - Virtual scrolling for large file lists

3. **UX Improvements**
   - File type icons
   - Recent files section
   - Favorite files
   - Custom file groups 