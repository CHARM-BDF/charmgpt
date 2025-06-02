# ARAX MCP Server - Working Configuration Guide

## Overview
This document captures the **working configuration** for the ARAX MCP Server, for both connecting path queries and single entity queries between biomedical entities.

## ✅ What Works: Both Query Types

### 1. Connecting Path Queries ✅
The ARAX MCP server successfully handles **connecting path queries** between two specific entities using CURIE identifiers.

**Input Format:**
```json
{
  "entity_a": "NCBIGene:283635",
  "entity_b": "NCBIGene:28514"
}
```

**Results:**
- **Direct ARAX API**: 49 nodes, 278 edges returned
- **Response Time**: Fast (< 5 seconds for direct API calls)
- **Status**: Success

### 2. Single Entity Queries ✅ 
The ARAX MCP server successfully handles **single entity queries** to find what a specific entity affects or connects to.

**Input Format:**
```json
{
  "entity": "NCBIGene:283635"
}
```

**Results:**
- **Direct ARAX API**: 337 nodes, 904 edges returned
- **Response Time**: 20.5 seconds (well under MCP timeout)
- **Status**: Success

### CURIE Format Requirements
✅ **Use CURIE identifiers**, not gene symbols:
- ✅ `NCBIGene:283635` (works)
- ❌ `FAM177A1` (gene symbol - doesn't work reliably)

### Working Query Structures

#### For Connecting Path Queries
```json
{
  "message": {
    "query_graph": {
      "nodes": {
        "n0": { "ids": ["NCBIGene:283635"] },
        "n1": { "ids": ["NCBIGene:28514"] }
      },
      "paths": {
        "p0": {
          "subject": "n0",
          "object": "n1",
          "predicates": ["biolink:related_to"]
        }
      }
    }
  },
  "submitter": "ARAX MCP Server",
  "stream_progress": false,
  "query_options": {
    "kp_timeout": "30",
    "prune_threshold": "50"
  }
}
```

#### For Single Entity Queries (OPTIMAL FORMAT)
```json
{
  "message": {
    "query_graph": {
      "edges": {
        "e0": {
          "subject": "n0",
          "object": "n1"
        }
      },
      "nodes": {
        "n0": {
          "ids": ["NCBIGene:283635"],
          "categories": ["biolink:Gene"],
          "is_set": false,
          "name": "FAM177A1"
        },
        "n1": {
          "categories": [
            "biolink:Disease",
            "biolink:Drug",
            "biolink:Gene",
            "biolink:Protein"
          ],
          "is_set": false
        }
      }
    }
  },
  "submitter": "ARAX MCP Server",
  "stream_progress": false,
  "query_options": {
    "kp_timeout": "30",
    "prune_threshold": "50"
  }
}
```

## 🔧 MCP Tool Configuration

### Available Tools
1. **`find-connecting-path`** ✅ (WORKING)
   - Connects two specific entities
   - Uses `paths` structure
   - Fast performance (~5 seconds direct API)
   - Reliable results

2. **`query-entity-effects`** ✅ (WORKING - Updated Format)
   - Single entity with focused categories  
   - Uses `edges` structure with no predicates
   - Fast performance (20.5 seconds - under MCP timeout)
   - Focused, relevant results

3. **`custom-query`** ⚠️ (UNTESTED)
   - Custom predicates and categories

### Server Configuration
```json
{
  "arax-mcp": {
    "command": "node",
    "args": [
      "./custom-mcp-servers/arax-mcp/dist/index.js"
    ],
    "timeout": 120000
  }
}
```

## ⚠️ Known Issues

### MCP SDK Timeout (Resolved for Optimized Queries)
- **Problem**: Hardcoded 60-second timeout in `@modelcontextprotocol/sdk`
- **Location**: `node_modules/@modelcontextprotocol/sdk/src/shared/protocol.ts:591`
- **Status**: **RESOLVED** - Optimized queries complete in 20-45 seconds
- **Solution**: Use the optimal formats documented above

### Error Signature (Historical)
```
McpError: MCP error -32001: Request timed out
  at Timeout.timeoutHandler (/path/to/protocol.ts:591:43)
```

## 🧪 Testing Results

### Direct ARAX API Results

#### Connecting Path Query (Working)
```bash
# Test: NCBIGene:283635 → NCBIGene:28514
✅ Response status: 200
✅ Success! Got 49 nodes
✅ Got 278 edges
✅ Time: ~5 seconds
✅ Status: Success
```

#### Single Entity Query - Optimal Format (Working)
```bash
# Test: NCBIGene:283635 → Disease/Drug/Gene/Protein
✅ Response status: 200
✅ Success! Got 337 nodes  
✅ Got 904 edges
✅ Time: 20.5 seconds
✅ Status: Success
```

### Performance Comparison: Single Entity Queries

| Format | Time | Nodes | Edges | Entity Types | Status |
|--------|------|-------|-------|--------------|--------|
| **Optimal (with categories)** | **20.5s** | **337** | **904** | **9 diverse** | ✅ **Best** |
| No categories | 45.2s | 501 | 4,275 | 1 (too broad) | ⚠️ Slower |
| Previous paths format | 60s+ | - | - | - | ❌ Timeout |

## 📚 Entity Type Examples

### Supported CURIE Formats
- **Genes**: `NCBIGene:283635`, `NCBIGene:28514`
- **Drugs**: `DRUGBANK:DB00001`
- **Diseases**: `MONDO:0000001`
- **Proteins**: `UniProtKB:P12345`

### Entity Classification
The server automatically classifies entities:
- **Gene**: Group 1 (Green)
- **Drug**: Group 2 (Blue) 
- **Disease**: Group 3 (Red)
- **Protein**: Group 4 (Purple)
- **Pathway**: Group 5 (Orange)
- **Other**: Group 6 (Gray)

### Single Entity Query Results (Optimal Format)
Example entity types returned for `NCBIGene:283635`:
```json
{
  "biolink:Gene": 138,
  "biolink:BiologicalEntity": 78,
  "biolink:NamedThing": 59,
  "biolink:PhenotypicFeature": 33,
  "biolink:Disease": 19,
  "biolink:Protein": 7,
  "biolink:ChemicalEntity": 1,
  "biolink:DiseaseOrPhenotypicFeature": 1,
  "biolink:BehavioralFeature": 1
}
```

## 🎯 Recommended Usage

### For Connecting Path Queries
```javascript
const query = {
  tool: "arax-mcp-find-connecting-path",
  input: {
    entity_a: "NCBIGene:283635",  // Use CURIEs
    entity_b: "NCBIGene:28514"    // Use CURIEs
  }
};
```

### For Single Entity Queries  
```javascript
const query = {
  tool: "arax-mcp-query-entity-effects",
  input: {
    entity: "NCBIGene:283635"  // Use CURIE format
  }
};
```

### Knowledge Graph Output Format
The server returns medik-mcp2 compatible format:
```json
{
  "nodes": [
    {
      "id": "NCBIGene:283635",
      "name": "FAM177A1",
      "entityType": "Gene",
      "group": 1,
      "isStartingNode": true,
      "val": 10,
      "connections": 5
    }
  ],
  "links": [
    {
      "source": "NCBIGene:283635",
      "target": "NCBIGene:28514",
      "label": "biolink:related_to",
      "value": 0.95,
      "evidence": ["ARAX:123"]
    }
  ],
  "filteredCount": 0,
  "filteredNodeCount": 0
}
```

## 🔍 Debug Information

### Successful Query Logs
```
[INFO] Executing connecting path query
[INFO] entity_a: {id: "NCBIGene:283635"}
[INFO] entity_b: {id: "NCBIGene:28514"}
[INFO] ARAX response received
[INFO] status: Success, total_results: 49
```

### Performance Metrics
```
[INFO] Single entity query completed
[INFO] Time: 20.5 seconds
[INFO] Nodes: 337, Edges: 904
[INFO] Entity types: 9 diverse categories
```

## 📝 Development Notes

### Working Configuration History
- **Query Structure**: 
  - Connecting paths: Use `paths` format with `biolink:related_to`
  - Single entity: Use `edges` format with **NO predicates**
- **Node Format**: 
  - Source: Complete with `ids`, `categories`, `is_set`, `name`
  - Target: Minimal with focused `categories` and `is_set: false`
- **Categories**: **Essential for performance** - focused categories are 2x faster
- **Streaming**: Disabled (`stream_progress: false`) for reliable JSON parsing

### Performance Optimization Discoveries
- **Single Entity Queries**: 20.5 seconds (optimal format)
- **Connecting Path Queries**: ~5 seconds  
- **Categories Impact**: With categories = 2x faster than without
- **MCP Compatibility**: Both formats complete well under 60-second timeout

## 🚀 Quick Start

1. **Install and build**:
   ```bash
   cd custom-mcp-servers/arax-mcp
   npm install
   npm run build
   ```

2. **Test optimal formats**:
   ```bash
   # Test connecting path (fast)
   node -e "/* Use paths format */"
   
   # Test single entity (optimized)  
   node -e "/* Use edges format with categories */"
   ```

3. **Use through MCP** (production ready):
   ```bash
   # Both query types work reliably under MCP timeout
   # query-entity-effects: 20.5s < 60s timeout ✅
   # find-connecting-path: ~5s < 60s timeout ✅
   ```

---

**Last Updated**: 2025-06-02  
**Status**: ✅ **Both query types working reliably** - Optimal formats discovered and tested 