# TTD MCP

**MCP server for BioThings Therapeutic Target Database API - drug-disease, target-disease, drug-protein target, and biomarker-disease associations**

## Overview

This MCP server provides access to the BioThings Therapeutic Target Database (TTD) API, which contains comprehensive information about drug-disease, target-disease, drug-protein target, and biomarker-disease associations. The TTD is a valuable resource for drug discovery, target identification, and therapeutic research.

## Features

- **Drug-Disease Associations**: Find drugs that treat specific diseases
- **Target-Disease Associations**: Identify protein targets for diseases
- **Drug-Protein Target Interactions**: Discover drug-target binding relationships
- **Biomarker-Disease Associations**: Find biomarkers associated with diseases
- **Clinical Trial Information**: Access clinical trial status and phase data
- **Batch Processing**: Query up to 1000 associations at once
- **Flexible Querying**: Support for BioThings query syntax
- **Multiple Environments**: Access to production, test, and staging servers

## Installation

1. **Clone and Setup**:
   ```bash
   cd custom-mcp-servers/ttd-mcp
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

### 1. `query-ttd`

Query the Therapeutic Target Database using BioThings query syntax.

**Parameters**:
- `query` (string, required): BioThings query string
- `fields` (string, optional): Comma-separated list of fields to return (default: "all")
- `size` (number, optional): Maximum number of results (default: 10, max: 1000)
- `from` (number, optional): Number of results to skip for pagination (default: 0)
- `sort` (array, optional): Fields to sort by
- `scopes` (array, optional): Fields to search in (default: "_id")
- `format` (string, optional): Response format - "json", "jsonld", or "html" (default: "json")

**Example**:
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

### 2. `get-ttd-association`

Get detailed information about a specific association by its ID.

**Parameters**:
- `association_id` (string, required): The association ID
- `fields` (string, optional): Comma-separated list of fields to return (default: "all")
- `format` (string, optional): Response format (default: "json")

**Example**:
```json
{
  "name": "get-ttd-association",
  "arguments": {
    "association_id": "101481444_interacts_with_O60885"
  }
}
```

### 3. `get-ttd-associations-batch`

Get detailed information about multiple associations (up to 1000).

**Parameters**:
- `association_ids` (array, required): Array of association IDs (max 1000)
- `fields` (string, optional): Comma-separated list of fields to return (default: "all")
- `format` (string, optional): Response format (default: "json")

**Example**:
```json
{
  "name": "get-ttd-associations-batch",
  "arguments": {
    "association_ids": [
      "136183441_interacts_with_O60885",
      "P17301_target_for_0005301"
    ]
  }
}
```

### 4. `get-ttd-metadata`

Get metadata about the TTD database including statistics and build information.

**Parameters**:
- `format` (string, optional): Response format (default: "json")

**Example**:
```json
{
  "name": "get-ttd-metadata",
  "arguments": {}
}
```

### 5. `get-ttd-fields`

Get information about available data fields in the TTD database.

**Parameters**:
- `search` (string, optional): Search for fields containing this text
- `prefix` (string, optional): Filter fields by prefix
- `format` (string, optional): Response format (default: "json")

**Example**:
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

### Drug-Disease Associations

```json
{
  "query": "object.mondo:0005083",
  "fields": "subject.name,object.name,association.predicate,association.clinical_trial.status"
}
```

### Drug-Target Interactions

```json
{
  "query": "subject.pubchem_compound:126565",
  "fields": "subject.name,object.name,association.predicate"
}
```

### Clinical Trial Status

```json
{
  "query": "association.clinical_trial.status:approved",
  "fields": "subject.name,object.name,association.clinical_trial"
}
```

### Target-Disease Associations

```json
{
  "query": "subject.uniprotkb:P00533 AND object.mondo:0005083",
  "fields": "subject.name,object.name,association.predicate"
}
```

## API Endpoints

The MCP connects to the BioThings TTD service:

- **Production**: `https://biothings.ncats.io/ttd`
- **Test**: `https://biothings.test.transltr.io/ttd`
- **Staging**: `https://biothings.ci.transltr.io/ttd`

## Configuration

### Environment Variables

```bash
# API Configuration
TTD_BASE_URL=https://biothings.ncats.io/ttd

# Optional Settings
TTD_RATE_LIMIT_MS=1000        # Rate limiting (1 second)
TTD_TIMEOUT_MS=30000          # Request timeout (30 seconds)
TTD_MAX_BATCH_SIZE=1000       # Max associations per request
```

### Default Settings

- **Rate Limiting**: 1 second between requests
- **Timeout**: 30 seconds for API requests
- **Batch Size**: Up to 1000 associations per request
- **Response Format**: JSON

## Data Types and Identifiers

### Drug Identifiers
- **PubChem Compound**: `PUBCHEM.COMPOUND:126565`
- **TTD Drug ID**: `TTD.DRUG:D09RJA`

### Disease Identifiers
- **MONDO**: `MONDO:0005083`
- **ICD-11**: `ICD11:5A11`

### Target Identifiers
- **UniProtKB**: `UniProtKB:P00533`
- **TTD Target ID**: `TTD.TARGET:T99948`

### Association Types
- **Drug-Disease**: `biolink:treats`
- **Drug-Target**: `biolink:interacts_with`
- **Target-Disease**: `biolink:target_for`

## Clinical Trial Information

The TTD includes clinical trial status information:

- **Approved**: `approved`, `phase 4`, `approved (orphan drug)`, `NDA filed`
- **Investigational**: `investigative`, `patented`, `discontinued in preregistration`, `preregistration`, `withdrawn from market`
- **Preclinical**: `preclinical`
- **Clinical Trials**: Other statuses not in the above categories

## Usage Examples

### Find Drugs for a Disease

```typescript
// Query for drugs that treat diabetes
const result = await queryTTD({
  query: "object.mondo:0005148", // Type 2 diabetes
  fields: "subject.name,object.name,association.clinical_trial.status",
  size: 50
});
```

### Get Drug-Target Interactions

```typescript
// Find targets for a specific drug
const result = await queryTTD({
  query: "subject.pubchem_compound:126565", // Metformin
  fields: "subject.name,object.name,association.predicate"
});
```

### Batch Association Lookup

```typescript
// Get multiple associations at once
const result = await getTTDAssociationsBatch({
  association_ids: [
    "101481444_interacts_with_O60885",
    "P17301_target_for_0005301"
  ]
});
```

## Response Format

### Query Results

```json
{
  "total": 150,
  "hits": [
    {
      "_id": "101481444_interacts_with_O60885",
      "subject": {
        "name": "Metformin",
        "id": "PUBCHEM.COMPOUND:126565"
      },
      "object": {
        "name": "AMPK",
        "id": "UniProtKB:O60885"
      },
      "association": {
        "predicate": "biolink:interacts_with",
        "clinical_trial": {
          "status": "approved"
        }
      }
    }
  ]
}
```

### Association Details

```json
{
  "association": {
    "predicate": "biolink:treats",
    "clinical_trial": {
      "status": "approved",
      "phase": "phase 4",
      "nct_id": "NCT12345678"
    },
    "evidence": {
      "source": "TTD",
      "reference": "PMID:12345678"
    }
  },
  "subject": {
    "name": "Metformin",
    "id": "PUBCHEM.COMPOUND:126565",
    "type": "SmallMolecule"
  },
  "object": {
    "name": "Type 2 Diabetes",
    "id": "MONDO:0005148",
    "type": "Disease"
  }
}
```

## Error Handling

The MCP handles common API errors:

- **400 Bad Request**: Invalid query syntax or parameters
- **404 Not Found**: Association ID not found
- **413 Payload Too Large**: Batch size exceeds 1000 limit
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

- **BioThings Platform**: https://biothings.io/
- **Therapeutic Target Database**: https://db.idrblab.net/ttd/
- **Translator Consortium**: https://ncats.nih.gov/translator
- **Biolink Model**: https://biolink.github.io/biolink-model/

## Support

For issues with this MCP:
- Check the logs for detailed error messages
- Verify query syntax follows BioThings format
- Ensure association IDs are correct
- Contact: help@biothings.io

## License

MIT License - See LICENSE file for details.