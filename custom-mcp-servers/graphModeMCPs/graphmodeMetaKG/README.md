# GraphMode MetaKG MCP Server

A Model Context Protocol (MCP) server that provides tools for analyzing knowledge graph relationships using the SmartAPI MetaKG registry. This server answers questions like "How are Gene nodes connected in this knowledge graph?" by analyzing available predicates and target categories.

## 🎯 Purpose

This MCP server is designed to help users understand:
- What types of relationships are possible between entities
- Which categories entities can connect to
- What predicates (relationship types) are available
- Which APIs support specific relationships
- How to structure queries for knowledge graph exploration

## 🛠 Tools Available

### 1. `get_gene_relationships`
**Purpose:** Get all possible relationship types and target categories for a gene entity

**Use Cases:**
- "How are Gene nodes connected in this knowledge graph?"
- "What types of relationships are allowed for a gene?"
- "What can I connect to a gene entity?"

**Input:**
- `entityId`: The entity to analyze (e.g., "NCBIGene:4353")
- `entityCategory`: The entity type (default: "biolink:Gene")
- `targetCategories`: Optional specific target categories to analyze
- `includePredicates`: Whether to include detailed predicate analysis

**Output:**
- Predicate analysis (most common relationship types)
- Category analysis (target entity types)
- Category-predicate combinations
- API source information
- Relationship insights and patterns

### 2. `get_predicates_by_category`
**Purpose:** Get all available predicates for relationships between specific entity categories

**Use Cases:**
- "What predicates connect genes to diseases?"
- "How do proteins interact with drugs?"
- "What relationships exist between genes and pathways?"

**Input:**
- `subjectCategory`: Source entity category (default: "biolink:Gene")
- `objectCategory`: Target entity category (optional)
- `size`: Maximum number of results (default: 1000)

**Output:**
- List of available predicates between categories
- API sources for each predicate
- Frequency analysis of predicate usage

### 3. `get_categories_by_predicate`
**Purpose:** Get all target categories that can be connected via a specific predicate

**Use Cases:**
- "What can be associated_with a gene?"
- "Which categories can be treated by drugs?"
- "What can participate_in a pathway?"

**Input:**
- `predicate`: The predicate to analyze (e.g., "biolink:associated_with")
- `subjectCategory`: Source entity category (default: "biolink:Gene")
- `size`: Maximum number of results (default: 1000)

**Output:**
- List of target categories for the predicate
- API sources for each category-predicate combination
- Frequency analysis of category usage

### 4. `analyze_knowledge_graph`
**Purpose:** Perform comprehensive analysis of knowledge graph relationships for an entity

**Use Cases:**
- "How are Gene nodes connected in this knowledge graph?"
- "What's the complete relationship profile for BRCA1?"
- "What can I discover about this entity?"

**Input:**
- `entityId`: The entity to analyze (e.g., "NCBIGene:4353")
- `entityCategory`: The entity type (default: "biolink:Gene")

**Output:**
- Comprehensive predicate analysis
- Complete category analysis
- Category-predicate combinations
- API coverage and diversity
- Relationship insights and patterns
- Clinical and therapeutic relevance

## 🔧 Installation

1. **Install dependencies:**
   ```bash
   cd custom-mcp-servers/graphModeMCPs/graphmodeMetaKG
   npm install
   ```

2. **Build the server:**
   ```bash
   npm run build
   ```

3. **Add to MCP configuration:**
   ```json
   {
     "mcpServers": {
       "graphmode-metakg": {
         "command": "node",
         "args": ["/path/to/graphmodeMetaKG/dist/index.js"]
       }
     }
   }
   ```

## 📊 Data Sources

- **SmartAPI MetaKG Registry:** https://smart-api.info/api/metakg
- **BioThings Explorer (BTE):** https://bte.transltr.io/v1
- **GraphMode Backend:** Configurable API base URL

## 🎯 Key Features

### Relationship Analysis
- Analyzes all available relationships for entity types
- Shows which categories entities can connect to
- Lists all possible predicates (relationship types)
- Provides API sources for each relationship

### Pattern Recognition
- Identifies most common relationship types
- Discovers relationship patterns
- Analyzes API coverage and diversity
- Generates insights about entity connectivity

### Clinical Relevance
- Detects disease associations
- Identifies therapeutic potential
- Analyzes functional relationships
- Provides clinical context

### API Integration
- Integrates with SmartAPI MetaKG registry
- Shows which APIs support specific relationships
- Provides comprehensive API coverage analysis
- Enables relationship discovery

## 📈 Example Usage

### Basic Gene Analysis
```javascript
// Get all relationships for a gene
{
  "entityId": "NCBIGene:4353",
  "entityCategory": "biolink:Gene"
}
```

### Category-Specific Analysis
```javascript
// Get predicates between genes and diseases
{
  "subjectCategory": "biolink:Gene",
  "objectCategory": "biolink:Disease"
}
```

### Predicate-Specific Analysis
```javascript
// Get categories that can be associated with genes
{
  "predicate": "biolink:associated_with",
  "subjectCategory": "biolink:Gene"
}
```

### Comprehensive Analysis
```javascript
// Get complete relationship profile
{
  "entityId": "NCBIGene:4353",
  "entityCategory": "biolink:Gene"
}
```

## 🔍 Output Examples

### Predicate Analysis
```
- associated_with: 45 APIs (MyGene.info, OpenTargets, ...)
- regulates: 23 APIs (GeneNetwork, STRING, ...)
- participates_in: 18 APIs (Reactome, KEGG, ...)
```

### Category Analysis
```
- Disease: 67 APIs (OpenTargets, DisGeNET, ...)
- Protein: 89 APIs (STRING, BioGRID, ...)
- Pathway: 34 APIs (Reactome, KEGG, ...)
```

### Insights
```
- Most common relationship: associated_with (45 APIs)
- Most connected category: Protein (89 APIs)
- High relationship diversity: 156 different relationship types available
- Clinical relevance: Disease associations available
- Therapeutic potential: Drug/chemical associations available
```

## 🚀 Advanced Features

### Relationship Discovery
- Finds all possible relationships for entity types
- Discovers unexpected connections
- Identifies relationship patterns
- Provides comprehensive coverage

### API Analysis
- Shows which APIs support specific relationships
- Analyzes API coverage and diversity
- Provides source information
- Enables relationship validation

### Pattern Recognition
- Identifies most common relationship types
- Discovers relationship patterns
- Analyzes category-predicate combinations
- Generates insights about connectivity

### Clinical Context
- Detects disease associations
- Identifies therapeutic potential
- Analyzes functional relationships
- Provides clinical relevance

## 🔧 Configuration

### Environment Variables
- `API_BASE_URL`: GraphMode backend API URL (default: http://localhost:3001)

### Database Context
- `conversationId`: Required for GraphMode integration
- `artifactId`: Optional artifact ID
- `apiBaseUrl`: Optional API base URL override
- `accessToken`: Optional access token

## 📚 Related Tools

- **graphmodeBTEMCP**: For executing actual BTE queries
- **graphmodePubTatorMCP**: For literature analysis
- **graphmodeStringMCP**: For protein interaction analysis

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is part of the Charm MCP ecosystem and follows the same licensing terms.

## 🆘 Support

For issues and questions:
1. Check the troubleshooting section in tool descriptions
2. Review the SmartAPI MetaKG documentation
3. Check network connectivity and API availability
4. Verify input parameters and formats

## 🔄 Updates

This MCP server is regularly updated to:
- Support new SmartAPI MetaKG features
- Add new relationship analysis capabilities
- Improve performance and reliability
- Enhance user experience and documentation
