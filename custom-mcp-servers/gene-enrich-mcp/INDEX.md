# Gene Enrichment MCP

**TRAPI 1.5.0 Knowledge Provider for Gene-List Network Enrichment Analysis**

## Quick Access

- **📁 Location**: `custom-mcp-servers/gene-enrich-mcp/`
- **🔧 Config**: `src/config/mcp_server_config.json` → `gene-enrichment`
- **📚 Documentation**: [README.md](./README.md) | [QUICK_REFERENCE.md](./QUICK_REFERENCE.md)

## Tools Available

| Tool | Purpose | Key Parameters |
|------|---------|----------------|
| `get-gene-enrichment-meta-kg` | Get service capabilities | `include_attributes` |
| `query-gene-enrichment` | Analyze gene lists for enrichment | `gene_ids`, `pvalue_threshold` |

## Service Details

- **API**: GeLiNEA (Gene-List Network Enrichment Analysis)
- **Standard**: TRAPI 1.5.0
- **Endpoint**: `https://translator.broadinstitute.org/gelinea-trapi/v1.5`
- **Max Genes**: 2500 per request
- **Auth**: None (public service)

## Example Usage

```json
{
  "name": "query-gene-enrichment",
  "arguments": {
    "gene_ids": ["NCBIGene:695", "NCBIGene:2023", "NCBIGene:5315"],
    "pvalue_threshold": 0.05
  }
}
```

## Key Features

- ✅ **Gene Enrichment Analysis** - Functional pathway analysis
- ✅ **TRAPI 1.5.0 Compliant** - Full standard support
- ✅ **Statistical Analysis** - P-value thresholding
- ✅ **Batch Processing** - Up to 2500 genes
- ✅ **Multiple Environments** - Test/staging/production
- ✅ **Meta Knowledge Graph** - Service discovery

## Status

- **Implementation**: ✅ Complete
- **Testing**: ✅ Passed
- **Configuration**: ✅ Added to mcp_server_config.json
- **Documentation**: ✅ Complete

## Related MCPs

- [Annotation Service](../annotation-mcp/) - Gene annotation
- [Microbiome KP](../microbiome-mcp/) - Microbiome data
- [Translator3 MCP](../translator3-mcp/) - General TRAPI queries