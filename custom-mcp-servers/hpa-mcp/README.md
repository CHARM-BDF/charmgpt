# Human Protein Atlas MCP Server

An MCP (Model Context Protocol) server that provides tools for retrieving protein data from the Human Protein Atlas (HPA). This server allows LLMs to access comprehensive protein information including expression data, subcellular localization, disease involvement, and cancer prognostics.

## Features

- **Protein Data Retrieval**: Get complete HPA data for proteins using Ensembl IDs
- **Gene Symbol Support**: Lookup proteins by gene symbol (with guidance)
- **Cancer Prognostics**: Detailed cancer prognosis information across multiple cancer types
- **Expression Data**: Tissue and cell type expression patterns
- **Disease Associations**: Information about disease involvement
- **Markdown Artifacts**: All responses include well-formatted markdown for easy reading
- **Smart Summarization**: Context-aware instructions for LLMs to focus on relevant information

## Installation

1. Clone the repository and navigate to the hpa-mcp directory:
```bash
cd custom-mcp-servers/hpa-mcp
```

2. Install dependencies:
```bash
npm install
```

3. Build the project:
```bash
npm run build
```

## Usage

The server can be integrated with any MCP-compatible client. Add it to your MCP configuration:

```json
{
  "servers": {
    "hpa": {
      "command": "node",
      "args": ["path/to/hpa-mcp/dist/index.js"]
    }
  }
}
```

## Available Tools

### 1. get-protein-by-ensembl
Get Human Protein Atlas data for a protein using its Ensembl ID.

**Parameters:**
- `ensembl_id` (required): Ensembl gene ID (format: ENSG followed by 11 digits)

**Example:**
```json
{
  "ensembl_id": "ENSG00000146648"
}
```

### 2. get-protein-by-gene
Get Human Protein Atlas data for a protein using its gene symbol.

**Parameters:**
- `gene_symbol` (required): Gene symbol (e.g., EGFR, TP53, BRCA1)
- `include_cancer_prognostics` (optional): Include cancer prognostics data (default: true)
- `include_expression_data` (optional): Include expression data (default: true)

**Example:**
```json
{
  "gene_symbol": "EGFR",
  "include_cancer_prognostics": true,
  "include_expression_data": true
}
```

*Note: Currently provides guidance on finding Ensembl IDs rather than direct lookup*

### 3. search-protein-class
Search for proteins by protein class.

**Parameters:**
- `protein_class` (required): Protein class to search for
- `max_results` (optional): Maximum number of results (1-100, default: 20)

**Example:**
```json
{
  "protein_class": "Kinases",
  "max_results": 20
}
```

*Note: Provides guidance on using HPA website for class searches*

## Response Format

All tools return:
1. **Text content for the model**: Includes a summary and instructions for contextual summarization
2. **Markdown artifacts**: Comprehensive, well-formatted markdown documents containing:
   - Basic protein information (gene symbol, description, chromosomal location)
   - Protein classification and function
   - Subcellular localization
   - Expression patterns across tissues and cell types
   - Disease involvement
   - Cancer prognostics (favorable/unfavorable prognosis)
   - Additional data (interactions, antibodies, blood concentration)

## Data Included

The HPA data includes:
- **Gene Information**: Symbol, description, Ensembl ID, UniProt IDs
- **Protein Classification**: Protein class, biological process, molecular function
- **Localization**: Subcellular main and additional locations
- **Expression**: Tissue specificity, distribution, cell type specificity
- **Disease**: Disease involvement categories
- **Cancer**: Prognostic significance across multiple cancer types
- **Resources**: Available antibodies, protein interactions

## Example Ensembl IDs

Common genes and their Ensembl IDs:
- EGFR: ENSG00000146648
- TP53: ENSG00000141510
- BRCA1: ENSG00000012048
- KRAS: ENSG00000133703
- MYC: ENSG00000136997
- PTEN: ENSG00000171862

## Development

- `npm run build` - Build the TypeScript project
- `npm run watch` - Watch for changes and rebuild
- `npm run dev` - Run the development server
- `npm run lint` - Run ESLint

## API Information

This MCP uses the Human Protein Atlas public API:
- Base URL: https://www.proteinatlas.org
- Format: JSON data available at `https://www.proteinatlas.org/{ensembl_id}.json`
- No authentication required
- Respectful usage recommended

## License

ISC 