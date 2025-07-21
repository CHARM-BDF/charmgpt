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
const TOOL_NAME = "variant-litsearch-mcp";

// Get environment variables
const NCBI_API_KEY = process.env.NCBI_API_KEY;
const NCBI_TOOL_EMAIL = process.env.NCBI_TOOL_EMAIL || 'variant-litsearch@example.com';

// Schema for variant case information
const VariantCaseSchema = z.object({
  genes: z.array(z.string()).optional().describe("List of genes involved in the variant case"),
  phenotypes: z.array(z.string()).optional().describe("List of phenotypes or diseases associated with the case"),
  mechanisms: z.array(z.string()).optional().describe("List of known or suspected mechanisms of action"),
  drugs: z.array(z.string()).optional().describe("List of drugs or treatments being considered"),
  contextQuery: z.string().describe("Natural language query providing additional context about the case"),
  maxResults: z.number().min(1).max(50).optional().default(10).describe("Maximum number of results to return"),
  includeJustification: z.boolean().optional().default(true).describe("Whether to include justification for each result")
});

// Create server instance
const server = new Server(
  {
    name: "variant-litsearch",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Helper function for making API requests
async function makeNCBIRequest(url: string): Promise<Document | null> {
  try {
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
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(text, "text/xml");
    return xmlDoc;
  } catch (error) {
    console.error("Error making NCBI request:", error);
    return null;
  }
}

// Function to properly format search terms for PubMed
function formatSearchTerm(term: string): string {
  // Quote multi-word terms for PubMed
  return term.includes(' ') ? `"${term}"` : term;
}

// Function to build sophisticated search query from variant case
function buildSearchQuery(variantCase: z.infer<typeof VariantCaseSchema>): string {
  const terms: string[] = [];

  // Add genes with appropriate MeSH terms (genes are usually single words)
  if (variantCase.genes && variantCase.genes.length > 0) {
    const geneTerms = variantCase.genes.map(gene => `(${gene}[tiab] OR ${gene}[mesh])`).join(" OR ");
    terms.push(`(${geneTerms})`);
  }

  // Add phenotypes/diseases (often multi-word, need proper quoting)
  if (variantCase.phenotypes && variantCase.phenotypes.length > 0) {
    const phenotypeTerms = variantCase.phenotypes.map(phenotype => {
      const formattedTerm = formatSearchTerm(phenotype);
      return `(${formattedTerm}[tiab] OR ${formattedTerm}[mesh])`;
    }).join(" OR ");
    terms.push(`(${phenotypeTerms})`);
  }

  // Add mechanisms (often multi-word)
  if (variantCase.mechanisms && variantCase.mechanisms.length > 0) {
    const mechanismTerms = variantCase.mechanisms.map(mechanism => {
      const formattedTerm = formatSearchTerm(mechanism);
      return `${formattedTerm}[tiab]`;
    }).join(" OR ");
    terms.push(`(${mechanismTerms})`);
  }

  // Add drugs/treatments  
  if (variantCase.drugs && variantCase.drugs.length > 0) {
    const drugTerms = variantCase.drugs.map(drug => {
      const formattedTerm = formatSearchTerm(drug);
      return `(${formattedTerm}[tiab] OR ${formattedTerm}[mesh])`;
    }).join(" OR ");
    terms.push(`(${drugTerms})`);
  }

  // Parse context query into meaningful terms instead of treating as single phrase
  if (variantCase.contextQuery) {
    // Extract key terms from context, skip common words
    const contextWords = variantCase.contextQuery.toLowerCase()
      .split(/[\s,]+/)
      .filter(word => word.length > 3 && !['with', 'and', 'the', 'for', 'from', 'this', 'that', 'relationship'].includes(word))
      .slice(0, 3); // Limit to 3 most relevant terms
    
    if (contextWords.length > 0) {
      const contextTerms = contextWords.map(word => `${word}[tiab]`).join(" OR ");
      terms.push(`(${contextTerms})`);
    }
  }

  // Combine all terms with AND (all conditions must be met)
  return terms.join(" AND ");
}

// Function to calculate relevance score based on multiple factors
function calculateRelevanceScore(article: Element, variantCase: z.infer<typeof VariantCaseSchema>): number {
  let score = 0;
  const title = article.getElementsByTagName("ArticleTitle").item(0)?.textContent?.toLowerCase() || "";
  const abstract = article.getElementsByTagName("Abstract").item(0)?.textContent?.toLowerCase() || "";
  const fullText = `${title} ${abstract}`;

  // Score based on gene mentions
  if (variantCase.genes) {
    const geneMatches = variantCase.genes.filter(gene => 
      fullText.includes(gene.toLowerCase())
    ).length;
    score += geneMatches * 0.3;
  }

  // Score based on phenotype mentions
  if (variantCase.phenotypes) {
    const phenotypeMatches = variantCase.phenotypes.filter(phenotype => 
      fullText.includes(phenotype.toLowerCase())
    ).length;
    score += phenotypeMatches * 0.25;
  }

  // Score based on mechanism mentions
  if (variantCase.mechanisms) {
    const mechanismMatches = variantCase.mechanisms.filter(mechanism => 
      fullText.includes(mechanism.toLowerCase())
    ).length;
    score += mechanismMatches * 0.2;
  }

  // Score based on drug mentions
  if (variantCase.drugs) {
    const drugMatches = variantCase.drugs.filter(drug => 
      fullText.includes(drug.toLowerCase())
    ).length;
    score += drugMatches * 0.15;
  }

  // Score based on recency (higher score for more recent papers)
  const yearElements = article.getElementsByTagName("PubDate");
  if (yearElements.length > 0) {
    const yearText = yearElements.item(0)?.getElementsByTagName("Year")?.item(0)?.textContent;
    if (yearText) {
      const year = parseInt(yearText);
      const currentYear = new Date().getFullYear();
      const recencyScore = Math.max(0, (year - 2000) / (currentYear - 2000)) * 0.1;
      score += recencyScore;
    }
  }

  return Math.min(score, 1.0); // Cap at 1.0
}

// Function to categorize the article
function categorizeArticle(article: Element): string {
  const title = article.getElementsByTagName("ArticleTitle").item(0)?.textContent?.toLowerCase() || "";
  const abstract = article.getElementsByTagName("Abstract").item(0)?.textContent?.toLowerCase() || "";
  const fullText = `${title} ${abstract}`;

  // Check for therapeutic terms
  const therapeuticTerms = ["treatment", "therapy", "drug", "medication", "therapeutic"];
  if (therapeuticTerms.some(term => fullText.includes(term))) {
    return "therapeutic";
  }

  // Check for mechanistic terms
  const mechanisticTerms = ["mechanism", "pathway", "signaling", "molecular", "biochemical"];
  if (mechanisticTerms.some(term => fullText.includes(term))) {
    return "mechanistic";
  }

  // Check for genetic terms
  const geneticTerms = ["gene", "variant", "mutation", "genomic", "genetic"];
  if (geneticTerms.some(term => fullText.includes(term))) {
    return "genetic";
  }

  // Check for phenotypic terms
  const phenotypicTerms = ["phenotype", "symptom", "clinical", "diagnosis"];
  if (phenotypicTerms.some(term => fullText.includes(term))) {
    return "phenotypic";
  }

  return "general";
}

// Function to generate justification for why an article is relevant
function generateJustification(article: Element, variantCase: z.infer<typeof VariantCaseSchema>, matchingTerms: string[]): string {
  const justifications: string[] = [];

  if (matchingTerms.length > 0) {
    justifications.push(`Matches key terms: ${matchingTerms.join(", ")}`);
  }

  // Add specific justifications based on variant case components
  if (variantCase.genes && variantCase.genes.length > 0) {
    const geneMatches = variantCase.genes.filter(gene => 
      matchingTerms.some(term => term.toLowerCase().includes(gene.toLowerCase()))
    );
    if (geneMatches.length > 0) {
      justifications.push(`Relevant to genes: ${geneMatches.join(", ")}`);
    }
  }

  if (variantCase.phenotypes && variantCase.phenotypes.length > 0) {
    const phenotypeMatches = variantCase.phenotypes.filter(phenotype => 
      matchingTerms.some(term => term.toLowerCase().includes(phenotype.toLowerCase()))
    );
    if (phenotypeMatches.length > 0) {
      justifications.push(`Addresses phenotypes: ${phenotypeMatches.join(", ")}`);
    }
  }

  // Add journal impact factor consideration (could be enhanced)
  const journalElements = article.getElementsByTagName("Journal");
  if (journalElements.length > 0) {
    const journal = journalElements.item(0)?.getElementsByTagName("Title")?.item(0)?.textContent;
    if (journal) {
      justifications.push(`Published in: ${journal}`);
    }
  }

  return justifications.join("; ");
}

// Function to identify matching terms
function identifyMatchingTerms(article: Element, variantCase: z.infer<typeof VariantCaseSchema>): string[] {
  const matchingTerms: string[] = [];
  const title = article.getElementsByTagName("ArticleTitle").item(0)?.textContent?.toLowerCase() || "";
  const abstract = article.getElementsByTagName("Abstract").item(0)?.textContent?.toLowerCase() || "";
  const fullText = `${title} ${abstract}`;

  // Check for gene matches
  if (variantCase.genes) {
    variantCase.genes.forEach(gene => {
      if (fullText.includes(gene.toLowerCase())) {
        matchingTerms.push(gene);
      }
    });
  }

  // Check for phenotype matches
  if (variantCase.phenotypes) {
    variantCase.phenotypes.forEach(phenotype => {
      if (fullText.includes(phenotype.toLowerCase())) {
        matchingTerms.push(phenotype);
      }
    });
  }

  // Check for mechanism matches
  if (variantCase.mechanisms) {
    variantCase.mechanisms.forEach(mechanism => {
      if (fullText.includes(mechanism.toLowerCase())) {
        matchingTerms.push(mechanism);
      }
    });
  }

  // Check for drug matches
  if (variantCase.drugs) {
    variantCase.drugs.forEach(drug => {
      if (fullText.includes(drug.toLowerCase())) {
        matchingTerms.push(drug);
      }
    });
  }

  return matchingTerms;
}

// Type for formatted search results
interface FormattedResult {
  pmid: string;
  title: string;
  authors: string[];
  journal: string;
  year: string;
  abstract: string;
  relevanceScore: number;
  justification: string;
  matchingTerms: string[];
  category: string;
}

// Function to format search results
function formatSearchResults(articles: Element[], variantCase: z.infer<typeof VariantCaseSchema>): FormattedResult[] {
  const results = articles.map(article => {
    const titleElements = article.getElementsByTagName("ArticleTitle");
    const title = titleElements.length > 0 ? titleElements.item(0)?.textContent || "No title" : "No title";
    
    const authorElements = article.getElementsByTagName("Author");
    const authors = Array.from({ length: authorElements.length }, (_, i) => {
      const author = authorElements.item(i);
      const lastNameElements = author?.getElementsByTagName("LastName");
      const initialsElements = author?.getElementsByTagName("Initials");
      const lastName = lastNameElements?.item(0)?.textContent || "";
      const initials = initialsElements?.item(0)?.textContent || "";
      return `${lastName} ${initials}`.trim();
    });

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

    const abstractElements = article.getElementsByTagName("Abstract");
    const abstract = abstractElements.length > 0 ? 
      abstractElements.item(0)?.textContent || "No abstract available" : 
      "No abstract available";

    const relevanceScore = calculateRelevanceScore(article, variantCase);
    const matchingTerms = identifyMatchingTerms(article, variantCase);
    const category = categorizeArticle(article);
    const justification = variantCase.includeJustification ? 
      generateJustification(article, variantCase, matchingTerms) : 
      "Justification not requested";

    return {
      pmid,
      title,
      authors,
      journal,
      year,
      abstract,
      relevanceScore,
      justification,
      matchingTerms,
      category
    };
  });

  // Sort by relevance score (descending)
  return results.sort((a, b) => b.relevanceScore - a.relevanceScore);
}

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "search_variant_literature",
        description: "Search literature for a variant case with sophisticated ranking and justification. " +
          "Provide genes, phenotypes, mechanisms, drugs (any subset), and a contextual query. " +
          "Returns ranked results with relevance scores and justifications.",
        inputSchema: {
          type: "object",
          properties: {
            genes: {
              type: "array",
              items: { type: "string" },
              description: "List of genes involved in the variant case"
            },
            phenotypes: {
              type: "array", 
              items: { type: "string" },
              description: "List of phenotypes or diseases associated with the case"
            },
            mechanisms: {
              type: "array",
              items: { type: "string" },
              description: "List of known or suspected mechanisms of action"
            },
            drugs: {
              type: "array",
              items: { type: "string" },
              description: "List of drugs or treatments being considered"
            },
            contextQuery: {
              type: "string",
              description: "Natural language query providing additional context about the case"
            },
            maxResults: {
              type: "number",
              minimum: 1,
              maximum: 50,
              default: 10,
              description: "Maximum number of results to return"
            },
            includeJustification: {
              type: "boolean",
              default: true,
              description: "Whether to include justification for each result"
            }
          },
          required: ["contextQuery"]
        }
      }
    ]
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === "search_variant_literature") {
    try {
      const variantCase = VariantCaseSchema.parse(args);
      
      // Build sophisticated search query
      const searchQuery = buildSearchQuery(variantCase);
      
      // Perform PubMed search
      const searchUrl = `${NCBI_API_BASE}/esearch.fcgi?db=pubmed&term=${encodeURIComponent(searchQuery)}&retmax=${variantCase.maxResults}&retmode=xml`;
      
      const searchDoc = await makeNCBIRequest(searchUrl);
      if (!searchDoc) {
        throw new Error("Failed to perform PubMed search");
      }

      // Extract PMIDs
      const pmidElements = searchDoc.getElementsByTagName("Id");
      const pmids = Array.from({ length: pmidElements.length }, (_, i) => 
        pmidElements.item(i)?.textContent || ""
      ).filter(pmid => pmid !== "");

      if (pmids.length === 0) {
        return {
          content: [{
            type: "text",
            text: "No articles found for the given variant case criteria."
          }]
        };
      }

      // Fetch article details
      const fetchUrl = `${NCBI_API_BASE}/efetch.fcgi?db=pubmed&id=${pmids.join(",")}&retmode=xml`;
      const fetchDoc = await makeNCBIRequest(fetchUrl);
      
      if (!fetchDoc) {
        throw new Error("Failed to fetch article details");
      }

      // Extract and format results
      const articleElements = fetchDoc.getElementsByTagName("PubmedArticle");
      const articles = Array.from({ length: articleElements.length }, (_, i) => 
        articleElements.item(i)!
      );

      const formattedResults = formatSearchResults(articles, variantCase);
      
      // Create bibliography artifact for proper display
      const bibliographyData = formattedResults.map(result => ({
        pmid: result.pmid,
        title: result.title,
        authors: result.authors,
        journal: result.journal,
        year: result.year,
        abstract: result.abstract,
        relevanceScore: result.relevanceScore,
        justification: result.justification,
        matchingTerms: result.matchingTerms,
        category: result.category,
        doi: result.pmid ? `https://pubmed.ncbi.nlm.nih.gov/${result.pmid}` : undefined,
        url: result.pmid ? `https://pubmed.ncbi.nlm.nih.gov/${result.pmid}` : undefined
      }));
      
      return {
        content: [{
          type: "text",
          text: `# Variant Literature Search Results

**Query**: ${searchQuery}
**Total Results**: ${formattedResults.length}

Found ${formattedResults.length} relevant articles for your variant case. The results are ranked by relevance score (0-1) based on:
- Gene matches (30% weight)
- Phenotype matches (25% weight)
- Mechanism matches (20% weight)
- Drug matches (15% weight)
- Recency bonus (10% weight)

Each result includes:
- **Relevance Score**: Composite score indicating how well the article matches your case
- **Justification**: Explanation of why this article is relevant
- **Category**: Automatic classification (genetic, phenotypic, therapeutic, mechanistic, general)
- **Matching Terms**: Which input terms were found in the article

Click the bibliography link below to view the detailed results.`
        }],
        artifacts: [{
          type: "application/vnd.bibliography",
          title: "Variant Literature Search Results",
          content: bibliographyData
        }]
      };

    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error in variant literature search: ${error instanceof Error ? error.message : String(error)}`
        }]
      };
    }
  }

  throw new Error(`Unknown tool: ${name}`);
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Variant Literature Search MCP server running on stdio");
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});