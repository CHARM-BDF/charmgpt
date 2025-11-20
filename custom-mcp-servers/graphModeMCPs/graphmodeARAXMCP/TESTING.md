# ARAX Pathfinder GraphMode MCP - Testing Guide

## Overview

This guide provides step-by-step instructions for testing the ARAX Pathfinder GraphMode MCP integration.

## Prerequisites

1. **Backend Server Running**
   ```bash
   cd backend-mcp-client
   npm run dev
   ```

2. **MCP Built Successfully**
   ```bash
   cd custom-mcp-servers/graphModeMCPs/graphmodeARAXMCP
   npm run build
   # Should create dist/index.js
   ```

3. **Configuration Updated**
   - MCP config added to `backend-mcp-client/config/mcp_server_config.json`
   - Server restarted to load new MCP

## Test Cases

### Test 1: Basic Pathfinder Query

**User Prompt:**
```
Find paths between Type 1 diabetes (MONDO:0005147) and gestational diabetes (MONDO:0005406)
```

**Expected Behavior:**
- MCP should call `pathfinder_query` tool
- ARAX API should be queried with pathfinder request
- Multiple intermediate nodes should be created
- Multiple paths should be found
- Graph should refresh automatically

**Verification:**
- Check database for new nodes and edges
- Verify nodes appear in Graph Mode UI
- Check that paths connect source to target

### Test 2: Gene-Disease Pathfinding

**User Prompt:**
```
Find paths from gene NCBIGene:1956 to diseases
```

**Expected Behavior:**
- MCP should construct pathfinder query
- Should find protein intermediates
- Should find disease targets
- Should create multiple paths

**Verification:**
- Verify gene node exists
- Verify protein intermediate nodes
- Verify disease target nodes
- Check path connections

### Test 3: Batch Pathfinding

**User Prompt:**
```
Find paths between genes NCBIGene:695, NCBIGene:1956 and diseases MONDO:0005147, MONDO:0005406
```

**Expected Behavior:**
- Should handle multiple source nodes
- Should handle multiple target nodes
- Should find paths between all combinations
- Should create comprehensive graph

**Verification:**
- Check all source genes are present
- Check all target diseases are present
- Verify multiple paths exist
- Check path diversity

### Test 4: Custom TRAPI Query

**User Prompt:**
```
Use ARAX to find genes connected to diseases through proteins
```

**Expected Behavior:**
- MCP should call `query_arax` tool
- Should construct complex TRAPI query
- Should find gene-protein-disease paths
- Should create multi-hop connections

**Verification:**
- Verify gene nodes
- Verify protein intermediate nodes
- Verify disease nodes
- Check multi-hop edge connections

### Test 5: Error Handling

**User Prompt:**
```
Find paths between invalid nodes XYZ:123 and ABC:456
```

**Expected Behavior:**
- Should handle invalid CURIEs gracefully
- Should return meaningful error message
- Should not crash the MCP
- Should provide helpful feedback

**Verification:**
- Check error message is user-friendly
- Verify MCP continues to work
- Check no partial data is created

## Database Verification

### Check Nodes Created

```sql
-- Check nodes were created
SELECT id, label, type, data->>'source' as source 
FROM graph_nodes 
WHERE graphId = 'your-conversation-id' 
AND data->>'source' = 'arax';
```

### Check Edges Created

```sql
-- Check edges were created
SELECT source, target, label, data->>'source' as source
FROM graph_edges 
WHERE graphId = 'your-conversation-id'
AND data->>'source' = 'arax';
```

### Check Path Structure

```sql
-- Check for path connections
SELECT 
  n1.label as source_label,
  e.label as relationship,
  n2.label as target_label
FROM graph_edges e
JOIN graph_nodes n1 ON e.source = n1.id
JOIN graph_nodes n2 ON e.target = n2.id
WHERE e.graphId = 'your-conversation-id'
AND e.data->>'source' = 'arax'
ORDER BY n1.label, n2.label;
```

## Troubleshooting

### MCP Not Appearing

1. **Check Build:**
   ```bash
   ls custom-mcp-servers/graphModeMCPs/graphmodeARAXMCP/dist/index.js
   ```

2. **Check Config:**
   ```bash
   grep -A 10 "graphmode-arax-mcp" backend-mcp-client/config/mcp_server_config.json
   ```

3. **Restart Backend:**
   ```bash
   cd backend-mcp-client
   npm run dev
   ```

### No Results Returned

1. **Check ARAX API:**
   ```bash
   curl -X POST "https://arax.ncats.io/api/arax/v1.4/query" \
     -H "Content-Type: application/json" \
     -d '{"message": {"query_graph": {"nodes": {"n0": {"ids": ["MONDO:0005147"]}, "n1": {"ids": ["MONDO:0005406"]}}, "edges": {"e0": {"subject": "n0", "object": "n1", "predicates": ["biolink:related_to"]}}}}, "query_options": {"kp_timeout": "30", "prune_threshold": "50", "max_pathfinder_paths": "100", "max_path_length": "4"}, "stream_progress": true, "submitter": "ARAX MCP"}'
   ```

2. **Check CURIE Format:**
   - Use proper format: `MONDO:0005147`
   - Not: `0005147` or `MONDO_0005147`

3. **Check Backend Logs:**
   - Look for error messages
   - Check API responses
   - Verify database connections

### Nodes Not Appearing in UI

1. **Check Database:**
   ```sql
   SELECT COUNT(*) FROM graph_nodes WHERE graphId = 'your-conversation-id';
   ```

2. **Check refreshGraph Flag:**
   - MCP should return `refreshGraph: true`
   - UI should refresh automatically

3. **Check Filter Settings:**
   - UI should show all nodes by default
   - Check if filters are hiding nodes

### Edges Not Connecting

1. **Check Both Endpoints:**
   ```sql
   SELECT source, target FROM graph_edges 
   WHERE graphId = 'your-conversation-id'
   AND data->>'source' = 'arax';
   ```

2. **Verify Node IDs:**
   - Source and target must exist
   - IDs must match exactly (case-sensitive)

3. **Check Edge Data:**
   ```sql
   SELECT source, target, label, data 
   FROM graph_edges 
   WHERE graphId = 'your-conversation-id'
   AND data->>'source' = 'arax'
   LIMIT 5;
   ```

## Performance Testing

### Large Pathfinder Query

**Test Query:**
```
Find paths between 5 genes and 5 diseases with max path length 6
```

**Expected:**
- Should handle large queries
- Should complete within timeout (120s)
- Should create many nodes and edges
- Should not crash

### Complex TRAPI Query

**Test Query:**
```
Find genes connected to diseases through proteins and pathways
```

**Expected:**
- Should handle complex query graph
- Should find multi-hop paths
- Should create rich knowledge graph

## Success Criteria

### ✅ Basic Functionality
- [ ] MCP appears in available tools
- [ ] Pathfinder queries work
- [ ] TRAPI queries work
- [ ] Nodes are created in database
- [ ] Edges are created in database
- [ ] UI refreshes automatically

### ✅ Data Quality
- [ ] Node labels are meaningful
- [ ] Node types are correct
- [ ] Edge relationships make sense
- [ ] Provenance data is preserved
- [ ] No duplicate nodes/edges

### ✅ Error Handling
- [ ] Invalid CURIEs handled gracefully
- [ ] API errors don't crash MCP
- [ ] Meaningful error messages
- [ ] Partial failures don't break everything

### ✅ Performance
- [ ] Simple queries complete quickly (< 10s)
- [ ] Complex queries complete within timeout
- [ ] Large result sets handled properly
- [ ] Memory usage is reasonable

## Example Test Session

1. **Start Backend:**
   ```bash
   cd backend-mcp-client
   npm run dev
   ```

2. **Create Graph Mode Conversation:**
   - Open frontend
   - Create new conversation
   - Enable Graph Mode

3. **Run Test Query:**
   ```
   Find paths between MONDO:0005147 and MONDO:0005406
   ```

4. **Verify Results:**
   - Check database for nodes/edges
   - Verify UI shows graph
   - Check path connections

5. **Run Additional Tests:**
   - Try different node types
   - Try batch queries
   - Try custom TRAPI queries
   - Test error conditions

## Reporting Issues

If you encounter issues:

1. **Collect Logs:**
   - Backend console output
   - Database queries
   - Network requests

2. **Document Steps:**
   - Exact user prompt
   - Expected vs actual behavior
   - Error messages

3. **Check Configuration:**
   - MCP config is correct
   - Build completed successfully
   - Dependencies installed

## Next Steps

After successful testing:

1. **Document Findings:**
   - Update README with real examples
   - Note any limitations discovered
   - Document performance characteristics

2. **Optimize if Needed:**
   - Adjust timeouts if necessary
   - Optimize queries for common use cases
   - Add error handling improvements

3. **User Training:**
   - Create user documentation
   - Provide example queries
   - Document best practices
