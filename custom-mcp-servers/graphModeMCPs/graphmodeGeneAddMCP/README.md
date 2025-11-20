# Graph Mode Gene Addition MCP

A Model Context Protocol (MCP) server for adding gene nodes to Graph Mode conversations using the ARAX API for gene normalization.

## Overview

This MCP provides a specialized tool for adding genes to knowledge graphs in Graph Mode conversations. It uses the ARAX API to normalize gene symbols to standardized CURIEs and adds them directly to the graph with proper metadata.

## Features

- **Bulk Gene Addition**: Add multiple genes at once
- **ARAX API Integration**: Uses ARAX API for gene normalization
- **Graph Mode Integration**: Directly adds nodes to Graph Mode conversations
- **Error Handling**: Comprehensive error reporting for failed additions
- **Priority Tool**: First choice for adding genes by symbol

## Available Tools

### addGeneNodes

Add one or more gene nodes to a Graph Mode conversation.

**Input:**
```json
{
  "geneNames": ["JUND", "FOS", "PON1"],
  "databaseContext": {
    "conversationId": "conv_abc123",
    "apiBaseUrl": "http://localhost:5001"
  }
}
```

**Output:**
```
✅ Added 3 gene nodes to the graph:

- **JUND** (NCBIGene:3727)
- **FOS** (NCBIGene:2353)
- **PON1** (NCBIGene:5444)
```

**Parameters:**
- `geneNames`: Single gene symbol (string) or array of gene symbols
- `databaseContext`: Graph Mode database context (auto-injected by backend)
  - `conversationId`: Required conversation ID
  - `apiBaseUrl`: Optional API base URL
  - `accessToken`: Optional access token

## Usage in Graph Mode

This tool is the **FIRST CHOICE** for adding genes when users request:
- "Add genes JUND, FOS, and PON1"
- "Add gene JUND to the graph"
- "Add these genes: [list]"

The tool will:
1. Query ARAX API to normalize gene symbols
2. Filter results to only include genes
3. Add each valid gene to the graph
4. Report success/failure for each gene
5. Refresh the graph display

## Node Data Format

Each gene node is added with the following structure:

```typescript
{
  id: "NCBIGene:3727",           // Normalized CURIE
  label: "JUND",                 // Gene symbol
  type: "Gene",                  // Node type
  data: {
    categories: ["biolink:Gene"],
    originalId: "NCBIGene:3727",
    source: "graphmode-gene-add-mcp",
    description: "JUND gene"
  },
  position: { x: 0, y: 0 }       // Layout coordinates
}
```

## Error Handling

The tool provides detailed feedback:
- ✅ Successfully added genes
- ⚠️ Failed to add genes (with error details)
- ⚠️ No identifiers found for invalid gene symbols

## Installation

1. Navigate to the MCP directory:
   ```bash
   cd custom-mcp-servers/graphModeMCPs/graphModeGeneAddMCP
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Build the MCP:
   ```bash
   ./build.sh
   ```

4. Test the server:
   ```bash
   npm start
   ```

## Configuration

Add to your MCP configuration:

```json
{
  "mcpServers": {
    "graphmode-gene-add": {
      "command": "node",
      "args": ["custom-mcp-servers/graphModeMCPs/graphModeGeneAddMCP/dist/index.js"],
      "env": {
        "API_BASE_URL": "http://localhost:5001"
      }
    }
  }
}
```

## Dependencies

- `@modelcontextprotocol/sdk`: MCP SDK
- `zod`: Schema validation
- `typescript`: TypeScript support

## Development

- **Source**: `src/index.ts`
- **Build Output**: `dist/index.js`
- **Configuration**: `tsconfig.json`
- **Build Script**: `build.sh`

## Priority

This tool is prioritized over other node addition tools when:
- User requests gene addition by symbol
- Entities are identified as genes
- Bulk gene addition is needed

Fallback to other tools (like `addNodeByName`) occurs when:
- This tool fails
- User explicitly requests different method
- Entities are not genes
