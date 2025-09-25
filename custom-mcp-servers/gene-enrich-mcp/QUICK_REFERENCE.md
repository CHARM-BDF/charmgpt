# Gene Enrichment MCP - Quick Reference

## Quick Start

```bash
cd custom-mcp-servers/gene-enrich-mcp
npm install && npm run build
```

## Available Tools

### 1. Get Meta Knowledge Graph
```json
{
  "name": "get-gene-enrichment-meta-kg",
  "arguments": {
    "include_attributes": true
  }
}
```

### 2. Query Gene Enrichment
```json
{
  "name": "query-gene-enrichment",
  "arguments": {
    "gene_ids": ["NCBIGene:695", "NCBIGene:2023"],
    "pvalue_threshold": 0.05,
    "include_workflow": true
  }
}
```

## Gene ID Examples

- `NCBIGene:695` - NCBI Gene ID
- `ENSEMBL:ENSG00000012048` - Ensembl ID
- `HGNC:1133` - HGNC ID
- `UniProtKB:P00533` - UniProt ID

## Key Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `gene_ids` | array | required | 1-2500 gene identifiers |
| `pvalue_threshold` | number | 0.05 | Statistical significance threshold |
| `include_workflow` | boolean | true | Include workflow information |
| `bypass_cache` | boolean | false | Get fresh results |

## API Endpoints

- **Development**: `https://translator.broadinstitute.org/gelinea-trapi/v1.5`
- **Test**: `https://molepro-gelinea-trapi.test.transltr.io/gelinea-trapi/v1.5`
- **Staging**: `https://molepro-gelinea-trapi.ci.transltr.io/gelinea-trapi/v1.5`

## Limits

- **Max Genes**: 2500 per request
- **Rate Limit**: 2 seconds between requests
- **Timeout**: 2 minutes
- **P-value Range**: 0.0 - 1.0

## Common Use Cases

### Small Gene List Analysis
```json
{
  "gene_ids": ["NCBIGene:695", "NCBIGene:2023", "NCBIGene:5315"],
  "pvalue_threshold": 0.05
}
```

### High-Throughput Analysis
```json
{
  "gene_ids": ["NCBIGene:1", "NCBIGene:2", "..."], // Up to 2500 genes
  "pvalue_threshold": 0.001,
  "bypass_cache": true
}
```

### Service Discovery
```json
{
  "include_attributes": true
}
```

## Error Codes

- **400**: Invalid gene IDs or parameters
- **413**: Gene list too large (>2500)
- **429**: Rate limit exceeded
- **500**: Server error
- **501**: Operation not implemented

## Response Structure

```json
{
  "message": {
    "results": [...],           // Enrichment results
    "knowledge_graph": {...},   // Pathway/term network
    "query_graph": {...}        // Original query
  },
  "status": "Success",
  "description": "...",
  "logs": [...],               // Processing logs
  "workflow": [...]            // Workflow steps
}
```

## TRAPI Features

- **Version**: 1.5.0
- **Biolink**: 4.2.0
- **Operations**: lookup, enrich_results
- **Async Support**: Yes
- **Batch Limit**: 2500 genes