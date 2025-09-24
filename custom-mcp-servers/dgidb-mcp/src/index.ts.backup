import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

// TODO: IMPORT ADDITIONAL LIBRARIES NEEDED FOR YOUR API
// Examples:
// - For XML parsing: import { DOMParser } from 'xmldom';
// - For JSON APIs: no additional imports needed
// - For HTML parsing: import * as cheerio from 'cheerio';
// - For date handling: import { format, parseISO } from 'date-fns';

// =============================================================================
// CONFIGURATION SECTION - CUSTOMIZE FOR YOUR API
// =============================================================================

// TODO: DEFINE YOUR API CONFIGURATION
// Replace these constants with your API's base URL and service name
const API_BASE_URL = "https://api.example.com/v1"; // REPLACE: Your API base URL
const TOOL_NAME = "example-api-mcp"; // REPLACE: Your MCP tool name
const SERVICE_NAME = "example-api"; // REPLACE: Your service name for logging

// TODO: DEFINE ENVIRONMENT VARIABLES YOUR API NEEDS
// Common patterns:
// - API_KEY for authentication
// - EMAIL for contact information
// - RATE_LIMIT for request throttling
// - BASE_URL for different environments
const API_KEY = process.env.EXAMPLE_API_KEY; // REPLACE: Your API key env var
const USER_EMAIL = process.env.EXAMPLE_USER_EMAIL || 'anonymous@example.com'; // REPLACE: User email env var

// TODO: ADD ADDITIONAL CONFIGURATION AS NEEDED
// Examples:
// const RATE_LIMIT_MS = 1000; // Rate limiting between requests
// const MAX_RETRIES = 3; // Number of retry attempts
// const TIMEOUT_MS = 30000; // Request timeout

// =============================================================================
// SCHEMA DEFINITIONS - DEFINE YOUR TOOL INPUT SCHEMAS
// =============================================================================

// TODO: DEFINE SCHEMAS FOR EACH TOOL'S INPUT PARAMETERS
// Use Zod schemas for robust input validation
// Pattern: {ToolName}ArgumentsSchema

// Example Schema 1: Search/Query tool
const SearchArgumentsSchema = z.object({
  query: z.string().min(1, "Query cannot be empty"), // REPLACE: Define your search parameters
  max_results: z.number().min(1).max(100).optional().default(10),
  // TODO: ADD YOUR SPECIFIC SEARCH PARAMETERS
  // Examples:
  // category: z.enum(['research', 'news', 'clinical']).optional(),
  // date_range: z.object({
  //   start: z.string().optional(),
  //   end: z.string().optional()
  // }).optional(),
  // filters: z.array(z.string()).optional(),
});

// Example Schema 2: Get details by ID tool
const GetDetailsArgumentsSchema = z.object({
  id: z.string().min(1, "ID cannot be empty"), // REPLACE: Your record ID parameter
  // TODO: ADD ADDITIONAL DETAIL PARAMETERS
  // Examples:
  // include_metadata: z.boolean().optional().default(false),
  // format: z.enum(['summary', 'full']).optional().default('summary'),
});

// TODO: ADD MORE SCHEMAS AS NEEDED FOR ADDITIONAL TOOLS
// Example Schema 3: Create/Submit tool (if your API supports it)
// const CreateArgumentsSchema = z.object({
//   title: z.string().min(1),
//   content: z.string().min(1),
//   tags: z.array(z.string()).optional(),
// });

// =============================================================================
// SERVER SETUP - USUALLY NO CHANGES NEEDED
// =============================================================================

// Create server instance
const server = new Server(
  {
    name: SERVICE_NAME, // Uses the SERVICE_NAME constant defined above
    version: "1.0.0", // TODO: Update version as needed
  },
  {
    capabilities: {
      tools: {},
      logging: {
        level: "debug" // TODO: Change to "info" or "error" for production
      }
    },
  }
);

// =============================================================================
// API REQUEST HELPER - CUSTOMIZE FOR YOUR API
// =============================================================================

// TODO: CUSTOMIZE THIS FUNCTION FOR YOUR API'S AUTHENTICATION AND REQUEST PATTERN
async function makeAPIRequest(endpoint: string, options: RequestInit = {}): Promise<any> {
  try {
    // TODO: CONSTRUCT YOUR API URL
    // Pattern varies by API:
    // - REST APIs: `${API_BASE_URL}/${endpoint}`
    // - Query parameter APIs: Add params to URL
    // - GraphQL APIs: Single endpoint with query in body
    const url = `${API_BASE_URL}/${endpoint}`;

    // TODO: CONFIGURE HEADERS FOR YOUR API
    const headers: Record<string, string> = {
      'Content-Type': 'application/json', // REPLACE: Adjust content type as needed
      'User-Agent': TOOL_NAME,
      // TODO: ADD AUTHENTICATION HEADERS
      // Examples:
      // 'Authorization': `Bearer ${API_KEY}`,
      // 'X-API-Key': API_KEY,
      // 'X-User-Email': USER_EMAIL,
    };

    // Add API key if available (adjust pattern for your API)
    if (API_KEY) {
      headers['Authorization'] = `Bearer ${API_KEY}`; // REPLACE: Use your API's auth pattern
    }

    // TODO: ADD RATE LIMITING IF NEEDED
    // Example: await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_MS));

    const response = await fetch(url, {
      ...options,
      headers: {
        ...headers,
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status} - ${response.statusText}`);
    }

    // TODO: ADJUST RESPONSE PARSING FOR YOUR API
    // Common patterns:
    // - JSON APIs: return await response.json();
    // - XML APIs: Parse with DOMParser or xml2js
    // - HTML APIs: Parse with cheerio
    // - Text APIs: return await response.text();
    
    const data = await response.json(); // REPLACE: Adjust parsing method
    return data;

  } catch (error) {
    console.error(`Error making API request to ${endpoint}:`, error);
    return null;
  }
}

// =============================================================================
// DATA FORMATTING FUNCTIONS - CUSTOMIZE FOR YOUR DATA STRUCTURE
// =============================================================================

// TODO: CREATE FUNCTIONS TO FORMAT YOUR API RESPONSE DATA

// Function to format individual records for Claude (text response)
function formatRecordForModel(record: any): string {
  // TODO: CUSTOMIZE THIS FUNCTION TO FORMAT YOUR RECORD DATA
  // This function should extract key information and format it as readable text
  // that will be included in the response to Claude
  
  // EXAMPLE IMPLEMENTATION (replace with your data structure):
  const title = record.title || "No title";
  const id = record.id || "No ID";
  const date = record.date || "No date";
  const description = record.description || "No description available";
  const url = record.url || "";

  return [
    `**Title:** ${title}`,
    `**ID:** ${id}`,
    `**Date:** ${date}`,
    `**Description:** ${description}`,
    url ? `**URL:** ${url}` : "",
    "---"
  ].filter(Boolean).join("\n");

  // TODO: ADJUST FIELDS AND FORMATTING FOR YOUR API DATA
  // Consider what information is most valuable for Claude to see
  // Keep it concise but informative
  // Use markdown formatting for better readability
}

// Function to format data for artifacts (structured data)
function formatArtifactData(records: any[]): any {
  // TODO: CUSTOMIZE THIS FUNCTION TO CREATE STRUCTURED ARTIFACT DATA
  // This function should transform your API response into a structured format
  // that can be used programmatically (JSON, CSV data, etc.)
  
  // EXAMPLE IMPLEMENTATION (replace with your data structure):
  return records.map(record => ({
    id: record.id || "",
    title: record.title || "",
    date: record.date || "",
    description: record.description || "",
    url: record.url || "",
    // TODO: ADD FIELDS RELEVANT TO YOUR API DATA
    // Consider what structured data would be useful:
    // - Bibliographic data (authors, citations)
    // - Metadata (tags, categories, scores)
    // - Relationships (connections, references)
    // - Raw data (measurements, statistics)
  }));

  // TODO: CONSIDER DIFFERENT ARTIFACT TYPES
  // Examples:
  // - application/vnd.bibliography for research papers
  // - application/vnd.dataset for data tables
  // - application/vnd.analytics for analysis results
  // - application/json for general structured data
}

// TODO: ADD ADDITIONAL FORMATTING FUNCTIONS AS NEEDED
// Examples:
// - formatSummaryData() for overview information
// - formatDetailedRecord() for full record details
// - formatSearchResults() for search result listings
// - formatAnalyticsData() for statistical information

// =============================================================================
// QUERY/SEARCH HELPER FUNCTIONS - CUSTOMIZE FOR YOUR API
// =============================================================================

// TODO: CREATE HELPER FUNCTIONS TO TRANSFORM USER INPUT INTO API QUERIES
// This depends heavily on your API's query format

function buildSearchQuery(searchParams: any): string {
  // TODO: IMPLEMENT QUERY BUILDING FOR YOUR API
  // Examples:
  // - REST APIs: Build URL parameters
  // - GraphQL APIs: Build GraphQL query string
  // - ElasticSearch: Build query DSL
  // - SQL APIs: Build SQL query string
  
  // EXAMPLE IMPLEMENTATION:
  const { query, max_results } = searchParams;
  return `q=${encodeURIComponent(query)}&limit=${max_results}`;
  
  // TODO: HANDLE COMPLEX QUERY PARAMETERS
  // - Boolean operators (AND, OR, NOT)
  // - Field-specific searches
  // - Date ranges
  // - Filters and categories
  // - Sorting and pagination
}

// =============================================================================
// TOOL DEFINITIONS - CUSTOMIZE YOUR TOOLS
// =============================================================================

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      // TODO: DEFINE YOUR FIRST TOOL (usually search/query)
      {
        name: "search", // REPLACE: Choose appropriate tool name
        description: "Search the API for records. " + // REPLACE: Describe what this tool does
          "Provide a query string and optional parameters. " +
          "Returns both readable results and structured data as artifacts.",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Search query string", // REPLACE: Describe your query format
            },
            max_results: {
              type: "number",
              description: "Maximum number of results to return (1-100)",
              minimum: 1,
              maximum: 100,
            },
            // TODO: ADD YOUR SPECIFIC SEARCH PARAMETERS
            // Examples:
            // category: {
            //   type: "string",
            //   enum: ["research", "news", "clinical"],
            //   description: "Category to search within",
            // },
            // date_range: {
            //   type: "object",
            //   properties: {
            //     start: { type: "string", description: "Start date (YYYY-MM-DD)" },
            //     end: { type: "string", description: "End date (YYYY-MM-DD)" }
            //   },
            //   description: "Optional date range filter"
            // },
          },
          required: ["query"],
        },
      },
      // TODO: DEFINE YOUR SECOND TOOL (usually get details)
      {
        name: "get-details", // REPLACE: Choose appropriate tool name
        description: "Get detailed information about a specific record by ID", // REPLACE: Describe what this tool does
        inputSchema: {
          type: "object",
          properties: {
            id: {
              type: "string",
              description: "The unique identifier of the record", // REPLACE: Describe your ID format
            },
            // TODO: ADD ADDITIONAL DETAIL PARAMETERS
            // Examples:
            // include_metadata: {
            //   type: "boolean",
            //   description: "Include additional metadata in response",
            // },
            // format: {
            //   type: "string",
            //   enum: ["summary", "full"],
            //   description: "Level of detail to return",
            // },
          },
          required: ["id"],
        },
      },
      // TODO: ADD MORE TOOLS AS NEEDED
      // Examples:
      // - analyze: Perform analysis on data
      // - create: Create new records (if API supports)
      // - update: Update existing records
      // - delete: Delete records
      // - export: Export data in specific formats
      // - validate: Validate data before submission
    ],
  };
});

// =============================================================================
// TOOL EXECUTION - CUSTOMIZE FOR YOUR API CALLS
// =============================================================================

// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    // TODO: IMPLEMENT YOUR SEARCH TOOL
    if (name === "search") {
      const searchParams = SearchArgumentsSchema.parse(args);
      
      // TODO: BUILD YOUR API QUERY
      const queryString = buildSearchQuery(searchParams);
      console.error(`[${SERVICE_NAME}] Search params:`, JSON.stringify(searchParams));
      console.error(`[${SERVICE_NAME}] Query string:`, queryString);
      
      // TODO: MAKE YOUR API CALL
      // Adjust the endpoint path for your API
      const searchEndpoint = `search?${queryString}`; // REPLACE: Your search endpoint
      console.log(`[DEBUG] API search URL: ${API_BASE_URL}/${searchEndpoint}`);
      const searchData = await makeAPIRequest(searchEndpoint);
      
      if (!searchData) {
        return {
          content: [
            {
              type: "text",
              text: "Failed to retrieve search results from the API",
            },
          ],
        };
      }

      // TODO: EXTRACT RECORDS FROM API RESPONSE
      // Adjust this based on your API's response structure
      const records = searchData.results || searchData.data || searchData.items || []; // REPLACE: Your API's data array path
      
      if (records.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: "No results found for the given query",
            },
          ],
        };
      }

      console.log(`[DEBUG] Found ${records.length} records`);
      
      // TODO: FORMAT RECORDS FOR TEXT RESPONSE
      const formattedRecords = records.map(formatRecordForModel);
      
      // TODO: CREATE STRUCTURED ARTIFACT DATA
      const artifactData = formatArtifactData(records);

      console.log(`[DEBUG] First formatted record:`, formattedRecords[0]);
      console.log(`[DEBUG] First artifact entry:`, JSON.stringify(artifactData[0], null, 2));

      return {
        content: [
          {
            type: "text",
            text: `# Search Results: ${searchParams.query}\n\n${formattedRecords.join("\n\n")}`,
            forModel: true
          }
        ],
        artifacts: [
          {
            // TODO: CHOOSE APPROPRIATE ARTIFACT TYPE
            // Common types:
            // - application/json: General structured data
            // - application/vnd.bibliography: Research citations
            // - application/vnd.dataset: Tabular data
            // - application/vnd.analytics: Analysis results
            type: "application/json", // REPLACE: Choose appropriate MIME type
            title: "Search Results Data", // REPLACE: Descriptive title
            content: artifactData
          }
        ]
      };

    // TODO: IMPLEMENT YOUR GET DETAILS TOOL
    } else if (name === "get-details") {
      const { id } = GetDetailsArgumentsSchema.parse(args);
      
      // TODO: MAKE API CALL FOR DETAILED RECORD
      const detailEndpoint = `details/${id}`; // REPLACE: Your detail endpoint pattern
      const recordData = await makeAPIRequest(detailEndpoint);

      if (!recordData) {
        return {
          content: [
            {
              type: "text",
              text: "Failed to retrieve record details from the API",
            },
          ],
        };
      }

      // TODO: EXTRACT RECORD FROM RESPONSE
      const record = recordData.data || recordData; // REPLACE: Adjust for your API structure
      
      if (!record) {
        return {
          content: [
            {
              type: "text",
              text: `No record found with ID: ${id}`,
            },
          ],
        };
      }

      // TODO: FORMAT RECORD FOR RESPONSE
      const formattedRecord = formatRecordForModel(record);

      return {
        content: [
          {
            type: "text",
            text: formattedRecord,
          },
        ],
      };
      
    // TODO: ADD MORE TOOL IMPLEMENTATIONS
    // } else if (name === "analyze") {
    //   // Implementation for analysis tool
    //   
    // } else if (name === "create") {
    //   // Implementation for creation tool
    //   
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

// =============================================================================
// SERVER STARTUP - USUALLY NO CHANGES NEEDED
// =============================================================================

// Start the server
async function main() {
  // Log configuration status
  if (API_KEY) {
    console.log(`[${SERVICE_NAME}] API Key found, using authenticated requests`);
  } else {
    console.log(`[${SERVICE_NAME}] No API Key found, using unauthenticated requests`);
  }
  console.log(`[${SERVICE_NAME}] Using email: ${USER_EMAIL}`);
  // TODO: LOG OTHER IMPORTANT CONFIGURATION
  console.log(`[${SERVICE_NAME}] API Base URL: ${API_BASE_URL}`);

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.log(`[${SERVICE_NAME}] MCP Server running on stdio`);
}

main().catch((error) => {
  console.error(`[${SERVICE_NAME}] Fatal error in main():`, error);
  process.exit(1);
}); 