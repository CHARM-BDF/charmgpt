# BTE MCP V2 - Simplified

A simplified version of the BioThings Explorer (BTE) MCP for GraphMode. This version removes complexity and provides a single tool with fixed parameters.

## Features

- **Two Tools**: 
  - `query_bte_getall` - comprehensive queries across all categories
  - `query_bte_by_categories` - targeted queries for specific entity types
- **Fixed Predicates**: 6 carefully selected predicates (no `associated_with`)
- **Flexible Categories**: Choose from 11 standard biomedical categories or query all
- **Simple Input**: Just provide an entity ID (and categories for targeted queries)
- **Smart Selection**: Tools guide LLM to choose the right approach

## Fixed Configuration

### Predicates (6 total)
- `biolink:affected_by`
- `biolink:affects`
- `biolink:interacts_with`
- `biolink:participates_in`
- `biolink:derives_from`
- `biolink:derives_into`

### Categories (11 total)
- `biolink:BiologicalProcessOrActivity`
- `biolink:Gene`
- `biolink:Protein`
- `biolink:GeneFamily`
- `biolink:DiseaseOrPhenotypicFeature`
- `biolink:AnatomicalEntity`
- `biolink:RNAProduct`
- `biolink:ChemicalMixture`
- `biolink:SmallMolecule`
- `biolink:Polypeptide`
- `biolink:ProteinFamily`

## Usage

### Comprehensive Query (All Categories)
Use `query_bte_getall` when you want to explore ALL possible connections:

```
query_bte_getall(entityId: "NCBIGene:695")
```

### Targeted Query (Specific Categories)
Use `query_bte_by_categories` when you want specific entity types:

```
query_bte_by_categories(
  entityId: "MONDO:0005148", 
  categories: ["biolink:Gene", "biolink:Protein"]
)
```

## When to Use Each Tool

### Use `query_bte_getall` when:
- User asks for "all connections" or "everything related to X"
- No specific entity types are mentioned
- You want comprehensive network exploration
- User says "find all genes, proteins, diseases, etc."

### Use `query_bte_by_categories` when:
- User specifies particular entity types ("genes", "proteins", "diseases")
- User asks for "genes associated with X" or "proteins related to Y"
- You want focused, targeted results
- User mentions specific categories they're interested in

## Installation

```bash
cd custom-mcp-servers/graphModeMCPs/graphmodeBTEMCP2
npm install
npm run build
```

## Configuration

Add to `backend-mcp-client/config/mcp_server_config.json`:

```json
"graphmode-bte-mcp-v2": {
  "command": "node",
  "args": ["../custom-mcp-servers/graphModeMCPs/graphmodeBTEMCP2/dist/index.js"],
  "timeout": 60000,
  "env": {
    "API_BASE_URL": "http://localhost:3001",
    "NODE_ENV": "development"
  }
}
```

## Differences from V1

- **Two Focused Tools**: Instead of 4 complex tools, now has 2 clear-purpose tools
- **Smart Selection**: Tools guide LLM to choose appropriate approach
- **Fixed Parameters**: No complex query customization
- **Cleaner Code**: ~1000 lines instead of ~2500 lines
- **Focused**: Removes complex predicate selection logic
- **Consistent**: Same results every time for same input
- **Targeted Queries**: New ability to query specific entity types

## License

Part of the charm-mcp project.
