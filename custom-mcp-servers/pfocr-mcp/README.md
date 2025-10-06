# PFOCR MCP Server

**🎯 Purpose:** Model Context Protocol (MCP) server for integrating with BioThings PFOCR (Pathway Figure OCR) API - biomedical pathway data extracted from scientific literature figures.

**⚡ Time to First Working MCP:** ~5-10 minutes  
**📚 Based on:** SmartAPI standard + BioThings PFOCR API  
**🔧 Difficulty:** Beginner (public API, no authentication required)  
**🏥 Domain:** Biomedical research, pathway analysis, literature mining

## 🧬 What is PFOCR?

PFOCR (Pathway Figure OCR) is a database that extracts pathway information from scientific literature figures using optical character recognition (OCR) technology. It provides:

- **Pathway Figures**: Extracted from scientific papers
- **Gene Annotations**: Associated genes mentioned in figures
- **Chemical Annotations**: MeSH and ChEBI chemical identifiers
- **Disease Annotations**: MeSH and DOID disease identifiers
- **Literature Links**: PMC IDs and figure URLs

## 🚀 Quick Start

### 1. Installation
```bash
cd custom-mcp-servers/pfocr-mcp/
npm install
```

### 2. Configuration (Optional)
```bash
cp env.example .env
# Edit .env to set your email for usage tracking
```

### 3. Development
```bash
npm run dev
```

### 4. Production
```bash
npm run build
npm start
```

## 🛠️ Available Tools

### 1. `search-pfocr-pathways`
Search for pathway figures and associated biomedical data.

**Parameters:**
- `query` (required): Search terms (e.g., "cancer", "metabolism", "signaling")
- `max_results` (optional): Number of results (1-1000, default: 10)
- `fields` (optional): Fields to return (default: "all")
- `from` (optional): Pagination offset (default: 0)
- `sort` (optional): Sort fields
- `facets` (optional): Facet fields
- `fetch_all` (optional): Use scrolling for large result sets

**Example:**
```json
{
  "query": "cancer signaling pathway",
  "max_results": 20,
  "fields": "title,description,associatedWith"
}
```

### 2. `get-pfocr-geneset`
Get detailed information about a specific geneset.

**Parameters:**
- `id` (required): PFOCR geneset ID (e.g., "PMC9278000__gr2_lrg")
- `fields` (optional): Fields to return (default: "all")

**Example:**
```json
{
  "id": "PMC9278000__gr2_lrg",
  "fields": "all"
}
```

### 3. `batch-pfocr-genesets`
Retrieve multiple genesets in a single request.

**Parameters:**
- `ids` (required): Array of geneset IDs (max 1000)
- `fields` (optional): Fields to return (default: "all")

**Example:**
```json
{
  "ids": ["PMC9278000__gr2_lrg", "PMC7835522__fcell-08-624216-g001"],
  "fields": "title,associatedWith"
}
```

### 4. `get-pfocr-metadata`
Get database metadata and statistics.

**Parameters:**
- `include_fields` (optional): Include field information (default: false)

## 📊 Data Structure

### Geneset Record
```json
{
  "_id": "PMC9278000__gr2_lrg",
  "title": "Pathway Figure Title",
  "description": "Pathway description",
  "pmc": "PMC9278000",
  "figureUrl": "https://...",
  "pfocrUrl": "https://...",
  "associatedWith": {
    "mentions": {
      "genes": {
        "ncbigene": ["1234", "5678"]
      },
      "chemicals": {
        "mesh": ["C123456"],
        "chebi": ["CHEBI:12345"]
      },
      "diseases": {
        "mesh": ["D123456"],
        "doid": ["DOID:1234"]
      }
    }
  }
}
```

## 🔬 Use Cases

### 1. Pathway Discovery
Find pathway figures related to specific diseases or biological processes.

### 2. Gene-Disease Associations
Identify genes associated with specific diseases through pathway analysis.

### 3. Chemical-Gene Interactions
Discover chemical compounds that interact with specific genes in pathways.

### 4. Literature Mining
Access original scientific papers through PMC IDs and figure URLs.

### 5. Batch Analysis
Process multiple pathway figures for comprehensive analysis.

## 🧪 Example Queries

### Search for Cancer Pathways
```json
{
  "query": "cancer pathway",
  "max_results": 10
}
```

### Find Metabolic Pathways
```json
{
  "query": "metabolism",
  "max_results": 20,
  "sort": ["-score"]
}
```

### Get Specific Geneset
```json
{
  "id": "PMC9278000__gr2_lrg"
}
```

## 🔧 Configuration

### Environment Variables
- `PFOCR_USER_EMAIL`: Your email for usage tracking (optional)
- `PFOCR_API_KEY`: API key (currently not required)
- `PFOCR_RATE_LIMIT_MS`: Rate limiting delay (default: 1000ms)
- `PFOCR_TIMEOUT_MS`: Request timeout (default: 30000ms)

### Rate Limiting
The PFOCR API has rate limits. The MCP server includes built-in rate limiting with 1-second delays between requests.

## 📚 API Documentation

- **PFOCR API**: https://biothings.ncats.io/pfocr
- **SmartAPI Registry**: https://smart-api.info/ui/edeb26858bd27d0322af93e7a9e08761
- **BioThings Documentation**: https://docs.biothings.io/

## 🚨 Error Handling

The MCP server handles common API errors:
- **404**: Resource not found
- **400**: Invalid request parameters
- **413**: Payload too large
- **429**: Rate limit exceeded
- **500**: Internal server error

## 🎯 Best Practices

1. **Use specific queries** for better results
2. **Limit result sets** to avoid overwhelming responses
3. **Use batch queries** for multiple genesets
4. **Check metadata** to understand available fields
5. **Handle rate limits** appropriately

## 🔍 Troubleshooting

### Common Issues

1. **No results found**
   - Try broader search terms
   - Check spelling and terminology
   - Use different keywords

2. **Rate limiting**
   - Increase delay between requests
   - Use batch queries when possible
   - Implement retry logic

3. **Invalid geneset IDs**
   - Verify ID format (PMC####__gr#_lrg)
   - Check if geneset exists
   - Use search to find valid IDs

## 📈 Performance Tips

1. **Use pagination** for large result sets
2. **Specify fields** to reduce response size
3. **Use batch queries** for multiple genesets
4. **Cache results** when possible
5. **Monitor rate limits**

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

ISC License - see package.json for details.

## 🆘 Support

- **Issues**: Create an issue in the repository
- **Documentation**: Check the SmartAPI registry
- **API Support**: Contact BioThings team

---

**Ready to explore biomedical pathways?** Start with a simple search query and discover the wealth of pathway data available through PFOCR! 🧬🚀
