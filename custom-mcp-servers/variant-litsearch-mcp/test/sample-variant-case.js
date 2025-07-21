#!/usr/bin/env node

/**
 * Sample test script for the variant-litsearch-mcp server
 * This script demonstrates how to use the server with various variant cases
 */

// Sample variant cases for testing
const sampleCases = [
  {
    name: "BRCA1 Hereditary Breast Cancer",
    input: {
      genes: ["BRCA1"],
      phenotypes: ["breast cancer", "ovarian cancer"],
      mechanisms: ["DNA repair", "homologous recombination"],
      drugs: ["PARP inhibitor", "olaparib"],
      contextQuery: "BRCA1 pathogenic variant treatment options",
      maxResults: 10,
      includeJustification: true
    }
  },
  {
    name: "Pediatric Epilepsy Genetic Investigation",
    input: {
      phenotypes: ["intellectual disability", "seizures", "developmental delay"],
      contextQuery: "pediatric epilepsy with developmental delay genetic causes",
      maxResults: 15,
      includeJustification: true
    }
  },
  {
    name: "CYP2D6 Pharmacogenomics",
    input: {
      genes: ["CYP2D6"],
      drugs: ["codeine", "tramadol", "oxycodone"],
      mechanisms: ["drug metabolism", "cytochrome P450"],
      contextQuery: "CYP2D6 variants and opioid efficacy",
      maxResults: 12,
      includeJustification: true
    }
  },
  {
    name: "TP53 Cancer Research",
    input: {
      genes: ["TP53"],
      phenotypes: ["Li-Fraumeni syndrome", "cancer predisposition"],
      mechanisms: ["tumor suppressor", "p53 pathway", "apoptosis"],
      drugs: ["MDM2 inhibitor", "nutlin"],
      contextQuery: "TP53 germline mutations and cancer risk",
      maxResults: 8,
      includeJustification: true
    }
  },
  {
    name: "Minimal Context Search",
    input: {
      contextQuery: "CFTR gene cystic fibrosis new treatments",
      maxResults: 5,
      includeJustification: false
    }
  }
];

function displaySampleCase(caseData) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Sample Case: ${caseData.name}`);
  console.log(`${'='.repeat(60)}`);
  
  console.log("\nInput:");
  console.log(JSON.stringify(caseData.input, null, 2));
  
  console.log("\nExpected Query Construction:");
  const queryParts = [];
  
  if (caseData.input.genes) {
    const geneTerms = caseData.input.genes.map(gene => `(${gene}[tiab] OR ${gene}[mesh])`).join(" OR ");
    queryParts.push(`(${geneTerms})`);
  }
  
  if (caseData.input.phenotypes) {
    const phenotypeTerms = caseData.input.phenotypes.map(phenotype => `(${phenotype}[tiab] OR ${phenotype}[mesh])`).join(" OR ");
    queryParts.push(`(${phenotypeTerms})`);
  }
  
  if (caseData.input.mechanisms) {
    const mechanismTerms = caseData.input.mechanisms.map(mechanism => `(${mechanism}[tiab])`).join(" OR ");
    queryParts.push(`(${mechanismTerms})`);
  }
  
  if (caseData.input.drugs) {
    const drugTerms = caseData.input.drugs.map(drug => `(${drug}[tiab] OR ${drug}[mesh])`).join(" OR ");
    queryParts.push(`(${drugTerms})`);
  }
  
  if (caseData.input.contextQuery) {
    queryParts.push(`(${caseData.input.contextQuery}[tiab])`);
  }
  
  const expectedQuery = queryParts.join(" AND ");
  console.log(`"${expectedQuery}"`);
  
  console.log("\nExpected Relevance Scoring Factors:");
  if (caseData.input.genes) {
    console.log(`- Gene matches (30%): ${caseData.input.genes.join(", ")}`);
  }
  if (caseData.input.phenotypes) {
    console.log(`- Phenotype matches (25%): ${caseData.input.phenotypes.join(", ")}`);
  }
  if (caseData.input.mechanisms) {
    console.log(`- Mechanism matches (20%): ${caseData.input.mechanisms.join(", ")}`);
  }
  if (caseData.input.drugs) {
    console.log(`- Drug matches (15%): ${caseData.input.drugs.join(", ")}`);
  }
  console.log("- Recency bonus (10%): More recent publications scored higher");
  
  console.log("\nExpected Result Categories:");
  const categories = [];
  if (caseData.input.genes) categories.push("genetic");
  if (caseData.input.phenotypes) categories.push("phenotypic");
  if (caseData.input.mechanisms) categories.push("mechanistic");
  if (caseData.input.drugs) categories.push("therapeutic");
  categories.push("general");
  console.log(`- ${categories.join(", ")}`);
}

function displayUsageInstructions() {
  console.log("\n" + "=".repeat(80));
  console.log("VARIANT LITERATURE SEARCH MCP SERVER - SAMPLE TEST CASES");
  console.log("=".repeat(80));
  
  console.log("\nTo test the server with these cases:");
  console.log("1. Build and run the MCP server:");
  console.log("   cd custom-mcp-servers/variant-litsearch-mcp");
  console.log("   npm install");
  console.log("   npm run build");
  console.log("   npm run dev");
  
  console.log("\n2. Set environment variables:");
  console.log("   export NCBI_API_KEY='your_ncbi_api_key'");
  console.log("   export NCBI_TOOL_EMAIL='your_email@example.com'");
  
  console.log("\n3. Use the MCP client to call the 'search_variant_literature' tool");
  console.log("   with any of the sample inputs below.");
  
  console.log("\n4. Expected output format:");
  console.log(`   {
     "query": "Generated PubMed query string",
     "totalResults": 10,
     "results": [
       {
         "pmid": "12345678",
         "title": "Article title",
         "authors": ["Smith J", "Doe A"],
         "journal": "Nature Genetics",
         "year": "2023",
         "abstract": "Full abstract text...",
         "relevanceScore": 0.85,
         "justification": "Matches key terms: BRCA1, breast cancer; Relevant to genes: BRCA1",
         "matchingTerms": ["BRCA1", "breast cancer"],
         "category": "genetic"
       }
     ]
   }`);
}

// Main execution
function main() {
  displayUsageInstructions();
  
  sampleCases.forEach(displaySampleCase);
  
  console.log("\n" + "=".repeat(80));
  console.log("END OF SAMPLE TEST CASES");
  console.log("=".repeat(80));
}

// Run main function
main(); 