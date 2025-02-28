# mediKanren MCP Server

A Model Context Protocol (MCP) server that interfaces with the mediKanren API, allowing AI models to query the mediKanren knowledge graph for biomedical relationships and retrieve PubMed abstracts.

## Features

- Run 1-hop queries in the mediKanren knowledge graph
- Retrieve PubMed abstracts by ID
- Generate knowledge graph artifacts for visualization
- Format query results into human-readable text
- Comprehensive error handling and logging
- Interactive knowledge graph visualization

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

## Knowledge Graph Generation and Visualization

### Demo Script

The repository includes a demo script (`demo.js`) that:

1. Starts the mediKanren MCP server
2. Sends a query for treatments of gastrointestinal stromal tumor (GIST)
3. Extracts the knowledge graph artifact from the response
4. Cleans the data by removing publication evidence for simplicity
5. Saves the knowledge graph in two locations:
   - `src/data/medikanren-knowledge-graph.json` (for integration with the React app)
   - `knowledge-graph-viewer.json` (local copy for standalone viewer)

To run the demo script:

```bash
# Build the server first
npm run build

# Run the demo script to generate the knowledge graph
node --experimental-modules demo.js
```

### Visualization Components

#### React Integration

The project includes React components for integrating the knowledge graph visualization:

1. **KnowledgeGraphViewer**: Core component for rendering the knowledge graph using Force Graph
2. **KnowledgeGraphTestButton**: UI component that provides buttons to load either:
   - The original sample knowledge graph data
   - The mediKanren knowledge graph data (gastrointestinal stromal tumor treatments)
3. **KnowledgeGraphTest**: Test page showing both knowledge graphs side by side

The React components can be imported and used in your application:

```jsx
import KnowledgeGraphViewer from './components/artifacts/KnowledgeGraphViewer';
import medikanrenData from './data/medikanren-knowledge-graph.json';

function MyComponent() {
  return (
    <div className="h-[500px]">
      <KnowledgeGraphViewer data={medikanrenData} />
    </div>
  );
}
```

#### Standalone HTML Viewer

For quick visualization without the React app, a standalone HTML file (`graph-viewer.html`) is provided that:

1. Loads the knowledge graph data from `knowledge-graph-viewer.json`
2. Renders an interactive visualization using Force Graph
3. Displays basic statistics and information about the graph

To use the standalone viewer, open `graph-viewer.html` in a web browser after generating the knowledge graph data.

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