# Artifact Extraction and Button Conversion Documentation

## Overview
This document describes how inline artifacts in chat responses are extracted, stored, and converted into clickable reference buttons.

## XML Format
Artifacts are defined inline in the content where they should appear:

```xml
Here's a meal prep guide:
<artifact type="text/markdown" label="View Full Guide">
# Weekly Meal Prep Guide
- Shopping list
- Prep instructions
- Storage tips
</artifact>
And here are some recipes...
```

## Processing Flow

### 1. Artifact Extraction and Button Creation
In `AssistantMarkdown.tsx`, the `processContent` function:
1. Finds inline artifacts
2. Extracts their content
3. Generates unique IDs
4. Stores them in the artifact collection
5. Replaces them with reference buttons

```typescript
const processContent = (text: string) => {
  const artifacts: Artifact[] = [];
  
  const processed = text.replace(
    /<artifact\s+type="([^"]+)"\s+label="([^"]+)">([\s\S]*?)<\/artifact>/g,
    (match, type, label, content) => {
      const artifactId = crypto.randomUUID();
      
      // Store the artifact
      artifacts.push({
        id: artifactId,
        type,
        title: label,
        content: content.trim()
      });
      
      // Replace with a button reference
      return `<button class="text-sm text-blue-600 dark:text-blue-400 hover:underline" data-artifact-id="${artifactId}">${label}</button>`;
    }
  );

  return { processed, artifacts };
};
```

The regex pattern breaks down as:
- `<artifact\s+` - Matches opening artifact tag with whitespace
- `type="([^"]+)"` - Captures content type
- `\s+label="([^"]+)"` - Captures display label
- `>([\s\S]*?)<\/artifact>` - Captures artifact content (non-greedy match)

### 2. Button Click Handling
A click handler is attached to the markdown content div to handle the reference buttons:

```typescript
React.useEffect(() => {
  const handleArtifactClick = (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.tagName === 'BUTTON' && target.hasAttribute('data-artifact-id')) {
      const artifactId = target.getAttribute('data-artifact-id');
      if (artifactId) {
        selectArtifact(artifactId);
      }
    }
  };

  const markdownElement = markdownRef.current;
  if (markdownElement) {
    markdownElement.addEventListener('click', handleArtifactClick);
    return () => markdownElement.removeEventListener('click', handleArtifactClick);
  }
}, [selectArtifact]);
```

### 3. Artifact Selection
When a button is clicked:
1. The click handler checks if the clicked element is a button with a `data-artifact-id`
2. If found, it extracts the artifact ID
3. Calls `selectArtifact` from the chat store with the ID
4. The chat store then:
   - Finds the artifact with the matching ID
   - Sets it as the selected artifact
   - Shows the artifact window

## Button Styling
The generated buttons have these Tailwind CSS classes:
- `text-sm` - Small text size
- `text-blue-600` - Blue text color (light mode)
- `dark:text-blue-400` - Lighter blue in dark mode
- `hover:underline` - Underline on hover

## Debugging
Console logs are included at key points:
1. When processing content:
   ```typescript
   console.log('Processing content:', { 
     originalText,
     extractedArtifacts: artifacts.length,
     processedContent: processed.substring(0, 200) + '...'
   });
   ```

2. When handling clicks:
   ```typescript
   console.log('Artifact button clicked:', artifactId);
   ```

## Benefits of This Approach
1. Content and artifacts stay naturally paired in the response
2. No need to match up separate artifact definitions
3. More intuitive content structure
4. Automatic ID generation ensures unique references
5. Still maintains clean chat display with on-demand artifact viewing
6. Easier to maintain the relationship between content and its artifacts

## Important Notes
1. The click handler is scoped to the markdown content div
2. Artifact extraction happens before markdown processing
3. Generated IDs are stored with both the button and the artifact
4. The button styling matches the existing chat interface
5. Artifacts can contain any content type (markdown, code, diagrams, etc.) 