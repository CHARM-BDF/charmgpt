# Grant Fetching MCP Server Implementation Plan

## Overview
Create an MCP server that fetches and parses grant information from websites, with initial focus on NIH grant pages. The server needs to ensure complete and accurate capture of grant information to support proposal creation tools.

## Implementation Steps

### Phase 1: Basic Website Fetching
1. Set up basic MCP server structure following Python MCP pattern
2. Implement website fetching tool with proper error handling
3. Add validation for URLs (ensure they are grant-related URLs)
4. Add proper timeout and retry logic for reliability

### Phase 2: Content Processing
1. Implement HTML to text conversion
2. Add basic content cleaning (remove unnecessary whitespace, normalize line endings)
3. Add proper error handling for malformed HTML
4. Implement content validation to ensure complete fetch

### Phase 3: Markdown Conversion (Optional)
1. Evaluate HTML to Markdown conversion libraries
2. Implement conversion with proper handling of:
   - Headers
   - Lists
   - Tables
   - Links
   - Special formatting

### Phase 4: Grant-Specific Features
1. Add metadata extraction for grant information:
   - Grant number
   - Due dates
   - Funding amounts
   - Key contacts
2. Implement validation specific to grant pages
3. Add error handling for missing critical grant information

## Technical Considerations
- Need robust error handling to ensure complete information capture
- Should implement logging similar to Python MCP for debugging
- Must handle large pages without timing out
- Should validate returned content to ensure critical sections aren't missing

## Initial Tool Schema
```typescript
{
  name: "fetch_grant_page",
  description: "Fetches and processes grant information from websites, with focus on NIH grant pages",
  inputSchema: {
    type: "object",
    properties: {
      url: {
        type: "string",
        description: "URL of the grant page to fetch"
      },
      convertToMarkdown: {
        type: "boolean",
        description: "Whether to convert the content to Markdown format",
        default: false
      },
      timeout: {
        type: "number",
        description: "Timeout in seconds for the fetch operation",
        default: 30
      }
    },
    required: ["url"]
  }
}
```

## Questions for Discussion
1. Should Markdown conversion be a separate tool or an option in the main tool?
2. Do we need to implement caching to avoid repeated fetches of the same URL?
3. Should we add specific validation for different grant sources (NIH, NSF, etc.)?
4. Do we need to implement any rate limiting to respect website policies?

## Next Steps
1. Review and approve overall approach
2. Begin with Phase 1 implementation
3. Test with sample NIH grant pages
4. Evaluate completeness of fetched content 