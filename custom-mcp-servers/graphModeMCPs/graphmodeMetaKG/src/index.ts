import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

// =============================================================================
// CONFIGURATION SECTION
// =============================================================================
const TOOL_NAME = "graphmode-metakg";
const SERVICE_NAME = "metakg-mcp";
const DEFAULT_API_BASE_URL = process.env.API_BASE_URL || "http://localhost:3001";
const SMARTAPI_METAKG_URL = "https://smart-api.info/api/metakg";
const BTE_API_URL = "https://bte.transltr.io/v1";

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================
interface MetaKGHit {
  subject: string;
  predicate: string;
  object: string;
  api: {
    name: string;
    infores: string;
    x_maturity: string;
  };
  source: string;
  tags: string[];
}

interface MetaKGResponse {
  hits: MetaKGHit[];
  total: number;
  max_score: number;
}

interface DatabaseContext {
  conversationId: string;
  artifactId?: string;
  apiBaseUrl?: string;
  accessToken?: string;
}

// =============================================================================
// SCHEMA DEFINITIONS
// =============================================================================
const DatabaseContextSchema = z.object({
  conversationId: z.string().min(1, "conversationId is required"),
  artifactId: z.string().optional(),
  apiBaseUrl: z.string().url().optional(),
  accessToken: z.string().optional(),
});

const GetEntityRelationshipsArgumentsSchema = z.object({
  entityId: z.string().min(1, "Entity ID is required"),
  entityCategory: z.string().optional().default("Gene"),
  targetCategories: z.array(z.string()).optional(),
  includePredicates: z.boolean().optional().default(true),
  databaseContext: DatabaseContextSchema,
});

const GetPredicatesByCategoryArgumentsSchema = z.object({
  subjectCategory: z.string().optional().default("Gene"),
  objectCategory: z.string().optional(),
  size: z.number().optional().default(1000),
  databaseContext: DatabaseContextSchema,
});

const GetCategoriesByPredicateArgumentsSchema = z.object({
  predicate: z.string().min(1, "Predicate is required"),
  subjectCategory: z.string().optional().default("Gene"),
  size: z.number().optional().default(1000),
  databaseContext: DatabaseContextSchema,
});

const AnalyzeKnowledgeGraphArgumentsSchema = z.object({
  entityId: z.string().min(1, "Entity ID is required"),
  entityCategory: z.string().optional().default("Gene"),
  databaseContext: DatabaseContextSchema,
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
// HELPER FUNCTIONS
// =============================================================================

/**
 * Make API request to GraphMode backend database
 */
async function makeAPIRequest(
  endpoint: string,
  context: DatabaseContext,
  options: RequestInit = {}
): Promise<any> {
  try {
    const baseUrl = context.apiBaseUrl || DEFAULT_API_BASE_URL;
    const url = `${baseUrl}/api/graph/${context.conversationId}${endpoint}`;

    console.error(`[${SERVICE_NAME}] Making request to: ${url}`);
    console.error(`[${SERVICE_NAME}] Method: ${options.method || 'GET'}`);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': TOOL_NAME,
    };

    if (context.accessToken) {
      headers['Authorization'] = `Bearer ${context.accessToken}`;
    }

    const response = await fetch(url, { ...options, headers });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`[${SERVICE_NAME}] API request failed:`, error);
    throw error;
  }
}

/**
 * Query SmartAPI MetaKG for relationship information
 */
async function queryMetaKG(params: {
  subject?: string;
  object?: string;
  predicate?: string;
  size?: number;
}): Promise<MetaKGResponse> {
  const searchParams = new URLSearchParams();
  
  // Convert Biolink format to MetaKG format
  if (params.subject) searchParams.set('subject', convertToMetaKGFormat(params.subject));
  if (params.object) searchParams.set('object', convertToMetaKGFormat(params.object));
  if (params.predicate) searchParams.set('predicate', convertToMetaKGFormat(params.predicate));
  if (params.size) searchParams.set('size', params.size.toString());

  const url = `${SMARTAPI_METAKG_URL}?${searchParams.toString()}`;
  
  console.error(`[${SERVICE_NAME}] Querying MetaKG: ${url}`);

  const response = await fetch(url, {
    headers: {
      'Accept': 'application/json',
      'User-Agent': TOOL_NAME,
    }
  });

  if (!response.ok) {
    throw new Error(`MetaKG API error (${response.status}): ${await response.text()}`);
  }

  return await response.json();
}

/**
 * Normalize category to Biolink format
 */
function normalizeCategoryToBiolink(category: string): string {
  if (category.startsWith('biolink:')) {
    return category;
  }
  
  const capitalized = category.charAt(0).toUpperCase() + category.slice(1).toLowerCase();
  return `biolink:${capitalized}`;
}

/**
 * Convert Biolink category to SmartAPI MetaKG format
 */
function convertToMetaKGFormat(category: string): string {
  if (category.startsWith('biolink:')) {
    return category.replace('biolink:', '');
  }
  return category;
}

/**
 * Extract category name from biolink format
 */
function extractCategoryName(category: string): string {
  return category.replace('biolink:', '');
}

/**
 * Analyze predicate frequency from MetaKG hits
 */
function analyzePredicateFrequency(hits: MetaKGHit[]): Array<{ predicate: string; count: number; apis: string[] }> {
  const predicateMap = new Map<string, { count: number; apis: Set<string> }>();
  
  hits.forEach(hit => {
    const predicate = hit.predicate;
    if (!predicateMap.has(predicate)) {
      predicateMap.set(predicate, { count: 0, apis: new Set() });
    }
    
    const entry = predicateMap.get(predicate)!;
    entry.count++;
    entry.apis.add(hit.api.name);
  });
  
  return Array.from(predicateMap.entries())
    .map(([predicate, data]) => ({
      predicate,
      count: data.count,
      apis: Array.from(data.apis)
    }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Analyze category frequency from MetaKG hits
 */
function analyzeCategoryFrequency(hits: MetaKGHit[], type: 'subject' | 'object'): Array<{ category: string; count: number; apis: string[] }> {
  const categoryMap = new Map<string, { count: number; apis: Set<string> }>();
  
  hits.forEach(hit => {
    const category = type === 'subject' ? hit.subject : hit.object;
    if (!categoryMap.has(category)) {
      categoryMap.set(category, { count: 0, apis: new Set() });
    }
    
    const entry = categoryMap.get(category)!;
    entry.count++;
    entry.apis.add(hit.api.name);
  });
  
  return Array.from(categoryMap.entries())
    .map(([category, data]) => ({
      category,
      count: data.count,
      apis: Array.from(data.apis)
    }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Analyze category-predicate combinations
 */
function analyzeCategoryPredicateCombinations(hits: MetaKGHit[]): Array<{ category: string; predicate: string; count: number; apis: string[] }> {
  const combinationMap = new Map<string, { count: number; apis: Set<string> }>();
  
  hits.forEach(hit => {
    const key = `${hit.object}|${hit.predicate}`;
    if (!combinationMap.has(key)) {
      combinationMap.set(key, { count: 0, apis: new Set() });
    }
    
    const entry = combinationMap.get(key)!;
    entry.count++;
    entry.apis.add(hit.api.name);
  });
  
  return Array.from(combinationMap.entries())
    .map(([key, data]) => {
      const [category, predicate] = key.split('|');
      return {
        category,
        predicate,
        count: data.count,
        apis: Array.from(data.apis)
      };
    })
    .sort((a, b) => b.count - a.count);
}

/**
 * Generate comprehensive analysis of knowledge graph relationships
 */
function generateRelationshipAnalysis(
  entityId: string,
  entityCategory: string,
  predicateAnalysis: Array<{ predicate: string; count: number; apis: string[] }>,
  categoryAnalysis: Array<{ category: string; count: number; apis: string[] }>,
  combinationAnalysis: Array<{ category: string; predicate: string; count: number; apis: string[] }>
): string {
  const insights: string[] = [];
  
  // Most common predicates
  if (predicateAnalysis.length > 0) {
    const topPredicate = predicateAnalysis[0];
    insights.push(`Most common relationship: **${extractCategoryName(topPredicate.predicate)}** (${topPredicate.count} APIs)`);
  }
  
  // Most connected categories
  if (categoryAnalysis.length > 0) {
    const topCategory = categoryAnalysis[0];
    insights.push(`Most connected category: **${extractCategoryName(topCategory.category)}** (${topCategory.count} APIs)`);
  }
  
  // Diversity analysis
  const uniquePredicates = predicateAnalysis.length;
  const uniqueCategories = categoryAnalysis.length;
  
  if (uniquePredicates > 20) {
    insights.push(`High relationship diversity: ${uniquePredicates} different relationship types available`);
  }
  
  if (uniqueCategories > 15) {
    insights.push(`High category diversity: ${uniqueCategories} different target categories available`);
  }
  
  // Clinical relevance
  const hasDiseaseConnections = categoryAnalysis.some(item => 
    item.category.includes('Disease') || item.category.includes('Phenotypic')
  );
  if (hasDiseaseConnections) {
    insights.push(`Clinical relevance: Disease associations available`);
  }
  
  // Therapeutic potential
  const hasDrugConnections = categoryAnalysis.some(item => 
    item.category.includes('Drug') || item.category.includes('SmallMolecule') || item.category.includes('Chemical')
  );
  if (hasDrugConnections) {
    insights.push(`Therapeutic potential: Drug/chemical associations available`);
  }
  
  // Functional analysis
  const hasFunctionalConnections = categoryAnalysis.some(item => 
    item.category.includes('MolecularActivity') || item.category.includes('BiologicalProcess')
  );
  if (hasFunctionalConnections) {
    insights.push(`Functional analysis: Molecular activity and biological process data available`);
  }
  
  return insights.join('\n');
}

// =============================================================================
// TOOL DEFINITIONS
// =============================================================================
server.setRequestHandler(ListToolsRequestSchema, async () => {
  const tools = [
    {
      name: "get_entity_relationships",
      description: "Get all possible relationship types and target categories for any entity type using SmartAPI MetaKG. " +
        "This tool answers questions like 'How are [Entity] nodes connected in this knowledge graph?' by analyzing " +
        "the available predicates and target categories from the SmartAPI registry.\n\n" +
        
        "**What This Tool Does:**\n" +
        "- Analyzes all available relationships for a given entity type\n" +
        "- Shows which categories the entity can connect to\n" +
        "- Lists all possible predicates (relationship types)\n" +
        "- Provides API sources for each relationship\n" +
        "- Generates insights about relationship patterns\n\n" +
        
        "**Use Cases:**\n" +
        "- 'What types of relationships are allowed for a [entity type]?'\n" +
        "- 'How can I connect [entities] to other entities?'\n" +
        "- 'What predicates are available for [entity type] queries?'\n" +
        "- 'Which APIs support [entity type]-[target type] relationships?'\n" +
        "- 'What categories can [entity type] connect to?'\n\n" +
        
        "**Output Format:**\n" +
        "- Predicate analysis (most common relationship types)\n" +
        "- Category analysis (target entity types)\n" +
        "- Category-predicate combinations\n" +
        "- API source information\n" +
        "- Relationship insights and patterns\n\n" +
        
        "**Example Queries This Tool Answers:**\n" +
        "- 'How are Gene nodes connected in this knowledge graph?'\n" +
        "- 'How are Protein nodes connected in this knowledge graph?'\n" +
        "- 'What relationships are available for BRCA1?'\n" +
        "- 'What relationships are available for P38398?'\n" +
        "- 'What can I connect to a gene entity?'\n" +
        "- 'What can I connect to a protein entity?'\n" +
        "- 'What predicates work with genes?'\n" +
        "- 'What predicates work with diseases?'\n\n" +
        
        "**IMPORTANT - Category Format:**\n" +
        "The SmartAPI MetaKG API uses specific capitalization. Use these exact formats:\n\n" +
        "✅ **Working Categories:**\n" +
        "- Gene\n" +
        "- Protein\n" +
        "- SmallMolecule\n" +
        "- DiseaseOrPhenotypicFeature\n" +
        "- AnatomicalEntity\n" +
        "- RNAProduct\n" +
        "- ChemicalMixture\n" +
        "- Polypeptide\n" +
        "- GeneFamily\n" +
        "- ProteinFamily\n" +
        "- BiologicalProcessOrActivity\n" +
        "- Drug\n\n" +
        "❌ **Don't use:** biolink:Gene, biolink:Protein, etc. (the tool converts these automatically)",
      inputSchema: {
        type: "object",
        properties: {
          entityId: {
            type: "string",
            description: "The CURIE identifier of the entity to analyze (e.g., 'NCBIGene:4353', 'UniProtKB:P38398')"
          },
          entityCategory: {
            type: "string",
            description: "The entity category (e.g., 'Gene', 'Protein', 'Disease', 'Drug'). Use exact capitalization: Gene, Protein, SmallMolecule, DiseaseOrPhenotypicFeature, AnatomicalEntity, RNAProduct, ChemicalMixture, Polypeptide, GeneFamily, ProteinFamily, BiologicalProcessOrActivity, Drug",
            default: "Gene"
          },
          targetCategories: {
            type: "array",
            items: { type: "string" },
            description: "Optional: Specific target categories to analyze (e.g., ['biolink:Disease', 'biolink:Protein'])"
          },
          includePredicates: {
            type: "boolean",
            description: "Whether to include detailed predicate analysis",
            default: true
          },
          databaseContext: {
            type: "object",
            properties: {
              conversationId: { type: "string" },
              artifactId: { type: "string" },
              apiBaseUrl: { type: "string" },
              accessToken: { type: "string" }
            },
            required: ["conversationId"]
          }
        },
        required: ["entityId", "databaseContext"]
      }
    },
    {
      name: "get_predicates_by_category",
      description: "Get all available predicates for relationships between specific entity categories using SmartAPI MetaKG. " +
        "This tool helps understand what relationship types are possible between different entity types.\n\n" +
        
        "**What This Tool Does:**\n" +
        "- Finds all predicates available between two entity categories\n" +
        "- Shows which APIs support each predicate\n" +
        "- Provides frequency analysis of predicate usage\n" +
        "- Helps understand relationship patterns\n\n" +
        
        "**Use Cases:**\n" +
        "- 'What predicates connect genes to diseases?'\n" +
        "- 'How do proteins interact with drugs?'\n" +
        "- 'What relationships exist between genes and pathways?'\n" +
        "- 'Which predicates work for gene-protein relationships?'\n\n" +
        
        "**Example Queries:**\n" +
        "- Gene → Disease: Shows predicates like 'associated_with', 'causes', 'treats'\n" +
        "- Protein → Drug: Shows predicates like 'affects', 'targets', 'interacts_with'\n" +
        "- Gene → Pathway: Shows predicates like 'participates_in', 'involved_in'\n\n" +
        
        "**IMPORTANT - Category Format:**\n" +
        "Use these exact capitalization formats for categories:\n" +
        "✅ Gene, Protein, SmallMolecule, DiseaseOrPhenotypicFeature, AnatomicalEntity, RNAProduct, ChemicalMixture, Polypeptide, GeneFamily, ProteinFamily, BiologicalProcessOrActivity, Drug\n" +
        "❌ Don't use: biolink:Gene, biolink:Protein, etc. (the tool converts these automatically)",
      inputSchema: {
        type: "object",
        properties: {
          subjectCategory: {
            type: "string",
            description: "The source entity category (e.g., 'Gene', 'Protein', 'Disease', 'Drug'). Use exact capitalization: Gene, Protein, SmallMolecule, DiseaseOrPhenotypicFeature, AnatomicalEntity, RNAProduct, ChemicalMixture, Polypeptide, GeneFamily, ProteinFamily, BiologicalProcessOrActivity, Drug",
            default: "Gene"
          },
          objectCategory: {
            type: "string",
            description: "The target entity category (e.g., 'Disease', 'Protein', 'SmallMolecule', 'Drug'). Use exact capitalization: Gene, Protein, SmallMolecule, DiseaseOrPhenotypicFeature, AnatomicalEntity, RNAProduct, ChemicalMixture, Polypeptide, GeneFamily, ProteinFamily, BiologicalProcessOrActivity, Drug"
          },
          size: {
            type: "number",
            description: "Maximum number of results to return",
            default: 1000
          },
          databaseContext: {
            type: "object",
            properties: {
              conversationId: { type: "string" },
              artifactId: { type: "string" },
              apiBaseUrl: { type: "string" },
              accessToken: { type: "string" }
            },
            required: ["conversationId"]
          }
        },
        required: ["databaseContext"]
      }
    },
    {
      name: "get_categories_by_predicate",
      description: "Get all target categories that can be connected via a specific predicate using SmartAPI MetaKG. " +
        "This tool helps understand what entity types can be connected through specific relationship types.\n\n" +
        
        "**What This Tool Does:**\n" +
        "- Finds all target categories for a specific predicate\n" +
        "- Shows which APIs support each category-predicate combination\n" +
        "- Provides frequency analysis of category usage\n" +
        "- Helps understand predicate scope\n\n" +
        
        "**Use Cases:**\n" +
        "- 'What can be associated_with a gene?'\n" +
        "- 'Which categories can be treated by drugs?'\n" +
        "- 'What can participate_in a pathway?'\n" +
        "- 'Which entities can be regulated by genes?'\n\n" +
        
        "**Example Queries:**\n" +
        "- Predicate 'associated_with': Shows diseases, phenotypes, pathways\n" +
        "- Predicate 'treats': Shows diseases, conditions, symptoms\n" +
        "- Predicate 'participates_in': Shows pathways, processes, activities\n\n" +
        
        "**IMPORTANT - Category Format:**\n" +
        "Use these exact capitalization formats for categories:\n" +
        "✅ Gene, Protein, SmallMolecule, DiseaseOrPhenotypicFeature, AnatomicalEntity, RNAProduct, ChemicalMixture, Polypeptide, GeneFamily, ProteinFamily, BiologicalProcessOrActivity, Drug\n" +
        "❌ Don't use: biolink:Gene, biolink:Protein, etc. (the tool converts these automatically)",
      inputSchema: {
        type: "object",
        properties: {
          predicate: {
            type: "string",
            description: "The predicate to analyze (e.g., 'associated_with', 'treats', 'affects', 'interacts_with')"
          },
          subjectCategory: {
            type: "string",
            description: "The source entity category (e.g., 'Gene', 'Drug', 'Protein', 'Disease'). Use exact capitalization: Gene, Protein, SmallMolecule, DiseaseOrPhenotypicFeature, AnatomicalEntity, RNAProduct, ChemicalMixture, Polypeptide, GeneFamily, ProteinFamily, BiologicalProcessOrActivity, Drug",
            default: "Gene"
          },
          size: {
            type: "number",
            description: "Maximum number of results to return",
            default: 1000
          },
          databaseContext: {
            type: "object",
            properties: {
              conversationId: { type: "string" },
              artifactId: { type: "string" },
              apiBaseUrl: { type: "string" },
              accessToken: { type: "string" }
            },
            required: ["conversationId"]
          }
        },
        required: ["predicate", "databaseContext"]
      }
    },
    {
      name: "analyze_knowledge_graph",
      description: "Perform comprehensive analysis of knowledge graph relationships for an entity using SmartAPI MetaKG. " +
        "This tool provides a complete overview of how an entity can be connected in the knowledge graph.\n\n" +
        
        "**What This Tool Does:**\n" +
        "- Analyzes all possible relationships for an entity\n" +
        "- Provides comprehensive predicate and category analysis\n" +
        "- Generates insights about relationship patterns\n" +
        "- Shows API coverage and diversity\n" +
        "- Creates a complete relationship profile\n\n" +
        
        "**Use Cases:**\n" +
        "- 'How are Gene nodes connected in this knowledge graph?'\n" +
        "- 'What's the complete relationship profile for BRCA1?'\n" +
        "- 'What can I discover about this entity?'\n" +
        "- 'What are all the ways to connect this entity?'\n\n" +
        
        "**Output Includes:**\n" +
        "- Predicate frequency analysis\n" +
        "- Target category analysis\n" +
        "- Category-predicate combinations\n" +
        "- API source information\n" +
        "- Relationship insights and patterns\n" +
        "- Clinical and therapeutic relevance\n" +
        "- Functional analysis capabilities\n\n" +
        
        "**IMPORTANT - Category Format:**\n" +
        "Use these exact capitalization formats for categories:\n" +
        "✅ Gene, Protein, SmallMolecule, DiseaseOrPhenotypicFeature, AnatomicalEntity, RNAProduct, ChemicalMixture, Polypeptide, GeneFamily, ProteinFamily, BiologicalProcessOrActivity, Drug\n" +
        "❌ Don't use: biolink:Gene, biolink:Protein, etc. (the tool converts these automatically)",
      inputSchema: {
        type: "object",
        properties: {
          entityId: {
            type: "string",
            description: "The CURIE identifier of the entity to analyze (e.g., 'NCBIGene:4353', 'UniProtKB:P38398')"
          },
          entityCategory: {
            type: "string",
            description: "The entity category (e.g., 'Gene', 'Protein', 'Disease', 'Drug'). Use exact capitalization: Gene, Protein, SmallMolecule, DiseaseOrPhenotypicFeature, AnatomicalEntity, RNAProduct, ChemicalMixture, Polypeptide, GeneFamily, ProteinFamily, BiologicalProcessOrActivity, Drug",
            default: "Gene"
          },
          databaseContext: {
            type: "object",
            properties: {
              conversationId: { type: "string" },
              artifactId: { type: "string" },
              apiBaseUrl: { type: "string" },
              accessToken: { type: "string" }
            },
            required: ["conversationId"]
          }
        },
        required: ["entityId", "databaseContext"]
      }
    }
  ];

  return { tools };
});

// =============================================================================
// TOOL HANDLERS
// =============================================================================
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    if (name === "get_entity_relationships") {
      const params = GetEntityRelationshipsArgumentsSchema.parse(args);
      const entityCategory = normalizeCategoryToBiolink(params.entityCategory);
      
      console.error(`[${SERVICE_NAME}] Analyzing relationships for ${params.entityId} (${entityCategory})`);
      
      try {
        // Query MetaKG for all relationships involving this entity category
        const metaKGResponse = await queryMetaKG({
          subject: entityCategory,
          size: 1000
        });
        
        const hits = metaKGResponse.hits;
        console.error(`[${SERVICE_NAME}] Found ${hits.length} relationship definitions`);
        
        // Analyze predicates
        const predicateAnalysis = analyzePredicateFrequency(hits);
        
        // Analyze target categories
        const categoryAnalysis = analyzeCategoryFrequency(hits, 'object');
        
        // Analyze combinations
        const combinationAnalysis = analyzeCategoryPredicateCombinations(hits);
        
        // Generate insights
        const insights = generateRelationshipAnalysis(
          params.entityId,
          entityCategory,
          predicateAnalysis,
          categoryAnalysis,
          combinationAnalysis
        );
        
        return {
          content: [{
            type: "text",
            text: `✅ Gene Relationship Analysis Complete!

**Entity:** ${params.entityId} (${extractCategoryName(entityCategory)})
**Total Relationship Definitions:** ${hits.length}
**Unique Predicates:** ${predicateAnalysis.length}
**Target Categories:** ${categoryAnalysis.length}

## 🔗 Available Predicates (Relationship Types)
${predicateAnalysis.slice(0, 15).map(item => 
  `- **${extractCategoryName(item.predicate)}**: ${item.count} APIs (${item.apis.slice(0, 3).join(', ')}${item.apis.length > 3 ? '...' : ''})`
).join('\n')}

## 🎯 Target Categories (What Genes Can Connect To)
${categoryAnalysis.slice(0, 15).map(item => 
  `- **${extractCategoryName(item.category)}**: ${item.count} APIs (${item.apis.slice(0, 3).join(', ')}${item.apis.length > 3 ? '...' : ''})`
).join('\n')}

## 📊 Top Category-Predicate Combinations
${combinationAnalysis.slice(0, 10).map(item => 
  `- **${extractCategoryName(item.category)}** via **${extractCategoryName(item.predicate)}**: ${item.count} APIs`
).join('\n')}

## 🎯 Key Insights
${insights}

**Source:** SmartAPI MetaKG Registry
**Endpoint:** ${SMARTAPI_METAKG_URL}

This analysis shows all the ways ${extractCategoryName(entityCategory)} entities can be connected in the knowledge graph, based on available APIs in the SmartAPI registry.`
          }]
        };
        
      } catch (error) {
        console.error(`[${SERVICE_NAME}] Gene relationship analysis failed:`, error);
        return {
          content: [{
            type: "text",
            text: `❌ Gene Relationship Analysis Failed

**Error:** ${error instanceof Error ? error.message : 'Unknown error'}

**Troubleshooting:**
- SmartAPI MetaKG may be temporarily unavailable
- Network connectivity issues
- Invalid entity category

**Suggestions:**
- Try again in a few minutes
- Check network connection
- Verify entity category is valid

**Source:** SmartAPI MetaKG Registry`
          }]
        };
      }
    }

    if (name === "get_predicates_by_category") {
      const params = GetPredicatesByCategoryArgumentsSchema.parse(args);
      const subjectCategory = normalizeCategoryToBiolink(params.subjectCategory);
      const objectCategory = params.objectCategory ? normalizeCategoryToBiolink(params.objectCategory) : undefined;
      
      console.error(`[${SERVICE_NAME}] Analyzing predicates for ${subjectCategory} → ${objectCategory || 'any'}`);
      
      try {
        // Query MetaKG for predicates between categories
        const metaKGResponse = await queryMetaKG({
          subject: subjectCategory,
          object: objectCategory,
          size: params.size
        });
        
        const hits = metaKGResponse.hits;
        console.error(`[${SERVICE_NAME}] Found ${hits.length} predicate definitions`);
        
        // Analyze predicates
        const predicateAnalysis = analyzePredicateFrequency(hits);
        
        return {
          content: [{
            type: "text",
            text: `✅ Predicate Analysis Complete!

**Source Category:** ${extractCategoryName(subjectCategory)}
**Target Category:** ${objectCategory ? extractCategoryName(objectCategory) : 'Any'}
**Total Predicate Definitions:** ${hits.length}
**Unique Predicates:** ${predicateAnalysis.length}

## 🔗 Available Predicates
${predicateAnalysis.map(item => 
  `- **${extractCategoryName(item.predicate)}**: ${item.count} APIs
  - APIs: ${item.apis.join(', ')}`
).join('\n\n')}

**Source:** SmartAPI MetaKG Registry
**Endpoint:** ${SMARTAPI_METAKG_URL}

This shows all the relationship types (predicates) available between ${extractCategoryName(subjectCategory)} and ${objectCategory ? extractCategoryName(objectCategory) : 'any target category'}.`
          }]
        };
        
      } catch (error) {
        console.error(`[${SERVICE_NAME}] Predicate analysis failed:`, error);
        return {
          content: [{
            type: "text",
            text: `❌ Predicate Analysis Failed

**Error:** ${error instanceof Error ? error.message : 'Unknown error'}

**Troubleshooting:**
- SmartAPI MetaKG may be temporarily unavailable
- Network connectivity issues
- Invalid category names

**Suggestions:**
- Try again in a few minutes
- Check network connection
- Verify category names are valid

**Source:** SmartAPI MetaKG Registry`
          }]
        };
      }
    }

    if (name === "get_categories_by_predicate") {
      const params = GetCategoriesByPredicateArgumentsSchema.parse(args);
      const subjectCategory = normalizeCategoryToBiolink(params.subjectCategory);
      const predicate = normalizeCategoryToBiolink(params.predicate);
      
      console.error(`[${SERVICE_NAME}] Analyzing categories for ${subjectCategory} via ${predicate}`);
      
      try {
        // Query MetaKG for categories connected via predicate
        const metaKGResponse = await queryMetaKG({
          subject: subjectCategory,
          predicate: predicate,
          size: params.size
        });
        
        const hits = metaKGResponse.hits;
        console.error(`[${SERVICE_NAME}] Found ${hits.length} category definitions`);
        
        // Analyze target categories
        const categoryAnalysis = analyzeCategoryFrequency(hits, 'object');
        
        return {
          content: [{
            type: "text",
            text: `✅ Category Analysis Complete!

**Source Category:** ${extractCategoryName(subjectCategory)}
**Predicate:** ${extractCategoryName(predicate)}
**Total Category Definitions:** ${hits.length}
**Unique Target Categories:** ${categoryAnalysis.length}

## 🎯 Target Categories
${categoryAnalysis.map(item => 
  `- **${extractCategoryName(item.category)}**: ${item.count} APIs
  - APIs: ${item.apis.join(', ')}`
).join('\n\n')}

**Source:** SmartAPI MetaKG Registry
**Endpoint:** ${SMARTAPI_METAKG_URL}

This shows all the target categories that can be connected to ${extractCategoryName(subjectCategory)} via the ${extractCategoryName(predicate)} relationship.`
          }]
        };
        
      } catch (error) {
        console.error(`[${SERVICE_NAME}] Category analysis failed:`, error);
        return {
          content: [{
            type: "text",
            text: `❌ Category Analysis Failed

**Error:** ${error instanceof Error ? error.message : 'Unknown error'}

**Troubleshooting:**
- SmartAPI MetaKG may be temporarily unavailable
- Network connectivity issues
- Invalid predicate or category names

**Suggestions:**
- Try again in a few minutes
- Check network connection
- Verify predicate and category names are valid

**Source:** SmartAPI MetaKG Registry`
          }]
        };
      }
    }

    if (name === "analyze_knowledge_graph") {
      const params = AnalyzeKnowledgeGraphArgumentsSchema.parse(args);
      const entityCategory = normalizeCategoryToBiolink(params.entityCategory);
      
      console.error(`[${SERVICE_NAME}] Performing comprehensive analysis for ${params.entityId} (${entityCategory})`);
      
      try {
        // Query MetaKG for comprehensive analysis
        const metaKGResponse = await queryMetaKG({
          subject: entityCategory,
          size: 1000
        });
        
        const hits = metaKGResponse.hits;
        console.error(`[${SERVICE_NAME}] Found ${hits.length} relationship definitions`);
        
        // Comprehensive analysis
        const predicateAnalysis = analyzePredicateFrequency(hits);
        const categoryAnalysis = analyzeCategoryFrequency(hits, 'object');
        const combinationAnalysis = analyzeCategoryPredicateCombinations(hits);
        
        // Generate insights
        const insights = generateRelationshipAnalysis(
          params.entityId,
          entityCategory,
          predicateAnalysis,
          categoryAnalysis,
          combinationAnalysis
        );
        
        // API diversity analysis
        const uniqueAPIs = new Set(hits.map(hit => hit.api.name));
        const apiCount = uniqueAPIs.size;
        
        return {
          content: [{
            type: "text",
            text: `✅ Comprehensive Knowledge Graph Analysis Complete!

**Entity:** ${params.entityId} (${extractCategoryName(entityCategory)})
**Total Relationship Definitions:** ${hits.length}
**Unique Predicates:** ${predicateAnalysis.length}
**Target Categories:** ${categoryAnalysis.length}
**API Sources:** ${apiCount}

## 🔗 Predicate Analysis (Relationship Types)
${predicateAnalysis.slice(0, 20).map(item => 
  `- **${extractCategoryName(item.predicate)}**: ${item.count} APIs
  - Sources: ${item.apis.slice(0, 5).join(', ')}${item.apis.length > 5 ? ` (+${item.apis.length - 5} more)` : ''}`
).join('\n\n')}

## 🎯 Category Analysis (Target Types)
${categoryAnalysis.slice(0, 20).map(item => 
  `- **${extractCategoryName(item.category)}**: ${item.count} APIs
  - Sources: ${item.apis.slice(0, 5).join(', ')}${item.apis.length > 5 ? ` (+${item.apis.length - 5} more)` : ''}`
).join('\n\n')}

## 📊 Top Category-Predicate Combinations
${combinationAnalysis.slice(0, 15).map(item => 
  `- **${extractCategoryName(item.category)}** via **${extractCategoryName(item.predicate)}**: ${item.count} APIs
  - Sources: ${item.apis.slice(0, 3).join(', ')}${item.apis.length > 3 ? ` (+${item.apis.length - 3} more)` : ''}`
).join('\n\n')}

## 🎯 Key Insights
${insights}

## 📈 API Coverage
- **Total APIs:** ${apiCount}
- **Most Common APIs:** ${Array.from(uniqueAPIs).slice(0, 10).join(', ')}
- **Coverage:** ${hits.length} relationship definitions across ${apiCount} different APIs

**Source:** SmartAPI MetaKG Registry
**Endpoint:** ${SMARTAPI_METAKG_URL}

This comprehensive analysis shows all the ways ${extractCategoryName(entityCategory)} entities can be connected in the knowledge graph, providing a complete relationship profile based on available APIs in the SmartAPI registry.`
          }]
        };
        
      } catch (error) {
        console.error(`[${SERVICE_NAME}] Comprehensive analysis failed:`, error);
        return {
          content: [{
            type: "text",
            text: `❌ Comprehensive Analysis Failed

**Error:** ${error instanceof Error ? error.message : 'Unknown error'}

**Troubleshooting:**
- SmartAPI MetaKG may be temporarily unavailable
- Network connectivity issues
- Invalid entity category

**Suggestions:**
- Try again in a few minutes
- Check network connection
- Verify entity category is valid

**Source:** SmartAPI MetaKG Registry`
          }]
        };
      }
    }

    throw new Error(`Unknown tool: ${name}`);

  } catch (error) {
    console.error(`[${SERVICE_NAME}] Tool execution failed:`, error);

    if (error instanceof z.ZodError) {
      return {
        content: [{
          type: "text",
          text: `❌ Invalid input parameters:\n${error.errors.map(e => `- ${e.path.join('.')}: ${e.message}`).join('\n')}`
        }]
      };
    }

    return {
      content: [{
        type: "text",
        text: `❌ MetaKG Analysis Failed:\n${error instanceof Error ? error.message : 'Unknown error'}\n\n**Troubleshooting:**\n- Check network connection\n- Verify input parameters\n- Try again in a few minutes`
      }],
      isError: true
    };
  }
});

// =============================================================================
// SERVER STARTUP
// =============================================================================
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`[${SERVICE_NAME}] MetaKG GraphMode MCP Server running on stdio`);
}

main().catch(console.error);
