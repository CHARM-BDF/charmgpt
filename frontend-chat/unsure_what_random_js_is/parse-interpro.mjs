import fs from 'fs';
import fetch from 'node-fetch';

try {
  // This endpoint gives us metadata, now let's get the actual domain annotations
  console.log('🔗 EGFR Domain Data from InterPro:');
  
  const metadataFile = 'egfr_interpro.json';
  const metadata = JSON.parse(fs.readFileSync(metadataFile, 'utf8'));
  
  console.log(`Protein: ${metadata.metadata.name}`);
  console.log(`Length: ${metadata.metadata.length} amino acids`);
  console.log(`Available entries: ${metadata.metadata.counters.entries}`);
  
  // Show what domain databases have data for EGFR
  console.log('\n📊 Available domain databases:');
  const dbCounts = metadata.metadata.counters.dbEntries;
  Object.entries(dbCounts).forEach(([db, count]) => {
    console.log(`  ${db.toUpperCase()}: ${count} entries`);
  });
  
  // Now get the actual domain entries
  console.log('\n🔍 Fetching actual domain entries...');
  const entryUrl = `https://www.ebi.ac.uk/interpro/api/protein/uniprot/P00533/entry/interpro/`;
  const entryResponse = await fetch(entryUrl);
  const entryData = await entryResponse.json();
  
  if (entryData.results) {
    console.log(`\nFound ${entryData.results.length} domain entries:`);
    
    const domainsBySource = {};
    entryData.results.forEach((result) => {
      const entry = result.metadata;
      const source = entry.source_database;
      
      if (!domainsBySource[source]) {
        domainsBySource[source] = [];
      }
      
      const domainInfo = {
        name: entry.name,
        accession: entry.accession,
        type: entry.type,
        locations: []
      };
      
      if (result.entry_protein_locations) {
        result.entry_protein_locations.forEach(epl => {
          epl.locations.forEach(loc => {
            domainInfo.locations.push(`${loc.start}-${loc.end}`);
          });
        });
      }
      
      domainsBySource[source].push(domainInfo);
    });
    
    Object.entries(domainsBySource).forEach(([source, domains]) => {
      console.log(`\n📊 ${source} (${domains.length} entries):`);
      domains.forEach((domain, i) => {
        console.log(`  ${i+1}. ${domain.name} (${domain.accession})`);
        console.log(`     Type: ${domain.type}`);
        if (domain.locations.length > 0) {
          console.log(`     Locations: ${domain.locations.join(', ')}`);
        }
      });
    });
  } else {
    console.log('No domain entries found in response');
  }
  
} catch (error) {
  console.error('Error:', error.message);
  
  // Fallback: Show what we know from the variant-domain-mcp
  console.log('\n💡 Alternative: Use our variant-domain-mcp which already has this data!');
  console.log('Our MCP tool "get-protein-domains" for EGFR shows:');
  console.log('  1. Extracellular domain (25-645)');
  console.log('  2. Cytoplasmic domain (669-1210)'); 
  console.log('  3. Protein kinase domain (712-979)');
  console.log('  Plus 10+ functional features from UniProt');
} 