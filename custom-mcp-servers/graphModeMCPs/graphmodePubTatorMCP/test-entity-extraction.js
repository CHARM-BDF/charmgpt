#!/usr/bin/env node

/**
 * Test script to extract entities from text using PubTator API
 * Tests the addNodesAndEdgesFromText functionality
 * If the text is too long, it will break it into chunks
 */

const RESTFUL_BASE_URL = "https://www.ncbi.nlm.nih.gov/CBBresearch/Lu/Demo/RESTful";
const MAX_TEXT_LENGTH = 5000; // Smaller chunks to avoid API errors
const POLL_INTERVAL = 2000; // 2 seconds between polling attempts
const MAX_POLL_ATTEMPTS = 30; // Try for up to 60 seconds

// Extract a focused section with biomedical content for testing
const TEST_TEXT = `Brain-wide fluctuations in local field potential oscillations reflect emergent network-level signals that mediate behavior. Cracking the code whereby these oscillations coordinate in time and space (spatiotemporal dynamics) to represent complex behaviors would provide fundamental insights into how the brain signals emotional pathology. Using machine learning, we discover a spatiotemporal dynamic network that predicts the emergence of major depressive disorder (MDD)-related behavioral dysfunction in mice subjected to chronic social defeat stress. Activity patterns in this network originate in prefrontal cortex and ventral striatum, relay through amygdala and ventral tegmental area, and converge in ventral hippocampus. This network is increased by acute threat, and it is also enhanced in three independent models of MDD vulnerability. Finally, we demonstrate that this vulnerability network is biologically distinct from the networks that encode dysfunction after stress. Thus, these findings reveal a convergent mechanism through which MDD vulnerability is mediated in the brain.

Keywords: Spatiotemporal dynamics, depression, stress, oscillations, networks, ketamine

Patterns of brain activity predict vulnerability versus resilience to depression in response to stress

MDD is the leading cause of disability in the world. While stress contributes to the onset of MDD, only a fraction of individuals that experience stressful events develop behavioral pathology. Multiple factors including childhood trauma and alterations in several molecular pathways have been shown to increase disease risk; nevertheless, the neural pathways on which these factors converge to yield subthreshold changes that render individuals vulnerable to stress are unknown. Knowledge of these neural pathways would facilitate the development of novel diagnostic technologies that stratify disease risk as well as preventative therapeutics to reverse neural circuit endophenotypes that mediate vulnerability to MDD. To achieve this aim, it is essential to distinguish the neural alterations that confer vulnerability to MDD from those that accompany the emergence of behavioral dysfunction.

Chronic social defeat stress (cSDS) is a widely validated pre-clinical model of MDD. In this paradigm, test mice are repeatedly exposed to larger aggressive CD1 strain mice. At the end of these exposures, test mice develop a MDD-like behavioral state characterized by social avoidance, anhedonia- and anxiety-like behavior, and sleep/circadian dysregulation. Critically, only ~60% of C57 mice subjected to this paradigm exhibit susceptibility to developing this stress-induced syndrome. While the remaining ~40% of mice subjected to cSDS exhibit resilience, susceptible and resilient mice experience the same degree of aggressive encounters. Thus, the cSDS paradigm provides a framework to probe putative basal network vulnerabilities that may exist in stress-vulnerable mice prior to stress exposure.

Multiple regions including subgenual cingulate cortex, amygdala, ventral hippocampus (VHip), nucleus accumbens (NAc), and ventral tegmental area (VTA) have been proposed to contribute to a putative MDD brain network. Supporting this notion, functional magnetic resonance imaging (fMRI) studies in depressed subjects have discovered distinct functional connectivity alterations involving these brain regions that predict individual behavioral phenotypes and antidepressant treatment responses (i.e., pharmacology, psychotherapy, and transcranial magnetic stimulation). However, our prior in vivo findings in genetic mouse models of MDD and in mice exposed to cSDS suggest that MDD-like behavioral dysfunction also arises at the level of circuit/network spatiotemporal dynamics, involving altered interactions of neural activity between spatially separated brain regions over time that are not captured by the fMRI timescale. We postulated that a signature predicting MDD vulnerability may exist at this dynamic circuit/network-level as well.

To test this hypothesis, we employed a transdisciplinary strategy integrating cSDS in mice, multi-circuit in vivo recordings from a subset of MDD-related regions including prelimbic cortex (PrL_Cx), infralimbic cortex (IL_Cx), NAc, central nucleus of the amygdala (CeA), basolateral amygdala (BLA), VTA, and VHip, a translational assay of neural circuit reactivity, and machine learning. We selected this subset of brain regions since they have each been validated in contributing to MDD-like behavior in multiple human and animal studies across several different research groups, and each region can be reliably targeted in mice using our multi-circuit recording technology. Our in vivo recording approach quantified both cellular activity and local field potentials (LFPs), which reflect the pooled activity of many neurons located up to 1mm from the electrode tip, their synaptic inputs, and their output signals.`;

// Full text for reference (original user text)
const FULL_TEXT = `Brain-wide electrical spatiotemporal dynamics encode depression vulnerability

=============================================================================

[Rainbo Hultman](https://pubmed.ncbi.nlm.nih.gov/?term=%22Hultman%20R%22%5BAuthor%5D)

### Rainbo Hultman

1Dept. of Psychiatry and Behavioral Sciences, Duke University Medical Center, Durham, North Carolina 27710, USA

Find articles by [Rainbo Hultman](https://pubmed.ncbi.nlm.nih.gov/?term=%22Hultman%20R%22%5BAuthor%5D)

1,\*, [Kyle Ulrich](https://pubmed.ncbi.nlm.nih.gov/?term=%22Ulrich%20K%22%5BAuthor%5D)

### Kyle Ulrich

8Dept. of Electrical and Computer Engineering, Duke University, Durham North Carolina 22208, USA

Find articles by [Kyle Ulrich](https://pubmed.ncbi.nlm.nih.gov/?term=%22Ulrich%20K%22%5BAuthor%5D)

8,\*, [Benjamin D Sachs](https://pubmed.ncbi.nlm.nih.gov/?term=%22Sachs%20BD%22%5BAuthor%5D)

### Benjamin D Sachs

10Dept. of Psychological and Brain Sciences, Villanova University, Villanova, PA, 19085, USA

Find articles by [Benjamin D Sachs](https://pubmed.ncbi.nlm.nih.gov/?term=%22Sachs%20BD%22%5BAuthor%5D)

10, [Cameron Blount](https://pubmed.ncbi.nlm.nih.gov/?term=%22Blount%20C%22%5BAuthor%5D)

### Cameron Blount

1Dept. of Psychiatry and Behavioral Sciences, Duke University Medical Center, Durham, North Carolina 27710, USA

Find articles by [Cameron Blount](https://pubmed.ncbi.nlm.nih.gov/?term=%22Blount%20C%22%5BAuthor%5D)

1, [David E Carlson](https://pubmed.ncbi.nlm.nih.gov/?term=%22Carlson%20DE%22%5BAuthor%5D)

### David E Carlson

7Dept. of Civil and Electrical Engineering, Duke University, Durham North Carolina 22208, USA

Find articles by [David E Carlson](https://pubmed.ncbi.nlm.nih.gov/?term=%22Carlson%20DE%22%5BAuthor%5D)

7, [Nkemdilim Ndubuizu](https://pubmed.ncbi.nlm.nih.gov/?term=%22Ndubuizu%20N%22%5BAuthor%5D)

### Nkemdilim Ndubuizu

1Dept. of Psychiatry and Behavioral Sciences, Duke University Medical Center, Durham, North Carolina 27710, USA

Find articles by [Nkemdilim Ndubuizu](https://pubmed.ncbi.nlm.nih.gov/?term=%22Ndubuizu%20N%22%5BAuthor%5D)

1, [Rosemary C Bagot](https://pubmed.ncbi.nlm.nih.gov/?term=%22Bagot%20RC%22%5BAuthor%5D)

### Rosemary C Bagot

11Fishberg, Dept. of Neuroscience, Friedman Brain Institute, Icahn School of Medicine at Mount Sinai, 1 Gustave L. Levy Place, New York, New York 10029, USA

Find articles by [Rosemary C Bagot](https://pubmed.ncbi.nlm.nih.gov/?term=%22Bagot%20RC%22%5BAuthor%5D)

11, [Eric Parise](https://pubmed.ncbi.nlm.nih.gov/?term=%22Parise%20E%22%5BAuthor%5D)

### Eric Parise

11Fishberg, Dept. of Neuroscience, Friedman Brain Institute, Icahn School of Medicine at Mount Sinai, 1 Gustave L. Levy Place, New York, New York 10029, USA

Find articles by [Eric Parise](https://pubmed.ncbi.nlm.nih.gov/?term=%22Parise%20E%22%5BAuthor%5D)

11, [Mai-Anh T Vu](https://pubmed.ncbi.nlm.nih.gov/?term=%22Vu%20MAT%22%5BAuthor%5D)

### Mai-Anh T Vu

1Dept. of Psychiatry and Behavioral Sciences, Duke University Medical Center, Durham, North Carolina 27710, USA

2Dept. of Neurobiology, Duke University Medical Center, Durham, North Carolina 27710, USA

Find articles by [Mai-Anh T Vu](https://pubmed.ncbi.nlm.nih.gov/?term=%22Vu%20MAT%22%5BAuthor%5D)

1,2, [Neil M Gallagher](https://pubmed.ncbi.nlm.nih.gov/?term=%22Gallagher%20NM%22%5BAuthor%5D)

### Neil M Gallagher

1Dept. of Psychiatry and Behavioral Sciences, Duke University Medical Center, Durham, North Carolina 27710, USA

2Dept. of Neurobiology, Duke University Medical Center, Durham, North Carolina 27710, USA

Find articles by [Neil M Gallagher](https://pubmed.ncbi.nlm.nih.gov/?term=%22Gallagher%20NM%22%5BAuthor%5D)

1,2, [Joyce Wang](https://pubmed.ncbi.nlm.nih.gov/?term=%22Wang%20J%22%5BAuthor%5D)

### Joyce Wang

1Dept. of Psychiatry and Behavioral Sciences, Duke University Medical Center, Durham, North Carolina 27710, USA

Find articles by [Joyce Wang](https://pubmed.ncbi.nlm.nih.gov/?term=%22Wang%20J%22%5BAuthor%5D)

1, [Alcino J Silva](https://pubmed.ncbi.nlm.nih.gov/?term=%22Silva%20AJ%22%5BAuthor%5D)

### Alcino J Silva

12Depts. of Neurobiology, Psychiatry & Behavioral Sciences and Psychology, Integrative Center for Learning and Memory, Brain Research Institute, University of California, Los Angeles, California 90095, USA

Find articles by [Alcino J Silva](https://pubmed.ncbi.nlm.nih.gov/?term=%22Silva%20AJ%22%5BAuthor%5D)

12, [Karl Deisseroth](https://pubmed.ncbi.nlm.nih.gov/?term=%22Deisseroth%20K%22%5BAuthor%5D)

### Karl Deisseroth

13Depts. of Bioengineering and Psychiatry and Howard Hughes Medical Institute, Stanford University, Stanford, California 94305, USA

Find articles by [Karl Deisseroth](https://pubmed.ncbi.nlm.nih.gov/?term=%22Deisseroth%20K%22%5BAuthor%5D)

13, [Stephen D Mague](https://pubmed.ncbi.nlm.nih.gov/?term=%22Mague%20SD%22%5BAuthor%5D)

### Stephen D Mague

1Dept. of Psychiatry and Behavioral Sciences, Duke University Medical Center, Durham, North Carolina 27710, USA

Find articles by [Stephen D Mague](https://pubmed.ncbi.nlm.nih.gov/?term=%22Mague%20SD%22%5BAuthor%5D)

1, [Marc G Caron](https://pubmed.ncbi.nlm.nih.gov/?term=%22Caron%20MG%22%5BAuthor%5D)

### Marc G Caron

4Dept. of Cell Biology, Duke University Medical Center, Durham, North Carolina 27710, USA

Find articles by [Marc G Caron](https://pubmed.ncbi.nlm.nih.gov/?term=%22Caron%20MG%22%5BAuthor%5D)

4, [Eric J Nestler](https://pubmed.ncbi.nlm.nih.gov/?term=%22Nestler%20EJ%22%5BAuthor%5D)

### Eric J Nestler

11Fishberg, Dept. of Neuroscience, Friedman Brain Institute, Icahn School of Medicine at Mount Sinai, 1 Gustave L. Levy Place, New York, New York 10029, USA

Find articles by [Eric J Nestler](https://pubmed.ncbi.nlm.nih.gov/?term=%22Nestler%20EJ%22%5BAuthor%5D)

11, [Lawrence Carin](https://pubmed.ncbi.nlm.nih.gov/?term=%22Carin%20L%22%5BAuthor%5D)

### Lawrence Carin

8Dept. of Electrical and Computer Engineering, Duke University, Durham North Carolina 22208, USA

Find articles by [Lawrence Carin](https://pubmed.ncbi.nlm.nih.gov/?term=%22Carin%20L%22%5BAuthor%5D)

8,†, [Kafui Dzirasa](https://pubmed.ncbi.nlm.nih.gov/?term=%22Dzirasa%20K%22%5BAuthor%5D)

### Kafui Dzirasa

1Dept. of Psychiatry and Behavioral Sciences, Duke University Medical Center, Durham, North Carolina 27710, USA

2Dept. of Neurobiology, Duke University Medical Center, Durham, North Carolina 27710, USA

3Center for Neuroengineering, Duke University Medical Center, Durham, North Carolina 27710, USA

5Dept. of Neurosurgery, Duke University Medical Center, Durham, North Carolina 27710, USA

6Duke Institute for Brain Sciences, Duke University Medical Center, Durham, North Carolina 27710, USA

9Dept. of Biomedical Engineering, Duke University, Durham North Carolina 22208, USA

Find articles by [Kafui Dzirasa](https://pubmed.ncbi.nlm.nih.gov/?term=%22Dzirasa%20K%22%5BAuthor%5D)

1,2,3,5,6,9,14,†

*   Author information

*   Copyright and License information

1Dept. of Psychiatry and Behavioral Sciences, Duke University Medical Center, Durham, North Carolina 27710, USA

2Dept. of Neurobiology, Duke University Medical Center, Durham, North Carolina 27710, USA

3Center for Neuroengineering, Duke University Medical Center, Durham, North Carolina 27710, USA

4Dept. of Cell Biology, Duke University Medical Center, Durham, North Carolina 27710, USA

5Dept. of Neurosurgery, Duke University Medical Center, Durham, North Carolina 27710, USA

6Duke Institute for Brain Sciences, Duke University Medical Center, Durham, North Carolina 27710, USA

7Dept. of Civil and Electrical Engineering, Duke University, Durham North Carolina 22208, USA

8Dept. of Electrical and Computer Engineering, Duke University, Durham North Carolina 22208, USA

9Dept. of Biomedical Engineering, Duke University, Durham North Carolina 22208, USA

10Dept. of Psychological and Brain Sciences, Villanova University, Villanova, PA, 19085, USA

11Fishberg, Dept. of Neuroscience, Friedman Brain Institute, Icahn School of Medicine at Mount Sinai, 1 Gustave L. Levy Place, New York, New York 10029, USA

12Depts. of Neurobiology, Psychiatry & Behavioral Sciences and Psychology, Integrative Center for Learning and Memory, Brain Research Institute, University of California, Los Angeles, California 90095, USA

13Depts. of Bioengineering and Psychiatry and Howard Hughes Medical Institute, Stanford University, Stanford, California 94305, USA

✉

**Correspondence should be sent to:** Lawrence Carin, PhD, Dept. of Computer and Electrical Engineering, Duke University, 110 Hudson Hall, Durham, NC 27708, USA, lcarin@duke.edu; Kafui Dzirasa, M.D. Ph.D., Dept. of Psychiatry and Behavioral Sciences, Duke University Medical Center, 361 Bryan Research Building, Box 3209, Durham, NC 27710, USA, kafui.dzirasa@duke.edu, Twitter: @KafuiDzirasa

14Lead Contact.

\*

These authors contributed equally

†

Senior Authors; Contributed equally

[PMC Copyright notice](/about/copyright/)

PMCID: PMC6005365  NIHMSID: NIHMS948785  PMID: [29502969](https://pubmed.ncbi.nlm.nih.gov/29502969/)

The publisher's version of this article is available at [Cell](https://doi.org/10.1016/j.cell.2018.02.012)

Summary

-------

Brain-wide fluctuations in local field potential oscillations reflect emergent network-level signals that mediate behavior. Cracking the code whereby these oscillations coordinate in time and space (spatiotemporal dynamics) to represent complex behaviors would provide fundamental insights into how the brain signals emotional pathology. Using machine learning, we discover a spatiotemporal dynamic network that predicts the emergence of major depressive disorder (MDD)-related behavioral dysfunction in mice subjected to chronic social defeat stress. Activity patterns in this network originate in prefrontal cortex and ventral striatum, relay through amygdala and ventral tegmental area, and converge in ventral hippocampus. This network is increased by acute threat, and it is also enhanced in three independent models of MDD vulnerability. Finally, we demonstrate that this vulnerability network is biologically distinct from the networks that encode dysfunction after stress. Thus, these findings reveal a convergent mechanism through which MDD vulnerability is mediated in the brain.

**Keywords:** Spatiotemporal dynamics, depression, stress, oscillations, networks, ketamine

In Brief

--------

Patterns of brain activity predict vulnerability versus resilience to depression in response to stress`;

/**
 * Clean text by removing markdown links and URLs
 */
function cleanText(text) {
  // Remove markdown links like [text](url)
  text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
  
  // Remove URLs
  text = text.replace(/https?:\/\/[^\s]+/g, '');
  
  // Remove multiple consecutive newlines
  text = text.replace(/\n{3,}/g, '\n\n');
  
  // Remove HTML-like tags if any
  text = text.replace(/<[^>]+>/g, '');
  
  return text.trim();
}

/**
 * Split text into chunks at sentence boundaries
 */
function splitTextIntoChunks(text, maxLength) {
  // Clean the text first
  text = cleanText(text);
  
  if (text.length <= maxLength) {
    return [text];
  }

  const chunks = [];
  let currentChunk = '';
  
  // Split by paragraphs first (double newlines)
  const paragraphs = text.split(/\n\n+/);
  
  for (const paragraph of paragraphs) {
    const cleanParagraph = paragraph.trim();
    if (!cleanParagraph) continue;
    
    if (currentChunk.length + cleanParagraph.length + 2 <= maxLength) {
      currentChunk += (currentChunk ? '\n\n' : '') + cleanParagraph;
    } else {
      if (currentChunk) {
        chunks.push(currentChunk);
        currentChunk = '';
      }
      
      // If paragraph itself is too long, split by sentences
      if (cleanParagraph.length > maxLength) {
        const sentences = cleanParagraph.split(/([.!?]\s+)/);
        let sentenceChunk = '';
        for (let i = 0; i < sentences.length; i += 2) {
          const sentence = sentences[i] + (sentences[i + 1] || '');
          if (sentenceChunk.length + sentence.length <= maxLength) {
            sentenceChunk += sentence;
          } else {
            if (sentenceChunk) {
              chunks.push(sentenceChunk);
            }
            sentenceChunk = sentence;
          }
        }
        if (sentenceChunk) {
          currentChunk = sentenceChunk;
        }
      } else {
        currentChunk = cleanParagraph;
      }
    }
  }
  
  if (currentChunk) {
    chunks.push(currentChunk);
  }
  
  return chunks;
}

/**
 * Submit text for annotation and get session ID
 * Uses the RESTful endpoint: POST /request.cgi
 */
async function submitTextForAnnotation(text, bioconcepts = ['Gene', 'Disease', 'Chemical']) {
  const submitUrl = `${RESTFUL_BASE_URL}/request.cgi`;
  
  // Convert concepts array to comma-separated string (PubTator expects comma-separated or single value)
  const bioconcept = bioconcepts.length > 0 ? bioconcepts.join(',') : 'Gene,Disease,Chemical';
  
  const submitBody = new URLSearchParams({
    text: text,
    bioconcept: bioconcept
  });

  console.log(`Submitting text for annotation (${text.length} characters)...`);
  console.log(`Bioconcepts: ${bioconcept}`);
  
  const submitResponse = await fetch(submitUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: submitBody.toString()
  });

  if (!submitResponse.ok) {
    const errorText = await submitResponse.text();
    throw new Error(`Failed to submit text: ${submitResponse.status} ${submitResponse.statusText}. ${errorText.substring(0, 200)}`);
  }

  const sessionData = await submitResponse.json();
  const sessionId = sessionData.id;

  if (!sessionId) {
    throw new Error('No session ID returned from PubTator annotation service. Response: ' + JSON.stringify(sessionData));
  }

  console.log(`✅ Session ID received: ${sessionId}`);
  return sessionId;
}

/**
 * Poll for annotation results
 * Uses the RESTful endpoint: POST /retrieve.cgi
 * According to documentation: returns 404 when result is not ready, then 200 with BioC JSON when ready
 */
async function retrieveAnnotationResults(sessionId) {
  const retrieveUrl = `${RESTFUL_BASE_URL}/retrieve.cgi`;
  
  console.log(`\nPolling for results (session: ${sessionId})...`);
  
  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    // Wait before polling (except first attempt - give it a moment to process)
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

    // 404 means result is not ready yet (expected during processing)
    if (retrieveResponse.status === 404) {
      process.stdout.write('.');
      continue;
    }

    // If 400, might be invalid session ID or request format issue
    if (retrieveResponse.status === 400) {
      const errorText = await retrieveResponse.text();
      // Check if it's an HTML error page (means endpoint rejected request)
      if (errorText.includes('400 Error') || errorText.includes('Bad Request')) {
        // Wait a bit more and retry, might be timing issue
        if (attempt < MAX_POLL_ATTEMPTS - 1) {
          process.stdout.write('*'); // Indicate retry after 400
          continue;
        }
        throw new Error(`Invalid request to PubTator service. The session may have expired or the endpoint may not be available. Status: 400`);
      }
      throw new Error(`Bad request to PubTator service: ${errorText.substring(0, 200)}`);
    }

    if (!retrieveResponse.ok) {
      const errorText = await retrieveResponse.text();
      throw new Error(`Failed to retrieve annotation results: ${retrieveResponse.status} ${retrieveResponse.statusText}. ${errorText.substring(0, 200)}`);
    }

    // Check content type - might be HTML error or JSON
    const contentType = retrieveResponse.headers.get('content-type') || '';
    const responseText = await retrieveResponse.text();
    
    // If HTML, it's likely an error page
    if (contentType.includes('text/html') || responseText.trim().startsWith('<!')) {
      if (attempt < MAX_POLL_ATTEMPTS - 1) {
        process.stdout.write('.'); // Retry if we haven't exhausted attempts
        continue;
      }
      // Try to extract error message from HTML
      const errorMatch = responseText.match(/<title[^>]*>([^<]+)<\/title>/i) || 
                        responseText.match(/<h1[^>]*>([^<]+)<\/h1>/i) ||
                        responseText.match(/Error[^<]*/i);
      const errorMsg = errorMatch ? errorMatch[1] || errorMatch[0] : 'Unknown HTML error';
      throw new Error(`PubTator service returned HTML error page: ${errorMsg.substring(0, 100)}`);
    }

    // Try to parse as JSON (BioC format)
    try {
      const biocData = JSON.parse(responseText);
      console.log('\n✅ Results retrieved!');
      return biocData;
    } catch (parseError) {
      // If not JSON, might be other format - check if it looks like BioC
      if (responseText.includes('collection') || responseText.includes('documents') || responseText.includes('passages')) {
        throw new Error(`Unexpected response format from PubTator service. Expected JSON but got: ${contentType}`);
      }
      throw new Error(`Failed to parse PubTator response as JSON. Response: ${responseText.substring(0, 200)}`);
    }
  }
  
  throw new Error(`Timeout: Annotation results not available after ${MAX_POLL_ATTEMPTS} attempts (${MAX_POLL_ATTEMPTS * POLL_INTERVAL / 1000} seconds)`);
}

/**
 * Parse BioC JSON and extract entities
 */
function parseBiocJson(biocData) {
  const entities = [];
  const relations = [];
  
  if (!biocData || !biocData.collection) {
    return { entities, relations };
  }
  
  const documents = biocData.collection.documents || [];
  
  for (const doc of documents) {
    const passages = doc.passages || [];
    
    for (const passage of passages) {
      const annotations = passage.annotations || [];
      
      for (const annotation of annotations) {
        const locations = annotation.locations || [];
        const infons = annotation.infons || {};
        
        entities.push({
          id: annotation.id || infons.identifier || infons.id || 'unknown',
          name: annotation.text || infons.name || 'unknown',
          type: infons.type || infons.concept || 'unknown',
          mentions: locations.map(loc => ({
            start: loc.offset || 0,
            end: (loc.offset || 0) + (loc.length || 0),
            text: annotation.text || ''
          }))
        });
      }
    }
    
    // Extract relations if available
    if (doc.relations) {
      for (const relation of doc.relations) {
        const infons = relation.infons || {};
        relations.push({
          id: relation.id || 'unknown',
          type: infons.type || 'unknown',
          entity1Id: infons.role1?.accession || infons.e1 || 'unknown',
          entity2Id: infons.role2?.accession || infons.e2 || 'unknown'
        });
      }
    }
  }
  
  return { entities, relations };
}

/**
 * Annotate text and return entities
 */
async function annotateText(text, bioconcepts = ['Gene', 'Disease', 'Chemical']) {
  try {
    const sessionId = await submitTextForAnnotation(text, bioconcepts);
    const biocData = await retrieveAnnotationResults(sessionId);
    return parseBiocJson(biocData);
  } catch (error) {
    throw error;
  }
}

/**
 * Display entities in a readable format
 */
function displayEntities(entities, relations) {
  console.log('\n' + '='.repeat(80));
  console.log('EXTRACTED ENTITIES');
  console.log('='.repeat(80));
  
  if (entities.length === 0) {
    console.log('No entities found.');
    return;
  }
  
  // Group entities by type
  const entitiesByType = {};
  for (const entity of entities) {
    const type = entity.type || 'unknown';
    if (!entitiesByType[type]) {
      entitiesByType[type] = [];
    }
    entitiesByType[type].push(entity);
  }
  
  // Display by type
  for (const [type, entitiesOfType] of Object.entries(entitiesByType)) {
    console.log(`\n${type.toUpperCase()} (${entitiesOfType.length}):`);
    const uniqueEntities = new Map();
    for (const entity of entitiesOfType) {
      const key = `${entity.name}|${entity.id}`;
      if (!uniqueEntities.has(key)) {
        uniqueEntities.set(key, entity);
      }
    }
    for (const entity of uniqueEntities.values()) {
      console.log(`  - ${entity.name} (ID: ${entity.id})`);
    }
  }
  
  if (relations.length > 0) {
    console.log(`\n\nRELATIONS (${relations.length}):`);
    for (const relation of relations) {
      console.log(`  - ${relation.type}: ${relation.entity1Id} → ${relation.entity2Id}`);
    }
  }
  
  console.log(`\n\nTotal entities found: ${entities.length}`);
  console.log(`Unique entities: ${new Set(entities.map(e => e.id)).size}`);
}

/**
 * Main test function
 */
async function runTest() {
  console.log('='.repeat(80));
  console.log('PubTator Entity Extraction Test');
  console.log('Testing entity extraction from text about depression vulnerability');
  console.log('='.repeat(80));
  
  // Clean the text first
  const cleanedText = cleanText(TEST_TEXT);
  console.log(`\nOriginal text length: ${TEST_TEXT.length} characters`);
  console.log(`Cleaned text length: ${cleanedText.length} characters`);
  
  // Try full cleaned text first (but only if it's reasonable size)
  if (cleanedText.length <= MAX_TEXT_LENGTH) {
    try {
      console.log('\n📝 Attempting to extract entities from full text...');
      const { entities, relations } = await annotateText(cleanedText);
      
      if (entities.length > 0) {
        displayEntities(entities, relations);
        console.log('\n✅ Successfully extracted entities from full text!');
        return;
      } else {
        console.log('\n⚠️  No entities found in full text. Trying chunks...');
      }
    } catch (error) {
      console.log(`\n❌ Error processing full text: ${error.message}`);
      console.log('\n📦 Breaking text into chunks and retrying...');
    }
  } else {
    console.log(`\n📦 Text is too long (${cleanedText.length} chars), breaking into chunks...`);
  }
  
  // If full text fails or is too long, break into chunks
  const chunks = splitTextIntoChunks(cleanedText, MAX_TEXT_LENGTH);
  console.log(`\nSplit text into ${chunks.length} chunks`);
  
  const allEntities = [];
  const allRelations = [];
  const entityMap = new Map(); // To deduplicate entities
  
  for (let i = 0; i < chunks.length; i++) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`Processing chunk ${i + 1} of ${chunks.length} (${chunks[i].length} characters)`);
    console.log('='.repeat(80));
    
    try {
      const { entities, relations } = await annotateText(chunks[i]);
      
      // Deduplicate entities by ID
      for (const entity of entities) {
        if (!entityMap.has(entity.id)) {
          entityMap.set(entity.id, entity);
          allEntities.push(entity);
        }
      }
      
      allRelations.push(...relations);
      
      console.log(`✅ Chunk ${i + 1}: Found ${entities.length} entities`);
      
      // Rate limiting between chunks
      if (i < chunks.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    } catch (error) {
      console.error(`❌ Error processing chunk ${i + 1}: ${error.message}`);
      // Continue with next chunk
    }
  }
  
  if (allEntities.length > 0) {
    displayEntities(allEntities, allRelations);
    console.log('\n✅ Successfully extracted entities from all chunks!');
  } else {
    console.log('\n❌ No entities found in any chunk.');
  }
}

// Run the test
runTest().catch(error => {
  console.error('\n\n💥 Fatal error:', error);
  process.exit(1);
});

