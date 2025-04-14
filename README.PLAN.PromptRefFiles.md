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
     storageService: APIStorageService; // Service to fetch files
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
   - Manage file reference popup state using custom hook
   - Handle file selection
   ```typescript
   // Custom hook for file reference state management
   const {
     fileRefState: { isActive, query, position },
     handleInputChange,
     handleFileSelect,
     closeFileRef
   } = useFileReference({
     inputRef: textareaRef,
     onFileSelect: (file: FileEntry, position: number) => {
       // Update input with file reference
     }
   });
   ```

2. Update Input Handling
   - Detect @ symbol typing with regex pattern `/@(\w*)$/`
   - Calculate popup position based on text cursor
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

### Popup Positioning
Important lessons learned during implementation:

1. **Form Element Constraints**
   - Don't place the popup inside the form element
   - Use this structure to ensure proper positioning:
   ```tsx
   <div className="w-full max-w-4xl mx-auto px-4 flex relative">
     {/* Popup outside form but inside container */}
     {isActive && (
       <div className="absolute z-[9999]">
         <FileReferencePopup />
       </div>
     )}
     
     <form>
       <textarea />
     </form>
   </div>
   ```

2. **Positioning Strategy**
   - Use `bottom` positioning instead of negative `top` values
   - Ensure parent has `position: relative`
   - Use high z-index (9999) to prevent overlap issues

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

## Implementation Status

1. **File Reference Component** ✅
   - [x] Created FileReferencePopup component
   - [x] Implemented file search and filtering
   - [x] Added keyboard navigation
   - [x] Styled popup to match theme

2. **Chat Input Integration** ✅
   - [x] Added @ symbol detection
   - [x] Implemented popup positioning
   - [x] Handled file selection
   - [x] Created useFileReference custom hook

3. **Message Processing** 🔄
   - [ ] Update message interface
   - [ ] Implement file content retrieval
   - [ ] Modify message processing
   - [ ] Add file context to prompts

4. **Testing and Refinement** 🔄
   - [x] Tested with various file types
   - [ ] Test multiple references
   - [x] Fixed positioning issues
   - [ ] Performance optimization

## Key Learnings

1. **Positioning Challenges**
   - HTML forms have unexpected constraints on popup child elements
   - Moving the popup outside the form element fixes visibility issues
   - Bottom positioning is more reliable than negative top values

2. **State Management**
   - Custom hooks provide clean separation of concerns
   - Debouncing input updates prevents performance issues
   - Proper keyboard event handling improves accessibility

3. **Styling Considerations**
   - High z-index needed to prevent popup from being hidden
   - Parent containers need relative positioning for proper absolute positioning
   - Explicit dimensions help prevent layout issues

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

## End-to-End File Reference Flow

### 1. File Selection and Text Insertion
When a user selects a file from the popup:
```typescript
onFileSelect: (file: FileEntry, position: number) => {
  // Get text before and after the @ symbol
  const before = inputText.slice(0, position - query.length - 1);
  const after = inputText.slice(position);
  
  // Replace the @query with @filename
  const newInputText = `${before}@${file.name}${after}`;
  
  // Update the input text
  setInputText(newInputText);
}
```

### 2. Message Submission Processing
When a message containing file references is submitted:
```typescript
const handleSubmit = async (message: string) => {
  // 1. Extract file references from the message
  const fileRefs = extractFileReferences(message);
  
  // 2. Fetch file contents for each reference
  const fileContents = await Promise.all(
    fileRefs.map(async ref => ({
      id: ref.id,
      name: ref.name,
      content: await storageService.readFile(ref.id),
      metadata: await storageService.getFileMetadata(ref.id)
    }))
  );
  
  // 3. Construct enhanced message with file contents
  const enhancedMessage = {
    originalMessage: message,
    fileReferences: fileContents
  };
  
  // 4. Send to LLM with file context included
  return await aiService.processMessageWithContext(enhancedMessage);
};
```

### 3. LLM Context Enhancement
The file content is made available to the LLM by:
1. Including file contents in the prompt context
2. Using a specific format to denote file content sections:

```
User message: Please analyze @example.csv and tell me what patterns you see.

File content context:
<file name="example.csv">
id,name,value
1,alpha,10.5
2,beta,20.3
3,gamma,15.7
</file>
```

This approach ensures that:
- The LLM has full access to the referenced file content
- The relationship between the reference and content is clear
- Multiple file references can be included in a single prompt
- The user doesn't need to manually copy/paste file contents 