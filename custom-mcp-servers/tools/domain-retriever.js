const axios = require('axios');
const xml2js = require('xml2js');

class DomainRetriever {
    constructor() {
        this.baseUrl = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';
        this.email = 'your.email@example.com';
        this.tool = 'protein-domain-retriever';
        this.parser = new xml2js.Parser();
    }

    /**
     * Get comprehensive domain information for a gene
     */
    async getDomainInfo(geneSymbol) {
        try {
            console.log(`🔍 Getting domain information for: ${geneSymbol}`);
            
            // Step 1: Get gene information from NCBI
            const geneInfo = await this.getGeneInfo(geneSymbol);
            if (!geneInfo) {
                console.log(`❌ Could not find gene information for: ${geneSymbol}`);
                return null;
            }

            // Step 2: Get HPA information (includes UniProt IDs)
            const hpaInfo = await this.getHPAInfo(geneInfo.ensemblId);
            
            // Step 3: Get UniProt IDs from both sources
            const uniprotIds = this.extractUniprotIds(geneInfo, hpaInfo);
            
            if (uniprotIds.length === 0) {
                console.log(`❌ No UniProt IDs found for: ${geneSymbol}`);
                return null;
            }

            // Step 4: Get domain information from UniProt
            const domainInfo = await this.getUniprotDomains(uniprotIds[0]); // Use first/primary ID
            
            return {
                gene: geneInfo,
                hpa: hpaInfo,
                uniprotIds: uniprotIds,
                domains: domainInfo
            };
        } catch (error) {
            console.error(`❌ Error getting domain info:`, error.message);
            return null;
        }
    }

    /**
     * Get gene information from NCBI including Ensembl cross-reference
     */
    async getGeneInfo(geneSymbol) {
        try {
            // Search for gene
            const searchUrl = `${this.baseUrl}/esearch.fcgi`;
            const searchParams = {
                db: 'gene',
                term: `${geneSymbol}[Gene Name] AND Homo sapiens[Organism]`,
                retmode: 'json',
                email: this.email,
                tool: this.tool
            };

            const searchResponse = await axios.get(searchUrl, { params: searchParams });
            const geneId = searchResponse.data.esearchresult.idlist[0];
            
            if (!geneId) return null;

            // Get gene details
            const fetchUrl = `${this.baseUrl}/efetch.fcgi`;
            const fetchParams = {
                db: 'gene',
                id: geneId,
                retmode: 'xml',
                email: this.email,
                tool: this.tool
            };

            const fetchResponse = await axios.get(fetchUrl, { params: fetchParams });
            const xmlString = fetchResponse.data;
            
            // Extract Ensembl ID
            const ensemblMatch = xmlString.match(/Ensembl:(ENSG\d+)/);
            const ensemblId = ensemblMatch ? ensemblMatch[1] : null;
            
            return {
                geneId: geneId,
                symbol: geneSymbol,
                ensemblId: ensemblId,
                xmlData: xmlString
            };
        } catch (error) {
            console.error(`❌ Error getting gene info:`, error.message);
            return null;
        }
    }

    /**
     * Get HPA information
     */
    async getHPAInfo(ensemblId) {
        if (!ensemblId) return null;
        
        try {
            const hpaUrl = `https://www.proteinatlas.org/${ensemblId}.json`;
            const response = await axios.get(hpaUrl);
            return response.data;
        } catch (error) {
            console.error(`❌ Error getting HPA info:`, error.message);
            return null;
        }
    }

    /**
     * Extract UniProt IDs from gene and HPA information
     */
    extractUniprotIds(geneInfo, hpaInfo) {
        const uniprotIds = [];
        
        // From HPA data
        if (hpaInfo && hpaInfo.Uniprot) {
            uniprotIds.push(...hpaInfo.Uniprot);
        }
        
        // From NCBI Gene XML (look for UniProt cross-references)
        if (geneInfo && geneInfo.xmlData) {
            const uniprotMatches = geneInfo.xmlData.match(/UniProtKB\/Swiss-Prot:([A-Z0-9]+)/g);
            if (uniprotMatches) {
                uniprotMatches.forEach(match => {
                    const id = match.split(':')[1];
                    if (!uniprotIds.includes(id)) {
                        uniprotIds.push(id);
                    }
                });
            }
        }
        
        return uniprotIds;
    }

    /**
     * Get protein domain information from UniProt
     */
    async getUniprotDomains(uniprotId) {
        try {
            console.log(`🔍 Getting UniProt domain information for: ${uniprotId}`);
            
            // Get UniProt data in JSON format
            const uniprotUrl = `https://www.uniprot.org/uniprot/${uniprotId}.json`;
            const response = await axios.get(uniprotUrl);
            const uniprotData = response.data;
            
            // Extract domain information
            const domainInfo = this.parseUniprotDomains(uniprotData);
            
            return domainInfo;
        } catch (error) {
            console.error(`❌ Error getting UniProt domains:`, error.message);
            return null;
        }
    }

    /**
     * Parse UniProt data to extract domain information
     */
    parseUniprotDomains(uniprotData) {
        const domainInfo = {
            accession: uniprotData.primaryAccession,
            name: uniprotData.uniProtkbId,
            proteinName: uniprotData.proteinDescription?.recommendedName?.fullName?.value || 'N/A',
            length: uniprotData.sequence?.length || 'N/A',
            domains: [],
            features: [],
            pfamDomains: [],
            interproDomains: []
        };

        // Extract domain features
        if (uniprotData.features) {
            uniprotData.features.forEach(feature => {
                if (feature.type === 'Domain') {
                    domainInfo.domains.push({
                        type: 'domain',
                        description: feature.description,
                        begin: feature.location.start.value,
                        end: feature.location.end.value,
                        evidence: feature.evidences ? feature.evidences.map(e => e.evidenceCode) : []
                    });
                }
                
                // Also collect other structural features
                if (['Repeat', 'Zinc finger', 'Motif', 'Region', 'Coiled coil'].includes(feature.type)) {
                    domainInfo.features.push({
                        type: feature.type,
                        description: feature.description,
                        begin: feature.location.start.value,
                        end: feature.location.end.value,
                        evidence: feature.evidences ? feature.evidences.map(e => e.evidenceCode) : []
                    });
                }
            });
        }

        // Extract cross-references to domain databases
        if (uniprotData.uniProtKBCrossReferences) {
            uniprotData.uniProtKBCrossReferences.forEach(ref => {
                if (ref.database === 'Pfam') {
                    domainInfo.pfamDomains.push({
                        id: ref.id,
                        properties: ref.properties || {}
                    });
                }
                
                if (ref.database === 'InterPro') {
                    domainInfo.interproDomains.push({
                        id: ref.id,
                        properties: ref.properties || {}
                    });
                }
            });
        }

        return domainInfo;
    }

    /**
     * Display domain information in a formatted way
     */
    displayDomainInfo(domainData) {
        if (!domainData) {
            console.log('❌ No domain information available');
            return;
        }

        const { gene, domains, uniprotIds } = domainData;
        
        console.log('\n' + '=' .repeat(80));
        console.log(`🧬 PROTEIN DOMAIN INFORMATION FOR ${gene.symbol}`);
        console.log('=' .repeat(80));
        
        console.log(`\n📋 Basic Information:`);
        console.log(`   Gene Symbol: ${gene.symbol}`);
        console.log(`   NCBI Gene ID: ${gene.geneId}`);
        console.log(`   Ensembl ID: ${gene.ensemblId || 'N/A'}`);
        console.log(`   UniProt IDs: ${uniprotIds.join(', ')}`);
        
        if (domains) {
            console.log(`\n🧪 Protein Information:`);
            console.log(`   Accession: ${domains.accession}`);
            console.log(`   Name: ${domains.name}`);
            console.log(`   Full Name: ${domains.proteinName}`);
            console.log(`   Length: ${domains.length} amino acids`);
            
            if (domains.domains && domains.domains.length > 0) {
                console.log(`\n🔰 Protein Domains (${domains.domains.length}):`);
                domains.domains.forEach((domain, index) => {
                    console.log(`   ${index + 1}. ${domain.description}`);
                    console.log(`      Position: ${domain.begin} - ${domain.end}`);
                    console.log(`      Evidence: ${domain.evidence.join(', ') || 'N/A'}`);
                });
            } else {
                console.log(`\n🔰 Protein Domains: None found in UniProt features`);
            }
            
            if (domains.features && domains.features.length > 0) {
                console.log(`\n🔧 Structural Features (${domains.features.length}):`);
                domains.features.forEach((feature, index) => {
                    console.log(`   ${index + 1}. ${feature.type}: ${feature.description}`);
                    console.log(`      Position: ${feature.begin} - ${feature.end}`);
                });
            }
            
            if (domains.pfamDomains && domains.pfamDomains.length > 0) {
                console.log(`\n🏷️ Pfam Domains (${domains.pfamDomains.length}):`);
                domains.pfamDomains.forEach((pfam, index) => {
                    console.log(`   ${index + 1}. ${pfam.id}`);
                    if (pfam.properties.entry_name) {
                        console.log(`      Name: ${pfam.properties.entry_name}`);
                    }
                    if (pfam.properties.match_status) {
                        console.log(`      Status: ${pfam.properties.match_status}`);
                    }
                });
            }
            
            if (domains.interproDomains && domains.interproDomains.length > 0) {
                console.log(`\n🔍 InterPro Domains (${domains.interproDomains.length}):`);
                domains.interproDomains.forEach((interpro, index) => {
                    console.log(`   ${index + 1}. ${interpro.id}`);
                    if (interpro.properties.entry_name) {
                        console.log(`      Name: ${interpro.properties.entry_name}`);
                    }
                });
            }
        }
        
        console.log('\n' + '=' .repeat(80));
        console.log('🔗 External Links:');
        console.log(`   NCBI Gene: https://www.ncbi.nlm.nih.gov/gene/${gene.geneId}`);
        if (gene.ensemblId) {
            console.log(`   Ensembl: https://www.ensembl.org/Homo_sapiens/Gene/Summary?g=${gene.ensemblId}`);
        }
        uniprotIds.forEach(id => {
            console.log(`   UniProt: https://www.uniprot.org/uniprot/${id}`);
        });
        console.log('=' .repeat(80));
    }

    /**
     * Save domain information to JSON file
     */
    saveDomainInfo(domainData, geneSymbol) {
        if (!domainData) return;
        
        const timestamp = new Date().toISOString().split('T')[0];
        const filename = `domain_info_${geneSymbol}_${timestamp}.json`;
        
        const fs = require('fs');
        fs.writeFileSync(filename, JSON.stringify(domainData, null, 2));
        console.log(`\n💾 Domain information saved to: ${filename}`);
    }
}

// Main execution
async function main() {
    const geneSymbol = process.argv[2] || 'EGFR';
    const retriever = new DomainRetriever();
    
    try {
        const domainData = await retriever.getDomainInfo(geneSymbol);
        retriever.displayDomainInfo(domainData);
        retriever.saveDomainInfo(domainData, geneSymbol);
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

if (require.main === module) {
    main();
}

module.exports = DomainRetriever; 