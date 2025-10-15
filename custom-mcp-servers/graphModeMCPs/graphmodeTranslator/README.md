# Graph Mode Translator MCP

## Overview

The Graph Mode Translator MCP integrates with the NCATS Translator API to fetch and visualize knowledge graphs in Graph Mode. It processes Translator results including support graphs (creative edges), qualifiers, and publications to create comprehensive knowledge graph visualizations.

## Features

- **Translator API Integration**: Fetches knowledge graphs using Translator PK (Primary Key)
- **Environment Fallback**: Automatically tries prod → test → CI environments if fetching fails
- **Support Graphs**: Processes creative edges with recursive support graph handling
- **Qualifiers Processing**: Extracts and processes biolink qualifiers (qualified_predicate, direction, aspect, etc.)
- **Phrase Generation**: Creates human-readable phrases from edge qualifiers (recombobulation)
- **Publications**: Extracts and includes PubMed IDs from edge attributes
- **Graph Mode Format**: Converts Translator data to Graph Mode node/edge format
- **Database Integration**: Automatically saves nodes and edges to the graph database

## Tool: `fetchTranslatorGraph`

### Description
Fetch and process a Translator knowledge graph using a PK (primary key). Creates nodes and edges from Translator results including support graphs and qualifiers.

### Parameters

- **`pk`** (required): The Translator message PK to fetch
  - Example: `"992cc304-b1cd-4e9d-b317-f65effe150e1"`
  
- **`environment`** (optional): Translator environment to query
  - Options: `"prod"`, `"test"`, `"CI"`, `"dev"`
  - Default: `"prod"`
  - Note: Automatically falls back to other environments if fetching fails
  
- **`databaseContext`** (auto-injected): Graph Mode database context
  - Automatically provided by the backend

### Example Usage

In a Graph Mode conversation:

```
Please fetch the Translator graph with PK: 992cc304-b1cd-4e9d-b317-f65effe150e1
```

Or with a specific environment:

```
Fetch the Translator graph with PK: abc123def456 from the test environment
```

## Implementation Details

### Data Processing Pipeline

1. **Fetch**: Retrieves data from Translator API using PK
2. **Extract**: Extracts results, knowledge graph nodes/edges, and auxiliary graphs
3. **Process Results**: Loops through each result and its analyses
4. **Edge Processing**: For each edge binding:
   - Extracts edge data and qualifiers
   - Creates nodes for both source and target entities
   - Generates human-readable phrase
   - Extracts publications
   - Recursively processes support graphs (creative edges)
5. **Database**: Saves all nodes and edges to Graph Mode database
6. **UI Refresh**: Signals frontend to refresh graph visualization

### Node Format

```typescript
{
  id: "MONDO:0008029",           // Translator node ID
  label: "Bethlem myopathy",      // Node name
  type: "Disease",                // Category (without biolink: prefix)
  data: {
    categories: ["biolink:Disease"],
    originalId: "MONDO:0008029",
    source: "translator"
  },
  position: { x: 0, y: 0 }        // Frontend handles layout
}
```

### Edge Format

```typescript
{
  source: "CHEBI:37838",
  target: "MONDO:0008029",
  label: "related_to",
  data: {
    phrase: "carboacyl group causes increased abundance of Bethlem myopathy",
    publications: ["PMID:12345678", "PMID:87654321"],
    qualifiers: [...],
    source: "translator",
    edgeType: "creative",         // or "one-hop"
    qualified_predicate: "causes",
    object_direction_qualifier: "increased",
    object_aspect_qualifier: "abundance"
  }
}
```

### Qualifier Processing

The MCP processes the following biolink qualifiers:

- `qualified_predicate`: Main relationship type
- `object_direction_qualifier`: Direction of effect on object (increased/decreased)
- `subject_direction_qualifier`: Direction of effect on subject
- `object_aspect_qualifier`: Aspect of object affected (abundance, activity, etc.)
- `subject_aspect_qualifier`: Aspect of subject affected
- `object_form_or_variant_qualifier`: Form or variant of object
- `subject_form_or_variant_qualifier`: Form or variant of subject
- `causal_mechanism_qualifier`: Mechanism of causation

### Phrase Generation (Recombobulation)

The MCP includes logic ported from Python to generate human-readable phrases from qualifiers:

**Example 1: Simple predicate**
- Input: `BRCA1 related_to Cancer`
- Output: `"BRCA1 related to Cancer"`

**Example 2: With qualifiers**
- Input: `BRCA1 affects Cancer` with qualifiers:
  - qualified_predicate: "causes"
  - object_direction_qualifier: "increased"
  - object_aspect_qualifier: "abundance"
- Output: `"BRCA1 causes increased abundance of Cancer"`

**Example 3: Caused by**
- Input: `GeneX caused_by DrugY` with qualifiers:
  - subject_direction_qualifier: "decreased"
  - subject_aspect_qualifier: "activity"
- Output: `"decreased activity of DrugY is caused_by GeneX"`

## Configuration

The MCP is configured in `backend-mcp-client/config/mcp_server_config.json`:

```json
{
  "graphmode-translator": {
    "command": "node",
    "args": [
      "../custom-mcp-servers/graphModeMCPs/graphmodeTranslator/dist/index.js"
    ],
    "timeout": 120000,
    "env": {
      "API_BASE_URL": "http://localhost:3001",
      "NODE_ENV": "development"
    },
    "description": "Graph Mode Translator MCP - Imports knowledge graphs from Translator API using PK"
  }
}
```

## Development

### Building

```bash
cd custom-mcp-servers/graphModeMCPs/graphmodeTranslator
npm install
npm run build
```

### Development Mode

```bash
npm run dev  # Watch mode for TypeScript compilation
```

## Error Handling

The MCP includes comprehensive error handling:

- **Environment Fallback**: Tries multiple Translator environments
- **Missing Nodes**: Handles cases where edge references non-existent nodes
- **Invalid Data**: Gracefully handles malformed Translator responses
- **Database Errors**: Reports errors when saving nodes/edges fails

## Logging

The MCP logs important events to stderr:

- API requests and responses
- Environment fallback attempts
- Node and edge creation
- Processing statistics
- Error details

## Testing Checklist

- [ ] Tool appears in MCP tools list
- [ ] Tool accepts PK parameter
- [ ] Successfully fetches from Translator API
- [ ] Processes nodes and edges correctly
- [ ] Saves to database
- [ ] UI refreshes and displays graph
- [ ] Phrase generation works correctly
- [ ] Support graphs are processed recursively
- [ ] Both source and target nodes are created
- [ ] Publications are extracted and stored

## Known Translator PKs for Testing

You can test with these example PKs:

- Production: `992cc304-b1cd-4e9d-b317-f65effe150e1`
- (Add more as you test)

## Future Enhancements

- Add filtering options (e.g., max results, node types)
- Support for batching large graphs
- Caching of frequently accessed PKs
- Progress updates for large graphs
- Node positioning algorithms (circular, force-directed, etc.)

## Related MCPs

- **graphmodeBaseMCP**: Basic graph operations (remove nodes/edges, get state)
- **graphmodePubTatorMCP**: Add biomedical entities from PubTator

