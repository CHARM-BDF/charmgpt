# mediKanren MCP Server Implementation Plan

## Overview

This document outlines the plan for creating a Model Context Protocol (MCP) server that interfaces with the mediKanren API. The server will allow AI models to query the mediKanren knowledge graph for biomedical relationships and retrieve PubMed abstracts.

## Project Goals

1. Create an MCP server that exposes mediKanren functionality to AI models
2. Implement two main tools:
   - `run-query`: Execute 1-hop queries in the mediKanren knowledge graph
   - `get-pubmed-abstract`: Retrieve PubMed abstracts by ID
3. Handle complex response formats and provide proper error handling
4. Include comprehensive logging for debugging

## Implementation Steps

### 1. Project Setup ✅

- [x] Create project directory structure
- [x] Initialize package.json with required dependencies
- [x] Configure TypeScript (tsconfig.json)
- [x] Set up build and run scripts

### 2. Core Server Implementation ✅

- [x] Import required MCP SDK components
- [x] Define server configuration and capabilities
- [x] Implement helper functions for API requests
- [x] Create validation schemas using Zod

### 3. Tool Implementation ✅

#### 3.1 Query Tool ✅

- [x] Define the `run-query` tool schema
- [x] Implement the query function
- [x] Handle and format query responses
- [x] Add error handling for query failures

#### 3.2 PubMed Abstract Tool ✅

- [x] Define the `get-pubmed-abstract` tool schema
- [x] Implement the PubMed abstract retrieval function
- [x] Format abstract responses
- [x] Add error handling for retrieval failures

### 4. Server Request Handlers ✅

- [x] Implement the ListToolsRequestSchema handler
- [x] Implement the CallToolRequestSchema handler
- [x] Add validation for tool arguments
- [x] Implement comprehensive error handling

### 5. Logging and Debugging ✅

- [x] Add logging for API requests and responses
- [x] Implement debug mode for detailed logging
- [x] Add error logging for troubleshooting
- [x] Include performance metrics where appropriate

### 6. Testing ✅

- [x] Test the `run-query` tool with various parameters
- [x] Test the `get-pubmed-abstract` tool with different PubMed IDs
- [x] Test error handling with invalid inputs
- [x] Verify response formatting

### 7. Documentation ✅

- [x] Document the server setup and configuration
- [x] Provide examples of tool usage
- [x] Document response formats
- [x] Include troubleshooting information

## Technical Details

### API Endpoints

The mediKanren API has two main endpoints:

1. `/query` - POST endpoint for running 1-hop queries
   - Parameters:
     - `e1`: Direction (X->Known or Known->X)
     - `e2`: Biolink predicate (e.g., biolink:treats)
     - `e3`: CURIE (e.g., MONDO:0011719)

2. `/pubmed` - POST endpoint for retrieving PubMed abstracts
   - Parameters:
     - `pubmed_id`: PubMed or PMC ID (e.g., PMID:12345678 or PMC:12345678)

### Response Formats

1. Query Response:
   - Success: Array of arrays containing strings, nested arrays, or objects
   - Error: Object with an error property

2. PubMed Abstract Response:
   - Success: Object with title and abstract properties
   - Error: Object with an error property

### Dependencies

- `@modelcontextprotocol/sdk`: For MCP server implementation
- `zod`: For input validation
- `node-fetch`: For making HTTP requests
- TypeScript and related development tools

## Progress Tracking

| Step | Status | Notes |
|------|--------|-------|
| Project Setup | Completed | Created directory structure, package.json, and tsconfig.json |
| Core Server Implementation | Completed | Implemented server configuration, API helpers, and validation schemas |
| Query Tool | Completed | Implemented the run-query tool with proper error handling |
| PubMed Abstract Tool | Completed | Implemented the get-pubmed-abstract tool with proper error handling |
| Server Request Handlers | Completed | Implemented handlers for listing tools and executing tool calls |
| Logging and Debugging | Completed | Added comprehensive logging for API requests and responses |
| Knowledge Graph Formatter | Completed | Added formatter to convert query results into human-readable text and knowledge graph artifacts |
| Testing | Completed | Successfully tested both tools with direct function calls and knowledge graph formatting |
| Documentation | Completed | Created README.md with usage instructions and examples |

## Next Steps

1. ✅ Set up the project directory and initialize dependencies
2. ✅ Implement the core server functionality
3. ✅ Add the query and PubMed abstract tools
4. ✅ Test with sample queries and PubMed IDs
5. ✅ Refine error handling and response formatting
6. ✅ Implement knowledge graph artifact generation
7. ✅ Complete documentation

## Final Status

The mediKanren MCP server implementation is now complete. All planned features have been successfully implemented and tested:

- Core server functionality with proper error handling and logging
- Two main tools: `run-query` and `get-pubmed-abstract`
- Knowledge graph artifact generation for visualization
- Human-readable text formatting for query results
- Comprehensive test scripts for validation
- Complete documentation

The server is ready for integration with the Charm MCP framework and can be used by AI models to query biomedical relationships and retrieve PubMed abstracts.

## References

- [mediKanren OpenAPI Specification](custom-mcp-servers/openapi-mcp-input/mediKanrenOpenAPI.yaml)
- [MCP SDK Documentation](https://github.com/modelcontextprotocol/sdk)
- [STRING-db MCP Server](custom-mcp-servers/string-db-mcp) (reference implementation) 