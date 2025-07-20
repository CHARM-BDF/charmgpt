const axios = require('axios');
const DomainRetriever = require('./domain-retriever');

class VariantDomainMapper {
    constructor() {
        this.baseUrl = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';
        this.email = 'your.email@example.com';
        this.tool = 'variant-domain-mapper';
        this.domainRetriever = new DomainRetriever();
    }

    /**
     * Main function to map variant to protein domains
     */
    async mapVariantToDomains(transcriptId, variantInfo) {
        try {
            console.log(`🧬 Mapping variant to protein domains`);
            console.log(`📄 Transcript: ${transcriptId}`);
            console.log(`🔄 Variant: ${variantInfo.proteinChange}`);
            console.log('=' .repeat(80));

            // Step 1: Convert transcript to protein accession
            const proteinAccession = await this.getProteinFromTranscript(transcriptId);
            if (!proteinAccession) {
                throw new Error(`Could not find protein accession for transcript: ${transcriptId}`);
            }

            // Step 2: Get transcript-specific protein sequence
            const transcriptSequence = await this.getProteinSequence(proteinAccession);
            
            // Step 3: Get UniProt data using existing domain retriever
            const uniprotData = await this.domainRetriever.getDomainInfo(variantInfo.geneSymbol);
            if (!uniprotData || !uniprotData.domains) {
                throw new Error(`Could not retrieve UniProt domain data for: ${variantInfo.geneSymbol}`);
            }

            // Step 4: Get UniProt sequence
            const uniprotSequence = await this.getUniprotSequence(uniprotData.uniprotIds[0]);

            // Step 5: Parse variant position
            const variantPosition = this.parseVariantPosition(variantInfo.proteinChange);

            // Step 6: Perform sequence alignment
            const alignment = await this.alignSequences(transcriptSequence, uniprotSequence, proteinAccession, uniprotData.uniprotIds[0]);

            // Step 7: Map variant position
            const mappedPosition = this.mapPosition(variantPosition.position, alignment);

            // Step 8: Check domain impact
            const domainImpact = this.checkDomainImpact(mappedPosition, uniprotData.domains);

            // Step 9: Display results
            const result = {
                input: {
                    transcriptId,
                    proteinAccession,
                    variant: variantInfo
                },
                alignment: alignment,
                mapping: {
                    transcriptPosition: variantPosition.position,
                    uniprotPosition: mappedPosition,
                    aminoAcidChange: {
                        original: variantPosition.fromAA,
                        mutated: variantPosition.toAA
                    }
                },
                domainImpact: domainImpact,
                uniprotData: uniprotData
            };

            this.displayResults(result);
            this.saveResults(result, variantInfo.geneSymbol, variantInfo.proteinChange);

            return result;

        } catch (error) {
            console.error(`❌ Error mapping variant to domains:`, error.message);
            throw error;
        }
    }

    /**
     * Convert transcript ID to protein accession
     */
    async getProteinFromTranscript(transcriptId) {
        try {
            console.log(`🔍 Converting transcript ${transcriptId} to protein accession...`);
            
            // Add delay to avoid rate limiting
            await this.sleep(1000);
            
            // Search for the transcript in nuccore database
            const searchUrl = `${this.baseUrl}/esearch.fcgi`;
            const searchParams = {
                db: 'nuccore',
                term: transcriptId,
                retmode: 'json',
                email: this.email,
                tool: this.tool
            };

            const searchResponse = await axios.get(searchUrl, { params: searchParams });
            const nucleotideId = searchResponse.data.esearchresult.idlist[0];
            
            if (!nucleotideId) {
                // Try without version number
                const baseTranscript = transcriptId.split('.')[0];
                console.log(`⚠️  Transcript ${transcriptId} not found, trying ${baseTranscript}...`);
                
                const altSearchParams = {
                    db: 'nuccore',
                    term: baseTranscript,
                    retmode: 'json',
                    email: this.email,
                    tool: this.tool
                };

                await this.sleep(1000);
                const altSearchResponse = await axios.get(searchUrl, { params: altSearchParams });
                const altNucleotideId = altSearchResponse.data.esearchresult.idlist[0];
                
                if (!altNucleotideId) {
                    throw new Error(`Transcript ${transcriptId} not found`);
                }
                
                // Use the found ID
                nucleotideId = altNucleotideId;
            }

            // Check if transcript was replaced with newer version
            await this.sleep(1000);
            const summaryUrl = `${this.baseUrl}/esummary.fcgi`;
            const summaryParams = {
                db: 'nuccore',
                id: nucleotideId,
                retmode: 'json',
                email: this.email,
                tool: this.tool
            };

            const summaryResponse = await axios.get(summaryUrl, { params: summaryParams });
            const summary = summaryResponse.data.result[nucleotideId];
            
            if (summary.replacedby) {
                console.log(`⚠️  Transcript ${transcriptId} was replaced by ${summary.replacedby}`);
                console.log(`🔄 Using current version: ${summary.replacedby}`);
                // Use the current version instead
                return await this.getProteinFromTranscript(summary.replacedby);
            }

            // Try multiple approaches to find protein
            let proteinAccession = null;

            // Approach 1: Use elink
            try {
                await this.sleep(1000);
                const linkUrl = `${this.baseUrl}/elink.fcgi`;
                const linkParams = {
                    dbfrom: 'nuccore',
                    db: 'protein',
                    id: nucleotideId,
                    retmode: 'json',
                    email: this.email,
                    tool: this.tool
                };

                const linkResponse = await axios.get(linkUrl, { params: linkParams });
                const links = linkResponse.data.linksets[0]?.linksetdbs?.find(db => db.dbto === 'protein');
                
                if (links && links.links && links.links.length > 0) {
                    const proteinId = links.links[0];

                    await this.sleep(1000);
                    const protSummaryParams = {
                        db: 'protein',
                        id: proteinId,
                        retmode: 'json',
                        email: this.email,
                        tool: this.tool
                    };

                    const protSummaryResponse = await axios.get(summaryUrl, { params: protSummaryParams });
                    proteinAccession = protSummaryResponse.data.result[proteinId].caption;
                    
                    console.log(`✅ Found protein via elink: ${proteinAccession}`);
                    return proteinAccession;
                }
            } catch (linkError) {
                console.log(`⚠️  elink approach failed: ${linkError.message}`);
            }

            // Approach 2: Extract from XML
            try {
                await this.sleep(1000);
                const fetchUrl = `${this.baseUrl}/efetch.fcgi`;
                const fetchParams = {
                    db: 'nuccore',
                    id: nucleotideId,
                    retmode: 'xml',
                    email: this.email,
                    tool: this.tool
                };

                const fetchResponse = await axios.get(fetchUrl, { params: fetchParams });
                const xmlData = fetchResponse.data;
                
                // Look for protein_id in the XML
                const proteinMatches = xmlData.match(/protein_id="([^"]+)"/g);
                if (proteinMatches && proteinMatches.length > 0) {
                    // Extract the first protein ID
                    const proteinMatch = proteinMatches[0].match(/protein_id="([^"]+)"/);
                    if (proteinMatch) {
                        proteinAccession = proteinMatch[1];
                        console.log(`✅ Found protein via XML parsing: ${proteinAccession}`);
                        return proteinAccession;
                    }
                }
            } catch (xmlError) {
                console.log(`⚠️  XML parsing approach failed: ${xmlError.message}`);
            }

            // Approach 3: Try direct protein database search
            try {
                const transcriptBase = transcriptId.split('.')[0].replace('NM_', 'NP_');
                console.log(`🔄 Trying direct protein search: ${transcriptBase}`);
                
                await this.sleep(1000);
                const protSearchParams = {
                    db: 'protein',
                    term: transcriptBase,
                    retmode: 'json',
                    email: this.email,
                    tool: this.tool
                };

                const protSearchResponse = await axios.get(searchUrl, { params: protSearchParams });
                if (protSearchResponse.data.esearchresult.idlist.length > 0) {
                    const proteinId = protSearchResponse.data.esearchresult.idlist[0];
                    
                    await this.sleep(1000);
                    const protSummaryParams = {
                        db: 'protein',
                        id: proteinId,
                        retmode: 'json',
                        email: this.email,
                        tool: this.tool
                    };

                    const protSummaryResponse = await axios.get(summaryUrl, { params: protSummaryParams });
                    proteinAccession = protSummaryResponse.data.result[proteinId].caption;
                    
                    console.log(`✅ Found protein via direct search: ${proteinAccession}`);
                    return proteinAccession;
                }
            } catch (directError) {
                console.log(`⚠️  Direct search approach failed: ${directError.message}`);
            }

            throw new Error(`No protein found for transcript ${transcriptId} using any method`);

        } catch (error) {
            console.error(`❌ Error converting transcript to protein:`, error.message);
            return null;
        }
    }

    /**
     * Sleep function to avoid rate limiting
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Get protein sequence from NCBI
     */
    async getProteinSequence(proteinAccession) {
        try {
            console.log(`🔍 Retrieving protein sequence for: ${proteinAccession}`);
            
            await this.sleep(1000);
            
            const fetchUrl = `${this.baseUrl}/efetch.fcgi`;
            const fetchParams = {
                db: 'protein',
                id: proteinAccession,
                rettype: 'fasta',
                retmode: 'text',
                email: this.email,
                tool: this.tool
            };

            const response = await axios.get(fetchUrl, { params: fetchParams });
            const fastaText = response.data;
            
            // Extract sequence from FASTA (remove header line)
            const lines = fastaText.split('\n');
            const sequence = lines.slice(1).join('').replace(/\s/g, '');

            console.log(`✅ Retrieved sequence (${sequence.length} amino acids)`);
            return sequence;

        } catch (error) {
            console.error(`❌ Error getting protein sequence:`, error.message);
            throw error;
        }
    }

    /**
     * Get UniProt sequence
     */
    async getUniprotSequence(uniprotId) {
        try {
            console.log(`🔍 Retrieving UniProt sequence for: ${uniprotId}`);
            
            const uniprotUrl = `https://www.uniprot.org/uniprot/${uniprotId}.json`;
            const response = await axios.get(uniprotUrl);
            const sequence = response.data.sequence.value;

            console.log(`✅ Retrieved UniProt sequence (${sequence.length} amino acids)`);
            return sequence;

        } catch (error) {
            console.error(`❌ Error getting UniProt sequence:`, error.message);
            throw error;
        }
    }

    /**
     * Parse variant position from protein change notation (e.g., p.Leu883Ser)
     */
    parseVariantPosition(proteinChange) {
        const match = proteinChange.match(/p\.([A-Za-z]{3})(\d+)([A-Za-z]{3})/);
        if (!match) {
            throw new Error(`Invalid protein change format: ${proteinChange}`);
        }

        return {
            fromAA: match[1],
            position: parseInt(match[2]),
            toAA: match[3]
        };
    }

    /**
     * Perform sequence alignment (simple implementation)
     * For now, we'll do a basic comparison and identify differences
     */
    async alignSequences(seq1, seq2, seq1Name, seq2Name) {
        console.log(`🔄 Aligning sequences...`);
        console.log(`   ${seq1Name}: ${seq1.length} aa`);
        console.log(`   ${seq2Name}: ${seq2.length} aa`);

        // Simple alignment for identical or nearly identical sequences
        const alignment = {
            sequence1: {
                name: seq1Name,
                sequence: seq1,
                length: seq1.length
            },
            sequence2: {
                name: seq2Name, 
                sequence: seq2,
                length: seq2.length
            },
            identical: seq1 === seq2,
            differences: [],
            positionMapping: {}
        };

        if (seq1 === seq2) {
            console.log(`✅ Sequences are identical - direct position mapping`);
            // Create 1:1 position mapping
            for (let i = 1; i <= seq1.length; i++) {
                alignment.positionMapping[i] = i;
            }
        } else {
            console.log(`⚠️  Sequences differ - performing basic alignment`);
            // Simple alignment assuming minimal gaps
            const minLength = Math.min(seq1.length, seq2.length);
            
            for (let i = 0; i < minLength; i++) {
                if (seq1[i] !== seq2[i]) {
                    alignment.differences.push({
                        position1: i + 1,
                        position2: i + 1,
                        aa1: seq1[i],
                        aa2: seq2[i]
                    });
                }
                alignment.positionMapping[i + 1] = i + 1;
            }

            // Handle length differences
            if (seq1.length !== seq2.length) {
                console.log(`⚠️  Length difference: ${seq1.length} vs ${seq2.length}`);
            }
        }

        return alignment;
    }

    /**
     * Map position from transcript to UniProt coordinates
     */
    mapPosition(transcriptPosition, alignment) {
        const mappedPosition = alignment.positionMapping[transcriptPosition];
        
        if (mappedPosition === undefined) {
            throw new Error(`Could not map position ${transcriptPosition}`);
        }

        console.log(`📍 Position mapping: ${transcriptPosition} (transcript) → ${mappedPosition} (UniProt)`);
        return mappedPosition;
    }

    /**
     * Check if mapped position impacts any protein domains
     */
    checkDomainImpact(position, domainData) {
        const impactedDomains = [];
        const impactedFeatures = [];

        // Check domains
        if (domainData.domains) {
            domainData.domains.forEach((domain, index) => {
                if (position >= domain.begin && position <= domain.end) {
                    impactedDomains.push({
                        ...domain,
                        index: index + 1
                    });
                }
            });
        }

        // Check structural features
        if (domainData.features) {
            domainData.features.forEach((feature, index) => {
                if (position >= feature.begin && position <= feature.end) {
                    impactedFeatures.push({
                        ...feature,
                        index: index + 1
                    });
                }
            });
        }

        return {
            hasImpact: impactedDomains.length > 0 || impactedFeatures.length > 0,
            domains: impactedDomains,
            features: impactedFeatures,
            position: position
        };
    }

    /**
     * Display comprehensive results
     */
    displayResults(result) {
        console.log('\n' + '=' .repeat(100));
        console.log(`🧬 VARIANT-TO-DOMAIN MAPPING RESULTS`);
        console.log('=' .repeat(100));

        // Input Summary
        console.log(`\n📋 Input Information:`);
        console.log(`   Transcript ID: ${result.input.transcriptId}`);
        console.log(`   Protein Accession: ${result.input.proteinAccession}`);
        console.log(`   Gene Symbol: ${result.input.variant.geneSymbol}`);
        console.log(`   Coding Change: ${result.input.variant.codingChange}`);
        console.log(`   Protein Change: ${result.input.variant.proteinChange}`);

        // Sequence Information
        console.log(`\n🧪 Sequence Information:`);
        console.log(`   Transcript Protein: ${result.alignment.sequence1.length} amino acids`);
        console.log(`   UniProt Reference: ${result.alignment.sequence2.length} amino acids`);
        console.log(`   Sequences Identical: ${result.alignment.identical ? '✅ Yes' : '❌ No'}`);
        
        if (!result.alignment.identical && result.alignment.differences.length > 0) {
            console.log(`   Differences Found: ${result.alignment.differences.length}`);
            if (result.alignment.differences.length <= 5) {
                result.alignment.differences.forEach(diff => {
                    console.log(`     Position ${diff.position1}: ${diff.aa1} → ${diff.aa2}`);
                });
            }
        }

        // Position Mapping
        console.log(`\n📍 Variant Position Mapping:`);
        console.log(`   Original Position: ${result.mapping.transcriptPosition} (${result.input.proteinAccession})`);
        console.log(`   UniProt Position: ${result.mapping.uniprotPosition} (${result.uniprotData.uniprotIds[0]})`);
        console.log(`   Amino Acid Change: ${result.mapping.aminoAcidChange.original} → ${result.mapping.aminoAcidChange.mutated}`);

        // Domain Impact
        console.log(`\n🎯 Domain Impact Analysis:`);
        if (result.domainImpact.hasImpact) {
            console.log(`   ✅ VARIANT IMPACTS FUNCTIONAL REGIONS`);
            
            if (result.domainImpact.domains.length > 0) {
                console.log(`\n   🔰 Impacted Protein Domains (${result.domainImpact.domains.length}):`);
                result.domainImpact.domains.forEach(domain => {
                    console.log(`     ${domain.index}. ${domain.description}`);
                    console.log(`        Domain Range: ${domain.begin} - ${domain.end}`);
                    console.log(`        Variant Position: ${result.mapping.uniprotPosition}`);
                    console.log(`        Evidence: ${domain.evidence.join(', ') || 'N/A'}`);
                });
            }

            if (result.domainImpact.features.length > 0) {
                console.log(`\n   🔧 Impacted Structural Features (${result.domainImpact.features.length}):`);
                result.domainImpact.features.forEach(feature => {
                    console.log(`     ${feature.index}. ${feature.type}: ${feature.description}`);
                    console.log(`        Feature Range: ${feature.begin} - ${feature.end}`);
                    console.log(`        Variant Position: ${result.mapping.uniprotPosition}`);
                });
            }
        } else {
            console.log(`   ❌ No domain or structural feature impact detected`);
            console.log(`   Position ${result.mapping.uniprotPosition} is outside all annotated domains`);
        }

        // Visual Domain Map
        this.displayDomainMap(result);

        // Links
        console.log(`\n🔗 External Resources:`);
        console.log(`   NCBI Protein: https://www.ncbi.nlm.nih.gov/protein/${result.input.proteinAccession}`);
        console.log(`   UniProt: https://www.uniprot.org/uniprot/${result.uniprotData.uniprotIds[0]}`);
        console.log(`   NCBI Gene: https://www.ncbi.nlm.nih.gov/gene/${result.uniprotData.gene.geneId}`);

        console.log('=' .repeat(100));
    }

    /**
     * Display visual domain map
     */
    displayDomainMap(result) {
        console.log(`\n🗺️  Domain Map Visualization:`);
        
        const proteinLength = result.alignment.sequence2.length;
        const variantPos = result.mapping.uniprotPosition;
        const domains = result.uniprotData.domains.domains || [];

        // Create a simple text-based visualization
        const mapWidth = 60;
        const scale = proteinLength / mapWidth;
        
        console.log(`   Protein: 1 ${'─'.repeat(mapWidth)} ${proteinLength}`);
        
        // Show domains
        domains.forEach((domain, index) => {
            const startPos = Math.round(domain.begin / scale);
            const endPos = Math.round(domain.end / scale);
            const domainLength = endPos - startPos;
            
            let map = ' '.repeat(mapWidth + 10);
            let mapArray = map.split('');
            
            // Mark domain
            for (let i = startPos; i <= endPos && i < mapWidth; i++) {
                mapArray[i] = '█';
            }
            
            // Mark variant position if in this domain
            const variantMapPos = Math.round(variantPos / scale);
            if (variantPos >= domain.begin && variantPos <= domain.end) {
                if (variantMapPos < mapWidth) {
                    mapArray[variantMapPos] = '↑';
                }
            }
            
            console.log(`   Domain ${index + 1}: ${mapArray.join('')}`);
            console.log(`   ${domain.description} (${domain.begin}-${domain.end})`);
            
            if (variantPos >= domain.begin && variantPos <= domain.end) {
                console.log(`   *** VARIANT IMPACT: Position ${variantPos} ***`);
            }
            console.log('');
        });
    }

    /**
     * Save results to JSON file
     */
    saveResults(result, geneSymbol, proteinChange) {
        const timestamp = new Date().toISOString().split('T')[0];
        const cleanVariant = proteinChange.replace(/[^a-zA-Z0-9]/g, '_');
        const filename = `variant_domain_mapping_${geneSymbol}_${cleanVariant}_${timestamp}.json`;
        
        const fs = require('fs');
        fs.writeFileSync(filename, JSON.stringify(result, null, 2));
        console.log(`\n💾 Results saved to: ${filename}`);
    }
}

// Main execution
async function main() {
    if (process.argv.length < 5) {
        console.log('Usage: node variant-domain-mapper.js <transcript_id> <gene_symbol> <protein_change> [coding_change]');
        console.log('Example: node variant-domain-mapper.js NM_005228.3 EGFR p.Leu883Ser c.2648T>C');
        return;
    }

    const transcriptId = process.argv[2];
    const geneSymbol = process.argv[3];
    const proteinChange = process.argv[4];
    const codingChange = process.argv[5] || 'N/A';

    const variantInfo = {
        geneSymbol: geneSymbol,
        proteinChange: proteinChange,
        codingChange: codingChange
    };

    const mapper = new VariantDomainMapper();
    
    try {
        await mapper.mapVariantToDomains(transcriptId, variantInfo);
    } catch (error) {
        console.error('❌ Mapping failed:', error.message);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = VariantDomainMapper; 