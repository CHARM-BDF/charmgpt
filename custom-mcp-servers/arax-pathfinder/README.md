# ARAX Pathfinder MCP Server

A specialized Model Context Protocol (MCP) server focused solely on finding connecting paths between biomedical entities using the NCATS ARAX knowledge graph.

## Overview

This server provides a single, optimized tool for discovering biomedical connections between two entities using the Automated Reasoning and Autonomous eXploration (ARAX) system from NCATS.

## Features

- **Single Focus**: Only connecting path queries between two entities
- **Fast Performance**: Optimized query format for quick results
- **CURIE Support**: Proper biomedical identifier format support
- **Compatible Output**: Matches medik-mcp2 knowledge graph format
- **Rich Text Responses**: Provides detailed text summaries with node/edge counts

## Available Tools

### `find-connecting-path`

Find connecting paths between two biomedical entities.

**Parameters:**
- `entity_a` (required): First entity in CURIE format (e.g., `NCBIGene:283635`)
- `entity_b` (required): Second entity in CURIE format (e.g., `NCBIGene:28514`) 
- `name_a` (optional): Human-readable name for first entity
- `name_b` (optional): Human-readable name for second entity

**Example:**
```json
{
  "entity_a": "NCBIGene:283635",
  "entity_b": "NCBIGene:28514",
  "name_a": "FAM177A1",
  "name_b": "IL1B"
}
```

## Response Format

The server returns both text summaries and knowledge graph data:

### Successful Response
```json
{
  "content": [
    {
      "type": "text",
      "text": "## ARAX Connecting Path Results\n\n**Query**: Finding connections between NCBIGene:283635 (FAM177A1) and NCBIGene:28514 (IL1B)\n\n**Status**: ✅ Success\n\n**Results**: \n- **49 nodes** found in the knowledge graph\n- **278 connections** between entities\n- **278 total relationships** discovered\n\nThe knowledge graph visualization shows all connecting paths..."
    }
  ],
  "artifacts": [
    {
      "name": "connecting-path-results",
      "type": "application/json",
      "content": "{\"nodes\":[...], \"links\":[...]}"
    }
  ]
}
```

### Error Response
```json
{
  "content": [
    {
      "type": "text", 
      "text": "## ARAX Connecting Path Results\n\n**Status**: ❌ Error\n\n**Error Details**: Invalid CURIE format\n\n**Recommendations**: - Verify CURIE format..."
    }
  ]
}
```

## Installation

```bash
cd custom-mcp-servers/arax-pathfinder
npm install
npm run build
```

## Usage

```bash
npm run start
```

## Query Format

Uses the optimized ARAX "paths" format:
- Fast execution (< 5 seconds typically)
- Broad `biolink:related_to` predicates
- Simple node structure with CURIE identifiers
- 30-second timeout with result pruning

## Output Format

### Text Content
- Query status (success/error)
- Node and edge counts
- Detailed error messages with recommendations
- Success confirmations

### Knowledge Graph Artifacts
- Nodes with entity types, groups, and connection counts
- Links with predicates, confidence scores, and evidence
- Compatible with existing UI components

## Performance

- **Response Time**: < 5 seconds for most queries
- **Result Size**: Automatically pruned to manageable sizes
- **Reliability**: Uses proven query format from original ARAX testing
- **Error Handling**: Comprehensive error messages with troubleshooting guidance

## Related

This is a focused extraction from the full `arax-mcp` server, containing only the connecting path functionality that works reliably and fast, enhanced with rich text responses similar to medik-mcp. 