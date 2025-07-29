# MCP ↔ Claude Tool-Calling Pipeline

This document explains, step-by-step, how the server exposes **Model-Context-Protocol (MCP)** tools to Anthropic's Claude models and how those tools are executed during a `/api/chat` request.

---

## 1. High-Level Sequence

1. **HTTP POST** `/api/chat` arrives → `src/server/routes/chat.ts`.
2. `sendStatusUpdate` starts streaming JSON status events back to the browser.
3. If a `modelProvider` is supplied the **LLM Service** switches provider at runtime.
4. A _sequential-thinking_ loop begins:
   1. `MCPService.getAllAvailableTools()` enumerates and normalises every tool (except servers blocked by the client).
   2. Tools are passed to `anthropic.messages.create()` so Claude can decide what to run.
   3. For each `tool_use` block in Claude's reply:
      1. Name mapping is reversed → `[server]:[tool]`.
      2. `MCPService.callTool()` executes the RPC.
      3. Results (text, artifacts, graphs, binaries) are folded back into the in-memory conversation object.
   4. Loop repeats until Claude stops requesting tools (or a specialised sequential-thinking tool says it's done).
5. A **second** Anthropic call forces the `response_formatter` tool, producing a strictly-typed JSON payload.
6. `MessageService` injects any collected artifacts and the final `type:"result"` event is streamed to the client.

---

## 2. Detailed Walkthrough (with file responsibilities)

| Step | Important Code | Responsibility |
| ---- | -------------- | -------------- |
| Route bootstrap | `src/server/routes/chat.ts` | Sets response headers, pulls service singletons, defines helpers |
| Logging | `src/server/services/logging.ts` | Overrides `console.*`, starts new *chat* log file |
| LLM provider switch | `src/server/services/llm/index.ts` | `llmService.setProvider()` changes provider & default model |
| Enumerate tools | `src/server/services/mcp.ts` → `getAllAvailableTools()` | Filters blocked servers, resolves JSON-schema refs, converts names for Anthropic |
| Name mapping | `src/server/services/mcp.ts` → `getOriginalToolName()` | Maps `server-tool` ⇢ `server:tool` |
| Execute tool | `src/server/services/mcp.ts` → `callTool()` | Calls tool over MCP SDK client |
| Artifacts & buttons | `src/server/services/message.ts` | Converts Claude output to front-end store + clickable buttons |
| Binary ↦ artifact | `src/server/services/artifact.ts` | Turns PNG/HTML/etc. into inline artifacts |
| Knowledge-graph utils | `src/utils/knowledgeGraphUtils.ts` | Validate & merge graphs between tool calls |
| Formatter schema | `src/server/systemPrompt.ts` | Defines `response_formatter` tool schema Claude must follow |

### 2.1 Streaming helpers
```50:84:src/server/routes/chat.ts
// ... existing code ...
```
* `sendStatusUpdate` pushes live status lines.
* `sendMCPLogMessage` re-emits MCP logs to the UI.

### 2.2 First Anthropic call (planning / tool request)
```170:183:src/server/routes/chat.ts
// ... existing code ...
```
* Supplies the **tool catalogue**.
* Response may contain one or more `tool_use` blocks.

### 2.3 Tool execution
```194:216:src/server/routes/chat.ts
// ... existing code ...
```
* Reverse-mapped name → actual server/tool.
* Executes via `callTool()`.

### 2.4 Tool catalogue creation
```260:333:src/server/services/mcp.ts
// ... existing code ...
```
* Normalises schemas and names (stored in `toolNameMapping`).

### 2.5 Second Anthropic call (response formatting)
```392:408:src/server/routes/chat.ts
// ... existing code ...
```
* Forces use of `response_formatter` defined in `systemPrompt.ts`.

### Why the assistant should respond **without** a fake user echo

When a tool finishes you currently add two messages to the scratch conversation:

1. `assistant` — a line that says *"Tool used: …"*.
2. `user`     — the raw tool output echoed back.

Claude sees the second entry as fresh **user input** and therefore tries to
plan again, often choosing the very same tool.  To keep the loop from
re-triggering you should instead:

• Add **only one** message, role `assistant`, whose `content` is the tool's
  result (or an apologetic error).  
• Skip the intermediary *Tool used:* chatter.

That pattern follows Anthropic's official workflow (see
`README.INFO.OfficialClaude.ToolUseWorkflow.md`) and allows Claude to decide
freely whether it still needs a tool.  If it doesn't, the next model reply is
a regular assistant answer and the planner loop exits naturally.

---

## 3. Data Structures

### 3.1 Conversation in memory (`messages`)
* Array of `{ role, content }` objects plus **attached properties**: `bibliography`, `knowledgeGraph`, `binaryOutputs`, `directArtifacts`.

### 3.2 Artifacts
* Normalised to
  ```ts
  {
    type: string;              // MIME / custom type
    title: string;
    content: string;           // text or base64 data
    language?: string;         // if code
  }
  ```
* Stored separately then injected into the final store response.

---

## 4. End-to-End Flow Diagram (textual)
```
Browser ──POST /api/chat──────────────────────────────────────────────▶ chat.ts
 chat.ts              (Status: Initialising)
  ├─► loggingService.logRequest()
  ├─► llmService.setProvider()  (optional)
  ├─► LOOP (sequential thinking)
  │   ├─► mcp.getAllAvailableTools()
  │   ├─► Claude (Anthropic #1) – asks for tool_use
  │   │     └─ returns tool_use( server-tool, args )
  │   ├─► mcp.callTool(server, tool, args)
  │   └─► results added to messages / artifacts
  ├─► Claude (Anthropic #2) – response_formatter
  ├─► messageService.enhanceResponseWithArtifacts()
  ├─► loggingService.logResponse()
  └─► Stream type:"result" to browser  (Status: Finalising)
```

---

## 5. Tips for Debugging

* **Server blocked?** Check `blockedServers` array printed in `getAllAvailableTools()` traces.
* **Tool not found?** `getOriginalToolName()` logs close-match suggestions.
* **Claude formatting errors?** `systemPrompt.ts` lists _anti-patterns_ that must be avoided.

---

*Last updated: <!---date-->* 