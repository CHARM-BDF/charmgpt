# ID Finder MCP Server

This is a Model Context Protocol (MCP) server that helps identify biomedical entities and find their standard identifiers using the ARAX API.

## Capabilities

This server can:

1. Determine the proper identifier (CURIE) for biomedical entities by querying the ARAX entity identifier API
2. Process multiple entities in a single request for efficient batch processing
3. Identify which terms match known biomedical entities and which don't

## How It Works

The server receives entity names and calls the ARAX API at `https://arax.ncats.io/api/arax/v1.4/entity` to normalize and identify these entities.

## Available Tools

The server provides one main tool:

**get-normalizer-info**: Get the normalized identifiers for one or more entities
```json
{
  "entities": "KIF1A"
}
```

or for multiple entities:
```json
{
  "entities": ["KIF1A", "DYRK1A", "Parkinson's disease"]
}
```

## Response Format

The tool returns a response that clearly indicates which terms were successfully identified and which terms could not be matched. For example:

```
We found the following matches: KIF1A (ID: NCBIGene:547, Type: biolink:Gene), DYRK1A (ID: NCBIGene:1859, Type: biolink:Gene) and these terms did not match any terms we have an ID for: diabetoes.
```

## Normalized Identifier Format

For each matched entity, the server returns the following standardized information:

```json
{
  "input": "kif1a",
  "category": "biolink:Gene",
  "curie": "NCBIGene:547", 
  "name": "KIF1A"
}
```

## Usage

To build and run the server:

```bash
npm install
npm run build
npm start
```

The server can then be connected to through MCP client applications. 