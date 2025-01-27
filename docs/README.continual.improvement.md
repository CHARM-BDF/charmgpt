# Continual Improvement Lessons

## React-Markdown Code Block Styling

### Understanding the DOM Structure
When using react-markdown with code blocks, it's important to understand the nested structure:
1. react-markdown creates an outer `<pre>` tag for code blocks (standard markdown behavior)
2. Your custom code component renders inside that `<pre>`
3. If using SyntaxHighlighter, its content renders inside your component

### Key Points for Styling Code Blocks
1. The `PreTag="div"` prop in SyntaxHighlighter only affects its own container, not the outer react-markdown `<pre>` tag
2. To control the background color effectively, you need to style:
   - The outer `<pre>` tag using the `pre` component in react-markdown
   - The container div's background
   - The SyntaxHighlighter's background through customStyle

### Example Solution
```typescript
components={{
  pre: ({node, ...props}) => (
    <pre className="bg-white" {...props} />
  ),
  code: ({node, inline, className, children, ...props}) => {
    // ... code component logic ...
    return !inline ? (
      <div className="mb-4 overflow-hidden rounded-md border border-gray-200">
        {/* Header */}
        <div className="bg-white">
          <SyntaxHighlighter
            style={oneLight}
            customStyle={{
              margin: 0,
              borderRadius: 0,
              background: 'white'
            }}
          >
            {children}
          </SyntaxHighlighter>
        </div>
      </div>
    ) : (
      // Inline code styling
    );
  }
}}
```

### Common Pitfalls
1. Only styling SyntaxHighlighter's background won't affect the outer `<pre>` tag
2. Using `!important` or complex CSS selectors might not be necessary if you handle all layers properly
3. Dark mode requires consideration of all nested elements
4. The background color needs to be set at multiple levels to ensure consistent appearance

### Debugging Steps
1. Inspect the DOM to understand the full element hierarchy
2. Check each layer's background color
3. Ensure styles are applied to both the react-markdown and SyntaxHighlighter components
4. Test both inline and block code scenarios
5. Verify dark mode compatibility if used 

## Markdown Formatting with ReactMarkdown

### Understanding Markdown Processing
1. By default, ReactMarkdown treats text with 4 spaces or tabs as code blocks
2. Leading spaces can interfere with markdown formatting (blockquotes, lists, etc.)
3. The `code` component in ReactMarkdown handles both inline code and code blocks

### Key Points for Markdown Text Handling
1. Only use code blocks for text explicitly marked with triple backticks
2. Remove leading spaces to prevent unintended code block formatting
3. Preserve markdown syntax characters while cleaning spaces
4. Process the entire message content before passing to ReactMarkdown

### Example Solution
```typescript
// In ReactMarkdown components configuration
code: ({node, inline, className, children, ...props}) => {
  const match = /language-(\w+)/.exec(className || '');
  const language = match ? match[1] : '';
  const isFenced = className?.includes('language-');
  
  // Handle inline code (single backticks)
  if (inline) {
    return (
      <code className="bg-gray-100 rounded px-1 py-0.5 text-sm">
        {children}
      </code>
    );
  }
  
  // Handle fenced code blocks (triple backticks)
  if (isFenced) {
    return (
      // Code block styling with SyntaxHighlighter
    );
  }
  
  // For non-code text, remove leading spaces while preserving markdown
  const cleanedText = String(children)
    .split('\n')
    .map(line => line.trimStart())
    .join('\n');
  return cleanedText;
}

// Clean the entire message content
<ReactMarkdown>
  {message.content.split('\n').map(line => line.trimStart()).join('\n')}
</ReactMarkdown>
```

### Common Pitfalls
1. Wrapping non-code text in `<p>` tags prevents markdown processing
2. Returning raw children without cleaning spaces causes formatting issues
3. Not handling both inline and fenced code blocks separately
4. Forgetting to clean the entire message content before processing

### Symptoms of Incorrect Configuration
1. Text appearing in code blocks when it shouldn't
2. Markdown formatting (lists, blockquotes) not being applied
3. Inconsistent formatting between different types of content
4. Leading spaces causing text to be treated as code

### Best Practices
1. Always clean leading spaces from non-code text
2. Use explicit code block markers (triple backticks) for code
3. Handle inline code separately from code blocks
4. Test with various markdown elements (lists, blockquotes, etc.)
5. Preserve markdown syntax while cleaning spaces 