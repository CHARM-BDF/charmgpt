# mediKanren Literature Search MCP

A focused Model Context Protocol (MCP) server that queries the mediKanren knowledge graph to find literature references related to biomedical entities.

## Features

- **CURIE-based queries**: Takes CURIE identifiers directly (no translation needed)
- **Bidirectional search**: Queries both directions (subject→object and object→subject)  
- **Literature extraction**: Extracts PMC/PMID references from mediKanren relationships
- **Evidence context**: Includes sentence-level evidence when available
- **Bibliography artifacts**: Returns structured bibliography data for frontend display

## Usage

### Tool: `search_literature`

Search for literature references related to a CURIE identifier.

**Parameters:**
- `curie` (required): CURIE identifier (e.g., "DRUGBANK:DB12411", "MONDO:0007254")
- `predicate` (optional): Biolink predicate filter (default: "biolink:treats")
- `maxResults` (optional): Maximum results to return (default: 50, max: 100)
- `includeEvidence` (optional): Include evidence sentences (default: true)

**Example Usage:**
```json
{
  "curie": "DRUGBANK:DB12411",
  "predicate": "biolink:treats",
  "maxResults": 25,
  "includeEvidence": true
}
```

## Data Flow

1. **Query mediKanren**: Makes bidirectional API calls to mediKanren
2. **Extract relationships**: Parses mediKanren tuple responses
3. **Extract literature**: Finds PMC/PMID references in relationship data
4. **Format bibliography**: Creates structured bibliography artifacts
5. **Return results**: Provides bibliography data for frontend display

## mediKanren Response Format

mediKanren returns tuples in this format:
```
[subject_curie, subject_name, predicate, object_curie, object_name, evidence, pmid_array]
```

Where:
- `evidence`: Object containing sentence context and scores
- `pmid_array`: Array of PMC/PMID identifiers

## Output

Returns a bibliography artifact with:
- Publication identifiers (PMC/PMID)
- Relationship context
- Evidence sentences
- Subject and object entity details
- Publication links

## Installation

```bash
npm install
npm run build
```

## Development

```bash
npm run dev
```

## Integration

Add to your MCP server configuration:

```json
{
  "medik-litsearch": {
    "command": "node",
    "args": ["./custom-mcp-servers/medik-litsearch-mcp/dist/index.js"]
  }
}
```

## Example Query

Query for literature about bemcentinib treating cancer:

```json
{
  "tool": "search_literature",
  "arguments": {
    "curie": "DRUGBANK:DB12411",
    "predicate": "biolink:treats",
    "maxResults": 10
  }
}
```

This will return bibliography entries for publications that describe relationships between bemcentinib and diseases it treats, with evidence sentences and publication links.
