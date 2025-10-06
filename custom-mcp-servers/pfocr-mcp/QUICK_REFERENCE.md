# PFOCR MCP Quick Reference

## 🚀 Quick Start
```bash
cd custom-mcp-servers/pfocr-mcp/
npm install
npm run dev
```

## 🛠️ Available Tools

### 1. Search Pathways
**Tool:** `search-pfocr-pathways`
```json
{
  "query": "cancer signaling",
  "max_results": 10
}
```

### 2. Get Geneset Details
**Tool:** `get-pfocr-geneset`
```json
{
  "id": "PMC9278000__gr2_lrg"
}
```

### 3. Batch Get Multiple Genesets
**Tool:** `batch-pfocr-genesets`
```json
{
  "ids": ["PMC9278000__gr2_lrg", "PMC7835522__fcell-08-624216-g001"]
}
```

### 4. Get Database Metadata
**Tool:** `get-pfocr-metadata`
```json
{
  "include_fields": true
}
```

## 🔍 Common Query Examples

### Cancer Research
```json
{
  "query": "cancer pathway",
  "max_results": 20
}
```

### Metabolic Pathways
```json
{
  "query": "metabolism",
  "max_results": 15
}
```

### Signaling Pathways
```json
{
  "query": "signaling pathway",
  "max_results": 10
}
```

### Disease-Specific
```json
{
  "query": "diabetes pathway",
  "max_results": 10
}
```

## 📊 Response Structure

### Geneset Record
- `_id`: Unique geneset identifier
- `title`: Pathway figure title
- `description`: Pathway description
- `pmc`: PubMed Central ID
- `figureUrl`: Link to original figure
- `pfocrUrl`: PFOCR visualization URL
- `associatedWith.mentions`: Biomedical annotations
  - `genes.ncbigene`: NCBI Gene IDs
  - `chemicals.mesh`: MeSH chemical IDs
  - `chemicals.chebi`: ChEBI chemical IDs
  - `diseases.mesh`: MeSH disease IDs
  - `diseases.doid`: DOID disease IDs

## ⚙️ Configuration

### Environment Variables
```bash
# Optional: User email for usage tracking
PFOCR_USER_EMAIL=your-email@example.com

# Optional: Rate limiting (milliseconds)
PFOCR_RATE_LIMIT_MS=1000

# Optional: Request timeout (milliseconds)
PFOCR_TIMEOUT_MS=30000
```

## 🚨 Error Codes

- **404**: Geneset not found
- **400**: Invalid request parameters
- **413**: Batch size too large
- **429**: Rate limit exceeded
- **500**: Server error

## 💡 Tips

1. **Use specific search terms** for better results
2. **Start with small result sets** (10-20)
3. **Use batch queries** for multiple genesets
4. **Check metadata** to understand available fields
5. **Handle rate limits** with appropriate delays

## 🔗 Useful Links

- **PFOCR API**: https://biothings.ncats.io/pfocr
- **SmartAPI Registry**: https://smart-api.info/ui/edeb26858bd27d0322af93e7a9e08761
- **BioThings Docs**: https://docs.biothings.io/

## 📝 Example Workflow

1. **Search for pathways**: `search-pfocr-pathways` with your query
2. **Get specific details**: `get-pfocr-geneset` with geneset ID
3. **Batch process**: `batch-pfocr-genesets` for multiple genesets
4. **Check metadata**: `get-pfocr-metadata` for database info

## 🎯 Common Use Cases

- **Pathway Discovery**: Find pathways related to specific diseases
- **Gene Analysis**: Identify genes in specific pathways
- **Chemical Interactions**: Discover chemical-gene relationships
- **Literature Mining**: Access original papers through PMC IDs
- **Batch Analysis**: Process multiple pathway figures

---

**Need help?** Check the full README.md for detailed documentation! 🧬
