# Gene Enrichment MCP

**MCP server for Gene-List Network Enrichment Analysis (GeLiNEA) - TRAPI 1.5.0 Knowledge Provider**

## Overview

This MCP server provides access to the Gene-List Network Enrichment Analysis (GeLiNEA) service, a TRAPI 1.5.0 compliant Knowledge Provider that performs functional enrichment analysis on gene lists. It can identify enriched pathways, GO terms, and other functional annotations with statistical significance.

## Features

- **Gene Enrichment Analysis**: Analyze lists of genes for functional enrichment
- **TRAPI 1.5.0 Compliance**: Full support for Translator Reasoner API standards
- **Meta Knowledge Graph**: Access to service capabilities and supported operations
- **Statistical Analysis**: P-value thresholding and significance testing
- **Batch Processing**: Support for up to 2500 genes per request
- **Multiple Environments**: Access to test, staging, and development servers

## Installation

1. **Clone and Setup**:
   ```bash
   cd custom-mcp-servers/gene-enrich-mcp
   npm install
   ```

2. **Environment Configuration**:
   ```bash
   cp env.example .env
   # Edit .env with your preferred settings (optional - defaults work)
   ```

3. **Build**:
   ```bash
   npm run build
   ```

## Available Tools

### 1. `get-gene-enrichment-meta-kg`

Retrieve the meta knowledge graph for the Gene Enrichment TRAPI service.

**Parameters**:
- `include_attributes` (boolean, optional): Whether to include attribute information (default: true)

**Example**:
```json
{
  "name": "get-gene-enrichment-meta-kg",
  "arguments": {
    "include_attributes": true
  }
}
```

### 2. `query-gene-enrichment`

Perform gene enrichment analysis using a list of gene IDs.

**Parameters**:
- `gene_ids` (array, required): Array of gene identifiers (1-2500 genes)
- `pvalue_threshold` (number, optional): P-value threshold for significance (default: 0.05)
- `include_workflow` (boolean, optional): Include workflow information (default: true)
- `submitter` (string, optional): Identifier for the query submitter
- `bypass_cache` (boolean, optional): Bypass cached results (default: false)

**Example**:
```json
{
  "name": "query-gene-enrichment",
  "arguments": {
    "gene_ids": ["NCBIGene:695", "NCBIGene:2023", "NCBIGene:5315"],
    "pvalue_threshold": 0.01,
    "include_workflow": true
  }
}
```

## Gene ID Formats

The service supports various gene identifier formats:

- **NCBI Gene IDs**: `NCBIGene:695`, `NCBIGene:2023`
- **Ensembl IDs**: `ENSEMBL:ENSG00000012048`
- **HGNC IDs**: `HGNC:1133`
- **UniProt IDs**: `UniProtKB:P00533`

## API Endpoints

The MCP connects to the GeLiNEA TRAPI service:

- **Development**: `https://translator.broadinstitute.org/gelinea-trapi/v1.5`
- **Test**: `https://molepro-gelinea-trapi.test.transltr.io/gelinea-trapi/v1.5`
- **Staging**: `https://molepro-gelinea-trapi.ci.transltr.io/gelinea-trapi/v1.5`

## Configuration

### Environment Variables

```bash
# API Configuration
GENE_ENRICH_BASE_URL=https://translator.broadinstitute.org/gelinea-trapi/v1.5

# Optional Settings
GENE_ENRICH_RATE_LIMIT_MS=2000        # Rate limiting (2 seconds)
GENE_ENRICH_TIMEOUT_MS=120000         # Request timeout (2 minutes)
GENE_ENRICH_BATCH_SIZE_LIMIT=2500     # Max genes per request
```

### Default Settings

- **Rate Limiting**: 2 seconds between requests
- **Timeout**: 2 minutes for enrichment analysis
- **Batch Size**: Up to 2500 genes per request
- **P-value Threshold**: 0.05 (5% significance level)

## Usage Examples

### Basic Gene Enrichment

```typescript
// Query a small gene list for enrichment
const result = await queryGeneEnrichment({
  gene_ids: ["NCBIGene:695", "NCBIGene:2023", "NCBIGene:5315"],
  pvalue_threshold: 0.05
});
```

### High-Throughput Analysis

```typescript
// Analyze a large gene list with strict significance
const result = await queryGeneEnrichment({
  gene_ids: largeGeneList, // Up to 2500 genes
  pvalue_threshold: 0.001, // Very strict significance
  bypass_cache: true       // Get fresh results
});
```

### Service Discovery

```typescript
// Get information about available operations
const metaKg = await getGeneEnrichmentMetaKg({
  include_attributes: true
});
```

## Response Format

### Enrichment Results

The service returns TRAPI-compliant responses with:

- **Results**: Array of enrichment results with scores and significance
- **Knowledge Graph**: Nodes and edges representing enriched pathways/terms
- **Logs**: Processing information and any warnings
- **Workflow**: Information about the enrichment workflow used

### Example Response Structure

```json
{
  "message": {
    "results": [
      {
        "node_bindings": {...},
        "analyses": [
          {
            "resource_id": "infores:gelinea",
            "score": 0.001,
            "edge_bindings": {...}
          }
        ]
      }
    ],
    "knowledge_graph": {
      "nodes": {...},
      "edges": {...}
    }
  },
  "status": "Success",
  "description": "Enrichment analysis completed",
  "logs": [...],
  "workflow": [...]
}
```

## Error Handling

The MCP handles common TRAPI errors:

- **400 Bad Request**: Invalid gene IDs or parameters
- **413 Payload Too Large**: Gene list exceeds 2500 limit
- **429 Rate Limited**: Too many requests
- **500 Server Error**: Internal service issues
- **501 Not Implemented**: Unsupported operations

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

## TRAPI Compliance

This MCP is fully compliant with TRAPI 1.5.0 specifications:

- **Operations**: `lookup`, `enrich_results`
- **Biolink Version**: 4.2.0
- **Batch Size Limit**: 2500 genes
- **Async Query Support**: Available
- **Meta Knowledge Graph**: Provided

## Related Services

- **Translator Consortium**: https://ncats.nih.gov/translator
- **TRAPI Specification**: https://github.com/NCATSTranslator/ReasonerAPI
- **Biolink Model**: https://biolink.github.io/biolink-model/
- **GeLiNEA Source**: https://github.com/broadinstitute/molecular-data-provider

## Support

For issues with this MCP:
- Check the logs for detailed error messages
- Verify gene ID formats are correct
- Ensure gene list size is within limits (≤2500)
- Contact: translator@broadinstitute.org

## License

MIT License - See LICENSE file for details.