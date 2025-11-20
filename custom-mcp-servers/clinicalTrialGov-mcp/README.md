# ClinicalTrials.gov MCP Server

A Model Context Protocol (MCP) server that provides access to the ClinicalTrials.gov database for searching clinical trials.

## Overview

This MCP server enables searching the ClinicalTrials.gov database and retrieving detailed information about clinical trials, including:
- Trial identification (NCT ID, title)
- Study status and dates
- Eligibility criteria (age ranges, conditions)
- Design details (study type, phases, allocation, masking)
- Arms and interventions
- Dosing information (extracted from interventions and descriptions)

## Features

- **Search Clinical Trials**: Search for trials using natural language queries
- **Comprehensive Results**: Returns detailed information including design, interventions, and dosing
- **Markdown Artifacts**: Provides structured markdown artifacts with complete trial details
- **Dosing Extraction**: Automatically extracts dosing information from study descriptions and interventions

## API Endpoint

- **Base URL**: `https://clinicaltrials.gov/api/v2/studies`
- **Method**: GET with query parameters
- **Format**: JSON
- **Authentication**: None required (public API)

## Available Tools

### `search-trials`

Search ClinicalTrials.gov for clinical trials matching specified terms.

**Parameters:**
- `query` (required): Search query string. Can include multiple terms (e.g., "N-acetylcysteine NAC pediatric"). Terms are combined with AND logic.
- `max_results` (optional): Maximum number of results to return (1-100, default: 50)

**Example:**
```json
{
  "query": "N-acetylcysteine NAC pediatric",
  "max_results": 50
}
```

**Returns:**
- Text summary with key information about each trial
- Markdown artifact containing:
  - Title and NCT ID
  - Brief description
  - Design details (study type, phases, allocation, masking, enrollment)
  - Arms and interventions
  - Dosing information (extracted from interventions and descriptions)
  - Study URL

## Installation

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Build the project:**
   ```bash
   npm run build
   ```

3. **Add to MCP configuration:**
   Add the following to your `mcp_server_config.json`:
   ```json
   {
     "mcpServers": {
       "clinicaltrials-gov": {
         "command": "node",
         "args": [
           "../custom-mcp-servers/clinicalTrialGov-mcp/dist/index.js"
         ],
         "timeout": 60000
       }
     }
   }
   ```

## Development

**Run in development mode:**
```bash
npm run dev
```

**Run production build:**
```bash
npm run build
npm start
```

## Usage Examples

### Search for pediatric NAC trials:
```json
{
  "query": "N-acetylcysteine pediatric",
  "max_results": 20
}
```

### Search for specific condition:
```json
{
  "query": "N-acetylcysteine acetaminophen overdose",
  "max_results": 10
}
```

### Search with multiple terms:
```json
{
  "query": "NAC cystic fibrosis pediatric",
  "max_results": 30
}
```

## Response Format

The tool returns:
1. **Text Response**: Summary with key information for each trial
2. **Markdown Artifact**: Complete structured data including:
   - Study identification
   - Design details
   - Arms and interventions
   - Dosing information
   - Study URLs

## Dosing Information Extraction

The server automatically extracts dosing information from:
- Intervention descriptions
- Study brief summaries
- Detailed descriptions

It looks for patterns such as:
- Dose amounts (mg, mg/kg, mg/kg/day)
- Frequency (once daily, twice daily, etc.)
- Route of administration (oral, IV, etc.)
- Duration of treatment

## Notes

- The ClinicalTrials.gov API is public and does not require authentication
- Rate limiting: Be respectful of the API; the server doesn't implement rate limiting by default
- Results are limited to 100 studies per query
- Dosing information extraction is based on text pattern matching and may not capture all dosing details

## Troubleshooting

### No results found
- Try broader search terms
- Check spelling of drug names and conditions
- Try alternative names (e.g., "NAC" vs "N-acetylcysteine")

### Missing dosing information
- Dosing may not be available in all study records
- Some studies may have dosing in full protocol documents not accessible via API
- Check the study URL for complete information

## License

ISC
