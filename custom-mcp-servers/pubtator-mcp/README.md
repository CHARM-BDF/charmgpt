# PubTator MCP

**MCP server for PubTator API - biomedical text mining and entity extraction from PubMed literature**

## Overview

This MCP server provides access to the PubTator API, which is a powerful biomedical text mining service that extracts entities from PubMed literature. PubTator can identify and annotate genes, diseases, chemicals, species, mutations, cell lines, SNPs, and proteins in biomedical texts.

## Features

- **PMID Annotation**: Extract entities from PubMed articles by PMID
- **Multiple Entity Types**: Support for 8 different entity types
- **Multiple Formats**: Output in BioC JSON, PubTator, or PubAnnotation formats
- **Knowledge Graph Building**: Create interactive knowledge graphs from literature
- **Co-occurrence Analysis**: Build relationships based on entity co-occurrence in papers
- **Graph Visualization**: Compatible with Cytoscape, Gephi, and other graph tools

## Installation

1. **Clone and Setup**:
   ```bash
   cd custom-mcp-servers/pubtator-mcp
   npm install
   ```

2. **Environment Configuration**:
   ```bash
   cp env.example .env
   # Edit .env with your PubTator API key and email
   ```

3. **Build**:
   ```bash
   npm run build
   ```

## Available Tools

### 1. `annotate-pmids`

Annotate PubMed articles by PMIDs to extract biomedical entities.

**Parameters**:
- `pmids` (array, required): Array of PubMed IDs (PMIDs) to annotate (max 100)
- `concepts` (array, optional): Types of entities to extract (default: ["gene", "disease", "chemical"])
- `format` (string, optional): Output format - "biocjson", "pubtator", or "pubannotation" (default: "biocjson")

**Example**:
```json
{
  "name": "annotate-pmids",
  "arguments": {
    "pmids": ["12345678", "87654321"],
    "concepts": ["gene", "disease", "chemical"],
    "format": "biocjson"
  }
}
```



## Entity Types

The following entity types can be extracted:

- **Gene**: Genes and gene products
- **Disease**: Diseases and medical conditions
- **Chemical**: Chemicals, drugs, and compounds
- **Species**: Organisms and species
- **Mutation**: Genetic mutations and variants
- **Cellline**: Cell lines
- **SNP**: Single nucleotide polymorphisms
- **Protein**: Proteins and protein products

## Output Formats

### BioC JSON (Default)
Structured JSON format with documents, passages, and annotations:
```json
{
  "documents": [
    {
      "id": "12345678",
      "title": "Paper Title",
      "abstract": "Abstract text...",
      "annotations": [
        {
          "text": "BRCA1",
          "infons": {
            "type": "Gene",
            "identifier": "HGNC:1100"
          }
        }
      ]
    }
  ]
}
```

### PubTator Format
Tab-separated format with entity annotations:
```
12345678|t|BRCA1 mutations|Gene|1100|BRCA1
12345678|a|breast cancer|Disease|D001943|breast cancer
```

### PubAnnotation Format
JSON-LD format for semantic web applications:
  ```json
{
  "text": "BRCA1 mutations are associated with breast cancer.",
  "denotations": [
    {
      "id": "T1",
      "span": {"begin": 0, "end": 5},
      "obj": "Gene"
    }
  ]
}
```

## Configuration

### Environment Variables

```bash
# PubTator API Configuration
PUBTATOR_BASE_URL=https://www.ncbi.nlm.nih.gov/research/pubtator-api
PUBTATOR_API_KEY=your_pubtator_api_key_here
PUBTATOR_USER_EMAIL=your.email@example.com

# Optional Settings
PUBTATOR_RATE_LIMIT_MS=2000                   # Rate limiting (2 seconds)
PUBTATOR_TIMEOUT_MS=60000                     # Request timeout (60 seconds)
PUBTATOR_MAX_RETRIES=3                        # Maximum retry attempts
PUBTATOR_MAX_BATCH_SIZE=100                   # Max PMIDs per request
PUBTATOR_ASYNC_POLL_INTERVAL_MS=5000          # Polling interval (5 seconds)
PUBTATOR_ASYNC_MAX_WAIT_MS=300000             # Max wait time (5 minutes)
```

### Default Settings

- **Rate Limiting**: 2 seconds between requests
- **Timeout**: 60 seconds for API requests
- **Batch Size**: Up to 100 PMIDs per request
- **Async Polling**: 5 seconds interval
- **Max Wait**: 5 minutes for async operations
- **Response Format**: BioC JSON

## Usage Examples

### Annotate PubMed Articles

```typescript
// Annotate specific PMIDs
const result = await annotatePMIDs({
  pmids: ["12345678", "87654321"],
  concepts: ["gene", "disease", "chemical"],
  format: "biocjson"
});
```

### Annotate Custom Text

```typescript
// Annotate research text
const result = await annotateText({
  text: "BRCA1 mutations are associated with increased breast cancer risk.",
  concepts: ["gene", "disease", "mutation"],
  format: "biocjson"
});
```

### Annotate Multiple PMIDs

```typescript
// Annotate multiple PMIDs at once
const annotationResult = await annotatePMIDs({
  pmids: ["12345678", "87654321", "11223344"],
  concepts: ["gene", "disease", "chemical"]
});
```

### Async Text Processing

```typescript
// For large texts, use async processing
const result = await annotateTextAsync({
  text: "Very long research paper text...",
  concepts: ["gene", "disease", "chemical"],
  poll_interval_ms: 5000,
  max_wait_ms: 300000
});
```

## Knowledge Graph Building

The PubTator MCP automatically creates knowledge graphs from biomedical literature with the same format as medik-mcp2:

### **Graph Structure**
- **Nodes**: Biomedical entities with type classification and connection counts
- **Links**: Co-occurrence relationships between entities in the same papers
- **Entity Types**: Genes, Diseases, Drugs, Species, Mutations, Cell Lines, SNPs, Proteins
- **Evidence**: PMID references supporting each relationship

### **Graph Properties**
- **Node Size**: Based on connection count (5-20 range)
- **Node Groups**: Color-coded by entity type
- **Link Strength**: Based on co-occurrence frequency
- **Evidence**: PubMed IDs supporting each relationship

### **Workflow**
1. **Get PMIDs** from PubMed or other sources
2. **Annotate articles** to get entities and relationships
3. **Automatic Graph Creation**: Nodes and links are automatically generated
4. **Visualization**: Compatible with graph visualization tools

### Example Workflow

```typescript
// 1. Get PMIDs from PubMed or other sources
const pmids = ["12345678", "87654321", "11223344"];

// 2. Annotate articles (automatically creates knowledge graph)
const result = await annotatePMIDs({
  pmids: pmids,
  concepts: ["gene", "disease", "chemical"]
});

// 3. Knowledge graph is automatically created and returned as artifact
// The artifact contains:
// - nodes: Array of entities with type, group, connections
// - links: Array of co-occurrence relationships
// - filteredCount: Number of filtered relationships
// - filteredNodeCount: Number of filtered nodes
```

### **Graph Output Format**

The knowledge graph follows the same format as medik-mcp2:

```json
{
  "nodes": [
    {
      "id": "HGNC:1100",
      "name": "BRCA1",
      "entityType": "Gene",
      "group": 2,
      "isStartingNode": false,
      "val": 15,
      "connections": 10
    }
  ],
  "links": [
    {
      "source": "HGNC:1100",
      "target": "MONDO:0007254",
      "label": "co-occurs with",
      "value": 3,
      "evidence": ["12345678", "87654321"]
    }
  ],
  "filteredCount": 0,
  "filteredNodeCount": 0
}
```

## Error Handling

The MCP handles common API errors:

- **400 Bad Request**: Invalid request parameters
- **404 Not Found**: Resource not found
- **413 Payload Too Large**: Text too long (max 100,000 characters)
- **429 Rate Limited**: Too many requests
- **500 Server Error**: Internal service issues

## Development

### Running in Development Mode

   ```bash
   npm run dev
   ```

### Building for Production

```bash
npm run build
npm start
```

### Testing

   ```bash
npm test
```

## Related Services

- **PubTator API**: https://www.ncbi.nlm.nih.gov/research/pubtator-api/
- **PubMed**: https://pubmed.ncbi.nlm.nih.gov/
- **BioC Format**: https://bioc.sourceforge.net/
- **PubAnnotation**: https://pubannotation.org/

## Support

For issues with this MCP:
- Check the logs for detailed error messages
- Verify API key and email configuration
- Ensure text length is within limits
- Contact: help@ncbi.nlm.nih.gov

## License

MIT License - See LICENSE file for details.