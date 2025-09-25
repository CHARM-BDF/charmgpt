# PubTator MCP - Quick Reference

## Available Tools

| Tool | Purpose | Key Parameters |
|------|---------|----------------|
| `annotate-pmids` | Annotate PubMed articles | `pmids[]`, `concepts[]`, `format` |

## Entity Types

- `gene` - Genes and gene products
- `disease` - Diseases and medical conditions  
- `chemical` - Chemicals, drugs, compounds
- `species` - Organisms and species
- `mutation` - Genetic mutations and variants
- `cellline` - Cell lines
- `snp` - Single nucleotide polymorphisms
- `protein` - Proteins and protein products

## Output Formats

- `biocjson` - Structured JSON format (default)
- `pubtator` - Tab-separated format
- `pubannotation` - JSON-LD format

## Common Usage Patterns

### Annotate Specific PMIDs
```json
{
  "name": "annotate-pmids",
  "arguments": {
    "pmids": ["12345678", "87654321"],
    "concepts": ["gene", "disease", "chemical"]
  }
}
```

### Annotate Custom Text
```json
{
  "name": "annotate-text",
  "arguments": {
    "text": "BRCA1 mutations cause breast cancer",
    "concepts": ["gene", "disease", "mutation"]
  }
}
```

### Annotate Multiple PMIDs
```json
{
  "name": "annotate-pmids",
  "arguments": {
    "pmids": ["12345678", "87654321", "11223344"],
    "concepts": ["gene", "disease", "chemical"]
  }
}
```

## Limits
- **Max PMIDs per batch**: 100
- **Rate limit**: 2 seconds between requests
- **Timeout**: 60 seconds

## API Endpoints
- **Base URL**: `https://www.ncbi.nlm.nih.gov/research/pubtator3-api`
- **PMID Annotation**: `/publications/export/biocjson` (GET)