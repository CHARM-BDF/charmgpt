# Agentic Research System - Comprehensive Design Plan

## Document Overview

This document captures the complete design for transforming the Charm MCP system into an intelligent, autonomous research platform capable of:

1. **Knowledge graph-driven research planning** using PubTator entity extraction
2. **Recursive paper exploration** following entity relationships and co-occurrences
3. **Automatic research plan generation** based on graph topology analysis
4. **RAG-enhanced deep analysis** with semantic search and full-text understanding
5. **Evidence-graded synthesis** distinguishing strong relationships from hypotheses
6. **Rare entity handling** with special exploration strategies for understudied topics

---

## Table of Contents

1. [Current System Capabilities](#current-system-capabilities)
2. [Implementation Options Overview](#implementation-options-overview)
3. [Recommended Architecture: Graph + RAG Hybrid](#recommended-architecture-graph--rag-hybrid)
4. [Phase 1: Knowledge Graph Landscape Discovery](#phase-1-knowledge-graph-landscape-discovery)
5. [Phase 2: RAG-Enhanced Deep Research](#phase-2-rag-enhanced-deep-research)
6. [Phase 3: Evidence-Graded Synthesis](#phase-3-evidence-graded-synthesis)
7. [Entity-Driven Planning Strategies](#entity-driven-planning-strategies)
8. [RAG Integration Deep Dive](#rag-integration-deep-dive)
9. [Implementation Roadmap](#implementation-roadmap)
10. [Code Architecture](#code-architecture)
11. [Example Workflows](#example-workflows)
12. [Cost and Performance Estimates](#cost-and-performance-estimates)

---

## Current System Capabilities

### What Works Today

**Sequential Thinking Loop:**
- Location: `backend-mcp-client/src/services/chat/index.ts:1198`
- Current limit: `MAX_THINKING_STEPS = 5`
- Has retry logic with exponential backoff
- Session-level tool call tracking

**PubMed/PubTator MCP Tools** (from `graphmodePubTatorMCP`):
1. `addNodesFromPMIDs` - Extract entities from PubMed IDs
2. `addNodesAndEdgesFromText` - Extract entities from arbitrary text
3. `addNodesFromEntityNetwork` - Build entity relationship networks
4. `findRelatedEntities` - Find entities related to a target
5. `findAllRelatedEntities` - Comprehensive related entity search
6. `addNodesByName` - Find entities by name
7. `findPublicationsForRelationship` - Find papers about entity relationships
8. `findPublicationsByTerm` - Search PubMed by terms

**PubTator Entity Types:**
- Genes (with standard IDs like Gene:672 for BRCA1)
- Diseases (with MESH IDs)
- Chemicals/Drugs (with MESH IDs)
- Species
- Mutations
- Cell types

**PubTator Relationship Extraction:**
- Only extracts edges when **clearly described relationships** exist
- Edge types: inhibits, activates, treats, associated_with, regulates, etc.
- Papers with edges likely contain **primary mechanistic data**
- Co-occurrence without edges = entities mentioned together but no documented relationship

**Knowledge Graph System:**
- Already stores nodes and edges in database
- Graph mode with persistence
- Visualization with Reagraph
- Merge capability

**Artifact System:**
- Multiple artifact types supported
- Stored in SQLite with metadata
- Frontend rendering

### Current Limitations

| Limitation | Impact |
|------------|--------|
| 5 iteration limit | Cannot do deep recursive research |
| No research plan persistence | Manual guidance needed |
| No full-text storage | Limited to abstracts |
| No semantic search | Keyword-only |
| No entity-driven planning | Doesn't leverage graph topology |
| No evidence grading | Treats all evidence equally |

---

## Implementation Options Overview

### Option 1: Minimal Changes (1-2 days)
**Approach:** Increase iteration limit, add research mode prompt

**Changes:**
- `MAX_THINKING_STEPS` from 5 to 25
- Add `researchModeSystemPrompt.ts`
- Simple in-memory paper cache

**Pros:** Quick, minimal risk
**Cons:** Still limited by context window, no persistence

### Option 2: Moderate Changes (1-2 weeks)
**Approach:** Add research session database + orchestration

**Changes:**
- Database models: ResearchSession, ResearchTopic, ResearchPaper
- ResearchOrchestrator service
- Persistent research plans
- Progress tracking

**Pros:** Unlimited iteration, persistent state
**Cons:** No semantic search, abstracts only

### Option 3: Multi-Agent (3-4 weeks)
**Approach:** Specialized agents for different research tasks

**Components:**
- PlannerAgent, SearcherAgent, AnalyzerAgent, SynthesizerAgent
- Agent communication protocol
- Parallel execution

**Pros:** Specialized intelligence, parallel processing
**Cons:** Complex, higher LLM costs

### Option 4: Full RAG (4-6 weeks)
**Approach:** Vector database + semantic search + full-text

**Infrastructure:**
- PostgreSQL + pgvector extension
- Embedding service (OpenAI)
- Paper chunking and indexing
- Semantic retrieval

**Pros:** Best research quality, semantic understanding
**Cons:** Infrastructure changes, higher costs

---

## Recommended Architecture: Graph + RAG Hybrid

### The Optimal Approach

**Combine entity-driven planning (PubTator graph) with RAG depth**

This hybrid approach uses:
1. **Knowledge graph** for research landscape mapping and planning
2. **RAG** for deep analysis and evidence extraction
3. **Existing sequential thinking** as the orchestration layer

### Three-Phase Research Process

```
┌────────────────────────────────────────────────────────┐
│ PHASE 1: LANDSCAPE DISCOVERY (Knowledge Graph)         │
│ - Extract entities from abstracts (PubTator)           │
│ - Build knowledge graph (nodes + edges)                │
│ - Analyze topology (hubs, clusters, gaps)              │
│ - Generate research plan                               │
│ Duration: 5-15 minutes                                 │
└─────────────────┬──────────────────────────────────────┘
                  │
                  ▼
┌────────────────────────────────────────────────────────┐
│ PHASE 2: DEEP RESEARCH (RAG + Sequential Thinking)     │
│ - Execute research plan topics in priority order       │
│ - Index papers with full text in RAG                   │
│ - Semantic search for evidence                         │
│ - Extract detailed findings                            │
│ - Update knowledge graph with new edges                │
│ Duration: 30-90 minutes                                │
└─────────────────┬──────────────────────────────────────┘
                  │
                  ▼
┌────────────────────────────────────────────────────────┐
│ PHASE 3: SYNTHESIS (Evidence-Graded Report)            │
│ - Synthesize findings by evidence grade                │
│ - Strong: Papers with edges (primary data)             │
│ - Moderate: Co-occurrence patterns (indirect)          │
│ - Hypotheses: Gaps identified from graph               │
│ - Include updated knowledge graph visualization        │
│ Duration: 5-10 minutes                                 │
└────────────────────────────────────────────────────────┘
```

---

## Phase 1: Knowledge Graph Landscape Discovery

### Overview

Use PubTator to extract entities and relationships from abstracts to create a research landscape map **before** deep reading begins.

### Step-by-Step Process

#### Step 1: Initial Broad Search

```
User input: "Research BRCA1 gene mutations"
    ↓
Sequential thinking calls: findPublicationsByTerm("BRCA1 mutations")
    ↓
Returns: Array of PMIDs (e.g., 347 papers)
    ↓
Strategy selection based on volume:
  - If < 50 papers: RARE ENTITY mode (extract from all)
  - If 50-200 papers: Extract from all
  - If 200-500 papers: Extract from top 200 (by citation + recency)
  - If > 500 papers: Sample 300 (top 200 cited + 100 recent)
```

#### Step 2: Entity Extraction from Abstracts

```
For PMID batches (100 at a time):
    ↓
Call: addNodesFromPMIDs([pmid1, pmid2, ..., pmid100])
    ↓
PubTator returns for each paper:
  {
    pmid: "12345",
    entities: [
      {id: "Gene:672", name: "BRCA1", type: "gene", mentions: [...]},
      {id: "Gene:7157", name: "TP53", type: "gene", mentions: [...]},
      {id: "Disease:MESH:D001943", name: "Breast Neoplasms", type: "disease"},
      {id: "Chemical:MESH:D000077216", name: "Olaparib", type: "chemical"}
    ],
    relationships: [
      {
        type: "positive_correlation",
        entity1: "Gene:672",
        entity2: "Disease:MESH:D001943",
        confidence: 0.89
      },
      {
        type: "treats",
        entity1: "Chemical:MESH:D000077216",
        entity2: "Disease:MESH:D001943",
        confidence: 0.95
      }
    ]
  }
    ↓
Store in knowledge graph database:
  - Nodes: Unique entities across all papers
  - Edges: Documented relationships
  - Metadata: Track which papers contribute which edges
  - Co-occurrence: Track entities appearing in same abstracts
```

#### Step 3: Build Composite Knowledge Graph

```typescript
// Example graph structure after processing 347 papers

KnowledgeGraph {
  nodes: [
    {
      id: "Gene:672",
      label: "BRCA1",
      type: "gene",
      properties: {
        papers: 347,           // Appears in 347 papers
        edgeCount: 12,         // Has 12 documented relationships
        coOccurrences: 45      // Co-occurs with 45 other entities
      }
    },
    {
      id: "Gene:7157",
      label: "TP53",
      type: "gene",
      properties: {
        papers: 178,           // Appears in 178 papers (subset)
        edgeCount: 3,
        coOccurrences: 23
      }
    },
    {
      id: "Chemical:D000077216",
      label: "Olaparib",
      type: "chemical",
      properties: {
        papers: 89,
        edgeCount: 5,          // Has documented mechanisms
        coOccurrences: 12
      }
    }
  ],

  edges: [
    {
      id: "edge-1",
      source: "Gene:672",
      target: "Process:DNA_repair",
      type: "inhibits",
      properties: {
        papers: ["PMID:111", "PMID:222", ..., "PMID:999"], // 89 papers
        paperCount: 89,
        confidence: 0.95,
        evidenceGrade: "STRONG"
      }
    },
    {
      id: "edge-2",
      source: "Gene:672",
      target: "Disease:MESH:D001943",
      type: "associated_with",
      properties: {
        papers: ["PMID:333", ...],
        paperCount: 234,
        confidence: 0.98,
        evidenceGrade: "STRONG"
      }
    },
    {
      id: "edge-3",
      source: "Chemical:D000077216",
      target: "Gene:672",
      type: "targets",
      properties: {
        papers: ["PMID:444", ...],
        paperCount: 45,
        confidence: 0.92,
        evidenceGrade: "STRONG"
      }
    }
  ],

  coOccurrences: [
    {
      entity1: "Gene:672",       // BRCA1
      entity2: "Gene:7157",      // TP53
      papers: ["PMID:555", ...],
      paperCount: 156,
      hasEdge: false,            // No documented relationship!
      evidenceGrade: "GAP"       // High co-occurrence = potential relationship
    },
    {
      entity1: "Gene:672",
      entity2: "Gene:472",       // ATM
      papers: ["PMID:666", ...],
      paperCount: 23,
      hasEdge: true,             // 1 edge documented
      edgeCount: 1,
      evidenceGrade: "EMERGING"  // Some evidence, growing area
    }
  ]
}
```

#### Step 4: Graph Topology Analysis

```typescript
interface GraphMetrics {
  // Node-level metrics
  nodeDegree: Map<string, number>;        // # connections per node
  nodeHubScore: Map<string, number>;      // Centrality metric

  // Edge metrics
  edgeStrength: Map<string, number>;      // # papers supporting edge
  edgeConfidence: Map<string, number>;    // PubTator confidence

  // Cluster detection
  clusters: Array<{
    id: string;
    nodes: string[];
    theme: string;                        // e.g., "DNA repair", "Treatment"
    density: number;                      // How interconnected
  }>;

  // Gap identification
  gaps: Array<{
    entity1: string;
    entity2: string;
    coOccurrence: number;
    hasEdge: boolean;
    gapType: "HIGH_POTENTIAL" | "EXPLORATORY" | "COINCIDENTAL"
  }>;

  // Rare entity detection
  rareEntities: Array<{
    id: string;
    paperCount: number;
    strategy: "COMPREHENSIVE_EXPLORATION"
  }>;
}

// Calculate metrics
function analyzeGraphTopology(graph: KnowledgeGraph): GraphMetrics {

  // 1. Calculate node degrees
  const nodeDegree = new Map();
  for (const node of graph.nodes) {
    const degree = graph.edges.filter(e =>
      e.source === node.id || e.target === node.id
    ).length;
    nodeDegree.set(node.id, degree);
  }

  // 2. Identify hubs (highly connected nodes)
  // BRCA1: 12 edges → HUB (well-studied)
  // Novel_gene_X: 0 edges → PERIPHERAL (understudied)

  // 3. Calculate edge strength
  const edgeStrength = new Map();
  for (const edge of graph.edges) {
    edgeStrength.set(edge.id, edge.properties.paperCount);
  }
  // BRCA1--DNA_repair: 89 papers → STRONG
  // BRCA1--ATM: 1 paper → WEAK/EMERGING

  // 4. Detect clusters (communities)
  const clusters = detectClusters(graph);
  // Cluster 1: {BRCA1, BRCA2, RAD51, PALB2} → DNA repair machinery
  // Cluster 2: {BRCA1, TP53, PTEN, PIK3CA} → Tumor suppressors
  // Cluster 3: {Olaparib, Cisplatin, Carboplatin} → Chemotherapy

  // 5. Identify gaps (high co-occurrence, no edges)
  const gaps = [];
  for (const coOcc of graph.coOccurrences) {
    if (!coOcc.hasEdge && coOcc.paperCount > 50) {
      gaps.push({
        entity1: coOcc.entity1,
        entity2: coOcc.entity2,
        coOccurrence: coOcc.paperCount,
        hasEdge: false,
        gapType: "HIGH_POTENTIAL"  // Likely relationship exists but not documented
      });
    } else if (!coOcc.hasEdge && coOcc.paperCount > 10) {
      gaps.push({
        ...coOcc,
        gapType: "EXPLORATORY"     // Worth investigating
      });
    }
  }

  // 6. Detect rare entities (main topic in <50 papers)
  const mainEntity = identifyMainEntity(graph);
  const isRare = mainEntity.properties.papers < 50;

  return {
    nodeDegree,
    nodeHubScore,
    edgeStrength,
    edgeConfidence,
    clusters,
    gaps,
    rareEntities: isRare ? [mainEntity] : [],
    isRareEntityMode: isRare
  };
}
```

#### Step 5: Research Plan Generation

```typescript
interface ResearchTopic {
  id: string;
  name: string;
  category: TopicCategory;
  entities: Entity[];
  edges: number;                    // # documented relationships
  coOccurrence?: number;            // # co-occurrence papers
  papers: string[];                 // PMIDs
  priority: number;                 // 1-10
  researchDepth: "comprehensive" | "focused" | "exploratory";
  expectedOutcome: string;
  evidenceGrade: EvidenceGrade;
}

type TopicCategory =
  | "WELL_ESTABLISHED"      // Many edges, foundational knowledge
  | "THERAPEUTIC"           // Drug/treatment with documented mechanism
  | "EMERGING"              // Some edges, growing area
  | "GAP_EXPLORATION"       // High co-occurrence, no edges
  | "RARE_ENTITY_EXPLORATION" // When main entity has <50 papers
  | "CONTEXT_BUILDING";     // Learn about related entities

type EvidenceGrade =
  | "STRONG"                // 50+ papers with edges
  | "MODERATE"              // 10-50 papers with edges
  | "EMERGING"              // 1-10 papers with edges
  | "INDIRECT"              // Co-occurrence only, no direct edges
  | "HYPOTHESIS";           // Gap identified, needs investigation

function generateResearchPlan(
  graph: KnowledgeGraph,
  metrics: GraphMetrics,
  userQuery: string
): ResearchPlan {

  const topics: ResearchTopic[] = [];
  const mainEntity = identifyMainEntity(graph);

  // Strategy 1: WELL-ESTABLISHED topics (foundation)
  // Find edges with high paper counts
  const strongEdges = graph.edges.filter(e =>
    e.properties.paperCount >= 50 &&
    (e.source === mainEntity.id || e.target === mainEntity.id)
  );

  for (const edge of strongEdges) {
    topics.push({
      id: generateId(),
      name: `${mainEntity.label} role in ${getEntityLabel(edge.target)}`,
      category: "WELL_ESTABLISHED",
      entities: [mainEntity, getEntity(edge.target)],
      edges: edge.properties.paperCount,
      papers: edge.properties.papers,
      priority: 10,
      researchDepth: "comprehensive",
      expectedOutcome: "Detailed mechanism with multiple pathways documented",
      evidenceGrade: "STRONG"
    });
  }

  // Strategy 2: THERAPEUTIC topics (clinical relevance)
  // Find drug/chemical entities with edges to main entity
  const therapeuticEdges = graph.edges.filter(e =>
    getEntity(e.source).type === "chemical" &&
    e.target === mainEntity.id
  );

  for (const edge of therapeuticEdges) {
    const drug = getEntity(edge.source);
    topics.push({
      id: generateId(),
      name: `${drug.label} mechanism in ${mainEntity.label} context`,
      category: "THERAPEUTIC",
      entities: [drug, mainEntity],
      edges: edge.properties.paperCount,
      papers: edge.properties.papers,
      priority: 9,
      researchDepth: "comprehensive",
      expectedOutcome: "Clinical efficacy + mechanism of action",
      evidenceGrade: edge.properties.paperCount >= 20 ? "STRONG" : "MODERATE"
    });
  }

  // Strategy 3: GAP EXPLORATION (high co-occurrence, no edges)
  const highPotentialGaps = metrics.gaps.filter(g =>
    g.gapType === "HIGH_POTENTIAL" &&
    (g.entity1 === mainEntity.id || g.entity2 === mainEntity.id)
  );

  for (const gap of highPotentialGaps) {
    const otherEntity = gap.entity1 === mainEntity.id ?
      getEntity(gap.entity2) : getEntity(gap.entity1);

    topics.push({
      id: generateId(),
      name: `${mainEntity.label}-${otherEntity.label} potential interaction`,
      category: "GAP_EXPLORATION",
      entities: [mainEntity, otherEntity],
      edges: 0,
      coOccurrence: gap.coOccurrence,
      papers: getCoOccurrencePapers(gap),
      priority: 6,
      researchDepth: "exploratory",
      expectedOutcome: "Identify if relationship exists, propose hypotheses if only co-occurrence",
      evidenceGrade: "HYPOTHESIS"
    });
  }

  // Strategy 4: EMERGING topics (1-10 edges)
  const emergingEdges = graph.edges.filter(e =>
    e.properties.paperCount >= 1 && e.properties.paperCount < 10 &&
    (e.source === mainEntity.id || e.target === mainEntity.id)
  );

  for (const edge of emergingEdges) {
    topics.push({
      id: generateId(),
      name: `${mainEntity.label} ${edge.type} ${getEntityLabel(edge.target)}`,
      category: "EMERGING",
      entities: [mainEntity, getEntity(edge.target)],
      edges: edge.properties.paperCount,
      papers: edge.properties.papers,
      priority: 5,
      researchDepth: "focused",
      expectedOutcome: "Determine if emerging relationship or preliminary finding",
      evidenceGrade: "EMERGING"
    });
  }

  // Strategy 5: RARE ENTITY MODE (only if main entity has <50 papers)
  if (metrics.isRareEntityMode) {
    // When entity is rare, explore ALL co-occurring entities
    // even without edges
    const allCoOccurrences = graph.coOccurrences.filter(c =>
      c.entity1 === mainEntity.id || c.entity2 === mainEntity.id
    );

    for (const coOcc of allCoOccurrences) {
      const otherEntity = coOcc.entity1 === mainEntity.id ?
        getEntity(coOcc.entity2) : getEntity(coOcc.entity1);

      topics.push({
        id: generateId(),
        name: `${mainEntity.label}-${otherEntity.label} connection (rare entity exploration)`,
        category: "RARE_ENTITY_EXPLORATION",
        entities: [mainEntity, otherEntity],
        edges: coOcc.edgeCount || 0,
        coOccurrence: coOcc.paperCount,
        papers: coOcc.papers,
        priority: coOcc.paperCount >= 5 ? 9 : 7,  // High priority when rare
        researchDepth: "comprehensive",
        expectedOutcome: "Build foundational knowledge about rare entity",
        evidenceGrade: coOcc.hasEdge ? "EMERGING" : "HYPOTHESIS"
      });
    }

    // Also add context-building from highly-connected related entities
    const relatedHubs = allCoOccurrences
      .map(c => c.entity1 === mainEntity.id ? c.entity2 : c.entity1)
      .filter(entityId => {
        const entity = getEntity(entityId);
        return entity.properties.papers > 100;  // Well-studied entity
      });

    for (const hubId of relatedHubs.slice(0, 3)) {  // Top 3 hubs
      const hub = getEntity(hubId);
      topics.push({
        id: generateId(),
        name: `${hub.label} mechanisms (context for ${mainEntity.label})`,
        category: "CONTEXT_BUILDING",
        entities: [hub],
        edges: -1,  // Will sample from hub's papers
        papers: [],  // Will be determined during execution
        priority: 6,
        researchDepth: "focused",
        expectedOutcome: `Understand ${hub.label} to infer ${mainEntity.label} effects`,
        evidenceGrade: "STRONG"  // For the hub entity itself
      });
    }
  }

  // Sort by priority
  topics.sort((a, b) => b.priority - a.priority);

  return {
    mainTopic: userQuery,
    mainEntity,
    isRareEntity: metrics.isRareEntityMode,
    strategy: metrics.isRareEntityMode ?
      "comprehensive_exploration" : "evidence_prioritized",
    topics,
    metadata: {
      totalPapers: graph.nodes.find(n => n.id === mainEntity.id)?.properties.papers || 0,
      entitiesFound: graph.nodes.length,
      edgesFound: graph.edges.length,
      clusters: metrics.clusters.length,
      gapsIdentified: metrics.gaps.length,
      estimatedTime: estimateResearchTime(topics)
    }
  };
}
```

#### Step 6: Present Plan to User

```typescript
// After plan generation, show user the landscape

interface ResearchPlanPresentation {
  summary: string;
  visualization: KnowledgeGraphVisualization;
  topics: ResearchTopicSummary[];
  userOptions: {
    startResearch: boolean;
    modifyPlan: boolean;
    uploadPapers: boolean;
  };
}

async function presentResearchPlan(plan: ResearchPlan): Promise<void> {

  const presentation = {
    summary: `
## Research Landscape for "${plan.mainTopic}"

**Overview:**
- ${plan.metadata.totalPapers} papers found
- ${plan.metadata.entitiesFound} unique entities
- ${plan.metadata.edgesFound} documented relationships
- ${plan.metadata.clusters} major research clusters
${plan.isRareEntity ? '- ⚠️ RARE ENTITY: Comprehensive exploration strategy activated' : ''}

**Research Strategy:**
${plan.strategy === 'comprehensive_exploration' ?
  'Explore all connections due to limited literature' :
  'Prioritize well-documented mechanisms, then explore gaps'}

**Estimated Time:** ${plan.metadata.estimatedTime}
`,

    visualization: {
      type: "knowledge-graph",
      data: {
        nodes: plan.mainEntity,  // Center on main entity
        edges: plan.topics.map(t => t.edges),
        highlights: {
          strong: plan.topics.filter(t => t.evidenceGrade === "STRONG"),
          gaps: plan.topics.filter(t => t.evidenceGrade === "HYPOTHESIS"),
          emerging: plan.topics.filter(t => t.evidenceGrade === "EMERGING")
        }
      }
    },

    topics: plan.topics.map(topic => ({
      name: topic.name,
      category: topic.category,
      priority: topic.priority,
      evidenceGrade: topic.evidenceGrade,
      papers: topic.papers.length,
      expectedDuration: estimateTopicTime(topic)
    }))
  };

  // Generate artifact with plan
  await createArtifact({
    type: "research-plan",
    title: `Research Plan: ${plan.mainTopic}`,
    content: JSON.stringify(plan, null, 2)
  });

  // Show to user
  return presentation;
}
```

---

## Phase 2: RAG-Enhanced Deep Research

### Overview

Execute the research plan generated in Phase 1, using RAG for deep analysis of papers with full text.

### Step-by-Step Execution

#### Step 1: Topic Execution Loop

```typescript
async function executeResearchPlan(
  plan: ResearchPlan,
  options: ResearchOptions
): Promise<ResearchResults> {

  const results = new Map<string, TopicResult>();

  // Execute topics in priority order
  for (const topic of plan.topics) {

    console.log(`\n=== Researching: ${topic.name} ===`);
    console.log(`Category: ${topic.category}`);
    console.log(`Evidence grade: ${topic.evidenceGrade}`);
    console.log(`Papers: ${topic.papers.length}`);

    // Step 1: Fetch and index papers
    const indexedPapers = await indexTopicPapers(topic, options);

    // Step 2: Research with RAG-enhanced sequential thinking
    const findings = await researchTopicWithRAG(
      topic,
      indexedPapers,
      plan,
      options
    );

    // Step 3: Extract new edges discovered
    const newEdges = await extractNewEdges(findings);

    // Step 4: Identify subtopics
    const subtopics = await identifySubtopics(findings, plan);

    // Step 5: Store results
    results.set(topic.id, {
      topic,
      findings,
      newEdges,
      subtopics,
      indexedPapers
    });

    // Step 6: Update knowledge graph with new edges
    await updateKnowledgeGraph(newEdges);

    // Step 7: Add subtopics to plan if found
    if (subtopics.length > 0 && options.followSubtopics) {
      plan.topics.push(...subtopics);
    }

    // Progress update
    const progress = (results.size / plan.topics.length) * 100;
    console.log(`Progress: ${progress.toFixed(1)}%`);
  }

  return { plan, results };
}
```

#### Step 2: Paper Indexing for RAG

```typescript
async function indexTopicPapers(
  topic: ResearchTopic,
  options: ResearchOptions
): Promise<IndexedPaper[]> {

  const indexed: IndexedPaper[] = [];

  // Prioritize papers with edges (likely have mechanistic details)
  const papersWithEdges = topic.edges > 0 ?
    topic.papers.slice(0, topic.edges) : [];
  const otherPapers = topic.edges > 0 ?
    topic.papers.slice(topic.edges) : topic.papers;

  // Index papers with edges first (priority)
  for (const pmid of papersWithEdges) {

    // Check if already indexed
    if (await ragService.isPaperIndexed(pmid)) {
      console.log(`  ✓ ${pmid} already indexed`);
      indexed.push({ pmid, status: 'cached', hasEdge: true });
      continue;
    }

    // Try to fetch full text from PubMed Central
    const fullText = await fetchFullTextFromPMC(pmid);

    if (fullText) {
      // Index in RAG
      await ragService.indexPaper(
        pmid,
        fullText.title,
        fullText.abstract,
        fullText.fullText,
        {
          ...fullText.metadata,
          topic: topic.id,
          hasEdge: true,
          evidenceGrade: topic.evidenceGrade
        }
      );

      indexed.push({ pmid, status: 'indexed', hasEdge: true });
      console.log(`  ✓ ${pmid} indexed (full text)`);

    } else {
      // No full text available
      indexed.push({ pmid, status: 'abstract_only', hasEdge: true });
      console.log(`  ⚠ ${pmid} abstract only`);
    }
  }

  // Index other papers (sample if too many)
  const sampleSize = Math.min(otherPapers.length, 20);
  for (const pmid of otherPapers.slice(0, sampleSize)) {
    // Same process but hasEdge: false
    // ... indexing logic
  }

  console.log(`\nIndexing summary:`);
  console.log(`  - Full text: ${indexed.filter(p => p.status === 'indexed').length}`);
  console.log(`  - Abstract only: ${indexed.filter(p => p.status === 'abstract_only').length}`);
  console.log(`  - Cached: ${indexed.filter(p => p.status === 'cached').length}`);

  return indexed;
}
```

#### Step 3: RAG-Enhanced Sequential Thinking

```typescript
async function researchTopicWithRAG(
  topic: ResearchTopic,
  indexedPapers: IndexedPaper[],
  plan: ResearchPlan,
  options: ResearchOptions
): Promise<TopicFindings> {

  // Build topic-specific prompt with graph context
  const prompt = buildTopicPrompt(topic, plan);

  // Execute sequential thinking with RAG
  const result = await chatService.executeSequentialThinking(
    prompt,
    [], // Fresh context per topic
    await getAllTools(),
    options.modelProvider || 'anthropic',
    {
      maxThinkingSteps: 15,  // More steps for complex topics
      temperature: 0.2,      // Lower for focused research
      ragEnabled: true,      // Enable RAG retrieval
      ragContext: {
        topic: topic.id,
        evidenceGrade: topic.evidenceGrade,
        maxChunks: 10        // Max RAG chunks per query
      },
      statusHandler: (status) => console.log(`  ${status}`)
    }
  );

  return parseTopicFindings(result);
}

function buildTopicPrompt(
  topic: ResearchTopic,
  plan: ResearchPlan
): string {

  const basePrompt = `
# Research Topic: ${topic.name}

## Context from Knowledge Graph Analysis

**Topic Category:** ${topic.category}
**Evidence Grade:** ${topic.evidenceGrade}
**Main Entity:** ${plan.mainEntity.label}
**Related Entities:** ${topic.entities.map(e => e.label).join(', ')}
`;

  // Category-specific instructions
  let instructions = '';

  switch (topic.category) {

    case 'WELL_ESTABLISHED':
      instructions = `
## Research Approach: COMPREHENSIVE SYNTHESIS

This topic has **${topic.edges} papers with documented relationships**.
These papers likely contain primary mechanistic data.

**Your tasks:**
1. Extract detailed molecular mechanism
2. Identify key experimental evidence
3. Map pathway components and interactions
4. Note any controversies or contradictions
5. Synthesize into coherent mechanism

**Focus on:**
- Methods sections for experimental details
- Results sections for quantitative data
- Discussion sections for interpretation
- Figures and tables for pathway diagrams

**Expected outcome:**
${topic.expectedOutcome}
`;
      break;

    case 'THERAPEUTIC':
      instructions = `
## Research Approach: CLINICAL + MECHANISTIC

This topic involves a therapeutic agent with documented mechanism.

**Your tasks:**
1. Mechanism of action (molecular target, pathway)
2. Clinical efficacy (outcomes, trials)
3. Dosing and pharmacokinetics
4. Safety profile (adverse events, contraindications)
5. Patient selection criteria

**Focus on:**
- Clinical trial results sections
- Pharmacology/mechanism sections
- Safety monitoring recommendations
- Subgroup analyses for personalization

**Expected outcome:**
${topic.expectedOutcome}
`;
      break;

    case 'GAP_EXPLORATION':
      instructions = `
## Research Approach: HYPOTHESIS GENERATION

**Gap identified:**
- ${topic.entities[0].label} and ${topic.entities[1].label} appear together in ${topic.coOccurrence} papers
- BUT no papers document a direct relationship
- This suggests either:
  a) They're mentioned in same context but don't interact
  b) Relationship exists but not explicitly described
  c) Indirect relationship through other entities

**Your tasks:**
1. Determine WHY they co-occur (same disease? same pathway? same papers?)
2. Look for indirect evidence of interaction
3. Check if they're in the same biological pathway
4. Examine temporal patterns (do newer papers suggest a link?)
5. If no relationship: explain the co-occurrence pattern
6. If potential relationship: generate testable hypotheses

**Use RAG to search for:**
- Paragraphs mentioning both entities
- Pathway diagrams that might include both
- Discussion sections speculating about connections

**Expected outcome:**
${topic.expectedOutcome}
`;
      break;

    case 'EMERGING':
      instructions = `
## Research Approach: TREND ANALYSIS

**Emerging area identified:**
- Only ${topic.edges} paper(s) document this relationship
- But ${topic.papers.length} papers mention these entities together

**Your tasks:**
1. Analyze the papers with documented edges carefully
2. Determine if this is:
   - New discovery (recent papers, growing interest)
   - Preliminary finding (needs replication)
   - Niche topic (specific context only)
3. Check publication timeline (is interest growing?)
4. Evaluate strength of evidence
5. Recommend: pursue further OR wait for more evidence

**Expected outcome:**
${topic.expectedOutcome}
`;
      break;

    case 'RARE_ENTITY_EXPLORATION':
      instructions = `
## Research Approach: COMPREHENSIVE KNOWLEDGE BUILDING

**Rare entity mode activated:**
The main entity (${plan.mainEntity.label}) appears in only ${plan.metadata.totalPapers} papers.
Therefore, we explore ALL connections to build foundational knowledge.

**Your tasks:**
1. Extract all available information about the connection
2. Even weak associations are valuable when data is scarce
3. Look for:
   - Co-expression data
   - Protein-protein interaction predictions
   - Pathway annotations
   - Functional similarities
4. Build hypotheses even from limited data
5. Identify which related entity is best studied (for context)

**Expected outcome:**
${topic.expectedOutcome}
`;
      break;

    case 'CONTEXT_BUILDING':
      instructions = `
## Research Approach: CONTEXTUAL LEARNING

**Strategy:**
The main entity (${plan.mainEntity.label}) is rare, but it's related to ${topic.entities[0].label}
which is well-studied (${topic.entities[0].properties.papers} papers).

**Your tasks:**
1. Learn about ${topic.entities[0].label} mechanisms
2. Focus on aspects relevant to ${plan.mainEntity.label}:
   - Same pathway?
   - Similar function?
   - Same disease context?
3. Infer potential ${plan.mainEntity.label} functions by analogy
4. Identify which ${topic.entities[0].label} findings might apply

**Sample strategy:**
- Don't read all ${topic.entities[0].properties.papers} papers
- Focus on reviews and highly-cited mechanism papers
- Extract general principles applicable to ${plan.mainEntity.label}

**Expected outcome:**
${topic.expectedOutcome}
`;
      break;
  }

  // Add paper list
  const paperList = `
## Papers Available (${indexedPapers.length} total)

**Priority papers (documented relationships):**
${indexedPapers.filter(p => p.hasEdge).map(p =>
  `- PMID:${p.pmid} ${p.status === 'indexed' ? '(full text available)' : '(abstract only)'}`
).join('\n')}

**Additional papers:**
${indexedPapers.filter(p => !p.hasEdge).slice(0, 5).map(p =>
  `- PMID:${p.pmid} ${p.status === 'indexed' ? '(full text available)' : '(abstract only)'}`
).join('\n')}
${indexedPapers.filter(p => !p.hasEdge).length > 5 ? `... and ${indexedPapers.filter(p => !p.hasEdge).length - 5} more` : ''}
`;

  // Add RAG usage instructions
  const ragInstructions = `
## How to Use RAG (Retrieval-Augmented Generation)

When you need specific information:
1. Ask a focused question (e.g., "What is the binding site for X on Y?")
2. RAG will search indexed papers semantically
3. You'll receive relevant paragraphs with citations
4. Use these to write detailed, evidence-backed answers

**Example:**
You ask: "What is the mechanism of BRCA1 in DNA repair?"
RAG returns: Paragraph from PMID:12345 Methods section describing the mechanism
You write: "BRCA1 promotes homologous recombination by recruiting RAD51 to
           double-strand breaks (PMID:12345, Methods, p.445)..."

**RAG automatically provides:**
- Specific sections (Methods, Results, Discussion)
- Page numbers when available
- Exact quotes for accuracy
`;

  return basePrompt + instructions + paperList + ragInstructions;
}
```

#### Step 4: RAG Retrieval During Research

```typescript
// This happens automatically during sequential thinking
// when ragEnabled: true

async function enhancePromptWithRAG(
  userMessage: string,
  ragContext: RAGContext
): Promise<string> {

  // Check if this is a question that would benefit from RAG
  if (!isRAGQuery(userMessage)) {
    return userMessage;
  }

  // Semantic search in indexed papers
  const relevantChunks = await ragService.search(
    userMessage,
    {
      limit: ragContext.maxChunks,
      minSimilarity: 0.7,
      filters: {
        topic: ragContext.topic,
        evidenceGrade: ragContext.evidenceGrade
      }
    }
  );

  if (relevantChunks.length === 0) {
    return userMessage;
  }

  // Build RAG context
  let ragContextStr = '\n\n## Relevant Evidence from Indexed Papers\n\n';

  for (const chunk of relevantChunks) {
    ragContextStr += `### ${chunk.metadata.title} (PMID:${chunk.metadata.pmid})\n`;
    ragContextStr += `**Section:** ${chunk.section}\n`;
    ragContextStr += `**Relevance:** ${(chunk.similarity * 100).toFixed(1)}%\n\n`;
    ragContextStr += `${chunk.content}\n\n`;
    ragContextStr += `---\n\n`;
  }

  // Inject into prompt
  return `${userMessage}\n${ragContextStr}`;
}

function isRAGQuery(message: string): boolean {
  // Simple heuristic: questions or requests for specific info
  const questionWords = ['what', 'how', 'why', 'when', 'where', 'which'];
  const requestWords = ['explain', 'describe', 'find', 'identify', 'determine'];

  const lower = message.toLowerCase();
  return questionWords.some(w => lower.includes(w)) ||
         requestWords.some(w => lower.includes(w));
}
```

#### Step 5: Extract New Edges from Full Text

```typescript
async function extractNewEdges(findings: TopicFindings): Promise<Edge[]> {

  const newEdges: Edge[] = [];

  // Parse findings for relationship descriptions
  // that weren't in PubTator abstract extraction

  // Example: LLM discovers in full text:
  // "BRCA1 phosphorylates CtIP at serine 327 (Figure 4A)"

  // This is a new edge not in the original graph
  newEdges.push({
    source: "Gene:672",      // BRCA1
    target: "Gene:11200",    // CtIP
    type: "phosphorylates",
    properties: {
      papers: ["PMID:12345"],
      paperCount: 1,
      confidence: 0.85,
      evidenceGrade: "EMERGING",
      discoveredIn: "full_text",
      section: "results",
      specificEvidence: "Western blot showing phospho-CtIP S327"
    }
  });

  return newEdges;
}
```

#### Step 6: Update Knowledge Graph

```typescript
async function updateKnowledgeGraph(newEdges: Edge[]): Promise<void> {

  for (const edge of newEdges) {

    // Check if edge already exists
    const existing = await graphDB.findEdge(edge.source, edge.target, edge.type);

    if (existing) {
      // Merge: add papers, increase count
      await graphDB.updateEdge(existing.id, {
        papers: [...existing.properties.papers, ...edge.properties.papers],
        paperCount: existing.properties.paperCount + edge.properties.paperCount
      });
      console.log(`  Updated edge: ${edge.source} --${edge.type}--> ${edge.target}`);

    } else {
      // Create new edge
      await graphDB.createEdge(edge);
      console.log(`  New edge discovered: ${edge.source} --${edge.type}--> ${edge.target}`);
    }
  }

  console.log(`\nKnowledge graph updated with ${newEdges.length} new/updated edges`);
}
```

---

## Phase 3: Evidence-Graded Synthesis

### Overview

Synthesize all findings into a comprehensive report, with evidence grading based on graph topology.

### Report Structure

```typescript
interface ResearchReport {
  // Executive summary
  summary: {
    mainTopic: string;
    totalPapers: number;
    entitiesAnalyzed: number;
    relationshipsFound: number;
    keyFindings: string[];
  };

  // Section 1: Research landscape
  landscape: {
    visualization: KnowledgeGraph;
    metrics: GraphMetrics;
    overview: string;
  };

  // Section 2: Well-established mechanisms
  establishedFindings: Array<{
    topic: string;
    evidenceGrade: "STRONG";
    paperCount: number;
    mechanism: string;
    keyPapers: string[];
    citations: Citation[];
  }>;

  // Section 3: Emerging areas
  emergingFindings: Array<{
    topic: string;
    evidenceGrade: "MODERATE" | "EMERGING";
    paperCount: number;
    findings: string;
    trendAnalysis: string;
  }>;

  // Section 4: Hypotheses from gaps
  hypotheses: Array<{
    topic: string;
    evidenceGrade: "INDIRECT" | "HYPOTHESIS";
    coOccurrence: number;
    rationale: string;
    proposedMechanism: string;
    testableHypotheses: string[];
  }>;

  // Section 5: Knowledge gaps
  gaps: Array<{
    description: string;
    priority: "HIGH" | "MEDIUM" | "LOW";
    rationale: string;
  }>;

  // Section 6: Updated knowledge graph
  updatedGraph: {
    before: KnowledgeGraph;
    after: KnowledgeGraph;
    newEdges: Edge[];
    resolvedGaps: Gap[];
  };

  // Section 7: Missing papers
  missingPapers: Array<{
    pmid: string;
    title: string;
    priority: "HIGH" | "MEDIUM" | "LOW";
    reason: string;
  }>;

  // Section 8: Recommendations
  recommendations: {
    experimental: string[];
    clinical: string[];
    futureResearch: string[];
  };
}
```

### Example Report Generation

```typescript
async function generateResearchReport(
  plan: ResearchPlan,
  results: Map<string, TopicResult>
): Promise<ResearchReport> {

  // Organize findings by evidence grade
  const strongFindings = [];
  const moderateFindings = [];
  const emergingFindings = [];
  const hypotheses = [];

  for (const [topicId, result] of results) {
    const grade = result.topic.evidenceGrade;

    if (grade === "STRONG") {
      strongFindings.push(result);
    } else if (grade === "MODERATE") {
      moderateFindings.push(result);
    } else if (grade === "EMERGING") {
      emergingFindings.push(result);
    } else if (grade === "INDIRECT" || grade === "HYPOTHESIS") {
      hypotheses.push(result);
    }
  }

  // Build report using formatter tool
  const prompt = `
Generate a comprehensive research report with the following structure:

# ${plan.mainTopic} - Comprehensive Research Report

## Executive Summary
[Synthesize key findings across all evidence grades]

## 1. Research Landscape
[Include knowledge graph visualization]
- ${plan.metadata.totalPapers} papers analyzed
- ${plan.metadata.entitiesFound} unique entities
- ${plan.metadata.edgesFound} documented relationships

## 2. Well-Established Mechanisms (STRONG Evidence)
${strongFindings.map(f => `
### ${f.topic.name}
**Evidence Grade:** STRONG (${f.topic.edges} papers with edges)
${f.findings.mechanism}

**Key Evidence:**
${f.findings.keyEvidence.map(e => `- ${e}`).join('\n')}

**Citations:** ${f.findings.citations.map(c => `PMID:${c.pmid}`).join(', ')}
`).join('\n')}

## 3. Emerging Areas (MODERATE/EMERGING Evidence)
${[...moderateFindings, ...emergingFindings].map(f => `
### ${f.topic.name}
**Evidence Grade:** ${f.topic.evidenceGrade} (${f.topic.edges} papers)
${f.findings.summary}
`).join('\n')}

## 4. Hypotheses from Graph Analysis (INDIRECT/HYPOTHESIS)
${hypotheses.map(h => `
### ${h.topic.name}
**Evidence Grade:** ${h.topic.evidenceGrade}
**Co-occurrence:** ${h.topic.coOccurrence} papers

**Gap Analysis:**
${h.findings.gapAnalysis}

**Proposed Mechanism:**
${h.findings.proposedMechanism}

**Testable Hypotheses:**
${h.findings.hypotheses.map(hyp => `- ${hyp}`).join('\n')}

**Recommendation:** ${h.findings.recommendation}
`).join('\n')}

## 5. Knowledge Gaps Identified
[List gaps requiring additional research]

## 6. Updated Knowledge Graph
[Show before/after with new edges highlighted]

## 7. Papers Requiring Full Text
**HIGH PRIORITY (contain documented relationships):**
${getMissingHighPriority(results).map(p => `- PMID:${p.pmid}: ${p.reason}`).join('\n')}

**MEDIUM PRIORITY (gap exploration):**
${getMissingMediumPriority(results).map(p => `- PMID:${p.pmid}: ${p.reason}`).join('\n')}

## 8. Recommendations
**Experimental validation:**
${getExperimentalRecommendations(results).map(r => `- ${r}`).join('\n')}

**Clinical applications:**
${getClinicalRecommendations(results).map(r => `- ${r}`).join('\n')}

**Future research directions:**
${getFutureResearchDirections(results).map(r => `- ${r}`).join('\n')}
`;

  const report = await chatService.processWithFormatter(prompt);

  // Create artifacts
  await createArtifact({
    type: "research-report",
    title: `Research Report: ${plan.mainTopic}`,
    content: report.content
  });

  await createArtifact({
    type: "knowledge-graph",
    title: `Knowledge Graph: ${plan.mainTopic}`,
    content: JSON.stringify(buildUpdatedGraph(results), null, 2)
  });

  return report;
}
```

---

## Entity-Driven Planning Strategies

### Strategy Matrix

| Entity Profile | Papers | Edges | Strategy | Approach |
|----------------|--------|-------|----------|----------|
| **Well-Studied Hub** | >500 | >50 | Evidence-Prioritized | Focus on strong edges, sample broadly |
| **Established** | 200-500 | 20-50 | Comprehensive | Cover all edges, explore major gaps |
| **Moderate** | 50-200 | 5-20 | Balanced | All edges + high co-occurrence gaps |
| **Emerging** | 20-50 | 1-5 | Exploratory | All papers, follow all connections |
| **Rare** | <20 | Any | Comprehensive Exploration | Every paper, every connection, context building |

### Rare Entity Special Mode

When main entity has <50 papers:

```typescript
interface RareEntityStrategy {
  exploreAllCoOccurrences: true;      // Don't filter by edge count
  minimumCoOccurrence: 1;             // Even single mentions worth exploring
  expandToRelatedHubs: true;          // Learn about well-studied related entities
  buildContextFromAnalogy: true;      // Infer functions from similar entities
  prioritizeAnyEvidence: true;        // All evidence valuable when scarce
  generateHypotheses: true;           // More speculation acceptable
}

// Example execution:
// Main entity: OBSCURE_GENE_X (12 papers total)
//
// Standard mode would skip entities with <5 co-occurrences
// Rare mode explores ALL:
//   - Gene_A (8 co-occur, 0 edges) → EXPLORE
//   - Gene_B (3 co-occur, 0 edges) → EXPLORE
//   - Process_Y (2 co-occur, 1 edge) → PRIORITY EXPLORE
//   - Even single mentions investigated
//
// Also expands to related hubs:
//   - Gene_A has 500 papers → Sample Gene_A literature
//   - Learn Gene_A mechanisms → Infer OBSCURE_GENE_X by analogy
```

### Gap Classification

```typescript
type GapType =
  | "HIGH_POTENTIAL"      // >100 co-occur, 0 edges - likely relationship
  | "EXPLORATORY"         // 10-100 co-occur, 0 edges - worth investigating
  | "COINCIDENTAL"        // <10 co-occur, 0 edges - probably unrelated
  | "INDIRECT"            // Co-occur, indirect path exists in graph
  | "EMERGING"            // 1-2 edges, growing interest
  | "CONTEXT_DEPENDENT";  // Related in specific conditions only

function classifyGap(gap: Gap, graph: KnowledgeGraph): GapType {

  if (gap.coOccurrence > 100 && gap.edges === 0) {
    // Very frequent co-mention without documented relationship
    // High probability of real connection
    return "HIGH_POTENTIAL";
  }

  if (gap.coOccurrence >= 10 && gap.edges === 0) {
    // Moderate co-mention
    // Worth exploring
    return "EXPLORATORY";
  }

  if (gap.edges >= 1 && gap.edges <= 2) {
    // Minimal evidence
    // Could be emerging area or preliminary finding
    return "EMERGING";
  }

  // Check for indirect path
  const hasIndirectPath = findPath(
    graph,
    gap.entity1,
    gap.entity2,
    { maxHops: 3 }
  );

  if (hasIndirectPath) {
    return "INDIRECT";
  }

  if (gap.coOccurrence < 10) {
    // Rare co-mention, no edges, no indirect path
    // Likely coincidental
    return "COINCIDENTAL";
  }

  return "CONTEXT_DEPENDENT";  // Default
}
```

---

## RAG Integration Deep Dive

### What RAG Adds vs. Knowledge Graph

| Aspect | Knowledge Graph (PubTator) | RAG (Full Text) |
|--------|---------------------------|-----------------|
| **Source** | Abstracts (PubTator API) | Full text (PMC + uploads) |
| **Scope** | Entities + relationships | All content (methods, results, etc.) |
| **Search** | Exact entities, edges | Semantic (concept-based) |
| **Evidence** | Relationship exists/not | Specific mechanisms, data |
| **Citations** | Paper-level (PMID) | Section-level (Methods p.445) |
| **Use Case** | Landscape mapping, planning | Deep understanding, evidence |

### When RAG Retrieves

```typescript
// Automatic RAG retrieval during sequential thinking

// LLM asks:
"What is the mechanism of BRCA1 in homologous recombination?"

// RAG activates:
1. Embed question: [0.23, -0.45, 0.12, ..., 0.67]

2. Vector search in indexed papers:
   Query: "mechanism BRCA1 homologous recombination"
   ↓
   Find similar chunks (cosine similarity > 0.7)
   ↓
   Return top 5-10 chunks

3. Retrieved chunks:
   Chunk 1 (similarity: 0.91):
     Paper: PMID:12345
     Section: Methods
     Content: "BRCA1 promotes RAD51 nucleoprotein filament
              formation by direct binding to the RAD51
              C-terminal domain (amino acids 250-339).
              Co-immunoprecipitation confirmed the interaction..."

   Chunk 2 (similarity: 0.87):
     Paper: PMID:67890
     Section: Results
     Content: "Cells depleted of BRCA1 showed 73% reduction
              in RAD51 foci formation at DSB sites (p<0.001,
              Figure 3A). Complementation with wild-type BRCA1
              restored foci to 95% of control levels..."

4. Inject into LLM context:
   """
   Based on these research findings:

   ### PMID:12345 (Methods section, similarity: 91%)
   [Chunk 1 content]

   ### PMID:67890 (Results section, similarity: 87%)
   [Chunk 2 content]

   Answer: What is the mechanism of BRCA1 in homologous recombination?
   """

5. LLM writes with specific citations:
   "BRCA1 promotes homologous recombination by directly binding
   to RAD51 (amino acids 250-339) and facilitating RAD51
   nucleoprotein filament formation at double-strand breaks
   (PMID:12345, Methods section). Depletion studies demonstrate
   that BRCA1 is required for RAD51 foci formation, with 73%
   reduction upon BRCA1 knockdown (PMID:67890, Results, Figure 3A)."
```

### RAG Search Strategies

```typescript
interface RAGSearchStrategy {
  // Query-based (during research)
  semanticQueries: {
    mechanismQueries: string[];     // "How does X work?"
    evidenceQueries: string[];      // "What is the evidence for X?"
    comparativeQueries: string[];   // "How does X differ from Y?"
  };

  // Contextual (topic-aware)
  topicContext: {
    focusEntities: string[];        // Prioritize chunks mentioning these
    evidenceGrade: EvidenceGrade;   // Filter by evidence quality
    sections: string[];             // Prefer certain sections
  };

  // Similarity thresholds
  thresholds: {
    strong: 0.85,                   // High confidence retrieval
    moderate: 0.75,                 // Good match
    exploratory: 0.65              // Broader search
  };
}

// Example: Different strategies for different topic categories

function getRAGStrategy(topic: ResearchTopic): RAGSearchStrategy {

  switch (topic.category) {

    case 'WELL_ESTABLISHED':
      return {
        semanticQueries: [
          "molecular mechanism",
          "biochemical pathway",
          "protein interaction",
          "experimental evidence"
        ],
        topicContext: {
          focusEntities: topic.entities.map(e => e.label),
          evidenceGrade: topic.evidenceGrade,
          sections: ["methods", "results"]  // Primary data
        },
        thresholds: {
          strong: 0.85,
          moderate: 0.80,
          exploratory: 0.75
        }
      };

    case 'THERAPEUTIC':
      return {
        semanticQueries: [
          "mechanism of action",
          "clinical efficacy",
          "dosing",
          "safety",
          "adverse events",
          "pharmacokinetics"
        ],
        topicContext: {
          focusEntities: topic.entities.map(e => e.label),
          evidenceGrade: topic.evidenceGrade,
          sections: ["results", "discussion", "methods"]
        },
        thresholds: {
          strong: 0.85,
          moderate: 0.75,
          exploratory: 0.70
        }
      };

    case 'GAP_EXPLORATION':
      return {
        semanticQueries: [
          `${topic.entities[0].label} ${topic.entities[1].label}`,
          "pathway",
          "interaction",
          "relationship",
          "association"
        ],
        topicContext: {
          focusEntities: topic.entities.map(e => e.label),
          evidenceGrade: topic.evidenceGrade,
          sections: ["introduction", "discussion"]  // Speculation OK
        },
        thresholds: {
          strong: 0.80,
          moderate: 0.70,
          exploratory: 0.60  // Lower threshold for gaps
        }
      };
  }
}
```

### RAG vs. Abstract-Only: Concrete Example

**Research Question:** "What is the optimal dose of gabapentin for diabetic neuropathy?"

**Abstract-Only (without RAG):**
```
LLM has access to:
- Abstract: "Gabapentin was effective for diabetic neuropathy pain..."

Report says:
"Gabapentin is effective for diabetic neuropathy (PMID:12345)."
```

**With RAG (full text):**
```
LLM asks: "What is the optimal dose of gabapentin?"

RAG retrieves:
  Chunk from PMID:12345 (Methods section):
  "Patients were randomized to gabapentin 900mg/day (n=120),
   1800mg/day (n=122), 2400mg/day (n=118), or placebo (n=121).
   Doses were titrated over 4 weeks..."

  Chunk from PMID:12345 (Results section):
  "Pain reduction from baseline: 900mg: -1.2 points, 1800mg:
   -2.9 points, 2400mg: -3.1 points, placebo: -0.6 points.
   The 1800mg and 2400mg groups showed significant benefit
   (p<0.001) with no difference between them (p=0.67)."

  Chunk from PMID:12345 (Discussion section):
  "Based on the dose-response curve plateau at 1800mg and
   the 15% higher discontinuation rate at 2400mg due to
   dizziness, we recommend 1800mg/day as the optimal dose."

Report says:
"The optimal dose of gabapentin for diabetic neuropathy is
1800mg/day, based on a dose-response study showing maximal
efficacy at this dose (-2.9 point pain reduction) with no
additional benefit at 2400mg (p=0.67) but higher discontinuation
rates due to dizziness (PMID:12345, Methods and Results sections,
Figure 2)."
```

**Difference:**
- Abstract-only: "Effective" (vague)
- RAG: "1800mg/day optimal, based on dose-response curve and tolerability" (actionable)

---

## Implementation Roadmap

### Phase 1: Minimal Proof of Concept (Week 1)

**Goal:** Validate entity-driven planning concept

**Tasks:**
- [ ] Increase `MAX_THINKING_STEPS` to 25 in `chat/index.ts:1198`
- [ ] Create `researchModeSystemPrompt.ts` with graph-aware instructions
- [ ] Add `researchMode` flag to ChatOptions
- [ ] Test with one example: "Research BRCA1 mutations"
  - Extract entities with `addNodesFromPMIDs`
  - Build simple graph structure
  - Generate basic research plan
  - Execute sequential thinking
  - Measure: topics covered, papers analyzed, quality

**Success Criteria:**
- ✅ Can extract 50+ entities from 100 papers
- ✅ Can identify edges vs co-occurrences
- ✅ Can generate prioritized topic list
- ✅ Can complete research within 2 hours

**Files Modified:**
- `backend-mcp-client/src/services/chat/index.ts`
- `backend-mcp-client/src/services/chat/researchModeSystemPrompt.ts` (new)

**Effort:** 1-2 days

---

### Phase 2: Research Orchestration (Weeks 2-4)

**Goal:** Add persistence and structured planning

**Tasks:**

**Week 2: Database Schema**
- [ ] Design research session schema
  ```sql
  ResearchSession
  ResearchTopic (with parentTopicId for hierarchy)
  ResearchPaper
  EntityNode
  EntityEdge
  CoOccurrence
  ```
- [ ] Create Prisma migrations
- [ ] Implement basic CRUD operations
- [ ] Test with example data

**Week 3: Orchestrator Service**
- [ ] Create `src/services/researchOrchestrator.ts`
  - `createSession()`
  - `getNextTopic()`
  - `addPapers()`
  - `addSubtopics()`
  - `completeTopic()`
  - `getProgress()`
- [ ] Implement graph topology analysis
  - Node degree calculation
  - Edge strength metrics
  - Cluster detection
  - Gap identification
- [ ] Create research plan generator
  - Evidence-based prioritization
  - Category assignment
  - Rare entity detection

**Week 4: Workflow Integration**
- [ ] Create `src/services/researchWorkflow.ts`
- [ ] Integrate with sequential thinking
- [ ] Add progress tracking
- [ ] Create API endpoints:
  - `POST /api/research/start`
  - `GET /api/research/:sessionId/progress`
  - `GET /api/research/:sessionId/report`

**Success Criteria:**
- ✅ Research sessions persist across page reloads
- ✅ Can handle 200+ papers with topic hierarchy
- ✅ Graph analysis correctly identifies hubs, gaps, clusters
- ✅ Can pause and resume research

**Files Created:**
- `prisma/schema.prisma` (updated)
- `src/services/researchOrchestrator.ts`
- `src/services/researchWorkflow.ts`
- `src/routes/research.ts`
- `src/services/graphAnalysis.ts`

**Effort:** 2-3 weeks

---

### Phase 3: RAG Infrastructure (Weeks 5-7)

**Goal:** Add semantic search and full-text analysis

**Tasks:**

**Week 5: Infrastructure Setup**
- [ ] Migrate from SQLite to PostgreSQL
  - Set up PostgreSQL locally
  - Install pgvector extension
  - Migrate existing data
  - Test performance
- [ ] Set up OpenAI API for embeddings
  - Configure API key
  - Test embedding generation
  - Benchmark cost per 1000 papers

**Week 6: RAG Service Implementation**
- [ ] Create `src/services/embedding.ts`
  - `embedText()`
  - `embedBatch()`
  - `chunkText()`
- [ ] Create `src/services/rag.ts`
  - `indexPaper()`
  - `search()`
  - `buildContext()`
  - `findSimilarPapers()`
- [ ] Update Prisma schema with vector types
- [ ] Implement paper chunking strategy
  - Detect sections (intro, methods, results, discussion)
  - Chunk by paragraph (~500 tokens)
  - Store with metadata

**Week 7: Integration with Research Workflow**
- [ ] Modify sequential thinking to inject RAG context
- [ ] Create `enhancePromptWithRAG()` function
- [ ] Add automatic paper indexing after search
- [ ] Test retrieval quality
  - Precision: Are retrieved chunks relevant?
  - Recall: Are all relevant chunks found?
  - Citation accuracy: Correct sections cited?

**Success Criteria:**
- ✅ Can index 100 papers in <10 minutes
- ✅ Semantic search returns relevant chunks (>80% precision)
- ✅ LLM citations include section and page numbers
- ✅ RAG-enhanced reports have 3x more specific evidence

**Files Created:**
- `src/services/embedding.ts`
- `src/services/rag.ts`
- `src/services/paperIndexer.ts`
- Database migration scripts

**Infrastructure:**
- PostgreSQL with pgvector
- OpenAI API account

**Effort:** 3-4 weeks

---

### Phase 4: PubMed Central Integration (Week 8)

**Goal:** Fetch full-text papers automatically

**Tasks:**
- [ ] Create `custom-mcp-servers/pubmed-central-mcp/`
- [ ] Implement tools:
  - `fetch_full_text(pmcid)` - Get full text XML
  - `parse_sections(xml)` - Extract structured sections
  - `check_availability(pmid)` - See if full text available
- [ ] XML parsing for PMC format
- [ ] Rate limiting (NCBI requirements)
- [ ] Automatic fallback to abstract if full text unavailable

**Success Criteria:**
- ✅ Can fetch full text for 70%+ of recent papers
- ✅ Correctly parses sections from XML
- ✅ Respects NCBI rate limits (no blocking)

**Files Created:**
- `custom-mcp-servers/pubmed-central-mcp/src/index.ts`
- `custom-mcp-servers/pubmed-central-mcp/src/parser.ts`

**Effort:** 1 week

---

### Phase 5: Frontend & Visualization (Weeks 9-10)

**Goal:** User interface for research system

**Tasks:**

**Week 9: Research Session UI**
- [ ] Create `ResearchSessionView.tsx`
  - Start research form
  - Progress display
  - Topic list with status
  - Pause/resume controls
- [ ] Create `ResearchPlanView.tsx`
  - Display generated plan
  - Show knowledge graph visualization
  - Evidence grade indicators
  - Modify/approve plan UI

**Week 10: Report & Graph Visualization**
- [ ] Create `ResearchReportView.tsx`
  - Structured report display
  - Evidence-graded sections
  - Citation links
  - Missing papers list
- [ ] Enhance knowledge graph visualization
  - Highlight edges by strength
  - Show gaps in different color
  - Interactive: click entity to see papers
  - Before/after comparison

**Success Criteria:**
- ✅ User can start research session from chat
- ✅ Real-time progress updates
- ✅ Interactive knowledge graph
- ✅ Report is readable and well-organized

**Files Created:**
- `frontend-client/src/components/research/ResearchSessionView.tsx`
- `frontend-client/src/components/research/ResearchPlanView.tsx`
- `frontend-client/src/components/research/ResearchReportView.tsx`
- `frontend-client/src/components/research/KnowledgeGraphViz.tsx`

**Effort:** 2 weeks

---

### Phase 6: Refinement & Optimization (Weeks 11-12)

**Goal:** Polish and optimize

**Tasks:**
- [ ] Optimize RAG retrieval performance
  - Index optimization
  - Query optimization
  - Caching strategy
- [ ] Improve evidence grading algorithm
  - Incorporate citation counts
  - Consider publication date
  - Weight by journal impact factor
- [ ] Add more sophisticated gap classification
- [ ] Implement paper upload functionality
  - PDF parsing
  - Automatic indexing
  - Integration with research session
- [ ] Add cost tracking and estimation
- [ ] Write comprehensive documentation
- [ ] Create example research sessions

**Success Criteria:**
- ✅ End-to-end research session completes successfully
- ✅ Reports are high quality (user feedback)
- ✅ System handles edge cases gracefully
- ✅ Documentation complete

**Effort:** 2 weeks

---

## Code Architecture

### Directory Structure (After Full Implementation)

```
backend-mcp-client/
├── src/
│   ├── services/
│   │   ├── chat/
│   │   │   ├── index.ts                    # Sequential thinking (modified)
│   │   │   ├── researchModeSystemPrompt.ts # Graph-aware prompts (new)
│   │   │   ├── adapters/                   # Provider adapters (existing)
│   │   │   └── formatters/                 # Response formatters (existing)
│   │   ├── research/                       # NEW: Research orchestration
│   │   │   ├── orchestrator.ts             # Research session management
│   │   │   ├── workflow.ts                 # Workflow execution
│   │   │   ├── graphAnalysis.ts            # Topology analysis
│   │   │   └── planGenerator.ts            # Research plan generation
│   │   ├── rag/                            # NEW: RAG system
│   │   │   ├── embedding.ts                # Embedding service
│   │   │   ├── rag.ts                      # RAG retrieval
│   │   │   ├── paperIndexer.ts             # Automatic indexing
│   │   │   └── chunking.ts                 # Text chunking strategies
│   │   ├── mcp.ts                          # MCP client (existing)
│   │   ├── llm/                            # LLM providers (existing)
│   │   └── database.ts                     # Prisma client (existing)
│   ├── routes/
│   │   ├── research.ts                     # NEW: Research API endpoints
│   │   ├── chat.ts                         # Existing chat routes
│   │   └── ...
│   └── types/
│       ├── research.ts                     # NEW: Research types
│       └── ...
├── prisma/
│   ├── schema.prisma                       # Updated with research models
│   └── migrations/
└── config/
    └── mcp_server_config.json              # Updated with PMC server

custom-mcp-servers/
├── graphmodePubTatorMCP/                   # Existing: Entity extraction
├── pubmed-central-mcp/                     # NEW: Full text fetching
│   ├── src/
│   │   ├── index.ts
│   │   ├── parser.ts                       # XML parsing
│   │   └── fetcher.ts                      # PMC API client
│   └── package.json
└── ...

frontend-client/
├── src/
│   ├── components/
│   │   ├── research/                       # NEW: Research UI
│   │   │   ├── ResearchSessionView.tsx
│   │   │   ├── ResearchPlanView.tsx
│   │   │   ├── ResearchReportView.tsx
│   │   │   ├── KnowledgeGraphViz.tsx
│   │   │   └── TopicProgressList.tsx
│   │   ├── chat/                           # Existing chat components
│   │   └── artifacts/                      # Existing artifact viewers
│   └── store/
│       ├── researchStore.ts                # NEW: Research state
│       └── ...
```

### Key Type Definitions

```typescript
// types/research.ts

interface ResearchSession {
  id: string;
  conversationId: string;
  mainTopic: string;
  status: 'planning' | 'active' | 'paused' | 'completed';
  createdAt: Date;
  updatedAt: Date;
}

interface ResearchTopic {
  id: string;
  sessionId: string;
  parentTopicId?: string;
  name: string;
  category: TopicCategory;
  status: 'pending' | 'in-progress' | 'completed' | 'skipped';
  priority: number;
  evidenceGrade: EvidenceGrade;
  entities: Entity[];
  edges: number;
  coOccurrence?: number;
  papers: string[];
  findings?: string;
}

interface ResearchPaper {
  id: string;
  sessionId: string;
  pmid: string;
  pmcid?: string;
  title: string;
  abstract?: string;
  fullText?: string;
  authors: any;
  publicationDate?: string;
  journal?: string;
  doi?: string;
  citationCount?: number;
  status: 'found' | 'indexed' | 'abstract-only' | 'full-text-needed';
  relevanceScore?: number;
}

interface KnowledgeGraph {
  nodes: EntityNode[];
  edges: EntityEdge[];
  coOccurrences: CoOccurrence[];
}

interface EntityNode {
  id: string;              // e.g., "Gene:672"
  label: string;           // e.g., "BRCA1"
  type: EntityType;        // gene, disease, chemical, etc.
  properties: {
    papers: number;        // # papers mentioning this entity
    edgeCount: number;     // # documented relationships
    coOccurrences: number; // # other entities it co-occurs with
  };
}

interface EntityEdge {
  id: string;
  source: string;          // Entity ID
  target: string;          // Entity ID
  type: string;            // inhibits, activates, treats, etc.
  properties: {
    papers: string[];      // PMIDs documenting this relationship
    paperCount: number;
    confidence: number;    // PubTator confidence score
    evidenceGrade: EvidenceGrade;
  };
}

interface CoOccurrence {
  entity1: string;
  entity2: string;
  papers: string[];
  paperCount: number;
  hasEdge: boolean;
  edgeCount?: number;
}

type TopicCategory =
  | 'WELL_ESTABLISHED'
  | 'THERAPEUTIC'
  | 'EMERGING'
  | 'GAP_EXPLORATION'
  | 'RARE_ENTITY_EXPLORATION'
  | 'CONTEXT_BUILDING';

type EvidenceGrade =
  | 'STRONG'      // 50+ papers with edges
  | 'MODERATE'    // 10-50 papers with edges
  | 'EMERGING'    // 1-10 papers with edges
  | 'INDIRECT'    // Co-occurrence, indirect path exists
  | 'HYPOTHESIS'; // Gap, needs investigation

type EntityType =
  | 'gene'
  | 'disease'
  | 'chemical'
  | 'species'
  | 'mutation'
  | 'celltype'
  | 'process';

interface GraphMetrics {
  nodeDegree: Map<string, number>;
  nodeHubScore: Map<string, number>;
  edgeStrength: Map<string, number>;
  clusters: Cluster[];
  gaps: Gap[];
  rareEntities: Entity[];
  isRareEntityMode: boolean;
}

interface Cluster {
  id: string;
  nodes: string[];
  theme: string;
  density: number;
}

interface Gap {
  entity1: string;
  entity2: string;
  coOccurrence: number;
  hasEdge: boolean;
  gapType: GapType;
}

type GapType =
  | 'HIGH_POTENTIAL'
  | 'EXPLORATORY'
  | 'COINCIDENTAL'
  | 'INDIRECT'
  | 'EMERGING'
  | 'CONTEXT_DEPENDENT';
```

---

## Example Workflows

### Example 1: Well-Studied Gene (BRCA1)

```
User: "Research BRCA1 mutations in breast cancer"

Phase 1: Landscape Discovery (10 min)
  → Search PubMed: 347 papers
  → Extract entities from 200 papers (sample)
  → Build graph:
    - 127 entities
    - 156 edges
    - 3 clusters identified
  → Generate plan:
    Topic 1: BRCA1 DNA repair mechanism (89 papers, STRONG)
    Topic 2: PARP inhibitors (45 papers, STRONG)
    Topic 3: BRCA1-TP53 interaction (156 co-occur, GAP)
    Topic 4: BRCA1-ATM crosstalk (23 co-occur, 1 edge, EMERGING)
  → Present to user with graph visualization

User: "Start research"

Phase 2: Deep Research (45 min)
  Topic 1 (15 min):
    → Index 32 papers (full text available)
    → RAG retrieves mechanism details
    → Finds: "BRCA1 recruits RAD51 via C-terminal domain..."
    → Comprehensive mechanism documented

  Topic 2 (15 min):
    → Index 18 papers
    → RAG retrieves clinical + mechanism data
    → Finds: Dosing, efficacy, safety profile
    → Clinical guidelines extracted

  Topic 3 (10 min):
    → RAG semantic search for both entities
    → Discovers: Indirect relationship via p53-mediated BRCA1 transcription
    → Classification: INDIRECT, not direct protein interaction

  Topic 4 (5 min):
    → Limited data, emerging area
    → Trend analysis: Recent papers suggest crosstalk
    → Recommendation: Monitor but don't over-interpret

Phase 3: Report Generation (5 min)
  → Synthesize findings with evidence grades
  → Generate knowledge graph showing:
    - Original edges from abstracts
    - New edges from full text (CtIP connection)
    - Gaps resolved (TP53 classified as indirect)
  → List missing papers (23 high priority)
  → Clinical recommendations based on strong evidence

Total: ~60 minutes for comprehensive research
```

### Example 2: Rare Gene (Only 12 Papers)

```
User: "Research OBSCURE_GENE_X"

Phase 1: Landscape Discovery (5 min)
  → Search PubMed: 12 papers (RARE!)
  → Extract entities from all 12 papers
  → Build graph:
    - 23 entities
    - 2 edges (very limited)
    - RARE ENTITY MODE activated
  → Generate plan:
    Topic 1: OBSCURE_GENE_X - Disease_Y (7 co-occur, 1 edge, PRIORITY)
    Topic 2: OBSCURE_GENE_X - Gene_A (8 co-occur, 0 edges, EXPLORE)
    Topic 3: OBSCURE_GENE_X - Gene_B (5 co-occur, 0 edges, EXPLORE)
    Topic 4: Gene_A mechanisms (context building, 500 papers available)
  → Strategy: Explore ALL connections, build context from related entities

Phase 2: Deep Research (90 min)
  Topic 1 (20 min):
    → Only relationship with documented edge
    → Deep analysis of 7 papers
    → Extract everything possible

  Topic 2 (20 min):
    → No edges but frequent co-occurrence
    → RAG searches for any mention of both
    → Finds: Co-expression in same tissue
    → Hypothesis: May be in same pathway

  Topic 3 (15 min):
    → Moderate co-occurrence
    → Limited information
    → Document for future follow-up

  Topic 4 (35 min):
    → Gene_A is well-studied (500 papers)
    → Sample top papers about Gene_A function
    → Infer: Since OBSCURE_GENE_X co-occurs with Gene_A,
             and Gene_A is involved in pathway X,
             OBSCURE_GENE_X might also be in pathway X
    → Build hypotheses by analogy

Phase 3: Report (10 min)
  → Emphasize limited evidence
  → Strong hypotheses based on co-occurrence
  → Context from related genes
  → Clear recommendations for experimental validation
  → All 12 papers marked for potential full-text upload

Total: ~105 minutes, foundational knowledge established
```

### Example 3: Gap Investigation

```
User: "Why do BRCA1 and TP53 appear together so often?"

Phase 1: Landscape Discovery (3 min)
  → Search: "BRCA1 TP53"
  → 156 papers mention both
  → Graph analysis: 0 direct edges!
  → Classification: HIGH_POTENTIAL gap
  → Generate focused plan:
    Topic 1: Analyze co-occurrence pattern
    Topic 2: Search for indirect connections
    Topic 3: Check pathway overlap

Phase 2: Investigation (20 min)
  → RAG semantic search: "BRCA1 TP53 interaction mechanism pathway"
  → Retrieves multiple paragraphs mentioning both
  → Pattern discovered:
    - TP53 transcriptionally regulates BRCA1
    - Both respond to DNA damage
    - Both tumor suppressors in breast cancer
    - Mutations in both increase cancer risk
  → Indirect relationship identified
  → No direct protein-protein interaction found

Phase 3: Report (2 min)
  → Gap Classification: INDIRECT
  → Mechanism: TP53 → BRCA1 transcription
  → Co-occurrence explained: Same cancer type, same pathway
  → New edge added to graph: TP53 --[regulates]--> BRCA1
  → Recommendation: Not a direct therapeutic target

Total: ~25 minutes to resolve specific question
```

---

## Cost and Performance Estimates

### Computational Costs

**Phase 1: Landscape Discovery**
- PubTator API calls: Free
- LLM tokens for planning: ~5K tokens
- Cost: ~$0.05 per session

**Phase 2: RAG Indexing**
- Embedding costs (OpenAI text-embedding-3-small):
  - $0.02 per 1M tokens
  - Average paper: 5,000 tokens
  - 100 papers: 500K tokens = $0.01
- Storage (PostgreSQL):
  - 100 papers ≈ 50MB
  - Negligible cost

**Phase 3: Research Execution**
- LLM costs (Claude Sonnet):
  - Input: ~50K tokens per topic (with RAG context)
  - Output: ~5K tokens per topic
  - 10 topics: 550K tokens
  - Cost: ~$5-10 per research session
- RAG retrieval: Negligible (vector search is fast)

**Total Per Research Session:**
- 100 papers, 10 topics, comprehensive: **$5-15**
- 500 papers, 20 topics, comprehensive: **$20-40**

### Time Estimates

| Phase | 100 Papers | 500 Papers |
|-------|-----------|-----------|
| Landscape Discovery | 10 min | 20 min |
| Paper Indexing | 15 min | 45 min |
| Deep Research | 30 min | 90 min |
| Report Generation | 5 min | 10 min |
| **Total** | **60 min** | **165 min** |

### Performance Optimization

**Parallelization Opportunities:**
1. Entity extraction: Batch 100 PMIDs at a time
2. Paper indexing: 5-10 papers in parallel
3. RAG embedding: Batch embedding API calls
4. Sequential thinking: Currently sequential (future: parallel topics)

**Caching Strategy:**
1. Entity graph: Cache per entity (reuse across sessions)
2. Paper embeddings: Permanent (never re-embed)
3. RAG chunks: Permanent (shared across sessions)
4. LLM responses: Optional (for repeated queries)

**Expected Throughput:**
- Single research session: 1-3 hours
- With parallelization: 30-90 minutes
- Rare entities (<50 papers): 30-60 minutes
- Well-studied entities (500+ papers): 2-4 hours

---

## Conclusion

This comprehensive design plan integrates:

1. **Knowledge Graph Intelligence** - PubTator entity extraction for landscape mapping
2. **Evidence-Based Planning** - Topology analysis to prioritize research topics
3. **RAG-Enhanced Depth** - Semantic search of full text for detailed evidence
4. **Adaptive Strategies** - Special handling for rare vs well-studied entities
5. **Gap Discovery** - Automatic hypothesis generation from co-occurrence patterns
6. **Evidence Grading** - Clear distinction between strong evidence and speculation

The phased implementation allows for:
- Quick validation (Phase 1: 1-2 days)
- Incremental value (Phase 2: production-ready in 3 weeks)
- Full capabilities (Phases 3-6: 12 weeks for complete system)

This system transforms the Charm MCP platform from a conversational assistant into an autonomous research engine capable of conducting literature reviews at professional quality.

---

**Document Version:** 1.0
**Created:** November 8, 2024
**Author:** Claude Code
**Status:** Comprehensive Design Plan - Ready for Implementation
