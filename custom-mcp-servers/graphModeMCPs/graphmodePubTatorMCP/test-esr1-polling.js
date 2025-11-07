#!/usr/bin/env node

/**
 * Test script to poll existing PubTator session IDs
 * Polls once per minute for up to 1 hour (60 attempts)
 * Treats 400 and 404 as "wait" signals
 * Tracks elapsed time in minutes
 */

const RESTFUL_BASE_URL = "https://www.ncbi.nlm.nih.gov/CBBresearch/Lu/Demo/RESTful";
const POLL_INTERVAL = 60000; // 60 seconds (1 minute) between polling attempts
const MAX_POLL_ATTEMPTS = 60; // 60 attempts = 1 hour (60 * 1 minute)

// Session IDs from previous test run
const SESSION_IDS = {
  withoutBioconcept: 'BDA386DFF091E4DBADA7',
  withBioconcept: '5CCFCEA51B1F7AC64200'
};

async function pollForResults(sessionId, label) {
  const retrieveUrl = `${RESTFUL_BASE_URL}/retrieve.cgi`;
  const startTime = Date.now();
  
  console.log(`\n🔄 Polling for results (${label})...`);
  console.log(`   Session ID: ${sessionId}`);
  console.log(`   Polling every ${POLL_INTERVAL / 1000 / 60} minute(s) for up to ${MAX_POLL_ATTEMPTS} minutes\n`);
  
  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    // Wait before polling (except first attempt)
    if (attempt > 0) {
      await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
    }
    
    const retrieveBody = new URLSearchParams({
      id: sessionId
    });

    const retrieveResponse = await fetch(retrieveUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: retrieveBody.toString()
    });

    const status = retrieveResponse.status;
    const minutes = attempt + 1;
    const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
    const elapsedMinutes = Math.floor(elapsedSeconds / 60);
    const elapsedSecondsRemainder = elapsedSeconds % 60;
    
    // Treat 400 and 404 as "wait" signals
    if (status === 404) {
      console.log(`[Minute ${minutes}] 404 (not ready yet) - Elapsed: ${elapsedMinutes}m ${elapsedSecondsRemainder}s`);
      continue;
    }
    
    if (status === 400) {
      console.log(`[Minute ${minutes}] 400 (waiting) - Elapsed: ${elapsedMinutes}m ${elapsedSecondsRemainder}s`);
      continue;
    }

    // If we get a non-200 status that's not 400/404, it's an error
    if (!retrieveResponse.ok) {
      const errorText = await retrieveResponse.text();
      console.error(`\n   ❌ Retrieve error (${status}) after ${elapsedMinutes}m ${elapsedSecondsRemainder}s: ${errorText.substring(0, 500)}`);
      return { success: false, minutes: minutes, elapsed: elapsedSeconds };
    }

    // Check content type - might be HTML error or JSON
    const contentType = retrieveResponse.headers.get('content-type') || '';
    const responseText = await retrieveResponse.text();
    
    // If HTML, it's likely an error page - but wait a bit more
    if (contentType.includes('text/html') || responseText.trim().startsWith('<!')) {
      if (attempt < MAX_POLL_ATTEMPTS - 1) {
        console.log(`[Minute ${minutes}] HTML response (waiting) - Elapsed: ${elapsedMinutes}m ${elapsedSecondsRemainder}s`);
        continue;
      }
      // Last attempt and still HTML - it's an error
      console.error(`\n   ❌ Got HTML error page after ${elapsedMinutes}m ${elapsedSecondsRemainder}s`);
      console.error(`   Response preview: ${responseText.substring(0, 500)}`);
      return { success: false, minutes: minutes, elapsed: elapsedSeconds };
    }

    // Try to parse as JSON (BioC format)
    try {
      const biocData = JSON.parse(responseText);
      console.log(`\n   ✅ Success! Results retrieved after ${elapsedMinutes}m ${elapsedSecondsRemainder}s (${minutes} minute(s))`);
      console.log(`\n📊 Results summary:`);
      console.log(`   Response type: ${typeof biocData}`);
      
      // Try to extract some useful info
      if (biocData.PubTator3) {
        console.log(`   Found PubTator3 structure with ${biocData.PubTator3.length} document(s)`);
      } else if (biocData.documents) {
        console.log(`   Found documents array with ${biocData.documents.length} document(s)`);
      } else if (biocData.collection) {
        console.log(`   Found collection structure`);
      }
      
      // Show a preview of the data
      const preview = JSON.stringify(biocData, null, 2).substring(0, 2000);
      console.log(`\n📄 Data preview (first 2000 chars):\n${preview}${preview.length >= 2000 ? '...' : ''}`);
      
      return { success: true, minutes: minutes, elapsed: elapsedSeconds, data: biocData };
    } catch (parseError) {
      // If not JSON, might be other format
      console.error(`\n   ❌ Failed to parse JSON after ${elapsedMinutes}m ${elapsedSecondsRemainder}s: ${parseError.message}`);
      console.log(`   Response preview: ${responseText.substring(0, 500)}`);
      return { success: false, minutes: minutes, elapsed: elapsedSeconds };
    }
  }
  
  const finalElapsed = Math.floor((Date.now() - startTime) / 1000);
  const finalMinutes = Math.floor(finalElapsed / 60);
  const finalSeconds = finalElapsed % 60;
  console.log(`\n   ⏱️  Timeout: Results not available after ${finalMinutes}m ${finalSeconds}s (${MAX_POLL_ATTEMPTS} minutes)`);
  return { success: false, minutes: MAX_POLL_ATTEMPTS, elapsed: finalElapsed };
}

async function pollExistingSessions() {
  console.log('='.repeat(70));
  console.log('PubTator RESTful API - Long Polling Test');
  console.log('Polling existing session IDs once per minute for up to 1 hour');
  console.log('='.repeat(70));
  
  const results = {};
  
  // Poll first session (without bioconcept)
  console.log('\n🔬 Session 1: Without explicit bioconcept parameter');
  console.log('-'.repeat(70));
  const result1 = await pollForResults(SESSION_IDS.withoutBioconcept, 'Without bioconcept');
  results.withoutBioconcept = result1;
  
  // Poll second session (with bioconcept=Gene)
  console.log('\n\n🔬 Session 2: With bioconcept=Gene');
  console.log('-'.repeat(70));
  const result2 = await pollForResults(SESSION_IDS.withBioconcept, 'With bioconcept=Gene');
  results.withBioconcept = result2;
  
  // Summary
  console.log('\n\n' + '='.repeat(70));
  console.log('📊 FINAL SUMMARY');
  console.log('='.repeat(70));
  
  console.log('\n🔬 Session 1 (Without bioconcept):');
  if (results.withoutBioconcept.success) {
    const mins = results.withoutBioconcept.minutes;
    const elapsed = results.withoutBioconcept.elapsed;
    const elapsedMins = Math.floor(elapsed / 60);
    const elapsedSecs = elapsed % 60;
    console.log(`   ✅ Success after ${mins} minute(s) (${elapsedMins}m ${elapsedSecs}s total)`);
  } else {
    const mins = results.withoutBioconcept.minutes;
    const elapsed = results.withoutBioconcept.elapsed;
    const elapsedMins = Math.floor(elapsed / 60);
    const elapsedSecs = elapsed % 60;
    console.log(`   ❌ Failed after ${mins} minute(s) (${elapsedMins}m ${elapsedSecs}s total)`);
  }
  
  console.log('\n🔬 Session 2 (With bioconcept=Gene):');
  if (results.withBioconcept.success) {
    const mins = results.withBioconcept.minutes;
    const elapsed = results.withBioconcept.elapsed;
    const elapsedMins = Math.floor(elapsed / 60);
    const elapsedSecs = elapsed % 60;
    console.log(`   ✅ Success after ${mins} minute(s) (${elapsedMins}m ${elapsedSecs}s total)`);
  } else {
    const mins = results.withBioconcept.minutes;
    const elapsed = results.withBioconcept.elapsed;
    const elapsedMins = Math.floor(elapsed / 60);
    const elapsedSecs = elapsed % 60;
    console.log(`   ❌ Failed after ${mins} minute(s) (${elapsedMins}m ${elapsedSecs}s total)`);
  }
  
  console.log('\n' + '='.repeat(70));
}

// Run the test
pollExistingSessions().catch(error => {
  console.error('\n💥 Fatal error:', error);
  process.exit(1);
});

