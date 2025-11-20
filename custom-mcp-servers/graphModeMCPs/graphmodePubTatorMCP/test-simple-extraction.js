#!/usr/bin/env node

/**
 * Simple test to verify PubTator text annotation API is working
 * Uses a very short example text from the PubTator documentation
 */

const RESTFUL_BASE_URL = "https://www.ncbi.nlm.nih.gov/CBBresearch/Lu/Demo/RESTful";

// Example from PubTator documentation
const SIMPLE_TEXT = "The ESR1 Mutations: From Bedside to Bench to Bedside.";

async function testSimpleAnnotation() {
  console.log('Testing PubTator text annotation with simple example...');
  console.log(`Text: "${SIMPLE_TEXT}"`);
  console.log(`Length: ${SIMPLE_TEXT.length} characters\n`);

  const submitUrl = `${RESTFUL_BASE_URL}/request.cgi`;
  const submitBody = new URLSearchParams({
    text: SIMPLE_TEXT,
    bioconcept: 'Gene'
  });

  console.log('Submitting request...');
  const submitResponse = await fetch(submitUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: submitBody.toString()
  });

  console.log(`Submit response status: ${submitResponse.status} ${submitResponse.statusText}`);

  if (!submitResponse.ok) {
    const errorText = await submitResponse.text();
    console.error('Submit error:', errorText.substring(0, 500));
    return;
  }

  const sessionData = await submitResponse.json();
  console.log('Session data:', sessionData);
  const sessionId = sessionData.id;

  if (!sessionId) {
    console.error('No session ID returned');
    return;
  }

  console.log(`Session ID: ${sessionId}`);
  console.log('\nPolling for results...');

  // Poll for results
  for (let attempt = 0; attempt < 30; attempt++) {
    if (attempt > 0) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    const retrieveUrl = `${RESTFUL_BASE_URL}/retrieve.cgi`;
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

    console.log(`Attempt ${attempt + 1}: Status ${retrieveResponse.status}`);

    if (retrieveResponse.status === 404) {
      process.stdout.write('.');
      continue;
    }

    if (!retrieveResponse.ok) {
      const errorText = await retrieveResponse.text();
      console.error(`\nRetrieve error (${retrieveResponse.status}):`, errorText.substring(0, 500));
      return;
    }

    const contentType = retrieveResponse.headers.get('content-type') || '';
    const responseText = await retrieveResponse.text();

    if (contentType.includes('text/html') || responseText.trim().startsWith('<!')) {
      console.error('\nGot HTML response (error page):', responseText.substring(0, 500));
      return;
    }

    try {
      const biocData = JSON.parse(responseText);
      console.log('\n✅ Success! Got BioC data:');
      console.log(JSON.stringify(biocData, null, 2).substring(0, 1000));
      return;
    } catch (parseError) {
      console.error('\nFailed to parse JSON:', parseError.message);
      console.log('Response:', responseText.substring(0, 500));
      return;
    }
  }

  console.log('\nTimeout: Results not ready after 30 attempts');
}

testSimpleAnnotation().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});





