# DGIdb MCP - Quick Reference

## Available Tools

| Tool | Purpose | Key Parameters |
|------|---------|----------------|
| `query-dgidb` | Query drug-gene interactions | `query`, `fields`, `size` |
| `get-dgidb-association` | Get single association | `association_id` |
| `get-dgidb-associations-batch` | Get multiple associations | `association_ids[]` |
| `get-dgidb-metadata` | Get database metadata | None |
| `get-dgidb-fields` | Get available fields | None |

## Common Query Patterns

### Find Drugs for a Gene
```json
{
  "query": "object.NCBIGene:672",
  "fields": "subject.name,object.name,association.interaction_types"
}
```

### Find Genes for a Drug
```json
{
  "query": "subject.CHEMBL_COMPOUND:CHEMBL1017",
  "fields": "subject.name,object.name,association.interaction_types"
}
```

### Specific Interaction Types
```json
{
  "query": "association.interaction_types:inhibitor",
  "fields": "subject.name,object.name,association.interaction_types"
}
```

## Key Identifiers

### Drug IDs
- `CHEMBL.COMPOUND:CHEMBL1017` (Aspirin)
- `DRUGBANK:DB00945` (Aspirin)

### Gene IDs
- `NCBIGene:672` (BRCA1)
- `SYMBOL:BRCA1` (BRCA1)
- `UniProtKB:P38398` (BRCA1)

### Interaction Types
- `inhibitor`, `agonist`, `antagonist`
- `activator`, `blocker`, `modulator`
- `allosteric_modulator`, `positive_modulator`
- `partial_agonist`, `inverse_agonist`, `antibody`

## Response Fields

### Core Fields
- `subject.name` - Drug name
- `object.name` - Gene name
- `association.interaction_types` - Interaction types
- `association.pmids` - PubMed references

### Optional Fields
- `subject.id` - Drug identifier
- `object.id` - Gene identifier
- `association.sources` - Data sources
- `association.confidence` - Confidence score

## Limits
- **Max batch size**: 1000 associations
- **Max query results**: 1000 per request
- **Rate limit**: 1 request per second
- **Timeout**: 30 seconds

## API Endpoints
- **Production**: `https://biothings.ncats.io/dgidb`
- **Test**: `https://biothings.test.transltr.io/dgidb`
- **Staging**: `https://biothings.ci.transltr.io/dgidb`