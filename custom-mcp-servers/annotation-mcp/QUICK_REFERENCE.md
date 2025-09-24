# Annotation Service MCP - Quick Reference

## 🚀 Quick Start
```bash
cd custom-mcp-servers/annotation-mcp/
npm install && npm run build
npm run dev  # Test the MCP
```

## 🧬 Available Tools

### 1. `annotate-entity` - Single Entity Annotation
**Purpose:** Annotate one biomedical entity by curie ID

**Parameters:**
- `curie_id` (required): Entity ID (e.g., "NCBIGene:695")
- `raw` (optional): Return raw data (default: false)
- `fields` (optional): Specific fields or "all" (default: "all")

**Example:**
```json
{
  "curie_id": "NCBIGene:695",
  "raw": false,
  "fields": "all"
}
```

### 2. `annotate-entities-batch` - Batch Annotation
**Purpose:** Annotate multiple entities (up to 1000)

**Parameters:**
- `ids` (required): Comma-separated curie IDs
- `append` (optional): Append to existing data (default: false)

**Example:**
```json
{
  "ids": "NCBIGene:695,NCBIGene:1234,CHEBI:15365",
  "append": false
}
```

## 🧬 Supported Entity Types

| Prefix | Type | Example | Description |
|--------|------|---------|-------------|
| `NCBIGene` | Gene | `NCBIGene:695` | NCBI Gene database |
| `ENSEMBL` | Gene | `ENSEMBL:ENSG00000139618` | Ensembl gene IDs |
| `CHEBI` | Chemical | `CHEBI:15365` | Chemical entities |
| `DRUGBANK` | Drug | `DRUGBANK:DB00001` | DrugBank database |
| `MONDO` | Disease | `MONDO:0005148` | Disease ontology |
| `HP` | Phenotype | `HP:0000001` | Human phenotype |
| `PUBCHEM.COMPOUND` | Chemical | `PUBCHEM.COMPOUND:2244` | PubChem compounds |

## 📊 Response Format

### Text Response
- Entity name and description
- Categories and types
- Synonyms and aliases
- External references
- Usage instructions

### Artifact Response
- Structured JSON data
- Summary statistics
- Complete annotation information
- External references

## 🔧 Configuration

### MCP Client Setup
```json
{
  "annotation-service": {
    "command": "node",
    "args": ["./custom-mcp-servers/annotation-mcp/dist/index.js"],
    "timeout": 60000
  }
}
```

### Environment Variables (Optional)
```bash
USER_EMAIL=your.email@example.com
# ANNOTATION_BASE_URL=https://biothings.ncats.io/annotator
# ANNOTATION_TIMEOUT_MS=30000
```

## 🧪 Common Use Cases

### Gene List Enrichment
```bash
# Annotate a gene
annotate-entity curie_id="NCBIGene:672"  # BRCA1 gene

# Batch annotate genes
annotate-entities-batch ids="NCBIGene:672,NCBIGene:675,NCBIGene:677"
```

### Drug Discovery
```bash
# Annotate a chemical
annotate-entity curie_id="CHEBI:15365"  # Caffeine

# Batch annotate drugs
annotate-entities-batch ids="CHEBI:15365,CHEBI:15366,CHEBI:15367"
```

### Disease Analysis
```bash
# Annotate a disease
annotate-entity curie_id="MONDO:0005148"  # Type 2 diabetes

# Batch annotate diseases
annotate-entities-batch ids="MONDO:0005148,MONDO:0005149,MONDO:0005150"
```

## 🔍 Troubleshooting

### Common Errors
1. **"Invalid curie ID format"** - Check format: `PREFIX:ID`
2. **"Annotation not found"** - Entity may not exist in database
3. **"Too many IDs"** - Maximum 1000 IDs per batch request

### Debug Logging
```bash
[annotation-service] Making annotation request to: https://biothings.ncats.io/annotator/NCBIGene:695
[annotation-service] Annotating single entity: NCBIGene:695
```

## 📚 Resources
- **Service URL**: https://biothings.ncats.io/annotator
- **Contact**: help@biothings.io
- **SmartAPI**: https://smart-api.info/
- **Translator**: https://ncats.nih.gov/translator

---

**Ready to annotate?** This MCP provides instant access to rich biomedical entity information! 🧬