# BTE MCP V2 - Simplified

A simplified version of the BioThings Explorer (BTE) MCP for GraphMode. This version removes complexity and provides a single tool with fixed parameters.

## Features

- **Single Tool**: `query_bte_getall` - one tool to rule them all
- **Fixed Predicates**: 6 carefully selected predicates (no `associated_with`)
- **Fixed Categories**: 11 standard biomedical categories
- **Simple Input**: Just provide an entity ID
- **No Configuration**: All parameters are fixed for consistency

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

Simply provide an entity ID:

```
query_bte_getall(entityId: "NCBIGene:695")
```

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

- **Simplified**: Single tool instead of 4 tools
- **Fixed Parameters**: No query customization
- **Cleaner Code**: ~800 lines instead of ~2500 lines
- **Focused**: Removes complex predicate selection logic
- **Consistent**: Same results every time for same input

## License

Part of the charm-mcp project.
