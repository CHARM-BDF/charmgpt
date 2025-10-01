# DGIdb MCP

**MCP server for BioThings DGIdb API - comprehensive drug-gene interaction database with detailed interaction types**

## Overview

This MCP server provides access to the BioThings DGIdb (Drug-Gene Interaction Database) API, which contains comprehensive information about drug-gene interactions with detailed interaction types. DGIdb is a valuable resource for drug discovery, target identification, and pharmacological research.

## Features

- **Drug-Gene Interactions**: Find drugs that interact with specific genes
- **Detailed Interaction Types**: Comprehensive interaction classifications (inhibitor, agonist, antagonist, activator, blocker, modulator, etc.)
- **PubMed References**: Access to scientific literature supporting interactions
- **Batch Processing**: Query up to 1000 associations at once
- **Flexible Querying**: Support for BioThings query syntax
- **Multiple Environments**: Access to production, test, and staging servers

## Installation

1. **Clone and Setup**:
   ```bash
   cd custom-mcp-servers/dgidb-mcp
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

### 1. `query-dgidb`

Query the DGIdb database using BioThings query syntax for drug-gene interactions.

**Parameters**:
- `query` (string, required): BioThings query string
- `fields` (string, optional): Comma-separated list of fields to return (default: "all")
- `size` (number, optional): Maximum number of results (default: 10, max: 1000)
- `from` (number, optional): Number of results to skip for pagination (default: 0)
- `sort` (array, optional): Fields to sort by
- `scopes` (array, optional): Fields to search in (default: "_id")
- `facets` (array, optional): Fields to return facets for
- `facet_size` (number, optional): Number of facet buckets to return (default: 10)
- `fetch_all` (boolean, optional): Fetch all results using scrolling (default: false)
- `scroll_id` (string, optional): Scroll ID for pagination when fetch_all is true
- `dotfield` (boolean, optional): Return flattened object with dot notation (default: false)
- `email` (string, optional): Optional email for usage tracking
- `callback` (string, optional): JSONP callback function name

**Example**:
```json
{
  "name": "query-dgidb",
  "arguments": {
    "query": "subject.CHEMBL_COMPOUND:CHEMBL1017",
    "size": 20,
    "fields": "subject.name,object.name,association.interaction_types,association.pmids"
  }
}
```

### 2. `get-dgidb-association`

Get detailed information about a specific drug-gene interaction association by its ID.

**Parameters**:
- `association_id` (string, required): The association ID
- `fields` (string, optional): Comma-separated list of fields to return (default: "all")
- `email` (string, optional): Optional email for usage tracking
- `size` (number, optional): Maximum number of results to return (default: 10)
- `callback` (string, optional): JSONP callback function name

**Example**:
```json
{
  "name": "get-dgidb-association",
  "arguments": {
    "association_id": "1fb7c7f0ef333cd2"
  }
}
```

### 3. `get-dgidb-associations-batch`

Get detailed information about multiple drug-gene interaction associations (up to 1000).

**Parameters**:
- `association_ids` (array, required): Array of association IDs (max 1000)
- `fields` (string, optional): Comma-separated list of fields to return (default: "all")
- `email` (string, optional): Optional email for usage tracking
- `size` (number, optional): Maximum number of results to return (default: 10)

**Example**:
```json
{
  "name": "get-dgidb-associations-batch",
  "arguments": {
    "association_ids": [
      "1fb7c7f0ef333cd2",
      "f91c68378f89f4c8"
    ]
  }
}
```

### 4. `get-dgidb-metadata`

Get metadata about the DGIdb database including statistics and build information.

**Parameters**: None

**Example**:
```json
{
  "name": "get-dgidb-metadata",
  "arguments": {}
}
```

### 5. `get-dgidb-fields`

Get information about available data fields in the DGIdb database.

**Parameters**: None

**Example**:
```json
{
  "name": "get-dgidb-fields",
  "arguments": {}
}
```

## Query Examples

### Drug-Gene Interactions

```json
{
  "query": "subject.CHEMBL_COMPOUND:CHEMBL1017",
  "fields": "subject.name,object.name,association.interaction_types,association.pmids"
}
```

### Gene-Drug Interactions (Reverse)

```json
{
  "query": "object.NCBIGene:673",
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

### Multiple Drug Query

```json
{
  "query": "subject.CHEMBL_COMPOUND:CHEMBL1017 OR subject.CHEMBL_COMPOUND:CHEMBL1200833",
  "fields": "subject.name,object.name,association.interaction_types"
}
```

## API Endpoints

The MCP connects to the BioThings DGIdb service:

- **Production**: `https://biothings.ncats.io/dgidb`
- **Test**: `https://biothings.test.transltr.io/dgidb`
- **Staging**: `https://biothings.ci.transltr.io/dgidb`

## Configuration

### Environment Variables

```bash
# API Configuration
DGIDB_BASE_URL=https://biothings.ncats.io/dgidb

# Optional Settings
DGIDB_RATE_LIMIT_MS=1000        # Rate limiting (1 second)
DGIDB_TIMEOUT_MS=30000          # Request timeout (30 seconds)
DGIDB_MAX_BATCH_SIZE=1000       # Max associations per request
```

### Default Settings

- **Rate Limiting**: 1 second between requests
- **Timeout**: 30 seconds for API requests
- **Batch Size**: Up to 1000 associations per request
- **Response Format**: JSON

## Data Types and Identifiers

### Drug Identifiers
- **ChEMBL Compound**: `CHEMBL.COMPOUND:CHEMBL1017`
- **DrugBank**: `DRUGBANK:DB00945`

### Gene Identifiers
- **NCBI Gene**: `NCBIGene:673`
- **HGNC Symbol**: `SYMBOL:BRCA1`
- **UniProtKB**: `UniProtKB:P38398`

### Interaction Types
- **Inhibitor**: `inhibitor`
- **Agonist**: `agonist`
- **Antagonist**: `antagonist`
- **Activator**: `activator`
- **Blocker**: `blocker`
- **Modulator**: `modulator`
- **Allosteric Modulator**: `allosteric_modulator`
- **Positive Modulator**: `positive_modulator`
- **Partial Agonist**: `partial_agonist`
- **Inverse Agonist**: `inverse_agonist`
- **Antibody**: `antibody`

## Usage Examples

### Find Drugs for a Gene

```typescript
// Query for drugs that interact with BRCA1
const result = await queryDGIdb({
  query: "object.NCBIGene:672", // BRCA1
  fields: "subject.name,object.name,association.interaction_types,association.pmids",
  size: 50
});
```

### Get Drug-Gene Interactions

```typescript
// Find genes that interact with aspirin
const result = await queryDGIdb({
  query: "subject.CHEMBL_COMPOUND:CHEMBL1017", // Aspirin
  fields: "subject.name,object.name,association.interaction_types"
});
```

### Batch Association Lookup

```typescript
// Get multiple associations at once
const result = await getDGIdbAssociationsBatch({
  association_ids: [
    "1fb7c7f0ef333cd2",
    "f91c68378f89f4c8"
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
      "_id": "association_id",
      "subject": {
        "name": "Aspirin",
        "id": "CHEMBL.COMPOUND:CHEMBL1017"
      },
      "object": {
        "name": "COX-1",
        "id": "NCBIGene:5742"
      },
      "association": {
        "interaction_types": ["inhibitor"],
        "pmids": ["PMID:12345678", "PMID:87654321"]
      }
    }
  ]
}
```

### Association Details

```json
{
  "association": {
    "interaction_types": ["inhibitor"],
    "pmids": ["PMID:12345678", "PMID:87654321"],
    "sources": ["ChEMBL", "DrugBank"]
  },
  "subject": {
    "name": "Aspirin",
    "id": "CHEMBL.COMPOUND:CHEMBL1017",
    "type": "SmallMolecule"
  },
  "object": {
    "name": "COX-1",
    "id": "NCBIGene:5742",
    "type": "Gene"
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
- **DGIdb Database**: https://dgidb.org/
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