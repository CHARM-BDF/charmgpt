# Graph Mode Gene Enrichment MCP

**MCP server for Gene-List Network Enrichment Analysis (GeLiNEA) in Graph Mode**

## Overview

This MCP server provides gene enrichment analysis functionality for Graph Mode conversations. It uses the GeLiNEA TRAPI 1.5.0 service to perform functional enrichment analysis on gene lists and automatically adds the enriched pathways, GO terms, and their connections to genes directly into the Graph Mode graph.

## Key Features

- **Gene Enrichment Analysis**: Analyze lists of genes for functional enrichment
- **Graph Mode Integration**: Automatically adds enriched terms and connections to the graph
- **TRAPI 1.5.0 Compliance**: Full support for Translator Reasoner API standards
- **Statistical Analysis**: P-value thresholding and significance testing
- **Batch Processing**: Support for up to 2500 genes per request
- **No Artifacts**: Returns only text summary (graphmode MCPs don't use artifacts)

## Installation

1. **Install dependencies**:
   ```bash
   cd custom-mcp-servers/graphModeMCPs/graphmodeGeneEnrichmentMCP
   npm install
   ```

2. **Build**:
   ```bash
   npm run build
   ```

## Available Tools

### `queryGeneEnrichment`

Perform gene enrichment analysis on a list of genes and add the enriched pathways/terms to the Graph Mode graph.

**Parameters**:
- `gene_ids` (array, required): Array of 1-2500 gene identifiers
- `pvalue_threshold` (number, optional): P-value threshold for significance (default: 0.05)
- `include_workflow` (boolean, optional): Include workflow information (default: true)
- `submitter` (string, optional): Identifier for the query submitter
- `bypass_cache` (boolean, optional): Bypass cached results (default: false)
- `databaseContext` (object, required): Graph Mode database context (auto-injected by backend)
  - `conversationId` (string, required): Conversation ID for the graph

**Example**:
```json
{
  "name": "queryGeneEnrichment",
  "arguments": {
    "gene_ids": ["NCBIGene:695", "NCBIGene:2023", "NCBIGene:5315"],
    "pvalue_threshold": 0.05,
    "databaseContext": {
      "conversationId": "abc123"
    }
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

- **Production**: `https://translator.broadinstitute.org/gelinea-trapi/v1.5`

## Response Format

The MCP returns a text summary (no artifacts) that includes:

- **Status**: Success/failure status
- **Results Summary**: Number of enrichment results, nodes, and edges added
- **Enriched Groups**: List of enriched pathways/terms with:
  - Term name and ID
  - P-value score
  - Number of genes in the enriched group
  - Examples of genes in the group

### Example Response

```
## Gene Enrichment Analysis Complete

**Status:** Success
**Description:** Gene enrichment analysis completed

### Results Summary
- **Enrichment Results Found:** 15
- **Nodes Added to Graph:** 28
- **Edges Added to Graph:** 42
- **Input Genes:** 3

### Enriched Groups (Top 10)

**Cell Cycle Regulation** (GO:0007049)
- P-value: 1.234e-05
- Genes in group: 8
- Examples: TP53, CDK1, CCNA2, ... and 5 more
```

## Graph Mode Integration

This MCP automatically:

1. **Queries the TRAPI service** for gene enrichment
2. **Extracts nodes and edges** from the knowledge graph
3. **Transforms them** to Graph Mode format
4. **Bulk adds them** to the graph database
5. **Returns a summary** with genes in enriched groups

The enriched terms (pathways, GO terms, etc.) and their connections to genes are automatically added to the graph, so you can visualize the enrichment relationships.

## Configuration

### Environment Variables

```bash
# Graph Mode API Configuration
API_BASE_URL=http://localhost:3001

# Gene Enrichment TRAPI Configuration
GENE_ENRICH_BASE_URL=https://translator.broadinstitute.org/gelinea-trapi/v1.5
```

### Default Settings

- **API Base URL**: `http://localhost:3001` (Graph Mode backend)
- **TRAPI Base URL**: `https://translator.broadinstitute.org/gelinea-trapi/v1.5`
- **P-value Threshold**: 0.05 (5% significance level)
- **Batch Size**: Up to 2500 genes per request

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

## Differences from Regular Gene Enrichment MCP

This graphmode version differs from the regular `gene-enrich-mcp`:

1. **No Artifacts**: Returns only text summary (graphmode MCPs don't use artifacts)
2. **Graph Integration**: Automatically adds nodes/edges to the graph
3. **Summary Format**: Shows genes grouped by enriched terms/pathways
4. **Database Context**: Requires `databaseContext` parameter (auto-injected)

## Related MCPs

- [Gene Enrichment MCP](../gene-enrich-mcp/) - Regular version with artifacts
- [Graph Mode Base MCP](../graphmodeBaseMCP/) - Base graphmode functionality
- [Graph Mode Gene Add MCP](../graphmodeGeneAddMCP/) - Add genes to graph

## Support

For issues with this MCP:
- Check the logs for detailed error messages
- Verify gene ID formats are correct
- Ensure gene list size is within limits (≤2500)
- Contact: translator@broadinstitute.org

## License

MIT License - See LICENSE file for details.

