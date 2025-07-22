import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

// =============================================================================
// CONFIGURATION SECTION - Wikipedia API Configuration
// =============================================================================

const API_BASE_URL = "https://en.wikipedia.org/w/api.php";
const TOOL_NAME = "wiki-disease-mcp";
const SERVICE_NAME = "wiki-disease";

// Rate limiting to be respectful to Wikipedia
const RATE_LIMIT_MS = 1000; // 1 second between requests

// =============================================================================
// SCHEMA DEFINITIONS
// =============================================================================

const SearchDiseaseArgumentsSchema = z.object({
  disease_name: z.string().min(1, "Disease name cannot be empty"),
  max_results: z.number().min(1).max(20).optional().default(5),
  include_categories: z.boolean().optional().default(true),
});

const GetDiseaseDetailsArgumentsSchema = z.object({
  page_title: z.string().min(1, "Page title cannot be empty"),
  sections: z.array(z.string()).optional().describe("Specific sections to extract (e.g., 'Symptoms', 'Treatment')"),
});

const GetDiseaseByCategoryArgumentsSchema = z.object({
  category: z.string().min(1, "Category cannot be empty"),
  max_results: z.number().min(1).max(50).optional().default(10),
});

// =============================================================================
// SERVER SETUP
// =============================================================================

const server = new Server(
  {
    name: SERVICE_NAME,
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
      logging: {
        level: "debug"
      }
    },
  }
);

// =============================================================================
// API REQUEST HELPERS
// =============================================================================

async function makeWikipediaRequest(params: Record<string, any>): Promise<any> {
  try {
    // Add default parameters
    params.format = 'json';
    params.origin = '*';
    
    // Build URL with query parameters
    const url = new URL(API_BASE_URL);
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, String(value));
    });

    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_MS));

    const response = await fetch(url.toString(), {
      headers: {
        'User-Agent': `${TOOL_NAME}/1.0 (https://github.com/yourusername/charm-mcp)`,
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status} - ${response.statusText}`);
    }

    const data = await response.json();
    return data;

  } catch (error) {
    console.error(`Error making Wikipedia API request:`, error);
    return null;
  }
}

// =============================================================================
// DATA FORMATTING FUNCTIONS
// =============================================================================

function formatSearchResultForModel(page: any): string {
  const title = page.title || "No title";
  const pageId = page.pageid || "No ID";
  const snippet = page.snippet ? page.snippet.replace(/<[^>]*>/g, '') : "No snippet available";
  const categories = page.categories ? page.categories.map((c: any) => c.title.replace('Category:', '')).join(', ') : "";

  return [
    `**Title:** ${title}`,
    `**Page ID:** ${pageId}`,
    `**Snippet:** ${snippet}`,
    categories ? `**Categories:** ${categories}` : "",
    "---"
  ].filter(Boolean).join("\n");
}

function formatPageContentAsMarkdown(title: string, sections: any): string {
  let markdown = `# ${title}\n\n`;
  
  // Process each section
  Object.entries(sections).forEach(([sectionTitle, sectionContent]) => {
    if (sectionTitle && sectionContent) {
      markdown += `## ${sectionTitle}\n\n`;
      markdown += `${sectionContent}\n\n`;
    }
  });
  
  return markdown;
}

function extractPageSections(wikitext: string): Record<string, string> {
  const sections: Record<string, string> = {};
  let currentSection = "Introduction";
  let currentContent: string[] = [];
  
  const lines = wikitext.split('\n');
  
  for (const line of lines) {
    // Check for section headers
    const sectionMatch = line.match(/^(={2,6})\s*(.+?)\s*\1$/);
    if (sectionMatch) {
      // Save previous section
      if (currentContent.length > 0) {
        sections[currentSection] = cleanWikitext(currentContent.join('\n'));
      }
      // Start new section
      currentSection = sectionMatch[2];
      currentContent = [];
    } else {
      currentContent.push(line);
    }
  }
  
  // Save last section
  if (currentContent.length > 0) {
    sections[currentSection] = cleanWikitext(currentContent.join('\n'));
  }
  
  return sections;
}

function cleanWikitext(text: string): string {
  // Remove wiki templates {{...}}
  text = text.replace(/\{\{[^}]+\}\}/g, '');
  
  // Convert wiki links [[Link|Display]] to just Display
  text = text.replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2');
  text = text.replace(/\[\[([^\]]+)\]\]/g, '$1');
  
  // Remove references <ref>...</ref>
  text = text.replace(/<ref[^>]*>.*?<\/ref>/gs, '');
  text = text.replace(/<ref[^>]*\/>/g, '');
  
  // Remove HTML comments <!-- -->
  text = text.replace(/<!--.*?-->/gs, '');
  
  // Convert bold/italic wiki markup
  text = text.replace(/'''([^']+)'''/g, '**$1**');
  text = text.replace(/''([^']+)''/g, '*$1*');
  
  // Clean up extra whitespace
  text = text.replace(/\n{3,}/g, '\n\n');
  text = text.trim();
  
  return text;
}

// =============================================================================
// TOOL DEFINITIONS
// =============================================================================

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "search-disease",
        description: "Search Wikipedia for disease-related articles. Returns search results with snippets and categories.",
        inputSchema: {
          type: "object",
          properties: {
            disease_name: {
              type: "string",
              description: "Name of the disease or medical condition to search for",
            },
            max_results: {
              type: "number",
              description: "Maximum number of results to return (1-20)",
              minimum: 1,
              maximum: 20,
            },
            include_categories: {
              type: "boolean",
              description: "Include category information for each result",
            },
          },
          required: ["disease_name"],
        },
      },
      {
        name: "get-disease-details",
        description: "Get detailed information about a specific disease from its Wikipedia page",
        inputSchema: {
          type: "object",
          properties: {
            page_title: {
              type: "string",
              description: "The exact Wikipedia page title",
            },
            sections: {
              type: "array",
              items: {
                type: "string"
              },
              description: "Specific sections to extract (e.g., 'Symptoms', 'Treatment'). If not specified, returns all sections.",
            },
          },
          required: ["page_title"],
        },
      },
      {
        name: "get-diseases-by-category",
        description: "Get a list of diseases from a specific Wikipedia category",
        inputSchema: {
          type: "object",
          properties: {
            category: {
              type: "string",
              description: "Wikipedia category name (e.g., 'Infectious diseases', 'Genetic disorders')",
            },
            max_results: {
              type: "number",
              description: "Maximum number of results to return (1-50)",
              minimum: 1,
              maximum: 50,
            },
          },
          required: ["category"],
        },
      },
    ],
  };
});

// =============================================================================
// TOOL EXECUTION
// =============================================================================

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    if (name === "search-disease") {
      const searchParams = SearchDiseaseArgumentsSchema.parse(args);
      
      console.error(`[${SERVICE_NAME}] Searching for disease:`, searchParams.disease_name);
      
      // Search for pages
      const searchData = await makeWikipediaRequest({
        action: 'query',
        list: 'search',
        srsearch: `${searchParams.disease_name} disease medical`,
        srlimit: searchParams.max_results,
        srprop: 'snippet|size',
      });
      
      if (!searchData || !searchData.query || !searchData.query.search) {
        return {
          content: [
            {
              type: "text",
              text: "Failed to retrieve search results from Wikipedia",
            },
          ],
        };
      }

      const searchResults = searchData.query.search;
      
      if (searchResults.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: "No disease-related articles found on Wikipedia",
            },
          ],
        };
      }

      // If categories are requested, fetch them for each page
      if (searchParams.include_categories) {
        const pageIds = searchResults.map((r: any) => r.pageid).join('|');
        const categoryData = await makeWikipediaRequest({
          action: 'query',
          pageids: pageIds,
          prop: 'categories',
          cllimit: 5,
        });
        
        if (categoryData && categoryData.query && categoryData.query.pages) {
          searchResults.forEach((result: any) => {
            const pageData = categoryData.query.pages[result.pageid];
            if (pageData && pageData.categories) {
              result.categories = pageData.categories;
            }
          });
        }
      }

      const formattedResults = searchResults.map(formatSearchResultForModel);
      
      // Create markdown artifact
      const markdownContent = [
        `# Wikipedia Disease Search Results: "${searchParams.disease_name}"`,
        '',
        `Found ${searchResults.length} relevant articles.`,
        '',
        ...searchResults.map((result: any) => {
          const title = result.title;
          const snippet = result.snippet ? result.snippet.replace(/<[^>]*>/g, '') : "";
          const size = result.size ? `${result.size} bytes` : "";
          const categories = result.categories ? 
            result.categories.map((c: any) => c.title.replace('Category:', '')).slice(0, 3).join(', ') : "";
          
          return [
            `## ${title}`,
            '',
            snippet ? `**Summary:** ${snippet}` : "",
            size ? `**Size:** ${size}` : "",
            categories ? `**Categories:** ${categories}` : "",
            '',
            '---',
            ''
          ].filter(Boolean).join('\n');
        })
      ].join('\n');

      return {
        content: [
          {
            type: "text",
            text: `# Disease Search Results\n\n${formattedResults.join("\n\n")}\n\n` +
                  `**Instructions for summarization:** Based on the conversation context, please summarize the most relevant disease information found. ` +
                  `Focus on diseases that match the user's specific interests or questions. ` +
                  `If the user is looking for specific symptoms, treatments, or characteristics, highlight those aspects from the search results.`,
            forModel: true
          }
        ],
        artifacts: [
          {
            type: "text/markdown",
            title: `Disease Search: ${searchParams.disease_name}`,
            content: markdownContent
          }
        ]
      };

    } else if (name === "get-disease-details") {
      const { page_title, sections } = GetDiseaseDetailsArgumentsSchema.parse(args);
      
      console.error(`[${SERVICE_NAME}] Getting details for:`, page_title);
      
      // Get page content
      const pageData = await makeWikipediaRequest({
        action: 'query',
        titles: page_title,
        prop: 'revisions|info',
        rvprop: 'content',
        rvslots: 'main',
        inprop: 'url',
      });
      
      if (!pageData || !pageData.query || !pageData.query.pages) {
        return {
          content: [
            {
              type: "text",
              text: "Failed to retrieve page content from Wikipedia",
            },
          ],
        };
      }

      const pages = Object.values(pageData.query.pages);
      const page: any = pages[0];
      
      if (!page || page.missing) {
        return {
          content: [
            {
              type: "text",
              text: `No Wikipedia page found with title: ${page_title}`,
            },
          ],
        };
      }

      const wikitext = page.revisions[0].slots.main['*'];
      const pageUrl = page.fullurl;
      
      // Extract and clean sections
      const allSections = extractPageSections(wikitext);
      
      // Filter sections if specific ones requested
      let relevantSections = allSections;
      if (sections && sections.length > 0) {
        relevantSections = {};
        sections.forEach(sectionName => {
          // Case-insensitive section matching
          const matchedSection = Object.keys(allSections).find(
            key => key.toLowerCase() === sectionName.toLowerCase()
          );
          if (matchedSection) {
            relevantSections[matchedSection] = allSections[matchedSection];
          }
        });
      }
      
      // Create markdown content
      const markdownContent = formatPageContentAsMarkdown(page_title, relevantSections) + 
                            `\n\n---\n\n**Source:** [${page_title} on Wikipedia](${pageUrl})`;

      // Create summary for model
      const sectionsText = Object.entries(relevantSections)
        .map(([title, content]) => `### ${title}\n${content.substring(0, 500)}...`)
        .join('\n\n');

      return {
        content: [
          {
            type: "text",
            text: `# Disease Information: ${page_title}\n\n${sectionsText}\n\n` +
                  `**Instructions for summarization:** Based on the conversation context, extract and summarize the most relevant information about ${page_title}. ` +
                  `Focus on the aspects that directly address the user's questions or concerns. ` +
                  `If the user is asking about specific aspects (symptoms, causes, treatments, prognosis), prioritize those sections. ` +
                  `Provide a concise but comprehensive summary that helps the user understand this condition.`,
            forModel: true
          }
        ],
        artifacts: [
          {
            type: "text/markdown",
            title: `${page_title} - Wikipedia`,
            content: markdownContent
          }
        ]
      };

    } else if (name === "get-diseases-by-category") {
      const { category, max_results } = GetDiseaseByCategoryArgumentsSchema.parse(args);
      
      console.error(`[${SERVICE_NAME}] Getting diseases from category:`, category);
      
      // Get pages in category
      const categoryData = await makeWikipediaRequest({
        action: 'query',
        list: 'categorymembers',
        cmtitle: `Category:${category}`,
        cmlimit: max_results,
        cmtype: 'page',
      });
      
      if (!categoryData || !categoryData.query || !categoryData.query.categorymembers) {
        return {
          content: [
            {
              type: "text",
              text: `Failed to retrieve pages from category: ${category}`,
            },
          ],
        };
      }

      const pages = categoryData.query.categorymembers;
      
      if (pages.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: `No pages found in category: ${category}`,
            },
          ],
        };
      }

      // Create markdown content
      const markdownContent = [
        `# Diseases in Category: ${category}`,
        '',
        `Found ${pages.length} disease-related pages.`,
        '',
        ...pages.map((page: any, index: number) => 
          `${index + 1}. [${page.title}](https://en.wikipedia.org/wiki/${encodeURIComponent(page.title.replace(/ /g, '_'))})`
        )
      ].join('\n');

      // Create summary for model
      const pageList = pages.map((p: any) => p.title).join(', ');

      return {
        content: [
          {
            type: "text",
            text: `# Diseases in Category: ${category}\n\nFound ${pages.length} pages: ${pageList}\n\n` +
                  `**Instructions for summarization:** Based on the conversation context, identify which diseases from this category are most relevant. ` +
                  `If the user is looking for specific types of conditions, highlight those. ` +
                  `Provide a brief overview of the category and suggest which diseases might be most relevant to explore further.`,
            forModel: true
          }
        ],
        artifacts: [
          {
            type: "text/markdown",
            title: `Category: ${category}`,
            content: markdownContent
          }
        ]
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

// =============================================================================
// SERVER STARTUP
// =============================================================================

async function main() {
  console.log(`[${SERVICE_NAME}] Starting Wikipedia Disease MCP Server`);
  console.log(`[${SERVICE_NAME}] API Base URL: ${API_BASE_URL}`);
  console.log(`[${SERVICE_NAME}] Rate limit: ${RATE_LIMIT_MS}ms between requests`);

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.log(`[${SERVICE_NAME}] MCP Server running on stdio`);
}

main().catch((error) => {
  console.error(`[${SERVICE_NAME}] Fatal error in main():`, error);
  process.exit(1);
}); 