# PKDED MCP Server

A Model Context Protocol (MCP) server for documentation retrieval and search. This server reads documentation files from a local directory and provides intelligent search and retrieval capabilities.

## Features

- **Document Search**: Semantic search through documentation with relevance scoring
- **Document Retrieval**: Get specific documents by identifier, title, or path
- **Category Organization**: Automatically organizes documents by directory structure
- **Tag Support**: Extracts and searches by document tags
- **Multiple Formats**: Supports Markdown (.md), text (.txt), reStructuredText (.rst), and AsciiDoc (.adoc) files
- **Auto-refresh**: Ability to reload documentation without restarting

## Installation

1. Navigate to the pkded-mcp directory:
```bash
cd custom-mcp-servers/pkded-mcp
```

2. Install dependencies:
```bash
npm install
```

3. Build the server:
```bash
npm run build
# or
chmod +x build.sh && ./build.sh
```

## Configuration

### Directory Structure

The server looks for documentation in a `docs` directory. You can place this directory either:
- In the current working directory when running the server
- Relative to the pkded-mcp package directory

Example structure:
```
pkded-mcp/
├── docs/
│   ├── getting-started/
│   │   ├── installation.md
│   │   └── quick-start.md
│   ├── api/
│   │   ├── authentication.md
│   │   └── endpoints.md
│   └── troubleshooting.md
├── src/
├── dist/
└── package.json
```

### Supported File Formats

- **Markdown** (`.md`): Full support with title extraction from `# Header`
- **Text** (`.txt`): Plain text files
- **reStructuredText** (`.rst`): With title extraction
- **AsciiDoc** (`.adoc`): Basic support

### Tag Support

Documents can include tags in various formats:
- `tags: tag1, tag2, tag3`
- `keywords: keyword1, keyword2`
- `#hashtag` style tags in content

## MCP Configuration

Add to your MCP server configuration:

```json
{
  "mcpServers": {
    "pkded-mcp": {
      "command": "node",
      "args": [
        "./custom-mcp-servers/pkded-mcp/dist/index.js"
      ]
    }
  }
}
```

## Available Tools

### 1. search-docs
Search through documentation based on a query.

**Parameters:**
- `query` (required): Search query string
- `limit` (optional): Maximum number of results (default: 10, max: 50)

**Example:**
```
Search for "authentication API" with limit 5
```

### 2. get-document
Retrieve a specific document by identifier, title, or path.

**Parameters:**
- `identifier` (required): Document identifier, title, or partial path

**Example:**
```
Get document "installation.md" or "API Authentication"
```

### 3. list-documents
List all available documents with metadata.

**Parameters:**
- `category` (optional): Filter by category/directory

**Example:**
```
List all documents in "api" category
```

### 4. list-categories
List all available document categories.

**Parameters:** None

### 5. refresh-docs
Refresh the documentation store by reloading all documents.

**Parameters:** None

## Document Indexing

### Automatic Title Extraction
- Markdown: Uses `# Header` as title
- reStructuredText: Extracts title from header structure
- Other formats: Uses filename or first line

### Category Assignment
Categories are automatically assigned based on directory structure:
- `docs/api/auth.md` → Category: "api"
- `docs/guides/setup/install.md` → Category: "guides/setup"

### Search Algorithm
The search uses a weighted scoring system:
- **Title matches**: 10 points
- **Category matches**: 5 points
- **Tag matches**: 3 points per tag
- **Content matches**: 1 point per word occurrence

## Usage Examples

### Basic Search
```javascript
// Search for installation documentation
{
  "tool": "search-docs",
  "arguments": {
    "query": "installation setup guide",
    "limit": 5
  }
}
```

### Get Specific Document
```javascript
// Get a specific document
{
  "tool": "get-document",
  "arguments": {
    "identifier": "api/authentication.md"
  }
}
```

### Browse by Category
```javascript
// List all API documentation
{
  "tool": "list-documents",
  "arguments": {
    "category": "api"
  }
}
```

## Development

### Building
```bash
npm run build
```

### Development Mode
```bash
npm run dev  # Watches for changes
```

### Testing
```bash
npm start  # Runs the built server
```

### Project Structure
```
pkded-mcp/
├── src/
│   └── index.ts          # Main server implementation
├── dist/                 # Compiled JavaScript
├── docs/                 # Documentation files (create this)
├── package.json
├── tsconfig.json
├── build.sh
└── README.md
```

## Error Handling

The server gracefully handles:
- Missing docs directory (warns and continues)
- Invalid file formats (skips with warning)
- File system errors (logs and continues)
- Malformed documents (uses filename as fallback)

## Logging

The server provides detailed logging through the MCP logging system:
- Document loading progress
- Search operations
- Errors and warnings
- Performance metrics

## Limitations

- In-memory document storage (suitable for moderate documentation sets)
- Basic text search (no advanced NLP)
- File system monitoring not implemented (use refresh-docs manually)

## Contributing

1. Make changes to `src/index.ts`
2. Run `npm run build` to compile
3. Test with your MCP client
4. Submit pull request

## License

MIT License 