# Example Implementation: NewsAPI Integration

This document shows how to apply the MCP API template to create an integration with NewsAPI (newsapi.org). This serves as a concrete example of the template customization process.

## API Overview

**NewsAPI** provides:
- Search news articles from various sources
- Get articles by specific sources
- Get top headlines by category/country
- JSON responses with article data

**Authentication:** API key in query parameter or header  
**Base URL:** `https://newsapi.org/v2`  
**Documentation:** https://newsapi.org/docs

## Step-by-Step Implementation

### 1. Package Configuration Changes

**File: `package.json`**
```json
{
  "name": "@custom-mcp/newsapi",
  "description": "MCP server for integrating with NewsAPI - search and retrieve news articles",
  // ... rest unchanged
}
```

### 2. Configuration Section

**File: `src/index.ts`** - Lines 11-35
```typescript
// CONFIGURATION SECTION - CUSTOMIZED FOR NEWSAPI
const API_BASE_URL = "https://newsapi.org/v2";
const TOOL_NAME = "newsapi-mcp";
const SERVICE_NAME = "newsapi";

// NEWSAPI environment variables
const API_KEY = process.env.NEWSAPI_KEY;
const USER_EMAIL = process.env.NEWSAPI_USER_EMAIL || 'anonymous@example.com';

// Additional NewsAPI configuration
const RATE_LIMIT_MS = 500; // NewsAPI rate limiting
const MAX_RESULTS_LIMIT = 100; // NewsAPI max results per request
```

### 3. Schema Definitions

**File: `src/index.ts`** - Lines 37-70
```typescript
// Search schema for NewsAPI
const SearchArgumentsSchema = z.object({
  query: z.string().min(1, "Query cannot be empty"),
  max_results: z.number().min(1).max(100).optional().default(10),
  category: z.enum(['business', 'entertainment', 'general', 'health', 'science', 'sports', 'technology']).optional(),
  language: z.enum(['ar', 'de', 'en', 'es', 'fr', 'he', 'it', 'nl', 'no', 'pt', 'ru', 'sv', 'ud', 'zh']).optional().default('en'),
  sort_by: z.enum(['relevancy', 'popularity', 'publishedAt']).optional().default('relevancy'),
  date_range: z.object({
    from: z.string().optional(), // YYYY-MM-DD format
    to: z.string().optional()
  }).optional(),
});

// Get details schema (for getting full article content)
const GetDetailsArgumentsSchema = z.object({
  url: z.string().url("Must be a valid URL"),
});

// Additional schema for getting top headlines
const GetHeadlinesArgumentsSchema = z.object({
  category: z.enum(['business', 'entertainment', 'general', 'health', 'science', 'sports', 'technology']).optional(),
  country: z.enum(['ae', 'ar', 'at', 'au', 'be', 'bg', 'br', 'ca', 'ch', 'cn', 'co', 'cu', 'cz', 'de', 'eg', 'fr', 'gb', 'gr', 'hk', 'hu', 'id', 'ie', 'il', 'in', 'it', 'jp', 'kr', 'lt', 'lv', 'ma', 'mx', 'my', 'ng', 'nl', 'no', 'nz', 'ph', 'pl', 'pt', 'ro', 'rs', 'ru', 'sa', 'se', 'sg', 'si', 'sk', 'th', 'tr', 'tw', 'ua', 'us', 've', 'za']).optional().default('us'),
  max_results: z.number().min(1).max(100).optional().default(10),
});
```

### 4. API Request Function

**File: `src/index.ts`** - Lines 87-130
```typescript
async function makeAPIRequest(endpoint: string, options: RequestInit = {}): Promise<any> {
  try {
    // Construct NewsAPI URL
    const url = new URL(`${API_BASE_URL}/${endpoint}`);
    
    // Add API key as query parameter (NewsAPI pattern)
    if (API_KEY) {
      url.searchParams.append('apiKey', API_KEY);
    }

    // Configure headers for NewsAPI
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': TOOL_NAME,
    };

    // NewsAPI rate limiting
    await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_MS));

    const response = await fetch(url.toString(), {
      ...options,
      headers: {
        ...headers,
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status} - ${response.statusText}`);
    }

    // NewsAPI returns JSON
    const data = await response.json();
    
    // Check for NewsAPI error responses
    if (data.status === 'error') {
      throw new Error(`NewsAPI error: ${data.message}`);
    }
    
    return data;

  } catch (error) {
    console.error(`Error making NewsAPI request to ${endpoint}:`, error);
    return null;
  }
}
```

### 5. Data Formatting Functions

**File: `src/index.ts`** - Lines 132-190
```typescript
// Format individual news articles for Claude
function formatRecordForModel(article: any): string {
  const title = article.title || "No title";
  const source = article.source?.name || "Unknown source";
  const publishedAt = article.publishedAt ? new Date(article.publishedAt).toLocaleDateString() : "No date";
  const description = article.description || "No description available";
  const url = article.url || "";
  const author = article.author || "Unknown author";

  return [
    `**Title:** ${title}`,
    `**Source:** ${source}`,
    `**Author:** ${author}`,
    `**Published:** ${publishedAt}`,
    `**Description:** ${description}`,
    url ? `**URL:** ${url}` : "",
    "---"
  ].filter(Boolean).join("\n");
}

// Format articles for structured artifacts
function formatArtifactData(articles: any[]): any {
  return articles.map(article => ({
    title: article.title || "",
    source: article.source?.name || "",
    author: article.author || "",
    published_at: article.publishedAt || "",
    description: article.description || "",
    url: article.url || "",
    url_to_image: article.urlToImage || "",
    content_snippet: article.content || "",
    // Metadata for analysis
    word_count: article.content ? article.content.split(' ').length : 0,
    has_image: !!article.urlToImage,
  }));
}
```

### 6. Query Building Function

**File: `src/index.ts`** - Lines 209-230
```typescript
function buildSearchQuery(searchParams: any): string {
  const { query, max_results, category, language, sort_by, date_range } = searchParams;
  const params = new URLSearchParams();
  
  params.append('q', query);
  params.append('pageSize', max_results.toString());
  params.append('language', language);
  params.append('sortBy', sort_by);
  
  if (category) params.append('category', category);
  if (date_range?.from) params.append('from', date_range.from);
  if (date_range?.to) params.append('to', date_range.to);
  
  return params.toString();
}

function buildHeadlinesQuery(searchParams: any): string {
  const { category, country, max_results } = searchParams;
  const params = new URLSearchParams();
  
  params.append('pageSize', max_results.toString());
  params.append('country', country);
  
  if (category) params.append('category', category);
  
  return params.toString();
}
```

### 7. Tool Definitions

**File: `src/index.ts`** - Lines 235-310
```typescript
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "search-news",
        description: "Search for news articles using NewsAPI. " +
          "Provide a search query and optional filters like category, language, and date range. " +
          "Returns both readable results and structured article data as artifacts.",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Search query for news articles (keywords, phrases, boolean operators)",
            },
            max_results: {
              type: "number",
              description: "Maximum number of results to return (1-100)",
              minimum: 1,
              maximum: 100,
            },
            category: {
              type: "string",
              enum: ["business", "entertainment", "general", "health", "science", "sports", "technology"],
              description: "Category to search within",
            },
            language: {
              type: "string",
              enum: ["ar", "de", "en", "es", "fr", "he", "it", "nl", "no", "pt", "ru", "sv", "ud", "zh"],
              description: "Language code for articles (default: en)",
            },
            sort_by: {
              type: "string",
              enum: ["relevancy", "popularity", "publishedAt"],
              description: "Sort order for results (default: relevancy)",
            },
            date_range: {
              type: "object",
              properties: {
                from: { type: "string", description: "Start date (YYYY-MM-DD)" },
                to: { type: "string", description: "End date (YYYY-MM-DD)" }
              },
              description: "Optional date range filter"
            },
          },
          required: ["query"],
        },
      },
      {
        name: "get-headlines",
        description: "Get top headlines by category and country from NewsAPI",
        inputSchema: {
          type: "object",
          properties: {
            category: {
              type: "string",
              enum: ["business", "entertainment", "general", "health", "science", "sports", "technology"],
              description: "News category",
            },
            country: {
              type: "string",
              enum: ["us", "gb", "ca", "au", "de", "fr", "jp", "cn", "in", "br"],
              description: "Country code for headlines (default: us)",
            },
            max_results: {
              type: "number",
              description: "Maximum number of headlines to return (1-100)",
              minimum: 1,
              maximum: 100,
            },
          },
          required: [],
        },
      },
    ],
  };
});
```

### 8. Tool Execution Implementation

**File: `src/index.ts`** - Lines 315-450
```typescript
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    if (name === "search-news") {
      const searchParams = SearchArgumentsSchema.parse(args);
      
      // Build NewsAPI search query
      const queryString = buildSearchQuery(searchParams);
      console.error(`[${SERVICE_NAME}] Search params:`, JSON.stringify(searchParams));
      console.error(`[${SERVICE_NAME}] Query string:`, queryString);
      
      // Make NewsAPI search request
      const searchEndpoint = `everything?${queryString}`;
      console.log(`[DEBUG] NewsAPI search URL: ${API_BASE_URL}/${searchEndpoint}`);
      const searchData = await makeAPIRequest(searchEndpoint);
      
      if (!searchData) {
        return {
          content: [
            {
              type: "text",
              text: "Failed to retrieve search results from NewsAPI",
            },
          ],
        };
      }

      // Extract articles from NewsAPI response
      const articles = searchData.articles || [];
      
      if (articles.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: "No news articles found for the given query",
            },
          ],
        };
      }

      console.log(`[DEBUG] Found ${articles.length} articles`);
      
      // Format articles for text response
      const formattedArticles = articles.map(formatRecordForModel);
      
      // Create structured artifact data
      const artifactData = formatArtifactData(articles);

      return {
        content: [
          {
            type: "text",
            text: `# News Search Results: ${searchParams.query}\n\nFound ${articles.length} articles:\n\n${formattedArticles.join("\n\n")}`,
            forModel: true
          }
        ],
        artifacts: [
          {
            type: "application/vnd.news-articles",
            title: "News Articles Data",
            content: {
              query: searchParams.query,
              total_results: articles.length,
              search_params: searchParams,
              articles: artifactData
            }
          }
        ]
      };

    } else if (name === "get-headlines") {
      const headlineParams = GetHeadlinesArgumentsSchema.parse(args);
      
      // Build headlines query
      const queryString = buildHeadlinesQuery(headlineParams);
      
      // Make NewsAPI headlines request
      const headlinesEndpoint = `top-headlines?${queryString}`;
      const headlinesData = await makeAPIRequest(headlinesEndpoint);

      if (!headlinesData) {
        return {
          content: [
            {
              type: "text",
              text: "Failed to retrieve headlines from NewsAPI",
            },
          ],
        };
      }

      const articles = headlinesData.articles || [];
      
      if (articles.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: `No headlines found for the specified criteria`,
            },
          ],
        };
      }

      const formattedArticles = articles.map(formatRecordForModel);

      return {
        content: [
          {
            type: "text",
            text: `# Top Headlines\n\n${formattedArticles.join("\n\n")}`,
          },
        ],
      };
      
    } else {
      throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(
        `Invalid arguments: ${error.errors
          .map((e) => `${e.path.join(".")}: ${e.message}`)
          .join(", ")}`
      );
    }
    throw error;
  }
});
```

## Environment Configuration

**File: `env.example`**
```bash
# NewsAPI Configuration
NEWSAPI_KEY=your_newsapi_key_here
NEWSAPI_USER_EMAIL=your.email@example.com
```

## Usage Examples

Once implemented, this MCP server would support queries like:

1. **Search for recent AI news:**
   ```
   Tool: search-news
   Arguments: {
     "query": "artificial intelligence",
     "max_results": 20,
     "sort_by": "publishedAt",
     "language": "en"
   }
   ```

2. **Get top technology headlines:**
   ```
   Tool: get-headlines
   Arguments: {
     "category": "technology",
     "country": "us",
     "max_results": 15
   }
   ```

3. **Search with date filter:**
   ```
   Tool: search-news
   Arguments: {
     "query": "climate change",
     "date_range": {
       "from": "2024-01-01",
       "to": "2024-01-31"
     },
     "sort_by": "popularity"
   }
   ```

## Key Customizations Made

1. **API-specific authentication** - NewsAPI uses query parameter for API key
2. **Custom schemas** - Added NewsAPI-specific parameters like categories, countries, languages
3. **Rate limiting** - Added 500ms delay between requests
4. **Error handling** - Added NewsAPI-specific error response handling
5. **Custom artifact type** - Used `application/vnd.news-articles` for structured news data
6. **Multiple tools** - Implemented both search and headlines functionality
7. **Query building** - Created separate query builders for different endpoints

This example shows how the template can be quickly adapted to a real-world API while maintaining all the MCP protocol requirements and best practices. 