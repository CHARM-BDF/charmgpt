# MCP API Template - Quick Reference

**Use this checklist for rapid one-shot development of new MCP servers.**

## 🚀 Quick Setup (5 minutes)

1. **Copy template:**
   ```bash
   cp -r template2/ your-api-name-mcp/
   cd your-api-name-mcp/
   npm install
   ```

2. **Update package.json:**
   - Change `name` to `@custom-mcp/your-api-name`
   - Update `description` with your API purpose

3. **Set environment variables:**
   ```bash
   cp env.example .env
   # Edit .env with your API credentials
   ```

## 🔧 Core Customizations

### Configuration (Lines 11-35)
```typescript
const API_BASE_URL = "https://your-api.com/v1";     // REPLACE
const TOOL_NAME = "your-api-mcp";                   // REPLACE
const SERVICE_NAME = "your-api";                    // REPLACE
const API_KEY = process.env.YOUR_API_KEY;           // REPLACE
```

### Schemas (Lines 37-70)
```typescript
const SearchArgumentsSchema = z.object({
  query: z.string().min(1),
  // ADD YOUR SPECIFIC PARAMETERS:
  // category: z.enum(['option1', 'option2']).optional(),
  // date_range: z.object({ start: z.string(), end: z.string() }).optional(),
});
```

### API Request Function (Lines 87-130)
```typescript
// UPDATE AUTHENTICATION:
// Option 1: Bearer token
headers['Authorization'] = `Bearer ${API_KEY}`;

// Option 2: API key header
headers['X-API-Key'] = API_KEY;

// Option 3: Query parameter
url.searchParams.append('api_key', API_KEY);

// UPDATE RESPONSE PARSING:
return await response.json();        // JSON (most common)
// OR: return parseXML(await response.text());  // XML
// OR: return cheerio.load(await response.text()); // HTML
```

### Data Formatting (Lines 132-190)
```typescript
function formatRecordForModel(record: any): string {
  // CUSTOMIZE FIELDS FOR YOUR DATA:
  return [
    `**Title:** ${record.title}`,
    `**Field2:** ${record.field2}`,
    `**Field3:** ${record.field3}`,
    "---"
  ].join("\n");
}

function formatArtifactData(records: any[]): any {
  // CUSTOMIZE ARTIFACT STRUCTURE:
  return records.map(record => ({
    id: record.id,
    field1: record.field1,
    field2: record.field2,
    // ADD RELEVANT FIELDS
  }));
}
```

### Query Building (Lines 209-230)
```typescript
function buildSearchQuery(searchParams: any): string {
  // CUSTOMIZE FOR YOUR API:
  const params = new URLSearchParams();
  params.append('q', searchParams.query);
  // ADD YOUR PARAMETERS:
  // if (searchParams.category) params.append('category', searchParams.category);
  return params.toString();
}
```

### Tool Execution (Lines 315-450)
```typescript
// UPDATE ENDPOINT PATHS:
const searchEndpoint = `search?${queryString}`;     // REPLACE

// UPDATE RESPONSE DATA EXTRACTION:
const records = searchData.results;                 // REPLACE
// Common patterns: .data, .items, .docs, direct array
```

## 📋 Common API Patterns

### REST API with JSON
- **Auth:** `headers['Authorization'] = 'Bearer ' + API_KEY`
- **Response:** `await response.json()`
- **Data:** `searchData.results` or `searchData.data`

### XML API (like PubMed)
- **Dependencies:** Add `xmldom @types/xmldom`
- **Response:** Parse with `DOMParser`
- **Data:** Extract with `getElementsByTagName()`

### GraphQL API
- **Request:** Single endpoint, query in body
- **Auth:** Usually Bearer token
- **Response:** `data.query_name.results`

### HTML Scraping
- **Dependencies:** Add `cheerio @types/cheerio`
- **Response:** `cheerio.load(html)`
- **Data:** Extract with CSS selectors

## 🛠️ Tool Naming Conventions

- `search` / `search-{type}` - Search/query functionality
- `get-details` / `get-{resource}` - Get individual records
- `list-{resources}` - List/browse resources
- `create-{resource}` - Create new items
- `analyze-{type}` - Perform analysis
- `export-{format}` - Export data

## 🎯 Artifact Types

```typescript
// Research/Academic
type: "application/vnd.bibliography"

// Tabular Data
type: "application/vnd.dataset"

// Analytics/Statistics
type: "application/vnd.analytics"

// General Structured Data
type: "application/json"

// News Articles
type: "application/vnd.news-articles"
```

## ⚡ Testing Checklist

1. **Build:** `npm run build`
2. **Run:** `npm run dev`
3. **Test tools:** Verify each tool works
4. **Check artifacts:** Ensure proper formatting
5. **Test errors:** Invalid inputs, API failures
6. **MCP client:** Test with Claude/your client

## 🚨 Common Issues

1. **Tool not found** → Check tool names match in definition & execution
2. **Schema validation** → Verify Zod schemas match expected inputs
3. **Auth failures** → Check environment variables and header format
4. **No results** → Verify API response structure parsing
5. **Missing artifacts** → Check artifact type and content format

## 📝 Dependencies to Add

```bash
# XML parsing
npm install xmldom @types/xmldom

# HTML parsing  
npm install cheerio @types/cheerio

# Date handling
npm install date-fns

# HTTP client (alternative to fetch)
npm install axios

# Rate limiting
npm install bottleneck
```

## 🔍 Debug Commands

```bash
# View detailed logs
npm run dev 2>&1 | grep -E "\[(DEBUG|ERROR)\]"

# Test specific endpoint
curl -H "Authorization: Bearer $API_KEY" "https://api.example.com/endpoint"

# Validate JSON schema
node -e "console.log(JSON.stringify(yourSchema.parse(testInput)))"
```

---

**💡 Pro Tip:** Start with minimal functionality (basic search + get-details), test it works, then add features incrementally. 