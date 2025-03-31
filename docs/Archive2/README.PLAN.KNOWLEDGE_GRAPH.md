# Knowledge Graph Visualization Implementation Plan

## Overview
This plan outlines the steps to add knowledge graph visualization capabilities to the ArtifactContent component using React-Force-Graph. The feature will allow displaying knowledge graph data in an interactive, force-directed graph visualization.

## Requirements
- Display knowledge graph data in an interactive visualization
- Support a specific data format for knowledge graphs
- Integrate seamlessly with the existing ArtifactContent component
- Maintain the existing view mode toggle functionality where appropriate
- Provide a convenient way to test the visualization

## Implementation Steps

### 1. Install Dependencies
- [x] Install React-Force-Graph package
- [x] Create custom type definitions for React-Force-Graph (official @types package not available)
- [x] Fix dependency issues by switching to react-force-graph-2d package

### 2. Create Knowledge Graph Component
- [x] Create a new component `KnowledgeGraphViewer.tsx` in the appropriate directory
- [x] Implement the component using React-Force-Graph
- [x] Add proper typing for the component props
- [x] Implement basic interactivity (zoom, pan, click)
- [x] Add styling consistent with the application

### 3. Define Knowledge Graph Data Format
- [x] Define the expected JSON structure for knowledge graph data
- [x] Create TypeScript interfaces for the data structure
- [x] Add validation/error handling for malformed data

### 4. Integrate with ArtifactContent Component
- [x] Add a new case in the switch statement for the knowledge graph type
- [x] Import and use the KnowledgeGraphViewer component
- [x] Pass the appropriate props from the artifact to the component
- [x] Handle any necessary data transformation

### 5. Add View Mode Toggle (if needed)
- [x] Determine if view mode toggle is needed for this artifact type
- [x] Add the type to the canToggleView check if needed
- [x] Implement source view for the knowledge graph data

### 6. Testing
- [x] Test with various knowledge graph data samples
- [x] Verify proper rendering and interactivity
- [x] Test error handling with malformed data
- [x] Verify integration with the rest of the application
- [x] Fix AFRAME dependency issue by switching to react-force-graph-2d

### 7. Documentation
- [x] Document the expected data format
- [x] Add comments to the code
- [x] Update any relevant documentation

### 8. Test Button Implementation
- [x] Create a KnowledgeGraphTestButton component
- [x] Implement direct display of the test graph in the ArtifactWindow
- [x] Add the test button to the UI in the Testing Tools menu
- [x] Use the chatStore to manage the test artifact

## Data Format (Implemented)
```json
{
  "nodes": [
    { "id": "node1", "name": "Concept 1", "group": 1, "val": 1, "color": "#ff0000" },
    { "id": "node2", "name": "Concept 2", "group": 2, "val": 2, "color": "#00ff00" }
  ],
  "links": [
    { "source": "node1", "target": "node2", "value": 1, "label": "relates to", "color": "#0000ff" }
  ]
}
```

## Usage Documentation

### Knowledge Graph Artifact Type
The system now supports two new artifact types:
- `application/vnd.knowledge-graph`
- `application/vnd.ant.knowledge-graph`

### Data Format
Knowledge graph artifacts should contain JSON data with the following structure:

```json
{
  "nodes": [
    {
      "id": "unique_id",        // Required: Unique identifier for the node
      "name": "Node Name",      // Required: Display name for the node
      "group": 1,               // Optional: Group number for color coding (default: none)
      "val": 10,                // Optional: Size value for the node (default: 1)
      "color": "#ff0000"        // Optional: Custom color (default: based on group)
    }
  ],
  "links": [
    {
      "source": "source_id",    // Required: ID of source node
      "target": "target_id",    // Required: ID of target node
      "value": 5,               // Optional: Link strength/width (default: 1)
      "label": "relates to",    // Optional: Relationship label (default: none)
      "color": "#0000ff"        // Optional: Custom link color (default: #999)
    }
  ]
}
```

### Features
- Interactive visualization with force-directed layout
- Zoom and pan capabilities
- Node click interaction (currently logs to console, can be extended)
- Automatic color coding based on node groups
- Responsive sizing based on container dimensions
- Toggle between rendered graph and source JSON view
- Test button for quick visualization testing

### Technical Notes
- Uses react-force-graph-2d instead of the full react-force-graph package to avoid A-Frame dependency issues
- The 2D version provides better compatibility and performance for most use cases

### Testing
- A test component has been created at `src/components/artifacts/KnowledgeGraphTestButton.tsx` that demonstrates:
  1. Direct usage of the KnowledgeGraphViewer component via the ArtifactContent component
  2. Integration with the chatStore for artifact management
- A sample knowledge graph dataset is available at `src/data/sample-knowledge-graph.json`
- A test button is available in the UI under the Testing Tools menu (beaker icon) that displays a sample knowledge graph directly in the ArtifactWindow

## Progress Tracking
- [x] Step 1: Install Dependencies - Completed (react-force-graph-2d installed, custom type definitions created)
- [x] Step 2: Create Knowledge Graph Component - Completed (KnowledgeGraphViewer.tsx created with proper typing and functionality)
- [x] Step 3: Define Knowledge Graph Data Format - Completed (Interfaces defined in KnowledgeGraphViewer.tsx)
- [x] Step 4: Integrate with ArtifactContent Component - Completed (Added new case for knowledge graph types)
- [x] Step 5: Add View Mode Toggle - Completed (Added knowledge graph types to canToggleView)
- [x] Step 6: Testing - Completed (Created test component and sample data, fixed AFRAME dependency issue)
- [x] Step 7: Documentation - Completed (Added documentation to this README)
- [x] Step 8: Test Button Implementation - Completed (Added test button to UI with direct display in ArtifactWindow) 