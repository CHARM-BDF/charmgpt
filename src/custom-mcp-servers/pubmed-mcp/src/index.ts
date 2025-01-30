import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { DOMParser } from 'xmldom';

// Constants for the NCBI E-utilities API
const NCBI_API_BASE = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";
const TOOL_NAME = "pubmed-search-mcp";
const EMAIL = "acrouse.uab@gmail.com"; // Replace with your email

// Define schemas for validation
const SearchArgumentsSchema = z.object({
  query: z.string(),
  max_results: z.number().min(1).max(100).optional().default(10),
});

const GetDetailsArgumentsSchema = z.object({
  pmid: z.string(),
});

// Create server instance
const server = new Server(
  {
    name: "pubmed-search",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Helper function for making API requests
async function makeNCBIRequest(url: string): Promise<any> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const text = await response.text();
    // Parse XML response
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(text, "text/xml");
    return xmlDoc;
  } catch (error) {
    console.error("Error making NCBI request:", error);
    return null;
  }
}

// Function to format article data
function formatArticle(article: Element): string {
  const titleElements = article.getElementsByTagName("ArticleTitle");
  const title = titleElements.length > 0 ? titleElements.item(0)?.textContent || "No title" : "No title";
  
  const authorElements = article.getElementsByTagName("Author");
  const authors = Array.from({ length: authorElements.length }, (_, i) => {
    const author = authorElements.item(i);
    const lastNameElements = author?.getElementsByTagName("LastName");
    const initialsElements = author?.getElementsByTagName("Initials");
    const lastName = lastNameElements?.item(0)?.textContent || "";
    const initials = initialsElements?.item(0)?.textContent || "";
    return `${lastName} ${initials}`;
  }).join(", ");

  const abstractElements = article.getElementsByTagName("Abstract");
  const abstract = abstractElements.length > 0 ? abstractElements.item(0)?.textContent || "No abstract available" : "No abstract available";
  
  const pmidElements = article.getElementsByTagName("PMID");
  const pmid = pmidElements.length > 0 ? pmidElements.item(0)?.textContent || "No PMID" : "No PMID";
  
  const journalElements = article.getElementsByTagName("Journal");
  const journal = journalElements.length > 0 ? 
    journalElements.item(0)?.getElementsByTagName("Title")?.item(0)?.textContent || "No journal" : 
    "No journal";
  
  const yearElements = article.getElementsByTagName("PubDate");
  const year = yearElements.length > 0 ? 
    yearElements.item(0)?.getElementsByTagName("Year")?.item(0)?.textContent || "No year" : 
    "No year";

  return [
    `Title: ${title}`,
    `Authors: ${authors}`,
    `Journal: ${journal} (${year})`,
    `PMID: ${pmid}`,
    `Abstract: ${abstract}`,
    "---"
  ].join("\n");
}

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "search",
        description: "Search PubMed for articles",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Search query for PubMed",
            },
            max_results: {
              type: "number",
              description: "Maximum number of results to return (1-100)",
            },
          },
          required: ["query"],
        },
      },
      {
        name: "get-details",
        description: "Get detailed information about a specific PubMed article",
        inputSchema: {
          type: "object",
          properties: {
            pmid: {
              type: "string",
              description: "PubMed ID (PMID) of the article",
            },
          },
          required: ["pmid"],
        },
      },
    ],
  };
});

// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    if (name === "search") {
      const { query, max_results } = SearchArgumentsSchema.parse(args);
      
      // Perform PubMed search
      const searchUrl = `${NCBI_API_BASE}/esearch.fcgi?db=pubmed&term=${encodeURIComponent(query)}&retmax=${max_results}&tool=${TOOL_NAME}&email=${EMAIL}`;
      const searchData = await makeNCBIRequest(searchUrl);
      
      if (!searchData) {
        return {
          content: [
            {
              type: "text",
              text: "Failed to retrieve search results",
            },
          ],
        };
      }

      const idElements = searchData.getElementsByTagName("Id");
      const pmids = Array.from({ length: idElements.length }, (_, i) => 
        idElements.item(i)?.textContent).filter(Boolean);

      if (pmids.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: "No results found for the given query",
            },
          ],
        };
      }

      // Fetch details for found PMIDs
      const fetchUrl = `${NCBI_API_BASE}/efetch.fcgi?db=pubmed&id=${pmids.join(",")}&retmode=xml&tool=${TOOL_NAME}&email=${EMAIL}`;
      const articlesData = await makeNCBIRequest(fetchUrl);

      if (!articlesData) {
        return {
          content: [
            {
              type: "text",
              text: "Failed to retrieve article details",
            },
          ],
        };
      }

      const articleElements = articlesData.getElementsByTagName("PubmedArticle");
      const articles = Array.from({ length: articleElements.length }, (_, i) => 
        articleElements.item(i) as Element);
      const formattedArticles = articles.map(formatArticle);

      return {
        content: [
          {
            type: "text",
            text: `Search results for "${query}":\n\n${formattedArticles.join("\n")}`,
          },
        ],
      };

    } else if (name === "get-details") {
      const { pmid } = GetDetailsArgumentsSchema.parse(args);
      
      // Fetch article details
      const fetchUrl = `${NCBI_API_BASE}/efetch.fcgi?db=pubmed&id=${pmid}&retmode=xml&tool=${TOOL_NAME}&email=${EMAIL}`;
      const articleData = await makeNCBIRequest(fetchUrl);

      if (!articleData) {
        return {
          content: [
            {
              type: "text",
              text: "Failed to retrieve article details",
            },
          ],
        };
      }

      const articles = articleData.getElementsByTagName("PubmedArticle");
      const article = articles.length > 0 ? articles.item(0) as Element : null;
      
      if (!article) {
        return {
          content: [
            {
              type: "text",
              text: `No article found with PMID: ${pmid}`,
            },
          ],
        };
      }

      const formattedArticle = formatArticle(article);

      return {
        content: [
          {
            type: "text",
            text: formattedArticle,
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

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("PubMed Search MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});