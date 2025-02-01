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

// Get environment variables
const NCBI_API_KEY = process.env.NCBI_API_KEY;
const NCBI_TOOL_EMAIL = process.env.NCBI_TOOL_EMAIL || 'anonymous@example.com';

// Define schemas for validation
const SearchArgumentsSchema = z.object({
  terms: z.array(z.object({
    term: z.string(),
    operator: z.enum(['AND', 'OR', 'NOT']).optional().default('AND')
  })),
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
    // Add API key and email to URL
    const finalUrl = new URL(url);
    if (NCBI_API_KEY) {
      finalUrl.searchParams.append('api_key', NCBI_API_KEY);
    }
    finalUrl.searchParams.append('email', NCBI_TOOL_EMAIL);
    finalUrl.searchParams.append('tool', TOOL_NAME);

    const response = await fetch(finalUrl.toString());
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

// Function to format article data for Claude (concise version)
function formatArticleForModel(article: Element): string {
  const titleElements = article.getElementsByTagName("ArticleTitle");
  const title = titleElements.length > 0 ? titleElements.item(0)?.textContent || "No title" : "No title";
  
  const yearElements = article.getElementsByTagName("PubDate");
  const year = yearElements.length > 0 ? 
    yearElements.item(0)?.getElementsByTagName("Year")?.item(0)?.textContent || "No year" : 
    "No year";
  
  const pmidElements = article.getElementsByTagName("PMID");
  const pmid = pmidElements.length > 0 ? pmidElements.item(0)?.textContent || "No PMID" : "No PMID";
  
  const abstractElements = article.getElementsByTagName("Abstract");
  const abstract = abstractElements.length > 0 ? abstractElements.item(0)?.textContent || "No abstract available" : "No abstract available";

  return [
    `Title: ${title}`,
    `Year: ${year}`,
    `PMID: ${pmid}`,
    `Abstract: ${abstract}`,
    "---"
  ].join("\n");
}

// Function to format bibliography
function formatBibliography(articles: Element[]): string {
  return articles.map((article, index) => {
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

    const journalElements = article.getElementsByTagName("Journal");
    const journal = journalElements.length > 0 ? 
      journalElements.item(0)?.getElementsByTagName("Title")?.item(0)?.textContent || "No journal" : 
      "No journal";
    
    const yearElements = article.getElementsByTagName("PubDate");
    const year = yearElements.length > 0 ? 
      yearElements.item(0)?.getElementsByTagName("Year")?.item(0)?.textContent || "No year" : 
      "No year";

    const pmidElements = article.getElementsByTagName("PMID");
    const pmid = pmidElements.length > 0 ? pmidElements.item(0)?.textContent || "No PMID" : "No PMID";

    return `${index + 1}. ${authors}. (${year}). ${title}. *${journal}*. PMID: ${pmid}`;
  }).join("\n\n");
}

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "search",
        description: "Search PubMed for articles. Extract search terms and boolean operators from the query. For example:\n" +
          '- Query: "find papers about BRCA1 and breast cancer" → terms: [{"term": "BRCA1"}, {"term": "breast cancer", "operator": "AND"}]\n' +
          '- Query: "papers with TP53 or apoptosis" → terms: [{"term": "TP53"}, {"term": "apoptosis", "operator": "OR"}]\n' +
          '- Query: "PTEN but not breast cancer" → terms: [{"term": "PTEN"}, {"term": "breast cancer", "operator": "NOT"}]\n' +
          "Uppercase terms are treated as gene symbols. Multi-word terms are treated as phrases.",
        inputSchema: {
          type: "object",
          properties: {
            terms: {
              type: "array",
              description: "Array of search terms and their boolean operators. First term's operator is ignored.",
              items: {
                type: "object",
                properties: {
                  term: {
                    type: "string",
                    description: "The search term"
                  },
                  operator: {
                    type: "string",
                    enum: ["AND", "OR", "NOT"],
                    description: "Boolean operator to connect with previous term. Ignored for first term."
                  }
                },
                required: ["term"]
              }
            },
            max_results: {
              type: "number",
              description: "Maximum number of results to return (1-100)",
            },
          },
          required: ["terms"],
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

function formatPubMedQuery(terms: Array<{ term: string; operator?: string }>): string {
  // Format each term with appropriate field tags and operators
  return terms.map((item, index) => {
    const { term, operator = 'AND' } = item;
    let formattedTerm;

    // Format the term
    if (/^[A-Z0-9]+$/.test(term)) {
      formattedTerm = `${term}[gene]`;
    } else if (term.includes(' ')) {
      formattedTerm = `"${term}"[All Fields]`;
    } else {
      formattedTerm = `${term}[All Fields]`;
    }

    // Add operator except for first term
    return index === 0 ? formattedTerm : `${operator} ${formattedTerm}`;
  }).join(' ');
}

// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    if (name === "search") {
      const { terms, max_results } = SearchArgumentsSchema.parse(args);
      
      // Format the query from terms
      const formattedQuery = formatPubMedQuery(terms);
      console.error(`Search terms: ${JSON.stringify(terms)}`);
      console.error(`Formatted query: ${formattedQuery}`);
      
      // Perform PubMed search
      const searchUrl = `${NCBI_API_BASE}/esearch.fcgi?db=pubmed&term=${encodeURIComponent(formattedQuery)}&retmax=${max_results}`;
      console.log('\n[DEBUG] PubMed search URL:', searchUrl);
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
      const fetchUrl = `${NCBI_API_BASE}/efetch.fcgi?db=pubmed&id=${pmids.join(",")}&retmode=xml`;
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
      
      console.log('\n[DEBUG] Found articles:', articles.length);
      
      // Transform articles into markdown formatted text
      const markdownArticles = articles.map(article => {
        const titleElements = article.getElementsByTagName("ArticleTitle");
        const title = titleElements.length > 0 ? titleElements.item(0)?.textContent || "No title" : "No title";
        
        const yearElements = article.getElementsByTagName("PubDate");
        const year = yearElements.length > 0 ? 
          yearElements.item(0)?.getElementsByTagName("Year")?.item(0)?.textContent || "No year" : 
          "No year";
        
        const pmidElements = article.getElementsByTagName("PMID");
        const pmid = pmidElements.length > 0 ? pmidElements.item(0)?.textContent || "No PMID" : "No PMID";
        
        const abstractElements = article.getElementsByTagName("Abstract");
        const abstract = abstractElements.length > 0 ? abstractElements.item(0)?.textContent || "No abstract available" : "No abstract available";

        return `## Article
### Title
${title}

### Year
${year}

### PMID
${pmid}

### Abstract
${abstract}

---`;
      });

      console.log('\n[DEBUG] First markdown article:', markdownArticles[0]);
      
      const bibliography = formatBibliography(articles);
      console.log('\n[DEBUG] Bibliography format:', bibliography.split('\n\n')[0]);

      return {
        content: [
          {
            type: "text",
            text: `# Search Results for: ${formattedQuery}\n\n${markdownArticles.join("\n\n")}`,
            forModel: true
          }
        ],
        bibliography: bibliography
      };

    } else if (name === "get-details") {
      const { pmid } = GetDetailsArgumentsSchema.parse(args);
      
      // Fetch article details
      const fetchUrl = `${NCBI_API_BASE}/efetch.fcgi?db=pubmed&id=${pmid}&retmode=xml`;
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

      const formattedArticle = formatArticleForModel(article);

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
  // Log configuration status
  if (NCBI_API_KEY) {
    console.log("[pubmed] NCBI API Key found, using authenticated requests");
  } else {
    console.log("[pubmed] No NCBI API Key found, using unauthenticated requests");
  }
  console.log(`[pubmed] Using email: ${NCBI_TOOL_EMAIL}`);

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.log("[pubmed] PubMed Search MCP Server running on stdio");
}

main().catch((error) => {
  console.error("[pubmed] Fatal error in main():", error);
  process.exit(1);
});