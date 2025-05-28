# MediKanren MCP Server

A Model Context Protocol (MCP) server that provides access to biomedical knowledge graphs through the MediKanren API.

## Features

- **Bidirectional Queries**: Searches for relationships both TO and FROM a given biomedical entity
- **Multiple Predicates**: Supports both default `biolink:affects` queries and custom predicate queries
- **Knowledge Graph Generation**: Creates interactive knowledge graphs from biomedical relationships
- **Entity Type Classification**: Automatically categorizes entities (Drugs, Genes, Diseases, etc.)
- **Data Filtering**: Removes unreliable variant data and basic transcription relationships
- **Real-time Logging**: Provides detailed logging through MCP logging system

## API Endpoint

The server now uses the standard MediKanren endpoint:
- **Base URL**: `https://medikanren.metareflective.systems/query0`
- **Parameters**: `subject`, `predicate`, `object` (standard biolink format)

For bidirectional queries, the server makes two API calls:
1. `?subject=ENTITY&predicate=PREDICATE&object=` (what the entity relates to)
2. `?subject=&predicate=PREDICATE&object=ENTITY` (what relates to the entity)

## Available Tools

### 1. `get-everything`
- **Description**: Get all biomedical relationships for a given entity using `biolink:affects` predicate
- **Parameters**: 
  - `entity` (required): The entity to query in CURIE format (e.g., "HGNC:8651", "DRUGBANK:DB12411")

### 2. `query-with-predicate`
- **Description**: Query biomedical relationships with a specific predicate (bidirectional)
- **Parameters**:
  - `entity` (required): The entity to query in CURIE format
  - `predicate` (required): The biolink predicate to use (e.g., "biolink:treats", "biolink:affects", "biolink:related_to")

## Installation

1. Install dependencies:
```bash
npm install
```

2. Build the TypeScript source:
```bash
npm run build
```

3. The compiled JavaScript will be available in the `dist/` directory

## Usage Examples

### Using get-everything tool:
```json
{
  "entity": "HGNC:8651"
}
```

### Using query-with-predicate tool:
```json
{
  "entity": "DRUGBANK:DB12411",
  "predicate": "biolink:treats"
}
```

## Development

- **Source**: `src/index.ts`
- **Build**: `npm run build`
- **Watch**: `npm run dev`
- **Clean**: `npm run clean`

## Entity Types Supported

The server recognizes and categorizes various biomedical entities:
- **Genes**: HGNC, NCBIGene, ENSEMBL
- **Drugs**: DRUGBANK, CHEBI, CHEMBL
- **Diseases**: MONDO, DOID, HP
- **Proteins**: UniProtKB, PR
- **Pathways**: REACTOME, KEGG
- **And more...**

## Output Format

The server returns knowledge graphs with:
- **Nodes**: Biomedical entities with type classification and connection counts
- **Links**: Relationships between entities with evidence citations
- **Filtering**: Automatic removal of unreliable data (CAID variants, basic transcriptions)
- **Artifacts**: JSON knowledge graph data for visualization

## License

MIT 