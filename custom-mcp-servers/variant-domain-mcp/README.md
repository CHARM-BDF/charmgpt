# Variant Domain Mapper MCP Server

An MCP (Model Context Protocol) server that maps genetic variants to protein domains. This tool helps researchers and clinicians understand if a specific genetic variant impacts functional protein domains, which is crucial for interpreting the potential biological significance of mutations.

## Features

- **Variant-to-Domain Mapping**: Map genetic variants to protein domains using RefSeq transcript IDs and HGVS notation
- **Protein Domain Retrieval**: Get comprehensive protein domain information for any gene
- **Batch Processing**: Map multiple variants in a single operation
- **Sequence Alignment**: Automatically align RefSeq and UniProt sequences to handle coordinate differences
- **Domain Impact Analysis**: Determine if variants affect functional domains, active sites, or binding sites
- **Visual Domain Maps**: ASCII visualization of protein domains and variant positions
- **Markdown Artifacts**: All responses include well-formatted markdown for easy reading

## Installation

1. Clone the repository and navigate to the MCP directory:
```bash
cd custom-mcp-servers/variant-domain-mcp
```

2. Install dependencies:
```bash
npm install
```

3. Build the project:
```bash
npm run build
```

## Configuration

This MCP doesn't require any API keys or environment variables. It uses public NCBI and UniProt APIs.

To add the server to your MCP configuration, add this to your `mcp_server_config.json`:

```json
{
  "variant-domain": {
    "command": "node",
    "args": [
      "./custom-mcp-servers/variant-domain-mcp/dist/index.js"
    ]
  }
}
```

## Available Tools

### 1. map-variant-to-domains

Maps a genetic variant to protein domains and checks for impact.

**Parameters:**
- `transcript_id`: RefSeq transcript ID (e.g., "NM_005228.3")
- `gene_symbol`: Gene symbol (e.g., "EGFR")
- `protein_change`: Protein change in HGVS format (e.g., "p.Leu883Ser")
- `coding_change` (optional): Coding change in HGVS format (e.g., "c.2648T>C")

**Example:**
```json
{
  "tool": "map-variant-to-domains",
  "arguments": {
    "transcript_id": "NM_005228.3",
    "gene_symbol": "EGFR",
    "protein_change": "p.Leu883Ser",
    "coding_change": "c.2648T>C"
  }
}
```

### 2. get-protein-domains

Retrieves all protein domains for a given gene.

**Parameters:**
- `gene_symbol`: Gene symbol to get domain information for
- `uniprot_id` (optional): UniProt ID if known

**Example:**
```json
{
  "tool": "get-protein-domains",
  "arguments": {
    "gene_symbol": "BRCA1"
  }
}
```

### 3. batch-map-variants

Maps multiple variants to protein domains in a single operation.

**Parameters:**
- `variants`: Array of variant objects, each containing:
  - `transcript_id`: RefSeq transcript ID
  - `gene_symbol`: Gene symbol
  - `protein_change`: Protein change in HGVS format
  - `coding_change` (optional): Coding change in HGVS format

**Example:**
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
        "protein_change": "p.Leu858Arg",
        "coding_change": "c.2573T>G"
      }
    ]
  }
}
```

## Output Format

All tools return markdown artifacts containing:

### For variant mapping:
- Input information (transcript, protein, variant details)
- Sequence alignment results
- Position mapping between RefSeq and UniProt coordinates
- Domain impact analysis
- Visual domain map showing variant position
- Links to external resources (NCBI, UniProt)

### For domain retrieval:
- Complete list of protein domains with positions
- Structural features (active sites, binding sites, etc.)
- Domain lengths and evidence codes
- Links to domain databases (InterPro, Pfam)

## Use Cases

1. **Clinical Variant Interpretation**: Determine if a patient's variant affects a functional protein domain
2. **Research**: Understand the structural context of mutations in your gene of interest
3. **Drug Development**: Identify if variants affect drug binding sites or catalytic domains
4. **Comparative Analysis**: Batch process multiple variants to identify patterns

## Technical Details

- Uses NCBI E-utilities API for RefSeq to protein mapping
- Uses UniProt REST API for domain information
- Implements basic sequence alignment for coordinate mapping
- Rate limits API calls to respect service guidelines (1 second between NCBI requests)

## Limitations

- Simple sequence alignment may not handle complex insertions/deletions perfectly
- Requires exact RefSeq transcript IDs (with version numbers)
- Domain information limited to what's available in UniProt
- API rate limiting may slow batch operations

## Development

To run in development mode:
```bash
npm run dev
```

To watch for changes:
```bash
npm run watch
```

## Troubleshooting

- **Transcript not found**: Ensure you're using the correct RefSeq ID with version (e.g., NM_005228.3, not just NM_005228)
- **No domain data**: Some proteins may not have domain annotations in UniProt
- **Alignment issues**: Complex variants or splice isoforms may cause alignment problems 