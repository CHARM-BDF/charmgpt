const axios = require('axios');

class EnhancedHPARetriever {
    constructor() {
        this.baseUrl = 'https://www.proteinatlas.org';
    }

    /**
     * Retrieve comprehensive HPA data with detailed expression analysis
     */
    async getDetailedHPAData(ensemblId) {
        try {
            const url = `${this.baseUrl}/${ensemblId}.json`;
            console.log(`🔬 Retrieving detailed HPA expression data for: ${ensemblId}`);
            
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
     * Extract detailed expression data with relative levels
     */
    extractExpressionData(hpaData) {
        if (!hpaData) return null;

        const expressionData = {
            // RNA Expression Levels
            rnaExpression: {
                // Tissue-specific expression (nTPM values)
                tissueSpecific: {
                    specificity: hpaData['RNA tissue specificity'] || 'N/A',
                    distribution: hpaData['RNA tissue distribution'] || 'N/A',
                    specificityScore: hpaData['RNA tissue specificity score'],
                    values: hpaData['RNA tissue specific nTPM'] || {},
                    cluster: hpaData['Tissue expression cluster'] || 'N/A'
                },

                // Single cell type expression
                singleCellType: {
                    specificity: hpaData['RNA single cell type specificity'] || 'N/A',
                    distribution: hpaData['RNA single cell type distribution'] || 'N/A',
                    specificityScore: hpaData['RNA single cell type specificity score'],
                    values: hpaData['RNA single cell type specific nTPM'] || {},
                    cluster: hpaData['Single cell expression cluster'] || 'N/A'
                },

                // Brain-specific expression
                brainRegional: {
                    specificity: hpaData['RNA brain regional specificity'] || 'N/A',
                    distribution: hpaData['RNA brain regional distribution'] || 'N/A',
                    specificityScore: hpaData['RNA brain regional specificity score'],
                    values: hpaData['RNA brain regional specific nTPM'] || {}
                },

                // Single nuclei brain expression
                brainSingleNuclei: {
                    specificity: hpaData['RNA single nuclei brain specificity'] || 'N/A',
                    distribution: hpaData['RNA single nuclei brain distribution'] || 'N/A',
                    specificityScore: hpaData['RNA single nuclei brain specificity score'],
                    values: hpaData['RNA single nuclei brain specific nTPM'] || {},
                    cluster: hpaData['Brain expression cluster'] || 'N/A'
                },

                // Blood cell expression
                bloodCells: {
                    specificity: hpaData['RNA blood cell specificity'] || 'N/A',
                    distribution: hpaData['RNA blood cell distribution'] || 'N/A',
                    specificityScore: hpaData['RNA blood cell specificity score'],
                    values: hpaData['RNA blood cell specific nTPM'] || {},
                    cluster: hpaData['Blood expression cluster']
                },

                // Blood lineage expression
                bloodLineage: {
                    specificity: hpaData['RNA blood lineage specificity'] || 'N/A',
                    distribution: hpaData['RNA blood lineage distribution'] || 'N/A',
                    specificityScore: hpaData['RNA blood lineage specificity score'],
                    values: hpaData['RNA blood lineage specific nTPM'] || {}
                },

                // Cancer expression
                cancer: {
                    specificity: hpaData['RNA cancer specificity'] || 'N/A',
                    distribution: hpaData['RNA cancer distribution'] || 'N/A',
                    specificityScore: hpaData['RNA cancer specificity score'],
                    fpkmValues: hpaData['RNA cancer specific FPKM'] || {}
                },

                // Cell line expression
                cellLines: {
                    specificity: hpaData['RNA cell line specificity'] || 'N/A',
                    distribution: hpaData['RNA cell line distribution'] || 'N/A',
                    specificityScore: hpaData['RNA cell line specificity score'],
                    values: hpaData['RNA cell line specific nTPM'] || {},
                    cluster: hpaData['Cell line expression cluster'] || 'N/A'
                },

                // Tissue cell type enrichment
                tissueEnrichment: hpaData['RNA tissue cell type enrichment'] || []
            },

            // Protein Expression Levels
            proteinExpression: {
                bloodConcentration: {
                    immunoassay: hpaData['Blood concentration - Conc. blood IM [pg/L]'],
                    massSpectrometry: hpaData['Blood concentration - Conc. blood MS [pg/L]']
                },
                reliability: {
                    immunohistochemistry: hpaData['Reliability (IH)'],
                    immunofluorescence: hpaData['Reliability (IF)'],
                    mouseBrain: hpaData['Reliability (Mouse Brain)']
                },
                subcellularLocation: {
                    main: hpaData['Subcellular main location'] || [],
                    additional: hpaData['Subcellular additional location'] || [],
                    all: hpaData['Subcellular location'] || []
                }
            },

            // Cross-species data
            crossSpecies: {
                mouseBrain: {
                    specificity: hpaData['RNA mouse brain regional specificity'] || 'N/A',
                    distribution: hpaData['RNA mouse brain regional distribution'] || 'N/A',
                    specificityScore: hpaData['RNA mouse brain regional specificity score'],
                    values: hpaData['RNA mouse brain regional specific nTPM'] || {}
                },
                pigBrain: {
                    specificity: hpaData['RNA pig brain regional specificity'] || 'N/A',
                    distribution: hpaData['RNA pig brain regional distribution'] || 'N/A',
                    specificityScore: hpaData['RNA pig brain regional specificity score'],
                    values: hpaData['RNA pig brain regional specific nTPM'] || {}
                }
            }
        };

        return expressionData;
    }

    /**
     * Analyze and rank expression levels
     */
    analyzeExpressionLevels(expressionData) {
        const analysis = {
            topTissues: [],
            topCellTypes: [],
            topBrainRegions: [],
            cancerExpression: [],
            summary: {
                hasDetectableExpression: false,
                highestExpressionContext: 'N/A',
                highestValue: 0,
                unit: 'N/A'
            }
        };

        if (!expressionData) return analysis;

        // Analyze tissue-specific expression
        const tissueValues = expressionData.rnaExpression.tissueSpecific.values;
        if (tissueValues && Object.keys(tissueValues).length > 0) {
            analysis.topTissues = Object.entries(tissueValues)
                .map(([tissue, value]) => ({ tissue, value: parseFloat(value), unit: 'nTPM' }))
                .sort((a, b) => b.value - a.value);
        }

        // Analyze single cell type expression
        const cellTypeValues = expressionData.rnaExpression.singleCellType.values;
        if (cellTypeValues && Object.keys(cellTypeValues).length > 0) {
            analysis.topCellTypes = Object.entries(cellTypeValues)
                .map(([cellType, value]) => ({ cellType, value: parseFloat(value), unit: 'nTPM' }))
                .sort((a, b) => b.value - a.value);
        }

        // Analyze brain-specific expression
        const brainValues = expressionData.rnaExpression.brainSingleNuclei.values;
        if (brainValues && Object.keys(brainValues).length > 0) {
            analysis.topBrainRegions = Object.entries(brainValues)
                .map(([region, value]) => ({ region, value: parseFloat(value), unit: 'nTPM' }))
                .sort((a, b) => b.value - a.value);
        }

        // Analyze cancer expression
        const cancerValues = expressionData.rnaExpression.cancer.fpkmValues;
        if (cancerValues && Object.keys(cancerValues).length > 0) {
            analysis.cancerExpression = Object.entries(cancerValues)
                .map(([cancer, value]) => ({ cancer, value: parseFloat(value), unit: 'FPKM' }))
                .sort((a, b) => b.value - a.value);
        }

        // Find highest expression overall
        const allValues = [
            ...analysis.topTissues,
            ...analysis.topCellTypes,
            ...analysis.topBrainRegions,
            ...analysis.cancerExpression
        ];

        if (allValues.length > 0) {
            analysis.summary.hasDetectableExpression = true;
            const highest = allValues.reduce((max, current) => 
                current.value > max.value ? current : max
            );
            analysis.summary.highestValue = highest.value;
            analysis.summary.unit = highest.unit;
            analysis.summary.highestExpressionContext = 
                highest.tissue || highest.cellType || highest.region || highest.cancer || 'Unknown';
        }

        return analysis;
    }

    /**
     * Display detailed expression analysis
     */
    displayDetailedExpression(ensemblId, hpaData, expressionData, analysis) {
        console.log('\n' + '='.repeat(80));
        console.log('📊 DETAILED EXPRESSION ANALYSIS');
        console.log('='.repeat(80));

        // Overall summary
        console.log(`🧬 Gene: ${hpaData.Gene || 'N/A'}`);
        console.log(`🆔 Ensembl ID: ${ensemblId}`);
        
        if (analysis.summary.hasDetectableExpression) {
            console.log(`🔝 Highest Expression: ${analysis.summary.highestValue} ${analysis.summary.unit} in ${analysis.summary.highestExpressionContext}`);
        } else {
            console.log(`📊 Expression Level: Low/Not detected in available datasets`);
        }

        // Tissue-specific expression
        if (analysis.topTissues.length > 0) {
            console.log('\n' + '-'.repeat(80));
            console.log('🧪 TISSUE-SPECIFIC EXPRESSION (nTPM)');
            console.log('-'.repeat(80));
            console.log(`📋 Specificity: ${expressionData.rnaExpression.tissueSpecific.specificity}`);
            console.log(`📍 Distribution: ${expressionData.rnaExpression.tissueSpecific.distribution}`);
            console.log(`🏷️  Expression Cluster: ${expressionData.rnaExpression.tissueSpecific.cluster}`);
            console.log('\n📊 Top expressing tissues:');
            analysis.topTissues.slice(0, 10).forEach((item, index) => {
                console.log(`   ${index + 1}. ${item.tissue}: ${item.value} ${item.unit}`);
            });
        }

        // Single cell type expression
        if (analysis.topCellTypes.length > 0) {
            console.log('\n' + '-'.repeat(80));
            console.log('🦠 SINGLE CELL TYPE EXPRESSION (nTPM)');
            console.log('-'.repeat(80));
            console.log(`📋 Specificity: ${expressionData.rnaExpression.singleCellType.specificity}`);
            console.log(`📍 Distribution: ${expressionData.rnaExpression.singleCellType.distribution}`);
            console.log(`🏷️  Expression Cluster: ${expressionData.rnaExpression.singleCellType.cluster}`);
            console.log('\n📊 Top expressing cell types:');
            analysis.topCellTypes.slice(0, 10).forEach((item, index) => {
                console.log(`   ${index + 1}. ${item.cellType}: ${item.value} ${item.unit}`);
            });
        }

        // Brain-specific expression
        if (analysis.topBrainRegions.length > 0) {
            console.log('\n' + '-'.repeat(80));
            console.log('🧠 BRAIN REGION EXPRESSION (nTPM)');
            console.log('-'.repeat(80));
            console.log(`📋 Specificity: ${expressionData.rnaExpression.brainSingleNuclei.specificity}`);
            console.log(`📍 Distribution: ${expressionData.rnaExpression.brainSingleNuclei.distribution}`);
            console.log(`🏷️  Expression Cluster: ${expressionData.rnaExpression.brainSingleNuclei.cluster}`);
            console.log('\n📊 Top expressing brain regions:');
            analysis.topBrainRegions.slice(0, 10).forEach((item, index) => {
                console.log(`   ${index + 1}. ${item.region}: ${item.value} ${item.unit}`);
            });
        }

        // Cancer expression
        if (analysis.cancerExpression.length > 0) {
            console.log('\n' + '-'.repeat(80));
            console.log('🎯 CANCER EXPRESSION (FPKM)');
            console.log('-'.repeat(80));
            console.log(`📋 Specificity: ${expressionData.rnaExpression.cancer.specificity}`);
            console.log(`📍 Distribution: ${expressionData.rnaExpression.cancer.distribution}`);
            console.log('\n📊 Cancer type expression:');
            analysis.cancerExpression.forEach((item, index) => {
                console.log(`   ${index + 1}. ${item.cancer}: ${item.value} ${item.unit}`);
            });
        }

        // Blood and immune cell expression
        const bloodData = expressionData.rnaExpression.bloodCells;
        if (bloodData.distribution !== 'Not detected') {
            console.log('\n' + '-'.repeat(80));
            console.log('🩸 BLOOD CELL EXPRESSION');
            console.log('-'.repeat(80));
            console.log(`📋 Specificity: ${bloodData.specificity}`);
            console.log(`📍 Distribution: ${bloodData.distribution}`);
        }

        // Protein levels in blood
        const proteinBlood = expressionData.proteinExpression.bloodConcentration;
        if (proteinBlood.immunoassay || proteinBlood.massSpectrometry) {
            console.log('\n' + '-'.repeat(80));
            console.log('🔬 BLOOD PROTEIN CONCENTRATION');
            console.log('-'.repeat(80));
            if (proteinBlood.immunoassay) {
                console.log(`💉 Immunoassay: ${proteinBlood.immunoassay} pg/L`);
            }
            if (proteinBlood.massSpectrometry) {
                console.log(`⚗️  Mass Spectrometry: ${proteinBlood.massSpectrometry} pg/L`);
            }
        }

        // Tissue enrichment patterns
        if (expressionData.rnaExpression.tissueEnrichment.length > 0) {
            console.log('\n' + '-'.repeat(80));
            console.log('🎯 TISSUE CELL TYPE ENRICHMENT');
            console.log('-'.repeat(80));
            expressionData.rnaExpression.tissueEnrichment.forEach((enrichment, index) => {
                console.log(`   ${index + 1}. ${enrichment}`);
            });
        }

        console.log('\n' + '='.repeat(80));
        console.log(`🔗 HPA Expression Link: https://www.proteinatlas.org/${ensemblId}/tissue`);
        console.log('='.repeat(80) + '\n');
    }

    /**
     * Get detailed expression information for a gene by gene symbol
     * This method handles the gene symbol -> Ensembl ID lookup
     */
    async getDetailedExpressionInfo(geneSymbol) {
        try {
            console.log(`🔍 Looking up detailed expression info for gene symbol: ${geneSymbol}`);
            
            // First, we need to get the gene info to find the Ensembl ID
            const GeneRetriever = require('./gene-retriever');
            const geneRetriever = new GeneRetriever();
            const geneInfo = await geneRetriever.retrieveGeneInfo(geneSymbol);
            
            if (!geneInfo || !geneInfo.ensemblId) {
                console.log(`❌ No Ensembl ID found for gene symbol: ${geneSymbol}`);
                return null;
            }
            
            console.log(`📍 Found Ensembl ID: ${geneInfo.ensemblId} for ${geneSymbol}`);
            
            // Get detailed HPA expression data using the Ensembl ID
            const hpaData = await this.getDetailedHPAData(geneInfo.ensemblId);
            
            if (!hpaData) {
                console.log(`ℹ️  No Human Protein Atlas data available for ${geneInfo.ensemblId}`);
                return null;
            }
            
            const expressionData = this.extractExpressionData(hpaData);
            const analysis = this.analyzeExpressionLevels(expressionData);
            
            return {
                ensemblId: geneInfo.ensemblId,
                geneSymbol: hpaData.Gene,
                rawHPAData: hpaData,
                expressionData: expressionData,
                analysis: analysis,
                timestamp: new Date().toISOString()
            };
            
        } catch (error) {
            console.error(`❌ Failed to get detailed expression info for gene symbol ${geneSymbol}:`, error.message);
            return null;
        }
    }

    /**
     * Main function to retrieve and analyze detailed expression data
     */
    async retrieveDetailedExpression(ensemblId) {
        try {
            console.log(`\n🔬 Starting detailed expression analysis for: ${ensemblId}\n`);
            
            const hpaData = await this.getDetailedHPAData(ensemblId);
            
            if (!hpaData) {
                console.log(`ℹ️  No Human Protein Atlas data available for ${ensemblId}`);
                return null;
            }
            
            const expressionData = this.extractExpressionData(hpaData);
            const analysis = this.analyzeExpressionLevels(expressionData);
            
            this.displayDetailedExpression(ensemblId, hpaData, expressionData, analysis);
            
            return {
                ensemblId: ensemblId,
                geneSymbol: hpaData.Gene,
                rawHPAData: hpaData,
                expressionData: expressionData,
                analysis: analysis,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            console.error(`❌ Failed to retrieve detailed expression data:`, error.message);
            throw error;
        }
    }
}

// Main execution function
async function main() {
    const retriever = new EnhancedHPARetriever();
    
    // Get Ensembl ID from command line arguments or use EGFR as default
    const ensemblId = process.argv[2] || 'ENSG00000146648'; // EGFR
    
    try {
        console.log('🚀 PMI Case Data Tools - Enhanced HPA Expression Analyzer');
        console.log('========================================================');
        
        const result = await retriever.retrieveDetailedExpression(ensemblId);
        
        if (result) {
            // Save detailed analysis to JSON file
            const fs = require('fs');
            const geneSymbol = result.geneSymbol || 'unknown';
            const filename = `detailed_expression_${geneSymbol}_${ensemblId}_${new Date().toISOString().split('T')[0]}.json`;
            fs.writeFileSync(filename, JSON.stringify(result, null, 2));
            console.log(`💾 Detailed expression analysis saved to: ${filename}`);
        }
        
    } catch (error) {
        console.error('❌ Analysis failed:', error.message);
        process.exit(1);
    }
}

// Export the class for use in other modules
module.exports = EnhancedHPARetriever;

// Run the main function if this script is executed directly
if (require.main === module) {
    main();
} 