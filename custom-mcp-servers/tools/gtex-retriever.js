const axios = require('axios');

class GTExRetriever {
    constructor() {
        this.baseUrl = 'https://gtexportal.org/api/v2';
    }

    /**
     * Get versioned Ensembl ID (gencodeId) from GTEx using gene symbol or unversioned Ensembl ID
     */
    async getVersionedEnsemblId(geneIdentifier) {
        try {
            console.log(`🔗 Getting versioned Ensembl ID for: ${geneIdentifier}`);
            
            const response = await axios.get(`${this.baseUrl}/reference/gene`, {
                params: { geneId: geneIdentifier }
            });

            if (response.data && response.data.data && response.data.data.length > 0) {
                const geneData = response.data.data[0];
                console.log(`✅ Found versioned ID: ${geneData.gencodeId}`);
                return {
                    success: true,
                    gencodeId: geneData.gencodeId,
                    geneInfo: geneData
                };
            } else {
                console.log(`❌ No gene found for identifier: ${geneIdentifier}`);
                return {
                    success: false,
                    error: `No gene found for identifier: ${geneIdentifier}`
                };
            }
        } catch (error) {
            console.error(`❌ Error getting versioned Ensembl ID:`, error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Get median gene expression across all GTEx tissues
     */
    async getMedianGeneExpression(gencodeId) {
        try {
            console.log(`📊 Getting GTEx expression data for: ${gencodeId}`);
            
            const response = await axios.get(`${this.baseUrl}/expression/medianGeneExpression`, {
                params: { gencodeId: gencodeId }
            });

            if (response.data && response.data.data && response.data.data.length > 0) {
                const expressionData = response.data.data;
                console.log(`✅ Retrieved expression data for ${expressionData.length} tissues`);
                
                return {
                    success: true,
                    data: expressionData,
                    summary: this.summarizeExpressionData(expressionData)
                };
            } else {
                console.log(`❌ No expression data found for: ${gencodeId}`);
                return {
                    success: false,
                    error: `No expression data found for: ${gencodeId}`
                };
            }
        } catch (error) {
            console.error(`❌ Error getting expression data:`, error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Get comprehensive GTEx data (gene info + expression) using any gene identifier
     */
    async getComprehensiveGTExData(geneIdentifier) {
        try {
            console.log(`\n🧬 Starting GTEx comprehensive analysis for: ${geneIdentifier}`);
            
            // Step 1: Get versioned Ensembl ID
            const geneResult = await this.getVersionedEnsemblId(geneIdentifier);
            if (!geneResult.success) {
                return geneResult;
            }

            // Step 2: Get expression data
            const expressionResult = await this.getMedianGeneExpression(geneResult.gencodeId);
            if (!expressionResult.success) {
                return expressionResult;
            }

            // Step 3: Combine results
            return {
                success: true,
                data: {
                    geneInfo: geneResult.geneInfo,
                    expressionData: expressionResult.data,
                    expressionSummary: expressionResult.summary
                }
            };
        } catch (error) {
            console.error(`❌ GTEx comprehensive analysis failed:`, error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Summarize expression data to identify key patterns
     */
    summarizeExpressionData(expressionData) {
        if (!expressionData || expressionData.length === 0) {
            return null;
        }

        // Sort by expression level
        const sortedData = [...expressionData].sort((a, b) => b.median - a.median);
        
        // Calculate statistics
        const values = expressionData.map(d => d.median);
        const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
        const median = values.sort((a, b) => a - b)[Math.floor(values.length / 2)];
        const max = Math.max(...values);
        const min = Math.min(...values);

        // Identify expression categories
        const highExpression = sortedData.filter(d => d.median > mean + (max - mean) * 0.3);
        const lowExpression = sortedData.filter(d => d.median < mean * 0.3);
        const brainTissues = expressionData.filter(d => d.tissueSiteDetailId.includes('Brain'));
        const skinTissues = expressionData.filter(d => d.tissueSiteDetailId.includes('Skin'));

        return {
            statistics: {
                tissueCount: expressionData.length,
                meanExpression: Math.round(mean * 100) / 100,
                medianExpression: Math.round(median * 100) / 100,
                maxExpression: max,
                minExpression: min,
                unit: expressionData[0]?.unit || 'TPM'
            },
            topExpressingTissues: sortedData.slice(0, 5).map(d => ({
                tissue: d.tissueSiteDetailId.replace(/_/g, ' '),
                expression: d.median,
                unit: d.unit
            })),
            lowestExpressingTissues: sortedData.slice(-5).map(d => ({
                tissue: d.tissueSiteDetailId.replace(/_/g, ' '),
                expression: d.median,
                unit: d.unit
            })),
            highExpressingTissues: highExpression.map(d => ({
                tissue: d.tissueSiteDetailId.replace(/_/g, ' '),
                expression: d.median,
                unit: d.unit
            })),
            lowExpressingTissues: lowExpression.map(d => ({
                tissue: d.tissueSiteDetailId.replace(/_/g, ' '),
                expression: d.median,
                unit: d.unit
            })),
            brainExpression: {
                tissueCount: brainTissues.length,
                meanExpression: brainTissues.length > 0 ? 
                    Math.round((brainTissues.reduce((sum, t) => sum + t.median, 0) / brainTissues.length) * 100) / 100 : 0,
                tissues: brainTissues.map(d => ({
                    tissue: d.tissueSiteDetailId.replace(/_/g, ' '),
                    expression: d.median,
                    unit: d.unit
                }))
            },
            skinExpression: skinTissues.length > 0 ? {
                meanExpression: Math.round((skinTissues.reduce((sum, t) => sum + t.median, 0) / skinTissues.length) * 100) / 100,
                tissues: skinTissues.map(d => ({
                    tissue: d.tissueSiteDetailId.replace(/_/g, ' '),
                    expression: d.median,
                    unit: d.unit
                }))
            } : null
        };
    }

    /**
     * Display GTEx expression summary
     */
    displayGTExSummary(gtexData) {
        if (!gtexData.success) {
            console.log(`❌ GTEx data not available: ${gtexData.error}`);
            return;
        }

        const { geneInfo, expressionSummary } = gtexData.data;
        
        console.log('\n' + '='.repeat(80));
        console.log('🧬 GTEx TISSUE EXPRESSION ANALYSIS');
        console.log('='.repeat(80));
        
        console.log(`🔬 Gene: ${geneInfo.geneSymbol} (${geneInfo.gencodeId})`);
        console.log(`📊 Dataset: ${geneInfo.geneType} | Build: ${geneInfo.genomeBuild}`);
        console.log(`📍 Location: ${geneInfo.chromosome}:${geneInfo.start}-${geneInfo.end} (${geneInfo.strand})`);
        
        const stats = expressionSummary.statistics;
        console.log(`\n📈 Expression Statistics (${stats.unit}):`);
        console.log(`   Tissues: ${stats.tissueCount} | Mean: ${stats.meanExpression} | Range: ${stats.minExpression}-${stats.maxExpression}`);
        
        console.log(`\n🔝 Top Expressing Tissues:`);
        expressionSummary.topExpressingTissues.forEach((t, i) => {
            console.log(`   ${i + 1}. ${t.tissue}: ${t.expression} ${t.unit}`);
        });
        
        if (expressionSummary.brainExpression.tissueCount > 0) {
            console.log(`\n🧠 Brain Expression (${expressionSummary.brainExpression.tissueCount} regions):`);
            console.log(`   Mean: ${expressionSummary.brainExpression.meanExpression} ${stats.unit}`);
            expressionSummary.brainExpression.tissues.slice(0, 3).forEach(t => {
                console.log(`   • ${t.tissue}: ${t.expression} ${t.unit}`);
            });
        }
        
        if (expressionSummary.skinExpression) {
            console.log(`\n🌟 Skin Expression:`);
            console.log(`   Mean: ${expressionSummary.skinExpression.meanExpression} ${stats.unit}`);
            expressionSummary.skinExpression.tissues.forEach(t => {
                console.log(`   • ${t.tissue}: ${t.expression} ${t.unit}`);
            });
        }
        
        console.log('\n' + '='.repeat(80));
    }
}

module.exports = GTExRetriever; 