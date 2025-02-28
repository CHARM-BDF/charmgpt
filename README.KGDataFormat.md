# Knowledge Graph Data Format

## Overview

This document describes the JSON data format used for knowledge graph visualization in the application. The knowledge graph visualization is powered by the `react-force-graph-2d` library and supports interactive, force-directed graph layouts.

## Basic Structure

The knowledge graph data follows this basic structure:

```json
{
  "nodes": [
    // Array of node objects
  ],
  "links": [
    // Array of link (edge) objects
  ]
}
```

## Node Properties

Each node in the `nodes` array represents an entity or concept in the graph and has the following properties:

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | string | Yes | Unique identifier for the node. Used to reference nodes in links. |
| `name` | string | Yes | Display name for the node. Shown when hovering over the node. |
| `group` | number | No | Group number for color coding. Nodes in the same group have similar colors. |
| `val` | number | No | Size value for the node. Larger values create bigger nodes. Default: 1 |
| `color` | string | No | Custom color for the node (e.g., "#ff0000"). Overrides group-based coloring. |

Additional custom properties can be added to nodes and will be preserved in the data structure, though they may not affect the visualization directly.

## Link Properties

Each link in the `links` array represents a relationship between two nodes and has the following properties:

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `source` | string | Yes | ID of the source node. Must match a node's `id`. |
| `target` | string | Yes | ID of the target node. Must match a node's `id`. |
| `value` | number | No | Link strength/width. Higher values create thicker links. Default: 1 |
| `label` | string | No | Relationship label. Displayed when hovering over the link. |
| `color` | string | No | Custom color for the link (e.g., "#0000ff"). Default: "#999" |

Additional custom properties can be added to links and will be preserved in the data structure.

## Example

Here's a simple example of a knowledge graph with three nodes and two links:

```json
{
  "nodes": [
    { "id": "node1", "name": "React", "group": 1, "val": 20 },
    { "id": "node2", "name": "TypeScript", "group": 1, "val": 18 },
    { "id": "node3", "name": "JavaScript", "group": 2, "val": 15 }
  ],
  "links": [
    { "source": "node1", "target": "node2", "value": 5, "label": "uses" },
    { "source": "node2", "target": "node3", "value": 6, "label": "superset of" }
  ]
}
```

## More Complex Example

Here's a more complex example showing various node and link properties:

```json
{
  "nodes": [
    { "id": "node1", "name": "React", "group": 1, "val": 20 },
    { "id": "node2", "name": "TypeScript", "group": 1, "val": 18 },
    { "id": "node3", "name": "JavaScript", "group": 1, "val": 15 },
    { "id": "node4", "name": "HTML", "group": 2, "val": 12 },
    { "id": "node5", "name": "CSS", "group": 2, "val": 12, "color": "#ff00ff" },
    { "id": "node6", "name": "Tailwind", "group": 2, "val": 10 }
  ],
  "links": [
    { "source": "node1", "target": "node2", "value": 5, "label": "uses" },
    { "source": "node1", "target": "node3", "value": 8, "label": "based on" },
    { "source": "node1", "target": "node4", "value": 3, "label": "renders", "color": "#ff0000" },
    { "source": "node2", "target": "node3", "value": 6, "label": "superset of" },
    { "source": "node4", "target": "node5", "value": 7, "label": "styled by" },
    { "source": "node5", "target": "node6", "value": 6, "label": "abstracted by" }
  ]
}
```

## Visualization Features

The knowledge graph visualization includes the following features:

- **Force-directed layout**: Nodes automatically position themselves based on their connections
- **Interactive navigation**: Zoom, pan, and drag capabilities
- **Node interaction**: Click on nodes to interact with them
- **Hover information**: Display node names and link labels on hover
- **Automatic coloring**: Nodes are colored based on their group property
- **Size variation**: Nodes can have different sizes based on their `val` property
- **Custom styling**: Override default colors for nodes and links

## Usage in the Application

### Supported Artifact Types

The application supports knowledge graph visualization for artifacts with the following types:

- `application/vnd.knowledge-graph`
- `application/vnd.ant.knowledge-graph`

### Creating a Knowledge Graph Artifact

To create a knowledge graph artifact, use the following structure:

```javascript
const knowledgeGraphArtifact = {
  id: "unique-id",
  artifactId: "unique-id",
  type: "application/vnd.knowledge-graph",
  title: "My Knowledge Graph",
  content: JSON.stringify(graphData), // graphData is your nodes and links object
  position: 1
};
```

### Testing

You can test knowledge graph visualization using the "Knowledge Graph Test" button in the Testing Tools menu (beaker icon in the header). This will create a sample knowledge graph artifact and display it in the ArtifactWindow.

## Technical Implementation

The knowledge graph visualization is implemented using:

- `KnowledgeGraphViewer.tsx`: The main component that renders the graph
- `react-force-graph-2d`: The underlying library for force-directed graph visualization
- `ArtifactContent.tsx`: Integration with the artifact display system

The implementation supports both viewing the rendered graph and the source JSON data through the "View Source" / "View Rendered" toggle in the artifact header. 