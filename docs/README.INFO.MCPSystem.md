# Charm MCP System - Comprehensive Overview

## Table of Contents
1. [Executive Summary](#executive-summary)
2. [System Architecture Overview](#system-architecture-overview)
3. [Consecutive Thinking (Sequential Thinking)](#consecutive-thinking-sequential-thinking)
4. [How MCPs Are Called by the LLM](#how-mcps-are-called-by-the-llm)
5. [MCP Response Processing](#mcp-response-processing)
6. [Artifact Handling System](#artifact-handling-system)
7. [Text Summarization and UI Formatting](#text-summarization-and-ui-formatting)
8. [Complete Data Flow](#complete-data-flow)
9. [Key Configuration](#key-configuration)
10. [Future Adaptation Considerations](#future-adaptation-considerations)

---

## Executive Summary

The Charm MCP system is a sophisticated LLM orchestration platform that enables conversations augmented with external tools through the Model Context Protocol (MCP). The system supports multiple LLM providers (Anthropic, OpenAI, Gemini, Ollama) and implements a sequential thinking loop that allows the LLM to iteratively reason and call tools before generating final responses.

**Key Components:**
- **Backend**: Express.js TypeScript server managing MCP connections, LLM interactions, and data persistence
- **Frontend**: React TypeScript client displaying conversations and artifacts
- **Database**: SQLite with Prisma ORM for conversations, messages, and artifacts
- **MCP Servers**: External Node.js services providing specialized tools (PubMed, Knowledge Graphs, etc.)

**Core Innovation:**
The system uses a "sequential thinking" approach where the LLM can think through problems step-by-step, calling tools multiple times in a loop (up to 5 iterations) before using a special "response_formatter" tool to structure the final output for the user.

---

## System Architecture Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (React)                         │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────┐   │
│  │ Chat Interface│  │ Artifact Pane│  │ Knowledge Graph UI │   │
│  └──────┬───────┘  └──────┬───────┘  └─────────┬──────────┘   │
└─────────┼─────────────────┼────────────────────┼──────────────┘
          │                 │                    │
          │         HTTP/SSE│                    │
          │                 │                    │
┌─────────┼─────────────────┼────────────────────┼──────────────┐
│         ▼                 ▼                    ▼              │
│              Backend (Express.js + TypeScript)                │
│  ┌──────────────────────────────────────────────────────┐    │
│  │              ChatService (Orchestrator)               │    │
│  │  - Sequential Thinking Loop (max 5 iterations)        │    │
│  │  - Response Formatting                                │    │
│  │  - Artifact Collection                                │    │
│  └───────┬─────────────────┬────────────────┬────────────┘    │
│          │                 │                │                  │
│  ┌───────▼──────┐  ┌──────▼─────┐  ┌───────▼────────┐        │
│  │  LLM Service │  │ MCP Service │  │ Database (Prisma)│       │
│  │  (Adapters)  │  │  (Clients)  │  │   SQLite        │       │
│  └───────┬──────┘  └──────┬─────┘  └─────────────────┘        │
└──────────┼─────────────────┼───────────────────────────────────┘
           │                 │
           │ API Calls       │ stdio
           │                 │
┌──────────▼──────┐  ┌──────▼────────────────────────────────┐
│  LLM Providers  │  │      MCP Servers (External)           │
│  - Anthropic    │  │  - pubtator-mcp (PubMed search)       │
│  - OpenAI       │  │  - kappa-mcp (Writer assistance)      │
│  - Gemini       │  │  - graph-mode-mcp (Knowledge graphs)  │
│  - Ollama       │  │  - clinical-trial-mcp (Trial data)    │
└─────────────────┘  └───────────────────────────────────────┘
```

### Layer Structure

The system operates in 6 distinct layers:

1. **Presentation Layer** (Frontend): User interface components
2. **API Layer** (Routes): Express route handlers for chat endpoints
3. **Service Layer** (ChatService, LLMService, MCPService): Business logic
4. **Adapter Layer**: Provider-specific implementations
5. **Protocol Layer**: MCP client communication (stdio transport)
6. **Persistence Layer**: Prisma + SQLite database

---

## Consecutive Thinking (Sequential Thinking)

### What It Is

Sequential thinking is an iterative reasoning process where the LLM can:
1. Think through a problem
2. Decide which tools to call
3. Execute those tools
4. Analyze the results
5. Decide if more thinking/tools are needed
6. Repeat up to 5 times before finalizing the response

This is different from a single LLM call with tools. Instead, it creates a **thinking loop** that enables complex multi-step reasoning.

### Implementation

**Location**: `backend-mcp-client/src/services/chat/index.ts` (Lines 1042-1400+)

**Method**: `executeSequentialThinking()`

**Parameters:**
```typescript
private async executeSequentialThinking(
  message: string,              // User's question
  history: ChatMessage[],       // Conversation history
  mcpTools: AnthropicTool[],    // Available MCP tools
  modelProvider: ModelType,     // Which LLM to use
  options: ChatOptions,         // Configuration
  statusHandler?: (status: string) => void,  // Progress updates
  toolExecutions: Array<{name: string; description: string}> = []
): Promise<any[]>  // Returns thinking history
```

### The Sequential Thinking Loop

```
┌─────────────────────────────────────────────────────────────┐
│                   Start Sequential Thinking                 │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
                 ┌──────────────────────┐
                 │ Initialize Variables │
                 │ - thinkingSteps = 0  │
                 │ - isComplete = false │
                 │ - sessionToolCalls   │
                 └──────────┬───────────┘
                            │
      ┌─────────────────────┴─────────────────────┐
      │                                           │
      ▼                                           │
┌─────────────────────────────────────┐           │
│   Format Message History            │           │
│   Add System Prompt with Tools      │           │
└──────────────┬──────────────────────┘           │
               │                                   │
               ▼                                   │
┌─────────────────────────────────────┐           │
│    Send to LLM with Tool Definitions│           │
│    (Anthropic, OpenAI, Gemini, etc) │           │
└──────────────┬──────────────────────┘           │
               │                                   │
               ▼                                   │
        ┌──────────────┐                          │
        │ LLM Response │                          │
        └──────┬───────┘                          │
               │                                   │
         ┌─────┴──────┐                           │
         │ Contains   │                           │
         │ tool_use?  │                           │
         └─────┬──────┘                           │
               │                                   │
        ┌──────┴──────┐                           │
        │             │                           │
       YES           NO                           │
        │             │                           │
        │             └─────┐                     │
        ▼                   │                     │
┌───────────────┐           │                     │
│ Execute Tools │           │                     │
│ via MCP       │           │                     │
└───────┬───────┘           │                     │
        │                   │                     │
        ▼                   │                     │
┌───────────────┐           │                     │
│ Add Tool      │           │                     │
│ Results to    │           │                     │
│ History       │           │                     │
└───────┬───────┘           │                     │
        │                   │                     │
        ▼                   │                     │
  ┌────────────┐            │                     │
  │ Increment  │            │                     │
  │ thinkingStep           │                     │
  └────┬───────┘            │                     │
       │                   │                     │
       ▼                   │                     │
  ┌────────────────┐       │                     │
  │ Step < 5?      │       │                     │
  └────┬───────────┘       │                     │
       │                   │                     │
    YES│NO                 │                     │
       │ │                 │                     │
       │ └─────────────────┤                     │
       │                   │                     │
       └───────────────────┤                     │
                           │                     │
                           ▼                     │
                    ┌──────────────┐             │
                    │ Mark as      │             │
                    │ Complete     │             │
                    └──────┬───────┘             │
                           │                     │
                           ▼                     │
                    ┌──────────────┐             │
                    │ Return       │             │
                    │ Thinking     │             │
                    │ History      │             │
                    └──────────────┘             │
                                                 │
        Loop continues ───────────────────────────┘
        (max 5 iterations)
```

### Key Features

**1. Session-Level Tool Call Tracking** (Lines 1225-1233)
- Extracts historical tool calls from the entire conversation
- Prevents the LLM from calling the same tool repeatedly
- Encourages exploration of different approaches

**2. Termination Conditions**
The loop exits when:
- LLM indicates thinking is complete (no more tool_use blocks)
- Maximum 5 iterations reached
- No progress detected (same tool called repeatedly)
- Error occurs

**3. Retry Logic with Exponential Backoff** (Lines 964-1040)

Method: `runSequentialThinking()` wraps the execution with retry:

```typescript
MAX_RETRIES = 3

For attempt 1 to 3:
  Try:
    - Execute sequential thinking
    - Return result if successful
  Catch error:
    - Adjust temperature: attempt > 1 ? temp * 0.8 : temp
    - Adjust maxTokens: attempt > 1 ? min(2000, maxTokens) : maxTokens
    - Wait: min(1000 * 2^(attempt-1), 5000) milliseconds
    - Retry
```

**Temperature adjustment**: Reduces randomness on retries to encourage more focused responses
**Token reduction**: Limits response length to prevent timeouts

**4. Tool Filtering**
- Automatically removes `sequential-thinking` tools from the available tool list to prevent infinite loops
- Respects `blockedServers` array for user-controlled tool blocking
- Applies `enabledTools` whitelist per server

### Example Execution Flow

```
User asks: "What are the latest treatments for diabetes?"

Iteration 1:
  LLM thinks: "I should search PubMed for recent diabetes research"
  Calls: pubtator:search_pubmed("diabetes treatment 2024")
  Gets: [List of 10 recent papers]

Iteration 2:
  LLM thinks: "These papers mention several drugs. Let me get details."
  Calls: pubtator:fetch_article_details("PMID:12345")
  Gets: [Full article abstract and metadata]

Iteration 3:
  LLM thinks: "I have enough information now"
  No tool calls
  → Loop exits, proceeds to formatting
```

---

## How MCPs Are Called by the LLM

### Overview

MCP (Model Context Protocol) tools are external services that the LLM can call during conversations. The system bridges the gap between LLM provider-specific tool calling formats and the standardized MCP protocol.

### Tool Discovery Process

**Location**: `backend-mcp-client/src/services/mcp.ts` (Lines 262-456)

**Method**: `getAllAvailableTools()`

**Steps:**

```
1. Iterate through all MCP server clients
   ├─ pubtator-mcp
   ├─ kappa-mcp
   ├─ graph-mode-mcp
   └─ clinical-trial-mcp

2. For each server:
   Call listTools() via MCP protocol
   ↓
   Receive tool definitions with JSON schemas
   ↓
   Apply filtering:
   - Check blockedServers array
   - Check enabledTools whitelist
   - Remove sequential-thinking tools
   ↓
   For each tool:
   ├─ Original name: "search_pubmed"
   ├─ Server name: "pubtator"
   ├─ MCP format: "pubtator:search_pubmed"
   └─ Anthropic format: "pubtator-search_pubmed"
        (Replace : with - for Anthropic compatibility)

3. Resolve JSON schema references
   - Handle $ref pointers
   - Resolve $defs components
   - Create complete schema with all properties

4. Return array of tools in provider-specific format
```

### Tool Name Mapping

**Critical Concept**: Different formats are used at different stages

```typescript
// MCP Server defines:
Tool name: "search_pubmed"

// MCP Service stores:
Full name: "pubtator:search_pubmed"

// Anthropic API requires:
Formatted name: "pubtator-search_pubmed"  // Replace : with -

// Internal mapping stored:
{
  "pubtator-search_pubmed": "pubtator:search_pubmed"
}
```

**Why?** Anthropic's tool name format doesn't allow colons, so we map between formats automatically.

### Tool Definition Conversion (Adapter Pattern)

**Location**: `backend-mcp-client/src/services/chat/adapters/`

Each LLM provider has its own adapter implementing the `ToolCallAdapter` interface:

```typescript
interface ToolCallAdapter {
  convertTools(mcpTools: AnthropicTool[]): ProviderSpecificFormat;
  extractToolCalls(response: ProviderResponse): ToolCall[];
  executeToolCall(toolCall: ToolCall): Promise<ToolResult>;
  formatToolResult(result: ToolResult): ProviderMessageFormat;
}
```

**Supported Adapters:**
- `/adapters/anthropic.ts` - Claude models
- `/adapters/openai.ts` - GPT models
- `/adapters/gemini.ts` - Google Gemini models
- `/adapters/ollama.ts` - Local Ollama models

**Example: Anthropic Adapter**

Input (MCP Tool):
```json
{
  "name": "pubtator-search_pubmed",
  "description": "Search PubMed for scientific articles",
  "input_schema": {
    "type": "object",
    "properties": {
      "query": {
        "type": "string",
        "description": "Search query"
      }
    },
    "required": ["query"]
  }
}
```

Output (Anthropic Format):
```json
{
  "name": "pubtator-search_pubmed",
  "description": "Search PubMed for scientific articles",
  "input_schema": {
    "type": "object",
    "properties": {
      "query": {
        "type": "string",
        "description": "Search query"
      }
    },
    "required": ["query"]
  }
}
```

(Note: Anthropic's format is similar to MCP, but other providers differ significantly)

### Tool Execution Flow

**Location**: `backend-mcp-client/src/routes/chat.ts` (Lines 409-487)

```
Step 1: LLM Response Received
  Contains content blocks including tool_use

Step 2: Extract Tool Calls
  For each tool_use block:
    ├─ Extract tool name: "pubtator-search_pubmed"
    ├─ Extract arguments: {"query": "diabetes"}
    └─ Extract tool_use_id: "toolu_01A1B2C3"

Step 3: Resolve Original Tool Name
  Call: getOriginalToolName("pubtator-search_pubmed")
  Returns: "pubtator:search_pubmed"

Step 4: Parse Server and Tool Names
  Split on ':'
  ├─ serverName: "pubtator"
  └─ toolName: "search_pubmed"

Step 5: Special Handling for Graph Mode (Lines 445-477)
  If serverName === 'graph-mode-mcp':
    Add databaseContext to arguments:
      ├─ conversationId: "current-conversation-id"
      ├─ apiBaseUrl: process.env.API_BASE_URL || "http://localhost:3001"
      └─ accessToken: "user-session-token"

Step 6: Execute Tool via MCP
  Call: mcpService.callTool(serverName, toolName, arguments)

  Internally:
    ├─ Get MCP client for server
    ├─ Send tool call over stdio transport
    ├─ Wait for response
    └─ Return result

Step 7: Process Tool Result
  Result structure:
    {
      content: [{type: "text", text: "..."}],
      bibliography?: [...],
      artifacts?: [...]
    }

Step 8: Add to Conversation History
  Create tool_result message:
    {
      role: "user",
      content: [
        {
          type: "tool_result",
          tool_use_id: "toolu_01A1B2C3",
          content: result.content
        }
      ]
    }

Step 9: Continue Sequential Thinking Loop
  If more iterations needed:
    ├─ Send updated history to LLM
    └─ Repeat from Step 1
  Else:
    ├─ Proceed to response formatting
    └─ Return to user
```

### Tool Execution Under the Hood

**MCP Protocol Communication** (`backend-mcp-client/src/services/mcp.ts`)

```typescript
async callTool(
  serverName: string,
  toolName: string,
  args: Record<string, unknown>
): Promise<ToolResult> {

  // 1. Get the MCP client for this server
  const client = this.mcpClients.get(serverName);
  if (!client) throw new Error(`Server ${serverName} not found`);

  // 2. Call the tool via MCP protocol (stdio transport)
  const result = await client.callTool({
    name: toolName,
    arguments: args
  });

  // 3. Return the result
  return result;
}
```

**MCP Client Communication**:
- Uses stdio (standard input/output) to communicate with external Node.js processes
- Sends JSON-RPC formatted messages
- Receives structured responses with content, bibliography, artifacts

### Tool Logging

**Location**: `backend-mcp-client/logs/toolcalling/toolcall-{timestamp}.log`

Every tool call creates detailed logs:

```
=== SESSION_START ===
Timestamp: 2024-11-08T15:30:45.123Z
Conversation ID: conv_123456

=== TOOLS_AVAILABLE ===
- pubtator-search_pubmed
- pubtator-fetch_article_details
- kappa-generate_text
...

=== CALLING_CLAUDE ===
Request to LLM with 15 tools available

=== CLAUDE_RESPONSE ===
[Full LLM response with tool_use blocks]

=== TOOL_CALL_DETECTED ===
Tool: pubtator-search_pubmed
Arguments: {"query": "diabetes treatment"}

=== TOOL_CALL_MAPPED ===
Original name: pubtator:search_pubmed

=== MCP_RESPONSE ===
[Full response from MCP server]
```

---

## MCP Response Processing

### Overview

When an MCP tool is called, it returns structured data that must be:
1. Extracted from the MCP response format
2. Parsed and validated
3. Split into components (text, bibliography, artifacts)
4. Converted to internal storage format
5. Added back to the conversation

### Response Structure

**MCP Tool Result Format:**
```typescript
interface MCPToolResult {
  content: Array<{
    type: string;        // "text", "image", "resource", etc.
    text?: string;       // Text content
    data?: string;       // Base64 encoded binary data
    mimeType?: string;   // MIME type for binary content
  }>;
  bibliography?: Array<{
    title: string;
    authors: string[];
    year: number;
    source: string;
    url?: string;
    doi?: string;
  }>;
  artifacts?: Array<{
    type: string;        // "code", "image", "knowledge-graph", etc.
    title: string;
    content: string;
    language?: string;
    metadata?: Record<string, unknown>;
  }>;
}
```

### Extraction and Parsing

**Location**: `backend-mcp-client/src/services/message.ts` (Lines 93-166)

**Method**: `convertToStoreFormat()`

This method converts tool results into the internal "StoreFormat":

```typescript
interface StoreFormat {
  thinking?: string;   // LLM's reasoning (optional)
  conversation: string | Array<{
    type: "text" | "artifact";
    content?: string;
    artifact?: {
      type: string;
      title: string;
      content: string;
      language?: string;
    };
  }>;
  artifacts?: Array<{
    id: string;
    type: string;
    title: string;
    content: string;
    position: number;
    language?: string;
  }>;
}
```

**Parsing Steps:**

```typescript
async convertToStoreFormat(response: any): Promise<StoreFormat> {

  // 1. Initialize result object
  const result: StoreFormat = {
    conversation: []
  };

  // 2. Extract thinking if present
  if (response.thinking) {
    result.thinking = response.thinking;
  }

  // 3. Process conversation array
  if (Array.isArray(response.conversation)) {
    for (const item of response.conversation) {

      if (item.type === 'text') {
        // Regular text content
        result.conversation.push({
          type: 'text',
          content: item.content
        });

        // Check for binary output metadata
        if (item.metadata?.binaryOutput) {
          const artifact = await this.processBinaryOutput(item.metadata);
          result.artifacts.push(artifact);
        }

      } else if (item.type === 'artifact') {
        // Artifact definition
        const artifactId = generateId();

        // Validate and normalize artifact type
        const normalizedType = validateArtifactType(item.artifact.type);

        // Create artifact
        result.artifacts.push({
          id: artifactId,
          type: normalizedType,
          title: item.artifact.title,
          content: item.artifact.content,
          position: result.artifacts.length,
          language: item.artifact.language
        });

        // Add button to conversation
        result.conversation.push({
          type: 'artifact',
          content: `View ${item.artifact.title}`,
          artifactId: artifactId
        });
      }
    }
  }

  // 4. Return formatted result
  return result;
}
```

### Artifact Type Normalization

**Location**: `backend-mcp-client/src/services/artifact.ts`

**Method**: `validateArtifactType()`

Different MCP servers may return different artifact type strings. The system normalizes these:

```typescript
function validateArtifactType(type: string): string {
  // Normalize code artifacts
  if (type.includes('code') ||
      type === 'application/vnd.ant.code' ||
      type.startsWith('code/')) {
    return 'code';
  }

  // Normalize image artifacts
  if (type.startsWith('image/')) {
    return type;  // Preserve MIME type (image/png, image/jpeg, etc.)
  }

  // Normalize knowledge graph artifacts
  if (type.includes('knowledge') ||
      type.includes('graph') ||
      type === 'application/vnd.knowledge-graph') {
    return 'application/vnd.knowledge-graph';
  }

  // Normalize Python artifacts
  if (type === 'application/vnd.ant.python') {
    return 'code';
  }

  // Default to markdown
  if (!type || type === 'text') {
    return 'text/markdown';
  }

  return type;
}
```

### Binary Output Processing

**Method**: `processBinaryOutput()`

Some MCP tools return binary data (images, PDFs, etc.). These are processed specially:

```typescript
async processBinaryOutput(metadata: any): Promise<Artifact> {
  return {
    id: generateId(),
    type: metadata.mimeType || 'application/octet-stream',
    title: metadata.filename || 'Binary Output',
    content: metadata.base64Data,  // Base64 encoded
    position: 0,
    metadata: {
      binaryType: metadata.binaryType,
      sourceCode: metadata.sourceCode  // Original code that generated this
    }
  };
}
```

### Response Enhancement with Artifacts

**Method**: `enhanceResponseWithArtifacts()`

After extracting artifacts, the system can merge them with the main response:

```typescript
async enhanceResponseWithArtifacts(
  response: StoreFormat,
  additionalArtifacts: Artifact[]
): Promise<StoreFormat> {

  // Add new artifacts to the artifacts array
  response.artifacts = [
    ...(response.artifacts || []),
    ...additionalArtifacts
  ];

  // Create buttons in conversation for new artifacts
  for (const artifact of additionalArtifacts) {
    response.conversation.push({
      type: 'artifact',
      content: `View ${artifact.title}`,
      artifactId: artifact.id
    });
  }

  return response;
}
```

### Knowledge Graph Merging

**Special Case**: Knowledge graph artifacts can be merged across multiple tool calls

**Location**: `backend-mcp-client/src/utils/knowledgeGraphUtils.ts`

```typescript
function mergeKnowledgeGraphs(graphs: KnowledgeGraph[]): KnowledgeGraph {
  const mergedNodes = new Map();
  const mergedLinks = new Map();

  for (const graph of graphs) {
    // Merge nodes by ID
    for (const node of graph.nodes) {
      if (!mergedNodes.has(node.id)) {
        mergedNodes.set(node.id, node);
      }
    }

    // Merge links (deduplicate)
    for (const link of graph.links) {
      const linkKey = `${link.source}-${link.target}-${link.type}`;
      if (!mergedLinks.has(linkKey)) {
        mergedLinks.set(linkKey, link);
      }
    }
  }

  return {
    nodes: Array.from(mergedNodes.values()),
    links: Array.from(mergedLinks.values())
  };
}
```

---

## Artifact Handling System

### Overview

Artifacts are generated content items (code, images, knowledge graphs, etc.) that are:
1. Created during conversations (by LLM or MCP tools)
2. Stored in the database with metadata
3. Displayed in a separate pane in the UI
4. Can be pinned for context in subsequent messages
5. Can be edited, downloaded, or deleted

### Artifact Lifecycle

```
Creation → Validation → Storage → Retrieval → Display → User Interaction
```

### Storage (Backend)

**Database**: SQLite via Prisma ORM

**Schema** (`backend-mcp-client/prisma/schema.prisma`):

```prisma
model Artifact {
  id            String    @id @default(uuid())
  type          String    // code, image, knowledge-graph, etc.
  title         String
  content       String    // Can be large (code, JSON, etc.)
  language      String?   // For code artifacts
  metadata      Json?     // Additional metadata
  position      Int       // Position in conversation
  createdAt     DateTime  @default(now())

  // Relations
  message       Message?  @relation(fields: [messageId], references: [id])
  messageId     String?
  conversation  Conversation @relation(fields: [conversationId], references: [id])
  conversationId String

  @@index([conversationId])
  @@index([messageId])
}
```

**Artifact Service** (`backend-mcp-client/src/services/artifact.ts`):

```typescript
class ArtifactService {

  // Create new artifact
  async createArtifact(data: {
    type: string;
    title: string;
    content: string;
    language?: string;
    conversationId: string;
    messageId?: string;
    position: number;
  }): Promise<Artifact> {

    // Validate type
    const normalizedType = validateArtifactType(data.type);

    // Store in database
    return await prisma.artifact.create({
      data: {
        ...data,
        type: normalizedType
      }
    });
  }

  // Get artifact by ID
  async getArtifact(id: string): Promise<Artifact | null> {
    return await prisma.artifact.findUnique({
      where: { id }
    });
  }

  // Get all artifacts for a conversation
  async getConversationArtifacts(conversationId: string): Promise<Artifact[]> {
    return await prisma.artifact.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' }
    });
  }

  // Update artifact content
  async updateArtifact(id: string, content: string): Promise<Artifact> {
    return await prisma.artifact.update({
      where: { id },
      data: { content }
    });
  }

  // Delete artifact
  async deleteArtifact(id: string): Promise<void> {
    await prisma.artifact.delete({
      where: { id }
    });
  }
}
```

### Retrieval (Frontend)

**Location**: `frontend-client/src/components/chat/ChatMessages.tsx` (Lines 65-125)

**Method**: `getMessageArtifacts()`

The frontend retrieves artifacts through multiple strategies:

```typescript
function getMessageArtifacts(message: Message): Artifact[] {
  const artifacts: Artifact[] = [];

  // Strategy 1: Direct link via artifactId
  if (message.artifactId) {
    const artifact = artifactsStore.get(message.artifactId);
    if (artifact) artifacts.push(artifact);
  }

  // Strategy 2: Multiple artifacts via artifactIds array
  if (message.artifactIds && Array.isArray(message.artifactIds)) {
    for (const id of message.artifactIds) {
      const artifact = artifactsStore.get(id);
      if (artifact) artifacts.push(artifact);
    }
  }

  // Strategy 3: Reference lookup (artifacts referencing this message)
  const referencedArtifacts = artifactsStore.findByMessageId(message.id);
  artifacts.push(...referencedArtifacts);

  // Strategy 4: Parse artifact buttons from HTML content
  const buttonMatches = message.content.matchAll(
    /<button[^>]*data-artifact-id="([^"]+)"[^>]*>/g
  );
  for (const match of buttonMatches) {
    const artifactId = match[1];
    const artifact = artifactsStore.get(artifactId);
    if (artifact && !artifacts.find(a => a.id === artifactId)) {
      artifacts.push(artifact);
    }
  }

  // Strategy 5: Normalize knowledge graph types
  return artifacts.map(artifact => ({
    ...artifact,
    type: normalizeKnowledgeGraphType(artifact.type)
  }));
}

function normalizeKnowledgeGraphType(type: string): string {
  const knowledgeGraphTypes = [
    'knowledge-graph',
    'application/vnd.knowledge-graph',
    'vnd.knowledge-graph',
    'graph'
  ];

  if (knowledgeGraphTypes.includes(type.toLowerCase())) {
    return 'application/vnd.knowledge-graph';
  }

  return type;
}
```

### Display (Frontend)

**Location**: `frontend-client/src/components/artifacts/ArtifactWindow.tsx`

**Component**: `<ArtifactWindow />`

Renders different artifact types with specialized viewers:

```typescript
function ArtifactWindow({ artifact }: { artifact: Artifact }) {

  // Determine renderer based on type
  switch (artifact.type) {

    case 'code':
    case 'application/vnd.ant.code':
      return <CodeEditorView
        code={artifact.content}
        language={artifact.language || 'javascript'}
        title={artifact.title}
        onSave={handleSave}
        onCopy={handleCopy}
        onDownload={handleDownload}
      />;

    case 'text/markdown':
    case 'application/vnd.ant.markdown':
      return <MarkdownRenderer
        content={artifact.content}
        title={artifact.title}
      />;

    case 'application/vnd.knowledge-graph':
      // Check user preference for graph renderer
      const preferReagraph = userSettings.preferReagraph;

      if (preferReagraph) {
        return <ReagraphKnowledgeGraphViewer
          data={JSON.parse(artifact.content)}
          title={artifact.title}
        />;
      } else {
        return <KnowledgeGraphViewer
          data={JSON.parse(artifact.content)}
          title={artifact.title}
        />;
      }

    case 'image/png':
    case 'image/jpeg':
    case 'image/svg+xml':
      return <ImageViewer
        base64Data={artifact.content}
        mimeType={artifact.type}
        title={artifact.title}
        onDownload={handleDownload}
      />;

    case 'bibliography':
      return <BibliographyViewer
        citations={JSON.parse(artifact.content)}
        title={artifact.title}
      />;

    default:
      return <GenericArtifactViewer
        content={artifact.content}
        type={artifact.type}
        title={artifact.title}
      />;
  }
}
```

**Code Editor Features:**
- Syntax highlighting (via Monaco Editor or Prism)
- Copy to clipboard
- Download as file
- Edit and save changes

**Knowledge Graph Features:**
- Interactive node-link visualization
- Zoom and pan
- Node selection and details
- Export as PNG or SVG

### Pinned Artifacts

**Purpose**: Include artifact content in the context for the next LLM call

**Location**: `frontend-client/src/store/chatStore.ts`

```typescript
interface ChatStore {
  pinnedArtifacts: Artifact[];

  // Pin an artifact
  pinArtifact(artifactId: string): void {
    const artifact = this.artifacts.find(a => a.id === artifactId);
    if (artifact && !this.pinnedArtifacts.includes(artifact)) {
      this.pinnedArtifacts.push(artifact);
    }
  }

  // Unpin an artifact
  unpinArtifact(artifactId: string): void {
    this.pinnedArtifacts = this.pinnedArtifacts.filter(
      a => a.id !== artifactId
    );
  }

  // Clear all pins
  clearPinnedArtifacts(): void {
    this.pinnedArtifacts = [];
  }
}
```

**How Pinned Artifacts Are Used:**

When sending a new message, pinned artifacts are included in the request:

```typescript
async sendMessage(message: string) {
  const request = {
    message,
    history: this.messages,
    pinnedArtifacts: this.pinnedArtifacts.map(artifact => ({
      type: artifact.type,
      title: artifact.title,
      content: artifact.content
    })),
    // ... other options
  };

  const response = await fetch('/api/chat-artifacts', {
    method: 'POST',
    body: JSON.stringify(request)
  });
}
```

The backend then includes pinned artifact content in the system prompt:

```typescript
function buildSystemPromptWithContext(
  basePrompt: string,
  pinnedArtifacts: Artifact[]
): string {

  let prompt = basePrompt;

  if (pinnedArtifacts.length > 0) {
    prompt += "\n\n## Pinned Context\n\n";
    prompt += "The user has pinned the following artifacts for reference:\n\n";

    for (const artifact of pinnedArtifacts) {
      prompt += `### ${artifact.title} (${artifact.type})\n\n`;
      prompt += "```\n";
      prompt += artifact.content;
      prompt += "\n```\n\n";
    }
  }

  return prompt;
}
```

---

## Text Summarization and UI Formatting

### Overview

After sequential thinking completes, the LLM must format its output for the user. This is done using a special **response_formatter** tool that the LLM calls to structure its final response.

### The Response Formatter Tool

**Location**: `backend-mcp-client/src/services/chat/index.ts` (Lines 308-443)

**Purpose**: Transform the sequential thinking history into a structured user-facing response

**Tool Definition:**

```typescript
const responseFormatterTool = {
  name: "response_formatter",
  description: "Format your final response for the user. Call this tool when you have completed your thinking and are ready to respond.",
  input_schema: {
    type: "object",
    properties: {
      thinking: {
        type: "string",
        description: "Optional brief summary of your reasoning process (1-2 sentences)"
      },
      conversation: {
        type: "array",
        description: "Array of conversation items (text and/or artifacts)",
        items: {
          type: "object",
          properties: {
            type: {
              type: "string",
              enum: ["text", "artifact"],
              description: "Type of conversation item"
            },
            content: {
              type: "string",
              description: "For text: markdown content. For artifact: brief description."
            },
            artifact: {
              type: "object",
              description: "Required if type is 'artifact'",
              properties: {
                type: {
                  type: "string",
                  description: "Artifact type (code, image, knowledge-graph, etc.)"
                },
                title: {
                  type: "string",
                  description: "Descriptive title for the artifact"
                },
                content: {
                  type: "string",
                  description: "The actual artifact content"
                },
                language: {
                  type: "string",
                  description: "Programming language (for code artifacts only)"
                }
              },
              required: ["type", "title", "content"]
            }
          },
          required: ["type"]
        }
      }
    },
    required: ["conversation"]
  }
};
```

### Formatting Instructions to LLM

The system prompt includes detailed instructions (80+ lines) on how to use the formatter tool:

**Location**: `backend-mcp-client/src/services/chat/index.ts` (Lines 353-430)

```typescript
const formattingInstructions = `
## CRITICAL: Response Format Requirements

You MUST use the response_formatter tool to format your final response.

### Conversation Field Format

The "conversation" field MUST be an ARRAY of objects, NEVER a string.

✅ CORRECT:
{
  "conversation": [
    {
      "type": "text",
      "content": "Here is the answer..."
    }
  ]
}

❌ INCORRECT:
{
  "conversation": "Here is the answer..."
}

### Text Responses

For text content, use:
{
  "type": "text",
  "content": "Your markdown-formatted response"
}

### Artifact Responses

For generated content (code, graphs, etc.), use:
{
  "type": "artifact",
  "content": "Brief description of what this artifact contains",
  "artifact": {
    "type": "code",  // or "knowledge-graph", "image", etc.
    "title": "Descriptive Title",
    "content": "The actual code/data",
    "language": "javascript"  // for code only
  }
}

### Artifact Types

Supported artifact types:
- "code" or "application/vnd.ant.code" - Source code
- "application/vnd.knowledge-graph" - Knowledge graph (nodes + links)
- "image/png", "image/jpeg" - Images (base64 encoded)
- "text/markdown" - Formatted text
- "bibliography" - Citation list

### Multiple Items

You can include multiple items in the conversation array:

{
  "conversation": [
    {
      "type": "text",
      "content": "I found the following treatments:"
    },
    {
      "type": "artifact",
      "content": "Knowledge graph of treatment relationships",
      "artifact": {
        "type": "application/vnd.knowledge-graph",
        "title": "Diabetes Treatment Network",
        "content": "{\"nodes\": [...], \"links\": [...]}"
      }
    },
    {
      "type": "text",
      "content": "The most promising approach is..."
    }
  ]
}

### Validation Rules

1. conversation MUST be an array
2. conversation MUST have at least 1 item
3. Each item MUST have a "type" field ("text" or "artifact")
4. Text items MUST have "content"
5. Artifact items MUST have "artifact" object with type, title, and content
6. NEVER use an empty array: []
7. NEVER make conversation a string

### Common Mistakes to Avoid

❌ Empty array: {"conversation": []}
❌ String instead of array: {"conversation": "text"}
❌ Missing type: {"conversation": [{"content": "..."}]}
❌ Missing artifact object: {"conversation": [{"type": "artifact"}]}
`;
```

### Mode-Specific System Prompts

Different conversation modes use different system prompts:

**1. Normal Mode** (`normalModeSystemPrompt.ts`):

```typescript
export const normalModeSystemPrompt = `
You are a helpful AI assistant with access to external tools via MCP.

Your capabilities:
- Answer questions using your knowledge
- Call external tools for additional information
- Generate code, visualizations, and other artifacts
- Provide well-formatted markdown responses

When using tools:
- Call multiple tools if needed to gather information
- Synthesize information from multiple sources
- Cite sources when using external data

Always format your final response using the response_formatter tool.
`;
```

**2. Graph Mode** (`graphModeSystemPrompt.ts`):

```typescript
export const graphModeSystemPrompt = `
You are a knowledge graph building assistant.

Your primary task is to extract entities and relationships from data and create knowledge graphs.

Graph Structure:
{
  "nodes": [
    {
      "id": "unique-id",
      "label": "Entity Name",
      "type": "entity-type",
      "properties": {
        "key": "value"
      }
    }
  ],
  "links": [
    {
      "source": "node-id-1",
      "target": "node-id-2",
      "type": "relationship-type",
      "properties": {
        "key": "value"
      }
    }
  ]
}

When building graphs:
1. Extract meaningful entities (people, concepts, diseases, treatments, etc.)
2. Identify relationships between entities
3. Use consistent entity IDs across the conversation
4. Merge new entities with existing graph context
5. Provide clear node labels and relationship types

Tools available:
- graph-mode-mcp tools for reading/updating the database graph
- Other MCP tools for gathering source data

Always return graphs as artifacts with type "application/vnd.knowledge-graph".
`;
```

**3. Tool Calling Mode** (`systemPrompt_tools.ts`):

```typescript
export const toolCallingSystemPrompt = `
You are a tool-using assistant.

Available tools will be provided to you. Use them to:
- Search databases
- Fetch information
- Process data
- Generate content

When tools return results:
- Analyze the results carefully
- Combine information from multiple tool calls
- Provide a synthesized response
- Include citations when using external data

Always use the response_formatter tool for your final response.
`;
```

**Mode Detection** (Lines 336-341):

```typescript
async function selectSystemPrompt(conversationId: string): Promise<string> {
  // Check if this conversation is in graph mode
  const isGraphMode = await checkIfGraphModeConversation(conversationId);

  if (isGraphMode) {
    return graphModeSystemPrompt;
  } else {
    return normalModeSystemPrompt;
  }
}
```

### Response Extraction from LLM

Each LLM provider returns responses in different formats. Formatter adapters extract the structured output:

**Location**: `backend-mcp-client/src/services/chat/formatters/`

**Anthropic Formatter** (`anthropic.ts`):

```typescript
function extractFormatterOutput(response: AnthropicResponse): StoreFormat | null {

  // Find the response_formatter tool use block
  const formatterBlock = response.content.find(
    block => block.type === 'tool_use' && block.name === 'response_formatter'
  );

  if (!formatterBlock) return null;

  // Parse the input as structured data
  const formatterInput = formatterBlock.input;

  // Validate format
  if (!Array.isArray(formatterInput.conversation)) {
    throw new Error("Invalid format: conversation must be an array");
  }

  if (formatterInput.conversation.length === 0) {
    throw new Error("Invalid format: conversation cannot be empty");
  }

  // Validate each item has required fields
  for (const item of formatterInput.conversation) {
    if (!item.type) {
      throw new Error("Invalid format: each item must have a type field");
    }

    if (item.type === 'artifact' && !item.artifact) {
      throw new Error("Invalid format: artifact items must have artifact object");
    }
  }

  // Convert to StoreFormat
  return convertToStoreFormat(formatterInput);
}
```

**OpenAI Formatter** (`openai.ts`):

```typescript
function extractFormatterOutput(response: OpenAIResponse): StoreFormat | null {

  // Find function call
  const functionCall = response.choices[0]?.message?.function_call;

  if (!functionCall || functionCall.name !== 'response_formatter') {
    return null;
  }

  // Parse arguments (may be string or object)
  const args = typeof functionCall.arguments === 'string'
    ? JSON.parse(functionCall.arguments)
    : functionCall.arguments;

  // Validate and convert
  return convertToStoreFormat(args);
}
```

**Gemini Formatter** (`gemini.ts`):

```typescript
function extractFormatterOutput(response: GeminiResponse): StoreFormat | null {

  // Find function call in candidates
  const candidate = response.candidates[0];
  const functionCall = candidate?.content?.parts?.find(
    part => part.functionCall?.name === 'response_formatter'
  );

  if (!functionCall) return null;

  // Parse args (may be JSON string or object)
  const args = functionCall.functionCall.args;
  const parsed = typeof args === 'string' ? JSON.parse(args) : args;

  return convertToStoreFormat(parsed);
}
```

### Validation and Error Handling

**Method**: `validateResponseFormat()`

Before returning to the user, the response is validated:

```typescript
function validateResponseFormat(response: StoreFormat): boolean {

  // conversation must exist
  if (!response.conversation) {
    throw new Error("Response missing 'conversation' field");
  }

  // conversation must be array
  if (!Array.isArray(response.conversation)) {
    throw new Error("conversation must be an array, got: " + typeof response.conversation);
  }

  // conversation must not be empty
  if (response.conversation.length === 0) {
    throw new Error("conversation cannot be empty array");
  }

  // validate each item
  for (let i = 0; i < response.conversation.length; i++) {
    const item = response.conversation[i];

    // must have type
    if (!item.type) {
      throw new Error(`Item ${i} missing 'type' field`);
    }

    // type must be text or artifact
    if (item.type !== 'text' && item.type !== 'artifact') {
      throw new Error(`Item ${i} has invalid type: ${item.type}`);
    }

    // text items must have content
    if (item.type === 'text' && !item.content) {
      throw new Error(`Item ${i} is type 'text' but missing 'content'`);
    }

    // artifact items must have artifact object
    if (item.type === 'artifact') {
      if (!item.artifact) {
        throw new Error(`Item ${i} is type 'artifact' but missing 'artifact' object`);
      }

      // artifact must have required fields
      if (!item.artifact.type) {
        throw new Error(`Item ${i} artifact missing 'type'`);
      }
      if (!item.artifact.title) {
        throw new Error(`Item ${i} artifact missing 'title'`);
      }
      if (!item.artifact.content) {
        throw new Error(`Item ${i} artifact missing 'content'`);
      }
    }
  }

  return true;
}
```

If validation fails, the error message is sent back to the LLM with instructions to fix the format.

### Streaming Status Updates

During processing, status updates are streamed to the frontend via Server-Sent Events (SSE):

**Location**: `backend-mcp-client/src/routes/chat-sequential.ts`

```typescript
app.post('/api/chat-sequential', async (req, res) => {

  // Set up SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  // Status handler
  const sendStatus = (status: string) => {
    res.write(`data: ${JSON.stringify({ type: 'status', status })}\n\n`);
  };

  try {
    // Process chat with status updates
    sendStatus('Initializing...');

    const result = await chatService.processChat(
      message,
      history,
      {
        ...options,
        statusHandler: sendStatus
      }
    );

    // Send final result
    res.write(`data: ${JSON.stringify({ type: 'result', data: result })}\n\n`);
    res.end();

  } catch (error) {
    sendStatus('Error: ' + error.message);
    res.end();
  }
});
```

**Status Messages During Processing:**
- "Initializing..."
- "Discovering available tools..."
- "Starting sequential thinking..."
- "Thinking step 1 of 5..."
- "Calling tool: pubtator-search_pubmed"
- "Processing tool results..."
- "Thinking step 2 of 5..."
- "Formatting final response..."
- "Collecting artifacts..."
- "Complete"

### Frontend Display

**Location**: `frontend-client/src/components/chat/ChatMessages.tsx`

The frontend renders messages with embedded artifacts:

```typescript
function ChatMessage({ message }: { message: Message }) {

  // Get artifacts for this message
  const artifacts = getMessageArtifacts(message);

  return (
    <div className="chat-message">

      {/* Thinking section (optional) */}
      {message.thinking && (
        <div className="thinking-section">
          <details>
            <summary>View reasoning process</summary>
            <div>{message.thinking}</div>
          </details>
        </div>
      )}

      {/* Main content */}
      <div className="message-content">
        <ReactMarkdown>
          {message.content}
        </ReactMarkdown>
      </div>

      {/* Artifact buttons */}
      {artifacts.map(artifact => (
        <button
          key={artifact.id}
          onClick={() => openArtifact(artifact.id)}
          className="artifact-button"
        >
          View {artifact.title}
        </button>
      ))}

    </div>
  );
}
```

---

## Complete Data Flow

### End-to-End Request Flow

```
┌────────────────────────────────────────────────────────────────┐
│ 1. USER INTERACTION                                            │
│    User types message in chat input and clicks send           │
└────────────────────────┬───────────────────────────────────────┘
                         │
                         ▼
┌────────────────────────────────────────────────────────────────┐
│ 2. FRONTEND (ChatInput.tsx)                                    │
│    - Collect message, history, pinned artifacts               │
│    - Prepare request body                                      │
│    - POST to /api/chat-artifacts                              │
└────────────────────────┬───────────────────────────────────────┘
                         │
                         ▼
┌────────────────────────────────────────────────────────────────┐
│ 3. BACKEND ROUTE (chat-artifacts.ts)                           │
│    - Extract conversationId (or create new)                   │
│    - Parse request body                                        │
│    - Get ChatService from app.locals                          │
│    - Call chatService.processChat()                           │
└────────────────────────┬───────────────────────────────────────┘
                         │
                         ▼
┌────────────────────────────────────────────────────────────────┐
│ 4. CHATSERVICE.processChat() (chat/index.ts)                   │
│    - Set LLM provider (Anthropic, OpenAI, etc.)               │
│    - Get all available MCP tools                              │
│    - Apply filtering (blockedServers, enabledTools)           │
│    - Call executeProcessChat()                                │
└────────────────────────┬───────────────────────────────────────┘
                         │
                         ▼
┌────────────────────────────────────────────────────────────────┐
│ 5. CHATSERVICE.executeProcessChat()                            │
│    - Build system prompt (mode-specific)                      │
│    - Add pinned artifacts to context                          │
│    - Call runSequentialThinking()                             │
└────────────────────────┬───────────────────────────────────────┘
                         │
                         ▼
┌────────────────────────────────────────────────────────────────┐
│ 6. SEQUENTIAL THINKING LOOP                                    │
│                                                                │
│    ┌──────────────────────────────────────┐                   │
│    │ Iteration 1                          │                   │
│    │ ├─ Format message history            │                   │
│    │ ├─ Send to LLM with tools            │                   │
│    │ ├─ Receive response                  │                   │
│    │ └─ Contains tool_use?                │                   │
│    │    ├─ YES: Execute tool via MCP      │                   │
│    │    │  └─ Add result to history       │                   │
│    │    └─ NO: Mark as complete           │                   │
│    └──────────────┬───────────────────────┘                   │
│                   │                                            │
│    ┌──────────────▼───────────────────────┐                   │
│    │ Iteration 2 (if needed)              │                   │
│    │ ├─ Update history with tool results │                   │
│    │ ├─ Send to LLM again                 │                   │
│    │ └─ ...                               │                   │
│    └──────────────┬───────────────────────┘                   │
│                   │                                            │
│    (Continues up to 5 iterations)                             │
│                   │                                            │
│    ┌──────────────▼───────────────────────┐                   │
│    │ Final Iteration                      │                   │
│    │ ├─ LLM calls response_formatter      │                   │
│    │ └─ Structured output returned        │                   │
│    └──────────────┬───────────────────────┘                   │
│                   │                                            │
└───────────────────┼────────────────────────────────────────────┘
                    │
                    ▼
┌────────────────────────────────────────────────────────────────┐
│ 7. TOOL EXECUTION (when tool_use detected)                     │
│                                                                │
│    For each tool call:                                        │
│    ├─ Extract tool name: "pubtator-search_pubmed"            │
│    ├─ Resolve to original: "pubtator:search_pubmed"          │
│    ├─ Parse: server="pubtator", tool="search_pubmed"         │
│    ├─ Add graph context if needed (graph-mode-mcp)           │
│    ├─ Call: mcpService.callTool(server, tool, args)          │
│    ├─ Get result: {content, bibliography, artifacts}         │
│    └─ Add tool_result to conversation history                │
│                                                                │
└────────────────────────┬───────────────────────────────────────┘
                         │
                         ▼
┌────────────────────────────────────────────────────────────────┐
│ 8. MCP TOOL EXECUTION (mcp.ts)                                 │
│    - Get MCP client for server                                │
│    - Send tool call over stdio transport                      │
│    - Wait for response                                        │
│    - Return: MCPToolResult                                    │
└────────────────────────┬───────────────────────────────────────┘
                         │
                         ▼
┌────────────────────────────────────────────────────────────────┐
│ 9. RESPONSE FORMATTING                                         │
│    - Extract response_formatter tool output                   │
│    - Get provider-specific formatter adapter                  │
│    - Parse structured response                                │
│    - Validate format (conversation must be array, etc.)       │
│    - Convert to StoreFormat                                   │
└────────────────────────┬───────────────────────────────────────┘
                         │
                         ▼
┌────────────────────────────────────────────────────────────────┐
│ 10. ARTIFACT PROCESSING                                        │
│     - Extract all artifacts from response                     │
│     - Validate artifact types                                 │
│     - Normalize types (code, knowledge-graph, etc.)           │
│     - Assign unique IDs                                       │
│     - Store in database via Prisma                            │
│     - Create artifact buttons in conversation HTML            │
└────────────────────────┬───────────────────────────────────────┘
                         │
                         ▼
┌────────────────────────────────────────────────────────────────┐
│ 11. DATABASE STORAGE (database.ts + Prisma)                    │
│     - Save conversation if new                                │
│     - Save message with content                               │
│     - Save artifacts with metadata                            │
│     - Link artifacts to message and conversation              │
└────────────────────────┬───────────────────────────────────────┘
                         │
                         ▼
┌────────────────────────────────────────────────────────────────┐
│ 12. RESPONSE SENT TO FRONTEND                                  │
│     - Stream status updates via SSE during processing         │
│     - Send final StoreFormat as JSON                          │
│     - Close connection                                        │
└────────────────────────┬───────────────────────────────────────┘
                         │
                         ▼
┌────────────────────────────────────────────────────────────────┐
│ 13. FRONTEND DISPLAY (ChatMessages.tsx)                        │
│     - Receive streamed status updates                         │
│     - Update UI with progress indicators                      │
│     - Receive final response                                  │
│     - Parse message content (markdown)                        │
│     - Extract artifact buttons                                │
│     - Render message with ReactMarkdown                       │
│     - Display artifact buttons                                │
└────────────────────────┬───────────────────────────────────────┘
                         │
                         ▼
┌────────────────────────────────────────────────────────────────┐
│ 14. ARTIFACT DISPLAY (ArtifactWindow.tsx)                      │
│     - User clicks artifact button                             │
│     - Retrieve artifact by ID                                 │
│     - Determine artifact type                                 │
│     - Render with appropriate viewer:                         │
│       ├─ CodeEditorView (code)                               │
│       ├─ KnowledgeGraphViewer (graphs)                        │
│       ├─ ImageViewer (images)                                │
│       └─ MarkdownRenderer (text)                             │
└────────────────────────────────────────────────────────────────┘
```

### Tool Call Flow (Detailed)

```
LLM decides to call tool: "pubtator-search_pubmed"
                         │
                         ▼
        ┌────────────────────────────────┐
        │ Anthropic Response Contains:   │
        │ {                              │
        │   type: "tool_use",            │
        │   id: "toolu_01A1B2C3",        │
        │   name: "pubtator-search...",  │
        │   input: {                     │
        │     query: "diabetes"          │
        │   }                            │
        │ }                              │
        └────────────┬───────────────────┘
                     │
                     ▼
        ┌────────────────────────────────┐
        │ Extract Tool Call Details      │
        │ - name: "pubtator-search_..."  │
        │ - args: {query: "diabetes"}    │
        │ - id: "toolu_01A1B2C3"         │
        └────────────┬───────────────────┘
                     │
                     ▼
        ┌────────────────────────────────┐
        │ Resolve Tool Name              │
        │ getOriginalToolName()          │
        │ "pubtator-search_pubmed"       │
        │           ↓                    │
        │ "pubtator:search_pubmed"       │
        └────────────┬───────────────────┘
                     │
                     ▼
        ┌────────────────────────────────┐
        │ Parse Server and Tool          │
        │ Split on ':'                   │
        │ server = "pubtator"            │
        │ tool = "search_pubmed"         │
        └────────────┬───────────────────┘
                     │
                     ▼
        ┌────────────────────────────────┐
        │ Check for Graph Mode           │
        │ if server === 'graph-mode-mcp' │
        │   Add databaseContext:         │
        │   - conversationId             │
        │   - apiBaseUrl                 │
        │   - accessToken                │
        └────────────┬───────────────────┘
                     │
                     ▼
        ┌────────────────────────────────┐
        │ Call MCP Service               │
        │ mcpService.callTool(           │
        │   "pubtator",                  │
        │   "search_pubmed",             │
        │   {query: "diabetes"}          │
        │ )                              │
        └────────────┬───────────────────┘
                     │
                     ▼
        ┌────────────────────────────────┐
        │ MCP Client Sends Request       │
        │ via stdio to external process: │
        │                                │
        │ {                              │
        │   jsonrpc: "2.0",              │
        │   method: "tools/call",        │
        │   params: {                    │
        │     name: "search_pubmed",     │
        │     arguments: {               │
        │       query: "diabetes"        │
        │     }                          │
        │   }                            │
        │ }                              │
        └────────────┬───────────────────┘
                     │
                     ▼
        ┌────────────────────────────────┐
        │ External MCP Server            │
        │ (pubtator-mcp process)         │
        │                                │
        │ 1. Receives JSON-RPC request   │
        │ 2. Executes search_pubmed()    │
        │ 3. Calls PubMed API            │
        │ 4. Processes results           │
        │ 5. Returns MCP response        │
        └────────────┬───────────────────┘
                     │
                     ▼
        ┌────────────────────────────────┐
        │ MCP Response Received          │
        │ {                              │
        │   content: [                   │
        │     {                          │
        │       type: "text",            │
        │       text: "Found 10 papers"  │
        │     }                          │
        │   ],                           │
        │   bibliography: [...],         │
        │   artifacts: [...]             │
        │ }                              │
        └────────────┬───────────────────┘
                     │
                     ▼
        ┌────────────────────────────────┐
        │ Process MCP Response           │
        │ - Extract text content         │
        │ - Extract bibliography         │
        │ - Extract artifacts            │
        └────────────┬───────────────────┘
                     │
                     ▼
        ┌────────────────────────────────┐
        │ Add to Conversation History    │
        │ {                              │
        │   role: "user",                │
        │   content: [                   │
        │     {                          │
        │       type: "tool_result",     │
        │       tool_use_id: "toolu...", │
        │       content: [...]           │
        │     }                          │
        │   ]                            │
        │ }                              │
        └────────────┬───────────────────┘
                     │
                     ▼
        ┌────────────────────────────────┐
        │ Continue Sequential Thinking   │
        │ Send updated history to LLM    │
        │ for next iteration             │
        └────────────────────────────────┘
```

---

## Key Configuration

### MCP Server Configuration

**File**: `backend-mcp-client/config/mcp_server_config.json`

```json
{
  "mcpServers": {
    "pubtator": {
      "command": "node",
      "args": [
        "../custom-mcp-servers/graphModeMCPs/graphmodePubTatorMCP/dist/index.js"
      ],
      "timeout": 60000
    },
    "kappa": {
      "command": "node",
      "args": [
        "../custom-mcp-servers/kappa-mcp/dist/index.js"
      ],
      "timeout": 60000
    },
    "graph-mode-mcp": {
      "command": "node",
      "args": [
        "../custom-mcp-servers/graphModeMCPs/graph-mode-mcp/dist/index.js"
      ],
      "timeout": 30000
    },
    "clinical-trial": {
      "command": "node",
      "args": [
        "../custom-mcp-servers/clinicalTrialGov-mcp/dist/index.js"
      ],
      "timeout": 60000
    }
  }
}
```

### Environment Variables

**File**: `backend-mcp-client/.env`

```bash
# Database
DATABASE_URL="file:./prisma/dev.db"

# API Configuration
PORT=3001
API_BASE_URL="http://localhost:3001"

# LLM Provider Keys
ANTHROPIC_API_KEY="sk-ant-..."
OPENAI_API_KEY="sk-..."
GOOGLE_API_KEY="AIza..."
GOOGLE_CLOUD_PROJECT="project-id"

# PubMed / NCBI
NCBI_API_KEY="your-ncbi-api-key"
NCBI_TOOL_EMAIL="your-email@example.com"

# Vertex AI (optional)
GOOGLE_APPLICATION_CREDENTIALS="/path/to/service-account.json"
```

### Sequential Thinking Parameters

```typescript
// Maximum thinking iterations
MAX_THINKING_STEPS = 5

// Retry configuration
MAX_RETRIES = 3
RETRY_BACKOFF = min(1000 * 2^(attempt-1), 5000)  // milliseconds

// Temperature adjustment on retry
temperature = attempt > 1 ? temperature * 0.8 : temperature

// Max tokens adjustment on retry
maxTokens = attempt > 1 ? min(2000, maxTokens) : maxTokens
```

### LLM Provider Models

**Anthropic:**
- Default: `claude-haiku-4-5`
- Vertex AI: `claude-haiku-4-5`

**OpenAI:**
- Default: `gpt-4-turbo-preview`

**Gemini:**
- Default: `gemini-2.5-flash`
- Vertex AI: `gemini-2.0-flash-exp`

**Ollama:**
- Default: `llama3.2:latest`

---

## Future Adaptation Considerations

### Architecture Strengths

The current system has several strengths that make it adaptable for future enhancements:

**1. Provider Agnostic Design**
- Adapter pattern allows easy addition of new LLM providers
- To add a new provider, create adapter in `/adapters/` and `/formatters/`

**2. Modular MCP Integration**
- MCP servers are independent processes
- Can add new tools without modifying core code
- Tool discovery is automatic

**3. Flexible Artifact System**
- Type normalization allows for new artifact types
- Frontend components can be extended for new visualizations
- Storage is schema-less (JSON content field)

**4. Sequential Thinking Framework**
- Loop-based thinking is provider-independent
- Can adjust iteration limits per use case
- Supports streaming for real-time feedback

### Potential Adaptations

**1. Multi-Agent Systems**
- Current: Single LLM with tools
- Future: Multiple specialized agents collaborating
- Implementation: Create agent registry, message routing between agents
- Key files to modify:
  - `chat/index.ts` - Add agent orchestration
  - Create `/services/agents/` directory
  - Add agent-to-agent communication protocol

**2. Long-Context Reasoning**
- Current: 5 iteration limit
- Future: Extended thinking with summarization
- Implementation: Add intermediate summarization steps
- Key files to modify:
  - `chat/index.ts` - Add summarization between iterations
  - Create summarization tool or use LLM
  - Store condensed thinking history

**3. Parallel Tool Execution**
- Current: Sequential tool calls
- Future: Execute independent tools in parallel
- Implementation: Detect independent tools, use Promise.all()
- Key files to modify:
  - `chat/index.ts` - Add dependency analysis
  - `mcp.ts` - Support batch tool execution

**4. Persistent Knowledge Graphs**
- Current: Knowledge graphs per conversation
- Future: Global knowledge base across conversations
- Implementation: Shared graph database, merge strategies
- Key files to modify:
  - `database.ts` - Add global graph tables
  - `graphModeSystemPrompt.ts` - Update instructions
  - Create graph merge service

**5. Custom Artifact Types**
- Current: Predefined types (code, graph, image, etc.)
- Future: User-defined artifact types with custom renderers
- Implementation: Plugin system for artifact viewers
- Key files to modify:
  - `ArtifactWindow.tsx` - Add plugin loader
  - Create artifact plugin registry
  - Add artifact schema validation

**6. Response Caching**
- Current: No caching of LLM responses
- Future: Cache common queries, tool results
- Implementation: Add Redis or in-memory cache
- Key files to modify:
  - `llm/cache.ts` - Expand caching logic
  - `mcp.ts` - Add tool result caching
  - Consider cache invalidation strategies

**7. Streaming Artifacts**
- Current: Artifacts created at end of thinking
- Future: Stream artifact updates during generation
- Implementation: WebSocket for real-time updates
- Key files to modify:
  - `chat-sequential.ts` - Add WebSocket support
  - Frontend: Subscribe to artifact updates
  - Add partial artifact rendering

**8. Tool Learning**
- Current: Static tool definitions
- Future: LLM learns which tools work best
- Implementation: Track tool success rates, preference learning
- Key files to modify:
  - Create tool analytics service
  - Add tool recommendation system
  - Update tool selection logic

### Extension Points

**Key Extension Points in Current Architecture:**

1. **`/services/chat/adapters/`** - Add new LLM provider support
2. **`/services/chat/formatters/`** - Add new response format parsers
3. **`/services/mcp.ts`** - Modify tool discovery and execution
4. **`config/mcp_server_config.json`** - Add new MCP servers
5. **`/components/artifacts/`** - Add new artifact viewers
6. **System prompts** - Customize LLM behavior per mode

### Migration Strategies

**If adapting for new use cases:**

1. **Research Assistant → Medical Diagnosis System**
   - Add medical-specific MCP servers
   - Update system prompt with medical guidelines
   - Add HIPAA compliance logging
   - Create medical artifact types (lab results, imaging)

2. **Chat System → Code IDE Integration**
   - Add file system MCP tools
   - Create code execution sandbox
   - Add code testing and linting tools
   - Stream code changes for real-time collaboration

3. **Single User → Multi-User Collaboration**
   - Add user authentication and permissions
   - Create shared conversation spaces
   - Add real-time collaboration via WebSockets
   - Implement conversation access control

---

## Summary

The Charm MCP system is a sophisticated LLM orchestration platform with the following key characteristics:

### Core Features
1. **Sequential Thinking**: Iterative reasoning loop (up to 5 iterations) enabling complex multi-step problem solving
2. **MCP Tool Integration**: Standardized protocol for connecting external tools to LLM conversations
3. **Artifact System**: Structured content generation with type-specific rendering
4. **Multi-Provider Support**: Works with Anthropic, OpenAI, Gemini, and Ollama
5. **Response Formatting**: Special tool for structured output generation

### Data Flow
```
User Message → Sequential Thinking Loop → Tool Calls → MCP Execution →
Response Formatting → Artifact Processing → Database Storage → UI Display
```

### Key Innovation
The **response_formatter** tool creates a clean separation between:
- Internal reasoning (sequential thinking with tools)
- User-facing output (structured, formatted, with artifacts)

This architecture enables:
- Complex reasoning without exposing intermediate steps
- Consistent response formatting across providers
- Rich artifact generation (code, graphs, images)
- Extensibility for new tools and artifact types

---

## Additional Documentation

For more detailed information, see:
- **MCP_ARCHITECTURE_GUIDE.md** - Complete architecture reference (863 lines)
- **IMPLEMENTATION_DETAILS.md** - Developer quick reference with file paths and line numbers
- **ARCHITECTURE_DIAGRAM.md** - Visual flow diagrams (7 detailed ASCII diagrams)
- **DOCUMENTATION_INDEX.md** - Navigation guide and quick start by role

---

**Document Created**: November 8, 2024
**Version**: 1.0
**Codebase Branch**: kappa-writer-mcp-work
**Author**: Claude Code (Automated Documentation System)
