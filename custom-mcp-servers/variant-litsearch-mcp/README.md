# Variant Literature Search MCP Server

A sophisticated MCP server for variant-specific literature search with intelligent ranking and justification. This server takes structured variant case information and performs targeted PubMed searches with advanced relevance scoring.

## Features

### Core Functionality
- **Structured variant case input**: Accepts genes, phenotypes, mechanisms, drugs, and contextual queries
- **Sophisticated search query building**: Constructs optimized PubMed queries using MeSH terms and field-specific searches
- **Intelligent relevance scoring**: Multi-factor scoring based on term matches, recency, and content analysis
- **Automatic categorization**: Classifies results as genetic, phenotypic, therapeutic, mechanistic, or general
- **Detailed justification**: Provides explanations for why each result is relevant to the variant case

### Input Schema
```json
{
  "genes": ["BRCA1", "TP53"],                    // Optional: List of genes
  "phenotypes": ["breast cancer", "ovarian cancer"], // Optional: Diseases/phenotypes
  "mechanisms": ["DNA repair", "apoptosis"],      // Optional: Mechanisms of action
  "drugs": ["cisplatin", "PARP inhibitor"],       // Optional: Drugs/treatments
  "contextQuery": "hereditary breast cancer risk", // Required: Natural language context
  "maxResults": 10,                               // Optional: Max results (1-50)
  "includeJustification": true                    // Optional: Include justifications
}
```

### Output Format
```json
{
  "query": "Generated PubMed query string",
  "totalResults": 10,
  "results": [
    {
      "pmid": "12345678",
      "title": "Article title",
      "authors": ["Smith J", "Doe A"],
      "journal": "Nature Genetics",
      "year": "2023",
      "abstract": "Full abstract text...",
      "relevanceScore": 0.85,
      "justification": "Matches key terms: BRCA1, breast cancer; Relevant to genes: BRCA1; Published in: Nature Genetics",
      "matchingTerms": ["BRCA1", "breast cancer"],
      "category": "genetic"
    }
  ]
}
```

## Design Philosophy

### Multi-Factor Relevance Scoring
The server uses a sophisticated scoring algorithm that considers:
- **Gene matches** (30% weight): Direct mentions of specified genes
- **Phenotype matches** (25% weight): Disease/phenotype relevance
- **Mechanism matches** (20% weight): Mechanistic pathway relevance
- **Drug matches** (15% weight): Therapeutic intervention relevance
- **Recency bonus** (10% weight): More recent publications get higher scores

### Intelligent Query Construction
- Uses both title/abstract (`[tiab]`) and MeSH term (`[mesh]`) searches
- Combines terms with appropriate Boolean operators
- Optimizes for precision while maintaining recall

### Categorical Classification
Results are automatically classified into:
- **Genetic**: Focus on genes, variants, mutations
- **Phenotypic**: Clinical presentations, symptoms, diagnoses
- **Therapeutic**: Treatments, drugs, interventions
- **Mechanistic**: Pathways, molecular mechanisms
- **General**: Other relevant content

## Usage Examples

### Example 1: BRCA1 Variant Case
```json
{
  "genes": ["BRCA1"],
  "phenotypes": ["breast cancer", "ovarian cancer"],
  "mechanisms": ["DNA repair", "homologous recombination"],
  "drugs": ["PARP inhibitor", "olaparib"],
  "contextQuery": "BRCA1 pathogenic variant treatment options",
  "maxResults": 15
}
```

### Example 2: Phenotype-First Investigation
```json
{
  "phenotypes": ["intellectual disability", "seizures"],
  "contextQuery": "pediatric epilepsy with developmental delay genetic causes",
  "maxResults": 20
}
```

### Example 3: Drug Response Study
```json
{
  "genes": ["CYP2D6"],
  "drugs": ["codeine", "tramadol"],
  "mechanisms": ["drug metabolism"],
  "contextQuery": "CYP2D6 variants and opioid efficacy",
  "maxResults": 10
}
```

## Installation and Setup

1. **Install dependencies**:
```bash
cd custom-mcp-servers/variant-litsearch-mcp
npm install
```

2. **Set environment variables**:
```bash
export NCBI_API_KEY="your_ncbi_api_key"
export NCBI_TOOL_EMAIL="your_email@example.com"
```

3. **Build the server**:
```bash
npm run build
```

4. **Run in development mode**:
```bash
npm run dev
```

## API Integration

### NCBI E-utilities
The server uses the NCBI E-utilities API for PubMed searches:
- `esearch.fcgi`: Initial search to get PMIDs
- `efetch.fcgi`: Fetch detailed article information
- Includes proper API key handling and rate limiting

### Rate Limiting
- Respects NCBI's rate limiting guidelines
- Includes proper tool identification and email contact

## Future Enhancements

### 1. mediKanren Integration
**Planned Enhancement**: Integrate with mediKanren for sentence-level justifications
```typescript
// Future mediKanren integration
interface MediKanrenResult {
  pmid: string;
  sentences: Array<{
    text: string;
    confidence: number;
    supportingEvidence: string[];
  }>;
  conceptMappings: Record<string, string[]>;
}

async function queryMediKanren(variantCase: VariantCase): Promise<MediKanrenResult[]> {
  // Implementation to query mediKanren knowledge graph
  // Return sentence-level justifications and concept mappings
}
```

### 2. Enhanced Relevance Scoring
- **Citation impact**: Incorporate journal impact factors and citation counts
- **Author expertise**: Weight by author publication history in the field
- **Study design**: Prioritize systematic reviews and meta-analyses
- **Evidence level**: Score based on study type hierarchy

### 3. Semantic Search Improvements
- **Concept expansion**: Use UMLS/MeSH hierarchies for broader searches
- **Synonym handling**: Automatic expansion of gene/phenotype synonyms
- **Abbreviation detection**: Handle common medical abbreviations

### 4. Real-time Updates
- **Literature alerts**: Monitor for new publications matching case criteria
- **Dynamic re-ranking**: Update relevance scores as new evidence emerges

### 5. Integration Enhancements
- **OMIM integration**: Cross-reference with OMIM database
- **ClinVar integration**: Include variant-specific clinical significance
- **Pathway databases**: Integrate with KEGG, Reactome for mechanism insights

## Technical Architecture

### Core Components
1. **Query Builder**: Constructs sophisticated PubMed queries
2. **Relevance Scorer**: Multi-factor scoring algorithm
3. **Result Formatter**: Structures output with justifications
4. **Categorizer**: Automatic result classification

### Performance Considerations
- **Caching**: Future implementation of result caching
- **Batch processing**: Efficient handling of multiple PMIDs
- **Streaming**: Large result set handling

## Contributing

### Development Setup
1. Clone the repository
2. Install dependencies with `npm install`
3. Set up environment variables
4. Run tests with `npm test`

### Testing
```bash
# Run the test suite
npm test

# Test with sample variant case
node test/sample-variant-case.js
```

## License

This project is licensed under the ISC License.

## Support

For issues and questions:
1. Check the existing issues in the repository
2. Create a new issue with detailed information
3. Include sample input and expected output for bugs 