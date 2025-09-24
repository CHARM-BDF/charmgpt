# DGIdb MCP - Index

## Overview

**DGIdb MCP** provides access to the BioThings DGIdb (Drug-Gene Interaction Database) API, enabling comprehensive drug-gene interaction queries with detailed interaction types and PubMed references.

## Key Features

- **Drug-Gene Interactions**: Find drugs that interact with specific genes
- **Detailed Interaction Types**: Comprehensive interaction classifications
- **PubMed References**: Access to scientific literature
- **Batch Processing**: Query up to 1000 associations at once
- **Flexible Querying**: BioThings query syntax support

## Quick Start

1. **Install**: `npm install`
2. **Build**: `npm run build`
3. **Configure**: Copy `env.example` to `.env` (optional)
4. **Use**: Query drug-gene interactions via MCP tools

## Available Tools

- `query-dgidb` - Query drug-gene interactions
- `get-dgidb-association` - Get single association details
- `get-dgidb-associations-batch` - Get multiple associations
- `get-dgidb-metadata` - Get database metadata
- `get-dgidb-fields` - Get available fields

## Common Use Cases

- **Drug Discovery**: Find drugs targeting specific genes
- **Target Identification**: Identify genes for drug development
- **Pharmacological Research**: Study drug-gene interactions
- **Literature Mining**: Access PubMed references for interactions

## Data Sources

- **ChEMBL**: Chemical database
- **DrugBank**: Drug information database
- **PubMed**: Scientific literature references
- **Multiple interaction databases**

## Related MCPs

- **TTD MCP**: Therapeutic Target Database
- **Annotation MCP**: Biomedical entity annotation
- **Gene Enrichment MCP**: Gene enrichment analysis

## Documentation

- [README.md](README.md) - Complete documentation
- [QUICK_REFERENCE.md](QUICK_REFERENCE.md) - Quick reference guide
- [dgidbSmartAPI.json](dgidbSmartAPI.json) - SmartAPI metadata

## Support

- **Issues**: Check logs for error details
- **Contact**: help@biothings.io
- **Documentation**: https://biothings.io/