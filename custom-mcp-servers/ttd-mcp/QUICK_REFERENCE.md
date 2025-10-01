# TTD MCP - Quick Reference

## Quick Start

```bash
cd custom-mcp-servers/ttd-mcp
npm install && npm run build
```

## Available Tools

### 1. Query TTD Database
```json
{
  "name": "query-ttd",
  "arguments": {
    "query": "object.mondo:0005083",
    "size": 20,
    "fields": "subject.name,object.name,association.predicate"
  }
}
```

### 2. Get Single Association
```json
{
  "name": "get-ttd-association",
  "arguments": {
    "association_id": "101481444_interacts_with_O60885"
  }
}
```

### 3. Get Batch Associations
```json
{
  "name": "get-ttd-associations-batch",
  "arguments": {
    "association_ids": ["136183441_interacts_with_O60885", "P17301_target_for_0005301"]
  }
}
```

### 4. Get Database Metadata
```json
{
  "name": "get-ttd-metadata",
  "arguments": {}
}
```

### 5. Get Available Fields
```json
{
  "name": "get-ttd-fields",
  "arguments": {
    "search": "clinical",
    "prefix": "association"
  }
}
```

## Query Examples

| Query Type | Example Query | Description |
|------------|---------------|-------------|
| **Drug-Disease** | `object.mondo:0005083` | Find drugs for diabetes |
| **Drug-Target** | `subject.pubchem_compound:126565` | Find targets for metformin |
| **Clinical Status** | `association.clinical_trial.status:approved` | Find approved drugs |
| **Target-Disease** | `subject.uniprotkb:P00533 AND object.mondo:0005083` | Find targets for diabetes |

## Identifier Formats

### Drugs
- `PUBCHEM.COMPOUND:126565` - PubChem Compound ID
- `TTD.DRUG:D09RJA` - TTD Drug ID

### Diseases
- `MONDO:0005083` - MONDO Disease ID
- `ICD11:5A11` - ICD-11 Disease ID

### Targets
- `UniProtKB:P00533` - UniProtKB Protein ID
- `TTD.TARGET:T99948` - TTD Target ID

## Key Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `query` | string | required | BioThings query string |
| `size` | number | 10 | Max results (1-1000) |
| `from` | number | 0 | Skip results for pagination |
| `fields` | string | "all" | Comma-separated field list |
| `format` | string | "json" | Response format (json/jsonld/html) |

## API Endpoints

- **Production**: `https://biothings.ncats.io/ttd`
- **Test**: `https://biothings.test.transltr.io/ttd`
- **Staging**: `https://biothings.ci.transltr.io/ttd`

## Limits

- **Max Results**: 1000 per query
- **Batch Size**: 1000 associations
- **Rate Limit**: 1 second between requests
- **Timeout**: 30 seconds

## Common Use Cases

### Find Approved Drugs for Disease
```json
{
  "query": "object.mondo:0005083 AND association.clinical_trial.status:approved",
  "fields": "subject.name,object.name,association.clinical_trial.status"
}
```

### Get Drug-Target Interactions
```json
{
  "query": "subject.pubchem_compound:126565 AND association.predicate:biolink:interacts_with",
  "fields": "subject.name,object.name,association.predicate"
}
```

### Find Preclinical Compounds
```json
{
  "query": "association.clinical_trial.status:preclinical",
  "fields": "subject.name,object.name,association.clinical_trial.status"
}
```

## Error Codes

- **400**: Invalid query syntax
- **404**: Association not found
- **413**: Batch size too large (>1000)
- **429**: Rate limit exceeded
- **500**: Server error

## Response Structure

```json
{
  "total": 150,
  "hits": [
    {
      "_id": "association_id",
      "subject": {"name": "Drug Name", "id": "PUBCHEM.COMPOUND:123"},
      "object": {"name": "Disease Name", "id": "MONDO:000123"},
      "association": {
        "predicate": "biolink:treats",
        "clinical_trial": {"status": "approved"}
      }
    }
  ]
}
```

## Clinical Trial Statuses

- **Approved**: `approved`, `phase 4`, `approved (orphan drug)`, `NDA filed`
- **Investigational**: `investigative`, `patented`, `discontinued in preregistration`
- **Preclinical**: `preclinical`
- **Clinical Trials**: Other statuses