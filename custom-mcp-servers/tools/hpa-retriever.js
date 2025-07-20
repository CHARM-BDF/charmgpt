const axios = require('axios');

class HPARetriever {
    constructor() {
        this.baseUrl = 'https://www.proteinatlas.org';
    }

    /**
     * Retrieve Human Protein Atlas data by Ensembl ID
     */
    async getHPAData(ensemblId) {
        try {
            const url = `${this.baseUrl}/${ensemblId}.json`;
            console.log(`🔬 Retrieving Human Protein Atlas data for: ${ensemblId}`);
            
            const response = await axios.get(url);
            console.log(`✅ Successfully retrieved HPA data`);
            
            return response.data;
        } catch (error) {
            if (error.response && error.response.status === 404) {
                console.log(`ℹ️  No Human Protein Atlas data found for ${ensemblId}`);
                return null;
            }
            console.error(`❌ Error retrieving HPA data for ${ensemblId}:`, error.message);
            throw error;
        }
    }

    /**
     * Parse and summarize HPA data into readable format
     */
    parseHPAData(hpaData) {
        if (!hpaData) return null;

        const summary = {
            // Basic gene information
            gene: hpaData.Gene || 'N/A',
            geneDescription: hpaData['Gene description'] || 'N/A',
            ensemblId: hpaData.Ensembl || 'N/A',
            uniprot: hpaData.Uniprot || [],
            chromosome: hpaData.Chromosome || 'N/A',
            position: hpaData.Position || 'N/A',

            // Protein classification
            proteinClass: hpaData['Protein class'] || [],
            biologicalProcess: hpaData['Biological process'] || [],
            molecularFunction: hpaData['Molecular function'] || [],
            
            // Evidence and reliability
            evidence: hpaData.Evidence || 'N/A',
            hpaEvidence: hpaData['HPA evidence'] || 'N/A',
            uniprotEvidence: hpaData['UniProt evidence'] || 'N/A',
            
            // Subcellular localization
            subcellularLocation: hpaData['Subcellular location'] || [],
            subcellularMainLocation: hpaData['Subcellular main location'] || [],
            
            // RNA expression
            rnaTissueSpecificity: hpaData['RNA tissue specificity'] || 'N/A',
            rnaTissueDistribution: hpaData['RNA tissue distribution'] || 'N/A',
            rnaCellTypeSpecificity: hpaData['RNA single cell type specificity'] || 'N/A',
            rnaCancerSpecificity: hpaData['RNA cancer specificity'] || 'N/A',
            
            // Disease involvement
            diseaseInvolvement: hpaData['Disease involvement'] || [],
            
            // Cancer prognostics (simplified - just count significant ones)
            cancerPrognostics: this.summarizeCancerPrognostics(hpaData),
            
            // Interactions and antibodies
            interactions: hpaData.Interactions || 0,
            antibodies: hpaData.Antibody || [],
            
            // Blood and secretome
            bloodConcentration: this.getBloodConcentration(hpaData),
            secretomeLocation: hpaData['Secretome location'] || null,
            
            // Expression clusters
            tissueExpressionCluster: hpaData['Tissue expression cluster'] || 'N/A',
            cellLineExpressionCluster: hpaData['Cell line expression cluster'] || 'N/A',
            singleCellExpressionCluster: hpaData['Single cell expression cluster'] || 'N/A'
        };

        return summary;
    }

    /**
     * Summarize cancer prognostics data
     */
    summarizeCancerPrognostics(hpaData) {
        const prognostics = {
            totalCancerTypes: 0,
            prognosticCancers: [],
            unprognosticCancers: [],
            favorablePrognosis: [],
            unfavorablePrognosis: []
        };

        // Look for cancer prognostics fields
        Object.keys(hpaData).forEach(key => {
            if (key.startsWith('Cancer prognostics -')) {
                const cancerType = key.replace('Cancer prognostics - ', '').replace(' (TCGA)', '').replace(' (validation)', '');
                const data = hpaData[key];
                
                prognostics.totalCancerTypes++;
                
                if (data.is_prognostic) {
                    prognostics.prognosticCancers.push({
                        cancer: cancerType,
                        type: data['prognostic type'],
                        prognostic: data.prognostic,
                        pValue: data.p_val
                    });
                    
                    if (data['prognostic type'] === 'favorable') {
                        prognostics.favorablePrognosis.push(cancerType);
                    } else if (data['prognostic type'] === 'unfavorable') {
                        prognostics.unfavorablePrognosis.push(cancerType);
                    }
                } else {
                    prognostics.unprognosticCancers.push(cancerType);
                }
            }
        });

        return prognostics;
    }

    /**
     * Get blood concentration data
     */
    getBloodConcentration(hpaData) {
        const bloodIM = hpaData['Blood concentration - Conc. blood IM [pg/L]'];
        const bloodMS = hpaData['Blood concentration - Conc. blood MS [pg/L]'];
        
        if (bloodIM || bloodMS) {
            return {
                immunoassay: bloodIM || 'N/A',
                massSpectrometry: bloodMS || 'N/A'
            };
        }
        return null;
    }

    /**
     * Display HPA data in a formatted way
     */
    displayHPAData(hpaData, summary) {
        console.log('\n' + '='.repeat(80));
        console.log('🔬 HUMAN PROTEIN ATLAS DATA');
        console.log('='.repeat(80));
        
        // Basic information
        console.log(`🧬 Gene: ${summary.gene}`);
        console.log(`📝 Description: ${summary.geneDescription}`);
        console.log(`🆔 Ensembl ID: ${summary.ensemblId}`);
        console.log(`🔗 UniProt: ${summary.uniprot.join(', ') || 'N/A'}`);
        console.log(`📍 Chromosome: ${summary.chromosome} (${summary.position})`);
        
        // Protein classification
        if (summary.proteinClass.length > 0) {
            console.log(`🏷️  Protein Class: ${summary.proteinClass.join(', ')}`);
        }
        if (summary.biologicalProcess.length > 0) {
            console.log(`⚙️  Biological Process: ${summary.biologicalProcess.join(', ')}`);
        }
        if (summary.molecularFunction.length > 0) {
            console.log(`🔧 Molecular Function: ${summary.molecularFunction.join(', ')}`);
        }
        
        // Evidence
        console.log(`✅ Evidence Level: ${summary.evidence}`);
        
        // Subcellular localization
        if (summary.subcellularMainLocation.length > 0) {
            console.log(`📍 Subcellular Location: ${summary.subcellularMainLocation.join(', ')}`);
        }
        
        // Expression summary
        console.log('\n' + '-'.repeat(80));
        console.log('📊 EXPRESSION SUMMARY');
        console.log('-'.repeat(80));
        console.log(`🧪 Tissue Specificity: ${summary.rnaTissueSpecificity}`);
        console.log(`📍 Tissue Distribution: ${summary.rnaTissueDistribution}`);
        console.log(`🦠 Cell Type Specificity: ${summary.rnaCellTypeSpecificity}`);
        console.log(`🎯 Cancer Specificity: ${summary.rnaCancerSpecificity}`);
        
        // Disease involvement
        if (summary.diseaseInvolvement.length > 0) {
            console.log('\n' + '-'.repeat(80));
            console.log('🩺 DISEASE INVOLVEMENT');
            console.log('-'.repeat(80));
            console.log(`💉 Disease Categories: ${summary.diseaseInvolvement.join(', ')}`);
        }
        
        // Cancer prognostics
        if (summary.cancerPrognostics.prognosticCancers.length > 0) {
            console.log('\n' + '-'.repeat(80));
            console.log('🎯 CANCER PROGNOSTICS');
            console.log('-'.repeat(80));
            console.log(`📊 Total Cancer Types Analyzed: ${summary.cancerPrognostics.totalCancerTypes}`);
            console.log(`✅ Prognostic in ${summary.cancerPrognostics.prognosticCancers.length} cancer type(s)`);
            
            if (summary.cancerPrognostics.unfavorablePrognosis.length > 0) {
                console.log(`⚠️  Unfavorable Prognosis: ${summary.cancerPrognostics.unfavorablePrognosis.slice(0, 5).join(', ')}${summary.cancerPrognostics.unfavorablePrognosis.length > 5 ? ` (+${summary.cancerPrognostics.unfavorablePrognosis.length - 5} more)` : ''}`);
            }
            if (summary.cancerPrognostics.favorablePrognosis.length > 0) {
                console.log(`✅ Favorable Prognosis: ${summary.cancerPrognostics.favorablePrognosis.join(', ')}`);
            }
        }
        
        // Additional info
        console.log('\n' + '-'.repeat(80));
        console.log('📋 ADDITIONAL INFORMATION');
        console.log('-'.repeat(80));
        console.log(`🔗 Protein Interactions: ${summary.interactions}`);
        console.log(`💉 Available Antibodies: ${summary.antibodies.length}`);
        
        if (summary.bloodConcentration) {
            console.log(`🩸 Blood Concentration Available: Yes`);
        }
        
        console.log('\n' + '='.repeat(80));
        console.log(`🔗 HPA Link: https://www.proteinatlas.org/${summary.ensemblId}`);
        console.log('='.repeat(80) + '\n');
    }

    /**
     * Get Human Protein Atlas information for a gene by gene symbol
     * This method handles the gene symbol -> Ensembl ID lookup
     */
    async getHPAInfo(geneSymbol) {
        try {
            console.log(`🔍 Looking up HPA info for gene symbol: ${geneSymbol}`);
            
            // First, we need to get the gene info to find the Ensembl ID
            const GeneRetriever = require('./gene-retriever');
            const geneRetriever = new GeneRetriever();
            const geneInfo = await geneRetriever.retrieveGeneInfo(geneSymbol);
            
            if (!geneInfo || !geneInfo.ensemblId) {
                console.log(`❌ No Ensembl ID found for gene symbol: ${geneSymbol}`);
                return null;
            }
            
            console.log(`📍 Found Ensembl ID: ${geneInfo.ensemblId} for ${geneSymbol}`);
            
            // Get HPA data using the Ensembl ID
            const hpaData = await this.getHPAData(geneInfo.ensemblId);
            
            if (!hpaData) {
                console.log(`ℹ️  No Human Protein Atlas data available for ${geneInfo.ensemblId}`);
                return null;
            }
            
            const summary = this.parseHPAData(hpaData);
            
            return {
                ensemblId: geneInfo.ensemblId,
                hpaData: hpaData,
                summary: summary
            };
            
        } catch (error) {
            console.error(`❌ Failed to get HPA info for gene symbol ${geneSymbol}:`, error.message);
            return null;
        }
    }

    /**
     * Retrieve and display comprehensive HPA information
     */
    async retrieveHPAInfo(ensemblId) {
        try {
            console.log(`\n🔬 Starting Human Protein Atlas retrieval for: ${ensemblId}\n`);
            
            const hpaData = await this.getHPAData(ensemblId);
            
            if (!hpaData) {
                console.log(`ℹ️  No Human Protein Atlas data available for ${ensemblId}`);
                return null;
            }
            
            const summary = this.parseHPAData(hpaData);
            this.displayHPAData(hpaData, summary);
            
            return {
                ensemblId: ensemblId,
                hpaData: hpaData,
                summary: summary
            };
        } catch (error) {
            console.error(`❌ Failed to retrieve HPA information:`, error.message);
            throw error;
        }
    }
}

// Main execution function
async function main() {
    const hpaRetriever = new HPARetriever();
    
    // Get Ensembl ID from command line arguments or use EGFR as default
    const ensemblId = process.argv[2] || 'ENSG00000146648'; // EGFR
    
    try {
        console.log('🚀 PMI Case Data Tools - Human Protein Atlas Retriever');
        console.log('=====================================================');
        
        const hpaInfo = await hpaRetriever.retrieveHPAInfo(ensemblId);
        
        if (hpaInfo) {
            // Optional: Save to JSON file
            const fs = require('fs');
            const geneSymbol = hpaInfo.summary ? hpaInfo.summary.gene : 'unknown';
            const filename = `hpa_data_${geneSymbol}_${ensemblId}_${new Date().toISOString().split('T')[0]}.json`;
            fs.writeFileSync(filename, JSON.stringify(hpaInfo, null, 2));
            console.log(`💾 HPA data saved to: ${filename}`);
        }
        
    } catch (error) {
        console.error('❌ Application failed:', error.message);
        process.exit(1);
    }
}

// Export the class for use in other modules
module.exports = HPARetriever;

// Run the main function if this script is executed directly
if (require.main === module) {
    main();
} 