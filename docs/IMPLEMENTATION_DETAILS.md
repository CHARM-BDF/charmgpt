# MCP System Implementation Details

## Key File References Quick Lookup

### Sequential/Consecutive Thinking
- **Main Route**: `/backend-mcp-client/src/routes/chat-sequential.ts` (13 lines)
- **Core Logic**: `/backend-mcp-client/src/services/chat/index.ts` 
  - `executeSequentialThinking()` (Lines 1042-1400+)
  - `runSequentialThinking()` (Lines 964-1040)
  - Loop max: 5 iterations (Line 1198)
  - Retry: 3 attempts with exponential backoff (Line 990)

### LLM Tool Calling
- **Tool Discovery**: `/backend-mcp-client/src/services/mcp.ts`
  - `getAllAvailableTools()` (Lines 262-456)
  - Tool filtering (Line 1128 for sequential-thinking removal)
  - Name mapping (Lines 366-375)
- **Tool Execution**: `/backend-mcp-client/src/routes/chat.ts` (Lines 409-487)
  - Name resolution via `getOriginalToolName()`
  - Graph Mode special handling (Lines 445-477)
- **Adapters**: `/backend-mcp-client/src/services/chat/adapters/`
  - `getToolCallAdapter()` factory function
  - Provider-specific implementations

### Response Processing
- **MCP Response Handling**: `/backend-mcp-client/src/services/mcp.ts`
  - `callTool()` (Lines 516-526)
  - Notification handling (Lines 27-92)
- **Parsing**: `/backend-mcp-client/src/services/message.ts`
  - `convertToStoreFormat()` (Lines 93-166)
  - `enhanceResponseWithArtifacts()` (Lines 256-358)
- **Artifact Service**: `/backend-mcp-client/src/services/artifact.ts`
  - Type validation and normalization
  - Binary output processing

### Response Formatting & Summarization
- **Formatter Tool**: `/backend-mcp-client/src/services/chat/index.ts`
  - Definition (Lines 308-443)
  - Instructions (Lines 353-430)
- **Mode-Based Prompts**:
  - Normal: `/backend-mcp-client/src/services/chat/normalModeSystemPrompt.ts`
  - Graph: `/backend-mcp-client/src/services/chat/graphModeSystemPrompt.ts`
- **Formatters**: `/backend-mcp-client/src/services/chat/formatters/`
  - `extractFormatterOutput()` method in each provider adapter
  - Anthropic, OpenAI, Gemini, Ollama implementations

### Artifact Handling
- **Frontend Display**: `/frontend-client/src/components/chat/ChatMessages.tsx`
  - `getMessageArtifacts()` (Lines 65-125)
  - Artifact normalization (Lines 70-82)
- **Store**: `/frontend-client/src/store/chatStore.ts`
  - Artifact state management
  - Selection and display logic
- **Database**: `/backend-mcp-client/src/services/database.ts`
  - Prisma schema: `/backend-mcp-client/prisma/schema.prisma`

### Configuration
- **MCP Servers**: `/backend-mcp-client/config/mcp_server_config.json`
- **Server Startup**: `/backend-mcp-client/src/index.ts` (Lines 90-107)
- **LLM Service**: `/backend-mcp-client/src/services/llm/index.ts` (Lines 60-97)

### Logging & Debugging
- **Tool Call Logs**: `/backend-mcp-client/src/routes/chat.ts` (Lines 49-90)
  - Location: `/backend-mcp-client/logs/toolcalling/`
- **MCP Logging**: `/backend-mcp-client/src/services/mcp.ts` (Lines 94-127)
  - Handler registration
  - Notification processing

---

## Critical Concepts

### 1. Sequential Thinking Loop
```typescript
while (!isSequentialThinkingComplete && thinkingSteps < 5) {
  - Format history
  - Send to LLM with tools
  - If tool called:
    - Execute tool
    - Add result to history
  - Check termination
}
```

### 2. Tool Name Mapping
```
MCP Format:     pubtator:search_pubmed
                     ↓
Anthropic:      pubtator-search_pubmed
                     ↓
Mapping:        toolNameMapping.get("pubtator-search_pubmed")
                → "pubtator:search_pubmed"
```

### 3. Response Flow
```
LLM Response
  ↓
Extract Tool Use / Function Call
  ↓
Get Original Tool Name
  ↓
Execute Tool on MCP Server
  ↓
Parse Result (content, bibliography, artifacts)
  ↓
Add to Conversation
  ↓
Continue or Format Final Response
```

### 4. Artifact Processing
```
Tool Result
  ↓
Extract artifacts array
  ↓
Validate type & normalize
  ↓
Create unique ID
  ↓
Store in database
  ↓
Add to response artifacts
  ↓
Add button to conversation text
```

---

## Data Structures

### ChatMessage
```typescript
{
  role: 'user' | 'assistant' | 'system';
  content: string | Array<{type: string; text: string}>;
}
```

### StoreFormat (Final Response)
```typescript
{
  thinking?: string;
  conversation: string | Array<{
    type: 'text' | 'artifact';
    content?: string;
    artifact?: {...};
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

### MCPLogMessage
```typescript
{
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

---

## Common Issues & Solutions

### Tool Calling Not Working
1. Check server names in `blockedServers` - must match exactly
2. Verify tool name mapping in `MCPService.getOriginalToolName()`
3. Look at `/backend-mcp-client/logs/toolcalling/` for detailed logs
4. Ensure MCP server is initialized in `initializeServers()`

### Response Format Invalid
1. Check formatter tool instructions (Lines 353-430)
2. Ensure `conversation` field is always an array of objects
3. Each object must have `type: 'text'` or `type: 'artifact'`
4. Validate via `validateResponseFormat()`

### Artifacts Not Displaying
1. Check artifact normalization in `getMessageArtifacts()`
2. Verify artifact ID is in message or artifacts array
3. Check if artifact type is supported in UI
4. Look at ChatMessages component for retrieval logic

### Sequential Thinking Stuck
1. Check `consecutiveNoProgressSteps` counter
2. Verify tool calls are being made in each iteration
3. Check if same tools are being called repeatedly
4. Look for termination signal from LLM

---

## Testing Endpoints

### Direct MCP Execution
```bash
POST http://localhost:3001/api/mcp-execute
{
  "serverName": "pubtator",
  "toolName": "search_pubmed",
  "arguments": {"query": "cancer"},
  "attachments": [],
  "pinnedArtifacts": []
}
```

### Chat with Sequential Thinking
```bash
POST http://localhost:3001/api/chat-sequential
{
  "message": "Your question",
  "history": [],
  "modelProvider": "anthropic",
  "blockedServers": [],
  "enabledTools": {}
}
```

### Chat with Artifacts
```bash
POST http://localhost:3001/api/chat-artifacts
{
  "message": "Your question",
  "history": [],
  "conversationId": "uuid",
  "modelProvider": "anthropic",
  "blockedServers": [],
  "enabledTools": {},
  "pinnedArtifacts": [],
  "attachments": []
}
```

---

## Performance Considerations

1. **Tool Filtering**: Blocked servers use exact string matching for performance
2. **Session Caching**: Historical tool calls prevent redundant execution
3. **Retry Logic**: Exponential backoff with max 3 retries (up to 5 seconds)
4. **Max Thinking Steps**: 5 iterations per request (prevents infinite loops)
5. **Database**: SQLite with Prisma for conversation persistence

---

## Security Considerations

1. **API Key Management**: Environment variables for LLM providers
2. **Tool Access Control**: blockedServers and enabledTools filtering
3. **Conversation Isolation**: conversationId for user-specific data
4. **Input Validation**: All MCP tool inputs validated before execution
5. **Database Security**: Prisma ORM prevents SQL injection

---

**Last Updated**: November 8, 2024
**Documentation Version**: 1.0
