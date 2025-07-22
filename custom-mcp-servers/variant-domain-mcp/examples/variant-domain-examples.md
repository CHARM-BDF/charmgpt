# Variant Domain Mapper MCP Examples

This document provides example usage of the Variant Domain Mapper MCP tools.

## Example 1: Map a Single Variant to Domains

### Request
```json
{
  "tool": "map-variant-to-domains",
  "arguments": {
    "transcript_id": "NM_005228.3",
    "gene_symbol": "EGFR",
    "protein_change": "p.Leu858Arg",
    "coding_change": "c.2573T>G"
  }
}
```

### Expected Response
The tool will return:
1. A text response with instructions for summarization based on context
2. A markdown artifact containing:
   - Variant position mapping from RefSeq to UniProt coordinates
   - Domain impact analysis
   - Visual domain map
   - Links to external resources

### Clinical Significance
The L858R mutation in EGFR is a well-known activating mutation that affects the tyrosine kinase domain, making it a target for EGFR inhibitors in lung cancer treatment.

## Example 2: Get All Protein Domains for a Gene

### Request
```json
{
  "tool": "get-protein-domains",
  "arguments": {
    "gene_symbol": "BRCA1"
  }
}
```

### Expected Response
Returns comprehensive domain information including:
- RING finger domain (E3 ubiquitin ligase activity)
- BRCT domains (DNA damage response)
- Coiled-coil regions
- Nuclear localization signals
- Various binding sites and functional regions

## Example 3: Batch Map Multiple Variants

### Request
```json
{
  "tool": "batch-map-variants",
  "arguments": {
    "variants": [
      {
        "transcript_id": "NM_000059.3",
        "gene_symbol": "BRCA2",
        "protein_change": "p.Ser1982Argfs",
        "coding_change": "c.5946del"
      },
      {
        "transcript_id": "NM_005228.3",
        "gene_symbol": "EGFR",
        "protein_change": "p.Thr790Met",
        "coding_change": "c.2369C>T"
      },
      {
        "transcript_id": "NM_000546.5",
        "gene_symbol": "TP53",
        "protein_change": "p.Arg175His",
        "coding_change": "c.524G>A"
      }
    ]
  }
}
```

### Expected Response
Batch results showing:
- Summary of total variants processed
- Number with domain impacts
- Individual results for each variant
- Any failures with error reasons

## Real-World Use Cases

### 1. Clinical Variant Interpretation
```json
{
  "tool": "map-variant-to-domains",
  "arguments": {
    "transcript_id": "NM_000492.3",
    "gene_symbol": "CFTR",
    "protein_change": "p.Phe508del",
    "coding_change": "c.1521_1523delCTT"
  }
}
```
This maps the most common cystic fibrosis mutation, showing it affects the NBD1 domain of CFTR.

### 2. Cancer Driver Mutations
```json
{
  "tool": "map-variant-to-domains",
  "arguments": {
    "transcript_id": "NM_004333.4",
    "gene_symbol": "BRAF",
    "protein_change": "p.Val600Glu",
    "coding_change": "c.1799T>A"
  }
}
```
Maps the V600E mutation in BRAF, showing its location in the protein kinase domain.

### 3. Pharmacogenomics
```json
{
  "tool": "map-variant-to-domains",
  "arguments": {
    "transcript_id": "NM_000106.5",
    "gene_symbol": "CYP2D6",
    "protein_change": "p.Pro34Ser",
    "coding_change": "c.100C>T"
  }
}
```
Maps variants in drug-metabolizing enzymes to understand functional impact.

## Tips for Best Results

1. **Use Current RefSeq IDs**: Always include version numbers (e.g., NM_005228.3, not NM_005228)
2. **HGVS Notation**: Use standard HGVS notation for protein changes (p.Leu858Arg)
3. **Batch Processing**: Group related variants for efficient analysis
4. **Context Matters**: Provide clinical or research context for better summarization

## Common Errors and Solutions

### Error: Transcript not found
```json
{
  "tool": "map-variant-to-domains",
  "arguments": {
    "transcript_id": "NM_005228",  // Missing version number
    "gene_symbol": "EGFR",
    "protein_change": "p.L858R"    // Should use 3-letter amino acid codes
  }
}
```
**Solution**: Use full transcript ID with version and proper HGVS notation.

### Error: No domain data
Some proteins may not have domain annotations in UniProt. In such cases, the tool will return basic protein information without domain details.

### Error: Alignment issues
Complex indels or splice variants may cause alignment problems. The tool will indicate when alignment confidence is low. 