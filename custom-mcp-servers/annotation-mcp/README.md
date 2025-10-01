# Annotation Service MCP

**🎯 Purpose:** Model Context Protocol (MCP) server for the Translator Annotation Service, providing expanded annotation information for biomedical entities.

**⚡ Time to First Working MCP:** ~5 minutes (no authentication required)  
**📚 Based on:** SmartAPI-compliant Translator Annotation Service  
**🔧 Difficulty:** Beginner  
**🏥 Domain:** Biomedical entity annotation and enrichment

## 🧬 Overview

The Annotation Service MCP integrates with the BioThings Translator Annotation Service to provide expanded information about biomedical entities. This service can annotate genes, chemicals, drugs, diseases, phenotypes, and other biomedical entities using their curie IDs.

### Key Features

- **Single Entity Annotation**: Annotate individual biomedical entities by curie ID
- **Batch Annotation**: Process up to 1000 entities in a single request
- **Rich Metadata**: Returns names, descriptions, synonyms, categories, and external references
- **No Authentication**: Public API, no API keys required
- **SmartAPI Compliant**: Follows FAIR principles for biomedical data

## 🚀 Quick Start

### 1. Install Dependencies
```bash
cd custom-mcp-servers/annotation-mcp/
npm install
```

### 2. Build the MCP
```bash
npm run build
```

### 3. Test the MCP
```bash
npm run dev
```

## 🧬 Supported Entity Types

The Annotation Service supports a wide range of biomedical entity types:

### Gene Entities
- **NCBIGene**: NCBI Gene database (e.g., `NCBIGene:695`)
- **ENSEMBL**: Ensembl gene IDs (e.g., `ENSEMBL:ENSG00000139618`)
- **HGNC**: HUGO Gene Nomenclature Committee (e.g., `HGNC:1100`)

### Chemical/Drug Entities
- **CHEBI**: Chemical Entities of Biological Interest (e.g., `CHEBI:15365`)
- **DRUGBANK**: DrugBank database (e.g., `DRUGBANK:DB00001`)
- **PUBCHEM**: PubChem database (e.g., `PUBCHEM.COMPOUND:2244`)

### Disease Entities
- **MONDO**: Monarch Disease Ontology (e.g., `MONDO:0005148`)
- **DOID**: Disease Ontology (e.g., `DOID:1612`)
- **OMIM**: Online Mendelian Inheritance in Man (e.g., `OMIM:100100`)

### Phenotype Entities
- **HP**: Human Phenotype Ontology (e.g., `HP:0000001`)
- **MP**: Mouse Phenotype Ontology (e.g., `MP:0000001`)

## 🛠️ Available Tools

### 1. `annotate-entity`
Annotate a single biomedical entity by its curie ID.

**Parameters:**
- `curie_id` (required): Curie ID of the entity (e.g., "NCBIGene:695")
- `raw` (optional): Return raw data structure (default: false)
- `fields` (optional): Specific fields to return or "all" (default: "all")

**Example:**
```json
{
  "curie_id": "NCBIGene:695",
  "raw": false,
  "fields": "all"
}
```

### 2. `annotate-entities-batch`
Annotate multiple biomedical entities in a single request.

**Parameters:**
- `ids` (required): Comma-separated list of curie IDs (max 1000)
- `append` (optional): Append to existing attributes (default: false)

**Example:**
```json
{
  "ids": "NCBIGene:695,NCBIGene:1234,CHEBI:15365",
  "append": false
}
```

## 📊 Response Format

### Text Response
The MCP returns formatted markdown text with:
- Entity name and description
- Categories and types
- Synonyms and aliases
- External references
- Usage instructions

### Artifact Response
Structured JSON data including:
- Summary statistics
- Complete annotation data
- External references
- Full attribute information

## 🧪 Example Usage

### Single Gene Annotation
```bash
# Annotate the BRCA1 gene
annotate-entity curie_id="NCBIGene:672"
```

**Response includes:**
- Gene name: BRCA1
- Description: breast cancer 1, early onset
- Categories: protein-coding gene
- Synonyms: BRCAI, BRCC1, FANCS
- External references: UniProt, HGNC, OMIM

### Batch Drug Annotation
```bash
# Annotate multiple drugs
annotate-entities-batch ids="CHEBI:15365,CHEBI:15366,CHEBI:15367"
```

**Response includes:**
- Summary of all annotated drugs
- Individual drug information
- Chemical classifications
- Drug interactions and properties

## 🔬 Use Cases

### 1. Gene List Enrichment
Annotate lists of genes to add:
- Official gene names and symbols
- Gene descriptions and functions
- Gene categories and pathways
- External database references

### 2. Drug Discovery
Annotate chemical compounds to get:
- Chemical names and structures
- Drug classifications
- Therapeutic indications
- Side effects and interactions

### 3. Disease Analysis
Annotate disease entities to obtain:
- Disease names and descriptions
- Disease classifications
- Associated genes and pathways
- Clinical manifestations

### 4. Data Validation
Verify biomedical entity IDs:
- Confirm entity existence
- Check ID format validity
- Validate entity types
- Find alternative identifiers

## 🏗️ Architecture

```
Claude/MCP Client
       ↓
   MCP Protocol
       ↓
  Annotation MCP Server
       ↓
BioThings Annotation Service
       ↓
  Formatted Response
       ↓
Claude (text + artifacts)
```

## 🔧 Configuration

### Environment Variables
Create a `.env` file (optional):
```bash
USER_EMAIL=your.email@example.com
# ANNOTATION_BASE_URL=https://biothings.ncats.io/annotator
# ANNOTATION_TIMEOUT_MS=30000
```

### MCP Client Configuration
Add to your MCP client configuration:
```json
{
  "annotation-service": {
    "command": "node",
    "args": ["./custom-mcp-servers/annotation-mcp/dist/index.js"],
    "timeout": 60000
  }
}
```

## 🧬 SmartAPI Integration

This MCP is built using the SmartAPI metadata specification:

```json
{
  "openapi": "3.0.3",
  "info": {
    "title": "Translator Annotation Service",
    "version": "1.0",
    "description": "Translator Annotation Service.",
    "contact": {
      "name": "BioThings Team",
      "email": "help@biothings.io"
    }
  },
  "servers": [
    {
      "url": "https://biothings.ncats.io/annotator",
      "description": "Production server"
    }
  ],
  "tags": [
    {"name": "gene"},
    {"name": "chemical"},
    {"name": "drug"},
    {"name": "disease"},
    {"name": "phenotype"},
    {"name": "annotation"},
    {"name": "translator"}
  ]
}
```

## 🚀 Deployment

### 1. Build for Production
```bash
npm run build
```

### 2. Test the Built Version
```bash
npm start
```

### 3. Configure MCP Client
Update your MCP client to use the built server from the `dist/` directory.

## 🔍 Troubleshooting

### Common Issues

1. **"Invalid curie ID format" errors**
   - Ensure curie IDs follow the format: `PREFIX:ID`
   - Check that the prefix is supported (NCBIGene, CHEBI, etc.)
   - Verify the ID portion is valid

2. **"Annotation not found" errors**
   - The entity may not exist in the annotation database
   - Try alternative curie ID formats
   - Check if the entity type is supported

3. **Batch request failures**
   - Ensure no more than 1000 IDs per request
   - Check that all IDs are properly formatted
   - Verify comma separation in the IDs string

### Debug Logging
The MCP includes comprehensive logging:
```bash
[annotation-service] Making annotation request to: https://biothings.ncats.io/annotator/NCBIGene:695
[annotation-service] Annotating single entity: NCBIGene:695
```

## 📚 Resources

### Official Documentation
- [BioThings Annotation Service](https://biothings.ncats.io/annotator)
- [SmartAPI Registry](https://smart-api.info/)
- [Translator Program](https://ncats.nih.gov/translator)

### Related Standards
- [FAIR Principles](https://www.go-fair.org/fair-principles/)
- [OpenAPI Specification](https://swagger.io/specification/)
- [JSON-LD](https://json-ld.org/)

### Example Curie IDs
- **Genes**: `NCBIGene:695`, `ENSEMBL:ENSG00000139618`
- **Chemicals**: `CHEBI:15365`, `PUBCHEM.COMPOUND:2244`
- **Diseases**: `MONDO:0005148`, `DOID:1612`
- **Phenotypes**: `HP:0000001`, `MP:0000001`

## 🤝 Support

For issues with this MCP:
1. Check the debug logs for detailed error information
2. Verify your curie ID formats
3. Test with known valid curie IDs
4. Check the BioThings service status

For issues with the Annotation Service:
- Contact: help@biothings.io
- GitHub: https://github.com/biothings

---

**Ready to annotate biomedical entities?** This MCP provides instant access to rich annotation data for genes, drugs, diseases, and more! 🧬🚀