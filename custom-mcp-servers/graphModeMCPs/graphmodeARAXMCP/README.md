# ARAX Pathfinder GraphMode MCP

## Overview

A Model Context Protocol (MCP) server that integrates ARAX (Automated Reasoning and Artificial Intelligence for eXplanation) pathfinder with Graph Mode visualization. This MCP allows users to find paths between biomedical entities using ARAX's powerful pathfinding capabilities and visualize results as interactive knowledge graphs.

## Features

- **Pathfinder Queries**: Find connections between source and target nodes
- **TRAPI Query Support**: Accepts full TRAPI query_graph JSON structures
- **Graph Integration**: Results automatically added to Graph Mode visualization
- **Rich Provenance**: Tracks data sources and publications
- **Deduplication**: Prevents duplicate nodes and edges
- **Real-time Updates**: UI refreshes automatically after queries

## Installation

```bash
cd custom-mcp-servers/graphModeMCPs/graphmodeARAXMCP
npm install
npm run build
```

## Configuration

The MCP is configured in `backend-mcp-client/config/mcp_server_config.json`:

```json
"graphmode-arax-mcp": {
  "command": "node",
  "args": ["../custom-mcp-servers/graphModeMCPs/graphmodeARAXMCP/dist/index.js"],
  "timeout": 60000,
  "env": {
    "API_BASE_URL": "http://localhost:3001",
    "NODE_ENV": "development"
  }
}
```

## Usage

### Basic Pathfinder Query: Find Paths Between Diseases

```typescript
// User prompt: "Find paths between Type 1 diabetes and gestational diabetes"

// MCP constructs pathfinder query:
{
  "source_nodes": ["MONDO:0005147"],
  "target_nodes": ["MONDO:0005406"],
  "max_path_length": 4,
  "max_paths": 100
}
```

### Advanced TRAPI Query: Custom Query Graph

```typescript
// User prompt: "Find genes connected to diseases through proteins"

{
  "query_graph": {
    "nodes": {
      "n0": {
        "ids": ["NCBIGene:1956"],
        "categories": ["biolink:Gene"]
      },
      "n1": {
        "categories": ["biolink:Protein"]
      },
      "n2": {
        "categories": ["biolink:Disease"]
      }
    },
    "edges": {
      "e1": {
        "subject": "n0",
        "object": "n1"
      },
      "e2": {
        "subject": "n1",
        "object": "n2"
      }
    }
  }
}
```

### Batch Pathfinder Query: Multiple Sources and Targets

```typescript
// User prompt: "Find paths between these genes and diseases"

{
  "source_nodes": ["NCBIGene:695", "NCBIGene:1956"],
  "target_nodes": ["MONDO:0005147", "MONDO:0005406"],
  "max_path_length": 3,
  "max_paths": 50
}
```

## Tools

### Tool: `pathfinder_query`

Find paths between source and target nodes using ARAX pathfinder.

#### Input Schema

```json
{
  "source_nodes": ["CURIE:123", "CURIE:456"],
  "target_nodes": ["CURIE:789", "CURIE:012"],
  "max_path_length": 4,
  "max_paths": 100,
  "databaseContext": {
    "conversationId": "string"
  }
}
```

#### Parameters

- **source_nodes** (required): Array of source node IDs (CURIE format)
- **target_nodes** (required): Array of target node IDs (CURIE format)
- **max_path_length** (optional): Maximum path length (1-10, default: 4)
- **max_paths** (optional): Maximum number of paths to find (1-1000, default: 100)
- **databaseContext** (required): Auto-injected by GraphMode

#### Response Format

```typescript
{
  content: [{
    type: "text",
    text: "✅ ARAX Pathfinder Query Complete!\n\n**Results:**\n- Added X nodes\n- Added Y edges\n..."
  }],
  refreshGraph: true
}
```

### Tool: `query_arax`

Execute custom TRAPI queries against ARAX API.

#### Input Schema

```json
{
  "query_graph": {
    "nodes": {
      "node_id": {
        "ids": ["CURIE:123"],
        "categories": ["biolink:Type"]
      }
    },
    "edges": {
      "edge_id": {
        "subject": "node_id",
        "object": "other_node_id",
        "predicates": ["biolink:predicate"]
      }
    }
  },
  "query_options": {
    "kp_timeout": "30",
    "prune_threshold": "50",
    "max_pathfinder_paths": "100",
    "max_path_length": "4"
  },
  "databaseContext": {
    "conversationId": "string"
  }
}
```

## Data Transformation

### Node Transformation

ARAX nodes are transformed to GraphMode format:

```typescript
{
  id: "MONDO:0005147",
  label: "type 1 diabetes mellitus",
  type: "Disease",
  data: {
    categories: ["biolink:Disease"],
    xrefs: ["DOID:9744", "OMIM:222100", ...],
    synonyms: ["Type 1 diabetes mellitus", ...],
    source: "arax"
  },
  position: { x: random, y: random }
}
```

### Edge Transformation

ARAX edges include full provenance:

```typescript
{
  source: "MONDO:0005147",
  target: "MONDO:0005406",
  label: "related_to",
  data: {
    source: "arax",
    primary_source: "infores:rtx-kg2",
    publications: ["PMID:12345", ...],
    knowledge_level: "knowledge_assertion",
    agent_type: "computational_agent",
    provenance: [
      { resource_id: "infores:rtx-kg2", resource_role: "primary_knowledge_source" },
      { resource_id: "infores:arax", resource_role: "aggregator_knowledge_source" }
    ]
  }
}
```

## ARAX API Integration

### Endpoint
- **URL**: `https://arax.ncats.io/api/arax/v1.4/query`
- **Method**: POST
- **Format**: TRAPI 1.6.0
- **Timeout**: 60 seconds

### Query Options

- **kp_timeout**: Knowledge provider timeout (default: "30")
- **prune_threshold**: Pruning threshold (default: "50")
- **max_pathfinder_paths**: Maximum paths to find (default: "100")
- **max_path_length**: Maximum path length (default: "4")

### Knowledge Providers

ARAX integrates with multiple knowledge providers:
- RTX-KG2
- Hetionet
- Monarch Initiative
- CTD
- Pharos
- And many more...

## Example Use Cases

### 1. Disease-Disease Connections
"Find paths between Type 1 diabetes and gestational diabetes"

### 2. Gene-Disease Paths
"Find paths from gene NCBIGene:1956 to diseases"

### 3. Drug-Disease Discovery
"Find paths from drug CHEBI:6801 to diseases"

### 4. Multi-hop Reasoning
"Find paths from genes to diseases through proteins"

### 5. Batch Pathfinding
"Find paths between these genes and these diseases"

## Testing

### Test with Example Query

```bash
# Restart backend server (to load new MCP)
cd backend-mcp-client
npm run dev

# In a Graph Mode conversation, use:
# "Find paths between MONDO:0005147 and MONDO:0005406"
```

### Verify Database

```sql
-- Check nodes were created
SELECT id, label, type FROM graph_nodes WHERE graphId = 'your-conversation-id';

-- Check edges were created
SELECT source, target, label FROM graph_edges WHERE graphId = 'your-conversation-id';
```

## Troubleshooting

### MCP Not Appearing
- Verify build completed: `ls dist/index.js`
- Check config: `backend-mcp-client/config/mcp_server_config.json`
- Restart backend server

### No Results Returned
- Verify CURIE format (e.g., `MONDO:0005147`, not `0005147`)
- Check ARAX is accessible: `curl https://arax.ncats.io/api/arax/v1.4/query`
- Review logs in backend console

### Nodes Not Appearing in UI
- Check that `refreshGraph: true` is in response
- Verify nodes exist in database
- Check filter settings in UI

## API Reference

### ARAX Endpoint
- **URL**: `https://arax.ncats.io/api/arax/v1.4/query`
- **Method**: POST
- **Format**: TRAPI 1.6.0
- **Timeout**: 60 seconds

### Backend Database API
- **Create Node**: `POST /api/graph/{conversationId}/nodes`
- **Create Edge**: `POST /api/graph/{conversationId}/edges`

## Development

### Build
```bash
npm run build
```

### Watch Mode
```bash
npm run dev
```

### Update After Changes
1. Make changes to `src/index.ts`
2. Run `npm run build`
3. Restart backend server
4. Test in Graph Mode conversation

## Architecture

```
User Query
    ↓
Claude (constructs pathfinder query)
    ↓
ARAX MCP (pathfinder_query tool)
    ↓
ARAX API (https://arax.ncats.io/api/arax/v1.4/query)
    ↓
Transform TRAPI → GraphMode format
    ↓
Create nodes & edges in database
    ↓
Return success + refreshGraph: true
    ↓
UI refreshes and displays graph
```

## Related MCPs

- **graphmode-bte-mcp**: BioThings Explorer integration
- **graphmode-translator**: Translator API integration
- **graphmode-pubtator-mcp**: PubTator entity extraction
- **graph-mode-mcp**: Base graph operations

## Resources

- [ARAX Documentation](https://arax.ncats.io/)
- [TRAPI Specification](https://github.com/NCATSTranslator/ReasonerAPI)
- [Biolink Model](https://biolink.github.io/biolink-model/)
- [NCATS Translator](https://ncats.nih.gov/translator)

## License

Part of the charm-mcp project.
