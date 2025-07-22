# Wiki Disease MCP Server

An MCP (Model Context Protocol) server that provides tools for searching and retrieving disease information from Wikipedia. This server allows LLMs to access comprehensive medical information from Wikipedia articles, with intelligent summarization instructions.

## Features

- **Disease Search**: Search Wikipedia for disease-related articles with snippets and categories
- **Detailed Information**: Retrieve full Wikipedia articles about specific diseases with section extraction
- **Category Browsing**: Browse diseases by Wikipedia medical categories
- **Markdown Artifacts**: All responses include well-formatted markdown artifacts for easy reading
- **Smart Summarization**: Includes context-aware instructions for LLMs to summarize relevant information

## Installation

1. Clone the repository and navigate to the wiki-disease-mcp directory:
```bash
cd custom-mcp-servers/wiki-disease-mcp
```

2. Install dependencies:
```bash
npm install
```

3. Build the project:
```bash
npm run build
```

## Usage

The server can be integrated with any MCP-compatible client. Add it to your MCP configuration:

```json
{
  "servers": {
    "wiki-disease": {
      "command": "node",
      "args": ["path/to/wiki-disease-mcp/dist/index.js"]
    }
  }
}
```

## Available Tools

### 1. search-disease
Search Wikipedia for disease-related articles.

**Parameters:**
- `disease_name` (required): Name of the disease or medical condition to search for
- `max_results` (optional): Maximum number of results to return (1-20, default: 5)
- `include_categories` (optional): Include category information for each result (default: true)

**Example:**
```json
{
  "disease_name": "diabetes",
  "max_results": 10,
  "include_categories": true
}
```

### 2. get-disease-details
Get detailed information about a specific disease from its Wikipedia page.

**Parameters:**
- `page_title` (required): The exact Wikipedia page title
- `sections` (optional): Specific sections to extract (e.g., ["Symptoms", "Treatment"])

**Example:**
```json
{
  "page_title": "Diabetes mellitus",
  "sections": ["Symptoms", "Treatment", "Prognosis"]
}
```

### 3. get-diseases-by-category
Get a list of diseases from a specific Wikipedia category.

**Parameters:**
- `category` (required): Wikipedia category name (e.g., "Infectious diseases", "Genetic disorders")
- `max_results` (optional): Maximum number of results to return (1-50, default: 10)

**Example:**
```json
{
  "category": "Infectious diseases",
  "max_results": 20
}
```

## Response Format

All tools return:
1. **Text content for the model**: Includes search results or article content with summarization instructions
2. **Markdown artifacts**: Well-formatted markdown documents containing the full information

The summarization instructions guide the LLM to:
- Focus on information relevant to the conversation context
- Highlight specific aspects the user is interested in (symptoms, treatments, etc.)
- Provide concise but comprehensive summaries

## Rate Limiting

The server implements a 1-second delay between Wikipedia API requests to be respectful of Wikipedia's resources.

## Development

- `npm run build` - Build the TypeScript project
- `npm run watch` - Watch for changes and rebuild
- `npm run dev` - Run the development server
- `npm run lint` - Run ESLint

## License

ISC 