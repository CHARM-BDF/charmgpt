#!/usr/bin/env node

/**
 * Quick test to see BioC JSON structure for 5 PMIDs
 * Focuses on showing the relations structure
 */

const baseUrl = process.env.PUBTATOR_BASE_URL || 'https://www.ncbi.nlm.nih.gov/research/pubtator3-api';

// Use 5 PMIDs from the FAM177A1 test
const testPMIDs = ['39331042', '38767059', '38187698', '34799425', '36825008'];

async function testBiocJson() {
  console.log('🔍 Fetching BioC JSON for 5 PMIDs...\n');
  console.log(`PMIDs: ${testPMIDs.join(', ')}\n`);
  
  const endpoint = '/publications/export/biocjson';
  const url = `${baseUrl}${endpoint}?pmids=${testPMIDs.join(',')}`;
  
  console.log(`URL: ${url}\n`);
  console.log('='.repeat(80));
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    
    console.log('\n📊 STRUCTURE OVERVIEW:');
    console.log(`- Top-level keys: ${Object.keys(data).join(', ')}`);
    console.log(`- PubTator3 array length: ${data.PubTator3?.length || 0}`);
    
    if (data.PubTator3 && data.PubTator3.length > 0) {
      console.log('\n📄 FIRST DOCUMENT STRUCTURE:');
      const firstDoc = data.PubTator3[0];
      console.log(`- PMID: ${firstDoc.pmid || firstDoc.id || 'N/A'}`);
      console.log(`- Keys: ${Object.keys(firstDoc).join(', ')}`);
      console.log(`- Has relations: ${!!firstDoc.relations}`);
      console.log(`- Relations type: ${Array.isArray(firstDoc.relations) ? 'array' : typeof firstDoc.relations}`);
      console.log(`- Relations count: ${firstDoc.relations?.length || 0}`);
      console.log(`- Passages count: ${firstDoc.passages?.length || 0}`);
      
      // Check passages for relations
      if (firstDoc.passages) {
        const passagesWithRelations = firstDoc.passages.filter(p => p.relations && p.relations.length > 0);
        console.log(`- Passages with relations: ${passagesWithRelations.length}`);
      }
      
      // Show first relation if it exists
      if (firstDoc.relations && firstDoc.relations.length > 0) {
        console.log('\n🔗 FIRST RELATION EXAMPLE:');
        const firstRel = firstDoc.relations[0];
        console.log(JSON.stringify(firstRel, null, 2));
      }
      
      // Show a passage relation if it exists
      if (firstDoc.passages) {
        for (const passage of firstDoc.passages) {
          if (passage.relations && passage.relations.length > 0) {
            console.log('\n🔗 FIRST PASSAGE RELATION EXAMPLE:');
            console.log(JSON.stringify(passage.relations[0], null, 2));
            break;
          }
        }
      }
      
      // Show all relations structure summary
      console.log('\n📋 ALL RELATIONS SUMMARY:');
      let totalRelations = 0;
      const relationTypes = new Set();
      
      for (const doc of data.PubTator3) {
        if (doc.relations) {
          totalRelations += doc.relations.length;
          doc.relations.forEach(rel => {
            if (rel.infons?.type) {
              relationTypes.add(rel.infons.type);
            }
          });
        }
        
        // Also check passages
        if (doc.passages) {
          for (const passage of doc.passages) {
            if (passage.relations) {
              totalRelations += passage.relations.length;
              passage.relations.forEach(rel => {
                if (rel.infons?.type) {
                  relationTypes.add(rel.infons.type);
                }
              });
            }
          }
        }
      }
      
      console.log(`- Total relations found: ${totalRelations}`);
      console.log(`- Relation types: ${Array.from(relationTypes).join(', ') || 'none'}`);
      
      // Show a few example relations
      console.log('\n📝 SAMPLE RELATIONS (first 3):');
      let count = 0;
      for (const doc of data.PubTator3) {
        if (doc.relations && count < 3) {
          for (const rel of doc.relations) {
            if (count < 3) {
              console.log(`\nRelation ${count + 1} from PMID ${doc.pmid || doc.id}:`);
              console.log(`  Type: ${rel.infons?.type || 'N/A'}`);
              console.log(`  Role1: ${rel.infons?.role1?.accession || rel.infons?.role1?.identifier || 'N/A'} (${rel.infons?.role1?.name || 'N/A'})`);
              console.log(`  Role2: ${rel.infons?.role2?.accession || rel.infons?.role2?.identifier || 'N/A'} (${rel.infons?.role2?.name || 'N/A'})`);
              count++;
            }
          }
        }
        if (count >= 3) break;
      }
      
    } else {
      console.log('\n⚠️  No documents found in PubTator3 array');
      console.log('\nFull response structure:');
      console.log(JSON.stringify(data, null, 2).substring(0, 1000));
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  }
}

testBiocJson().catch(console.error);

