const axios = require('axios');
const xml2js = require('xml2js');

class GeneRetriever {
    constructor() {
        this.baseUrl = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';
        this.parser = new xml2js.Parser();
        this.email = 'user@example.com'; // Replace with your email for NCBI API requests
        this.tool = 'pmi-case-data-tools';
    }

    /**
     * Search for a gene by symbol and return the gene ID
     */
    async searchGene(geneSymbol) {
        try {
            const searchUrl = `${this.baseUrl}/esearch.fcgi`;
            const params = {
                db: 'gene',
                term: `${geneSymbol}[Gene Name] AND "Homo sapiens"[Organism]`,
                retmode: 'xml',
                email: this.email,
                tool: this.tool
            };

            console.log(`🔍 Searching for gene: ${geneSymbol}`);
            const response = await axios.get(searchUrl, { params });
            const result = await this.parser.parseStringPromise(response.data);
            
            if (result.eSearchResult && result.eSearchResult.IdList && result.eSearchResult.IdList[0].Id) {
                const geneIds = result.eSearchResult.IdList[0].Id;
                console.log(`✅ Found ${geneIds.length} gene ID(s): ${geneIds.join(', ')}`);
                return geneIds[0]; // Return the first (most relevant) ID
            } else {
                throw new Error(`No gene found for symbol: ${geneSymbol}`);
            }
        } catch (error) {
            console.error(`❌ Error searching for gene ${geneSymbol}:`, error.message);
            throw error;
        }
    }

    /**
     * Get gene summary information
     */
    async getGeneSummary(geneId) {
        try {
            const summaryUrl = `${this.baseUrl}/esummary.fcgi`;
            const params = {
                db: 'gene',
                id: geneId,
                retmode: 'xml',
                email: this.email,
                tool: this.tool
            };

            console.log(`📋 Retrieving gene summary for ID: ${geneId}`);
            const response = await axios.get(summaryUrl, { params });
            const result = await this.parser.parseStringPromise(response.data);
            
            if (result.eSummaryResult && 
                result.eSummaryResult.DocumentSummarySet && 
                result.eSummaryResult.DocumentSummarySet[0].DocumentSummary) {
                return this.parseGeneSummary(result.eSummaryResult.DocumentSummarySet[0].DocumentSummary[0]);
            } else {
                throw new Error(`No summary found for gene ID: ${geneId}`);
            }
        } catch (error) {
            console.error(`❌ Error getting gene summary for ID ${geneId}:`, error.message);
            throw error;
        }
    }

    /**
     * Get detailed gene information including cross-references
     */
    async getGeneDetails(geneId) {
        try {
            const fetchUrl = `${this.baseUrl}/efetch.fcgi`;
            const params = {
                db: 'gene',
                id: geneId,
                retmode: 'xml',
                email: this.email,
                tool: this.tool
            };

            console.log(`📄 Retrieving detailed gene information for ID: ${geneId}`);
            const response = await axios.get(fetchUrl, { params });
            const result = await this.parser.parseStringPromise(response.data);
            
            return result;
        } catch (error) {
            console.error(`❌ Error getting gene details for ID ${geneId}:`, error.message);
            throw error;
        }
    }

    /**
     * Extract Ensembl gene ID from efetch response
     */
    async getEnsemblId(geneId) {
        try {
            const fetchUrl = `${this.baseUrl}/efetch.fcgi`;
            const params = {
                db: 'gene',
                id: geneId,
                retmode: 'xml',
                email: this.email,
                tool: this.tool
            };

            console.log(`🔗 Retrieving Ensembl cross-reference for ID: ${geneId}`);
            const response = await axios.get(fetchUrl, { params });
            
            // Use regex to find Ensembl gene ID (most efficient approach)
            const ensemblRegex = /<Object-id_str>(ENSG\d+)<\/Object-id_str>/;
            const match = response.data.match(ensemblRegex);
            
            if (match) {
                console.log(`✅ Found Ensembl ID: ${match[1]}`);
                return match[1];
            } else {
                console.log(`ℹ️  No Ensembl ID found for gene ${geneId}`);
                return null;
            }
        } catch (error) {
            console.error(`❌ Error getting Ensembl ID for gene ${geneId}:`, error.message);
            return null;
        }
    }

    /**
     * Parse gene summary data into a readable format
     */
    parseGeneSummary(docSum) {
        const summary = {
            geneId: docSum.$.uid,
            symbol: docSum.Name ? docSum.Name[0] : 'N/A',
            description: docSum.Description ? docSum.Description[0] : 'N/A',
            organism: docSum.Organism && docSum.Organism[0].ScientificName ? docSum.Organism[0].ScientificName[0] : 'N/A',
            chromosome: docSum.Chromosome ? docSum.Chromosome[0] : 'N/A',
            mapLocation: docSum.MapLocation ? docSum.MapLocation[0] : 'N/A',
            geneType: this.determineGeneType(docSum),
            aliases: docSum.OtherAliases ? docSum.OtherAliases[0].split(', ') : [],
            summary: docSum.Summary ? docSum.Summary[0] : 'N/A',
            nomenclatureSymbol: docSum.NomenclatureSymbol ? docSum.NomenclatureSymbol[0] : 'N/A',
            nomenclatureName: docSum.NomenclatureName ? docSum.NomenclatureName[0] : 'N/A'
        };

        return summary;
    }

    /**
     * Determine gene type from available data
     */
    determineGeneType(docSum) {
        // Try to infer gene type from available information
        if (docSum.Summary && docSum.Summary[0]) {
            const summary = docSum.Summary[0].toLowerCase();
            if (summary.includes('protein') || summary.includes('encode')) {
                return 'protein-coding';
            } else if (summary.includes('rna')) {
                return 'RNA gene';
            }
        }
        return 'gene';
    }

    /**
     * Retrieve comprehensive gene information including Ensembl ID
     */
    async retrieveGeneInfo(geneSymbol, includeEnsembl = true) {
        try {
            console.log(`\n🧬 Starting gene retrieval for: ${geneSymbol}\n`);
            
            // Step 1: Search for the gene
            const geneId = await this.searchGene(geneSymbol);
            
            // Step 2: Get gene summary
            const summary = await this.getGeneSummary(geneId);
            
            // Step 3: Get Ensembl ID if requested
            let ensemblId = null;
            if (includeEnsembl) {
                ensemblId = await this.getEnsemblId(geneId);
                summary.ensemblId = ensemblId;
            }
            
            // Step 4: Get detailed information (optional)
            // const details = await this.getGeneDetails(geneId);
            
            return {
                geneId: geneId,
                summary: summary,
                ensemblId: ensemblId,
                // details: details
            };
        } catch (error) {
            console.error(`❌ Failed to retrieve gene information:`, error.message);
            throw error;
        }
    }

    /**
     * Display gene information in a formatted way
     */
    displayGeneInfo(geneInfo) {
        console.log('\n' + '='.repeat(80));
        console.log('🧬 GENE INFORMATION');
        console.log('='.repeat(80));
        
        const summary = geneInfo.summary;
        console.log(`📍 Gene ID: ${summary.geneId}`);
        console.log(`🏷️  Symbol: ${summary.symbol}`);
        console.log(`📝 Description: ${summary.description}`);
        console.log(`🦠 Organism: ${summary.organism}`);
        console.log(`🧪 Chromosome: ${summary.chromosome}`);
        console.log(`📍 Map Location: ${summary.mapLocation}`);
        console.log(`🔬 Gene Type: ${summary.geneType}`);
        
        if (summary.ensemblId) {
            console.log(`🔗 Ensembl ID: ${summary.ensemblId}`);
        }
        
        if (summary.aliases && summary.aliases.length > 0) {
            console.log(`🏆 Aliases: ${summary.aliases.join(', ')}`);
        }
        
        if (summary.nomenclatureSymbol !== 'N/A') {
            console.log(`📛 Official Symbol: ${summary.nomenclatureSymbol}`);
        }
        
        if (summary.nomenclatureName !== 'N/A') {
            console.log(`📖 Official Name: ${summary.nomenclatureName}`);
        }
        
        console.log('\n' + '-'.repeat(80));
        console.log('📚 GENE SUMMARY');
        console.log('-'.repeat(80));
        
        if (summary.summary !== 'N/A') {
            // Word wrap the summary at 75 characters
            const words = summary.summary.split(' ');
            let line = '';
            for (const word of words) {
                if (line.length + word.length + 1 <= 75) {
                    line += (line ? ' ' : '') + word;
                } else {
                    console.log(line);
                    line = word;
                }
            }
            if (line) console.log(line);
        } else {
            console.log('No summary available.');
        }
        
        console.log('\n' + '='.repeat(80));
        console.log(`🔗 NCBI Gene Link: https://www.ncbi.nlm.nih.gov/gene/${summary.geneId}`);
        if (summary.ensemblId) {
            console.log(`🔗 Ensembl Link: https://www.ensembl.org/Homo_sapiens/Gene/Summary?g=${summary.ensemblId}`);
        }
        console.log('='.repeat(80) + '\n');
    }
}

// Main execution function
async function main() {
    const geneRetriever = new GeneRetriever();
    
    // Get gene symbol from command line arguments or use EGFR as default
    const geneSymbol = process.argv[2] || 'EGFR';
    
    try {
        console.log('🚀 PMI Case Data Tools - Gene Retriever');
        console.log('=======================================');
        
        const geneInfo = await geneRetriever.retrieveGeneInfo(geneSymbol);
        geneRetriever.displayGeneInfo(geneInfo);
        
        // Optional: Save to JSON file
        const fs = require('fs');
        const filename = `gene_data_${geneSymbol}_${new Date().toISOString().split('T')[0]}.json`;
        fs.writeFileSync(filename, JSON.stringify(geneInfo, null, 2));
        console.log(`💾 Gene data saved to: ${filename}`);
        
    } catch (error) {
        console.error('❌ Application failed:', error.message);
        process.exit(1);
    }
}

// Export the class for use in other modules
module.exports = GeneRetriever;

// Run the main function if this script is executed directly
if (require.main === module) {
    main();
} 