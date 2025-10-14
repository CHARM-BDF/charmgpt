# BTE GraphMode MCP - Testing Guide

## Quick Start Testing

### 1. Verify Installation

```bash
# Check that files are in place
ls -la custom-mcp-servers/graphModeMCPs/graphmodeBTEMCP/dist/index.js

# Should see: dist/index.js exists
```

### 2. Verify Configuration

```bash
# Check MCP is in config
grep -A 10 "graphmode-bte-mcp" backend-mcp-client/config/mcp_server_config.json
```

Expected output:
```json
"graphmode-bte-mcp": {
  "command": "node",
  "args": ["../custom-mcp-servers/graphModeMCPs/graphmodeBTEMCP/dist/index.js"],
  "timeout": 60000,
  "env": {
    "API_BASE_URL": "http://localhost:3001",
    "NODE_ENV": "development"
  },
  "description": "BioThings Explorer TRAPI query integration for Graph Mode"
}
```

### 3. Restart Backend Server

```bash
cd backend-mcp-client
npm run dev
```

Watch for log message:
```
[bte-mcp] BTE GraphMode MCP Server running on stdio
```

### 4. Test in Graph Mode

1. Open the application in your browser
2. Create a new **Graph Mode** conversation
3. Try these test queries:

## Test Cases

### Test 1: Simple Variant-to-Disease Query

**User Prompt:**
```
Find diseases associated with variant DBSNP:rs121913521
```

**Expected Claude Action:**
Claude should call the `query_bte` tool with:
```json
{
  "query_graph": {
    "nodes": {
      "n0": {
        "ids": ["DBSNP:rs121913521"],
        "categories": ["biolink:SequenceVariant"]
      },
      "n1": {
        "categories": ["biolink:Disease"]
      }
    },
    "edges": {
      "e1": {
        "subject": "n0",
        "object": "n1"
      }
    }
  }
}
```

**Expected Results:**
- ✅ 3 disease nodes added to graph
- ✅ 3 edges connecting variant to diseases
- ✅ Graph refreshes automatically
- ✅ Nodes include:
  - MONDO:0011719 (Gastrointestinal stromal tumor)
  - UMLS:C0027672 (Neoplastic Syndromes, Hereditary)
  - MONDO:0015356 (hereditary neoplastic syndrome)

**Verification:**
- Check Graph Mode UI shows new nodes and edges
- Hover over nodes to see labels
- Click on edges to see provenance (infores:clinvar)

### Test 2: Gene-to-Drug Query

**User Prompt:**
```
Find drugs that target the gene BTK (NCBIGene:695)
```

**Expected Query:**
```json
{
  "query_graph": {
    "nodes": {
      "n0": {
        "ids": ["NCBIGene:695"],
        "categories": ["biolink:Gene"]
      },
      "n1": {
        "categories": ["biolink:ChemicalEntity"]
      }
    },
    "edges": {
      "e1": {
        "subject": "n1",
        "object": "n0",
        "predicates": ["biolink:affects"]
      }
    }
  }
}
```

**Expected Results:**
- ✅ Multiple drug/compound nodes added
- ✅ Edges showing drug-gene relationships
- ✅ Graph updates with new connections

### Test 3: Batch Query

**User Prompt:**
```
Find diseases associated with genes NCBIGene:695 and NCBIGene:1956
```

**Expected Query:**
```json
{
  "query_graph": {
    "nodes": {
      "n0": {
        "ids": ["NCBIGene:695", "NCBIGene:1956"],
        "categories": ["biolink:Gene"]
      },
      "n1": {
        "categories": ["biolink:Disease"]
      }
    },
    "edges": {
      "e1": {
        "subject": "n0",
        "object": "n1"
      }
    }
  }
}
```

**Expected Results:**
- ✅ Multiple gene nodes
- ✅ Multiple disease nodes
- ✅ Edges connecting genes to diseases

### Test 4: Error Handling - Invalid CURIE

**User Prompt:**
```
Find diseases for variant INVALID:12345
```

**Expected Results:**
- ⚠️ BTE returns empty results or error
- ✅ MCP handles gracefully
- ✅ Returns message like "No results found" or "Query completed with 0 results"

## Database Verification

### Check Nodes Were Created

```sql
-- Connect to database
sqlite3 backend-mcp-client/prisma/dev.db

-- Find your conversation/graph ID
SELECT id, conversationId FROM graph_projects ORDER BY createdAt DESC LIMIT 5;

-- Check nodes (replace YOUR_GRAPH_ID)
SELECT id, label, type 
FROM graph_nodes 
WHERE graphId = 'YOUR_GRAPH_ID';
```

Expected output example:
```
DBSNP:rs121913521|chr4:g.54727447T>C|SequenceVariant
MONDO:0011719|Gastrointestinal stromal tumor|Disease
UMLS:C0027672|Neoplastic Syndromes, Hereditary|Disease
MONDO:0015356|hereditary neoplastic syndrome|Disease
```

### Check Edges Were Created

```sql
SELECT source, target, label 
FROM graph_edges 
WHERE graphId = 'YOUR_GRAPH_ID';
```

Expected output example:
```
DBSNP:rs121913521|MONDO:0011719|related_to
DBSNP:rs121913521|UMLS:C0027672|related_to
DBSNP:rs121913521|MONDO:0015356|related_to
```

### Check Edge Provenance

```sql
SELECT data 
FROM graph_edges 
WHERE graphId = 'YOUR_GRAPH_ID' 
LIMIT 1;
```

Should see JSON with:
- `source: "bte"`
- `primary_source: "infores:clinvar"`
- `publications: []` (array, may be empty)

## UI Verification

### Visual Checks

1. **Nodes Appear:**
   - Check graph canvas shows new nodes
   - Nodes should be labeled with entity names
   - Different node types have different colors/shapes

2. **Edges Connect:**
   - Lines connect source to target nodes
   - Edge labels show relationship types
   - Hovering shows edge details

3. **Filters Work:**
   - Entity type filters show new types (if any)
   - Node name filters include new nodes
   - Filters default to showing everything

4. **Manual Refresh:**
   - Click refresh button manually
   - Graph reloads with all nodes/edges intact

## Performance Testing

### Response Time

Typical BTE query should complete in:
- Simple query (1 hop): 1-3 seconds
- Complex query (2 hops): 3-10 seconds
- Batch query: 2-5 seconds

If queries take longer:
- Check network connection to BTE
- Verify BTE service status
- Check backend server logs for bottlenecks

### Large Result Sets

Test with queries that return many results:

**User Prompt:**
```
Find all drugs that affect the gene TP53 (NCBIGene:7157)
```

Should handle:
- 50+ nodes without issues
- 100+ edges without performance degradation
- Graph rendering stays responsive

## Troubleshooting

### MCP Not Found

**Symptom:** "Tool query_bte not found"

**Solutions:**
1. Verify build: `ls custom-mcp-servers/graphModeMCPs/graphmodeBTEMCP/dist/index.js`
2. Check config has `graphmode-bte-mcp` entry
3. Restart backend server
4. Check backend logs for MCP initialization errors

### No Results Returned

**Symptom:** "Query completed with 0 results"

**Solutions:**
1. Verify CURIE format is correct (e.g., `NCBIGene:695`, not `Gene:695`)
2. Check entity actually exists in BTE knowledge graph
3. Try simpler query first (e.g., just one entity type)
4. Check BTE API directly with curl

### Nodes Not Visible in UI

**Symptom:** Database has nodes but UI is empty

**Solutions:**
1. Check console for `refreshGraph: true` in MCP response
2. Verify filter settings (should default to showing all)
3. Check browser console for JavaScript errors
4. Try manual refresh button
5. Check graph project ID matches conversation ID

### Edges Missing

**Symptom:** Nodes exist but no connecting lines

**Solutions:**
1. Verify both source and target nodes exist in database
2. Check node IDs match exactly (case-sensitive)
3. Verify edge has `source`, `target`, and `label` fields
4. Check edge data has required fields (`source`, `primary_source`, `publications`)

### Backend Errors

**Symptom:** 500 errors from backend API

**Solutions:**
1. Check backend console logs
2. Verify Prisma database schema is correct
3. Check database file permissions
4. Restart backend server
5. Check for database corruption

## Advanced Testing

### Test Deduplication

1. Run same query twice
2. Check database - should not have duplicate nodes/edges
3. Verify counts don't increase on second query

### Test Provenance

1. Query BTE for variant-disease relationship
2. Check edge data includes full provenance chain:
   - Primary source (e.g., ClinVar)
   - Aggregator 1 (e.g., MyVariant)
   - Aggregator 2 (BioThings Explorer)

### Test Integration with Other MCPs

1. Add nodes via PubTator MCP
2. Query BTE for related entities
3. Verify graph combines data from both sources
4. Check no conflicts or duplicates

## Success Criteria Checklist

- [ ] MCP appears in available tools
- [ ] Simple variant-disease query works
- [ ] Gene-drug query works
- [ ] Batch query works
- [ ] Nodes appear in database
- [ ] Nodes appear in UI
- [ ] Edges appear in database
- [ ] Edges appear in UI
- [ ] Graph auto-refreshes after query
- [ ] Manual refresh button works
- [ ] Provenance data is complete
- [ ] Deduplication works (no duplicate nodes/edges)
- [ ] Error handling works gracefully
- [ ] Performance is acceptable (<10 seconds)
- [ ] Integration with existing graph works

## Known Limitations

1. **Timeout:** Queries timeout after 60 seconds
2. **Result Size:** Very large result sets (1000+ nodes) may slow UI
3. **BTE Availability:** Dependent on BTE service uptime
4. **CURIE Format:** Requires proper CURIE format (prefix:id)
5. **Categories:** Only Biolink-compliant categories supported

## Next Steps After Testing

Once basic testing passes:

1. **Test with real research queries** in your domain
2. **Document common query patterns** that work well
3. **Create query templates** for frequently used searches
4. **Integrate with other MCPs** (Translator, PubTator)
5. **Optimize for your specific use cases**

## Support

If you encounter issues:

1. Check this testing guide first
2. Review backend server logs
3. Check browser console for errors
4. Verify BTE API is accessible
5. Check database state with SQL queries
6. Review MCP implementation code

## References

- BTE API: https://bte.transltr.io/v1
- TRAPI Spec: https://github.com/NCATSTranslator/ReasonerAPI
- Biolink Model: https://biolink.github.io/biolink-model/
- GraphMode Guide: ../README.INFO.GraphModeMCPGuide.md

