# Scripts Directory

This directory contains various utility scripts for the charm-mcp project.

## ARAX Test Script

### `test-arax-query.ts`

A TypeScript script that tests the ARAX (Automated Reasoning and Autonomous eXploration) biomedical knowledge graph API from NCATS.

#### What it does:
- Sends a biomedical knowledge graph query to the ARAX API
- Handles both streaming (Server-Sent Events) and regular JSON responses
- Tests a specific query: **"What does the gene FAM177A1 affect?"**

#### Example Query:
The script queries for relationships where the gene FAM177A1 (NCBIGene:283635) affects any:
- Diseases
- Drugs  
- Other genes
- Proteins
- Phenotypic features

#### Usage:

```bash
# Run with npm script
npm run test:arax

# Or run directly with tsx
tsx scripts/test-arax-query.ts
```

#### Sample Results:
The query returns biomedical relationships like:
- **FAM177A1 → affects → IL1B (Interleukin-1 beta)**
- Evidence from text mining sources
- Confidence scores and relationship qualifiers
- Multiple knowledge source attributions

#### API Details:
- **Endpoint**: `https://arax.ncats.io/api/arax/v1.4/query`
- **Method**: POST with JSON payload
- **Response**: Server-Sent Events stream or JSON
- **Format**: TRAPI (Translator Reasoner API) compliant

#### Features:
- ✅ Handles streaming responses in real-time
- ✅ Parses Server-Sent Events properly
- ✅ Falls back to simple JSON mode
- ✅ Comprehensive error handling
- ✅ TypeScript interfaces for type safety
- ✅ Detailed logging and progress tracking

This demonstrates how to programmatically interact with biomedical knowledge graphs and handle complex API responses that stream results as they're computed. 