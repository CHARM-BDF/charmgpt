# Charm MCP System: Comprehensive Architecture Analysis

## Executive Summary

This is a comprehensive analysis of how the **Charm MCP (Model Context Protocol)** system works, including consecutive thinking, LLM tool calling, response processing, artifact handling, and text formatting. The system is built using TypeScript with Express.js backend and React frontend, supporting multiple LLM providers (Anthropic, OpenAI, Gemini, Ollama).

---

## 1. CONSECUTIVE THINKING & SEQUENTIAL THINKING

### Overview
The system implements **sequential thinking** as a mechanism for iterative reasoning before generating final responses. This is distinct from traditional "consecutive thinking" but serves a similar purpose of breaking down complex problems into steps.

### Key Implementation Files

#### 1.1 Chat Sequential Route
**File:** `/backend-mcp-client/src/routes/chat-sequential.ts`
- Provides dedicated endpoint at `/api/chat-sequential`
- Streams responses using Server-Sent Events (SSE) pattern
- Wraps ChatService's `processChatWithSequentialThinking()` method

**Data Flow:**
```
POST /api/chat-sequential
  → ChatService.processChatWithSequentialThinking()
    → Streaming response with status updates
```

#### 1.2 ChatService Core Logic
**File:** `/backend-mcp-client/src/services/chat/index.ts` (Lines 1042-1040)

**Core Method: `executeSequentialThinking()`**
```typescript
private async executeSequentialThinking(
  message: string,
  history: ChatMessage[],
  mcpTools: AnthropicTool[],
  modelProvider: ModelType,
  options: {...},
  statusHandler?: (status: string) => void,
  toolExecutions: Array<{name: string; description: string}> = []
): Promise<any[]>
```

**Sequential Thinking Loop (Lines 1251-1400+):**

The loop runs up to `MAX_THINKING_STEPS = 5` iterations:

1. **Get LLM Response with Tools** (Line 1347)
   - Formats message history for provider
   - Sends system prompt with tool definitions
   - Gets response with potential tool calls

2. **Process Tool Results** (Lines 1400+)
   - If LLM calls a tool, execute it via MCP
   - Add result to conversation history
   - Continue loop unless thinking is complete

3. **Termination Conditions:**
   - LLM explicitly says thinking is complete
   - No new tools are called (no progress)
   - Maximum thinking steps reached
   - Error occurs

**Key Loop Variables (Lines 1200-1230):**
- `isSequentialThinkingComplete`: Boolean flag
- `thinkingSteps`: Step counter (0-5)
- `previousToolCalls`: Set tracking repeated calls
- `consecutiveNoProgressSteps`: Counter for stalled thinking
- `sessionToolCalls`: Historical calls from conversation

**Session-Level Tool Call Caching (Lines 1225-1233):**
- Extracts historical tool calls from conversation
- Prevents LLM from repeatedly calling same tools
- Encourages exploration of new approaches

### 1.3 Retry Logic with Exponential Backoff
**File:** `/backend-mcp-client/src/services/chat/index.ts` (Lines 964-1040)

Method: `runSequentialThinking()` wraps `executeSequentialThinking()` with retry logic:

```typescript
MAX_RETRIES = 3
For attempt 1 to 3:
  - If success: return result
  - If fail:
    - Adjust temperature: attempt > 1 ? temp * 0.8 : temp
    - Adjust maxTokens: attempt > 1 ? min(2000, maxTokens) : maxTokens
    - Wait: min(1000 * 2^(attempt-1), 5000)ms
```

---

## 2. MCP TOOL CALLING BY LLM

### Overview
The system connects LLMs with MCP tools through a sophisticated adapter pattern that bridges provider-specific formats.

### 2.1 Tool Registration & Discovery

**File:** `/backend-mcp-client/src/services/mcp.ts`

**Core Method: `getAllAvailableTools()` (Lines 262-456)**

1. **Server Discovery:**
   - Iterates through all MCP server clients
   - Calls `listTools()` on each client
   - Filters based on `blockedServers` and `enabledTools`

2. **Tool Name Mapping (Lines 366-375):**
   - Original: `${serverName}:${toolName}`
   - Anthropic format: `${serverName}-${toolName}`
   - Stores mapping for later resolution
   ```
   Example: pubtator:search_pubmed → pubtator-search_pubmed
   ```

3. **Schema Resolution (Lines 376-400):**
   - Resolves `$ref` references in JSON schemas
   - Handles `$defs` component definitions
   - Creates complete schema with all properties

4. **Tool Filtering:**
   - Removes `sequential-thinking` tools to prevent loops (Line 1128)
   - Respects `blockedServers` array (exact string matching)
   - Applies `enabledTools` filter per server

**Output Format:**
```typescript
interface AnthropicTool {
  name: string;           // e.g., "pubtator-search_pubmed"
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}
```

### 2.2 Tool Definition Conversion

**Adapter Pattern:** `/backend-mcp-client/src/services/chat/adapters/`

Each provider gets its own adapter implementing `ToolCallAdapter`:

**File:** `/backend-mcp-client/src/services/chat/adapters/index.ts`
```typescript
function getToolCallAdapter(provider: ToolAdapterType): ToolCallAdapter
```

**Supported Providers:**
- Anthropic: `/adapters/anthropic.ts`
- OpenAI: `/adapters/openai.ts`
- Gemini: `/adapters/gemini.ts`
- Ollama: `/adapters/ollama.ts`

**Adapter Responsibilities:**
1. Convert MCP tool definitions to provider format
2. Extract tool calls from provider responses
3. Execute tool via `callTool()`
4. Format tool results back to conversation

### 2.3 Tool Execution Flow

**File:** `/backend-mcp-client/src/routes/chat.ts` (Lines 409-487)

**Step-by-Step Execution:**

```
1. LLM Response Received
   ↓
2. Check for tool_use content blocks
   ↓
3. Extract anthropic tool name: content.name
   ↓
4. Resolve to original name:
   getOriginalToolName(anthropicName)
   → "pubtator:search_pubmed"
   ↓
5. Parse serverName and toolName
   → ["pubtator", "search_pubmed"]
   ↓
6. Special handling for Graph Mode MCPs (Lines 445-477)
   - Add databaseContext to arguments
   - Include conversationId, apiBaseUrl, accessToken
   ↓
7. Execute tool:
   mcpService.callTool(serverName, toolName, arguments)
   ↓
8. Get tool result
   → {content, bibliography, artifacts}
   ↓
9. Add tool result to conversation
```

**Graph Mode Special Handling:**
When `serverName === 'graph-mode-mcp'`:
- Adds `databaseContext` with:
  - `conversationId`
  - `apiBaseUrl` (from env or localhost:3001)
  - `accessToken`

### 2.4 Tool Logging System

**File:** `/backend-mcp-client/src/routes/chat.ts` (Lines 49-90)

Tool calling creates detailed logs:
```
toolcall-${timestamp}.log
```

Sections logged:
- `SESSION_START`: New request metadata
- `TOOLS_AVAILABLE`: List of available tools
- `CALLING_CLAUDE`: Request to LLM with tools
- `CLAUDE_RESPONSE`: Raw response from LLM
- `TOOL_CALL_DETECTED`: Tool use detected in response
- `TOOL_CALL_MAPPED`: Original name resolved
- `MCP_RESPONSE`: Result from MCP tool execution

---

## 3. MCP RESPONSE PROCESSING

### 3.1 Response Flow

**Architecture:**
```
MCP Server
   ↓
MCPService.callTool()
   ↓
Process ToolResult
   ↓
Extract Components:
   - content (text)
   - bibliography (citations)
   - artifacts (generated items)
   ↓
Add to Conversation History
```

### 3.2 Response Extraction

**File:** `/backend-mcp-client/src/services/mcp.ts`

**Method: `callTool()` (Lines 516-526)**
```typescript
async callTool(serverName: string, toolName: string, args: Record<string, unknown>) {
  const client = this.mcpClients.get(serverName);
  return await client.callTool({
    name: toolName,
    arguments: args
  });
}
```

Returns raw MCP response with structure:
```typescript
{
  content: Array<{type, text}>,
  bibliography?: any[],
  artifacts?: any[]
}
```

### 3.3 Parsing & Validation

**File:** `/backend-mcp-client/src/services/message.ts` (Lines 93-166)

**Method: `convertToStoreFormat()`**

Converts tool response to internal format:
```typescript
interface StoreFormat {
  thinking?: string;
  conversation: string | Array<{type, content?, artifact?}>;
  artifacts?: Array<{id, type, title, content, position, language?}>;
}
```

**Parsing Steps:**
1. Iterate through `conversation` array items
2. If type is `'text'`:
   - Extract text content
   - Check for binary output metadata
   - Create artifact buttons
3. If type is `'artifact'`:
   - Create artifact with unique ID
   - Store in artifacts array
   - Add button to conversation

### 3.4 Artifact Processing

**File:** `/backend-mcp-client/src/services/artifact.ts`

**Key Methods:**
- `validateArtifactType()`: Normalizes type strings
- `processBinaryOutput()`: Handles image/binary artifacts
- `isBinaryType()`: Checks if type is binary
- `getLanguageFromType()`: Extracts language from type

**Type Normalization:**
```
application/vnd.ant.code       → code
code/javascript                → code
application/vnd.ant.python     → code
image/png                       → image/png (preserved)
application/vnd.knowledge-graph → knowledge-graph
text (or empty)                → text/markdown
```

---

## 4. ARTIFACT HANDLING

### 4.1 Artifact Storage & Lifecycle

**Database:** SQLite via Prisma (dev.db)

**Schema Includes:**
- Artifact type
- Title and content
- Metadata (language, binary type, etc.)
- Position in conversation
- Creation timestamp

### 4.2 Frontend Artifact Display

**File:** `/frontend-client/src/components/chat/ChatMessages.tsx` (Lines 65-125)

**Method: `getMessageArtifacts()`**

Multi-step artifact retrieval:

1. **Direct Link:** Check message's `artifactId`
2. **Multiple Artifacts:** Check `artifactIds` array
3. **Reference Lookup:** Find artifacts referencing message
4. **Button Extraction:** Parse artifact buttons from HTML

**Normalization (Lines 70-82):**
- Ensures knowledge graph types are consistent
- Converts various KG formats to `application/vnd.knowledge-graph`

### 4.3 Artifact Components

**File:** `/frontend-client/src/components/artifacts/ArtifactWindow.tsx`

Renders different artifact types:
- **Code:** CodeEditorView with syntax highlighting
- **Markdown:** Rendered markdown
- **Knowledge Graph:** ReagraphKnowledgeGraphViewer or KnowledgeGraphViewer
- **Images:** Direct image display
- **Bibliography:** List of citations

### 4.4 Artifact Selection & Persistence

**Store:** `/frontend-client/src/store/chatStore.ts`

**Methods:**
- `selectArtifact(id)`: Open specific artifact
- `createArtifactFromAttachment()`: Convert file to artifact
- `updateArtifact()`: Modify artifact content
- `deleteArtifact()`: Remove artifact

---

## 5. TEXT SUMMARIZATION & FORMATTING

### 5.1 Response Formatter Tool

**Purpose:** Transform sequential thinking output into structured response

**File:** `/backend-mcp-client/src/services/chat/index.ts` (Lines 308-443)

**The Formatter Tool Definition:**
```typescript
interface ResponseFormatterTool {
  type: "tool";
  name: "response_formatter";
  input: {
    thinking?: string;
    conversation: Array<{
      type: "text" | "artifact";
      content?: string;
      artifact?: {
        type: string;
        title: string;
        content: string;
        language?: string;
      };
    }>;
  };
}
```

### 5.2 System Prompt Engineering

**Different Prompts for Different Modes:**

1. **Normal Mode** (standard chat):
   File: `/backend-mcp-client/src/services/chat/normalModeSystemPrompt.ts`

2. **Graph Mode** (knowledge graph building):
   File: `/backend-mcp-client/src/services/chat/graphModeSystemPrompt.ts`

3. **Tool Calling Mode**:
   File: `/backend-mcp-client/src/services/chat/systemPrompt_tools.ts`

**Mode Detection (Lines 336-341):**
```typescript
const isGraphMode = await this.checkIfGraphModeConversation(conversationId);
const basePrompt = isGraphMode ? graphModeSystemPrompt : normalModeSystemPrompt;
```

### 5.3 Formatting Instructions

**File:** `/backend-mcp-client/src/services/chat/index.ts` (Lines 353-430)

**Critical Instructions to LLM:**

1. **Conversation Field Format:**
   - MUST be array of objects
   - NEVER a string
   - Each object MUST have `type` field ("text" or "artifact")
   - ALWAYS at least one item

2. **Text Response:**
   ```json
   {
     "type": "text",
     "content": "Response in markdown format"
   }
   ```

3. **Artifact Response:**
   ```json
   {
     "type": "artifact",
     "content": "Brief description",
     "artifact": {
       "type": "application/vnd.ant.code",
       "title": "Descriptive title",
       "content": "Actual content",
       "language": "javascript"
     }
   }
   ```

4. **What NOT to Do:**
   - ❌ `{conversation: "text string"}`
   - ❌ `{conversation: []}`
   - ❌ `{conversation: [{content: "..."}]}` (missing type)

### 5.4 Response Extraction & Conversion

**File:** `/backend-mcp-client/src/services/chat/formatters/`

Each provider has a formatter adapter:

**Key Methods:**
- `extractFormatterOutput()`: Parse tool response
- `convertToStoreFormat()`: Convert to internal format

**Anthropic Formatter** (`anthropic.ts`):
- Extracts tool_use block with name "response_formatter"
- Parses input as JSON
- Returns as StoreFormat

**OpenAI Formatter** (`openai.ts`):
- Finds function call with name "response_formatter"
- Parses function arguments as JSON
- Converts to StoreFormat

**Gemini Formatter** (`gemini.ts`):
- Extracts functionCall with name "response_formatter"
- Parses args as JSON string or object
- Returns StoreFormat

---

## 6. GENERAL ARCHITECTURE

### 6.1 Directory Structure

```
backend-mcp-client/
├── src/
│   ├── index.ts                  # Express server entry point
│   ├── systemPrompt.ts           # Default system prompt
│   ├── services/
│   │   ├── mcp.ts                # MCP client management
│   │   ├── llm/                  # LLM provider abstraction
│   │   │   ├── index.ts          # LLM service
│   │   │   ├── providers/        # Provider implementations
│   │   │   ├── adapters/         # Tool calling adapters
│   │   │   └── cache.ts          # Response caching
│   │   ├── chat/                 # Chat service
│   │   │   ├── index.ts          # Main chat service
│   │   │   ├── adapters/         # Tool adapters per provider
│   │   │   ├── formatters/       # Response formatters per provider
│   │   │   └── *SystemPrompt.ts  # Mode-specific prompts
│   │   ├── message.ts            # Message formatting
│   │   ├── artifact.ts           # Artifact processing
│   │   ├── database.ts           # Prisma database service
│   │   └── logging.ts            # Logging service
│   ├── routes/
│   │   ├── chat.ts               # Main chat endpoint
│   │   ├── chat-sequential.ts    # Sequential thinking endpoint
│   │   ├── chat-artifacts.ts     # Artifacts endpoint
│   │   ├── chat-basic.ts         # Basic chat (no tools)
│   │   ├── chat-tools.ts         # Tools only (no sequential thinking)
│   │   └── [other routes]
│   ├── types/
│   │   └── mcp.ts                # MCP type definitions
│   └── utils/
│       └── knowledgeGraphUtils.ts # Graph utilities
├── config/
│   └── mcp_server_config.json     # MCP servers configuration
└── prisma/
    ├── schema.prisma             # Database schema
    └── dev.db                     # SQLite database
```

### 6.2 Key Components

#### MCPService (mcp.ts)
**Responsibilities:**
- Initialize MCP server connections
- Maintain client pool
- Handle tool discovery and execution
- Process MCP notifications (logging)
- Tool name mapping (MCP ↔ Anthropic format)

**Key Methods:**
- `initializeServers()`: Connect to all MCP servers
- `getAllAvailableTools()`: Get available tools with filtering
- `callTool()`: Execute tool on MCP server
- `addLogHandler()`: Register log message handlers
- `handleMCPNotification()`: Process server notifications

#### ChatService (chat/index.ts)
**Responsibilities:**
- Orchestrate sequential thinking loop
- Manage conversation history
- Format responses with formatter tool
- Handle pinned artifacts and attachments
- Support multiple LLM providers

**Key Methods:**
- `processChat()`: Main entry point with retry logic
- `executeProcessChat()`: Core processing pipeline
- `executeSequentialThinking()`: Thinking loop
- `runSequentialThinking()`: Thinking with retries
- `buildSystemPromptWithContext()`: Dynamic prompt construction

#### LLMService (llm/index.ts)
**Responsibilities:**
- Abstract LLM provider implementations
- Manage provider switching
- Handle response parsing
- Cache responses
- Support multiple model options

**Key Methods:**
- `query()`: Send request to LLM
- `setProvider()`: Switch providers
- `getProvider()`: Get current provider name

### 6.3 Data Flow

**Complete User Message Flow:**

```
1. Frontend Chat Component
   ↓
2. POST /api/chat-artifacts (or similar)
   │
   ├── Body: {message, history, modelProvider, blockedServers, ...}
   │
3. Chat Route Handler (chat-artifacts.ts)
   │
   ├── Extract conversation ID
   ├── Get ChatService from app.locals
   └─→ Call: chatService.processChat()
   │
4. ChatService.processChat()
   │
   ├── Set LLM provider
   ├── Get MCP tools with filtering
   └─→ Call: executeProcessChat()
   │
5. ChatService.executeProcessChat()
   │
   ├── Run sequential thinking
   ├── Get formatter response
   ├── Extract formatter output
   ├── Collect artifacts
   └─→ Return: StoreFormat
   │
6. ChatService.executeSequentialThinking()
   │
   ├── Format message history
   ├── Loop (max 5 iterations):
   │  ├── Send to LLM with tools
   │  ├── Check for tool calls
   │  ├── Execute tools if called
   │  ├── Add results to history
   │  └── Check termination conditions
   │
7. Tool Execution (when called)
   │
   ├── Extract tool name from LLM response
   ├── Get original name from mapping
   ├── Call MCPService.callTool()
   ├── Get result from MCP server
   └── Process response
   │
8. Response Formatting
   │
   ├── Get formatter adapter for provider
   ├── Extract tool output from response
   ├── Validate format
   └── Convert to StoreFormat
   │
9. Artifact Collection
   │
   ├── Find all artifacts in response
   ├── Assign unique IDs
   ├── Store in database
   └── Include in final response
   │
10. Response Sent to Frontend
   │
   ├── Stream status updates via SSE
   ├── Send final result as JSON
   └── Close connection

11. Frontend Display
   │
   ├── Receive streamed updates
   ├── Update UI with status
   ├── Render final response
   ├── Display artifacts in separate pane
   └── Allow user to interact with artifacts
```

### 6.4 Configuration

**MCP Server Configuration**
**File:** `/backend-mcp-client/config/mcp_server_config.json`

Example:
```json
{
  "mcpServers": {
    "pubtator": {
      "command": "node",
      "args": ["../custom-mcp-servers/pubtator-mcp/dist/index.js"],
      "timeout": 60000
    },
    "kappa": {
      "command": "node",
      "args": ["../custom-mcp-servers/kappa-mcp/dist/index.js"],
      "timeout": 60000
    }
  }
}
```

**Environment Configuration**
**File:** `/backend-mcp-client/.env`

Required for MCP servers:
- `NCBI_API_KEY`: For PubMed access
- `NCBI_TOOL_EMAIL`: For PubMed access
- `ANTHROPIC_API_KEY`: For Anthropic LLM
- Other provider keys (OpenAI, Google Cloud, etc.)

**Server Startup**
**File:** `/backend-mcp-client/src/index.ts` (Lines 90-107)

```typescript
// Load config
const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

// Initialize servers
await mcpService.initializeServers(config);
```

---

## 7. LOGGING & DEBUGGING

### 7.1 MCP Logging System

**File:** `/backend-mcp-client/src/services/mcp.ts` (Lines 27-92)

**MCP Notification Handler:**
- Receives notifications from MCP servers
- Processes `notifications/message` events
- Calls registered log handlers

**Log Handler Registration (Lines 94-127):**
```typescript
addLogHandler(handler: (message: MCPLogMessage) => void): void
removeLogHandler(handler: (message: MCPLogMessage) => void): void
clearLogHandlers(): void
setLogMessageHandler(handler: (message: MCPLogMessage) => void): void // Legacy
```

**Log Message Format:**
```typescript
interface MCPLogMessage {
  level: 'debug' | 'info' | 'notice' | 'warning' | 'error' | 'critical';
  logger?: string;
  data?: {
    message?: string;
    traceId?: string;
    timestamp?: string;
    [key: string]: unknown;
  };
}
```

### 7.2 Request Logging

**File:** `/backend-mcp-client/src/routes/chat-artifacts.ts` (Lines 33-44)

Routes log:
- Conversation ID (new or from request)
- Message preview
- History length
- Blocked servers and pinned artifacts

### 7.3 Tool Call Logging

**Location:** `/backend-mcp-client/logs/toolcalling/`

**Session Logs:**
```
toolcall-YYYY-MM-DD-HH-MM-SS.log
```

Captures complete tool execution flow with timestamps.

---

## 8. KEY CONFIGURATION & SETTINGS

### 8.1 Chat Service Options

```typescript
interface ChatOptions {
  conversationId?: string;
  modelProvider: 'anthropic' | 'ollama' | 'openai' | 'gemini';
  blockedServers?: string[];          // Servers to exclude from tools
  enabledTools?: Record<string, string[]>; // Per-server tool whitelist
  pinnedArtifacts?: Array<{...}>;     // Pre-loaded artifacts
  attachments?: FileAttachment[];     // File uploads
  temperature?: number;               // 0.0-1.0, default 0.2
  maxTokens?: number;                 // default 4000
}
```

### 8.2 Sequential Thinking Parameters

```typescript
MAX_THINKING_STEPS = 5              // Max iterations
MAX_RETRIES = 3                     // Retry attempts
Backoff: min(1000 * 2^(n-1), 5000)ms
Temperature adjustment on retry: temp * 0.8
MaxTokens adjustment on retry: min(2000, maxTokens)
```

### 8.3 Provider-Specific Models

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

## 9. ERROR HANDLING & RESILIENCE

### 9.1 Retry Mechanisms

1. **Chat Processing:** 3 retries with exponential backoff
2. **Sequential Thinking:** 3 retries with parameter adjustment
3. **Tool Execution:** Inline error handling, continue on failure
4. **MCP Connection:** Timeout-based (10s local, 30s remote)

### 9.2 Graceful Degradation

- If tool execution fails, add error message to conversation
- If formatter tool fails, return raw sequential thinking output
- If artifact processing fails, continue without artifacts
- If knowledge graph merge fails, use most recent graph

### 9.3 Database Error Handling

```typescript
prisma.$on('error', (e) => {
  console.error('❌ [DATABASE-ERROR]', e);
});
```

---

## 10. SUMMARY TABLE

| Component | File | Purpose |
|-----------|------|---------|
| MCPService | mcp.ts | Server initialization, tool execution |
| ChatService | chat/index.ts | Conversation orchestration |
| LLMService | llm/index.ts | Provider abstraction |
| MessageService | message.ts | Message formatting |
| ArtifactService | artifact.ts | Artifact processing |
| DatabaseService | database.ts | Conversation persistence |
| Chat Routes | routes/chat*.ts | API endpoints |
| Adapters | services/chat/adapters/ | Provider-specific tool calling |
| Formatters | services/chat/formatters/ | Provider-specific response parsing |

---

## 11. IMPORTANT NOTES

### For Tool Calling:
- Tool names use exact string matching (e.g., "pubtator" not "pubtator-mcp")
- Blocked servers array must contain exact server names
- Tool name mapping is essential for Anthropic → MCP conversion

### For Sequential Thinking:
- Filters session history to prevent tool call loops
- Adjusts temperature and max tokens on retries
- Can terminate early if no progress detected

### For Artifacts:
- Multiple artifacts per message supported
- Knowledge graphs can be merged
- Binary outputs include source code if available

### For Response Formatting:
- Different system prompts for different modes (normal vs graph)
- Strict validation of response format before returning
- Comprehensive error messages if format invalid

---

**Generated:** 2024-11-08
**Architecture Version:** 1.0
**Last Updated:** Based on codebase as of November 2024
