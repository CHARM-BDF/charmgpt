# MCP LLM Service: Structure and Usage Guide

This document explains the centralized LLM (Large Language Model) service implementation and how MCP servers can utilize it.

## 1. Service Architecture

The LLM Service is built with a layered architecture to provide flexibility, extensibility, and separation of concerns:

```
src/server/services/llm/
├── index.ts              # Main service implementation
├── types.ts              # Type definitions and interfaces
├── cache.ts              # In-memory response caching
├── utils.ts              # Utility functions
└── providers/            # LLM provider implementations
    └── anthropic.ts      # Anthropic/Claude integration

src/server/routes/api/internal/
└── llm.ts                # REST API endpoints for MCP access

custom-mcp-servers/mcp-helpers/
└── llm-client.ts         # Client library for MCP servers
```

### Core Components:

1. **LLM Service** (`src/server/services/llm/index.ts`)
   - Central implementation that coordinates providers and caching
   - Implements specialized methods for common tasks

2. **API Endpoints** (`src/server/routes/api/internal/llm.ts`)
   - RESTful interface for MCP servers to access the service
   - Handles authentication, validation, and error handling

3. **MCP Client** (`custom-mcp-servers/mcp-helpers/llm-client.ts`)
   - Helper library for MCP servers to easily use the service
   - Handles request formatting, authentication, and error recovery

## 2. Using the LLM Service in MCP Servers

### 2.1 Client Setup

Import and initialize the client in your MCP server:

```typescript
import { LLMClient } from '../../mcp-helpers/llm-client';

// Initialize the client
const llmClient = new LLMClient({
  // Optional configuration
  mcpName: 'medik-mcp', // Identifies your MCP in logs
  timeout: 45000, // Longer timeout for complex operations
  retries: 3 // Number of retry attempts on failure
});
```

### 2.2 Basic Query

Send a direct prompt to the LLM:

```typescript
const response = await llmClient.query({
  prompt: "Explain the relationship between genes and proteins",
  systemPrompt: "You are a helpful biomedical AI assistant with expertise in genetics.",
  responseFormat: 'text', // Options: 'text', 'json', 'markdown'
  options: {
    temperature: 0.7,
    maxTokens: 2000
  }
});

if (response.success) {
  // Use response.content
  console.log(response.content);
} else {
  // Handle error
  console.error("Query failed:", response.error);
}
```

### 2.3 Specialized Methods

#### Data Analysis:

```typescript
const data = [
  { gene: "BRCA1", expression: 0.75, mutation: true },
  { gene: "TP53", expression: 0.25, mutation: false }
];

const analysisResponse = await llmClient.analyze(
  data,
  "Analyze the gene expression patterns and identify potential significance of mutations",
  { responseFormat: 'markdown' }
);

console.log(analysisResponse.content);
```

#### Item Ranking:

```typescript
const biomedicalEntities = [
  { id: "MESH:D005819", name: "Gastric cancer", category: "disease" },
  { id: "MESH:D000071540", name: "Pancreatic cancer", category: "disease" },
  { id: "MESH:D009369", name: "Colorectal cancer", category: "disease" }
];

// Returns the items in ranked order based on the criteria
const rankedEntities = await llmClient.rank(
  biomedicalEntities,
  "Rank these cancers by their five-year survival rate from worst to best"
);

// rankedEntities will be the original array reordered based on the ranking
console.log(rankedEntities);
```

### 2.4 Response Handling

All responses include these common fields:

```typescript
interface LLMResponse {
  success: boolean;       // Whether the request succeeded
  content: string;        // The LLM's response content
  error?: string;         // Error message if request failed
  usage?: {               // Token usage information
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  cached?: boolean;       // Whether retrieved from cache
}
```

### 2.5 Error Handling

The client automatically handles retries for network errors and timeouts:

```typescript
try {
  const response = await llmClient.query({...});
  // Process response
} catch (error) {
  // This only happens if retries are exhausted
  console.error("LLM query failed after retries:", error);
}
```

Or rely on the built-in error handling that returns a failure response:

```typescript
const response = await llmClient.query({...});

if (!response.success) {
  console.error("Query failed:", response.error);
  // Implement fallback logic
}
```

## 3. JSON Processing

The service has built-in support for structured JSON responses:

1. Set `responseFormat: 'json'` in your request
2. The service will:
   - Validate the returned JSON
   - Extract JSON from markdown code blocks if needed
   - Return properly parsed JSON for direct use

Example for extracting structured data:

```typescript
const response = await llmClient.query({
  prompt: "Generate a JSON object with these genes: BRCA1, TP53, EGFR and their associated diseases",
  responseFormat: 'json'
});

if (response.success) {
  try {
    // Safe to parse because the service validates and extracts JSON
    const geneData = JSON.parse(response.content);
    // Use structured data
    for (const gene of geneData.genes) {
      console.log(`${gene.name}: ${gene.associatedDiseases.join(', ')}`);
    }
  } catch (error) {
    console.error("JSON parsing error:", error);
  }
}
```

## 4. Configuration Options

### 4.1 Client Options

```typescript
interface LLMClientOptions {
  baseUrl?: string;        // Base URL for API (default: http://localhost:3000/api/internal/llm)
  timeout?: number;        // Request timeout in ms (default: 30000)
  authToken?: string;      // Auth token (default: MCP_AUTH_TOKEN env var)
  retries?: number;        // Number of retries (default: 3)
  mcpName?: string;        // MCP name for logging (default: 'unknown-mcp')
}
```

### 4.2 Request Options

```typescript
interface LLMQueryParams {
  prompt: string;                      // The prompt to send
  systemPrompt?: string;               // Optional system prompt
  responseFormat?: 'json' | 'text' | 'markdown'; // Response format
  contextData?: Record<string, any>;   // Additional context
  options?: {                          // LLM-specific options
    temperature?: number;              // Randomness (0.0-1.0)
    maxTokens?: number;                // Max tokens to generate
    skipCache?: boolean;               // Skip cache lookup
  };
}
```

## 5. Performance Considerations

### 5.1 Caching

The service includes automatic caching to reduce latency and API costs:

- Identical requests are cached based on prompt and options
- Cache hits are returned immediately without calling the LLM API
- Cache entries expire after 1 hour by default
- Cache can be bypassed with `skipCache: true` option

### 5.2 Response Times

Expect these approximate response times:

- Cache hits: ~50ms
- New short queries: 1-3 seconds
- Complex analysis: 3-10 seconds
- Large data ranking: 5-15 seconds

### 5.3 Rate Limiting

The service includes rate limiting to prevent abuse:

- 100 requests per 15 minutes (configurable)
- Retries use exponential backoff
- Concurrent request limits set at the API level

## 6. Security

The service includes authentication for MCP servers:

- Each request must include a valid `X-MCP-Auth` header
- Authentication is handled automatically by the client
- The token is set via the `MCP_AUTH_TOKEN` environment variable
- In development, localhost requests are exempted from authentication

## 7. Example Usage in MediK Pathfinder

```typescript
// In custom-mcp-servers/medik-mcp/src/pathfinder.ts
import { LLMClient } from '../../mcp-helpers/llm-client';

const llmClient = new LLMClient({ mcpName: 'medik-mcp' });

async function rankPromisingSources(sourceNodes, targetNodes) {
  try {
    // Format nodes for ranking
    const formattedSourceNodes = sourceNodes.map(node => ({
      id: node.id,
      name: node.name,
      category: node.metadata?.category
    }));
    
    const formattedTargetNodes = targetNodes.map(node => ({
      id: node.id,
      name: node.name,
      category: node.metadata?.category
    }));
    
    // Use LLM to identify most promising connections
    const response = await llmClient.query({
      prompt: `Given these source and target nodes, identify which pairs are most likely 
      to have meaningful biological connections through intermediate concepts.
      
      Source nodes: ${JSON.stringify(formattedSourceNodes)}
      Target nodes: ${JSON.stringify(formattedTargetNodes)}`,
      responseFormat: 'json',
      options: { temperature: 0.3 }
    });
    
    if (response.success) {
      return JSON.parse(response.content);
    } else {
      // Fall back to simpler heuristic method
      return fallbackRanking(sourceNodes, targetNodes);
    }
  } catch (error) {
    console.error('Error ranking nodes with LLM:', error);
    return fallbackRanking(sourceNodes, targetNodes);
  }
}
``` 