# SmartAPI-Based MCP Development Guide

**🎯 Purpose:** Create Model Context Protocol (MCP) servers that integrate with SmartAPI-compliant biomedical APIs, following FAIR principles for enhanced discoverability and interoperability.

**⚡ Time to First Working MCP:** ~20-40 minutes  
**📚 Based on:** SmartAPI standard + template2 MCP patterns  
**🔧 Difficulty:** Intermediate (requires understanding of biomedical APIs)  
**🏥 Domain:** Biomedical research, life sciences, health data

## 🧬 What is SmartAPI?

SmartAPI is a metadata specification designed to enhance the discoverability and interoperability of web APIs, particularly in biomedical and data science applications. It adheres to the **FAIR principles** (Findable, Accessible, Interoperable, Reusable) by providing structured metadata that describes APIs' domain-related and structural characteristics.

### Key SmartAPI Features

1. **Structured Metadata**: Uses JSON-LD format to describe API services and parameters
2. **Linked Data**: Indexes and visualizes API descriptions as Linked Data
3. **Service Composition**: Enables seamless identification and composition of services
4. **Standard Format**: Provides programming language-agnostic interface descriptions
5. **Biomedical Focus**: Developed under BD2K/Network of BioThings initiative

## 🚀 Quick Start for SmartAPI MCPs

### Option 1: Automated Setup (Recommended)
```bash
cd custom-mcp-servers/template2/
./setup.sh your-smartapi-mcp
cd your-smartapi-mcp/
# Follow SmartAPI-specific customization below
```

### Option 2: Manual Setup
```bash
cp -r template2/ your-smartapi-mcp/
cd your-smartapi-mcp/
npm install
# Follow SmartAPI-specific customization below
```

## 🧬 SmartAPI-Specific Customization

### 1. SmartAPI Metadata Integration

**File: `src/index.ts`** - Configuration Section

```typescript
// SmartAPI Configuration
const SMARTAPI_REGISTRY_URL = "https://smart-api.info/api/query";
const SMARTAPI_BASE_URL = "https://smart-api.info/ui"; // For UI links
const TOOL_NAME = "smartapi-biomedical-mcp";
const SERVICE_NAME = "smartapi-biomedical";

// SmartAPI-specific environment variables
const SMARTAPI_API_KEY = process.env.SMARTAPI_API_KEY; // If required
const BIOMEDICAL_DOMAIN = process.env.BIOMEDICAL_DOMAIN || 'translator'; // Default domain

// IMPORTANT: Always verify the actual API endpoint from SmartAPI metadata
// SmartAPI metadata may show POST endpoints, but the actual service might use GET
// Example: Annotation service metadata showed POST /annotator but actual endpoint is GET /annotator/{curieid}
```

### 2. SmartAPI Query Schemas

**File: `src/index.ts`** - Schema Definitions Section

```typescript
// SmartAPI Search Schema
const SmartAPISearchSchema = z.object({
  query: z.string().min(1, "Search query cannot be empty"),
  domain: z.enum(['translator', 'biothings', 'clinical', 'genomics', 'proteomics']).optional().default('translator'),
  component_type: z.enum(['KP', 'ARA', 'TRAPI', 'BTE']).optional(),
  max_results: z.number().min(1).max(100).optional().default(20),
  include_metadata: z.boolean().optional().default(true),
  tags: z.array(z.string()).optional(), // e.g., ['trapi', 'biolink']
});

// SmartAPI API Details Schema
const SmartAPIDetailsSchema = z.object({
  api_id: z.string().min(1, "API ID cannot be empty"),
  include_spec: z.boolean().optional().default(false),
  include_examples: z.boolean().optional().default(true),
});

// SmartAPI Registry Query Schema
const SmartAPIRegistrySchema = z.object({
  registry_query: z.string().min(1, "Registry query cannot be empty"),
  size: z.number().min(1).max(1000).optional().default(100),
  sort: z.enum(['_seq_no', 'title', 'version']).optional().default('_seq_no'),
  fields: z.string().optional(), // Comma-separated field list
});
```

### 3. SmartAPI Authentication Patterns

**File: `src/index.ts`** - API Request Helper Section

```typescript
async function makeSmartAPIRequest(endpoint: string, method: 'GET' | 'POST' = 'GET', body?: any): Promise<any> {
  const url = new URL(`${API_BASE_URL}${endpoint}`);
  
  const headers: Record<string, string> = {
    'Accept': 'application/json',
    'User-Agent': `${SERVICE_NAME}-mcp/1.0.0`,
  };

  // CRITICAL: Only add Content-Type for POST requests
  // GET requests with Content-Type header can cause 400 errors
  if (method === 'POST') {
    headers['Content-Type'] = 'application/json';
  }

  // Add authentication if required
  if (SMARTAPI_API_KEY) {
    headers['Authorization'] = `Bearer ${SMARTAPI_API_KEY}`;
  }

  console.log(`[${SERVICE_NAME}] Making SmartAPI request to: ${url.toString()}`);

  try {
    const requestOptions: RequestInit = {
      method,
      headers,
    };

    if (method === 'POST' && body) {
      requestOptions.body = JSON.stringify(body);
    }

    const response = await fetch(url.toString(), requestOptions);
    
    console.log(`[${SERVICE_NAME}] Response status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`API endpoint not found: ${endpoint}`);
      }
      if (response.status === 400) {
        const errorText = await response.text();
        throw new Error(`Invalid request: ${errorText}`);
      }
      if (response.status === 413) {
        throw new Error(`Payload too large. Batch size exceeded limit.`);
      }
      if (response.status === 429) {
        throw new Error(`Rate limit exceeded. Please wait before retrying.`);
      }
      if (response.status === 500) {
        throw new Error(`Internal server error in API service.`);
      }
      if (response.status === 501) {
        throw new Error(`API endpoint not implemented: ${endpoint}`);
      }
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`[${SERVICE_NAME}] API request error:`, error);
    throw error;
  }
}
```

### 4. SmartAPI Data Formatting

**File: `src/index.ts`** - Data Formatting Functions Section

```typescript
// Format SmartAPI record for Claude consumption
function formatSmartAPIRecordForModel(record: any): string {
  const info = record.info || {};
  const meta = record._meta || {};
  
  return [
    `**API Title:** ${info.title || 'Unknown'}`,
    `**Version:** ${info.version || 'Unknown'}`,
    `**Description:** ${info.description || 'No description available'}`,
    `**Contact:** ${info.contact?.name || 'Unknown'} (${info.contact?.email || 'No email'})`,
    `**Terms of Service:** ${info.termsOfService || 'Not specified'}`,
    `**API ID:** ${meta._id || 'Unknown'}`,
    `**SmartAPI UI:** ${SMARTAPI_BASE_URL}/${meta._id || ''}`,
    `**Tags:** ${record.tags?.map((tag: any) => tag.name).join(', ') || 'None'}`,
    `**Servers:** ${record.servers?.map((s: any) => s.url).join(', ') || 'None'}`,
    `**Paths:** ${Object.keys(record.paths || {}).length} endpoints available`,
    "---"
  ].filter(Boolean).join("\n");
}

// Format SmartAPI data for artifacts
function formatSmartAPIArtifactData(records: any[]): any {
  return {
    summary: {
      total_apis: records.length,
      domains: [...new Set(records.map(r => r.info?.title?.toLowerCase().includes('translator') ? 'translator' : 'other'))],
      components: [...new Set(records.flatMap(r => r.tags?.map((t: any) => t.name) || []))],
      latest_version: Math.max(...records.map(r => parseFloat(r.info?.version || '0'))),
    },
    apis: records.map(record => ({
      id: record._meta?._id,
      title: record.info?.title,
      version: record.info?.version,
      description: record.info?.description,
      contact: record.info?.contact,
      servers: record.servers,
      paths: Object.keys(record.paths || {}),
      tags: record.tags?.map((tag: any) => tag.name) || [],
      smartapi_ui: `${SMARTAPI_BASE_URL}/${record._meta?._id}`,
      translator_info: record.info?.['x-translator'] || null,
    }))
  };
}
```

### 5. SmartAPI Query Building

**File: `src/index.ts`** - Query Building Functions Section

```typescript
// Build SmartAPI registry query
function buildSmartAPIQuery(searchParams: any): string {
  const { query, domain, component_type, tags } = searchParams;
  
  let smartapiQuery = '';
  
  // Base query
  if (query) {
    smartapiQuery += `q=${encodeURIComponent(query)}`;
  }
  
  // Domain-specific filtering
  if (domain === 'translator') {
    smartapiQuery += (smartapiQuery ? ' AND ' : '') + 'tags.name:translator';
  }
  
  // Component type filtering
  if (component_type) {
    smartapiQuery += (smartapiQuery ? ' AND ' : '') + `tags.name:${component_type.toLowerCase()}`;
  }
  
  // Additional tags
  if (tags && tags.length > 0) {
    const tagQuery = tags.map(tag => `tags.name:${tag}`).join(' AND ');
    smartapiQuery += (smartapiQuery ? ' AND ' : '') + tagQuery;
  }
  
  return smartapiQuery;
}

// Build SmartAPI registry parameters
function buildSmartAPIParams(searchParams: any): Record<string, any> {
  const { max_results, include_metadata } = searchParams;
  
  const params: Record<string, any> = {
    size: max_results || 20,
    sort: '_seq_no',
    raw: 1,
  };
  
  // Include specific fields for metadata
  if (include_metadata) {
    params.fields = 'paths,servers,tags,components.x-bte*,info,_meta';
  }
  
  return params;
}
```

### 6. SmartAPI Tool Definitions

**File: `src/index.ts`** - Tool Definitions Section

```typescript
const tools = [
  {
    name: "search-smartapi-apis",
    description: "Search the SmartAPI registry for biomedical APIs that match your criteria. Supports filtering by domain (translator, biothings, clinical, genomics, proteomics), component type (KP, ARA, TRAPI, BTE), and tags.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search query to find relevant APIs (e.g., 'protein', 'drug', 'disease')"
        },
        domain: {
          type: "string",
          enum: ["translator", "biothings", "clinical", "genomics", "proteomics"],
          description: "Biomedical domain to focus the search"
        },
        component_type: {
          type: "string",
          enum: ["KP", "ARA", "TRAPI", "BTE"],
          description: "Type of component (Knowledge Provider, Autonomous Relay Agent, etc.)"
        },
        max_results: {
          type: "number",
          minimum: 1,
          maximum: 100,
          default: 20,
          description: "Maximum number of APIs to return"
        },
        tags: {
          type: "array",
          items: { type: "string" },
          description: "Additional tags to filter by (e.g., ['trapi', 'biolink'])"
        }
      },
      required: ["query"]
    }
  },
  {
    name: "get-smartapi-details",
    description: "Get detailed information about a specific SmartAPI-registered API, including its OpenAPI specification, endpoints, and metadata.",
    inputSchema: {
      type: "object",
      properties: {
        api_id: {
          type: "string",
          description: "The SmartAPI ID of the API to get details for"
        },
        include_spec: {
          type: "boolean",
          default: false,
          description: "Whether to include the full OpenAPI specification"
        },
        include_examples: {
          type: "boolean",
          default: true,
          description: "Whether to include example requests and responses"
        }
      },
      required: ["api_id"]
    }
  },
  {
    name: "query-smartapi-registry",
    description: "Execute advanced queries against the SmartAPI registry using SmartAPI's native query syntax. Useful for complex filtering and discovery.",
    inputSchema: {
      type: "object",
      properties: {
        registry_query: {
          type: "string",
          description: "SmartAPI registry query string (e.g., 'tags.name:translator AND tags.name:trapi')"
        },
        size: {
          type: "number",
          minimum: 1,
          maximum: 1000,
          default: 100,
          description: "Number of results to return"
        },
        sort: {
          type: "string",
          enum: ["_seq_no", "title", "version"],
          default: "_seq_no",
          description: "Sort order for results"
        },
        fields: {
          type: "string",
          description: "Comma-separated list of fields to include in response"
        }
      },
      required: ["registry_query"]
    }
  }
];
```

### 7. SmartAPI Tool Execution

**File: `src/index.ts`** - Tool Execution Section

```typescript
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    if (name === "search-smartapi-apis") {
      const searchParams = SmartAPISearchSchema.parse(args);
      const query = buildSmartAPIQuery(searchParams);
      const params = buildSmartAPIParams(searchParams);
      
      console.log(`[${SERVICE_NAME}] Searching SmartAPI with query: ${query}`);
      
      const searchData = await makeSmartAPIRequest(`?q=${encodeURIComponent(query)}`, params);
      const records = searchData.hits || [];
      
      console.log(`[${SERVICE_NAME}] Found ${records.length} SmartAPI records`);
      
      if (records.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: `No SmartAPI-registered APIs found matching your criteria: "${searchParams.query}"`
            }
          ]
        };
      }

      const formattedRecords = records.map(formatSmartAPIRecordForModel).join("\n");
      const artifactData = formatSmartAPIArtifactData(records);

      return {
        content: [
          {
            type: "text",
            text: `# SmartAPI Search Results

Found ${records.length} biomedical APIs matching your criteria: "${searchParams.query}"

## Instructions for Using This Data
When working with these APIs:
1. **Check the SmartAPI UI links** for interactive documentation
2. **Review the contact information** for support and questions
3. **Examine the available endpoints** to understand capabilities
4. **Consider the tags** to understand the API's domain and purpose
5. **Verify the terms of service** before integration

${formattedRecords}

## Summary
- **Total APIs found:** ${records.length}
- **Domains represented:** ${artifactData.summary.domains.join(', ')}
- **Component types:** ${artifactData.summary.components.join(', ')}
- **Latest version:** ${artifactData.summary.latest_version}`
          }
        ],
        artifacts: [
          {
            type: "application/json",
            title: "SmartAPI Search Results",
            name: "smartapi_search_results.json",
            content: artifactData
          }
        ]
      };
    }

    if (name === "get-smartapi-details") {
      const detailsParams = SmartAPIDetailsSchema.parse(args);
      
      console.log(`[${SERVICE_NAME}] Getting SmartAPI details for: ${detailsParams.api_id}`);
      
      const apiData = await makeSmartAPIRequest(`/${detailsParams.api_id}`);
      
      if (!apiData) {
        return {
          content: [
            {
              type: "text",
              text: `SmartAPI with ID "${detailsParams.api_id}" not found. Please check the API ID and try again.`
            }
          ]
        };
      }

      const formattedDetails = formatSmartAPIRecordForModel(apiData);
      const artifactData = {
        api_info: apiData.info,
        servers: apiData.servers,
        paths: apiData.paths,
        components: apiData.components,
        tags: apiData.tags,
        meta: apiData._meta,
        full_spec: detailsParams.include_spec ? apiData : null
      };

      return {
        content: [
          {
            type: "text",
            text: `# SmartAPI Details: ${apiData.info?.title || 'Unknown'}

${formattedDetails}

## API Specification
- **OpenAPI Version:** ${apiData.openapi || 'Unknown'}
- **Available Endpoints:** ${Object.keys(apiData.paths || {}).length}
- **Server URLs:** ${apiData.servers?.map((s: any) => s.url).join(', ') || 'None'}

## Next Steps
1. **Review the API documentation** using the SmartAPI UI link above
2. **Test the endpoints** using the provided server URLs
3. **Check authentication requirements** in the API specification
4. **Consider rate limits** and terms of service before integration`
          }
        ],
        artifacts: [
          {
            type: "application/json",
            title: `SmartAPI Details - ${apiData.info?.title}`,
            name: `smartapi_details_${detailsParams.api_id}.json`,
            content: artifactData
          }
        ]
      };
    }

    if (name === "query-smartapi-registry") {
      const registryParams = SmartAPIRegistrySchema.parse(args);
      
      console.log(`[${SERVICE_NAME}] Executing SmartAPI registry query: ${registryParams.registry_query}`);
      
      const queryData = await makeSmartAPIRequest(`?q=${encodeURIComponent(registryParams.registry_query)}`, {
        size: registryParams.size,
        sort: registryParams.sort,
        fields: registryParams.fields,
        raw: 1
      });
      
      const records = queryData.hits || [];
      
      if (records.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: `No results found for SmartAPI registry query: "${registryParams.registry_query}"`
            }
          ]
        };
      }

      const formattedRecords = records.map(formatSmartAPIRecordForModel).join("\n");
      const artifactData = formatSmartAPIArtifactData(records);

      return {
        content: [
          {
            type: "text",
            text: `# SmartAPI Registry Query Results

Query: "${registryParams.registry_query}"
Results: ${records.length} APIs found

${formattedRecords}

## Query Analysis
This advanced query returned ${records.length} APIs from the SmartAPI registry. Use the SmartAPI UI links to explore each API's capabilities and documentation.`
          }
        ],
        artifacts: [
          {
            type: "application/json",
            title: "SmartAPI Registry Query Results",
            name: "smartapi_registry_query.json",
            content: {
              query: registryParams.registry_query,
              results: artifactData,
              metadata: {
                total_found: records.length,
                query_params: registryParams
              }
            }
          }
        ]
      };
    }

    throw new Error(`Unknown tool: ${name}`);

  } catch (error) {
    console.error(`[${SERVICE_NAME}] Tool execution error:`, error);
    
    if (error instanceof z.ZodError) {
      return {
        content: [
          {
            type: "text",
            text: `Invalid input parameters: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`
          }
        ]
      };
    }
    
    throw new Error(`Failed to execute ${name}: ${error.message}`);
  }
});
```

## 🧬 SmartAPI-Specific Artifact Types

For SmartAPI MCPs, consider these specialized artifact types:

### Biomedical Data Artifacts
```typescript
// API Registry Data
{
  type: "application/vnd.smartapi-registry",
  title: "SmartAPI Registry Results",
  name: "smartapi_registry.json",
  content: {
    query: string,
    results: SmartAPIRecord[],
    metadata: RegistryMetadata
  }
}

// API Specification Data
{
  type: "application/vnd.openapi+json",
  title: "OpenAPI Specification",
  name: "api_spec.json",
  content: OpenAPISpecification
}

// Biomedical Knowledge Graph
{
  type: "application/vnd.biomedical-knowledge-graph",
  title: "Biomedical API Network",
  name: "api_network.json",
  content: {
    nodes: APINode[],
    edges: APIEdge[],
    metadata: NetworkMetadata
  }
}
```

## 🔬 SmartAPI Integration Patterns

### 1. Translator Component Integration
```typescript
// Query for Translator Knowledge Providers
const translatorQuery = "tags.name:translator AND tags.name:trapi";
const kpData = await makeSmartAPIRequest(`?q=${encodeURIComponent(translatorQuery)}`);
```

### 2. BioThings Integration
```typescript
// Query for BioThings APIs
const biothingsQuery = "tags.name:biothings";
const biothingsData = await makeSmartAPIRequest(`?q=${encodeURIComponent(biothingsQuery)}`);
```

### 3. Clinical Data APIs
```typescript
// Query for clinical data APIs
const clinicalQuery = "tags.name:clinical OR tags.name:patient";
const clinicalData = await makeSmartAPIRequest(`?q=${encodeURIComponent(clinicalQuery)}`);
```

## 🧪 Testing SmartAPI MCPs

### 1. Test SmartAPI Registry Access
```bash
npm run dev
# Test with: search-smartapi-apis query="protein" domain="translator"
```

### 2. Test API Details Retrieval
```bash
# Test with: get-smartapi-details api_id="your-api-id"
```

### 3. Test Advanced Registry Queries
```bash
# Test with: query-smartapi-registry registry_query="tags.name:translator AND tags.name:trapi"
```

## 🔬 SmartAPI Best Practices

### 1. FAIR Principles Implementation
- **Findable**: Use descriptive queries and proper tagging
- **Accessible**: Provide clear API documentation links
- **Interoperable**: Support standard formats (OpenAPI, JSON-LD)
- **Reusable**: Include comprehensive metadata and examples

### 2. Biomedical Domain Considerations
- **Semantic Annotation**: Use proper biomedical ontologies
- **Data Provenance**: Track data sources and versions
- **Privacy Compliance**: Handle sensitive health data appropriately
- **Standards Compliance**: Follow HL7 FHIR, OMOP, or other relevant standards

### 3. Error Handling for Biomedical APIs
```typescript
// Handle common biomedical API errors
if (response.status === 404) {
  throw new Error("Biomedical resource not found. Check the resource ID and try again.");
}

if (response.status === 403) {
  throw new Error("Access denied. This biomedical resource may require authentication or have usage restrictions.");
}

if (response.status === 429) {
  throw new Error("Rate limit exceeded. Biomedical APIs often have strict rate limits. Please wait before retrying.");
}
```

## 📚 SmartAPI Resources

### Official Documentation
- [SmartAPI Specification](https://github.com/SmartAPI/smartAPI-Specification)
- [SmartAPI Registry](https://smart-api.info/)
- [SmartAPI Editor](https://github.com/SmartAPI/smartAPI-editor)

### Biomedical API Examples
- [Translator APIs](https://smart-api.info/api/query?q=tags.name:translator)
- [BioThings APIs](https://smart-api.info/api/query?q=tags.name:biothings)
- [Clinical APIs](https://smart-api.info/api/query?q=tags.name:clinical)

### Related Standards
- [OpenAPI Specification](https://swagger.io/specification/)
- [JSON-LD](https://json-ld.org/)
- [FAIR Principles](https://www.go-fair.org/fair-principles/)
- [TRAPI (Translator Reasoner API)](https://github.com/NCATSTranslator/ReasonerAPI)

## 🚀 Deployment Considerations

### 1. Environment Variables
```bash
# .env file for SmartAPI MCP
SMARTAPI_API_KEY=your_smartapi_key_if_required
BIOMEDICAL_DOMAIN=translator
RATE_LIMIT_MS=1000
TIMEOUT_MS=30000
```

### 2. Rate Limiting
Biomedical APIs often have strict rate limits. Implement appropriate delays:
```typescript
const RATE_LIMIT_MS = 1000; // 1 second between requests
await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_MS));
```

### 3. Caching
Consider implementing caching for frequently accessed SmartAPI metadata:
```typescript
const cache = new Map();
const CACHE_TTL = 3600000; // 1 hour
```

## 🎯 Key Lessons from Real SmartAPI MCP Implementations

### 1. SmartAPI Metadata vs. Reality
**Lesson**: SmartAPI metadata is often outdated or incomplete. Always verify actual API behavior.

**Example**: 
- SmartAPI showed: `POST /annotator` with `raw` and `fields` parameters
- Reality: `GET /annotator/{curieid}` with no query parameters

**Solution**: Test with `curl` first, then implement based on actual behavior.

### 2. HTTP Header Pitfalls
**Lesson**: GET requests with `Content-Type: application/json` cause 400 errors.

**Problem**:
```typescript
// WRONG - causes 400 error
headers['Content-Type'] = 'application/json'; // for GET requests
```

**Solution**:
```typescript
// CORRECT - only for POST requests
if (method === 'POST') {
  headers['Content-Type'] = 'application/json';
}
```

### 3. Response Structure Variations
**Lesson**: APIs return different JSON structures than expected.

**Example**: Annotation service returns nested structure:
```json
{
  "NCBIGene:695": [
    {
      "name": "Bruton tyrosine kinase",
      "symbol": "BTK"
    }
  ]
}
```

**Solution**: Always inspect actual response structure and parse accordingly.

### 4. TRAPI vs. Simple REST APIs
**Lesson**: TRAPI endpoints require complex query graph structures, while simple REST APIs use basic parameters.

**TRAPI Example** (Microbiome KP):
```typescript
const trapiQuery = {
  message: {
    query_graph: {
      nodes: { n0: { ids: ["NCBIGene:695"] } },
      edges: { e0: { subject: "n0", object: "n1", predicates: ["biolink:related_to"] } }
    }
  }
};
```

**Simple REST Example** (Annotation service):
```typescript
// Just use the curie ID in the URL path
const url = `https://biothings.ncats.io/annotator/${curieId}`;
```

### 5. Error Handling Patterns
**Lesson**: Different APIs return different error formats and status codes.

**Common Patterns**:
- 400: Invalid request format or unsupported parameters
- 404: Resource not found or endpoint doesn't exist
- 413: Payload too large (batch size limits)
- 429: Rate limiting
- 500: Internal server error
- 501: Endpoint not implemented

### 6. Testing Strategy
**Lesson**: Always test the actual API before implementing the MCP.

**Recommended Approach**:
1. **curl test**: Verify endpoint and response structure
2. **Simple implementation**: Start with basic functionality
3. **Iterative testing**: Add features one at a time
4. **Error handling**: Test error conditions
5. **Documentation**: Update based on actual behavior

### 7. Artifact Data Structure
**Lesson**: Provide both human-readable text and structured JSON artifacts.

**Best Practice**:
```typescript
return {
  content: [
    {
      type: "text",
      text: formattedHumanReadableText
    }
  ],
  artifacts: [
    {
      type: "application/json",
      title: "Structured Data",
      name: "data.json",
      content: structuredData
    }
  ]
};
```

## 🔍 Troubleshooting SmartAPI MCPs

### Common Issues

1. **"No APIs found" errors**
   - Check your query syntax
   - Verify domain and tag names
   - Try broader search terms

2. **Authentication failures**
   - Verify API keys are set correctly
   - Check if the API requires authentication
   - Review rate limiting policies

3. **Response parsing errors**
   - SmartAPI responses can vary in structure
   - Add defensive programming for missing fields
   - Log response structure for debugging

4. **Timeout issues**
   - Biomedical APIs can be slow
   - Increase timeout values
   - Implement retry logic

5. **400 Bad Request errors**
   - **CRITICAL**: Don't add `Content-Type: application/json` to GET requests
   - Check if query parameters are supported (some APIs don't support `raw` and `fields` params)
   - Verify the actual API endpoint vs. SmartAPI metadata (metadata may be outdated)

6. **JSON parsing errors**
   - Some APIs return HTML error pages instead of JSON
   - Check if the endpoint URL is correct
   - Verify the API is actually running and accessible

7. **Nested response structures**
   - APIs may return nested JSON (e.g., `response[curieId][0]` instead of direct array)
   - Always inspect the actual response structure before parsing
   - Use defensive programming for nested data access

### Debug Logging
```typescript
console.log(`[${SERVICE_NAME}] SmartAPI Query: ${query}`);
console.log(`[${SERVICE_NAME}] Response status: ${response.status} ${response.statusText}`);
console.log(`[${SERVICE_NAME}] Response structure:`, JSON.stringify(response, null, 2));
console.log(`[${SERVICE_NAME}] Found ${records.length} records`);
```

### Real-World Testing Strategy
```typescript
// Always test with curl first to verify the actual API behavior
// Example for annotation service:
// curl "https://biothings.ncats.io/annotator/NCBIGene:695"

// Then implement the MCP based on actual API behavior, not just SmartAPI metadata
```

## ✅ SmartAPI MCP Implementation Checklist

Based on real-world implementations, follow this checklist for success:

### Pre-Implementation
- [ ] **Test the actual API** with `curl` to verify endpoints and response structure
- [ ] **Verify SmartAPI metadata** against actual API behavior (metadata may be outdated)
- [ ] **Check authentication requirements** (many biomedical APIs are public)
- [ ] **Identify the API type** (TRAPI vs. simple REST vs. other)

### Implementation
- [ ] **Use conditional Content-Type headers** (only for POST requests)
- [ ] **Implement proper error handling** for all HTTP status codes
- [ ] **Add response structure logging** for debugging
- [ ] **Handle nested JSON responses** appropriately
- [ ] **Provide both text and artifact responses**

### Testing
- [ ] **Test with real data** (not just mock responses)
- [ ] **Test error conditions** (invalid IDs, network failures)
- [ ] **Verify artifact data structure** is complete and useful
- [ ] **Test rate limiting** if applicable

### Documentation
- [ ] **Update README** with actual API behavior (not just SmartAPI metadata)
- [ ] **Include real examples** with actual curie IDs
- [ ] **Document error conditions** and solutions
- [ ] **Provide quick reference** for common use cases

### Common Gotchas to Avoid
- ❌ Don't trust SmartAPI metadata blindly
- ❌ Don't add Content-Type to GET requests
- ❌ Don't assume response structure matches documentation
- ❌ Don't forget to handle nested JSON responses
- ❌ Don't skip testing with real API endpoints

---

**Ready to build your SmartAPI MCP?** Start with the automated setup and follow the SmartAPI-specific customization steps above. Most developers have a working biomedical API integration within 40 minutes! 🧬🚀

**Pro Tip**: Always start with a simple `curl` test of the actual API endpoint before writing any code. This will save you hours of debugging! 🎯
