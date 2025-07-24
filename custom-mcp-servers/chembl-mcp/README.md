# ChEMBL Mechanism of Action MCP Server

This MCP server provides access to the ChEMBL database for querying drug mechanisms of action, target information, and bioactivity data. It's specifically designed to help researchers understand how drugs work at the molecular level.

## Overview

ChEMBL is a manually curated database of bioactive molecules with drug-like properties. This MCP server focuses on mechanism of action data, providing tools to:

- 🔍 Search for drug mechanisms of action
- 💊 Get detailed drug information including all mechanisms
- 🎯 Find protein targets and associated drugs
- 📊 Analyze drug-target interactions with bioactivity data

## Features

- **Public API**: No authentication required - ChEMBL is freely accessible
- **Rate Limited**: Respectful 200ms delays between requests
- **Rich Data**: Mechanism details, bioactivity measurements, target information
- **Multiple Formats**: Text responses for reading + structured artifacts for analysis
- **Comprehensive Coverage**: Approved drugs, clinical candidates, and research compounds

## Tools

### 1. `search-mechanisms`
Search for drug mechanisms of action by drug name, target, or mechanism type.

**Parameters:**
- `query` (required): Drug name, target name, or mechanism description
- `action_type` (optional): Filter by AGONIST, ANTAGONIST, INHIBITOR, etc.
- `max_results` (optional): Limit results (default: 20, max: 100)
- `include_targets` (optional): Include detailed target info (default: true)

**Example:**
```json
{
  "query": "kinase inhibitor",
  "action_type": "INHIBITOR",
  "max_results": 10
}
```

### 2. `get-drug-details`
Get comprehensive information about a specific drug.

**Parameters:**
- `drug_identifier` (required): Drug name or ChEMBL ID (e.g., "aspirin" or "CHEMBL25")
- `include_activities` (optional): Include bioactivity data (default: false)
- `include_properties` (optional): Include chemical properties (default: true)

**Example:**
```json
{
  "drug_identifier": "ibuprofen",
  "include_activities": true
}
```

### 3. `search-targets`
Search for protein targets and find associated drugs.

**Parameters:**
- `target_query` (required): Protein name, gene symbol, or pathway
- `organism` (optional): Filter by organism (e.g., "Homo sapiens")
- `target_type` (optional): SINGLE_PROTEIN, PROTEIN_COMPLEX, or PROTEIN_FAMILY
- `max_results` (optional): Limit results (default: 20, max: 50)

**Example:**
```json
{
  "target_query": "EGFR",
  "organism": "Homo sapiens"
}
```

### 4. `analyze-interactions`
Analyze drug-target interactions with detailed bioactivity data.

**Parameters:**
- `drug_id` (required): ChEMBL drug ID (e.g., "CHEMBL25")
- `target_id` (optional): ChEMBL target ID (if not provided, analyzes all targets)
- `activity_types` (optional): Activity types to include (default: ["IC50", "Ki", "EC50", "Kd"])
- `max_activities` (optional): Maximum activity records (default: 50, max: 100)

**Example:**
```json
{
  "drug_id": "CHEMBL25",
  "activity_types": ["IC50", "Ki"]
}
```

## Usage Examples

### Find Aspirin's Mechanism of Action
```json
{
  "tool": "search-mechanisms",
  "arguments": {
    "query": "aspirin",
    "max_results": 5
  }
}
```

### Get Detailed Information About Ibuprofen
```json
{
  "tool": "get-drug-details", 
  "arguments": {
    "drug_identifier": "ibuprofen",
    "include_activities": true,
    "include_properties": true
  }
}
```

### Find All Drugs Targeting EGFR
```json
{
  "tool": "search-targets",
  "arguments": {
    "target_query": "EGFR",
    "organism": "Homo sapiens",
    "max_results": 20
  }
}
```

### Analyze Aspirin's Bioactivity Profile
```json
{
  "tool": "analyze-interactions",
  "arguments": {
    "drug_id": "CHEMBL25",
    "activity_types": ["IC50", "Ki", "EC50"],
    "max_activities": 50
  }
}
```

## Data Sources

This MCP server queries the following ChEMBL API endpoints:

- **Mechanism**: `/mechanism` - Drug mechanism of action data
- **Molecule**: `/molecule` - Drug/compound information and properties
- **Target**: `/target` - Protein target information  
- **Activity**: `/activity` - Bioactivity measurements (IC50, Ki, etc.)

## Response Format

### Text Responses
Formatted for easy reading with key information highlighted:

```
**Drug**: CHEMBL25
**Target**: CHEMBL231
**Mechanism**: Cyclooxygenase inhibitor
**Action Type**: INHIBITOR
**References**: [PubMed links]
```

### Artifacts
Structured data for programmatic use:

- `application/vnd.bibliography` - Mechanism of action citations
- `application/json` - General structured data
- `application/vnd.analytics` - Bioactivity analysis with statistics

## Rate Limiting

The server implements a 200ms delay between requests to be respectful of the ChEMBL public API. This ensures reliable access while not overwhelming their servers.

## Error Handling

- Invalid drug/target identifiers return helpful error messages
- API failures are gracefully handled with informative responses
- Input validation prevents malformed requests

## Installation

1. The server is already built and configured in your MCP setup
2. It's included in the main `mcp_server_config.json` as "chembl-moa"
3. No additional configuration or API keys required

## Configuration

The server is configured in `src/config/mcp_server_config.json`:

```json
{
  "chembl-moa": {
    "command": "node",
    "args": ["./custom-mcp-servers/chembl-mcp/dist/index.js"],
    "timeout": 60000
  }
}
```

## ChEMBL Database Information

- **Database**: ChEMBL (latest version automatically used)
- **Coverage**: >2.4M compounds, >14K clinical candidates, >4K approved drugs
- **Data Types**: Mechanisms, bioactivities, targets, chemical properties
- **Update Frequency**: ChEMBL releases new versions 2-3 times per year
- **License**: Creative Commons Attribution-Share Alike 3.0

## Use Cases

### Drug Discovery Research
- Find mechanism of action for investigational compounds
- Identify potential off-targets for safety assessment  
- Discover drug repurposing opportunities

### Medicinal Chemistry
- Analyze structure-activity relationships
- Compare bioactivity profiles across drug series
- Understand selectivity profiles

### Pharmacology
- Study drug-target interactions
- Analyze potency and efficacy data
- Investigate mechanism-based side effects

### Academic Research
- Literature mining for drug mechanisms
- Comparative pharmacology studies
- Target validation research

## Citation

If you use this MCP server in research, please cite ChEMBL:

> Zdrazil B, Felix E, Hunter F, et al. The ChEMBL Database in 2023: a drug discovery platform spanning multiple bioactivity data types and time periods. Nucleic Acids Res. 2024;52(D1):D1180-D1192.

## Support

This MCP server provides access to ChEMBL's comprehensive mechanism of action data through a simple, powerful interface designed for drug discovery and research applications. 