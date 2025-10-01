# TTD MCP

**BioThings Therapeutic Target Database API - drug-disease, target-disease, drug-protein target, and biomarker-disease associations**

## Quick Access

- **📁 Location**: `custom-mcp-servers/ttd-mcp/`
- **🔧 Config**: `src/config/mcp_server_config.json` → `ttd-api`
- **📚 Documentation**: [README.md](./README.md) | [QUICK_REFERENCE.md](./QUICK_REFERENCE.md)

## Tools Available

| Tool | Purpose | Key Parameters |
|------|---------|----------------|
| `query-ttd` | Query TTD database | `query`, `size`, `fields` |
| `get-ttd-association` | Get single association | `association_id` |
| `get-ttd-associations-batch` | Get multiple associations | `association_ids` |
| `get-ttd-metadata` | Get database metadata | - |
| `get-ttd-fields` | Get available fields | `search`, `prefix` |

## Service Details

- **API**: BioThings Therapeutic Target Database
- **Data Types**: Drug-disease, target-disease, drug-protein target, biomarker-disease
- **Endpoint**: `https://biothings.ncats.io/ttd`
- **Max Batch**: 1000 associations per request
- **Auth**: None (public service)

## Example Usage

```json
{
  "name": "query-ttd",
  "arguments": {
    "query": "object.mondo:0005083",
    "size": 20,
    "fields": "subject.name,object.name,association.predicate"
  }
}
```

## Key Features

- ✅ **Drug-Disease Associations** - Find drugs for diseases
- ✅ **Target-Disease Associations** - Identify protein targets
- ✅ **Drug-Target Interactions** - Discover binding relationships
- ✅ **Clinical Trial Data** - Access trial status and phases
- ✅ **Batch Processing** - Up to 1000 associations
- ✅ **Flexible Querying** - BioThings query syntax
- ✅ **Multiple Environments** - Production/test/staging

## Status

- **Implementation**: ✅ Complete
- **Testing**: ✅ Passed (303 results for diabetes query)
- **Configuration**: ✅ Added to mcp_server_config.json
- **Documentation**: ✅ Complete

## Related MCPs

- [Gene Enrichment](../gene-enrich-mcp/) - Gene enrichment analysis
- [Annotation Service](../annotation-mcp/) - Gene annotation
- [Microbiome KP](../microbiome-mcp/) - Microbiome data
- [Translator3 MCP](../translator3-mcp/) - General TRAPI queries