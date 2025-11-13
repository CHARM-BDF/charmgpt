# Research Mode vs Graph Mode - Architecture Changes

## Key Insight

**Problem with Graph Mode:**
- Graph mode restricts artifacts to graph updates only
- Research needs multiple artifact types: plans, reports, tables, timelines, bibliographies, knowledge graphs, etc.
- Graph mode has special database persistence (one graph per conversation)

**Solution: Research Mode**
- Use standard PubTator MCP (not graph-mode variant)
- Create "research mode" similar to how graph mode exists
- Support multiple artifact types
- Knowledge graphs as one of many artifacts (not the only one)

---

## Architecture Changes

### Change 1: MCP Server Selection

**OLD Plan (Graph Mode):**
```
Use: graphmodePubTatorMCP
  - Has databaseContext injection
  - Tools receive conversationId, apiBaseUrl, accessToken
  - Designed for persistent graph updates
  - Tools: addNodesFromPMIDs, etc.
```

**NEW Plan (Research Mode):**
```
Use: Standard PubTator MCP (create new or use existing)
  - No special database context needed
  - Tools work independently
  - Tools:
    - extractEntitiesFromPMIDs
    - findRelationships
    - searchPubMed
    - fetchAbstracts
  - Knowledge graphs generated as artifacts (not database updates)
```

**Implementation:**
```typescript
// Option A: Create new research-pubtator-mcp
custom-mcp-servers/
└── research-pubtator-mcp/
    ├── src/
    │   ├── index.ts
    │   └── tools/
    │       ├── extractEntities.ts      // Extract from abstracts
    │       ├── findRelationships.ts    // Find documented edges
    │       ├── searchPubMed.ts         // Search by term
    │       └── fetchMetadata.ts        // Get paper details

// Option B: Use existing pubtator-mcp without graph mode
// Just ensure it doesn't require databaseContext
```

---

### Change 2: System Prompt Structure

**OLD Plan (Graph Mode System Prompt):**
```typescript
// Used graphModeSystemPrompt.ts
// Focus: Build persistent knowledge graph
// Artifacts: Only graph updates

const graphModeSystemPrompt = `
You are a knowledge graph building assistant.
Your primary task is to extract entities and relationships.
Always return graphs as artifacts with type "application/vnd.knowledge-graph".
...
`;
```

**NEW Plan (Research Mode System Prompt):**
```typescript
// Create researchModeSystemPrompt.ts
// Focus: Comprehensive research with multiple outputs
// Artifacts: Many types

const researchModeSystemPrompt = `
You are an autonomous research assistant capable of conducting
comprehensive literature research.

# Available Artifact Types

You can generate multiple types of artifacts during research:

1. **research-plan** - Structured research plan
   - Topic hierarchy
   - Evidence grades
   - Prioritization

2. **research-report** - Comprehensive findings report
   - Evidence-graded sections
   - Detailed citations
   - Recommendations

3. **knowledge-graph** - Entity relationship visualization
   - Nodes and edges from literature
   - Evidence-graded relationships
   - Visual topology

4. **evidence-table** - Comparison matrix
   - Side-by-side evidence
   - Strength of evidence
   - Study characteristics

5. **timeline** - Chronological development
   - Evolution of understanding
   - Paradigm shifts
   - Historical context

6. **bibliography** - Annotated reference list
   - Key papers by topic
   - Evidence grade per paper
   - Citation recommendations

7. **synthesis-matrix** - Cross-study synthesis
   - Findings across papers
   - Consistencies and contradictions
   - Meta-analysis style tables

# Research Process

1. **Phase 1: Landscape Discovery**
   - Extract entities from abstracts
   - Build knowledge graph in memory
   - Analyze topology (hubs, gaps, clusters)
   - Generate research plan artifact

2. **Phase 2: Deep Research**
   - Execute research plan
   - For each topic, gather evidence
   - Generate topic-specific artifacts as needed
   - Update knowledge graph with discoveries

3. **Phase 3: Synthesis**
   - Generate comprehensive research report artifact
   - Include final knowledge graph artifact
   - Create evidence tables for key comparisons
   - Generate annotated bibliography artifact

# Artifact Generation Guidelines

**When to create each artifact type:**

- **research-plan**: After Phase 1 (landscape discovery)
  - Show user the plan before deep research
  - Allow modification/approval

- **knowledge-graph**: Multiple times
  - Initial graph after entity extraction
  - Updated graph after discovering new edges
  - Final graph in comprehensive report

- **evidence-table**: When comparing
  - Multiple studies on same topic
  - Treatment options
  - Contradictory findings

- **timeline**: When showing evolution
  - Changing understanding over time
  - Historical developments
  - Paradigm shifts

- **bibliography**: End of research
  - Organized by topic
  - Annotated with relevance
  - Evidence grade per paper

- **research-report**: Final output
  - Comprehensive synthesis
  - All sections with evidence grades
  - Includes multiple embedded artifacts

**Artifact Structure:**

Each artifact should include:
- Clear title
- Artifact type
- Content appropriate to type
- Metadata (creation time, papers included, etc.)

**Example artifact in response_formatter:**

{
  "type": "artifact",
  "content": "Initial research plan based on landscape analysis",
  "artifact": {
    "type": "application/vnd.research-plan",
    "title": "Research Plan: BRCA1 Mutations",
    "content": "{...JSON structure...}"
  }
}

# Tools Available

Use PubTator MCP tools for entity extraction:
- extractEntitiesFromPMIDs: Get entities from papers
- findRelationships: Find documented edges
- searchPubMed: Search for papers

Use RAG tools (if enabled) for deep analysis:
- Semantic search will automatically retrieve relevant sections
- Ask specific questions to get detailed evidence

# Important Notes

- Generate artifacts progressively (don't wait until end)
- Update knowledge graph as you discover new edges
- Use evidence grades consistently (STRONG, MODERATE, EMERGING, HYPOTHESIS)
- Create evidence tables when comparing multiple studies
- Generate bibliography at end with all papers cited
`;
```

---

### Change 3: Artifact Type Definitions

**Add to `backend-mcp-client/src/services/artifact.ts`:**

```typescript
// Existing artifact types
export function validateArtifactType(type: string): string {

  // Existing types
  if (type.includes('code') || type === 'application/vnd.ant.code') {
    return 'code';
  }

  if (type.includes('knowledge') || type.includes('graph')) {
    return 'application/vnd.knowledge-graph';
  }

  // NEW: Research-specific artifact types

  if (type === 'research-plan' || type === 'application/vnd.research-plan') {
    return 'application/vnd.research-plan';
  }

  if (type === 'research-report' || type === 'application/vnd.research-report') {
    return 'application/vnd.research-report';
  }

  if (type === 'evidence-table' || type === 'application/vnd.evidence-table') {
    return 'application/vnd.evidence-table';
  }

  if (type === 'timeline' || type === 'application/vnd.timeline') {
    return 'application/vnd.timeline';
  }

  if (type === 'bibliography' || type === 'application/vnd.bibliography') {
    return 'application/vnd.bibliography';
  }

  if (type === 'synthesis-matrix' || type === 'application/vnd.synthesis-matrix') {
    return 'application/vnd.synthesis-matrix';
  }

  // Default
  if (!type || type === 'text') {
    return 'text/markdown';
  }

  return type;
}
```

---

### Change 4: Frontend Artifact Viewers

**Add new viewers to `frontend-client/src/components/artifacts/ArtifactWindow.tsx`:**

```typescript
function ArtifactWindow({ artifact }: { artifact: Artifact }) {

  switch (artifact.type) {

    // Existing types
    case 'code':
    case 'application/vnd.ant.code':
      return <CodeEditorView {...} />;

    case 'application/vnd.knowledge-graph':
      return <KnowledgeGraphViewer {...} />;

    // NEW: Research artifact types

    case 'application/vnd.research-plan':
      return <ResearchPlanViewer
        plan={JSON.parse(artifact.content)}
        onStartResearch={handleStartResearch}
        onModifyTopic={handleModifyTopic}
      />;

    case 'application/vnd.research-report':
      return <ResearchReportViewer
        report={artifact.content}
        onNavigate={handleNavigate}
      />;

    case 'application/vnd.evidence-table':
      return <EvidenceTableViewer
        table={JSON.parse(artifact.content)}
        sortable={true}
        filterable={true}
      />;

    case 'application/vnd.timeline':
      return <TimelineViewer
        timeline={JSON.parse(artifact.content)}
        interactive={true}
      />;

    case 'application/vnd.bibliography':
      return <BibliographyViewer
        bibliography={JSON.parse(artifact.content)}
        groupBy="topic"
        showAbstracts={true}
      />;

    case 'application/vnd.synthesis-matrix':
      return <SynthesisMatrixViewer
        matrix={JSON.parse(artifact.content)}
        highlightConflicts={true}
      />;

    default:
      return <GenericArtifactViewer {...} />;
  }
}
```

---

### Change 5: Research Mode Detection

**In `backend-mcp-client/src/services/chat/index.ts`:**

```typescript
// OLD: Check for graph mode
async function selectSystemPrompt(conversationId: string): Promise<string> {
  const isGraphMode = await checkIfGraphModeConversation(conversationId);

  if (isGraphMode) {
    return graphModeSystemPrompt;
  }

  return normalModeSystemPrompt;
}

// NEW: Check for research mode OR graph mode
async function selectSystemPrompt(
  conversationId: string,
  options: ChatOptions
): Promise<string> {

  // Check if research mode explicitly requested
  if (options.researchMode) {
    return researchModeSystemPrompt;
  }

  // Check if graph mode (existing functionality)
  const isGraphMode = await checkIfGraphModeConversation(conversationId);
  if (isGraphMode) {
    return graphModeSystemPrompt;
  }

  // Default
  return normalModeSystemPrompt;
}

// Add to ChatOptions interface
interface ChatOptions {
  conversationId?: string;
  modelProvider: ModelType;
  blockedServers?: string[];
  enabledTools?: Record<string, string[]>;
  pinnedArtifacts?: Artifact[];
  attachments?: FileAttachment[];
  temperature?: number;
  maxTokens?: number;

  // NEW: Research mode flag
  researchMode?: boolean;        // Enable research mode
  ragEnabled?: boolean;          // Enable RAG during research
  maxThinkingSteps?: number;     // Override default (25 for research)
}
```

---

### Change 6: Knowledge Graph Handling

**In Research Mode, knowledge graphs are artifacts, not database updates:**

```typescript
// OLD (Graph Mode): Update database graph
await graphService.updateConversationGraph(
  conversationId,
  newNodes,
  newEdges
);

// NEW (Research Mode): Generate graph as artifact
const knowledgeGraphArtifact = {
  type: "application/vnd.knowledge-graph",
  title: "Research Landscape: BRCA1 Mutations",
  content: JSON.stringify({
    nodes: extractedNodes,
    edges: extractedEdges,
    metadata: {
      papers: 347,
      entities: 127,
      relationships: 156,
      clusters: 3
    }
  }, null, 2)
};

// Can generate multiple graph artifacts during research:
// 1. Initial landscape graph
// 2. Updated graph after deep research
// 3. Final comprehensive graph in report
```

**Benefits:**
- Multiple graphs per research session (before/after comparisons)
- Graphs don't persist across conversations (each research is independent)
- User can export/save specific graph artifacts they want
- Cleaner separation between research sessions

---

### Change 7: Database Schema Changes

**Graph Mode uses:**
```prisma
model Conversation {
  id            String    @id
  graph         Json?     // Single persistent graph
  ...
}
```

**Research Mode uses:**
```prisma
model ResearchSession {
  id              String    @id
  conversationId  String
  mainTopic       String
  status          String
  // NO single graph field
  // Graphs stored as artifacts instead

  topics          ResearchTopic[]
  papers          ResearchPaper[]
  artifacts       Artifact[]  // Multiple artifacts of various types
}

model Artifact {
  id              String    @id
  type            String    // research-plan, knowledge-graph, evidence-table, etc.
  title           String
  content         String    // JSON or markdown depending on type
  researchSession ResearchSession? @relation(...)
  // Can have multiple knowledge-graph artifacts per session
}
```

**Key Difference:**
- Graph mode: One graph per conversation, continuously updated
- Research mode: Multiple artifacts per session, including multiple graphs at different stages

---

### Change 8: Tool Call Flow

**OLD (Graph Mode with databaseContext):**
```typescript
// Backend adds databaseContext for graph-mode-mcp tools
if (serverName === 'graph-mode-mcp') {
  arguments.databaseContext = {
    conversationId,
    apiBaseUrl: process.env.API_BASE_URL,
    accessToken
  };
}

// MCP tool receives context and updates database
async function addNodesFromPMIDs(args: {
  pmids: string[];
  databaseContext: DatabaseContext;
}) {
  // Extract entities
  const entities = await extractEntities(args.pmids);

  // Update conversation graph in database
  await updateGraphInDatabase(
    args.databaseContext.conversationId,
    entities
  );

  return { success: true };
}
```

**NEW (Research Mode without databaseContext):**
```typescript
// Backend just calls standard PubTator MCP tools
// No special context injection

// MCP tool returns data, doesn't update database
async function extractEntitiesFromPMIDs(args: {
  pmids: string[];
}) {
  // Extract entities
  const entities = await extractEntities(args.pmids);

  // Return data to LLM
  return {
    entities,
    relationships: extractRelationships(entities),
    metadata: { paperCount: args.pmids.length }
  };
}

// LLM decides what to do with data:
// - Build knowledge graph artifact
// - Use in research plan
// - Include in evidence tables
```

**Benefits:**
- Simpler MCP tools (no database coupling)
- More flexible (LLM decides how to use data)
- Reusable (same tools for different purposes)
- Testable (pure functions, no database dependencies)

---

### Change 9: Research Workflow Simplification

**OLD (Graph Mode Style):**
```typescript
// Each topic updates the persistent graph
for (const topic of plan.topics) {
  const findings = await researchTopic(topic);

  // Update conversation's graph in database
  await updateConversationGraph(
    conversationId,
    findings.newNodes,
    findings.newEdges
  );
}
```

**NEW (Research Mode Style):**
```typescript
// Build graph in memory, generate artifacts at milestones
let workingGraph: KnowledgeGraph = { nodes: [], edges: [] };

// Phase 1: Build initial graph
const entities = await extractAllEntities(pmids);
workingGraph = buildGraph(entities);

// Generate initial graph artifact
await createArtifact({
  type: "application/vnd.knowledge-graph",
  title: "Initial Research Landscape",
  content: JSON.stringify(workingGraph)
});

// Generate research plan artifact
await createArtifact({
  type: "application/vnd.research-plan",
  title: "Research Plan",
  content: JSON.stringify(generatePlan(workingGraph))
});

// Phase 2: Execute research
for (const topic of plan.topics) {
  const findings = await researchTopic(topic);

  // Update working graph in memory
  workingGraph = mergeGraphs(workingGraph, findings.newGraph);

  // Optionally generate intermediate artifacts
  if (findings.hasEvidenceTable) {
    await createArtifact({
      type: "application/vnd.evidence-table",
      title: `Evidence: ${topic.name}`,
      content: JSON.stringify(findings.evidenceTable)
    });
  }
}

// Phase 3: Generate final artifacts
await createArtifact({
  type: "application/vnd.knowledge-graph",
  title: "Final Knowledge Graph",
  content: JSON.stringify(workingGraph)
});

await createArtifact({
  type: "application/vnd.research-report",
  title: "Comprehensive Research Report",
  content: generateReport(allFindings, workingGraph)
});

await createArtifact({
  type: "application/vnd.bibliography",
  title: "Annotated Bibliography",
  content: JSON.stringify(generateBibliography(allPapers))
});
```

---

### Change 10: Frontend User Flow

**OLD (Graph Mode):**
```
User: "Research BRCA1"
  ↓
Graph mode activated (if conversation has graph)
  ↓
System builds ONE persistent graph
  ↓
User sees: Single graph artifact, continuously updated
  ↓
All research goes into same graph
```

**NEW (Research Mode):**
```
User: "Research BRCA1"
  ↓
User/System: "Start research mode" or auto-detect
  ↓
Phase 1 completes:
  Artifact 1: "Research Plan" (structured plan)
  Artifact 2: "Initial Landscape Graph" (knowledge graph)
  ↓
User: "Start deep research"
  ↓
Phase 2 executes:
  Artifact 3: "Evidence Table - BRCA1 DNA Repair" (comparison)
  Artifact 4: "Evidence Table - PARP Inhibitors" (comparison)
  Artifact 5: "Updated Knowledge Graph" (with new edges)
  ↓
Phase 3 completes:
  Artifact 6: "Comprehensive Research Report" (full report)
  Artifact 7: "Final Knowledge Graph" (complete graph)
  Artifact 8: "Timeline of Understanding" (chronological)
  Artifact 9: "Annotated Bibliography" (references)
  ↓
User sees: Multiple artifacts of different types
User can: View, compare, export individually
```

---

## Summary of Changes

| Aspect | Graph Mode (OLD) | Research Mode (NEW) |
|--------|------------------|---------------------|
| **MCP Server** | graph-mode-pubtator-mcp | Standard pubtator-mcp or research-pubtator-mcp |
| **Database Context** | Required (conversationId, etc.) | Not required |
| **Artifact Types** | Only knowledge-graph | Multiple: plan, report, graph, table, timeline, bibliography |
| **Graph Persistence** | One persistent graph per conversation | Multiple graph artifacts per session |
| **Database Updates** | Tools update conversation graph | Tools return data, LLM creates artifacts |
| **System Prompt** | graphModeSystemPrompt | researchModeSystemPrompt |
| **Mode Detection** | Check conversation for graph | Explicit flag or auto-detect |
| **Workflow** | Continuous graph updates | Progressive artifact generation |
| **User Experience** | Single evolving graph | Multiple artifacts at milestones |
| **Flexibility** | Limited to graph updates | Can generate any artifact type |

---

## Implementation Priority Changes

### Phase 1: Proof of Concept (Still Week 1)

**OLD Plan:**
- Use graph-mode-mcp
- Focus on graph building

**NEW Plan:**
- Use standard pubtator-mcp (or create research-pubtator-mcp)
- Focus on entity extraction → research plan generation
- Generate TWO artifacts: research-plan + knowledge-graph
- Test multiple artifact types

**Changes:**
```typescript
// 1. Add research mode flag
interface ChatOptions {
  researchMode?: boolean;  // NEW
  // ... existing options
}

// 2. Add research mode system prompt
// File: researchModeSystemPrompt.ts (NEW)

// 3. Add artifact type validation
// File: artifact.ts (MODIFY to add research types)

// 4. Test with simple MCP tools
// Use existing pubtator tools OR create simplified versions
// No database context needed
```

### Phase 2: Research Orchestration (Still Weeks 2-4)

**No Major Changes** - Database schema still needs:
- ResearchSession
- ResearchTopic
- ResearchPaper

**But REMOVE:**
- Persistent graph storage in conversation
- Database context injection

**ADD:**
- Support for multiple artifact types
- Artifact storage links to research session

### Phase 3-6: RAG + Frontend (Still Weeks 5-12)

**Same as before**, but:
- Frontend needs viewers for multiple artifact types
- No special graph mode UI (use standard artifact pane)
- Can display multiple artifacts side-by-side

---

## Advantages of Research Mode

### 1. **Artifact Flexibility**
```
Graph Mode: Only graphs
Research Mode: Plans, reports, tables, timelines, bibliographies, graphs
```

### 2. **Cleaner Separation**
```
Graph Mode: Persistent state across conversation
Research Mode: Each research session is independent
```

### 3. **Simpler MCP Tools**
```
Graph Mode Tools: Must handle database updates
Research Mode Tools: Pure functions, return data
```

### 4. **Better UX**
```
Graph Mode: Single artifact evolves
Research Mode: Multiple artifacts at milestones, user chooses what to keep
```

### 5. **Easier Testing**
```
Graph Mode: Requires database, conversation setup
Research Mode: Can test with mock data, no database needed for tools
```

### 6. **More Reusable**
```
Graph Mode: Tools specific to graph building
Research Mode: Same entity extraction tools used for various purposes
```

---

## Migration Path

### If You Have Existing Graph Mode

```typescript
// Support BOTH modes

async function selectSystemPrompt(
  conversationId: string,
  options: ChatOptions
): Promise<string> {

  // Research mode takes precedence if explicitly requested
  if (options.researchMode) {
    console.log("Using research mode");
    return researchModeSystemPrompt;
  }

  // Check for existing graph mode conversation
  const isGraphMode = await checkIfGraphModeConversation(conversationId);
  if (isGraphMode) {
    console.log("Using graph mode (existing conversation)");
    return graphModeSystemPrompt;
  }

  // Default
  return normalModeSystemPrompt;
}

// MCP tool selection
function selectMCPServer(mode: 'normal' | 'graph' | 'research'): string {
  switch (mode) {
    case 'graph':
      return 'graph-mode-pubtator-mcp';  // Existing
    case 'research':
      return 'research-pubtator-mcp';    // New
    case 'normal':
      return 'pubtator-mcp';             // Standard
  }
}
```

### Gradual Migration

1. **Week 1**: Add research mode alongside graph mode
2. **Week 2-4**: Build research mode features
3. **Week 5+**: Use research mode as default for research tasks
4. **Keep graph mode**: For users who want persistent graph building

---

## New MCP Server: research-pubtator-mcp

### Option A: Create New Server

```typescript
// custom-mcp-servers/research-pubtator-mcp/src/index.ts

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "extract_entities_from_pmids",
        description: "Extract entities (genes, diseases, chemicals) from PubMed papers",
        inputSchema: {
          type: "object",
          properties: {
            pmids: {
              type: "array",
              items: { type: "string" },
              description: "Array of PubMed IDs"
            }
          },
          required: ["pmids"]
        }
      },
      {
        name: "find_documented_relationships",
        description: "Find documented relationships (edges) between entities",
        inputSchema: {
          type: "object",
          properties: {
            pmids: {
              type: "array",
              items: { type: "string" }
            }
          },
          required: ["pmids"]
        }
      },
      {
        name: "search_pubmed",
        description: "Search PubMed for papers by term",
        inputSchema: {
          type: "object",
          properties: {
            query: { type: "string" },
            limit: { type: "number", default: 100 }
          },
          required: ["query"]
        }
      },
      {
        name: "fetch_paper_metadata",
        description: "Fetch metadata for papers (title, authors, abstract, etc.)",
        inputSchema: {
          type: "object",
          properties: {
            pmids: { type: "array", items: { type: "string" } }
          },
          required: ["pmids"]
        }
      }
    ]
  };
});

// Tool implementations return data, no database updates
server.setRequestHandler(CallToolRequestSchema, async (request) => {

  if (request.params.name === "extract_entities_from_pmids") {
    const { pmids } = request.params.arguments;

    // Call PubTator API
    const entities = await extractFromPubTator(pmids);

    // Return data (LLM will use it to build artifacts)
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          entities,
          relationships: entities.relationships,
          metadata: {
            paperCount: pmids.length,
            entityCount: entities.nodes.length,
            relationshipCount: entities.relationships.length
          }
        }, null, 2)
      }]
    };
  }

  // ... other tools
});
```

### Option B: Use Existing Pubtator MCP

If you have an existing pubtator-mcp that doesn't require database context, just use it directly in research mode. No changes needed!

---

## Updated Directory Structure

```
custom-mcp-servers/
├── graphModeMCPs/
│   └── graphmodePubTatorMCP/           # Keep for graph mode
│       └── (with databaseContext)
├── research-pubtator-mcp/              # NEW: For research mode
│   ├── src/
│   │   ├── index.ts
│   │   ├── pubtator.ts                 # PubTator API client
│   │   └── tools/
│   │       ├── extractEntities.ts      # No DB context
│   │       ├── findRelationships.ts    # No DB context
│   │       ├── searchPubmed.ts         # No DB context
│   │       └── fetchMetadata.ts        # No DB context
│   └── package.json
└── pubmed-central-mcp/                 # For full text (works with both modes)
    └── ...

backend-mcp-client/
├── src/
│   ├── services/
│   │   ├── chat/
│   │   │   ├── researchModeSystemPrompt.ts  # NEW
│   │   │   ├── graphModeSystemPrompt.ts     # Existing
│   │   │   └── normalModeSystemPrompt.ts    # Existing
│   │   ├── research/                        # NEW: Research services
│   │   │   ├── orchestrator.ts
│   │   │   ├── planGenerator.ts
│   │   │   └── artifactGenerator.ts         # Handles multiple artifact types
│   │   └── artifact.ts                      # UPDATED: New artifact types
│   └── routes/
│       └── research.ts                       # NEW: Research endpoints

frontend-client/
├── src/
│   ├── components/
│   │   ├── artifacts/
│   │   │   ├── ResearchPlanViewer.tsx       # NEW
│   │   │   ├── ResearchReportViewer.tsx     # NEW
│   │   │   ├── EvidenceTableViewer.tsx      # NEW
│   │   │   ├── TimelineViewer.tsx           # NEW
│   │   │   ├── BibliographyViewer.tsx       # NEW
│   │   │   ├── SynthesisMatrixViewer.tsx    # NEW
│   │   │   └── KnowledgeGraphViewer.tsx     # Existing
│   │   └── research/
│   │       ├── ResearchSessionView.tsx      # NEW
│   │       └── MultiArtifactPanel.tsx       # NEW: Display multiple artifacts
│   └── store/
│       └── researchStore.ts                  # NEW: Research state
```

---

## Example: Research Session with Multiple Artifacts

```typescript
// User starts research
POST /api/research/start
{
  conversationId: "conv-123",
  mainTopic: "BRCA1 mutations in breast cancer",
  researchMode: true
}

// Phase 1: Landscape Discovery
// LLM generates multiple artifacts:

Artifact 1 - Research Plan:
{
  type: "application/vnd.research-plan",
  title: "Research Plan: BRCA1 Mutations",
  content: {
    topics: [
      { name: "BRCA1 DNA repair", priority: 10, evidenceGrade: "STRONG" },
      { name: "PARP inhibitors", priority: 9, evidenceGrade: "STRONG" },
      // ...
    ]
  }
}

Artifact 2 - Initial Knowledge Graph:
{
  type: "application/vnd.knowledge-graph",
  title: "Research Landscape - Initial",
  content: {
    nodes: [...],
    edges: [...],
    metadata: { papers: 347, entities: 127 }
  }
}

// Phase 2: Deep Research
// LLM generates topic-specific artifacts:

Artifact 3 - Evidence Table:
{
  type: "application/vnd.evidence-table",
  title: "BRCA1 DNA Repair Mechanisms - Evidence Comparison",
  content: {
    studies: [
      {
        pmid: "12345",
        finding: "BRCA1 recruits RAD51",
        evidence: "STRONG",
        method: "Co-IP + Western"
      },
      // ...
    ]
  }
}

Artifact 4 - Updated Knowledge Graph:
{
  type: "application/vnd.knowledge-graph",
  title: "Knowledge Graph - After Deep Research",
  content: {
    nodes: [...],  // More nodes than initial
    edges: [...],  // More edges discovered from full text
    newEdges: [...]  // Highlighted
  }
}

// Phase 3: Synthesis
// LLM generates final artifacts:

Artifact 5 - Timeline:
{
  type: "application/vnd.timeline",
  title: "Evolution of BRCA1 Understanding (2000-2024)",
  content: {
    events: [
      { year: 2001, event: "BRCA1-RAD51 interaction discovered" },
      { year: 2005, event: "PARP inhibitor mechanism elucidated" },
      // ...
    ]
  }
}

Artifact 6 - Comprehensive Report:
{
  type: "application/vnd.research-report",
  title: "Comprehensive Research Report: BRCA1 Mutations",
  content: "# Research Report\n\n## Executive Summary\n\n..."
}

Artifact 7 - Final Knowledge Graph:
{
  type: "application/vnd.knowledge-graph",
  title: "Complete Knowledge Graph",
  content: {
    nodes: [...],
    edges: [...],
    clusters: [...],
    gaps: [...]
  }
}

Artifact 8 - Bibliography:
{
  type: "application/vnd.bibliography",
  title: "Annotated Bibliography",
  content: {
    byTopic: {
      "DNA_Repair": [
        {
          pmid: "12345",
          title: "...",
          relevance: "HIGH",
          evidenceGrade: "STRONG",
          annotation: "Key paper demonstrating..."
        }
      ]
    }
  }
}
```

---

## Conclusion

**Key Advantages of Research Mode over Graph Mode:**

1. ✅ **Multiple artifact types** - not restricted to graphs
2. ✅ **Cleaner architecture** - no database context in MCP tools
3. ✅ **Independent research sessions** - no persistent state across conversations
4. ✅ **Better user experience** - progressive artifacts at milestones
5. ✅ **More flexible** - LLM decides what artifacts to generate
6. ✅ **Easier to test** - pure function MCP tools
7. ✅ **Can coexist** - research mode and graph mode can both exist

**Changes Required:**

1. Create `researchModeSystemPrompt.ts` with multi-artifact instructions
2. Add research artifact type validation to `artifact.ts`
3. Create research-pubtator-mcp (or use existing without DB context)
4. Add research mode flag to ChatOptions
5. Update frontend with new artifact viewers
6. Update documentation

**Migration:** Can be done incrementally, keeping graph mode for users who want it while adding research mode for comprehensive research tasks.
