# Graph Mode MCPs

This directory contains Model Context Protocol (MCP) servers designed specifically for Graph Mode operations in the charm-mcp system.

## Directory Structure

```
graphModeMCPs/
├── README.md                    # This file - overview of Graph Mode MCPs
├── MCP_CONFIG_EXAMPLE.json      # Example configuration for all Graph Mode MCPs
│
└── graphmodeBaseMCP/            # Base MCP - Removal & Filtering Operations
    ├── src/                     # TypeScript source
    ├── dist/                    # Compiled JavaScript
    ├── package.json             # Dependencies
    ├── README.md                # Detailed documentation
    ├── QUICK_START.md           # Quick start guide
    ├── INTEGRATION_CHECKLIST.md # Integration steps
    └── IMPLEMENTATION_SUMMARY.md # Implementation details
```

## Available MCPs

### 1. graphmodeBaseMCP (✅ Complete)

**Purpose**: Core graph manipulation operations - removal and filtering

**Tools**:
- `removeNode` - Delete a node and connected edges
- `removeEdge` - Delete a specific edge
- `getGraphState` - Query graph with optional filtering

**Status**: ✅ Built and ready for integration

**Documentation**: See `graphmodeBaseMCP/README.md`

**Quick Start**:
```bash
cd graphmodeBaseMCP
npm install
npm run build
```

### 2. Future MCPs (Planned)

Additional MCPs for Graph Mode will be added here as separate subfolders:

- **graphmodeAnalyticsMCP** (Planned) - Graph analysis tools
  - Centrality analysis
  - Community detection
  - Path finding
  - Graph metrics

- **graphmodeBatchMCP** (Planned) - Batch operations
  - Bulk node/edge creation
  - Import from CSV/JSON
  - Export operations
  - Transform operations

- **graphmodeVisualizationMCP** (Planned) - Layout algorithms
  - Force-directed layout
  - Hierarchical layout
  - Circular layout
  - Custom positioning

## Why Separate MCPs?

Graph Mode operations are divided into multiple MCPs for:

1. **Modularity** - Each MCP has a focused purpose
2. **Maintainability** - Easier to update individual components
3. **Performance** - Load only needed functionality
4. **Flexibility** - Enable/disable specific capabilities
5. **Development** - Multiple team members can work independently

## Integration

To integrate Graph Mode MCPs into your system:

1. **Build the MCP**:
   ```bash
   cd graphmodeBaseMCP
   npm install && npm run build
   ```

2. **Add to MCP Config** (`backend-mcp-client/config/mcp_server_config.json`):
   ```json
   {
     "mcpServers": {
       "graph-mode-mcp": {
         "command": "node",
         "args": [
           "../custom-mcp-servers/graphModeMCPs/graphmodeBaseMCP/dist/index.js"
         ],
         "disabled": false,
         "env": {
           "API_BASE_URL": "http://localhost:5001",
           "NODE_ENV": "development"
         }
       }
     }
   }
   ```

3. **Update Backend** to pass database context (see integration docs)

4. **Test** with Graph Mode conversations

## Database Context Pattern

All Graph Mode MCPs follow a consistent pattern:

- **No graph state passed** - MCPs don't receive the current graph
- **Database context provided** - conversationId, apiBaseUrl, accessToken
- **API-based operations** - MCPs make HTTP calls to backend
- **Always fresh data** - No caching, always query database

This ensures:
- ✅ Scalability (no size limits)
- ✅ Consistency (single source of truth)
- ✅ Multi-user safety (database handles concurrency)
- ✅ Undo/redo support (full state history in DB)

## Development

### Adding a New Graph Mode MCP

1. **Create subfolder**: `mkdir graphmodeNewMCP`
2. **Copy structure** from `graphmodeBaseMCP`
3. **Update package.json** name to `@custom-mcp/graphmode-new`
4. **Implement tools** following the pattern
5. **Update this README** to list the new MCP
6. **Add to config** with unique server name

### Testing

Each MCP can be tested independently:

```bash
cd graphmodeBaseMCP
npm run dev  # Development mode with auto-reload
```

Or test integration end-to-end:

```bash
# Start backend
cd backend-mcp-client && npm run dev

# Use in Graph Mode conversation
# MCPs will be available as tools
```

## Related Documentation

- **Main Plan**: `/docs/cursor-plans/README.PLAN.Graphmode2.md`
- **MCP Plan**: `/docs/cursor-plans/README.PLAN.GraphMode.MCPs.md`
- **Backend API**: `/backend-mcp-client/src/routes/graph.ts`
- **Database Service**: `/backend-mcp-client/src/services/database.ts`
- **Frontend Viewer**: `/frontend-client/src/components/artifacts/GraphModeViewer.tsx`

## Contributing

When adding new Graph Mode MCPs:

1. Follow the database context pattern
2. Use TypeScript with Zod validation
3. Include comprehensive documentation
4. Add integration tests
5. Update this README

## Support

For issues or questions:
- Check individual MCP README files
- Review integration checklists
- Check backend logs for MCP errors
- Verify database connectivity

---

**Current Status**: ✅ graphmodeBaseMCP ready | ⏳ Additional MCPs planned

