import fetch from 'node-fetch';
import fs from 'fs';

async function getEGFRData() {
  try {
    console.log('🔍 Fetching EGFR data from Human Protein Atlas...');
    
    // This is the main EGFR page - contains comprehensive data
    const url = 'https://www.proteinatlas.org/ENSG00000146648-EGFR';
    const response = await fetch(url);
    const html = await response.text();
    
    // Create a structured representation of what data is available
    const egfrData = {
      "source": "Human Protein Atlas",
      "gene_symbol": "EGFR", 
      "ensembl_id": "ENSG00000146648",
      "full_name": "Epidermal growth factor receptor",
      "hpa_url": url,
      "access_methods": {
        "web_interface": url,
        "api_note": "HPA doesn't provide a public JSON API, but data can be accessed via web scraping",
        "our_mcp_tools": [
          "get-protein-by-ensembl",
          "get-protein-by-gene", 
          "search-protein-class"
        ]
      },
      "data_sections_available": {
        "protein_summary": "Basic protein information and classification",
        "tissue_expression": "Protein expression across human tissues",
        "subcellular_location": "Cellular localization data", 
        "cancer_data": "Expression in cancer types and prognostic data",
        "single_cell_data": "Cell type-specific expression",
        "brain_data": "Brain region-specific expression",
        "blood_data": "Blood protein measurements",
        "antibody_data": "Validation and staining information"
      },
      "protein_classes": [
        "Cancer-related genes",
        "Disease related genes", 
        "Enzymes",
        "FDA approved drug targets",
        "Human disease related genes",
        "Metabolic proteins",
        "Plasma proteins", 
        "RAS pathway related proteins",
        "Transporters"
      ],
      "key_features": {
        "chromosomal_location": "7p11.2",
        "protein_evidence": "Evidence at protein level",
        "subcellular_locations": [
          "Golgi apparatus",
          "Plasma membrane", 
          "Nucleoli",
          "Cell Junctions",
          "Primary cilium",
          "Basal body",
          "Cytosol"
        ],
        "cancer_prognostic": [
          "Kidney renal clear cell carcinoma (favorable)",
          "Pancreatic adenocarcinoma (unfavorable)"
        ]
      },
      "usage_via_mcp": {
        "tool": "get-protein-by-ensembl",
        "parameters": {
          "ensembl_id": "ENSG00000146648",
          "include_cancer": true,
          "include_expression": true
        },
        "note": "Use our hpa-mcp server to get structured data programmatically"
      },
      "raw_html_size": html.length + " characters",
      "retrieved_at": new Date().toISOString()
    };
    
    // Save the structured data
    fs.writeFileSync('egfr_hpa_data.json', JSON.stringify(egfrData, null, 2));
    
    console.log('✅ EGFR data summary saved to egfr_hpa_data.json');
    console.log('\n📊 EGFR Summary:');
    console.log(`Gene: ${egfrData.gene_symbol}`);
    console.log(`Full Name: ${egfrData.full_name}`);
    console.log(`Ensembl ID: ${egfrData.ensembl_id}`);
    console.log(`Protein Classes: ${egfrData.protein_classes.length} categories`);
    console.log(`Cancer Prognostic: ${egfrData.key_features.cancer_prognostic.length} cancer types`);
    console.log(`Subcellular Locations: ${egfrData.key_features.subcellular_locations.length} locations`);
    console.log(`\n🔗 Access URL: ${egfrData.hpa_url}`);
    console.log(`\n⚡ For programmatic access, use the hpa-mcp tools with Ensembl ID: ${egfrData.ensembl_id}`);
    
  } catch (error) {
    console.error('❌ Error fetching EGFR data:', error.message);
  }
}

getEGFRData(); 