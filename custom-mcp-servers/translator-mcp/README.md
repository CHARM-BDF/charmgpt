# Translator MCP Server

A Model Context Protocol (MCP) server that processes biomedical data from the NCATS Translator/ARS (Augmented Reasoning System) API. This server is the TypeScript/MCP equivalent of the Python script for processing Translator query results.

## Overview

This MCP server connects to the NCATS Translator ecosystem and processes complex biomedical knowledge graph queries. It takes a query primary key (PK) and returns structured relationship data, equivalent to the functionality provided by the Python Jupyter notebook script.

## Features

- **Query Processing**: Processes Translator/ARS queries by primary key (PK)
- **Multi-Environment Support**: Supports test, CI, dev, and prod environments
- **Data Structuring**: Converts complex knowledge graph results into structured rows
- **CSV Export**: Automatically generates CSV files for further analysis
- **Edge Processing**: Handles both one-hop and creative (multi-hop) edges
- **Phrase Generation**: Creates human-readable phrases from biomedical relationships
- **ARA Analysis**: Processes results from multiple Autonomous Reasoning Agents (ARAs)

## Installation

```bash
cd custom-mcp-servers/translator-mcp
npm install
npm run build
```

## Usage

The server provides one main tool:

### `process-translator-query`

Processes a Translator/ARS query and returns structured biomedical relationship data.

**Parameters:**
- `pk` (required): The primary key of the Translator query to process
- `environment` (optional): The environment to query (`test`, `CI`, `dev`, `prod`) - defaults to `prod`
- `save_csv` (optional): Whether to save results to CSV file - defaults to `true`
- `filename_prefix` (optional): Prefix for output filename - defaults to `"translator_results"`

**Example Usage:**
```json
{
  "pk": "992cc304-b1cd-4e9d-b317-f65effe150e1",
  "environment": "prod",
  "save_csv": true,
  "filename_prefix": "my_analysis"
}
```

## Data Processing

The server processes Translator query results through several stages:

1. **API Fetching**: Retrieves trace and merged data from the ARS API
2. **Knowledge Graph Parsing**: Extracts nodes, edges, and auxiliary graphs
3. **Result Processing**: Processes each result with scoring and node bindings
4. **Edge Analysis**: Analyzes edge bindings and processes support graphs
5. **Phrase Generation**: Creates human-readable descriptions of relationships
6. **Data Structuring**: Organizes data into structured rows for analysis

## Output Format

The server returns structured data with:

- **Result Information**: Rank, scores, and ARA contributions
- **Node Details**: Subject and object node information
- **Edge Information**: Predicates, qualifiers, and relationship types
- **Source Attribution**: Primary sources and aggregators
- **Human-Readable Phrases**: Natural language descriptions of relationships

## Environment URLs

- **prod**: `https://ars-prod.transltr.io`
- **dev**: `https://ars-dev.transltr.io` 
- **CI**: `https://ars.ci.transltr.io`
- **test**: `https://ars.test.transltr.io`

## Integration

This server integrates with the Translator ecosystem and can process queries from:

- **ARAX** (RTX-KG2)
- **Improving Agent**
- **BioThings Explorer**
- **Unsecret Agent**
- **Aragorn**

## Equivalent Python Functionality

This MCP server provides the same functionality as the Python script with functions:

- `run_on_click()` → `processTranslatorData()`
- `get_edge()` → `getEdge()`
- `recombobulation()` → `recombobulation()`
- `save_file()` → `saveToCSV()`

## Error Handling

The server includes comprehensive error handling for:

- API connectivity issues
- Invalid or missing PK values
- Empty result sets
- Network timeouts
- Data processing errors

## Development

To run in development mode:

```bash
npm run dev
```

The server uses TypeScript and includes full type definitions for the Translator API response structure. 