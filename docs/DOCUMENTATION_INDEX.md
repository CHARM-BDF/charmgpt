# Charm MCP System Documentation Index

## Overview
This is a comprehensive documentation suite for the Charm MCP (Model Context Protocol) system, a sophisticated backend-frontend system for orchestrating LLM conversations with external tools through MCP servers.

---

## Documentation Files

### 1. **MCP_ARCHITECTURE_GUIDE.md** (24 KB)
**The Main Reference Document**

Comprehensive architecture guide covering all major systems:
- Consecutive Thinking & Sequential Thinking (Section 1)
- MCP Tool Calling by LLM (Section 2)
- MCP Response Processing (Section 3)
- Artifact Handling (Section 4)
- Text Summarization & Formatting (Section 5)
- General Architecture (Section 6)
- Logging & Debugging (Section 7)
- Key Configuration & Settings (Section 8)
- Error Handling & Resilience (Section 9)
- Component Summary Table (Section 10)
- Important Notes (Section 11)

**Best for:** Understanding the complete system, data flows, and how components interact.

---

### 2. **IMPLEMENTATION_DETAILS.md**
**Quick Reference for Developers**

Organized by feature with specific file paths and line numbers:
- Key File References (all 5 major areas)
- Critical Concepts (illustrated with examples)
- Data Structures (TypeScript interfaces)
- Common Issues & Solutions (troubleshooting guide)
- Testing Endpoints (curl examples)
- Performance Considerations
- Security Considerations

**Best for:** Quick lookups, debugging, and development reference.

---

### 3. **ARCHITECTURE_DIAGRAM.md**
**Visual Flow Diagrams**

Seven comprehensive ASCII diagrams:
1. High-Level System Architecture (full stack overview)
2. Sequential Thinking Loop Flow (decision tree with iterations)
3. Tool Calling Flow (step-by-step execution path)
4. Response Processing & Formatting (formatter pipeline)
5. Artifact Handling Pipeline (storage and retrieval)
6. Provider & Adapter Selection (provider-specific handling)
7. Configuration & Initialization (startup process)

**Best for:** Understanding data flow visually, presentations, and documentation.

---

## Quick Start Guide by Role

### For System Architects
1. Start with: `MCP_ARCHITECTURE_GUIDE.md` Section 1 & 6
2. Review: `ARCHITECTURE_DIAGRAM.md` - Diagram 1 (System Overview)
3. Deep dive: `ARCHITECTURE_DIAGRAM.md` - All diagrams

### For Backend Developers
1. Start with: `IMPLEMENTATION_DETAILS.md` - Key File References
2. Review: `ARCHITECTURE_DIAGRAM.md` - Diagrams 2, 3, 4, 5
3. Reference: `MCP_ARCHITECTURE_GUIDE.md` - Specific sections as needed

### For Frontend Developers
1. Start with: `IMPLEMENTATION_DETAILS.md` - Artifact Handling section
2. Review: `MCP_ARCHITECTURE_GUIDE.md` - Section 4 (Artifacts)
3. Reference: `ARCHITECTURE_DIAGRAM.md` - Diagram 5 (Artifact Pipeline)

### For DevOps/Infrastructure
1. Start with: `MCP_ARCHITECTURE_GUIDE.md` - Section 8 (Configuration)
2. Review: `IMPLEMENTATION_DETAILS.md` - Security & Performance sections
3. Reference: `ARCHITECTURE_DIAGRAM.md` - Diagram 7 (Initialization)

### For Debuggers/QA
1. Start with: `IMPLEMENTATION_DETAILS.md` - Common Issues & Solutions
2. Review: `MCP_ARCHITECTURE_GUIDE.md` - Section 7 (Logging)
3. Reference: `IMPLEMENTATION_DETAILS.md` - Testing Endpoints

---

## Key Concepts Summary

### 1. Sequential Thinking
- **What**: Iterative reasoning loop (max 5 iterations)
- **Where**: `backend-mcp-client/src/services/chat/index.ts`
- **Key Methods**: `executeSequentialThinking()`, `runSequentialThinking()`
- **Flow**: Message → Tools → Execution → Result → Continue/Exit

### 2. Tool Calling
- **What**: LLM requests external tools via MCP servers
- **Where**: `backend-mcp-client/src/services/mcp.ts` & routes
- **Key Methods**: `getAllAvailableTools()`, `callTool()`
- **Mapping**: Anthropic format ↔ MCP format (name mapping)

### 3. Response Processing
- **What**: Parse and structure MCP server responses
- **Where**: `backend-mcp-client/src/services/message.ts`
- **Key Methods**: `convertToStoreFormat()`, `enhanceResponseWithArtifacts()`
- **Output**: StoreFormat with thinking, conversation, artifacts

### 4. Response Formatting
- **What**: Transform sequential thinking into structured response
- **Where**: `backend-mcp-client/src/services/chat/formatters/`
- **Key Tool**: Response Formatter (LLM-called tool)
- **Output**: JSON with conversation items and artifacts

### 5. Artifact Handling
- **What**: Create, store, and display generated content
- **Where**: Frontend & Backend artifact services
- **Storage**: SQLite via Prisma
- **Display**: Type-specific components (Code, Graph, Image, etc.)

---

## Critical File Paths

| Component | File | Key Method |
|-----------|------|-----------|
| **Sequential Thinking** | `chat/index.ts` | `executeSequentialThinking()` (Line 1042) |
| **Tool Discovery** | `services/mcp.ts` | `getAllAvailableTools()` (Line 262) |
| **Tool Execution** | `routes/chat.ts` | Lines 409-487 |
| **Response Parsing** | `services/message.ts` | `convertToStoreFormat()` (Line 93) |
| **Formatting Tool** | `chat/index.ts` | Lines 308-443 |
| **Artifact Service** | `services/artifact.ts` | `validateArtifactType()` |
| **LLM Service** | `services/llm/index.ts` | `query()` method |
| **MCP Server Config** | `config/mcp_server_config.json` | Server definitions |
| **Frontend Chat** | `components/chat/ChatMessages.tsx` | `getMessageArtifacts()` (Line 65) |

---

## Configuration Reference

### Environment Variables
```
ANTHROPIC_API_KEY      # Anthropic Claude API
OPENAI_API_KEY         # OpenAI GPT API
GOOGLE_API_KEY         # Google Gemini API
GOOGLE_CLOUD_PROJECT   # GCP Project ID (Vertex AI)
NCBI_API_KEY           # PubMed NCBI API
NCBI_TOOL_EMAIL        # PubMed email
DATABASE_URL           # Prisma database URL
API_BASE_URL           # Backend API URL
```

### MCP Configuration
- **Location**: `/backend-mcp-client/config/mcp_server_config.json`
- **Format**: Server name → command + args
- **Timeout**: 30s default, configurable per server

---

## Common Workflows

### Adding a New MCP Server
1. Update `mcp_server_config.json` with server configuration
2. Restart backend server
3. Server automatically discovered and initialized
4. Tools available in sequential thinking

### Blocking Tools from LLM
1. Include server name in `blockedServers` array
2. Use exact server name matching (case-sensitive)
3. Tool filtering happens in `getAllAvailableTools()`

### Debugging Tool Calls
1. Check logs in `/backend-mcp-client/logs/toolcalling/`
2. Search for `TOOL_CALL_DETECTED` section
3. Verify name mapping: `TOOL_CALL_MAPPED`
4. Check result: `MCP_RESPONSE`

### Understanding Response Format Errors
1. Check formatter instructions (Lines 353-430 in chat/index.ts)
2. Ensure `conversation` field is always array
3. Each item must have `type: 'text'` or `type: 'artifact'`
4. Validate via `validateResponseFormat()`

---

## Performance Tuning

### Sequential Thinking
- **Max Steps**: 5 (adjust `MAX_THINKING_STEPS`)
- **Timeout**: Default based on provider
- **Temperature**: Auto-adjusted on retry

### Tool Filtering
- **Server Blocking**: Exact match (O(n) operation)
- **Tool Enabling**: Per-server whitelist
- **Cache**: Session-level tool call history

### Database
- **SQLite**: Fast for moderate datasets
- **Prisma**: ORM with type safety
- **BigInt Handling**: Serialization required

---

## Monitoring & Alerts

### Key Metrics to Monitor
1. **Tool Call Success Rate**: Check logs for failures
2. **Sequential Thinking Iterations**: Should be < 5 typically
3. **Response Format Validation**: Should be 100% success
4. **Artifact Processing**: Storage success rate

### Common Issues
- **Tool not found**: Check `getOriginalToolName()` mapping
- **Format invalid**: Check formatter instructions
- **Artifacts missing**: Check database storage
- **Stuck in loop**: Check `consecutiveNoProgressSteps`

---

## Testing & Validation

### Unit Testing Files
- Backend routes: `backend-mcp-client/tests/`
- Frontend components: `frontend-client/src/__tests__/` (if exists)
- Integration: `system-tests/`

### Testing Endpoints
```bash
# List available servers
GET http://localhost:3001/api/server-names

# Execute tool directly
POST http://localhost:3001/api/mcp-execute

# Chat with sequential thinking
POST http://localhost:3001/api/chat-sequential

# Chat with artifacts
POST http://localhost:3001/api/chat-artifacts
```

---

## Glossary

- **MCP**: Model Context Protocol - protocol for LLM tool integration
- **StoreFormat**: Internal response format (thinking, conversation, artifacts)
- **Tool Mapping**: Converting between provider formats and MCP formats
- **Sequential Thinking**: Iterative reasoning with tool calls
- **Response Formatter**: LLM-called tool to structure final response
- **Adapter Pattern**: Provider-specific implementations (Anthropic, OpenAI, etc.)
- **Pinned Artifacts**: User-selected artifacts for context in next message
- **Knowledge Graph**: Node-link visual representation of entities

---

## Support & References

### Internal Documentation
- System prompt: `backend-mcp-client/src/systemPrompt.ts`
- Mode-specific prompts: `backend-mcp-client/src/services/chat/*SystemPrompt.ts`
- Type definitions: `backend-mcp-client/src/types/mcp.ts`

### External References
- MCP Specification: https://modelcontextprotocol.io/
- Anthropic API: https://docs.anthropic.com/
- Prisma ORM: https://www.prisma.io/docs/

---

## Updates & Maintenance

**Last Generated**: November 8, 2024
**Documentation Version**: 1.0
**Codebase Snapshot**: Main branch (kappa-writer-mcp-work)

### How to Update Documentation
1. Update the relevant markdown file
2. Regenerate diagrams if architecture changes
3. Update this index if new documents added
4. Keep file paths and line numbers current
5. Test all code examples

---

## Document Statistics

| Document | Size | Sections | Focus |
|----------|------|----------|-------|
| MCP_ARCHITECTURE_GUIDE.md | 24 KB | 11 | Complete System |
| IMPLEMENTATION_DETAILS.md | ~8 KB | 9 | Quick Reference |
| ARCHITECTURE_DIAGRAM.md | ~15 KB | 7 | Visual Flows |
| DOCUMENTATION_INDEX.md | This file | - | Navigation |

**Total Documentation**: ~47 KB of comprehensive guides

---

*For questions or contributions, refer to the individual documents for specific component details.*
