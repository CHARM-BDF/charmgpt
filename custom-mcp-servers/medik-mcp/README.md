# mediKanren MCP Server

A Model Context Protocol (MCP) server that interfaces with the mediKanren API, allowing AI models to query the mediKanren knowledge graph for biomedical relationships and retrieve PubMed abstracts.

## Features

- Run 1-hop queries in the mediKanren knowledge graph
- Run comprehensive bidirectional queries to get all relationships for an entity
- Find potential connection pathways between two biomedical entities
- Analyze network neighborhoods for multiple genes or proteins
- Retrieve PubMed abstracts by ID
- Generate knowledge graph artifacts for visualization
- Format query results into human-readable text
- Comprehensive error handling and logging
- Interactive knowledge graph visualization
- Automatic filtering of CAID-prefixed nodes and transcribed_from edges
- Retry logic with 1-second delay between attempts

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

The server exposes the following main tools:

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

### 2. get-everything

Runs both X->Known and Known->X queries with biolink:related_to to get all relationships for a CURIE. This tool provides a comprehensive view of all entities related to the specified CURIE, combining both incoming and outgoing relationships.

**Parameters:**
- `curie`: A CURIE identifier (e.g., MONDO:0011719)

**Example:**
```json
{
  "curie": "MONDO:0011719"
}
```

**Response:**
The response includes:
1. Human-readable text describing all relationships found, with a note indicating this is a comprehensive bidirectional query
2. A knowledge graph artifact containing both incoming and outgoing relationships

**How it works:**
- Runs an X->Known query with biolink:related_to and the specified CURIE
- Runs a Known->X query with biolink:related_to and the specified CURIE
- Combines and deduplicates the results from both queries
- Formats the combined results into a comprehensive knowledge graph

### 3. network-neighborhood

Finds genes or proteins that are neighbors in the network and identifies common connection points between them.

**Parameters:**
- `curies`: Array of CURIEs (at least 2) representing genes or proteins

**Example:**
```json
{
  "curies": ["HGNC:3535", "HGNC:6407"]
}
```

**Response:**
The response includes:
1. Human-readable text describing the network connections found
2. A knowledge graph artifact that visualizes the network neighborhood with the requested genes/proteins highlighted

### 4. find-pathway

Analyzes and identifies potential connection pathways between two biomedical entities by exploring the knowledge graph and using LLM analysis to interpret the findings.

**Parameters:**
- `sourceCurie`: CURIE of the first entity (e.g., gene HGNC:1097)
- `targetCurie`: CURIE of the second entity (e.g., disease MONDO:0011719)
- `maxIterations`: Optional. Maximum number of exploration iterations (default: 3)
- `maxNodesPerIteration`: Optional. Number of candidate nodes to explore in each iteration (default: 5)

**Example:**
```json
{
  "sourceCurie": "HGNC:1097",
  "targetCurie": "MONDO:0011719"
}
```

**Response:**
The response includes:
1. Human-readable text describing the potential biological pathways connecting the entities
2. Analysis of relationships found in the neighborhoods of both entities
3. A knowledge graph artifact that visualizes the network connections between the source and target entities

**How it works:**
- Retrieves bidirectional neighborhood data for both the source and target entities
- Formats the combined data into a knowledge graph for visualization
- Uses an LLM to analyze the neighborhoods and identify potential biological pathways or mechanisms
- Returns both the LLM analysis and the interactive knowledge graph visualization

### 5. get-pubmed-abstract

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
- **Starting Nodes**: Special highlighting for query source entities

The knowledge graph is formatted as a JSON object with the following structure:

```json
{
  "nodes": [
    {
      "id": "DRUGBANK:DB12345",
      "name": "Drug Name",
      "group": 1,
      "entityType": "Drug",
      "val": 10,
      "isStartingNode": true
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

### Knowledge Graph Visualization Features

Different tools leverage knowledge graph artifacts in specific ways:

1. **run-query and get-everything**: Display simple 1-hop or bidirectional relationships
2. **network-neighborhood**: Highlights common nodes connecting multiple genes/proteins of interest
3. **find-pathway**: Visualizes the combined neighborhoods of two entities, highlighting potential connecting pathways

All knowledge graph visualizations support:
- Interactive node dragging and rearrangement
- Zoom and pan for exploring large graphs
- Hovering for detailed entity information
- Color-coding by entity type
- Node sizing based on connection count (more connected nodes appear larger)

### Pathway Analysis Visualization

For the find-pathway tool specifically:
- Source and target entities are highlighted as starting nodes
- Connections between neighborhoods are emphasized
- The accompanying LLM analysis provides context about biological mechanisms
- The visualization complements the text analysis by showing the actual network structure

## Node and Edge Filtering

The server automatically filters out certain nodes and edges to improve data quality:

### CAID Node Filtering

Nodes with the `CAID:` prefix are automatically removed from query results. This filtering:

- Removes any node with a CAID prefix identifier
- Removes any edge (relationship) that references a CAID-prefixed node
- Counts and logs the number of unique CAID nodes that were filtered
- Counts and logs the total number of relationships affected by filtering
- Adds a detailed note in the human-readable output about filtered nodes and relationships

CAID (Confidence Assertion ID) nodes often represent less reliable or less established relationships in the literature. Filtering these nodes helps ensure that only high-quality, well-established relationships are included in the knowledge graph.

### Transcribed_from Edge Filtering

Edges with the 'transcribed_from' predicate are automatically filtered out:

- Removes any edge where predicate === 'transcribed_from'
- Logs when such edges are filtered
- Updates the filtering summary in both logs and human-readable output
- Maintains transparency about filtered relationships

This filtering helps focus on more meaningful biological relationships by removing basic transcription relationships.

## Retry Logic

The server implements automatic retry logic for API requests:

- Maximum of 3 retry attempts for failed requests
- 1-second delay between retry attempts
- Detailed logging of each retry attempt
- Transparent error reporting if all retries fail

This retry mechanism helps handle temporary network issues or API instability.

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

## Version History

### v1.0.1
- Initial release with basic query, get-everything, and PubMed abstract functionality
- Knowledge graph visualization for query results
- Node filtering and error handling

### v1.0.2
- Added network-neighborhood tool for analyzing connections between multiple genes/proteins
- Enhanced knowledge graph visualization capabilities
- Improved error handling and logging

### v1.0.3 (Current)
- Added find-pathway tool with LLM-powered pathway analysis
- Enhanced find-pathway to include knowledge graph visualization
- Updated error handling to preserve visualization even when LLM analysis fails
- Added comprehensive documentation for all tools 