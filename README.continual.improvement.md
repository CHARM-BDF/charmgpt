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