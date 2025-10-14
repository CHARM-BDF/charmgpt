# BioThings Explorer (BTE) GraphMode MCP

## Overview

A Model Context Protocol (MCP) server that integrates BioThings Explorer's TRAPI endpoint with Graph Mode visualization. This MCP allows users to query biomedical knowledge using TRAPI (Translator Reasoner API) format and visualize results as interactive knowledge graphs.

## Features

- **TRAPI Query Support**: Accepts full TRAPI query_graph JSON structures
- **Batch Queries**: Query multiple entities simultaneously
- **Graph Integration**: Results automatically added to Graph Mode visualization
- **Rich Provenance**: Tracks data sources and publications
- **Deduplication**: Prevents duplicate nodes and edges
- **Real-time Updates**: UI refreshes automatically after queries

## Installation

```bash
cd custom-mcp-servers/graphModeMCPs/graphmodeBTEMCP
npm install
npm run build
```

## Configuration

The MCP is configured in `backend-mcp-client/config/mcp_server_config.json`:

```json
"graphmode-bte-mcp": {
  "command": "node",
  "args": ["../custom-mcp-servers/graphModeMCPs/graphmodeBTEMCP/dist/index.js"],
  "timeout": 60000,
  "env": {
    "API_BASE_URL": "http://localhost:3001",
    "NODE_ENV": "development"
  }
}
```

## Usage

### Basic Query: Find Diseases for a Variant

```typescript
// User prompt: "Find diseases associated with variant DBSNP:rs121913521"

// MCP constructs TRAPI query:
{
  "query_graph": {
    "nodes": {
      "n0": {
        "ids": ["DBSNP:rs121913521"],
        "categories": ["biolink:SequenceVariant"]
      },
      "n1": {
        "categories": ["biolink:Disease"]
      }
    },
    "edges": {
      "e1": {
        "subject": "n0",
        "object": "n1"
      }
    }
  }
}
```

### Batch Query: Find Drugs for Multiple Genes

```typescript
// User prompt: "Find drugs that target genes NCBIGene:695 and NCBIGene:1956"

{
  "query_graph": {
    "nodes": {
      "n0": {
        "ids": ["NCBIGene:695", "NCBIGene:1956"],
        "categories": ["biolink:Gene"]
      },
      "n1": {
        "categories": ["biolink:ChemicalEntity"]
      }
    },
    "edges": {
      "e1": {
        "subject": "n1",
        "object": "n0",
        "predicates": ["biolink:affects"]
      }
    }
  }
}
```

### Complex Query: Gene-Protein-Disease Path

```typescript
// User prompt: "Find diseases connected to gene NCBIGene:1956 through proteins"

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

## Tool: `query_bte`

### Input Schema

```json
{
  "query_graph": {
    "nodes": {
      "node_id": {
        "ids": ["CURIE:123"],      // Optional: specific entities
        "categories": ["biolink:Type"]  // Required if no IDs
      }
    },
    "edges": {
      "edge_id": {
        "subject": "node_id",
        "object": "other_node_id",
        "predicates": ["biolink:predicate"]  // Optional
      }
    }
  },
  "databaseContext": {
    "conversationId": "string"  // Auto-injected by GraphMode
  }
}
```

### Response Format

```typescript
{
  content: [{
    type: "text",
    text: "✅ BTE Query Complete!\n\n**Results:**\n- Added X nodes\n- Added Y edges\n..."
  }],
  refreshGraph: true  // Triggers UI refresh
}
```

## Data Transformation

### Node Transformation

BTE TRAPI nodes are transformed to GraphMode format:

```typescript
{
  id: "MONDO:0011719",
  label: "Gastrointestinal stromal tumor",
  type: "Disease",
  data: {
    categories: ["biolink:Disease"],
    xrefs: ["DOID:9253", "OMIM:606764", ...],
    synonyms: ["GIST", "Plexosarcoma", ...],
    source: "bte"
  },
  position: { x: random, y: random }
}
```

### Edge Transformation

BTE TRAPI edges include full provenance:

```typescript
{
  source: "DBSNP:rs121913521",
  target: "MONDO:0011719",
  label: "related_to",
  data: {
    source: "bte",
    primary_source: "infores:clinvar",
    publications: ["PMID:12345", ...],
    knowledge_level: "knowledge_assertion",
    agent_type: "manual_agent",
    provenance: [
      { resource_id: "infores:clinvar", resource_role: "primary_knowledge_source" },
      { resource_id: "infores:myvariant-info", resource_role: "aggregator_knowledge_source" },
      { resource_id: "infores:biothings-explorer", resource_role: "aggregator_knowledge_source" }
    ]
  }
}
```

## Biolink Categories

Common categories supported by BTE:

- `biolink:Gene`
- `biolink:Protein`
- `biolink:ChemicalEntity` (drugs, compounds)
- `biolink:Disease`
- `biolink:PhenotypicFeature`
- `biolink:SequenceVariant`
- `biolink:Pathway`
- `biolink:BiologicalProcess`

## Common Predicates

- `biolink:related_to` - Generic relationship
- `biolink:affects` - Gene/drug affects target
- `biolink:treats` - Drug treats disease
- `biolink:associated_with` - Association between entities
- `biolink:participates_in` - Gene participates in pathway
- `biolink:causes` - Variant causes disease

## Example Use Cases

### 1. Variant-Disease Discovery
"What diseases are associated with this genetic variant?"

### 2. Drug Target Identification
"What genes does this drug target?"

### 3. Gene-Disease Pathways
"How is this gene connected to diseases?"

### 4. Drug Repurposing
"What drugs might treat diseases related to these genes?"

### 5. Multi-hop Reasoning
"Find drugs that affect proteins associated with genes linked to this disease"

## Testing

### Test with Example Query

```bash
# Restart backend server (to load new MCP)
cd backend-mcp-client
npm run dev

# In a Graph Mode conversation, use:
# "Find diseases for variant DBSNP:rs121913521"
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
- Verify CURIE format (e.g., `NCBIGene:695`, not `695`)
- Check BTE is accessible: `curl https://bte.transltr.io/v1/meta_knowledge_graph`
- Review logs in backend console

### Nodes Not Appearing in UI
- Check that `refreshGraph: true` is in response
- Verify nodes exist in database
- Check filter settings in UI (should default to showing all)

### Edges Not Connecting
- Ensure both source and target nodes exist
- Verify node IDs match exactly (case-sensitive)
- Check edge deduplication fields are populated

## API Reference

### BTE Endpoint
- **URL**: `https://bte.transltr.io/v1/query`
- **Method**: POST
- **Format**: TRAPI 1.5.0
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
Claude (constructs TRAPI query_graph)
    ↓
BTE MCP (query_bte tool)
    ↓
BTE API (https://bte.transltr.io/v1/query)
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

- **graphmode-translator**: Translator API integration (PK-based)
- **graphmode-pubtator-mcp**: PubTator entity extraction
- **graph-mode-mcp**: Base graph operations (remove, filter)

## Resources

- [BTE Documentation](https://biothings.io/explorer/)
- [TRAPI Specification](https://github.com/NCATSTranslator/ReasonerAPI)
- [Biolink Model](https://biolink.github.io/biolink-model/)
- [SmartAPI Registry](https://smart-api.info/)

## License

Part of the charm-mcp project.

