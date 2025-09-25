# Microbiome KP MCP

A Model Context Protocol (MCP) server for the Multiomics Microbiome Knowledge Provider (TRAPI 1.5.0). This MCP enables AI assistants to query microbiome-related biomedical knowledge through the Translator Reasoner API.

## Overview

The Microbiome KP MCP provides access to the Multiomics Microbiome Knowledge Provider, which contains relationships between microbiome entities, genes, diseases, and other biomedical concepts. It supports complex graph-based queries using the TRAPI 1.5.0 standard.

## Features

- **TRAPI 1.5.0 Support**: Full compatibility with the Translator Reasoner API standard
- **Graph-based Queries**: Support for complex relationship queries between biomedical entities
- **Meta Knowledge Graph**: Access to service capabilities and supported entity types
- **Structured Data**: Both human-readable text and machine-consumable JSON artifacts
- **Comprehensive Coverage**: 28 node categories and 295 edge types supported

## Installation

1. Navigate to the microbiome-mcp directory:
   ```bash
   cd custom-mcp-servers/microbiome-mcp
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Build the project:
   ```bash
   npm run build
   ```

## Configuration

Copy the environment example file and customize as needed:
```bash
cp env.example .env
```

The service is public and requires no authentication. Optional configuration includes:
- `USER_EMAIL`: For logging purposes
- `MICROBIOME_BASE_URL`: Override default endpoint
- `MICROBIOME_TIMEOUT_MS`: Request timeout
- `MICROBIOME_RATE_LIMIT_MS`: Rate limiting

## Available Tools

### 1. `query-microbiome`

Query the Multiomics Microbiome Knowledge Provider for relationships between biomedical entities.

**Parameters:**
- `subject_id` (required): Curie ID of the subject entity (e.g., 'NCBIGene:695', 'MONDO:0005148')
- `object_id` (optional): Curie ID of the object entity for specific relationships
- `predicate` (optional): Biolink predicate (default: 'biolink:related_to')
- `subject_categories` (optional): Array of Biolink categories for subject
- `object_categories` (optional): Array of Biolink categories for object
- `max_results` (optional): Maximum results to return (1-100, default: 20)
- `log_level` (optional): Logging level (ERROR, WARNING, INFO, DEBUG)

**Example:**
```json
{
  "subject_id": "NCBIGene:695",
  "predicate": "biolink:associated_with",
  "object_categories": ["biolink:Disease"],
  "max_results": 10
}
```

### 2. `get-microbiome-meta-kg`

Get the meta knowledge graph showing all available capabilities of the service.

**Parameters:**
- `include_attributes` (optional): Include attribute information (default: true)
- `include_qualifiers` (optional): Include qualifier information (default: true)

## Supported Entity Types

The service supports 28 node categories including:
- **Genes**: NCBIGene, MGI, FB
- **Diseases**: MONDO, DOID, UMLS
- **Chemicals**: CHEBI, CHEMBL.COMPOUND, DRUGBANK
- **Proteins**: UniProtKB, PR
- **Organisms**: NCBITaxon, MESH
- **Phenotypes**: HP, EFO, EUPATH
- **And many more...**

## Supported Relationships

The service supports 295 edge types including:
- `biolink:associated_with`
- `biolink:correlated_with`
- `biolink:interacts_with`
- `biolink:affects`
- `biolink:negatively_associated_with`
- And many more...

## Usage Examples

### Query a Gene for Associated Diseases
```json
{
  "subject_id": "NCBIGene:695",
  "predicate": "biolink:associated_with",
  "object_categories": ["biolink:Disease"],
  "max_results": 5
}
```

### Find Chemical-Gene Interactions
```json
{
  "subject_id": "CHEBI:15365",
  "predicate": "biolink:interacts_with",
  "object_categories": ["biolink:Gene"],
  "max_results": 10
}
```

### Get Meta Knowledge Graph
```json
{
  "include_attributes": true,
  "include_qualifiers": true
}
```

## Response Format

The MCP returns both:
1. **Human-readable text**: Formatted markdown with summaries and usage instructions
2. **Structured JSON artifacts**: Complete TRAPI response data for programmatic use

## Error Handling

The service handles various error conditions:
- **400 Bad Request**: Invalid query parameters or curie ID format
- **404 Not Found**: TRAPI endpoint not found
- **413 Payload Too Large**: Batch size exceeded
- **429 Too Many Requests**: Rate limit exceeded
- **500 Internal Server Error**: Service error
- **501 Not Implemented**: Endpoint not available

## Development

### Running in Development Mode
```bash
npm run dev
```

### Building for Production
```bash
npm run build
```

### Linting
```bash
npm run lint
```

### Testing
```bash
npm test
```

## API Endpoints

The MCP connects to the production TRAPI endpoint:
- **Base URL**: `https://multiomics.transltr.io/mbkp`
- **Query Endpoint**: `/query`
- **Meta KG Endpoint**: `/meta_knowledge_graph`

Alternative endpoints available:
- Development: `https://multiomics.rtx.ai:9990/mbkp`
- Staging: `https://multiomics.ci.transltr.io/mbkp`
- Testing: `https://multiomics.test.transltr.io/mbkp`

## Contributing

This MCP is built using the template2 pattern. To contribute:
1. Follow the existing code structure
2. Add proper error handling
3. Include comprehensive documentation
4. Test with various query types

## License

Apache 2.0 - See the original Multiomics Microbiome KP license.

## Contact

- **Service Contact**: Gwenlyn Glusman (gglusman@systemsbiology.org)
- **MCP Implementation**: Based on template2 pattern

## Related Resources

- [TRAPI 1.5.0 Specification](https://github.com/NCATSTranslator/ReasonerAPI)
- [Biolink Model](https://biolink.github.io/biolink-model/)
- [Translator Consortium](https://ncats.nih.gov/translator)
- [Multiomics Microbiome KP](https://github.com/RTXteam/PloverDB)