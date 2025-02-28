# mediKanren MCP Server

A Model Context Protocol (MCP) server that interfaces with the mediKanren API, allowing AI models to query the mediKanren knowledge graph for biomedical relationships and retrieve PubMed abstracts.

## Features

- Run 1-hop queries in the mediKanren knowledge graph
- Retrieve PubMed abstracts by ID
- Generate knowledge graph artifacts for visualization
- Format query results into human-readable text
- Comprehensive error handling and logging

## Installation

```bash
# Clone the repository
git clone <repository-url>

# Navigate to the project directory
cd medik-mcp

# Install dependencies
npm install

# Build the TypeScript code
npm run build
```

## Usage

The server exposes two main tools:

### 1. run-query

Executes a 1-hop query in the mediKanren knowledge graph and returns both human-readable text and a knowledge graph artifact.

**Parameters:**
- `e1`: Direction (X->Known for subject unknown or Known->X for object unknown)
- `e2`: Biolink predicate (e.g., biolink:treats, biolink:regulates, biolink:causes)
- `e3`: CURIE (e.g., MONDO:0011719)

**Example:**
```json
{
  "e1": "X->Known",
  "e2": "biolink:treats",
  "e3": "MONDO:0011719"
}
```

**Response:**
The response includes:
1. Human-readable text describing the relationships found
2. A knowledge graph artifact that can be visualized by compatible clients

### 2. get-pubmed-abstract

Retrieves a PubMed abstract by ID.

**Parameters:**
- `pubmed_id`: PubMed or PMC ID (e.g., PMID:12345678 or PMC:12345678)

**Example:**
```json
{
  "pubmed_id": "PMID:12345678"
}
```

## Running the Server

```bash
# Start the server
npm start
```

## Development

```bash
# Watch for changes and rebuild automatically
npm run dev
```

## Knowledge Graph Artifacts

The server generates knowledge graph artifacts for query results, which include:

- **Nodes**: Entities such as drugs, diseases, genes, etc.
- **Links**: Relationships between entities
- **Metadata**: Entity types, relationship types, and evidence

The knowledge graph is formatted as a JSON object with the following structure:

```json
{
  "nodes": [
    {
      "id": "DRUGBANK:DB12345",
      "name": "Drug Name",
      "group": 1,
      "entityType": "Drug",
      "val": 10
    },
    ...
  ],
  "links": [
    {
      "source": "DRUGBANK:DB12345",
      "target": "MONDO:0011719",
      "label": "treats",
      "evidence": ["PMID:12345678"]
    },
    ...
  ]
}
```

## API Endpoints

The mediKanren API has two main endpoints:

1. `/query` - POST endpoint for running 1-hop queries
2. `/pubmed` - POST endpoint for retrieving PubMed abstracts

## Response Formats

### Query Response

Success response includes:
- Human-readable text describing the relationships
- Knowledge graph artifact for visualization

Error response:
```json
{
  "error": "Error message"
}
```

### PubMed Abstract Response

Success response:
```json
{
  "title": "Article title",
  "abstract": "Article abstract"
}
```

Error response:
```json
{
  "error": "Error message"
}
```

## License

ISC 