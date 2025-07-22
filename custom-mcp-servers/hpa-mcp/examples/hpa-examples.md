# Human Protein Atlas MCP Examples

This document provides example usage of the Human Protein Atlas MCP tools.

## Example 1: Get Protein Data by Ensembl ID

### Request
```json
{
  "tool": "get-protein-by-ensembl",
  "arguments": {
    "ensembl_id": "ENSG00000146648"
  }
}
```

### Expected Response
The tool will return:
1. A text response with a protein summary and instructions for contextual summarization
2. A markdown artifact containing comprehensive HPA data including:
   - Gene information (EGFR)
   - Protein classification
   - Subcellular localization
   - Expression patterns
   - Disease involvement
   - Cancer prognostics

## Example 2: Get Protein by Gene Symbol

### Request
```json
{
  "tool": "get-protein-by-gene",
  "arguments": {
    "gene_symbol": "TP53",
    "include_cancer_prognostics": true,
    "include_expression_data": true
  }
}
```

### Expected Response
Currently provides guidance on finding the Ensembl ID for TP53 (ENSG00000141510) with instructions on how to use the HPA website or other resources.

## Example 3: Search Protein Class

### Request
```json
{
  "tool": "search-protein-class",
  "arguments": {
    "protein_class": "Kinases",
    "max_results": 50
  }
}
```

### Expected Response
Provides guidance on using the HPA website to search for protein classes, with links to relevant pages and download options.

## Example Use Cases

### 1. Cancer Research
```
User: "I need to understand the prognostic significance of BRCA1 in different cancers."

1. Use get-protein-by-ensembl with "ENSG00000012048"
2. Review the cancer prognostics section
3. Identify favorable vs unfavorable prognosis cancer types
```

### 2. Drug Target Analysis
```
User: "What can you tell me about EGFR as a drug target?"

1. Use get-protein-by-ensembl with "ENSG00000146648"
2. Review protein classification (receptor, kinase)
3. Check tissue expression patterns
4. Review disease involvement
```

### 3. Protein Localization Study
```
User: "Where is the p53 protein localized in cells?"

1. Use get-protein-by-ensembl with "ENSG00000141510" (TP53)
2. Review subcellular localization data
3. Check main vs additional locations
```

### 4. Expression Pattern Analysis
```
User: "Which tissues express KRAS and how specific is the expression?"

1. Use get-protein-by-ensembl with "ENSG00000133703"
2. Review tissue specificity and distribution
3. Check cell type specificity
4. Analyze cancer-specific expression
```

## Common Ensembl IDs Reference

| Gene Symbol | Ensembl ID | Description |
|------------|------------|-------------|
| EGFR | ENSG00000146648 | Epidermal growth factor receptor |
| TP53 | ENSG00000141510 | Tumor protein p53 |
| BRCA1 | ENSG00000012048 | Breast cancer 1 |
| KRAS | ENSG00000133703 | KRAS proto-oncogene |
| MYC | ENSG00000136997 | MYC proto-oncogene |
| PTEN | ENSG00000171862 | Phosphatase and tensin homolog |
| AKT1 | ENSG00000142208 | AKT serine/threonine kinase 1 |
| ERBB2 | ENSG00000141736 | erb-b2 receptor tyrosine kinase 2 (HER2) |
| VEGFA | ENSG00000112715 | Vascular endothelial growth factor A |
| MTOR | ENSG00000198793 | Mechanistic target of rapamycin |

## Understanding HPA Data

### Tissue Specificity Categories
- **Not detected**: Expression below detection limit
- **Low specificity**: Detected in all tissues
- **Tissue enhanced**: Higher expression in certain tissues
- **Group enriched**: Higher expression in a group of tissues
- **Tissue enriched**: Much higher expression in single tissue

### Cancer Prognostics
- **Favorable**: High expression correlates with better survival
- **Unfavorable**: High expression correlates with worse survival
- **p-value**: Statistical significance of the correlation

### Evidence Levels
- **Evidence at protein level**: Protein existence confirmed
- **Evidence at transcript level**: Transcript detected
- **Inferred from homology**: Based on similar proteins
- **Predicted**: Computational prediction only

## Tips for Using HPA MCP

1. **Always use Ensembl IDs**: The HPA API requires Ensembl gene IDs (ENSG format)
2. **Check Evidence Levels**: Higher evidence levels indicate more reliable data
3. **Review Cancer Data**: Prognostic significance varies greatly between cancer types
4. **Consider Expression Patterns**: Tissue specificity can indicate function
5. **Look at Subcellular Location**: Helps understand protein function
6. **Check Disease Involvement**: Links to pathology and clinical relevance 