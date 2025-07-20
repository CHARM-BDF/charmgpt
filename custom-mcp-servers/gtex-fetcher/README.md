# MCP API Integration Template

This template provides a comprehensive foundation for rapidly creating Model Context Protocol (MCP) servers that integrate with external APIs. It's based on proven patterns from the PubMed and Gene Fetcher MCP implementations.

## Overview

This template handles:
- ✅ MCP server setup and configuration
- ✅ Input validation with Zod schemas
- ✅ External API authentication and requests
- ✅ Data formatting for both text and artifact responses
- ✅ Error handling and logging
- ✅ TypeScript configuration
- ✅ Development tooling

## Artifact Types and Formatting

The MCP client supports several artifact types that determine how the content is displayed. When creating artifacts, use these supported types:

### Text and Documentation
- `text/markdown` - Rendered markdown with full styling support
  ```typescript
  {
    type: 'text/markdown',
    title: 'Document Title', // Required for proper display
    name: 'filename.md',
    content: markdownContent
  }
  ```

### Code and Data
- `code` - Generic code with optional language specification
- `application/python` - Python code
- `application/javascript` - JavaScript code
- `application/vnd.react` - React/JSX code
- `application/json` - JSON data
- `application/vnd.ant.json` - Specialized JSON data

Example:
```typescript
{
  type: 'application/python',
  title: 'Python Script',
  name: 'script.py',
  language: 'python', // Optional but recommended
  content: pythonCode
}
```

### Knowledge Graphs and Visualizations
- `application/vnd.knowledge-graph` - Knowledge graph data
- `application/vnd.ant.knowledge-graph` - Alternative knowledge graph format
- `application/vnd.ant.mermaid` - Mermaid diagrams
- `image/png` - PNG images (base64 encoded)
- `image/svg+xml` - SVG images

### Specialized Types
- `application/vnd.bibliography` - Bibliography entries
- `html` - Raw HTML content
- `text` - Plain text content

## Quick Start

1. **Copy this template** to a new directory:
   ```bash
   cp -r template2/ your-api-name-mcp/
   cd your-api-name-mcp/
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Follow the customization steps** below

4. **Test your implementation**:
   ```bash
   npm run dev
   ```

## Example Implementation

Here's a basic example of an MCP tool that returns both text and a markdown artifact:

```typescript
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === "search-data") {
    try {
      // Get data from your API
      const data = await fetchDataFromAPI(args);
      
      // Format for both text response and markdown artifact
      const formattedContent = formatDataAsMarkdown(data);

      return {
        content: [
          {
            type: "text",
            text: `# Instructions for Response
When using this data, please:
1. Maintain the structured format
2. Reference sections by their headings
3. Use the provided links when applicable

${formattedContent}`
          }
        ],
        artifacts: [
          {
            type: 'text/markdown',
            title: 'Search Results',  // Required for proper display
            name: 'search_results.md',
            content: formattedContent
          }
        ]
      };
    } catch (error) {
      throw new Error(`Failed to retrieve data: ${error.message}`);
    }
  }
});
```

## Customization Checklist

### 1. Update Package Configuration

**File: `package.json`**
- [ ] Change `name` from `@custom-mcp/example-api` to your API name
- [ ] Update `description` with your API's purpose
- [ ] Add any additional dependencies your API needs (see template notes)

**File: `src/index.ts`** - Configuration Section (lines 11-35)
- [ ] Replace `API_BASE_URL` with your API's base URL
- [ ] Replace `TOOL_NAME` with your MCP tool name
- [ ] Replace `SERVICE_NAME` with your service name
- [ ] Update environment variable names (e.g., `EXAMPLE_API_KEY` → `YOUR_API_KEY`)
- [ ] Add any additional configuration constants

### 2. Define Input Schemas

**File: `src/index.ts`** - Schema Definitions Section (lines 37-70)

For each tool you want to create:
- [ ] Customize `SearchArgumentsSchema` for your search parameters
- [ ] Customize `GetDetailsArgumentsSchema` for your detail parameters
- [ ] Add additional schemas for other tools (create, update, analyze, etc.)

**Common schema patterns:**
```typescript
// For APIs with categories/filters
category: z.enum(['research', 'news', 'clinical']).optional(),

// For date ranges
date_range: z.object({
  start: z.string().optional(),
  end: z.string().optional()
}).optional(),

// For pagination
page: z.number().min(1).optional().default(1),
per_page: z.number().min(1).max(100).optional().default(10),

// For sorting
sort_by: z.enum(['date', 'relevance', 'title']).optional().default('relevance'),
sort_order: z.enum(['asc', 'desc']).optional().default('desc'),
```

### 3. Customize API Request Function

**File: `src/index.ts`** - API Request Helper Section (lines 87-130)

- [ ] Update URL construction pattern for your API
- [ ] Configure authentication headers for your API
- [ ] Adjust response parsing (JSON, XML, HTML, etc.)
- [ ] Add rate limiting if needed
- [ ] Add retry logic if needed

**Common authentication patterns:**
```typescript
// Bearer token
headers['Authorization'] = `Bearer ${API_KEY}`;

// API key in header
headers['X-API-Key'] = API_KEY;

// API key in query parameter
const url = new URL(`${API_BASE_URL}/${endpoint}`);
url.searchParams.append('api_key', API_KEY);

// Basic auth
headers['Authorization'] = `Basic ${btoa(`${username}:${password}`)}`;
```

**Response parsing patterns:**
```typescript
// JSON (most common)
return await response.json();

// XML
const text = await response.text();
const parser = new DOMParser();
return parser.parseFromString(text, "text/xml");

// HTML (requires cheerio)
const html = await response.text();
return cheerio.load(html);

// Plain text
return await response.text();
```

### 4. Implement Data Formatting

**File: `src/index.ts`** - Data Formatting Functions Section (lines 132-190)

#### `formatRecordForModel()` Function
This formats individual records for Claude to read. **Critical considerations:**
- Include the most important fields that Claude needs to understand the data
- Use clear, readable formatting with markdown
- Keep it concise but informative
- Consider what fields are most valuable for analysis/discussion

**Example implementations:**
```typescript
// For research papers
function formatRecordForModel(record: any): string {
  return [
    `**Title:** ${record.title}`,
    `**Authors:** ${record.authors?.join(', ') || 'Unknown'}`,
    `**Published:** ${record.publish_date}`,
    `**Abstract:** ${record.abstract}`,
    `**DOI:** ${record.doi}`,
    "---"
  ].filter(Boolean).join("\n");
}

// For news articles
function formatRecordForModel(record: any): string {
  return [
    `**Headline:** ${record.headline}`,
    `**Source:** ${record.source}`,
    `**Date:** ${record.published_at}`,
    `**Summary:** ${record.summary}`,
    `**URL:** ${record.url}`,
    "---"
  ].filter(Boolean).join("\n");
}

// For datasets
function formatRecordForModel(record: any): string {
  return [
    `**Dataset:** ${record.name}`,
    `**Description:** ${record.description}`,
    `**Size:** ${record.record_count} records`,
    `**Last Updated:** ${record.updated_at}`,
    `**Format:** ${record.format}`,
    "---"
  ].filter(Boolean).join("\n");
}
```

#### `formatArtifactData()` Function
This creates structured data for programmatic use. **Critical considerations:**
- Include all relevant structured data that might be useful for further processing
- Consider what data users might want to export, analyze, or reference
- Use consistent field names and data types
- Choose appropriate artifact MIME types

**Artifact type examples:**
```typescript
// For bibliographic data
type: "application/vnd.bibliography"
content: [{
  authors: string[],
  title: string,
  journal: string,
  year: string,
  doi: string,
  pmid: string
}]

// For tabular data
type: "application/vnd.dataset" 
content: [{
  id: string,
  name: string,
  value: number,
  category: string
}]

// For analysis results
type: "application/vnd.analytics"
content: {
  summary: { total: number, categories: Record<string, number> },
  data: any[]
}

// For general structured data
type: "application/json"
content: any
```

### 5. Implement Query Building

**File: `src/index.ts`** - Query/Search Helper Functions Section (lines 209-230)

Customize `buildSearchQuery()` for your API's query format:

**REST API with query parameters:**
```typescript
function buildSearchQuery(searchParams: any): string {
  const { query, max_results, category, date_range } = searchParams;
  const params = new URLSearchParams();
  params.append('q', query);
  params.append('limit', max_results.toString());
  if (category) params.append('category', category);
  if (date_range?.start) params.append('start_date', date_range.start);
  if (date_range?.end) params.append('end_date', date_range.end);
  return params.toString();
}
```

**GraphQL API:**
```typescript
function buildSearchQuery(searchParams: any): string {
  const { query, max_results } = searchParams;
  return JSON.stringify({
    query: `
      query SearchRecords($query: String!, $limit: Int!) {
        search(query: $query, limit: $limit) {
          id
          title
          description
        }
      }
    `,
    variables: { query, limit: max_results }
  });
}
```

### 6. Define Your Tools

**File: `src/index.ts`** - Tool Definitions Section (lines 235-310)

For each tool in the `tools` array:
- [ ] Update `name` to match your tool's purpose
- [ ] Write clear `description` explaining what the tool does
- [ ] Define `inputSchema` with all required and optional parameters
- [ ] Add parameter descriptions and validation rules

**Tool naming conventions:**
- `search` - for searching/querying the API
- `get-details` - for retrieving detailed information by ID
- `analyze` - for performing analysis on data
- `create` - for creating new records
- `update` - for updating existing records
- `export` - for exporting data in specific formats

### 7. Implement Tool Execution

**File: `src/index.ts`** - Tool Execution Section (lines 315-450)

For each tool, implement the execution logic:

#### Search Tool Implementation
- [ ] Update endpoint path for your search API
- [ ] Adjust response data extraction based on your API structure
- [ ] Customize the response text and artifact formatting

#### Get Details Tool Implementation  
- [ ] Update endpoint pattern for retrieving individual records
- [ ] Adjust response data extraction
- [ ] Customize the detailed record formatting

**Common API response patterns:**
```typescript
// Response with data wrapper
const records = searchData.data.results;

// Response with pagination wrapper
const records = searchData.results.items;

// Direct array response
const records = searchData;

// Nested response structure
const records = searchData.response.docs;
```

### 8. Update Environment Variables

Create a `.env` file (don't commit it!) with your API credentials:
```bash
YOUR_API_KEY=your_actual_api_key_here
YOUR_USER_EMAIL=your.email@example.com
```

Update your shell configuration or IDE to use these variables during development.

### 9. Test Your Implementation

1. **Test basic functionality:**
   ```bash
   npm run dev
   ```

2. **Test with your MCP client** (Claude Desktop, etc.)

3. **Verify both tools work correctly**

4. **Check that artifacts are properly formatted**

## Common API Integration Patterns

### REST APIs
- Use query parameters for search
- Use path parameters for getting specific records
- Handle pagination with limit/offset or page/per_page
- Parse JSON responses

### GraphQL APIs
- Single endpoint with query in request body
- Build query strings dynamically
- Handle nested response structures
- Parse JSON responses

### XML APIs (like PubMed)
- Add `xmldom` dependency
- Parse responses with DOMParser
- Extract data using getElementsByTagName
- Handle nested XML structures

### HTML Scraping APIs
- Add `cheerio` dependency
- Parse HTML responses
- Extract data using CSS selectors
- Handle dynamic content carefully

## Adding Additional Dependencies

Based on your API requirements, you may need to add:

```bash
# For XML parsing
npm install xmldom @types/xmldom

# For HTML parsing
npm install cheerio @types/cheerio

# For date handling
npm install date-fns

# For CSV parsing
npm install csv-parser @types/csv-parser

# For HTTP client (alternative to fetch)
npm install axios

# For rate limiting
npm install bottleneck

# For retry logic
npm install retry
```

## Error Handling Best Practices

1. **Always check API response status codes**
2. **Handle network timeouts and failures gracefully**
3. **Validate API responses before processing**
4. **Provide meaningful error messages to users**
5. **Log errors for debugging but don't expose sensitive information**

## Security Considerations

1. **Never commit API keys or credentials**
2. **Use environment variables for sensitive configuration**
3. **Validate all user inputs with Zod schemas**
4. **Sanitize data before formatting responses**
5. **Respect API rate limits and terms of service**

## Testing Your MCP Server

1. **Unit tests** - Test individual functions
2. **Integration tests** - Test API calls with mock responses
3. **End-to-end tests** - Test with actual MCP client
4. **Error handling tests** - Test with invalid inputs and API failures

## Deployment

1. **Build the project:**
   ```bash
   npm run build
   ```

2. **The built files will be in `dist/`**

3. **Configure your MCP client to use the built server**

4. **Set environment variables in your deployment environment**

## Troubleshooting

### Common Issues

1. **"Tool not found" errors** - Check tool names match between definition and execution
2. **Schema validation failures** - Verify Zod schemas match your input expectations
3. **API authentication failures** - Check environment variables and API key format
4. **Response parsing errors** - Verify you're handling the API response structure correctly
5. **Missing artifacts** - Ensure you're returning artifacts in the correct format

### Debug Logging

The template includes debug logging. Look for these patterns in your console:
- `[service-name] API Key found/not found`
- `[DEBUG] API search URL: ...`
- `[DEBUG] Found X records`
- `[DEBUG] First formatted record: ...`

## Support

If you encounter issues with this template:
1. Check the TODO comments in the code for guidance
2. Review the PubMed MCP implementation for reference patterns
3. Consult the MCP SDK documentation
4. Test with minimal API calls first, then add complexity

---

**Remember**: This template is designed for rapid development. Focus on getting the core functionality working first, then iterate and improve based on your specific API's requirements and user needs. 

## Best Practices for Artifacts

1. **Always Include Required Fields**
   - `type` - Must match one of the supported types
   - `title` - Required for proper display in the UI
   - `name` - Should include appropriate file extension
   - `content` - Properly formatted for the type

2. **Choose Appropriate Types**
   - Use `text/markdown` for formatted documentation
   - Use specific code types for syntax highlighting
   - Use specialized types for specific data formats

3. **Format Content Properly**
   - Markdown should be well-structured with headers
   - Code should be properly indented
   - JSON should be valid and well-formatted

4. **Provide Clear Instructions**
   - Add instructions in the text response
   - Don't include instructions in artifacts
   - Tell the LLM not to create additional artifacts 