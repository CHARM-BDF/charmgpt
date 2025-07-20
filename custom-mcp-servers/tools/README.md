# PMI Case Data Tools - API Integration Tools

This directory contains a collection of JavaScript tools for interacting with various bioinformatics APIs and data sources. Each tool is designed to handle specific data retrieval and processing tasks.

## Tools Overview

### 1. Gene Retriever (`gene-retriever.js`)
- **Purpose**: Retrieves comprehensive gene information from NCBI's E-utilities
- **APIs Used**: NCBI E-utilities (esearch, esummary, efetch)
- **Key Features**:
  - Gene symbol to ID conversion
  - Gene summaries and descriptions
  - Cross-references to other databases
  - Detailed gene information retrieval

### 2. Human Protein Atlas Retriever (`hpa-retriever.js`)
- **Purpose**: Fetches protein data from the Human Protein Atlas
- **APIs Used**: proteinatlas.org REST API
- **Key Features**:
  - Protein classification
  - Subcellular localization
  - RNA expression patterns
  - Disease associations
  - Cancer prognostics

### 3. Enhanced HPA Retriever (`enhanced-hpa-retriever.js`)
- **Purpose**: Extended version of HPA retriever with additional analysis capabilities
- **APIs Used**: proteinatlas.org REST API
- **Key Features**:
  - Advanced tissue expression analysis
  - Detailed protein characterization
  - Enhanced data visualization support
  - Comprehensive expression patterns

### 4. GTEx Retriever (`gtex-retriever.js`)
- **Purpose**: Retrieves tissue-specific expression data
- **APIs Used**: GTEx (Genotype-Tissue Expression) API
- **Key Features**:
  - Tissue expression profiles
  - Expression level quantification
  - Tissue-specific analysis

### 5. ClinVar Retriever (`clinvar-retriever.js`)
- **Purpose**: Fetches variant information and clinical significance
- **APIs Used**: NCBI ClinVar API
- **Key Features**:
  - Variant pathogenicity assessment
  - Clinical significance data
  - Variant annotations

### 6. Domain Retriever (`domain-retriever.js`)
- **Purpose**: Retrieves protein domain information
- **APIs Used**: Various protein domain databases
- **Key Features**:
  - Protein domain identification
  - Structural feature analysis
  - Domain annotations

### 7. Variant Domain Mapper (`variant-domain-mapper.js`)
- **Purpose**: Maps genetic variants to protein domains
- **APIs Used**: Multiple integrated sources
- **Key Features**:
  - Variant-domain relationships
  - Functional impact assessment
  - Structure-based analysis

## Usage

Each tool is designed as a standalone module that can be imported and used independently. They all follow similar patterns:

```javascript
const ToolName = require('./tools/tool-name.js');

// Initialize the tool
const tool = new ToolName();

// Use the tool's methods
async function example() {
    try {
        const result = await tool.methodName(parameters);
        // Process results
    } catch (error) {
        console.error('Error:', error);
    }
}
```

## Dependencies

Common dependencies across tools:
- axios: For HTTP requests
- xml2js: For parsing XML responses (NCBI APIs)

## Error Handling

All tools implement comprehensive error handling and logging:
- API connection errors
- Data parsing errors
- Resource not found errors
- Rate limiting handling

## Data Output

Tools typically return structured data in JSON format, suitable for:
- Direct display in the UI
- Further processing
- Integration with other tools
- Storage in the database

## Maintenance

When updating these tools:
1. Maintain consistent error handling patterns
2. Update API endpoints and parameters as needed
3. Keep documentation current
4. Test thoroughly before deployment 