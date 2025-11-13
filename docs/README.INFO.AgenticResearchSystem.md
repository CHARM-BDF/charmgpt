# Agentic Research System - Design Options and Implementation Roadmap

## Executive Summary

This document analyzes options for transforming the Charm MCP system into an agentic research platform capable of:
1. **Recursive paper search** - Following topics into subtopics automatically
2. **Research plan creation** - Generating and tracking a structured research agenda
3. **Automatic follow-up** - Identifying and investigating relevant topics without user intervention
4. **Rich report generation** - Synthesizing findings from abstracts and full-text content
5. **Missing paper tracking** - Listing publications that need to be accessed for complete research

We present **4 implementation options** ranging from minimal changes to a full RAG system, with detailed analysis of effort, benefits, and trade-offs.

---

## Table of Contents

1. [Current System Capabilities](#current-system-capabilities)
2. [Gap Analysis](#gap-analysis)
3. [Option 1: Minimal Changes (Extended Sequential Thinking)](#option-1-minimal-changes-extended-sequential-thinking)
4. [Option 2: Moderate Changes (Research Orchestration Mode)](#option-2-moderate-changes-research-orchestration-mode)
5. [Option 3: Significant Changes (Multi-Agent Architecture)](#option-3-significant-changes-multi-agent-architecture)
6. [Option 4: Full RAG System](#option-4-full-rag-system)
7. [Comparison Matrix](#comparison-matrix)
8. [Recommended Approach](#recommended-approach)
9. [Implementation Roadmap](#implementation-roadmap)

---

## Current System Capabilities

### What Works Today

**Sequential Thinking Loop:**
- Max 5 iterations before formatting response
- Automatic tool discovery and calling
- Session-level tool call tracking (prevents redundant calls)
- Retry logic with exponential backoff

**Available PubMed/PubTator Tools:**

From `graphmodePubTatorMCP`:
1. `addNodesFromPMIDs` - Extract entities from PubMed IDs
2. `addNodesAndEdgesFromText` - Extract entities from arbitrary text
3. `addNodesFromEntityNetwork` - Build entity relationship networks
4. `findRelatedEntities` - Find entities related to a target entity
5. `findAllRelatedEntities` - Comprehensive related entity search
6. `addNodesByName` - Find entities by name
7. `findPublicationsForRelationship` - Find papers about entity relationships
8. `findPublicationsByTerm` - Search PubMed by search term

**Artifact System:**
- Knowledge graphs (nodes + edges)
- Code artifacts
- Text/markdown reports
- Citations/bibliography
- Stored in SQLite with full metadata

**Knowledge Graph Mode:**
- Special mode for building entity-relationship graphs
- Graph persistence across conversation
- Merge capability for combining multiple graphs
- Visual rendering with Reagraph or D3

### Current Limitations for Agentic Research

| Limitation | Impact on Research |
|------------|-------------------|
| **5 iteration limit** | Cannot do deep recursive exploration |
| **No research plan persistence** | Cannot track multi-step research agenda |
| **No subtopic identification** | Manual user guidance needed for follow-up |
| **No full-text storage** | Limited to abstracts, no deep content analysis |
| **No semantic search** | Cannot find conceptually similar papers |
| **No paper caching** | Redundant API calls to PubMed |
| **No RAG system** | Cannot reference specific sections of papers |
| **Single conversation scope** | No cross-conversation research accumulation |

---

## Gap Analysis

### What's Missing for Agentic Research

**1. Research Planning & Tracking**
- Need: Persistent research plan with topics, subtopics, and status
- Current: No structured plan, relies on LLM memory within 5 iterations

**2. Recursive Exploration**
- Need: Ability to follow topic trees indefinitely (topic → subtopics → sub-subtopics)
- Current: Limited to 5 sequential steps, then must format response

**3. Full-Text Paper Access**
- Need: Store and analyze full-text content from PubMed Central
- Current: Only abstracts available via PubTator

**4. Semantic Search & Retrieval**
- Need: Find papers by conceptual similarity, retrieve relevant sections
- Current: Keyword-based search only

**5. Research State Management**
- Need: Track which topics explored, which papers read, what's pending
- Current: Session-level tool call tracking only (prevents immediate duplicates)

**6. Synthesis & Report Generation**
- Need: Multi-stage synthesis across dozens of papers
- Current: Single-pass response formatting after thinking

---

## Option 1: Minimal Changes (Extended Sequential Thinking)

### Overview

Extend the existing sequential thinking system to support longer research sessions with minimal architectural changes.

### Key Changes

**1. Remove or Increase Iteration Limit**

File: `backend-mcp-client/src/services/chat/index.ts:1198`

```typescript
// Current:
const MAX_THINKING_STEPS = 5;

// Change to:
const MAX_THINKING_STEPS = 25; // Or make configurable per request
// OR
const MAX_THINKING_STEPS = options.maxThinkingSteps || 25;
```

**2. Add Research Plan Artifact Type**

File: `backend-mcp-client/src/services/artifact.ts`

```typescript
// Add to validateArtifactType():
if (type === 'research-plan' || type === 'application/vnd.research-plan') {
  return 'application/vnd.research-plan';
}
```

**3. Create Research-Specific System Prompt**

File: Create `backend-mcp-client/src/services/chat/researchModeSystemPrompt.ts`

```typescript
export const researchModeSystemPrompt = `
You are a research assistant capable of deep, recursive literature research.

# Research Process

1. **Create a Research Plan**
   - Identify main topic and subtopics
   - Create a structured plan as an artifact
   - Track exploration status for each topic

2. **Recursive Exploration**
   - For each topic, search PubMed/PubTator
   - Analyze abstracts to identify subtopics
   - Add new subtopics to the plan
   - Continue until thoroughly explored

3. **Track Coverage**
   - Mark topics as: pending, in-progress, completed
   - Track papers found for each topic
   - Identify gaps requiring full-text access

4. **Generate Comprehensive Report**
   - Synthesize findings across all papers
   - Organize by topic hierarchy
   - Include citations and evidence
   - List papers needing full-text access

# Research Plan Structure

{
  "mainTopic": "Primary research question",
  "topics": [
    {
      "id": "topic-1",
      "name": "Topic name",
      "status": "pending|in-progress|completed",
      "papers": ["PMID:12345", "PMID:67890"],
      "subtopics": ["topic-2", "topic-3"],
      "findings": "Summary of findings"
    }
  ],
  "missingPapers": [
    {
      "pmid": "12345",
      "title": "Paper title",
      "reason": "Full text needed for detailed methodology"
    }
  ],
  "progress": {
    "topicsExplored": 10,
    "papersReviewed": 45,
    "completionPercent": 60
  }
}

# Tools Available

- findPublicationsByTerm: Search PubMed
- addNodesFromPMIDs: Extract entities from papers
- findRelatedEntities: Find related concepts
- findPublicationsForRelationship: Papers about entity relationships

# Workflow

1. Create initial research plan artifact
2. For each pending topic:
   a. Search for papers
   b. Extract entities and concepts
   c. Identify subtopics
   d. Update research plan
3. Mark topic as completed
4. If new subtopics found, add to plan
5. Continue until plan is complete
6. Generate final report artifact

Always update the research plan artifact as you work to track progress.
`;
```

**4. Add Research Mode Detection**

File: `backend-mcp-client/src/services/chat/index.ts`

```typescript
async function selectSystemPrompt(
  conversationId: string,
  options: ChatOptions
): Promise<string> {

  // Check if research mode requested
  if (options.researchMode) {
    return researchModeSystemPrompt;
  }

  // Check if graph mode
  const isGraphMode = await checkIfGraphModeConversation(conversationId);
  if (isGraphMode) {
    return graphModeSystemPrompt;
  }

  return normalModeSystemPrompt;
}
```

**5. Add Paper Caching (Simple)**

File: Create `backend-mcp-client/src/services/paperCache.ts`

```typescript
interface CachedPaper {
  pmid: string;
  title: string;
  abstract: string;
  entities: any[];
  timestamp: number;
}

class PaperCache {
  private cache: Map<string, CachedPaper> = new Map();
  private maxAge = 1000 * 60 * 60 * 24; // 24 hours

  set(pmid: string, data: Omit<CachedPaper, 'pmid' | 'timestamp'>): void {
    this.cache.set(pmid, {
      pmid,
      ...data,
      timestamp: Date.now()
    });
  }

  get(pmid: string): CachedPaper | null {
    const cached = this.cache.get(pmid);
    if (!cached) return null;

    // Check if expired
    if (Date.now() - cached.timestamp > this.maxAge) {
      this.cache.delete(pmid);
      return null;
    }

    return cached;
  }

  has(pmid: string): boolean {
    return this.get(pmid) !== null;
  }

  clear(): void {
    this.cache.clear();
  }
}

export const paperCache = new PaperCache();
```

### Implementation Effort

**Time Estimate**: 1-2 days

**Files to Modify**:
1. `backend-mcp-client/src/services/chat/index.ts` - Increase iteration limit
2. `backend-mcp-client/src/services/artifact.ts` - Add research plan type
3. Create `backend-mcp-client/src/services/chat/researchModeSystemPrompt.ts`
4. Create `backend-mcp-client/src/services/paperCache.ts`
5. `frontend-client/src/components/artifacts/ArtifactWindow.tsx` - Add research plan viewer

### Pros

✅ Minimal code changes
✅ Leverages existing architecture
✅ No new dependencies
✅ Quick to implement and test
✅ Uses LLM's context window as "memory"

### Cons

❌ Still limited by LLM context window (can't do infinite research)
❌ No true semantic search (keyword-based only)
❌ No full-text paper storage/analysis
❌ Research plan in LLM memory only (fragile)
❌ No cross-conversation research accumulation
❌ Performance degrades with long conversations (token cost)

### When to Use

- **Quick proof of concept** for agentic research
- **Budget-constrained** projects
- **Low paper volume** research (< 50 papers)
- **Exploratory phase** before committing to complex architecture

---

## Option 2: Moderate Changes (Research Orchestration Mode)

### Overview

Add a dedicated research orchestration layer that manages multi-stage research with persistent state, while keeping the core architecture intact.

### Key Components

**1. Research Session Management**

Create a new database model for research sessions:

File: `backend-mcp-client/prisma/schema.prisma`

```prisma
model ResearchSession {
  id            String    @id @default(uuid())
  conversationId String
  mainTopic     String
  status        String    // active, paused, completed
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  topics        ResearchTopic[]
  papers        ResearchPaper[]

  @@index([conversationId])
}

model ResearchTopic {
  id              String    @id @default(uuid())
  sessionId       String
  parentTopicId   String?
  name            String
  status          String    // pending, in-progress, completed, skipped
  priority        Int       @default(0)
  findings        String?   // Text summary
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  session         ResearchSession @relation(fields: [sessionId], references: [id])
  parentTopic     ResearchTopic? @relation("TopicSubtopics", fields: [parentTopicId], references: [id])
  subtopics       ResearchTopic[] @relation("TopicSubtopics")
  papers          ResearchPaper[] @relation("TopicPapers")

  @@index([sessionId])
  @@index([parentTopicId])
  @@index([status])
}

model ResearchPaper {
  id              String    @id @default(uuid())
  sessionId       String
  pmid            String
  title           String
  abstract        String?
  fullText        String?   // Store full text if available
  authors         Json?
  publicationDate String?
  journal         String?
  doi             String?
  citationCount   Int?
  relevanceScore  Float?    // How relevant to research (0-1)
  status          String    // found, reviewed, full-text-needed
  createdAt       DateTime  @default(now())

  session         ResearchSession @relation(fields: [sessionId], references: [id])
  topics          ResearchTopic[] @relation("TopicPapers")

  @@unique([sessionId, pmid])
  @@index([sessionId])
  @@index([pmid])
}
```

**2. Research Orchestrator Service**

File: Create `backend-mcp-client/src/services/researchOrchestrator.ts`

```typescript
import { PrismaClient } from '@prisma/client';

interface ResearchConfig {
  maxPapersPerTopic?: number;      // Default: 20
  maxSubtopicDepth?: number;       // Default: 3
  maxTotalTopics?: number;         // Default: 50
  minRelevanceScore?: number;      // Default: 0.5
  autoFollowSubtopics?: boolean;   // Default: true
}

class ResearchOrchestrator {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
  }

  // Create a new research session
  async createSession(
    conversationId: string,
    mainTopic: string,
    config?: ResearchConfig
  ): Promise<string> {

    const session = await this.prisma.researchSession.create({
      data: {
        conversationId,
        mainTopic,
        status: 'active',
        topics: {
          create: {
            name: mainTopic,
            status: 'pending',
            priority: 10
          }
        }
      }
    });

    return session.id;
  }

  // Get next topic to explore
  async getNextTopic(sessionId: string): Promise<ResearchTopic | null> {

    const topics = await this.prisma.researchTopic.findMany({
      where: {
        sessionId,
        status: 'pending'
      },
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'asc' }
      ],
      take: 1
    });

    return topics[0] || null;
  }

  // Mark topic as in-progress
  async startTopic(topicId: string): Promise<void> {
    await this.prisma.researchTopic.update({
      where: { id: topicId },
      data: { status: 'in-progress' }
    });
  }

  // Add papers to a topic
  async addPapers(
    sessionId: string,
    topicId: string,
    papers: Array<{
      pmid: string;
      title: string;
      abstract?: string;
      authors?: any;
      publicationDate?: string;
      journal?: string;
      doi?: string;
    }>
  ): Promise<void> {

    // Create papers (upsert to avoid duplicates)
    for (const paper of papers) {
      await this.prisma.researchPaper.upsert({
        where: {
          sessionId_pmid: {
            sessionId,
            pmid: paper.pmid
          }
        },
        update: {
          topics: {
            connect: { id: topicId }
          }
        },
        create: {
          sessionId,
          pmid: paper.pmid,
          title: paper.title,
          abstract: paper.abstract,
          authors: paper.authors,
          publicationDate: paper.publicationDate,
          journal: paper.journal,
          doi: paper.doi,
          status: 'found',
          topics: {
            connect: { id: topicId }
          }
        }
      });
    }
  }

  // Add subtopics discovered during research
  async addSubtopics(
    sessionId: string,
    parentTopicId: string,
    subtopicNames: string[]
  ): Promise<void> {

    for (const name of subtopicNames) {
      // Check if already exists
      const existing = await this.prisma.researchTopic.findFirst({
        where: {
          sessionId,
          name,
          parentTopicId
        }
      });

      if (!existing) {
        await this.prisma.researchTopic.create({
          data: {
            sessionId,
            parentTopicId,
            name,
            status: 'pending',
            priority: 5
          }
        });
      }
    }
  }

  // Complete a topic with findings
  async completeTopic(
    topicId: string,
    findings: string
  ): Promise<void> {

    await this.prisma.researchTopic.update({
      where: { id: topicId },
      data: {
        status: 'completed',
        findings
      }
    });
  }

  // Get research progress
  async getProgress(sessionId: string): Promise<{
    totalTopics: number;
    completedTopics: number;
    pendingTopics: number;
    totalPapers: number;
    completionPercent: number;
  }> {

    const [totalTopics, completedTopics, pendingTopics, totalPapers] = await Promise.all([
      this.prisma.researchTopic.count({ where: { sessionId } }),
      this.prisma.researchTopic.count({ where: { sessionId, status: 'completed' } }),
      this.prisma.researchTopic.count({ where: { sessionId, status: 'pending' } }),
      this.prisma.researchPaper.count({ where: { sessionId } })
    ]);

    return {
      totalTopics,
      completedTopics,
      pendingTopics,
      totalPapers,
      completionPercent: totalTopics > 0 ? (completedTopics / totalTopics) * 100 : 0
    };
  }

  // Get all papers needing full-text access
  async getMissingFullTextPapers(sessionId: string): Promise<ResearchPaper[]> {

    return await this.prisma.researchPaper.findMany({
      where: {
        sessionId,
        status: 'full-text-needed'
      },
      orderBy: {
        relevanceScore: 'desc'
      }
    });
  }

  // Generate final research report
  async generateReport(sessionId: string): Promise<string> {

    const session = await this.prisma.researchSession.findUnique({
      where: { id: sessionId },
      include: {
        topics: {
          include: {
            papers: true,
            subtopics: true
          }
        },
        papers: true
      }
    });

    // Build hierarchical report structure
    // This would be formatted as markdown or artifact
    // ... implementation details
  }
}

export const researchOrchestrator = new ResearchOrchestrator();
```

**3. Research Workflow Loop**

File: Create `backend-mcp-client/src/services/researchWorkflow.ts`

```typescript
import { researchOrchestrator } from './researchOrchestrator';
import { ChatService } from './chat';

interface ResearchWorkflowOptions {
  conversationId: string;
  mainTopic: string;
  maxIterations?: number;
  config?: ResearchConfig;
}

class ResearchWorkflow {
  private chatService: ChatService;

  constructor(chatService: ChatService) {
    this.chatService = chatService;
  }

  async executeResearch(options: ResearchWorkflowOptions): Promise<string> {

    const { conversationId, mainTopic, maxIterations = 100, config } = options;

    // 1. Create research session
    const sessionId = await researchOrchestrator.createSession(
      conversationId,
      mainTopic,
      config
    );

    let iteration = 0;

    // 2. Research loop
    while (iteration < maxIterations) {
      iteration++;

      // Get next topic to explore
      const topic = await researchOrchestrator.getNextTopic(sessionId);

      if (!topic) {
        // No more topics, research complete
        break;
      }

      // Mark topic as in-progress
      await researchOrchestrator.startTopic(topic.id);

      // Use sequential thinking to research this specific topic
      const topicPrompt = `
Research the following topic in depth:

Topic: ${topic.name}
Parent context: ${topic.parentTopic?.name || 'Main research topic'}

Tasks:
1. Search PubMed for relevant papers
2. Analyze abstracts to understand key findings
3. Identify 3-5 subtopics for deeper investigation
4. Summarize findings for this topic

Use these tools:
- findPublicationsByTerm: Search for papers
- addNodesFromPMIDs: Extract entities from papers
- findRelatedEntities: Find related concepts

Return:
1. Summary of findings
2. List of subtopics discovered
3. List of papers reviewed
`;

      // Execute sequential thinking for this topic
      const result = await this.chatService.executeSequentialThinking(
        topicPrompt,
        [], // Fresh history per topic
        await this.chatService.getAllAvailableTools(),
        'anthropic',
        {
          conversationId,
          maxThinkingSteps: 10,
          temperature: 0.3 // Lower for focused research
        }
      );

      // Parse results (would need formatter to extract structured data)
      const findings = this.extractFindings(result);
      const subtopics = this.extractSubtopics(result);
      const papers = this.extractPapers(result);

      // Update research session
      await researchOrchestrator.addPapers(sessionId, topic.id, papers);
      await researchOrchestrator.addSubtopics(sessionId, topic.id, subtopics);
      await researchOrchestrator.completeTopic(topic.id, findings);

      // Log progress
      const progress = await researchOrchestrator.getProgress(sessionId);
      console.log(`Research progress: ${progress.completionPercent}% complete`);
    }

    // 3. Generate final report
    const reportId = await researchOrchestrator.generateReport(sessionId);

    return reportId;
  }

  private extractFindings(result: any): string {
    // Parse LLM output to extract findings
    // Implementation depends on formatter output
  }

  private extractSubtopics(result: any): string[] {
    // Parse LLM output to extract subtopics
  }

  private extractPapers(result: any): Array<any> {
    // Parse LLM output to extract paper metadata
  }
}
```

**4. Research API Endpoint**

File: Create `backend-mcp-client/src/routes/research.ts`

```typescript
import express from 'express';
import { ResearchWorkflow } from '../services/researchWorkflow';

const router = express.Router();

// Start a research session
router.post('/api/research/start', async (req, res) => {
  const { conversationId, mainTopic, config } = req.body;

  try {
    const workflow = new ResearchWorkflow(req.app.locals.chatService);

    // Start research in background
    const reportId = await workflow.executeResearch({
      conversationId,
      mainTopic,
      config
    });

    res.json({
      success: true,
      reportId
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get research progress
router.get('/api/research/:sessionId/progress', async (req, res) => {
  const { sessionId } = req.params;

  const progress = await researchOrchestrator.getProgress(sessionId);

  res.json(progress);
});

// Get research report
router.get('/api/research/:sessionId/report', async (req, res) => {
  const { sessionId } = req.params;

  const report = await researchOrchestrator.generateReport(sessionId);

  res.json(report);
});

export default router;
```

### Implementation Effort

**Time Estimate**: 1-2 weeks

**Files to Create**:
1. Database schema updates (`prisma/schema.prisma`)
2. `src/services/researchOrchestrator.ts`
3. `src/services/researchWorkflow.ts`
4. `src/routes/research.ts`
5. Frontend research session UI components

**Files to Modify**:
1. `src/index.ts` - Add research routes
2. Frontend - Add research session management UI

### Pros

✅ Persistent research state (survives across sessions)
✅ True recursive exploration (not limited by context window)
✅ Structured topic hierarchy
✅ Paper metadata storage
✅ Progress tracking
✅ Can pause and resume research
✅ Scales to hundreds of papers
✅ Leverages existing sequential thinking

### Cons

❌ No semantic search (still keyword-based)
❌ No full-text analysis (abstracts only)
❌ Additional database complexity
❌ Requires background job processing
❌ No vector embeddings for similarity search

### When to Use

- **Medium-scale research** projects (50-200 papers)
- **Iterative research** that spans multiple sessions
- **Structured exploration** with clear topic hierarchy
- **Budget-conscious** but need persistence
- **Want to track research progress** over time

---

## Option 3: Significant Changes (Multi-Agent Architecture)

### Overview

Implement a multi-agent system where specialized agents collaborate on different aspects of research: planning, searching, analyzing, and synthesizing.

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Research Orchestrator                    │
│                   (Master Coordinator)                       │
└────────┬──────────┬──────────┬──────────┬───────────────────┘
         │          │          │          │
         ▼          ▼          ▼          ▼
   ┌─────────┐ ┌────────┐ ┌─────────┐ ┌────────────┐
   │ Planner │ │Searcher│ │Analyzer │ │Synthesizer │
   │  Agent  │ │ Agent  │ │  Agent  │ │   Agent    │
   └─────────┘ └────────┘ └─────────┘ └────────────┘
        │           │          │             │
        │           │          │             │
        ▼           ▼          ▼             ▼
   Research     Paper      Entity      Report
     Plan      Database   Extraction  Generation
```

### Agent Definitions

**1. Planner Agent**

Responsibilities:
- Create initial research plan
- Decompose main topic into subtopics
- Prioritize exploration order
- Identify knowledge gaps

System Prompt:
```typescript
export const plannerAgentPrompt = `
You are a Research Planning Agent.

Your job is to:
1. Analyze a research question
2. Break it down into explorable subtopics
3. Create a hierarchical research plan
4. Prioritize topics by importance and dependency

For each topic, specify:
- Topic name and description
- Why it's important
- What specific questions to answer
- Which topics it depends on
- Estimated paper count needed

Output format: Structured JSON research plan
`;
```

**2. Searcher Agent**

Responsibilities:
- Execute PubMed searches for specific topics
- Filter results by relevance
- Extract metadata
- Identify highly-cited or recent papers

System Prompt:
```typescript
export const searcherAgentPrompt = `
You are a Paper Search Agent.

Your job is to:
1. Receive a specific topic to research
2. Formulate effective PubMed search queries
3. Execute searches using available tools
4. Filter results for relevance
5. Extract metadata (title, authors, year, citations, DOI)
6. Rank papers by relevance and impact

Tools available:
- findPublicationsByTerm
- addNodesFromPMIDs
- findPublicationsForRelationship

Output: Ranked list of papers with metadata and relevance scores
`;
```

**3. Analyzer Agent**

Responsibilities:
- Read paper abstracts
- Extract key entities (diseases, drugs, genes, etc.)
- Identify relationships between entities
- Determine if full-text is needed
- Identify new subtopics

System Prompt:
```typescript
export const analyzerAgentPrompt = `
You are a Paper Analysis Agent.

Your job is to:
1. Receive a paper (PMID + abstract)
2. Extract key information:
   - Main findings
   - Entities (diseases, drugs, genes, proteins, etc.)
   - Relationships between entities
   - Methodologies used
3. Identify new subtopics for further research
4. Determine if full-text access is needed
5. Score relevance to the research topic (0-1)

Tools available:
- addNodesFromPMIDs
- addNodesAndEdgesFromText
- findRelatedEntities

Output: Structured analysis with entities, findings, and recommendations
`;
```

**4. Synthesizer Agent**

Responsibilities:
- Combine findings from multiple papers
- Identify patterns and trends
- Generate coherent narrative
- Create visualizations (knowledge graphs)
- List missing information

System Prompt:
```typescript
export const synthesizerAgentPrompt = `
You are a Research Synthesis Agent.

Your job is to:
1. Receive findings from multiple papers on a topic
2. Identify common themes and patterns
3. Resolve contradictions or explain differences
4. Create a coherent narrative
5. Generate knowledge graphs showing relationships
6. Identify gaps requiring full-text papers

Output:
- Comprehensive topic summary
- Knowledge graph artifact
- List of papers needing full-text access
- Confidence level in conclusions
`;
```

### Agent Communication Protocol

File: Create `backend-mcp-client/src/services/agents/agentMessage.ts`

```typescript
interface AgentMessage {
  id: string;
  from: AgentType;
  to: AgentType | 'orchestrator';
  type: 'task' | 'result' | 'question' | 'error';
  payload: any;
  timestamp: number;
}

type AgentType = 'planner' | 'searcher' | 'analyzer' | 'synthesizer';

interface AgentTask {
  taskId: string;
  type: string;
  input: any;
  priority: number;
  dependencies?: string[]; // Other task IDs that must complete first
}

interface AgentResult {
  taskId: string;
  success: boolean;
  output: any;
  metadata?: {
    tokensUsed?: number;
    timeMs?: number;
    toolsCalled?: string[];
  };
}
```

### Agent Base Class

File: Create `backend-mcp-client/src/services/agents/baseAgent.ts`

```typescript
import { ChatService } from '../chat';

abstract class BaseAgent {
  protected name: string;
  protected systemPrompt: string;
  protected chatService: ChatService;
  protected tools: string[]; // Allowed tool names

  constructor(
    name: string,
    systemPrompt: string,
    chatService: ChatService,
    tools: string[]
  ) {
    this.name = name;
    this.systemPrompt = systemPrompt;
    this.chatService = chatService;
    this.tools = tools;
  }

  async execute(task: AgentTask): Promise<AgentResult> {
    console.log(`[${this.name}] Starting task: ${task.taskId}`);

    try {
      // Build task-specific prompt
      const prompt = this.buildPrompt(task);

      // Execute with sequential thinking
      const result = await this.chatService.executeSequentialThinking(
        prompt,
        [], // Fresh context per task
        await this.getFilteredTools(),
        'anthropic',
        {
          maxThinkingSteps: 10,
          temperature: 0.2,
          systemPrompt: this.systemPrompt
        }
      );

      // Parse result
      const output = await this.parseResult(result, task);

      return {
        taskId: task.taskId,
        success: true,
        output
      };

    } catch (error) {
      console.error(`[${this.name}] Task failed:`, error);

      return {
        taskId: task.taskId,
        success: false,
        output: null,
        metadata: {
          error: error.message
        }
      };
    }
  }

  protected abstract buildPrompt(task: AgentTask): string;
  protected abstract parseResult(result: any, task: AgentTask): Promise<any>;

  private async getFilteredTools(): Promise<any[]> {
    const allTools = await this.chatService.getAllAvailableTools();
    return allTools.filter(tool => this.tools.includes(tool.name));
  }
}

export default BaseAgent;
```

### Research Orchestrator (Multi-Agent)

File: Create `backend-mcp-client/src/services/agents/researchOrchestrator.ts`

```typescript
import { PlannerAgent } from './plannerAgent';
import { SearcherAgent } from './searcherAgent';
import { AnalyzerAgent } from './analyzerAgent';
import { SynthesizerAgent } from './synthesizerAgent';

interface ResearchState {
  sessionId: string;
  plan: ResearchPlan;
  tasks: Map<string, AgentTask>;
  results: Map<string, AgentResult>;
  status: 'planning' | 'searching' | 'analyzing' | 'synthesizing' | 'complete';
}

class MultiAgentResearchOrchestrator {
  private planner: PlannerAgent;
  private searcher: SearcherAgent;
  private analyzer: AnalyzerAgent;
  private synthesizer: SynthesizerAgent;

  private state: ResearchState;

  constructor(chatService: ChatService) {
    this.planner = new PlannerAgent(chatService);
    this.searcher = new SearcherAgent(chatService);
    this.analyzer = new AnalyzerAgent(chatService);
    this.synthesizer = new SynthesizerAgent(chatService);
  }

  async conductResearch(
    sessionId: string,
    mainTopic: string
  ): Promise<string> {

    // Initialize state
    this.state = {
      sessionId,
      plan: null,
      tasks: new Map(),
      results: new Map(),
      status: 'planning'
    };

    // Phase 1: Planning
    console.log('Phase 1: Creating research plan...');
    const planTask = {
      taskId: 'plan-main',
      type: 'create-plan',
      input: { topic: mainTopic },
      priority: 10
    };

    const planResult = await this.planner.execute(planTask);
    this.state.plan = planResult.output;
    this.state.status = 'searching';

    // Phase 2: Search for each topic
    console.log('Phase 2: Searching for papers...');
    const searchTasks: AgentTask[] = this.state.plan.topics.map((topic, idx) => ({
      taskId: `search-${idx}`,
      type: 'search-topic',
      input: { topic: topic.name, context: topic.description },
      priority: topic.priority || 5
    }));

    // Execute searches in parallel (batch of 5 at a time)
    const searchResults = await this.executeBatch(searchTasks, this.searcher, 5);

    // Phase 3: Analyze papers
    console.log('Phase 3: Analyzing papers...');
    const allPapers = searchResults.flatMap(r => r.output.papers);

    const analyzeTasks: AgentTask[] = allPapers.map((paper, idx) => ({
      taskId: `analyze-${idx}`,
      type: 'analyze-paper',
      input: { pmid: paper.pmid, abstract: paper.abstract, topic: paper.topic },
      priority: paper.relevanceScore || 5
    }));

    const analyzeResults = await this.executeBatch(analyzeTasks, this.analyzer, 10);

    // Phase 4: Synthesize findings per topic
    console.log('Phase 4: Synthesizing findings...');
    const synthesizeTasks: AgentTask[] = this.state.plan.topics.map((topic, idx) => ({
      taskId: `synthesize-${idx}`,
      type: 'synthesize-topic',
      input: {
        topic: topic.name,
        papers: analyzeResults.filter(r => r.output.topic === topic.name)
      },
      priority: 10
    }));

    const synthesizeResults = await this.executeBatch(
      synthesizeTasks,
      this.synthesizer,
      3
    );

    // Phase 5: Final synthesis
    console.log('Phase 5: Generating final report...');
    const finalTask = {
      taskId: 'synthesize-final',
      type: 'synthesize-all',
      input: {
        mainTopic,
        topicSummaries: synthesizeResults.map(r => r.output)
      },
      priority: 10
    };

    const finalReport = await this.synthesizer.execute(finalTask);

    this.state.status = 'complete';

    return finalReport.output.reportId;
  }

  private async executeBatch(
    tasks: AgentTask[],
    agent: BaseAgent,
    batchSize: number
  ): Promise<AgentResult[]> {

    const results: AgentResult[] = [];

    for (let i = 0; i < tasks.length; i += batchSize) {
      const batch = tasks.slice(i, i + batchSize);

      const batchResults = await Promise.all(
        batch.map(task => agent.execute(task))
      );

      results.push(...batchResults);

      console.log(`Completed ${i + batch.length}/${tasks.length} tasks`);
    }

    return results;
  }
}
```

### Implementation Effort

**Time Estimate**: 3-4 weeks

**Files to Create**:
1. `src/services/agents/baseAgent.ts`
2. `src/services/agents/plannerAgent.ts`
3. `src/services/agents/searcherAgent.ts`
4. `src/services/agents/analyzerAgent.ts`
5. `src/services/agents/synthesizerAgent.ts`
6. `src/services/agents/researchOrchestrator.ts`
7. `src/services/agents/agentMessage.ts`
8. Agent-specific system prompts (4 files)
9. Research state management
10. Frontend agent monitoring UI

### Pros

✅ True multi-agent collaboration
✅ Specialized agents for each task
✅ Parallel execution (faster)
✅ Clear separation of concerns
✅ Extensible (add more agent types)
✅ Can handle complex research workflows
✅ Better error isolation
✅ Observable agent interactions

### Cons

❌ Complex architecture
❌ Higher token costs (multiple LLM calls)
❌ Coordination overhead
❌ Still no semantic search or RAG
❌ Debugging multi-agent systems is hard
❌ Longer implementation time

### When to Use

- **Complex research** requiring specialized analysis
- **Large-scale projects** (200+ papers)
- **Team wants observability** into research process
- **Budget allows** for higher LLM costs
- **Long-term research** platform investment

---

## Option 4: Full RAG System

### Overview

Implement a complete Retrieval-Augmented Generation (RAG) system with vector embeddings, semantic search, and full-text paper storage.

### Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                        Frontend                              │
└────────────────────────┬─────────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────────┐
│                   Research API Layer                         │
└────────┬─────────────────────────────────┬───────────────────┘
         │                                 │
         ▼                                 ▼
┌──────────────────┐            ┌────────────────────┐
│ Chat Service +   │            │ RAG Service        │
│ Multi-Agent Orch │            │ - Query embedding  │
│                  │            │ - Vector search    │
│                  │            │ - Chunk retrieval  │
└────────┬─────────┘            └─────────┬──────────┘
         │                                 │
         ▼                                 ▼
┌──────────────────┐            ┌────────────────────┐
│ MCP Services     │            │ Vector Database    │
│ - PubMed         │            │ (Pinecone/Chroma)  │
│ - PubTator       │            │                    │
│ - PMC            │            │ - Paper embeddings │
└──────────────────┘            │ - Chunk embeddings │
                                └─────────┬──────────┘
                                          │
                                          ▼
                                ┌────────────────────┐
                                │ Document Store     │
                                │ (PostgreSQL)       │
                                │ - Full text papers │
                                │ - Metadata         │
                                │ - Citations        │
                                └────────────────────┘
```

### Key Components

**1. Vector Database Integration**

Options:
- **Pinecone** (managed, expensive, easy)
- **Weaviate** (open-source, complex, powerful)
- **Chroma** (lightweight, Python-based)
- **pgvector** (PostgreSQL extension, free)

Recommended: **pgvector** (PostgreSQL extension)

File: `backend-mcp-client/prisma/schema.prisma`

```prisma
// Add pgvector extension
generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["postgresqlExtensions"]
}

datasource db {
  provider   = "postgresql"
  url        = env("DATABASE_URL")
  extensions = [vector]
}

model PaperDocument {
  id              String    @id @default(uuid())
  pmid            String    @unique
  pmcid           String?   // PubMed Central ID
  title           String
  abstract        String?
  fullText        String?   // Full text content
  authors         Json
  publicationDate DateTime?
  journal         String?
  doi             String?
  citationCount   Int?
  embedding       Unsupported("vector(1536)")?  // OpenAI ada-002 dimension
  createdAt       DateTime  @default(now())

  chunks          PaperChunk[]

  @@index([pmid])
  @@index([pmcid])
}

model PaperChunk {
  id          String    @id @default(uuid())
  paperId     String
  chunkIndex  Int       // Position in paper (0, 1, 2, ...)
  content     String    // Chunk text (~500 tokens)
  section     String?   // abstract, introduction, methods, results, discussion, conclusion
  embedding   Unsupported("vector(1536)")
  createdAt   DateTime  @default(now())

  paper       PaperDocument @relation(fields: [paperId], references: [id])

  @@unique([paperId, chunkIndex])
  @@index([paperId])
}
```

**2. Embedding Service**

File: Create `backend-mcp-client/src/services/embedding.ts`

```typescript
import OpenAI from 'openai';

class EmbeddingService {
  private openai: OpenAI;
  private model = 'text-embedding-3-small'; // 1536 dimensions, cheaper than ada-002

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }

  async embedText(text: string): Promise<number[]> {
    const response = await this.openai.embeddings.create({
      model: this.model,
      input: text
    });

    return response.data[0].embedding;
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    // OpenAI allows batches up to 2048 items
    const response = await this.openai.embeddings.create({
      model: this.model,
      input: texts
    });

    return response.data.map(d => d.embedding);
  }

  // Chunk text into ~500 token pieces
  chunkText(text: string, maxTokens: number = 500): string[] {
    // Simple chunking by sentences
    // In production, use tiktoken for accurate token counting
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [];
    const chunks: string[] = [];
    let currentChunk = '';

    for (const sentence of sentences) {
      // Rough estimate: 1 token ≈ 4 characters
      const estimatedTokens = (currentChunk + sentence).length / 4;

      if (estimatedTokens > maxTokens && currentChunk) {
        chunks.push(currentChunk.trim());
        currentChunk = sentence;
      } else {
        currentChunk += sentence;
      }
    }

    if (currentChunk) {
      chunks.push(currentChunk.trim());
    }

    return chunks;
  }
}

export const embeddingService = new EmbeddingService();
```

**3. RAG Service**

File: Create `backend-mcp-client/src/services/rag.ts`

```typescript
import { PrismaClient } from '@prisma/client';
import { embeddingService } from './embedding';

interface SearchResult {
  paperId: string;
  chunkId: string;
  content: string;
  section: string;
  similarity: number;
  metadata: {
    pmid: string;
    title: string;
    authors: any;
    publicationDate: string;
  };
}

class RAGService {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
  }

  // Index a paper (create embeddings)
  async indexPaper(
    pmid: string,
    title: string,
    abstract: string,
    fullText: string | null,
    metadata: any
  ): Promise<void> {

    // 1. Create paper document
    const paper = await this.prisma.paperDocument.upsert({
      where: { pmid },
      update: {
        title,
        abstract,
        fullText,
        ...metadata
      },
      create: {
        pmid,
        title,
        abstract,
        fullText,
        ...metadata
      }
    });

    // 2. Embed title + abstract
    const titleAbstract = `${title}\n\n${abstract || ''}`;
    const paperEmbedding = await embeddingService.embedText(titleAbstract);

    // Update paper with embedding
    await this.prisma.$executeRaw`
      UPDATE "PaperDocument"
      SET embedding = ${JSON.stringify(paperEmbedding)}::vector
      WHERE id = ${paper.id}
    `;

    // 3. If full text available, chunk and embed
    if (fullText) {
      const chunks = embeddingService.chunkText(fullText);

      // Embed all chunks
      const chunkEmbeddings = await embeddingService.embedBatch(chunks);

      // Store chunks with embeddings
      for (let i = 0; i < chunks.length; i++) {
        const chunkContent = chunks[i];
        const embedding = chunkEmbeddings[i];

        // Detect section (simple heuristic)
        const section = this.detectSection(chunkContent, i, chunks.length);

        await this.prisma.$executeRaw`
          INSERT INTO "PaperChunk" (id, "paperId", "chunkIndex", content, section, embedding, "createdAt")
          VALUES (
            gen_random_uuid(),
            ${paper.id},
            ${i},
            ${chunkContent},
            ${section},
            ${JSON.stringify(embedding)}::vector,
            NOW()
          )
          ON CONFLICT ("paperId", "chunkIndex") DO UPDATE
          SET content = ${chunkContent},
              section = ${section},
              embedding = ${JSON.stringify(embedding)}::vector
        `;
      }
    }

    console.log(`Indexed paper ${pmid} with ${chunks?.length || 0} chunks`);
  }

  // Semantic search
  async search(
    query: string,
    limit: number = 10,
    minSimilarity: number = 0.7
  ): Promise<SearchResult[]> {

    // 1. Embed query
    const queryEmbedding = await embeddingService.embedText(query);

    // 2. Vector search using pgvector
    const results = await this.prisma.$queryRaw<any[]>`
      SELECT
        c.id as "chunkId",
        c."paperId",
        c.content,
        c.section,
        1 - (c.embedding <=> ${JSON.stringify(queryEmbedding)}::vector) as similarity,
        p.pmid,
        p.title,
        p.authors,
        p."publicationDate"
      FROM "PaperChunk" c
      JOIN "PaperDocument" p ON c."paperId" = p.id
      WHERE 1 - (c.embedding <=> ${JSON.stringify(queryEmbedding)}::vector) > ${minSimilarity}
      ORDER BY c.embedding <=> ${JSON.stringify(queryEmbedding)}::vector
      LIMIT ${limit}
    `;

    return results.map(r => ({
      paperId: r.paperId,
      chunkId: r.chunkId,
      content: r.content,
      section: r.section,
      similarity: r.similarity,
      metadata: {
        pmid: r.pmid,
        title: r.title,
        authors: r.authors,
        publicationDate: r.publicationDate
      }
    }));
  }

  // Find similar papers by PMID
  async findSimilarPapers(pmid: string, limit: number = 10): Promise<any[]> {

    // Get paper embedding
    const paper = await this.prisma.paperDocument.findUnique({
      where: { pmid }
    });

    if (!paper || !paper.embedding) {
      throw new Error(`Paper ${pmid} not indexed`);
    }

    // Vector search for similar papers
    const results = await this.prisma.$queryRaw<any[]>`
      SELECT
        pmid,
        title,
        abstract,
        authors,
        "publicationDate",
        1 - (embedding <=> ${paper.embedding}::vector) as similarity
      FROM "PaperDocument"
      WHERE pmid != ${pmid}
      ORDER BY embedding <=> ${paper.embedding}::vector
      LIMIT ${limit}
    `;

    return results;
  }

  // Build context for RAG prompting
  async buildContext(query: string, maxChunks: number = 5): Promise<string> {

    const results = await this.search(query, maxChunks);

    if (results.length === 0) {
      return 'No relevant papers found in the database.';
    }

    let context = '## Relevant Research Findings\n\n';

    for (const result of results) {
      context += `### ${result.metadata.title} (PMID: ${result.metadata.pmid})\n`;
      context += `**Section:** ${result.section || 'N/A'}\n`;
      context += `**Similarity:** ${(result.similarity * 100).toFixed(1)}%\n\n`;
      context += `${result.content}\n\n`;
      context += `---\n\n`;
    }

    return context;
  }

  private detectSection(content: string, index: number, total: number): string {
    const lower = content.toLowerCase();

    if (index === 0) return 'abstract';
    if (lower.includes('introduction')) return 'introduction';
    if (lower.includes('methods') || lower.includes('materials')) return 'methods';
    if (lower.includes('results')) return 'results';
    if (lower.includes('discussion')) return 'discussion';
    if (lower.includes('conclusion')) return 'conclusion';
    if (index === total - 1) return 'conclusion';

    return 'body';
  }
}

export const ragService = new RAGService();
```

**4. PubMed Central MCP Tool**

Create a new MCP server for fetching full-text papers from PubMed Central:

File: Create `custom-mcp-servers/pubmed-central-mcp/src/index.ts`

```typescript
// Tool: fetch_full_text
// Description: Fetch full-text paper from PubMed Central
// Input: { pmcid: string }
// Output: { fullText: string, sections: {...} }

async function fetchFullText(pmcid: string): Promise<any> {
  // Use NCBI E-utilities efetch
  const url = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pmc&id=${pmcid}&rettype=xml`;

  const response = await fetch(url);
  const xml = await response.text();

  // Parse XML to extract full text
  // ... XML parsing logic

  return {
    pmcid,
    fullText: extractedText,
    sections: {
      abstract: '',
      introduction: '',
      methods: '',
      results: '',
      discussion: '',
      conclusion: ''
    }
  };
}
```

**5. RAG-Enabled Research Workflow**

File: Modify `backend-mcp-client/src/services/researchWorkflow.ts`

```typescript
// Add RAG to analyzer agent
class RAGAnalyzerAgent extends AnalyzerAgent {

  async execute(task: AgentTask): Promise<AgentResult> {

    const { pmid, topic } = task.input;

    // 1. Build RAG context for this topic
    const ragContext = await ragService.buildContext(
      `${topic} ${pmid}`,
      maxChunks: 5
    );

    // 2. Add context to prompt
    const enhancedPrompt = `
    ${this.basePrompt}

    ## Relevant Context from Literature

    ${ragContext}

    ## Paper to Analyze

    PMID: ${pmid}

    Please analyze this paper in the context of the provided literature.
    `;

    // 3. Execute with RAG context
    // ... rest of analysis logic
  }
}
```

**6. Automatic Paper Indexing**

File: Create `backend-mcp-client/src/services/paperIndexer.ts`

```typescript
class PaperIndexer {

  async indexPapersFromSearch(pmids: string[]): Promise<void> {

    for (const pmid of pmids) {

      // Check if already indexed
      const existing = await prisma.paperDocument.findUnique({
        where: { pmid }
      });

      if (existing && existing.embedding) {
        console.log(`Paper ${pmid} already indexed, skipping`);
        continue;
      }

      // Fetch paper metadata
      const metadata = await this.fetchPaperMetadata(pmid);

      // Try to fetch full text from PMC
      let fullText = null;
      if (metadata.pmcid) {
        try {
          const pmcData = await this.fetchFullTextFromPMC(metadata.pmcid);
          fullText = pmcData.fullText;
        } catch (error) {
          console.log(`Full text not available for ${pmid}`);
        }
      }

      // Index paper
      await ragService.indexPaper(
        pmid,
        metadata.title,
        metadata.abstract,
        fullText,
        {
          pmcid: metadata.pmcid,
          authors: metadata.authors,
          publicationDate: metadata.publicationDate,
          journal: metadata.journal,
          doi: metadata.doi,
          citationCount: metadata.citationCount
        }
      );

      console.log(`Indexed ${pmid}`);

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  private async fetchPaperMetadata(pmid: string): Promise<any> {
    // Use PubMed E-utilities
    // ... implementation
  }

  private async fetchFullTextFromPMC(pmcid: string): Promise<any> {
    // Use PMC E-utilities
    // ... implementation
  }
}

export const paperIndexer = new PaperIndexer();
```

### Implementation Effort

**Time Estimate**: 4-6 weeks

**Infrastructure Changes**:
1. Switch from SQLite to PostgreSQL
2. Install pgvector extension
3. Set up OpenAI API for embeddings

**Files to Create**:
1. `src/services/embedding.ts`
2. `src/services/rag.ts`
3. `src/services/paperIndexer.ts`
4. `custom-mcp-servers/pubmed-central-mcp/` (full directory)
5. Database migration scripts
6. RAG-enabled agent implementations

**Files to Modify**:
1. `prisma/schema.prisma` - Add vector database models
2. All agent implementations - Add RAG context
3. Research workflow - Add automatic indexing
4. Frontend - Add semantic search UI

### Pros

✅ True semantic search (concept-based, not keyword)
✅ Full-text paper analysis
✅ Context-aware research (RAG)
✅ Find similar papers automatically
✅ Scales to thousands of papers
✅ High-quality synthesis
✅ Efficient retrieval (vector search is fast)
✅ Best research quality

### Cons

❌ Significant infrastructure changes (PostgreSQL, pgvector)
❌ Higher costs (OpenAI embeddings + storage)
❌ Complex implementation
❌ Longer development time
❌ Requires more maintenance
❌ Indexing time for large paper sets

### When to Use

- **High-quality research** is critical
- **Large paper corpus** (500+ papers)
- **Semantic understanding** needed (not just keywords)
- **Long-term platform** (not one-off project)
- **Budget allows** for infrastructure and API costs
- **Team has expertise** in vector databases

---

## Comparison Matrix

| Feature | Option 1: Minimal | Option 2: Moderate | Option 3: Multi-Agent | Option 4: Full RAG |
|---------|------------------|-------------------|---------------------|-------------------|
| **Implementation Time** | 1-2 days | 1-2 weeks | 3-4 weeks | 4-6 weeks |
| **Code Changes** | Very small | Moderate | Large | Very large |
| **Architecture Changes** | None | Database schema | Multi-agent system | PostgreSQL + RAG |
| **Recursive Research** | Limited (25 iter) | ✅ Unlimited | ✅ Unlimited | ✅ Unlimited |
| **Research Plan Persistence** | ❌ In memory | ✅ Database | ✅ Database | ✅ Database |
| **Semantic Search** | ❌ No | ❌ No | ❌ No | ✅ Yes |
| **Full-Text Analysis** | ❌ No | ❌ No | ❌ No | ✅ Yes |
| **Paper Caching** | Simple in-memory | ❌ No | ❌ No | ✅ Full indexing |
| **Parallel Execution** | ❌ No | ❌ Sequential | ✅ Yes | ✅ Yes |
| **Max Papers** | ~50 | ~200 | ~500 | Unlimited |
| **LLM Cost (relative)** | 1x | 2x | 4x | 3x |
| **Infrastructure Cost** | $0 | $0 | $0 | $50-200/mo |
| **Research Quality** | Good | Very Good | Excellent | Best |
| **Extensibility** | Low | Medium | High | Very High |
| **Debugging Complexity** | Low | Medium | High | Very High |

---

## Recommended Approach

### Phased Implementation Strategy

**I recommend a phased approach combining multiple options:**

### Phase 1: Quick Win (Week 1)
**Implement Option 1 (Minimal Changes)**

- Increase `MAX_THINKING_STEPS` to 25
- Add research mode system prompt
- Implement simple paper caching
- Test with small research project (10-20 papers)

**Goal**: Validate agentic research concept with minimal investment

### Phase 2: Production Ready (Weeks 2-3)
**Implement Option 2 (Research Orchestration)**

- Add research session database models
- Build research orchestrator service
- Create research workflow system
- Add progress tracking and persistence

**Goal**: Support real research projects with 50-200 papers

### Phase 3: Scale Up (Weeks 4-6)
**Selectively Add Option 3 Features (Multi-Agent)**

Don't do full multi-agent initially. Instead:
- Add specialized "analyzer" agent for paper analysis
- Add specialized "synthesizer" agent for report generation
- Keep single orchestrator (not full multi-agent)

**Goal**: Improve research quality with specialized agents

### Phase 4: Advanced Capabilities (Weeks 7-12)
**Implement Option 4 (RAG System)**

- Migrate to PostgreSQL + pgvector
- Implement embedding service
- Build RAG service with semantic search
- Add PubMed Central full-text fetching
- Automatic paper indexing

**Goal**: Production-grade research platform with semantic capabilities

---

## Implementation Roadmap

### Week 1: Proof of Concept
- [ ] Modify `MAX_THINKING_STEPS` in `chat/index.ts`
- [ ] Create `researchModeSystemPrompt.ts`
- [ ] Add research mode flag to ChatOptions
- [ ] Implement simple `paperCache.ts`
- [ ] Test with diabetes research example
- [ ] Document findings and limitations

### Weeks 2-3: Production Foundation
- [ ] Design research session database schema
- [ ] Add Prisma models (ResearchSession, ResearchTopic, ResearchPaper)
- [ ] Implement `researchOrchestrator.ts`
- [ ] Create `researchWorkflow.ts`
- [ ] Add `/api/research/*` endpoints
- [ ] Build frontend research session UI
- [ ] Add progress tracking and visualization
- [ ] Test with medium-scale project (50-100 papers)

### Weeks 4-6: Specialized Agents
- [ ] Create `baseAgent.ts` foundation
- [ ] Implement `analyzerAgent.ts` for paper analysis
- [ ] Implement `synthesizerAgent.ts` for report generation
- [ ] Modify research workflow to use agents
- [ ] Add agent monitoring UI
- [ ] Test synthesis quality improvements

### Weeks 7-9: Infrastructure Upgrade
- [ ] Set up PostgreSQL database
- [ ] Install and configure pgvector extension
- [ ] Migrate SQLite data to PostgreSQL
- [ ] Update Prisma schema with vector types
- [ ] Test database performance

### Weeks 10-12: RAG Implementation
- [ ] Implement `embedding.ts` service
- [ ] Build `rag.ts` with semantic search
- [ ] Create `paperIndexer.ts`
- [ ] Develop PubMed Central MCP server
- [ ] Add automatic paper indexing to workflow
- [ ] Integrate RAG context into agents
- [ ] Test semantic search quality
- [ ] Optimize retrieval performance

---

## Cost Estimates

### Option 1: Minimal Changes
- **Development**: 8-16 hours ($800-$1,600 at $100/hr)
- **LLM API**: ~$5-20 per research session (50 papers)
- **Infrastructure**: $0 (uses existing)
- **Total First Month**: ~$1,000-$2,000

### Option 2: Moderate Changes
- **Development**: 80-160 hours ($8,000-$16,000)
- **LLM API**: ~$10-40 per session (200 papers)
- **Infrastructure**: $0
- **Total First Month**: ~$10,000-$20,000

### Option 3: Multi-Agent
- **Development**: 240-320 hours ($24,000-$32,000)
- **LLM API**: ~$40-100 per session (parallel calls)
- **Infrastructure**: $0
- **Total First Month**: ~$25,000-$35,000

### Option 4: Full RAG
- **Development**: 320-480 hours ($32,000-$48,000)
- **LLM API**: ~$30-60 per session (embeddings + chat)
- **Infrastructure**:
  - PostgreSQL hosting: $50-200/mo
  - Embeddings (1000 papers): ~$10-20
  - Storage (10GB): ~$10/mo
- **Total First Month**: ~$35,000-$50,000

---

## Summary and Next Steps

### Key Takeaways

1. **Start Small**: Option 1 provides immediate value with minimal risk
2. **Build Foundation**: Option 2 adds essential persistence and orchestration
3. **Scale Intelligently**: Add agents selectively (Option 3) only where needed
4. **Go Semantic When Ready**: Option 4 (RAG) is the ultimate goal but can wait

### Immediate Next Steps

1. **Validate Concept**: Implement Option 1 this week
2. **Test Use Case**: Try with your specific research topic
3. **Measure Results**: Track papers found, topics covered, quality of synthesis
4. **Plan Phase 2**: If successful, proceed with Option 2 development

### Questions to Consider

1. What's the typical scope of your research projects? (# of papers)
2. Is this a one-time need or ongoing platform?
3. What's your budget for development and API costs?
4. How important is semantic search vs keyword search?
5. Do you need full-text analysis or are abstracts sufficient?

---

**Document Created**: November 8, 2024
**Author**: Claude Code
**Status**: Design Document - Ready for Review
