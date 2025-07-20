# Gene Fetcher MCP

This MCP server provides integration with the NCBI Gene database through E-utilities API. It allows you to search for genes and retrieve detailed information including links to NCBI Gene and Ensembl databases.

## Features

- ✅ Search genes by symbol (e.g., BRCA1, TP53)
- ✅ Get detailed gene information including:
  - Basic details (ID, symbol, description)
  - Genomic location (chromosome, map location)
  - Official nomenclature
  - Aliases
  - Summary
  - Links to NCBI Gene and Ensembl databases
- ✅ Support for different organisms (defaults to Homo sapiens)
- ✅ Optional Ensembl ID lookup

## Installation

1. Clone the repository and navigate to the gene-fetcher directory:
   ```bash
   cd custom-mcp-servers/gene-fetcher
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Copy the environment example file and update it with your information:
   ```bash
   cp env.example .env
   ```
   Edit `.env` and add your email address (required for NCBI API).

## Usage

The MCP provides one main tool:

### search-gene

Search for gene information by gene symbol.

**Parameters:**
- `gene_symbol` (string, required): Gene symbol to search for (e.g., "BRCA1", "TP53")
- `include_ensembl` (boolean, optional, default: true): Whether to include Ensembl ID in results
- `organism` (string, optional, default: "Homo sapiens"): Organism name

**Example Response:**
```markdown
# Gene Information: BRCA1

## Basic Information
- **Gene ID:** 672
- **Symbol:** BRCA1
- **Description:** BRCA1 DNA repair associated
- **Organism:** Homo sapiens
- **Chromosome:** 17
- **Map Location:** 17q21.31

## Nomenclature
- **Official Symbol:** BRCA1
- **Official Name:** BRCA1 DNA repair associated
- **Aliases:** RNF53, IRIS, PSCP, BRCAI, BRCC1, PPP1R53

## Summary
This gene provides instructions for making a protein that acts as a tumor suppressor...

## External Links
🔗 [NCBI Gene](https://www.ncbi.nlm.nih.gov/gene/672)
🔗 [Ensembl](https://www.ensembl.org/Homo_sapiens/Gene/Summary?g=ENSG00000012048)
```

## Development

1. Start the MCP server in development mode:
   ```bash
   npm run dev
   ```

2. For production, build the server:
   ```bash
   npm run build
   ```

## Rate Limits

The NCBI E-utilities API has the following rate limits:
- Without API key: 3 requests/second
- With API key: 10 requests/second

To get higher rate limits, obtain an API key from [NCBI](https://www.ncbi.nlm.nih.gov/account/settings/) and add it to your `.env` file.

## Error Handling

The MCP handles common errors including:
- Gene not found
- Invalid gene symbols
- API request failures
- Rate limit exceeded

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a new Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Based on the NCBI E-utilities API
- Uses the Model Context Protocol for AI integration
- Inspired by the PubMed MCP implementation 