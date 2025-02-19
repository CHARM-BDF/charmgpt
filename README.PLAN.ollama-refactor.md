# Ollama Server Refactor Plan

## Current Issues [✅ IDENTIFIED]
1. Overcomplicated implementation trying to match Claude's API structure
2. Mixing MCP tool handling with response formatting
3. Not utilizing Ollama's native capabilities
4. Port conflict issues (3001 already in use)
5. Tool calling process needs simplification

## Goals [🟡 IN PROGRESS]
1. ✅ Simplify the implementation using Ollama JS library
2. ✅ Maintain same external API for compatibility
3. 🟡 Properly handle MCP tools
4. 🟡 Implement clean two-phase approach
5. ⚠️ Fix port conflict issues (Currently failing)

## Key Findings About Tool Calling Process

1. **Current Tool Processing Flow** [✅ IDENTIFIED]
   ```typescript
   // Flow in ollamaIndex.ts:
   1. getAllAvailableTools() gets tools from MCP servers
   2. Tools are formatted for Ollama in chat endpoint
   3. Ollama makes decisions about tool use
   4. Server executes tools via MCP clients
   ```

2. **Tool Name Mapping** [✅ IDENTIFIED]
   - Using a global `toolNameMapping` Map to track original MCP tool names
   - Format: `{anthropicName: originalMcpName}`
   - Example: `mondo-api-search` maps to `mondo-api:search`

3. **Tool Execution Process** [🟡 IN PROGRESS]
   ```typescript:README.PLAN.ollama-refactor.md
   // Current flow:
   1. Get tool response from Ollama
   2. Look up original tool name
   3. Split into serverName and toolName
   4. Find MCP client
   5. Execute tool
   6. Process result
   ```

4. **Known Issues** [⚠️ NEEDS ATTENTION]
   - Tool format conversion is overly complex
   - Response formatting needs streamlining
   - Tool execution error handling needs improvement
   - Logging is too verbose

## Implementation Steps

### Phase 1: Setup and Dependencies [✅ COMPLETED]
1. ✅ Install Ollama JS library
   ```bash
   npm install ollama
   ```
2. ✅ Created new server file structure:
   ```
   src/server/
   ├── ollamaServer.ts      # Main Ollama server implementation
   ├── ollamaClient.ts      # Ollama client wrapper
   ├── ollamaTypes.ts       # Type definitions
   └── ollamaUtils.ts       # Utility functions
   ```

### Phase 2: Core Implementation [🟡 IN PROGRESS]

1. **ollamaTypes.ts** [✅ COMPLETED]
   Implemented key types:
   ```typescript
   // Basic message types
   interface Message {
     role: 'user' | 'assistant' | 'system';
     content: string;
   }

   // Configuration
   interface OllamaConfig {
     host: string;
     port?: number;
     fallbackPort?: number;
   }

   // Tool definitions
   interface Tool {
     type: 'function';
     function: {
       name: string;
       description: string;
       parameters: {
         type: "object";
         properties: Record<string, any>;
         required: string[];
       };
     };
   }

   // Response types
   interface ToolResponse {
     type: 'tool_use';
     name: string;
     input: {
       thinking?: string;
       conversation: Array<{
         type: 'text' | 'artifact';
         content?: string;
         metadata?: Record<string, any>;
         artifact?: {
           type: string;
           id: string;
           title: string;
           content: string;
           language?: string;
         };
       }>;
     };
   }
   ```

2. **ollamaClient.ts** [🟡 IN PROGRESS]
   - ✅ Created OllamaWrapper class
   - ✅ Implemented two-phase message processing
   - 🟡 Tool execution handling
   - 🟡 Response formatting

3. **ollamaUtils.ts** [✅ COMPLETED]
   Implemented key utilities:
   ```typescript
   // Port configuration
   async function configurePort(config: OllamaConfig): Promise<number>

   // Error formatting
   function formatErrorResponse(error: Error): { 
     error: { 
       message: string; 
       details?: any 
     } 
   }

   // Artifact type validation
   function validateArtifactType(type: string): string
   ```

4. **ollamaServer.ts** [🟡 IN PROGRESS]
   - ✅ Express server setup
   - ✅ API endpoint implementation
   - ✅ MCP server initialization
   - ⚠️ Port configuration (needs fix)

### Phase 3: API Implementation [🟡 IN PROGRESS]

1. **Chat Endpoint** (`/api/chat`) [🟡 IN PROGRESS]
   ```typescript
   POST /api/chat
   {
     message: string
     history: Message[]
     blockedServers?: string[]
   }
   ```
   
   Current Implementation:
   - ✅ Basic request handling
   - ✅ MCP tool integration
   - 🟡 Two-phase processing
   - 🟡 Response formatting

2. **Server Status Endpoint** (`/api/server-status`) [✅ COMPLETED]
   - ✅ MCP server status
   - ✅ Tool availability
   - ✅ Error handling

### Phase 4: Testing and Validation [⏳ PENDING]
1. Test suite creation pending
2. Validation steps pending

### Phase 5: Migration [🟡 IN PROGRESS]
1. ✅ Updated package.json scripts:
   ```json
   {
     "scripts": {
       "server:ollama": "tsx src/server/ollamaServer.ts",
       "server:ollama:dev": "nodemon --watch src/server -e ts,js --exec tsx src/server/ollamaServer.ts"
     }
   }
   ```

2. ✅ Updated environment configuration:
   ```env
   OLLAMA_HOST=http://localhost:11434
   OLLAMA_PORT=3001
   OLLAMA_FALLBACK_PORT=3002
   ```

## Current Issues to Address

1. ⚠️ **Port Conflict**
   ```
   Error: listen EADDRINUSE: address already in use :::3001
   ```
   - Need to implement proper port fallback
   - Consider dynamic port allocation

2. 🟡 **Tool Processing**
   - Improve tool response handling
   - Add validation for tool inputs
   - Better error handling for tool execution

3. 🟡 **Response Formatting**
   - Ensure consistent format with existing API
   - Add proper artifact handling
   - Implement streaming support

## Next Steps
1. Fix port conflict issue
2. Complete tool processing implementation
3. Finalize response formatting
4. Add comprehensive testing
5. Document API changes

## Timeline Update
- Original Estimate: 6-9 days
- Current Progress: ~45%
- Adjusted Estimate: 8-11 days

Would you like to focus on any specific area or should we proceed with fixing the port conflict issue first? 

### 2. Response Processing [⚠️ PENDING]
- Simplify response format
- Remove unnecessary conversion steps
- Improve error handling
- Add proper type validation

### 3. Error Handling [⚠️ PENDING]
- Add specific error types
- Improve error messages
- Add recovery mechanisms
- Implement proper logging

## Next Steps
1. Implement ToolManager class
2. Simplify response formatting
3. Add comprehensive error handling
4. Fix port conflict issues
5. Add proper logging strategy

Would you like to focus on any specific area or should we proceed with fixing the port conflict issue first? 