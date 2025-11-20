# PMID Intersection Strategy: Technical Specification
## For Web/Node Developers

---

## EXECUTIVE OVERVIEW

Instead of pairwise searches for relationships, build a complete co-occurrence network by:
1. Searching each entity individually to get its PMID set
2. Filtering by information content (specificity threshold)
3. Inverting the relationship (PMID → entity list)
4. Extracting co-occurrences from shared PMIDs

This provides exhaustive, evidence-backed relationships without exponential API calls.

---

## PART 1: ALGORITHM & DATA FLOW

### 1.1 High-Level Flow

```
INPUT: Array of 512 entities (from PubTator extraction)

PHASE 1: PMID COLLECTION
┌─────────────────────────────────────┐
│ For each entity:                    │
│  - Query PubMed for entity name     │
│  - Get total count                  │
│  - If count in range (1-10k):       │
│    • Fetch all PMIDs                │
│    • Store [entity → [PMIDs]]       │
│  Else:                              │
│    • Mark as filtered_out           │
│    • Record reason: too_common OR   │
│      too_rare OR no_results         │
└─────────────────────────────────────┘
Result: ~300-400 entities with their PMID sets
Time: ~5 minutes (512 searches × ~0.6s with rate limiting)

PHASE 2: INVERT & AGGREGATE
┌─────────────────────────────────────┐
│ Create: PMID → [entity list]        │
│ Track statistics:                   │
│  - How many entities per PMID?      │
│  - How many PMIDs per entity?       │
│  - Filter PMIDs with only 1 entity  │
└─────────────────────────────────────┘
Result: Mapping of papers to their mentioned entities
Time: ~10 seconds

PHASE 3: CO-OCCURRENCE EXTRACTION
┌─────────────────────────────────────┐
│ For each PMID with 2+ entities:     │
│  - Generate all pairwise combos     │
│  - Record: (e1, e2, PMID)           │
│  - Aggregate by pair                │
│  - Calculate statistics             │
└─────────────────────────────────────┘
Result: Co-occurrence network with evidence
Time: ~1 minute

OUTPUT: Graph with edges, PMIDs, confidence metrics
```

### 1.2 Detailed Data Structures

**Entity Search Result:**
```javascript
{
  entity_id: "FAM177A1",
  query_term: "FAM177A1",
  pubmed_count: 13,
  information_content: 0.92,  // 1 - (log(count) / log(max_possible))
  status: "success",
  pmids: ["40113264", "38585781", "39331042", ...],
  pmid_count: 13,
  filter_reason: null  // or: "too_common", "too_rare", "no_results"
}
```

**Information Content Calculation:**
```
Represents specificity. Entities with low IC are generic.

ic = 1 - (ln(publication_count) / ln(max_pubmed_results))

Example:
  FAM177A1: 13 papers
    → ln(13) = 2.56, ln(30M) = 17.2
    → ic = 1 - (2.56/17.2) = 0.85 (HIGH - specific gene)
  
  cancer: 500k papers
    → ln(500k) = 13.1, ln(30M) = 17.2
    → ic = 1 - (13.1/17.2) = 0.24 (LOW - too common)
  
  rare_variant: 2 papers
    → ln(2) = 0.69, ln(30M) = 17.2
    → ic = 1 - (0.69/17.2) = 0.96 (VERY HIGH - rare)
```

**PMID Aggregated Record:**
```javascript
{
  pmid: "40113264",
  entities_mentioned: ["FAM177A1", "patients", "neurodevelopmental disorder"],
  entity_count: 3,
  pubmed_metadata: {
    title: "Integration of transcriptomics...",
    journal: "Genome Res",
    pub_date: "2025-03-20",
    authors: [...]
  }
}
```

**Co-occurrence Record:**
```javascript
{
  entity_pair: ["FAM177A1", "patients"],
  co_occurrence_count: 8,
  pmids: ["40113264", "27488439", ...],
  confidence: 0.62,  // 8 / min(13, 48)
  information_content_pair: {
    entity1_ic: 0.92,
    entity2_ic: 0.40,
    average_ic: 0.66,
    min_ic: 0.40  // For visualization - use this
  },
  specificity: "specific+generic"  // Categorization
}
```

---

## PART 2: IMPLEMENTATION DETAILS

### 2.1 PubMed Search API

**Endpoint & Rate Limiting:**
```
Base: https://eutils.ncbi.nlm.nih.gov/entrez/eutils/

For production:
  - Provide email: &email=your-app@example.com
  - Get API key from NCBI: https://ncbi.nlm.nih.gov/account/
  - Rate limit: 10 requests/second WITH key, 3/second without
  - Implement exponential backoff with jitter

Library: Use esquery (Node.js wrapper) or axios + custom retry logic
```

**Search Strategy:**
```javascript
// Step 1: Get count
const countResponse = await fetchPubMedCount(entity);
// Returns: { count: 13, max_count: 500000 }

// Step 2: Decide if fetch
if (countResponse.count > THRESHOLD || countResponse.count === 0) {
  return { status: 'filtered', reason: 'too_common_or_rare' };
}

// Step 3: Fetch PMIDs
const pmidResponse = await fetchPubMedIds(entity, countResponse.count);
// Returns: { pmids: ['1', '2', '3', ...], count: 13 }

// Step 4: Store
return {
  entity,
  pmids: pmidResponse.pmids,
  count: pmidResponse.count,
  information_content: calculateIC(pmidResponse.count)
};
```

**Search Query Construction:**
```javascript
// Exact term search with quotes
const query = `"${entityName}"[All Fields]`;

// If that fails, try field-specific (less noise)
const alternates = [
  `"${entityName}"[Gene Name]`,
  `"${entityName}"[Title/Abstract]`,
  `"${entityName}"[MeSH Terms]`
];

// Try exact first, fall back if no results
```

**Handling Synonyms:**
```javascript
// Common synonym mappings for biomedical terms
const synonymMap = {
  'IL-1 beta': ['IL-1B', 'Interleukin 1-beta', 'IL1B'],
  'TNF': ['TNF-alpha', 'TNF-a', 'Tumor Necrosis Factor'],
  'zebrafish': ['Danio rerio']
};

// For entities with no results, try synonyms
async function searchWithFallback(entity) {
  let response = await fetchPubMedCount(entity);
  if (response.count === 0 && synonymMap[entity]) {
    for (const synonym of synonymMap[entity]) {
      response = await fetchPubMedCount(synonym);
      if (response.count > 0) return response;
    }
  }
  return response;
}
```

### 2.2 Configuration & Thresholds

```javascript
const CONFIG = {
  // PMID Collection Phase
  pubmed: {
    api_key: process.env.NCBI_API_KEY,
    email: 'your-app@example.com',
    requests_per_second: 9,  // Use 9/10 of limit for safety
    timeout_ms: 5000,
    retry_attempts: 3,
    retry_backoff_ms: 1000
  },

  // Information Content Thresholds
  entity_filter: {
    min_publications: 1,        // Too rare if fewer
    max_publications: 10000,    // Too common if more
    ic_threshold: 0.15,         // Alternative: filter by IC (very generic terms)
    min_ic: 0.10                // Don't visualize terms below this
  },

  // Co-occurrence Thresholds
  cooccurrence: {
    min_shared_pmids: 1,        // Confirm if appears together at least once
    min_confidence: 0.05        // Confidence = shared / min(total1, total2)
  },

  // Filtering Phase
  filtering: {
    min_entities_per_pmid: 2,   // Remove single-entity PMIDs
    cluster_pmids_together: true // Group related PMIDs
  }
};
```

### 2.3 Caching Strategy

```javascript
// Given API limits, cache aggressively
const cache = {
  // Redis or in-memory store
  
  // Cache searches for 24 hours
  ttl: 86400,
  
  structure: {
    'entity:FAM177A1': {
      pmids: [...],
      count: 13,
      timestamp: 1699500000,
      valid: true
    }
  }
};

// Implement cache-first pattern
async function getCachedOrFetch(entity) {
  const cached = cache.get(`entity:${entity}`);
  if (cached && !isStale(cached)) {
    return cached;
  }
  const result = await fetchPubMedIds(entity);
  cache.set(`entity:${entity}`, result, CONFIG.cache.ttl);
  return result;
}
```

### 2.4 Batch Processing with Rate Limiting

```javascript
// Process entities sequentially with rate limiting
async function collectAllPMIDs(entities) {
  const results = [];
  const rateLimiter = new RateLimiter(9, 1000); // 9 req/sec
  
  for (const entity of entities) {
    await rateLimiter.wait();
    
    try {
      const result = await getCachedOrFetch(entity);
      results.push(result);
      
      // Log progress
      const included = results.filter(r => r.status === 'success').length;
      console.log(`${included}/${entities.length} entities processed`);
      
    } catch (error) {
      console.error(`Failed to fetch ${entity}:`, error);
      results.push({
        entity,
        status: 'error',
        reason: error.message
      });
    }
  }
  
  return results;
}
```

---

## PART 3: PMID INVERSION & CO-OCCURRENCE EXTRACTION

### 3.1 Invert to PMID-Centric View

```javascript
async function invertPMIDMapping(entityResults) {
  const pmidMap = new Map(); // pmid → entities
  
  for (const result of entityResults) {
    if (result.status !== 'success') continue;
    
    for (const pmid of result.pmids) {
      if (!pmidMap.has(pmid)) {
        pmidMap.set(pmid, []);
      }
      pmidMap.get(pmid).push({
        entity: result.entity,
        entity_id: result.entity_id,
        ic: result.information_content
      });
    }
  }
  
  return pmidMap;
}
```

### 3.2 Filter Single-Entity PMIDs

```javascript
function filterNoisyPMIDs(pmidMap) {
  const filtered = new Map();
  
  let single_entity_count = 0;
  
  for (const [pmid, entities] of pmidMap) {
    if (entities.length >= 2) {
      filtered.set(pmid, entities);
    } else {
      single_entity_count++;
    }
  }
  
  console.log(`Filtered out ${single_entity_count} single-entity PMIDs`);
  console.log(`Remaining PMIDs: ${filtered.size}`);
  
  return filtered;
}
```

### 3.3 Extract Co-occurrences

```javascript
function extractCooccurrences(filteredPMIDMap) {
  const cooccurrenceMap = new Map(); // "e1|e2" → [pmids]
  
  for (const [pmid, entities] of filteredPMIDMap) {
    // Generate all pairs from entities in this PMID
    for (let i = 0; i < entities.length; i++) {
      for (let j = i + 1; j < entities.length; j++) {
        const e1 = entities[i];
        const e2 = entities[j];
        
        // Canonical ordering (alphabetical) to avoid duplicates
        const [first, second] = e1.entity < e2.entity 
          ? [e1, e2] 
          : [e2, e1];
        
        const key = `${first.entity}|${second.entity}`;
        
        if (!cooccurrenceMap.has(key)) {
          cooccurrenceMap.set(key, {
            entities: [first.entity, second.entity],
            pmids: [],
            information_content: {
              entity1_ic: first.ic,
              entity2_ic: second.ic,
              average_ic: (first.ic + second.ic) / 2,
              min_ic: Math.min(first.ic, second.ic)
            }
          });
        }
        
        cooccurrenceMap.get(key).pmids.push(pmid);
      }
    }
  }
  
  // Convert to array with counts and confidence
  const cooccurrences = Array.from(cooccurrenceMap.values())
    .map(item => ({
      ...item,
      cooccurrence_count: item.pmids.length,
      confidence: calculateConfidence(item)
    }))
    .sort((a, b) => b.cooccurrence_count - a.cooccurrence_count);
  
  return cooccurrences;
}

function calculateConfidence(cooccurrenceItem) {
  // Get entity frequencies from original searches
  const entity1Count = getEntityCount(cooccurrenceItem.entities[0]);
  const entity2Count = getEntityCount(cooccurrenceItem.entities[1]);
  
  const minCount = Math.min(entity1Count, entity2Count);
  const shared = cooccurrenceItem.cooccurrence_count;
  
  return shared / minCount;
}
```

---

## PART 4: INFORMATION CONTENT & VISUALIZATION

### 4.1 Information Content Metric

```javascript
function calculateInformationContent(pubmedCount) {
  // IC represents specificity/rarity of term
  // IC=1.0 means very specific (rare)
  // IC=0.0 means very generic (ubiquitous)
  
  const MAX_PUBMED = 30000000; // Approximate max papers in PubMed
  const MIN_IC = 0.05; // Floor to avoid log(0)
  
  if (pubmedCount === 0) return 0;
  if (pubmedCount > MAX_PUBMED) return 0;
  
  const normalized = pubmedCount / MAX_PUBMED;
  const ic = 1 - Math.log(normalized) / Math.log(MAX_PUBMED / 1);
  
  return Math.max(MIN_IC, Math.min(1.0, ic));
}

// Categorize entities by information content
function categorizeByInformationContent(entities) {
  return {
    highly_specific: entities.filter(e => e.ic > 0.80),
    specific: entities.filter(e => e.ic > 0.60 && e.ic <= 0.80),
    moderate: entities.filter(e => e.ic > 0.30 && e.ic <= 0.60),
    generic: entities.filter(e => e.ic > 0.15 && e.ic <= 0.30),
    very_generic: entities.filter(e => e.ic <= 0.15)
  };
}
```

### 4.2 Visualization: Color by Information Content

**Color Strategy:**
```
Information Content → Darkness/Saturation

High IC (Specific):     Bright, saturated colors
  ├─ 0.80-1.0: Deep/saturated (darkest)
  ├─ 0.60-0.80: Normal saturation
  ├─ 0.40-0.60: Medium desaturated
  ├─ 0.20-0.40: Light/desaturated
Low IC (Generic):       Pale, muted colors (lightest)
  └─ 0.00-0.20: Very pale/gray
```

**Implementation (React/D3 example):**
```javascript
// Node color function
function getNodeColor(entity) {
  const ic = entity.information_content;
  
  // Color schemes by entity type
  const colors = {
    Gene: {
      base: '#3b82f6',      // Blue
      high_ic: '#1e40af',   // Deep blue
      low_ic: '#dbeafe'     // Very light blue
    },
    Disease: {
      base: '#ef4444',      // Red
      high_ic: '#7f1d1d',   // Deep red
      low_ic: '#fee2e2'     // Very light red
    },
    Chemical: {
      base: '#f59e0b',      // Amber
      high_ic: '#92400e',   // Deep amber
      low_ic: '#fef3c7'     // Very light amber
    },
    Species: {
      base: '#10b981',      // Green
      high_ic: '#064e3b',   // Deep green
      low_ic: '#d1fae5'     // Very light green
    }
  };
  
  const typeColors = colors[entity.type] || colors.Gene;
  
  // Interpolate between high_ic and low_ic colors based on IC
  if (ic > 0.6) {
    return typeColors.high_ic;
  } else if (ic < 0.3) {
    return typeColors.low_ic;
  } else {
    // Interpolate between high_ic and low_ic
    const factor = (ic - 0.3) / 0.3;
    return interpolateColors(typeColors.high_ic, typeColors.low_ic, factor);
  }
}

// Helper: Interpolate between two hex colors
function interpolateColors(color1, color2, factor) {
  const hex = (x) => {
    return ("0" + parseInt(x).toString(16)).slice(-2);
  };
  
  const c1 = parseInt(color1.slice(1), 16);
  const c2 = parseInt(color2.slice(1), 16);
  
  const r = Math.round((c1 >> 16) * (1 - factor) + (c2 >> 16) * factor);
  const g = Math.round((((c1 >> 8) & 0x00FF) * (1 - factor) + ((c2 >> 8) & 0x00FF) * factor));
  const b = Math.round(((c1 & 0x0000FF) * (1 - factor) + (c2 & 0x0000FF) * factor));
  
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}

// Node size variation
function getNodeSize(entity) {
  // Size by frequency, but modulate by IC
  const baseSize = 5 + entity.publications / 10;
  const icModifier = 0.8 + entity.information_content * 0.4;
  
  return baseSize * icModifier;
}

// Node opacity
function getNodeOpacity(entity) {
  // Generic terms (low IC) are more transparent
  return Math.max(0.3, entity.information_content);
}

// Node stroke for emphasis
function getNodeStroke(entity) {
  if (entity.information_content > 0.75) {
    return { strokeWidth: 2, stroke: 'black' }; // Specific terms have bold outline
  } else if (entity.information_content < 0.25) {
    return { strokeWidth: 0.5, stroke: 'gray' }; // Generic terms have thin outline
  } else {
    return { strokeWidth: 1, stroke: 'currentColor' };
  }
}
```

**SVG Rendering:**
```javascript
// In your D3/Cytoscape visualization
nodes.forEach(node => {
  const color = getNodeColor(node.data);
  const size = getNodeSize(node.data);
  const opacity = getNodeOpacity(node.data);
  const stroke = getNodeStroke(node.data);
  
  drawCircle({
    center: node.position,
    radius: size,
    fill: color,
    fillOpacity: opacity,
    ...stroke,
    title: `${node.data.entity} (IC: ${node.data.ic.toFixed(2)})`
  });
});
```

**Legend for Users:**
```javascript
// Display color gradient with labels
const icLegend = [
  { ic: 0.95, label: 'Highly Specific (Rare)', example: 'FAM177A1 (13 papers)' },
  { ic: 0.70, label: 'Specific (Common Gene)', example: 'TNF (100+ papers)' },
  { ic: 0.40, label: 'Moderate (Disease Group)', example: 'Inflammatory Disease' },
  { ic: 0.20, label: 'Generic (Broad Term)', example: 'Inflammation (1000s)' },
  { ic: 0.05, label: 'Very Generic (Skipped)', example: 'Patient (millions)' }
];

// Render legend with color swatches
```

### 4.3 Filtering UI

```javascript
// Allow users to filter by information content
const informationContentFilter = {
  min: 0.0,
  max: 1.0,
  step: 0.05,
  labels: {
    0.00: 'Show all terms',
    0.25: 'Hide very generic',
    0.50: 'Only moderate+specific',
    0.75: 'Only specific terms',
    1.00: 'Only rare terms'
  }
};

// Apply filter
function filterNetworkByIC(network, minIC) {
  return {
    nodes: network.nodes.filter(n => n.information_content >= minIC),
    edges: network.edges.filter(e => {
      const node1IC = network.nodes.find(n => n.id === e.from)?.information_content;
      const node2IC = network.nodes.find(n => n.id === e.to)?.information_content;
      return (node1IC >= minIC) && (node2IC >= minIC);
    })
  };
}
```

---

## PART 5: PERFORMANCE & OPTIMIZATION

### 5.1 Time Estimates

```
PHASE 1: PMID Collection
  512 searches × 0.6s average = 307 seconds
  With rate limiting (9 req/s): ~57 seconds
  With caching: 0-57s depending on cache hit rate
  
PHASE 2: Inversion
  Create PMID map: ~5 seconds
  Filter single-entity: ~2 seconds
  
PHASE 3: Co-occurrence Extraction
  Generate pairs: ~30 seconds (depends on avg entities/PMID)
  Sort and aggregate: ~5 seconds
  
TOTAL: ~100 seconds = 1.5-2 minutes
(Or 2-5 minutes first run, <1 minute on cache hits)
```

### 5.2 Memory Considerations

```javascript
// Estimate data structures
Entities: 512 × 500 bytes = 256 KB
PMIDs per entity (avg): 30 × 512 = 15,360 PMIDs
  Storage: 15,360 × 20 bytes = ~300 KB
PMID inverted map: 15,360 × 100 bytes = ~1.5 MB
Co-occurrences: ~1,000-2,000 × 200 bytes = 200-400 KB

Total: ~2-3 MB (easily fits in memory)
```

### 5.3 Database Schema (for persistence)

```javascript
// MongoDB/Postgres schema suggestions

collections: {
  entities: {
    entity_id: String,
    name: String,
    type: String,
    pubmed_count: Integer,
    information_content: Float,
    pmids: Array<String>,
    status: String,
    fetch_timestamp: Date
  },
  
  cooccurrences: {
    entity1: String,
    entity2: String,
    cooccurrence_count: Integer,
    pmids: Array<String>,
    confidence: Float,
    information_content_pair: Object,
    discovered_from: 'pmid_intersection'
  },
  
  pmid_metadata: {
    pmid: String,
    title: String,
    journal: String,
    pub_date: Date,
    entities_mentioned: Array<String>
  }
}
```

---

## PART 6: ERROR HANDLING & EDGE CASES

### 6.1 Robust Search Implementation

```javascript
async function robustPubMedSearch(entity) {
  const strategies = [
    {
      query: `"${entity}"[All Fields]`,
      name: 'exact_all_fields'
    },
    {
      query: `"${entity}"[Title/Abstract]`,
      name: 'title_abstract'
    },
    {
      query: `${entity}[All Fields]`,
      name: 'fuzzy_all_fields'
    }
  ];
  
  for (const strategy of strategies) {
    try {
      const result = await fetchPubMedCount(strategy.query);
      
      if (result.count > 0) {
        // Success - fetch full PMID list
        const pmids = await fetchPubMedIds(strategy.query, result.count);
        return {
          entity,
          pmids: pmids.ids,
          count: result.count,
          search_strategy: strategy.name,
          status: 'success'
        };
      }
    } catch (error) {
      // Try next strategy
      console.log(`Strategy ${strategy.name} failed, trying next...`);
    }
  }
  
  // All strategies failed
  return {
    entity,
    status: 'no_results',
    reason: 'entity_not_found_in_pubmed'
  };
}
```

### 6.2 Handling API Errors

```javascript
class PubMedFetcher {
  constructor() {
    this.retryConfig = {
      max_attempts: 3,
      initial_wait_ms: 1000,
      max_wait_ms: 30000
    };
  }
  
  async fetchWithRetry(url, attempt = 1) {
    try {
      return await this.fetch(url);
    } catch (error) {
      if (attempt < this.retryConfig.max_attempts) {
        const wait_ms = Math.min(
          this.retryConfig.initial_wait_ms * Math.pow(2, attempt - 1),
          this.retryConfig.max_wait_ms
        );
        await delay(wait_ms);
        return this.fetchWithRetry(url, attempt + 1);
      }
      throw error;
    }
  }
}
```

---

## PART 7: INTEGRATION WITH EXISTING SYSTEM

### 7.1 Pipeline Integration

```javascript
// After PubTator extraction
async function enrichNetworkWithPMIDIntersection(pubtatorNetwork) {
  
  // Step 1: Extract entity names from Tier 0
  const entities = Array.from(pubtatorNetwork.nodes.values())
    .map(node => ({ name: node.name, type: node.type }));
  
  // Step 2: Collect PMIDs for each
  const pmidCollector = new PMIDCollector(CONFIG);
  const pmidResults = await pmidCollector.collectAll(entities);
  
  // Step 3: Filter by information content
  const filtered = pmidResults.filter(r => 
    r.status === 'success' && 
    r.information_content >= CONFIG.entity_filter.min_ic
  );
  
  // Step 4: Generate co-occurrences
  const pmidMap = invertPMIDMapping(filtered);
  const cleanedPMIDMap = filterNoisyPMIDs(pmidMap);
  const cooccurrences = extractCooccurrences(cleanedPMIDMap);
  
  // Step 5: Add to network
  for (const cooc of cooccurrences) {
    pubtatorNetwork.addEdge({
      source: cooc.entities[0],
      target: cooc.entities[1],
      weight: cooc.cooccurrence_count,
      confidence: cooc.confidence,
      pmids: cooc.pmids,
      discovery_method: 'pmid_intersection',
      information_content: cooc.information_content_pair
    });
  }
  
  return pubtatorNetwork;
}
```

### 7.2 Updating Tier 1 & 2 Data

```javascript
// Tier 2: Seed expansions now have better validation
async function validateAndEnrichExpansion(newPapers) {
  
  // For each new entity from expansion
  const newEntities = extractNewEntities(newPapers);
  
  // Collect PMIDs for validation
  const pmidResults = await pmidCollector.collectAll(newEntities);
  
  // Create co-occurrences
  const cooccurrences = generateCooccurrences(pmidResults);
  
  // Add validation confidence
  return cooccurrences.map(cooc => ({
    ...cooc,
    validation: 'pmid_intersection_confirmed',
    evidence_strength: 'high'
  }));
}
```

---

## PART 8: DELIVERABLES CHECKLIST

**Core Implementation:**
- [ ] PubMed API wrapper with rate limiting
- [ ] Information content calculation
- [ ] PMID collection pipeline (512 searches)
- [ ] PMID inversion algorithm
- [ ] Co-occurrence extraction
- [ ] Caching layer

**Visualization:**
- [ ] Color coding by information content
- [ ] Node opacity/size modulation
- [ ] Legend/tooltip showing IC values
- [ ] Filter UI for IC threshold
- [ ] Network display with new edges highlighted

**Integration:**
- [ ] Data pipeline integration
- [ ] Database persistence
- [ ] Tier 2 enrichment
- [ ] Error handling & logging

**Testing:**
- [ ] Unit tests for IC calculation
- [ ] Integration test with sample data
- [ ] Rate limiting behavior verification
- [ ] Cache hit rate metrics

---

## CONCLUSION

This approach transforms relationship discovery from "guess which pairs to test" to "systematically test all meaningful pairs." By leveraging individual searches and natural PMID intersection, you get:

✅ Complete coverage of specific entities (<10k papers)
✅ Automatic discovery without pairwise searches
✅ Evidence-backed relationships (actual PMIDs)
✅ Information content filtering for visualization
✅ ~1.5-2 minute execution time
✅ ~2-3 MB memory footprint
✅ Clear visual distinction between generic and specific terms

The information content metric provides an intuitive way to display low-information nodes as progressively lighter/more transparent, helping users focus on specific, meaningful research rather than generic terms.