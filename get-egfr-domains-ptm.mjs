import fetch from 'node-fetch';
import fs from 'fs';

async function getEGFRDomainsAndPTM() {
  try {
    console.log('🔍 Fetching EGFR protein domains and PTM data...');
    
    const egfrData = {
      "gene": "EGFR",
      "uniprot_id": "P00533",
      "ensembl_id": "ENSG00000146648",
      "sources": {},
      "domains": {},
      "ptm": {},
      "retrieved_at": new Date().toISOString()
    };

    // 1. UniProt - comprehensive protein annotation (domains + PTM)
    console.log('📊 Fetching from UniProt...');
    const uniprotUrl = `https://rest.uniprot.org/uniprotkb/P00533?format=json`;
    const uniprotResponse = await fetch(uniprotUrl);
    const uniprotData = await uniprotResponse.json();
    
    egfrData.sources.uniprot = {
      "url": uniprotUrl,
      "description": "Comprehensive protein annotation including domains and PTMs"
    };

    // Extract domains and features from UniProt
    const domains = [];
    const ptms = [];
    const otherFeatures = [];

    if (uniprotData.features) {
      uniprotData.features.forEach(feature => {
        const featureData = {
          type: feature.type,
          start: feature.location?.start?.value,
          end: feature.location?.end?.value,
          description: feature.description,
          evidence: feature.evidences?.map(e => e.code) || []
        };

        // Categorize features
        if (['Domain', 'Topological domain'].includes(feature.type)) {
          domains.push(featureData);
        } else if (['Modified residue', 'Glycosylation', 'Cross-link', 'Lipidation'].includes(feature.type)) {
          ptms.push(featureData);
        } else if (['Region', 'Repeat', 'Motif', 'Site', 'Active site', 'Binding site'].includes(feature.type)) {
          otherFeatures.push(featureData);
        }
      });
    }

    egfrData.domains.uniprot = {
      "count": domains.length,
      "domains": domains,
      "other_features": otherFeatures
    };

    egfrData.ptm.uniprot = {
      "count": ptms.length,
      "modifications": ptms
    };

    // 2. Pfam - protein family and domain database
    console.log('🧬 Fetching from Pfam...');
    const pfamUrl = `https://pfam.xfam.org/protein/P00533?output=xml`;
    try {
      const pfamResponse = await fetch(pfamUrl);
      const pfamXml = await pfamResponse.text();
      
      egfrData.sources.pfam = {
        "url": pfamUrl,
        "description": "Protein families and domain architecture from Pfam database"
      };

      // Basic XML parsing for Pfam domains (simplified)
      const pfamDomains = [];
      const domainMatches = pfamXml.matchAll(/<match.*?accession="([^"]*)".*?id="([^"]*)".*?<location.*?start="([^"]*)".*?end="([^"]*)"[^>]*>/g);
      
      for (const match of domainMatches) {
        pfamDomains.push({
          accession: match[1],
          id: match[2],
          start: parseInt(match[3]),
          end: parseInt(match[4]),
          source: "Pfam"
        });
      }

      egfrData.domains.pfam = {
        "count": pfamDomains.length,
        "domains": pfamDomains
      };

    } catch (error) {
      console.log('⚠️  Pfam data not accessible:', error.message);
      egfrData.sources.pfam = { "error": error.message };
    }

    // 3. SMART - Simple Modular Architecture Research Tool
    console.log('🎯 Fetching from SMART...');
    const smartUrl = `http://smart.embl-heidelberg.de/smart/do_annotation.pl?DOMAIN=P00533&BLAST=DUMMY`;
    try {
      egfrData.sources.smart = {
        "url": "http://smart.embl-heidelberg.de/",
        "description": "Simple Modular Architecture Research Tool for domain annotation",
        "note": "SMART requires interactive web interface - automated access limited"
      };
    } catch (error) {
      egfrData.sources.smart = { "error": "SMART requires manual access" };
    }

    // 4. Alternative: InterPro (integrates Pfam, SMART, and other domain databases)
    console.log('🔄 Fetching from InterPro...');
    const interproUrl = `https://www.ebi.ac.uk/interpro/api/protein/uniprot/P00533?annotation=interpro`;
    try {
      const interproResponse = await fetch(interproUrl);
      const interproData = await interproResponse.json();
      
      egfrData.sources.interpro = {
        "url": interproUrl,
        "description": "Integrated protein signature database (includes Pfam, SMART, etc.)"
      };

      const interproDomains = [];
      if (interproData.results) {
        interproData.results.forEach(result => {
          if (result.protein_length && result.protein_length > 0) {
            result.entry_protein_locations?.forEach(location => {
              location.locations?.forEach(loc => {
                interproDomains.push({
                  interpro_id: result.metadata.accession,
                  name: result.metadata.name,
                  type: result.metadata.type,
                  start: loc.start,
                  end: loc.end,
                  source: "InterPro"
                });
              });
            });
          }
        });
      }

      egfrData.domains.interpro = {
        "count": interproDomains.length,
        "domains": interproDomains
      };

    } catch (error) {
      console.log('⚠️  InterPro data not accessible:', error.message);
      egfrData.sources.interpro = { "error": error.message };
    }

    // 5. Additional PTM databases
    console.log('🔬 Adding PTM database references...');
    egfrData.sources.ptm_databases = {
      "PhosphoSitePlus": {
        "url": "https://www.phosphosite.org/proteinAction?id=1433&showAllSites=true",
        "description": "Comprehensive PTM database",
        "note": "Search for EGFR_HUMAN"
      },
      "dbPTM": {
        "url": "http://dbptm.mbc.nctu.edu.tw/",
        "description": "Database of protein post-translational modifications"
      },
      "PTMcode": {
        "url": "http://ptmcode.embl.de/",
        "description": "Post-translational modification codes in protein interactions"
      }
    };

    // Save the comprehensive data
    fs.writeFileSync('egfr_domains_ptm_data.json', JSON.stringify(egfrData, null, 2));
    
    console.log('\n✅ EGFR domains and PTM data saved to egfr_domains_ptm_data.json');
    console.log('\n📊 Summary:');
    console.log(`UniProt Domains: ${egfrData.domains.uniprot?.count || 0}`);
    console.log(`UniProt PTMs: ${egfrData.ptm.uniprot?.count || 0}`);
    console.log(`Pfam Domains: ${egfrData.domains.pfam?.count || 'N/A'}`);
    console.log(`InterPro Domains: ${egfrData.domains.interpro?.count || 'N/A'}`);
    
    console.log('\n🔗 Key Resources:');
    console.log('• UniProt P00533: https://www.uniprot.org/uniprotkb/P00533');
    console.log('• Pfam: https://pfam.xfam.org/protein/P00533');
    console.log('• SMART: http://smart.embl-heidelberg.de/');
    console.log('• InterPro: https://www.ebi.ac.uk/interpro/protein/uniprot/P00533/');
    console.log('• PhosphoSitePlus: Search "EGFR_HUMAN"');

  } catch (error) {
    console.error('❌ Error fetching domain/PTM data:', error.message);
  }
}

getEGFRDomainsAndPTM(); 