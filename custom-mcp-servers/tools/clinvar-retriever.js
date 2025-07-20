const axios = require('axios');
const xml2js = require('xml2js');

class ClinVarRetriever {
    constructor() {
        this.baseUrl = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';
        this.parser = new xml2js.Parser();
        this.email = 'user@example.com'; // Replace with your email for NCBI API requests
        this.tool = 'pmi-case-data-tools';
    }

    /**
     * Search ClinVar for variants in a specific gene
     */
    async searchClinVarVariants(geneSymbol, significance = 'pathogenic') {
        try {
            console.log(`🔍 Searching ClinVar for ${significance} variants in ${geneSymbol}`);
            
            // Build search query for ClinVar
            let searchTerm = `${geneSymbol}[gene]`;
            
            if (significance === 'pathogenic') {
                searchTerm += ' AND (pathogenic[significance] OR likely pathogenic[significance])';
            } else if (significance === 'benign') {
                searchTerm += ' AND (benign[significance] OR likely benign[significance])';
            } else if (significance !== 'all') {
                searchTerm += ` AND ${significance}[significance]`;
            }

            const searchUrl = `${this.baseUrl}/esearch.fcgi`;
            const searchParams = {
                db: 'clinvar',
                term: searchTerm,
                retmode: 'xml',
                retmax: 100, // Limit results to prevent overwhelming
                email: this.email,
                tool: this.tool
            };

            console.log(`🔍 ClinVar search query: ${searchTerm}`);
            const searchResponse = await axios.get(searchUrl, { params: searchParams });
            const searchResult = await this.parser.parseStringPromise(searchResponse.data);
            
            if (!searchResult.eSearchResult || !searchResult.eSearchResult.IdList || 
                !searchResult.eSearchResult.IdList[0].Id) {
                console.log(`ℹ️  No variants found in ClinVar for ${geneSymbol}`);
                return {
                    success: true,
                    data: {
                        geneSymbol,
                        variants: [],
                        totalCount: 0,
                        searchTerm,
                        significance
                    }
                };
            }

            const variantIds = searchResult.eSearchResult.IdList[0].Id;
            const totalCount = parseInt(searchResult.eSearchResult.Count[0]);
            console.log(`✅ Found ${variantIds.length} variants (${totalCount} total)`);

            // Fetch detailed information for the variants
            const variants = await this.fetchVariantDetails(variantIds);

            return {
                success: true,
                data: {
                    geneSymbol,
                    variants,
                    totalCount,
                    searchTerm,
                    significance,
                    retrievedCount: variantIds.length
                }
            };

        } catch (error) {
            console.error(`❌ Error searching ClinVar for ${geneSymbol}:`, error.message);
            return {
                success: false,
                error: error.message,
                geneSymbol
            };
        }
    }

    /**
     * Fetch detailed information for ClinVar variants
     */
    async fetchVariantDetails(variantIds) {
        try {
            console.log(`📄 Fetching details for ${variantIds.length} variants`);
            
            const fetchUrl = `${this.baseUrl}/esummary.fcgi`;
            const fetchParams = {
                db: 'clinvar',
                id: variantIds.join(','),
                retmode: 'xml',
                email: this.email,
                tool: this.tool
            };

            const fetchResponse = await axios.get(fetchUrl, { params: fetchParams });
            const fetchResult = await this.parser.parseStringPromise(fetchResponse.data);
            
            if (!fetchResult.eSummaryResult || !fetchResult.eSummaryResult.DocumentSummarySet ||
                !fetchResult.eSummaryResult.DocumentSummarySet[0].DocumentSummary) {
                console.log(`⚠️  No variant details found`);
                return [];
            }

            const summaries = fetchResult.eSummaryResult.DocumentSummarySet[0].DocumentSummary;
            const variants = summaries.map(summary => this.parseVariantSummary(summary));
            
            console.log(`✅ Parsed ${variants.length} variant details`);
            return variants;

        } catch (error) {
            console.error(`❌ Error fetching variant details:`, error.message);
            return [];
        }
    }

    /**
     * Parse ClinVar variant summary data
     */
    parseVariantSummary(summary) {
        try {
            return {
                clinvarId: summary.$.uid,
                variationId: summary.variation_id ? summary.variation_id[0] : 'N/A',
                title: summary.title ? summary.title[0] : 'N/A',
                clinical_significance: summary.clinical_significance ? summary.clinical_significance[0] : 'N/A',
                last_evaluated: summary.last_evaluated ? summary.last_evaluated[0] : 'N/A',
                review_status: summary.review_status ? summary.review_status[0] : 'N/A',
                chromosome: summary.chr ? summary.chr[0] : 'N/A',
                position: summary.chrpos ? summary.chrpos[0] : 'N/A',
                reference_allele: summary.ref ? summary.ref[0] : 'N/A',
                alternate_allele: summary.alt ? summary.alt[0] : 'N/A',
                gene_symbol: summary.gene_symbol ? summary.gene_symbol[0] : 'N/A',
                molecular_consequence: summary.molecular_consequence ? summary.molecular_consequence[0] : 'N/A',
                protein_change: summary.protein_change ? summary.protein_change[0] : 'N/A',
                condition: summary.condition ? summary.condition[0] : 'N/A',
                trait_set: summary.trait_set ? summary.trait_set[0] : 'N/A',
                assembly: summary.assembly ? summary.assembly[0] : 'N/A',
                variant_type: summary.variation_type ? summary.variation_type[0] : 'N/A',
                origin: summary.origin ? summary.origin[0] : 'N/A',
                submitter_count: summary.number_submitters ? parseInt(summary.number_submitters[0]) : 0,
                supporting_observations: summary.supporting_observations ? parseInt(summary.supporting_observations[0]) : 0
            };
        } catch (error) {
            console.error(`⚠️  Error parsing variant summary:`, error.message);
            return {
                clinvarId: summary.$.uid || 'Unknown',
                title: 'Parsing error',
                clinical_significance: 'Unknown',
                error: error.message
            };
        }
    }

    /**
     * Get comprehensive ClinVar data for a gene
     */
    async getComprehensiveClinVarData(geneSymbol) {
        try {
            console.log(`\n🧬 Starting ClinVar analysis for: ${geneSymbol}`);
            
            // Get pathogenic/likely pathogenic variants
            const pathogenicResult = await this.searchClinVarVariants(geneSymbol, 'pathogenic');
            
            if (!pathogenicResult.success) {
                return pathogenicResult;
            }

            // Analyze and summarize the data
            const analysis = this.analyzeClinVarData(pathogenicResult.data);
            
            return {
                success: true,
                data: {
                    ...pathogenicResult.data,
                    analysis
                }
            };

        } catch (error) {
            console.error(`❌ ClinVar comprehensive analysis failed:`, error.message);
            return {
                success: false,
                error: error.message,
                geneSymbol
            };
        }
    }

    /**
     * Analyze ClinVar data to provide insights
     */
    analyzeClinVarData(clinvarData) {
        const variants = clinvarData.variants || [];
        
        if (variants.length === 0) {
            return {
                summary: 'No pathogenic variants found',
                variantTypes: {},
                consequences: {},
                conditions: {},
                reviewStatus: {},
                chromosomeDistribution: {},
                significanceDistribution: {}
            };
        }

        // Count by variant type
        const variantTypes = {};
        const consequences = {};
        const conditions = {};
        const reviewStatus = {};
        const chromosomeDistribution = {};
        const significanceDistribution = {};

        variants.forEach(variant => {
            // Variant types
            const type = variant.variant_type || 'Unknown';
            variantTypes[type] = (variantTypes[type] || 0) + 1;

            // Molecular consequences
            const consequence = variant.molecular_consequence || 'Unknown';
            consequences[consequence] = (consequences[consequence] || 0) + 1;

            // Conditions
            const condition = variant.condition || 'Unknown';
            if (condition !== 'Unknown' && condition.length < 100) { // Avoid very long condition names
                conditions[condition] = (conditions[condition] || 0) + 1;
            }

            // Review status
            const review = variant.review_status || 'Unknown';
            reviewStatus[review] = (reviewStatus[review] || 0) + 1;

            // Chromosome distribution
            const chr = variant.chromosome || 'Unknown';
            chromosomeDistribution[chr] = (chromosomeDistribution[chr] || 0) + 1;

            // Clinical significance
            const significance = variant.clinical_significance || 'Unknown';
            significanceDistribution[significance] = (significanceDistribution[significance] || 0) + 1;
        });

        // Get top items for each category
        const getTopItems = (obj, limit = 5) => {
            return Object.entries(obj)
                .sort(([,a], [,b]) => b - a)
                .slice(0, limit)
                .map(([key, count]) => ({ name: key, count }));
        };

        return {
            summary: `Found ${variants.length} pathogenic/likely pathogenic variants`,
            variantTypes: getTopItems(variantTypes),
            consequences: getTopItems(consequences),
            conditions: getTopItems(conditions),
            reviewStatus: getTopItems(reviewStatus),
            chromosomeDistribution: getTopItems(chromosomeDistribution),
            significanceDistribution: getTopItems(significanceDistribution),
            totalVariants: variants.length,
            uniqueConditions: Object.keys(conditions).length,
            averageSubmitters: variants.length > 0 ? 
                Math.round(variants.reduce((sum, v) => sum + (v.submitter_count || 0), 0) / variants.length) : 0
        };
    }

    /**
     * Display ClinVar summary
     */
    displayClinVarSummary(clinvarData) {
        if (!clinvarData.success) {
            console.log(`❌ ClinVar data not available: ${clinvarData.error}`);
            return;
        }

        const { geneSymbol, variants, analysis, totalCount } = clinvarData.data;
        
        console.log('\n' + '='.repeat(80));
        console.log('🧬 CLINVAR PATHOGENIC VARIANTS ANALYSIS');
        console.log('='.repeat(80));
        
        console.log(`🔬 Gene: ${geneSymbol}`);
        console.log(`📊 Total variants found: ${totalCount}`);
        console.log(`📋 Retrieved for analysis: ${variants.length}`);
        
        if (variants.length === 0) {
            console.log(`ℹ️  No pathogenic variants found for ${geneSymbol}`);
            return;
        }

        console.log(`\n📈 Analysis Summary:`);
        console.log(`   ${analysis.summary}`);
        console.log(`   Unique conditions: ${analysis.uniqueConditions}`);
        console.log(`   Average submitters per variant: ${analysis.averageSubmitters}`);
        
        if (analysis.variantTypes.length > 0) {
            console.log(`\n🔍 Top Variant Types:`);
            analysis.variantTypes.forEach((type, i) => {
                console.log(`   ${i + 1}. ${type.name}: ${type.count} variants`);
            });
        }
        
        if (analysis.consequences.length > 0) {
            console.log(`\n⚡ Top Molecular Consequences:`);
            analysis.consequences.forEach((cons, i) => {
                console.log(`   ${i + 1}. ${cons.name}: ${cons.count} variants`);
            });
        }
        
        if (analysis.conditions.length > 0) {
            console.log(`\n🩺 Top Associated Conditions:`);
            analysis.conditions.forEach((cond, i) => {
                console.log(`   ${i + 1}. ${cond.name}: ${cond.count} variants`);
            });
        }
        
        console.log('\n' + '='.repeat(80));
    }
}

module.exports = ClinVarRetriever; 