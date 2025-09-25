more information # PubTator Snippet View - Clickable Entities Implementation Plan

**🎯 Purpose:** Enhance the PubTator snippet view to make entity markup clickable, allowing users to click on `@<m>GENE_FAM177A1</m>` style entities and add them to their chat input area.

**📊 Current State:** Snippet view displays text with markdown bold formatting for `@@@text@@@` but renders `@<m>entity</m>` as plain text  
**🎨 Target State:** Clickable entity buttons that add entity markup to user's text input  
**🔧 Implementation:** Text processing + UI components + state management integration

## 📋 Current Implementation Analysis

### Existing Snippet View Structure
**File:** `src/components/artifacts/ArtifactContent.tsx` (Lines 509-572)

**Current Rendering:**
```typescript
case 'application/vnd.snippet-view':
  // ... parsing logic ...
  return (
    <div className="prose max-w-none dark:prose-invert">
      <h2>Snippet View Results</h2>
      {snippets.map((entry: any, index: number) => (
        <div key={entry.pmid || index} className="mb-6 border-l-4 border-blue-200 pl-4">
          {/* Snippet Text */}
          <div className="mb-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border">
            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
              {entry.snippet || 'No snippet available'}
            </p>
          </div>
          {/* Bibliography Entry */}
          <p className="[text-indent:-1em] [padding-left:1em] text-sm">
            {/* ... bibliography formatting ... */}
          </p>
        </div>
      ))}
    </div>
  );
```

### Current Text Processing
**File:** `custom-mcp-servers/pubtator-mcp/src/index.ts` (Lines 709-713)

```typescript
// Convert PubTator markup to markdown formatting
cleanSnippet = cleanSnippet
  .replace(/@@@([^@]+)@@@/g, '**$1**')  // Convert @@@text@@@ to **text** (markdown bold)
  .replace(/\s+/g, ' ')                 // Normalize whitespace
  .trim();
```

### Current Text Example
**Input:**
```
"This delay is phenocopied by the loss of @<m>GENE_FAM177A1</m> @GENE_100126028 @@@FAM177A1@@@, a Golgi complex protein..."
```

**Output:**
```
"This delay is phenocopied by the loss of @<m>GENE_FAM177A1</m> @GENE_100126028 **FAM177A1**, a Golgi complex protein..."
```

## 🎯 Target Implementation

### 1. Enhanced Text Processing

**File:** `custom-mcp-servers/pubtator-mcp/src/index.ts`

**New Processing Logic:**
```typescript
// Convert PubTator markup to clickable format
cleanSnippet = cleanSnippet
  .replace(/@@@([^@]+)@@@/g, '**$1**')  // Convert @@@text@@@ to **text** (markdown bold)
  .replace(/@<m>([^<]+)<\/m>/g, '[CLICKABLE]@<m>$1</m>[/CLICKABLE]')  // Mark clickable entities
  .replace(/\s+/g, ' ')                 // Normalize whitespace
  .trim();
```

**Output Example:**
```
"This delay is phenocopied by the loss of [CLICKABLE]@<m>GENE_FAM177A1</m>[/CLICKABLE] @GENE_100126028 **FAM177A1**, a Golgi complex protein..."
```

### 2. New UI Component Function

**File:** `src/components/artifacts/ArtifactContent.tsx`

**New Function:**
```typescript
function parseSnippetWithClickables(snippet: string, onEntityClick: (entity: string) => void) {
  const parts = snippet.split(/(\[CLICKABLE\][^[]+\[\/CLICKABLE\])/);
  
  return parts.map((part, index) => {
    if (part.startsWith('[CLICKABLE]') && part.endsWith('[/CLICKABLE]')) {
      const entityMarkup = part.slice(11, -12); // Remove markers
      const entityName = entityMarkup.replace(/@<m>([^<]+)<\/m>/, '$1');
      
      return (
        <button
          key={index}
          onClick={() => onEntityClick(entityMarkup)}
          className="inline-block px-2 py-1 mx-1 text-xs font-medium text-blue-700 bg-blue-100 border border-blue-300 rounded hover:bg-blue-200 hover:text-blue-800 transition-colors duration-200 cursor-pointer"
          title={`Click to add "${entityMarkup}" to your search`}
        >
          {entityName}
        </button>
      );
    }
    
    // Render markdown for regular text
    return (
      <span key={index}>
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {part}
        </ReactMarkdown>
      </span>
    );
  });
}
```

### 3. Updated Snippet Rendering

**File:** `src/components/artifacts/ArtifactContent.tsx`

**New Rendering Logic:**
```typescript
case 'application/vnd.snippet-view':
  try {
    const snippetData = typeof artifact.content === 'string' 
      ? JSON.parse(artifact.content) 
      : artifact.content;
    
    const snippets = snippetData.snippets || [];
    
    const handleEntityClick = (entityMarkup: string) => {
      // Add entity to user's text input
      appendToUserInput(entityMarkup);
    };
    
    return (
      <div className="prose max-w-none dark:prose-invert">
        <h2>Snippet View Results</h2>
        {snippets.map((entry: any, index: number) => {
          const displayAuthors = entry.authors && entry.authors.length > 5 
            ? entry.authors.slice(0, 5)
            : entry.authors || [];
          
          const hasMoreAuthors = entry.authors && entry.authors.length > 5;
          const allAuthors = entry.authors ? entry.authors.join(', ') : '';

          return (
            <div key={entry.pmid || index} className="mb-6 border-l-4 border-blue-200 pl-4">
              {/* Snippet Text with Clickable Entities */}
              <div className="mb-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border">
                <div className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                  {parseSnippetWithClickables(entry.snippet, handleEntityClick)}
                </div>
              </div>
              
              {/* Bibliography Entry */}
              <p className="[text-indent:-1em] [padding-left:1em] text-sm">
                {index + 1}. {displayAuthors.join(', ')}
                {hasMoreAuthors && (
                  <span 
                    title={allAuthors}
                    className="cursor-help"
                  >, et al.</span>
                )} ({entry.year || 'n.d.'}). {entry.title || 'Untitled'}. <em>{entry.journal || ''}</em>.{' '}
                {entry.pmid && (
                  <a
                    href={`https://pubmed.ncbi.nlm.nih.gov/${entry.pmid}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="relative inline-block ml-2 text-xs text-gray-600 hover:text-gray-800 bg-gray-100 hover:bg-gray-200 rounded no-underline"
                    style={{ 
                      padding: '2px 8px',
                      textIndent: 0,
                      lineHeight: 'normal',
                      verticalAlign: 'middle'
                    }}
                  >
                    Link to paper
                  </a>
                )}
              </p>
            </div>
          );
        })}
      </div>
    );
  } catch (error) {
    console.error('Failed to parse snippet view:', error);
    return <div className="prose max-w-none whitespace-pre-wrap">{typeof artifact.content === 'string' ? artifact.content : 'Invalid snippet view format'}</div>;
  }
```

## 🔧 State Management Integration

### 1. Chat Store Enhancement

**File:** `src/store/chatStore.ts`

**New Function:**
```typescript
interface ChatStore {
  // ... existing properties ...
  appendToUserInput: (text: string) => void;
}

const useChatStore = create<ChatStore>((set, get) => ({
  // ... existing state ...
  
  appendToUserInput: (text: string) => {
    const currentInput = get().userInput || '';
    const newInput = currentInput + (currentInput ? ' ' : '') + text;
    set({ userInput: newInput });
  },
}));
```

### 2. Artifact Component Integration

**File:** `src/components/artifacts/ArtifactContent.tsx`

**Import and Usage:**
```typescript
import { useChatStore } from '../../store/chatStore';

export const ArtifactContent: React.FC<{
  artifact: Artifact;
  storageService?: any;
}> = ({ artifact, storageService }) => {
  const appendToUserInput = useChatStore(state => state.appendToUserInput);
  
  // ... existing code ...
  
  const handleEntityClick = (entityMarkup: string) => {
    appendToUserInput(entityMarkup);
  };
  
  // ... rest of component ...
};
```

## 🎨 Visual Design Specifications

### Clickable Entity Button Styling
```css
/* Base button styling */
.inline-block.px-2.py-1.mx-1.text-xs.font-medium.text-blue-700.bg-blue-100.border.border-blue-300.rounded

/* Hover effects */
.hover:bg-blue-200.hover:text-blue-800

/* Transition */
.transition-colors.duration-200

/* Cursor */
.cursor-pointer
```

### Button Appearance
- **Background:** Light blue (`bg-blue-100`)
- **Text:** Dark blue (`text-blue-700`)
- **Border:** Blue border (`border-blue-300`)
- **Hover:** Darker blue background (`hover:bg-blue-200`)
- **Size:** Small padding (`px-2 py-1`)
- **Font:** Small, medium weight (`text-xs font-medium`)

### Accessibility Features
- **Title attribute:** Shows full entity markup on hover
- **Keyboard navigation:** Standard button behavior
- **Screen reader:** Proper button semantics
- **Focus indicators:** Visible focus states

## 📊 Data Flow Architecture

### 1. Text Processing Flow
```
PubTator API → processSnippetData() → Markup Conversion → UI Rendering
```

### 2. Click Event Flow
```
User Click → handleEntityClick() → appendToUserInput() → Chat Input Update
```

### 3. State Update Flow
```
Artifact Component → Chat Store → Chat Input Component → User Input Field
```

## 🧪 Testing Strategy

### 1. Unit Tests
```typescript
// Test text processing
describe('processSnippetData', () => {
  it('should convert @<m> entities to clickable markers', () => {
    const input = 'Text with @<m>GENE_FAM177A1</m> entity';
    const result = processSnippetData([{ text_hl: input }]);
    expect(result[0].snippet).toContain('[CLICKABLE]@<m>GENE_FAM177A1</m>[/CLICKABLE]');
  });
});

// Test UI parsing
describe('parseSnippetWithClickables', () => {
  it('should render clickable buttons for marked entities', () => {
    const snippet = 'Text with [CLICKABLE]@<m>GENE_FAM177A1</m>[/CLICKABLE] entity';
    const result = parseSnippetWithClickables(snippet, jest.fn());
    // Verify button rendering
  });
});
```

### 2. Integration Tests
```typescript
// Test full click flow
describe('Entity Click Integration', () => {
  it('should add entity to user input when clicked', () => {
    // Render snippet view
    // Click on entity button
    // Verify chat input is updated
  });
});
```

### 3. Visual Tests
- **Button appearance** in light/dark mode
- **Hover effects** and transitions
- **Responsive design** on mobile/desktop
- **Accessibility** with keyboard navigation

## 🚧 Implementation Phases

### Phase 1: Text Processing (1-2 hours)
- [ ] Update `processSnippetData()` function
- [ ] Add clickable entity markers
- [ ] Test text processing with sample data

### Phase 2: UI Components (2-3 hours)
- [ ] Create `parseSnippetWithClickables()` function
- [ ] Update snippet rendering logic
- [ ] Add button styling and hover effects
- [ ] Test UI rendering

### Phase 3: State Management (3-4 hours)
- [ ] Add `appendToUserInput()` to chat store
- [ ] Integrate with artifact component
- [ ] Test state updates and synchronization
- [ ] Handle edge cases (empty input, existing text)

### Phase 4: Testing & Refinement (2-3 hours)
- [ ] Unit tests for text processing
- [ ] Integration tests for click flow
- [ ] Visual testing and accessibility
- [ ] Performance optimization

### Phase 5: Documentation & Polish (1-2 hours)
- [ ] Update component documentation
- [ ] Add usage examples
- [ ] Final testing and bug fixes

## 🎯 Success Criteria

### Functional Requirements
- [ ] `@<m>entity</m>` markup renders as clickable buttons
- [ ] Clicking buttons adds entity markup to user input
- [ ] Multiple entities can be clicked and added
- [ ] Existing user input is preserved when adding entities

### Visual Requirements
- [ ] Buttons are visually distinct from regular text
- [ ] Hover effects provide clear feedback
- [ ] Buttons work in both light and dark modes
- [ ] Responsive design works on all screen sizes

### Accessibility Requirements
- [ ] Buttons are keyboard navigable
- [ ] Screen readers announce button purpose
- [ ] Focus indicators are visible
- [ ] Color contrast meets WCAG standards

### Performance Requirements
- [ ] Text processing completes in <100ms
- [ ] UI rendering completes in <200ms
- [ ] Click events respond in <50ms
- [ ] No memory leaks in long sessions

## 🔍 Edge Cases & Error Handling

### Text Processing Edge Cases
- **Malformed markup:** `@<m>unclosed` or `@<m>nested<inner></m></m>`
- **Empty entities:** `@<m></m>`
- **Special characters:** `@<m>GENE_123@#$%</m>`
- **Very long entities:** `@<m>very_long_entity_name_that_exceeds_normal_lengths</m>`

### UI Rendering Edge Cases
- **No clickable entities:** Text with only `@@@bold@@@` markup
- **Mixed content:** Text with both clickable and non-clickable markup
- **Empty snippets:** `entry.snippet` is null or empty
- **Malformed JSON:** Artifact content parsing fails

### State Management Edge Cases
- **Empty user input:** Adding entity to empty input field
- **Very long input:** Adding entity when input is near character limit
- **Special characters:** Entity markup with special characters
- **Multiple rapid clicks:** Handling rapid successive clicks

## 📚 Related Documentation

- **Current Implementation:** `README.PLAN.snippet-view.md`
- **Artifact System:** `README.INFO.MCP-artifact.md`
- **Chat Store:** `src/store/chatStore.ts`
- **Artifact Components:** `src/components/artifacts/ArtifactContent.tsx`
- **PubTator MCP:** `custom-mcp-servers/pubtator-mcp/README.md`

## 🎯 Future Enhancements

### Phase 2 Features
- **Entity type icons:** Different icons for genes, diseases, chemicals
- **Entity tooltips:** Show entity details on hover
- **Bulk selection:** Select multiple entities at once
- **Entity history:** Remember recently clicked entities

### Advanced Features
- **Entity relationships:** Show related entities when clicking
- **Entity search:** Search for similar entities
- **Entity favorites:** Save frequently used entities
- **Export functionality:** Export selected entities to file

---

**🎯 Summary:** This plan provides a complete roadmap for implementing clickable entities in the PubTator snippet view. The implementation involves text processing enhancements, UI component updates, state management integration, and comprehensive testing. The feature will significantly improve user experience by allowing direct interaction with entity markup from search results.

**⏱️ Estimated Total Time:** 8-12 hours for full implementation
**🔧 Complexity Level:** Medium (mainly due to state management integration)
**🎨 User Impact:** High (dramatically improves workflow efficiency)
