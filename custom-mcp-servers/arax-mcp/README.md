# ARAX MCP Server

A Model Context Protocol (MCP) server that provides access to biomedical knowledge graphs through the NCATS ARAX (Automated Reasoning and Autonomous eXploration) API.

## Overview

This MCP server leverages the ARAX TRAPI (Translator Reasoner API) to explore biomedical knowledge graphs and find relationships between genes, drugs, diseases, and other biomedical entities. It's designed to create subgraphs that connect entities through intermediate relationships.

## Features

- **Entity Relationship Queries**: Find what a biomedical entity affects or is affected by
- **Connecting Path Discovery**: Find intermediate entities that connect two biomedical entities
- **Custom Query Builder**: Execute custom ARAX queries with specific predicates and categories
- **Knowledge Graph Generation**: Returns structured knowledge graphs with nodes and edges
- **TRAPI Compliance**: Uses the standard Translator Reasoner API format
- **Real-time Results**: Non-streaming queries for reliable MCP integration

## API Endpoint

- **Base URL**: `https://arax.ncats.io/api/arax/v1.4/query`
- **Method**: POST with JSON TRAPI query
- **Format**: TRAPI 1.5 compliant biomedical queries

## Available Tools

### 1. `query-entity-effects`
Find what a biomedical entity affects in the knowledge graph.

**Parameters:**
- `entity` (required): Entity in CURIE format (e.g., "NCBIGene:283635", "DRUGBANK:DB00001") or gene name

**Example:**
```json
{
  "entity": "NCBIGene:283635"
}
```

**Returns:** Knowledge graph showing what FAM177A1 affects (genes, diseases, proteins, etc.)

### 2. `find-connecting-path`
Find connecting paths between two biomedical entities through intermediate entities.

**Parameters:**
- `entity_a` (required): First entity in CURIE format or name
- `entity_b` (required): Second entity in CURIE format or name

**Example:**
```json
{
  "entity_a": "NCBIGene:283635",
  "entity_b": "MONDO:0005148"
}
```

**Returns:** Subgraph showing paths connecting the two entities through intermediate biomedical entities.

### 3. `custom-query`
Execute a custom ARAX query with specific predicates and target categories.

**Parameters:**
- `source_entity` (required): Source entity in CURIE format
- `target_categories` (optional): Array of biolink categories to search for
- `predicates` (optional): Array of biolink predicates to use

**Example:**
```json
{
  "source_entity": "DRUGBANK:DB00001",
  "target_categories": ["biolink:Disease", "biolink:Gene"],
  "predicates": ["biolink:treats", "biolink:affects"]
}
```

## Installation

1. Navigate to the arax-mcp directory:
```bash
cd custom-mcp-servers/arax-mcp
```

2. Install dependencies:
```bash
npm install
```

3. Build the TypeScript source:
```bash
npm run build
```

## Usage Examples

### Basic Entity Query
Query what the gene FAM177A1 affects:
```json
{
  "tool": "query-entity-effects",
  "arguments": {
    "entity": "FAM177A1"
  }
}
```

### Finding Connections
Find how gene BRCA1 connects to breast cancer:
```json
{
  "tool": "find-connecting-path",
  "arguments": {
    "entity_a": "HGNC:1100",
    "entity_b": "MONDO:0007254"
  }
}
```

### Custom Drug Query
Find what diseases a drug treats:
```json
{
  "tool": "custom-query",
  "arguments": {
    "source_entity": "DRUGBANK:DB00001",
    "target_categories": ["biolink:Disease"],
    "predicates": ["biolink:treats"]
  }
}
```

## Supported Entity Types

The server recognizes and works with various biomedical entity formats:

### Genes
- **HGNC**: HGNC:1100 (BRCA1)
- **NCBIGene**: NCBIGene:283635 (FAM177A1)
- **ENSEMBL**: ENSEMBL:ENSG00000151327

### Drugs
- **DrugBank**: DRUGBANK:DB00001
- **ChEBI**: CHEBI:15365
- **ChEMBL**: CHEMBL:CHEMBL25

### Diseases
- **MONDO**: MONDO:0005148 (type 2 diabetes)
- **DOID**: DOID:1612 (breast cancer)
- **HP**: HP:0000006 (autosomal dominant)

### Proteins
- **UniProtKB**: UniProtKB:P38398
- **PR**: PR:000005054

## Output Format

The server returns knowledge graphs in **the same format as medik-mcp2** for UI compatibility:

### Nodes
- `id`: Entity identifier (CURIE format)
- `name`: Human-readable name
- `entityType`: Classified type (Gene, Drug, Disease, etc.)
- `group`: Visualization group number
- `isStartingNode`: Boolean indicating if this is the queried entity
- `val`: Node size (based on connections)
- `connections`: Number of connections

### Links
- `source`: Source entity ID
- `target`: Target entity ID
- `label`: Biolink predicate (e.g., "biolink:affects")
- `value`: Relationship strength/confidence
- `evidence`: Source databases/publications

### Top-level Properties
- `nodes`: Array of graph nodes
- `links`: Array of graph relationships  
- `filteredCount`: Number of relationships found
- `filteredNodeCount`: Number of filtered nodes (always 0 for ARAX)

### MCP Response Format
Uses **artifacts** (same as medik-mcp2):
```json
{
  "content": [
    {
      "type": "text",
      "text": "# Knowledge Graph: All relationships for ENTITY\n\nFound X relationships..."
    }
  ],
  "artifacts": [
    {
      "type": "application/vnd.knowledge-graph", 
      "title": "Knowledge Graph: ...",
      "content": "{\"nodes\":[...],\"links\":[...]}"
    }
  ]
}
```

## Development

- **Source**: `src/index.ts`
- **Build**: `npm run build`
- **Watch**: `npm run dev`
- **Clean**: `npm run clean`
- **Rebuild**: `npm run rebuild`

## ARAX Query Structure

The server constructs TRAPI-compliant queries like:

```json
{
  "message": {
    "query_graph": {
      "edges": {
        "e0": {
          "predicates": ["biolink:affects"],
          "subject": "n0",
          "object": "n1"
        }
      },
      "nodes": {
        "n0": {
          "ids": ["NCBIGene:283635"],
          "categories": ["biolink:Gene"],
          "name": "FAM177A1"
        },
        "n1": {
          "categories": [
            "biolink:Disease",
            "biolink:Drug",
            "biolink:Gene",
            "biolink:Protein"
          ]
        }
      }
    }
  },
  "submitter": "ARAX MCP Server",
  "stream_progress": false,
  "query_options": {
    "kp_timeout": "30",
    "prune_threshold": "50"
  }
}
```

## License

MIT 