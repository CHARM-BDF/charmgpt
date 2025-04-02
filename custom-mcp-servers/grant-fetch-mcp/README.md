# Grant Fetch MCP Server

A specialized MCP (Message Control Protocol) server for fetching and converting NIH grant announcements from HTML to well-formatted Markdown.

## Features

- Fetches NIH grant announcements from their HTML source
- Converts complex HTML content to clean, well-structured Markdown
- Handles special formatting cases:
  - Complex tables with colspan/rowspan attributes
  - Section headers with proper hierarchy
  - Title formatting
  - Bold text and list items
  - GitHub Flavored Markdown (GFM) support

## HTML to Markdown Conversion

The server uses a customized version of Turndown with special rules for NIH grant formatting:

### Header Handling
- Title elements are converted to H1 headers (`# Title`)
- Section headers (e.g., "Section II. Award Information") are properly formatted as H2 headers
- Maintains header hierarchy based on HTML structure and class names
- Special handling for data labels and heading classes

### Table Handling
- Preserves complex tables with merged cells (colspan/rowspan) as HTML
- Converts simple tables to GitHub Flavored Markdown format
- Cleans up table HTML by removing unnecessary attributes and whitespace

### Text Formatting
- Bold text is consistently formatted with double asterisks (`**bold**`)
- List items with bold text are properly handled
- Maintains proper spacing and line breaks
- Removes unnecessary scripts and styles

## Usage

1. Install dependencies:
   ```bash
   npm install
   ```

2. Build the TypeScript code:
   ```bash
   npm run build
   ```

3. Run the server:
   ```bash
   npm run dev
   ```

4. Test conversion:
   ```bash
   npx tsx src/simple-test.ts
   ```

## Output

The server generates two files in the `output` directory:
- `original.html`: The original HTML content
- `converted.md`: The converted Markdown content

## Configuration

The conversion process can be customized through the `ConvertToMarkdownArgs` interface:
```typescript
interface ConvertToMarkdownArgs {
    html: string;
    preserveTables?: boolean;  // Default: true
}
```

## Development

The main conversion logic is in `src/tools/markdown.ts`. Key components:
- `convertToMarkdown`: Main conversion function
- Custom Turndown rules for specific formatting needs
- Helper functions for table and header processing

## Dependencies

- `turndown`: Base HTML to Markdown converter
- `turndown-plugin-gfm`: GitHub Flavored Markdown support
- TypeScript for type safety and better development experience 