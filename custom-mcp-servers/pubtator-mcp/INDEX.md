# PubTator MCP - Index

## Overview

**PubTator MCP** provides access to the PubTator API for biomedical text mining and entity extraction from PubMed literature. Extract genes, diseases, chemicals, and other biomedical entities from research papers and build knowledge graphs.

## Key Features

- **PMID Annotation**: Extract entities from PubMed articles by PMID
- **Multiple Entity Types**: Support for 8 different entity types
- **Multiple Formats**: Output in BioC JSON, PubTator, or PubAnnotation formats

## Quick Start

1. **Install**: `npm install`
2. **Build**: `npm run build`
3. **Configure**: Copy `env.example` to `.env` and add your API key
4. **Use**: Annotate biomedical texts and extract entities

## Available Tools

- `annotate-pmids` - Annotate PubMed articles by PMID

## Common Use Cases

- **Literature Mining**: Extract entities from research papers
- **Knowledge Graph Building**: Create graphs from biomedical literature
- **Drug Discovery**: Find genes, diseases, and chemicals in papers
- **Research Analysis**: Analyze entity co-occurrences in literature
- **Text Processing**: Annotate custom biomedical texts

## Entity Types

- **Gene**: Genes and gene products
- **Disease**: Diseases and medical conditions
- **Chemical**: Chemicals, drugs, and compounds
- **Species**: Organisms and species
- **Mutation**: Genetic mutations and variants
- **Cellline**: Cell lines
- **SNP**: Single nucleotide polymorphisms
- **Protein**: Proteins and protein products

## Output Formats

- **BioC JSON**: Structured JSON format (default)
- **PubTator**: Tab-separated format
- **PubAnnotation**: JSON-LD format

## Related MCPs

- **PubMed MCP**: Search and retrieve PubMed articles
- **Gene Fetcher MCP**: Get gene information
- **Annotation MCP**: Annotate biomedical entities

## Documentation

- [README.md](README.md) - Complete documentation
- [QUICK_REFERENCE.md](QUICK_REFERENCE.md) - Quick reference guide
- [env.example](env.example) - Environment configuration

## Support

- **Issues**: Check logs for error details
- **Contact**: help@ncbi.nlm.nih.gov
- **Documentation**: https://www.ncbi.nlm.nih.gov/research/pubtator-api/