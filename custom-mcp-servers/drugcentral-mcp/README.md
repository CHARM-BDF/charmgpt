# DrugCentral MCP Server

A Model Context Protocol (MCP) server that provides access to DrugCentral database mechanism of action information for drugs and targets. This server enables querying the comprehensive DrugCentral database to retrieve drug-target interactions, bioactivity data, and mechanism of action relationships.

## Overview

DrugCentral is an open-access online drug compendium containing:
- **4,950+ drugs** with mechanism of action information
- **20,000+ bioactivity data points** for drug-target interactions  
- **724 mechanism-of-action targets** with detailed annotations
- Drug-target bioactivity profiles from ChEMBL, WOMBAT-PK, DrugMatrix, IUPHAR, and scientific literature

## Features

- **Drug Search**: Find drugs by name, INN, synonyms, or partial matches
- **Target Search**: Search molecular targets by name, gene symbol, or UniProt ID
- **Mechanism of Action**: Retrieve MoA relationships between drugs and targets
- **Bioactivity Data**: Access Ki, Kd, IC50, EC50 values for drug-target interactions
- **Drug-Target Relationships**: Get all targets for a drug or all drugs for a target
- **Integrated Search**: Combined drug/target search with MoA lookup

## Installation

1. Clone or navigate to the MCP server directory:
```bash
cd custom-mcp-servers/drugcentral-mcp
```

2. Install dependencies:
```bash
npm install
```

3. Build the TypeScript code:
```bash
npm run build
```

## Database Connection

This server connects to the public DrugCentral PostgreSQL database instance:
- **Host**: unmtid-dbs.net
- **Port**: 5433  
- **Database**: drugcentral
- **Username**: drugman
- **Password**: dosage

You can override these settings with environment variables:
```bash
export DRUGCENTRAL_HOST=your-host
export DRUGCENTRAL_PORT=5433
export DRUGCENTRAL_DB=drugcentral
export DRUGCENTRAL_USER=your-user
export DRUGCENTRAL_PASSWORD=your-password
```

## Usage

### Starting the Server

```bash
npm start
```

The server runs on stdio and will connect to the DrugCentral database on startup.

### Available Tools

#### 1. `search_drugs`
Search for drugs by name, INN, or synonym.

**Parameters:**
- `query` (string, required): Drug name or partial match to search for
- `limit` (number, optional): Maximum results to return (default: 10)

**Example:**
```javascript
{
  "query": "aspirin",
  "limit": 5
}
```

#### 2. `search_targets`
Search for molecular targets (proteins) by name, gene symbol, or UniProt ID.

**Parameters:**
- `query` (string, required): Target name, gene, or UniProt ID to search for
- `limit` (number, optional): Maximum results to return (default: 10)

**Example:**
```javascript
{
  "query": "OPRM1",
  "limit": 5
}
```

#### 3. `get_mechanism_of_action`
Get mechanism of action relationships between drugs and targets.

**Parameters:**
- `drug_id` (number, optional): DrugCentral drug ID to filter by
- `target_id` (number, optional): DrugCentral target ID to filter by  
- `limit` (number, optional): Maximum results to return (default: 20)

**Example:**
```javascript
{
  "drug_id": 1234,
  "limit": 10
}
```

#### 4. `get_bioactivity_data`
Get bioactivity measurements (Ki, Kd, IC50, EC50) for drug-target interactions.

**Parameters:**
- `drug_id` (number, optional): DrugCentral drug ID to filter by
- `target_id` (number, optional): DrugCentral target ID to filter by
- `limit` (number, optional): Maximum results to return (default: 20)

**Example:**
```javascript
{
  "target_id": 567,
  "limit": 15
}
```

#### 5. `get_drug_targets`
Get all molecular targets for a specific drug.

**Parameters:**
- `drug_id` (number, required): DrugCentral drug ID

**Example:**
```javascript
{
  "drug_id": 1234
}
```

#### 6. `get_target_drugs`
Get all drugs that target a specific protein/target.

**Parameters:**
- `target_id` (number, required): DrugCentral target ID

**Example:**
```javascript
{
  "target_id": 567
}
```

#### 7. `search_moa_by_drug_name`
Combined search: find drugs by name and retrieve their mechanism of action data.

**Parameters:**
- `drug_name` (string, required): Drug name to search for
- `limit` (number, optional): Maximum results to return (default: 10)

**Example:**
```javascript
{
  "drug_name": "metformin",
  "limit": 10
}
```

#### 8. `search_moa_by_target_name`
Combined search: find targets by name and retrieve drugs that interact with them.

**Parameters:**
- `target_name` (string, required): Target name, gene, or UniProt ID to search for
- `limit` (number, optional): Maximum results to return (default: 10)

**Example:**
```javascript
{
  "target_name": "dopamine receptor",
  "limit": 10
}
```

## Example Usage Scenarios

### 1. Find Mechanism of Action for a Drug
```bash
# Search for aspirin and its targets
search_moa_by_drug_name: {"drug_name": "aspirin"}

# Or search aspirin first, then get its targets
search_drugs: {"query": "aspirin"}
get_drug_targets: {"drug_id": 2244}  # Use ID from search results
```

### 2. Find Drugs Targeting a Specific Protein
```bash
# Search for drugs targeting opioid receptors
search_moa_by_target_name: {"target_name": "opioid receptor"}

# Or search target first, then get drugs
search_targets: {"query": "OPRM1"}
get_target_drugs: {"target_id": 216}  # Use ID from search results
```

### 3. Get Bioactivity Data for Drug-Target Interactions
```bash
# Get all bioactivity data for morphine
search_drugs: {"query": "morphine"}
get_bioactivity_data: {"drug_id": 1234}  # Use ID from search

# Get bioactivity for specific target
get_bioactivity_data: {"target_id": 216}
```

### 4. Research Drug Mechanism of Action
```bash
# Find mechanism of action for diabetes drugs
search_moa_by_drug_name: {"drug_name": "metformin"}
search_moa_by_drug_name: {"drug_name": "insulin"}

# Compare targets for different drug classes
search_moa_by_target_name: {"target_name": "kinase"}
```

## Data Sources

The DrugCentral database aggregates mechanism of action and bioactivity data from:

- **ChEMBL** (59.7% of bioactivity records)
- **WOMBAT-PK** (13.8%)
- **DrugMatrix** (11.0%)
- **IUPHAR/BPS Guide to Pharmacology** (6.1%)
- **Scientific Literature** (3.7%)
- **PDSP** (3.6%)
- **Drug Labels** (1.6%)

## Target Classifications

- **Enzymes**: 53.5% (15.6% are kinases)
- **G protein-coupled receptors (GPCRs)**: 15.1%
- **Ion channels**: 11.1%
- **Other targets**: 20.3%

## Development

### Building
```bash
npm run build
```

### Development Mode (with file watching)
```bash
npm run dev
```

### Testing Database Connection
You can test the database connection by running:
```bash
node -e "
import { DrugCentralDatabase } from './dist/database.js';
const db = new DrugCentralDatabase();
db.testConnection().then(connected => {
  console.log('Connected:', connected);
  db.close();
});
"
```

## Troubleshooting

### Database Connection Issues
1. Check network connectivity to `unmtid-dbs.net:5433`
2. Verify the database is accessible (public instance may have load limits)
3. Try using environment variables to override connection settings

### Common Errors
- **"No results found"**: Try broader search terms or check spelling
- **"Connection timeout"**: The public database may be busy, try again later
- **"Unknown tool"**: Ensure you're using the correct tool name from the list above

## License

This MCP server is licensed under the MIT License. DrugCentral data is available under Creative Commons Attribution-ShareAlike 4.0 license.

## References

- [DrugCentral Website](https://drugcentral.org)
- [DrugCentral 2023 Paper](https://doi.org/10.1093/nar/gkac1085)
- [Model Context Protocol](https://modelcontextprotocol.io)

## Contributing

Feel free to submit issues and pull requests to improve this MCP server. When contributing:

1. Follow TypeScript best practices
2. Add appropriate error handling
3. Update documentation for new features
4. Test database queries thoroughly 