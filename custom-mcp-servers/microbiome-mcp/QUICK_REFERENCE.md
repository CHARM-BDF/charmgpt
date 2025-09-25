# Microbiome KP MCP - Quick Reference

## Quick Start

```bash
cd custom-mcp-servers/microbiome-mcp
npm install && npm run build
```

## Tools

### `query-microbiome`
Query microbiome relationships between biomedical entities.

**Required:**
- `subject_id`: Curie ID (e.g., "NCBIGene:695", "MONDO:0005148")

**Optional:**
- `object_id`: Target entity curie ID
- `predicate`: Relationship type (default: "biolink:related_to")
- `max_results`: 1-100 (default: 20)

### `get-microbiome-meta-kg`
Get service capabilities and supported entity types.

**No required parameters.**

## Common Curie ID Formats

| Type | Prefix | Example |
|------|--------|---------|
| Gene | NCBIGene | NCBIGene:695 |
| Disease | MONDO | MONDO:0005148 |
| Chemical | CHEBI | CHEBI:15365 |
| Protein | UniProtKB | UniProtKB:P00738 |
| Organism | NCBITaxon | NCBITaxon:9606 |

## Common Predicates

- `biolink:related_to` - General relationship
- `biolink:associated_with` - Association
- `biolink:correlated_with` - Correlation
- `biolink:interacts_with` - Interaction
- `biolink:affects` - Effect relationship

## Example Queries

### Find diseases associated with a gene
```json
{
  "subject_id": "NCBIGene:695",
  "object_categories": ["biolink:Disease"],
  "max_results": 5
}
```

### Find chemicals that interact with a gene
```json
{
  "subject_id": "NCBIGene:695",
  "predicate": "biolink:interacts_with",
  "object_categories": ["biolink:ChemicalEntity"]
}
```

### Get service capabilities
```json
{}
```

## Response Structure

**Text Response:** Human-readable markdown with summaries
**Artifact Response:** Complete TRAPI JSON data

## Error Codes

- **400**: Invalid request format
- **404**: Endpoint not found
- **413**: Payload too large
- **429**: Rate limit exceeded
- **500**: Internal server error
- **501**: Not implemented

## Endpoints

- **Production**: https://multiomics.transltr.io/mbkp
- **Development**: https://multiomics.rtx.ai:9990/mbkp