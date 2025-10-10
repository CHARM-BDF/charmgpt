# Graph Mode MCP Development Guide

## Overview

This guide documents the complete working pattern for creating Graph Mode MCPs based on the successful `graphmodeBaseMCP` implementation. This pattern ensures proper integration with the Graph Mode system, including automatic context injection, UI refresh signaling, and database connectivity.

## ✅ What's Working (Proven Pattern)

### 1. Universal Context Injection System
- **Location**: `backend-mcp-client/src/services/chat/index.ts`
- **Method**: `checkIfGraphModeConversation()` + `executeToolCall()`
- **How it works**: Automatically detects Graph Mode conversations and injects `databaseContext` into ALL MCP tool calls
- **Effect**: No manual context passing required - it's automatic

### 2. Database Context Schema (Required)
```typescript
const DatabaseContextSchema = z.object({
  conversationId: z.string().min(1, "conversationId is required"),
  artifactId: z.string().optional().describe("Artifact ID for Graph Mode"),
  apiBaseUrl: z.string().url().optional(),
  accessToken: z.string().optional(),
});
```

### 3. UI Refresh Signaling (Critical)
- **Pattern**: `refreshGraph: true` in tool responses
- **Location**: All tool return statements in MCPs
- **Effect**: Frontend automatically refreshes graph after MCP operations
- **Required**: Without this, UI won't update after MCP operations

### 4. API Request Helper Pattern
```typescript
async function makeAPIRequest(
  endpoint: string, 
  context: { conversationId: string; apiBaseUrl?: string; accessToken?: string },
  options: RequestInit = {}
): Promise<any>
```

### 5. Tool Response Format (Required)
```typescript
return {
  content: [{
    type: "text",
    text: `Success message...`
  }],
  refreshGraph: true  // ← CRITICAL for UI refresh
};
```

## 📝 Complete Template for New Graph Mode MCPs

### File Structure
```
custom-mcp-servers/graphModeMCPs/yourMCP/
├── src/
│   └── index.ts
├── dist/
│   └── index.js (compiled)
├── package.json
└── tsconfig.json
```

### Complete TypeScript Template

```typescript
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

// =============================================================================
// CONFIGURATION SECTION
// =============================================================================
const TOOL_NAME = "your-graphmode-mcp";
const SERVICE_NAME = "your-service";
const DEFAULT_API_BASE_URL = process.env.API_BASE_URL || "http://localhost:3001";

// =============================================================================
// SCHEMA DEFINITIONS (REQUIRED)
// =============================================================================
const DatabaseContextSchema = z.object({
  conversationId: z.string().min(1, "conversationId is required"),
  artifactId: z.string().optional().describe("Artifact ID for Graph Mode"),
  apiBaseUrl: z.string().url().optional(),
  accessToken: z.string().optional(),
});

// Your tool-specific schema
const YourToolArgumentsSchema = z.object({
  // Your parameters here
  databaseContext: DatabaseContextSchema, // ← REQUIRED
});

// =============================================================================
// SERVER SETUP
// =============================================================================
const server = new Server(
  {
    name: SERVICE_NAME,
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
      logging: {
        level: "debug"
      }
    },
  }
);

// =============================================================================
// API REQUEST HELPER (REQUIRED)
// =============================================================================
async function makeAPIRequest(
  endpoint: string, 
  context: { conversationId: string; apiBaseUrl?: string; accessToken?: string },
  options: RequestInit = {}
): Promise<any> {
  try {
    const baseUrl = context.apiBaseUrl || DEFAULT_API_BASE_URL;
    const url = `${baseUrl}/api/graph/${context.conversationId}${endpoint}`;

    console.error(`[${SERVICE_NAME}] Making request to: ${url}`);
    console.error(`[${SERVICE_NAME}] Method: ${options.method || 'GET'}`);
    console.error(`[${SERVICE_NAME}] Context conversationId: ${context.conversationId}`);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': TOOL_NAME,
    };

    if (context.accessToken) {
      headers['Authorization'] = `Bearer ${context.accessToken}`;
    }

    const response = await fetch(url, { ...options, headers });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error(`[${SERVICE_NAME}] API request failed:`, error);
    throw error;
  }
}

// =============================================================================
// TOOL DEFINITIONS
// =============================================================================
server.setRequestHandler(ListToolsRequestSchema, async () => {
  const tools = [
    {
      name: "yourTool",
      description: "Description of what your tool does",
      inputSchema: {
        type: "object",
        properties: {
          // Your tool parameters
          databaseContext: {
            type: "object",
            properties: {
              conversationId: { type: "string" },
              artifactId: { type: "string" },
              apiBaseUrl: { type: "string" },
              accessToken: { type: "string" }
            },
            required: ["conversationId"]
          }
        },
        required: ["databaseContext"]
      }
    }
  ];

  return { tools };
});

// =============================================================================
// TOOL HANDLERS (REQUIRED PATTERN)
// =============================================================================
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  
  try {
    if (name === "yourTool") {
      const queryParams = YourToolArgumentsSchema.parse(args);
      
      // Your tool logic here
      // Use makeAPIRequest() for database operations
      // Example:
      // const result = await makeAPIRequest('/nodes', queryParams.databaseContext, {
      //   method: 'POST',
      //   body: JSON.stringify({ /* your data */ })
      // });
      
      return {
        content: [{
          type: "text",
          text: `Successfully completed operation.`
        }],
        refreshGraph: true  // ← REQUIRED for UI refresh
      };
    }
    
    throw new Error(`Unknown tool: ${name}`);
  } catch (error) {
    console.error(`[${SERVICE_NAME}] Tool execution failed:`, error);
    
    return {
      content: [{
        type: "text",
        text: `Error: ${error.message}`
      }]
    };
  }
});

// =============================================================================
// SERVER STARTUP
// =============================================================================
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`[${SERVICE_NAME}] MCP Server running on stdio`);
}

main().catch(console.error);
```

## 🔧 Configuration Requirements

### 1. MCP Server Config (`mcp_server_config.json`)
```json
"your-graphmode-mcp": {
  "command": "node",
  "args": [
    "../custom-mcp-servers/graphModeMCPs/yourMCP/dist/index.js"
  ],
  "timeout": 60000,
  "env": {
    "API_BASE_URL": "http://localhost:3001",
    "NODE_ENV": "development"
  },
  "description": "Your Graph Mode MCP description"
}
```

### 2. Package.json Template
```json
{
  "name": "your-graphmode-mcp",
  "version": "1.0.0",
  "type": "module",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "zod": "^3.22.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "typescript": "^5.0.0"
  }
}
```

### 3. TypeScript Config (`tsconfig.json`)
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "node",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

## 🎯 Key Success Factors

### ✅ Required Elements
1. **Database Context Schema** - Must be included in all tool arguments
2. **API Request Helper** - Use the standardized pattern
3. **refreshGraph Flag** - Must be `true` in all successful responses
4. **Error Handling** - Proper try/catch with meaningful messages
5. **Configuration** - Must be added to `mcp_server_config.json`

### ❌ Common Pitfalls
1. **Missing `refreshGraph: true`** - UI won't refresh after operations
2. **Missing `databaseContext`** - Tool won't receive conversation context
3. **Wrong API endpoints** - Use `/api/graph/${conversationId}/...` pattern
4. **Missing error handling** - Tools will crash on errors
5. **Not rebuilding TypeScript** - Changes won't take effect

## 🚀 Step-by-Step Creation Process

### Step 1: Create Directory Structure
```bash
mkdir -p custom-mcp-servers/graphModeMCPs/yourMCP/src
cd custom-mcp-servers/graphModeMCPs/yourMCP
```

### Step 2: Initialize Package
```bash
npm init -y
npm install @modelcontextprotocol/sdk zod
npm install -D typescript @types/node
```

### Step 3: Create Configuration Files
- Copy `tsconfig.json` template above
- Copy `package.json` template above
- Create `src/index.ts` with the template above

### Step 4: Implement Your Tool Logic
- Replace `yourTool` with your actual tool name
- Add your specific parameters to the schema
- Implement your business logic
- Use `makeAPIRequest()` for database operations

### Step 5: Build and Test
```bash
npm run build
```

### Step 6: Add to MCP Config
- Add entry to `backend-mcp-client/config/mcp_server_config.json`
- Restart backend server

### Step 7: Test Integration
- Create a Graph Mode conversation
- Test your tool
- Verify UI refreshes after operations

## 🧪 Testing Checklist

### ✅ Basic Functionality
- [ ] Tool appears in available tools list
- [ ] Tool executes without errors
- [ ] Tool returns proper response format
- [ ] `refreshGraph: true` is included in response

### ✅ Graph Mode Integration
- [ ] Tool receives `databaseContext` automatically
- [ ] Tool can make API requests to backend
- [ ] UI refreshes after tool execution
- [ ] Loading indicators work during tool execution

### ✅ Error Handling
- [ ] Tool handles invalid parameters gracefully
- [ ] Tool handles API errors gracefully
- [ ] Error messages are user-friendly
- [ ] Tool doesn't crash on unexpected errors

### ✅ User Experience
- [ ] Success notifications appear
- [ ] Error notifications appear with specific messages
- [ ] Manual refresh button works
- [ ] Last updated time displays correctly

## 🔍 Debugging Guide

### Common Issues and Solutions

#### Issue: Tool not appearing in available tools
**Solution**: Check MCP server config and restart backend

#### Issue: Tool executes but UI doesn't refresh
**Solution**: Ensure `refreshGraph: true` is in response

#### Issue: Tool doesn't receive database context
**Solution**: Check that `databaseContext` is in tool schema

#### Issue: API requests fail
**Solution**: Verify endpoint URLs and authentication

#### Issue: TypeScript compilation errors
**Solution**: Check imports and type definitions

### Debug Logging
Add these console.error statements for debugging:
```typescript
console.error(`[${SERVICE_NAME}] Tool called: ${name}`);
console.error(`[${SERVICE_NAME}] Arguments:`, args);
console.error(`[${SERVICE_NAME}] Database context:`, queryParams.databaseContext);
```

## 📋 Integration with Phase 2 Features

### Loading Indicators
- Automatically work with any MCP tool
- Show during tool execution
- Hide when tool completes

### Notifications
- Success notifications for completed operations
- Error notifications for failed operations
- Specific error messages based on error type

### Manual Refresh
- Works for any graph operation
- Can be used if auto-refresh fails
- Shows loading state during refresh

### Retry Logic
- Automatically retries failed operations
- Shows retry notifications
- Uses exponential backoff

## 🎯 Best Practices

### 1. Tool Design
- Keep tools focused on single operations
- Use descriptive tool names and descriptions
- Provide clear parameter documentation

### 2. Error Handling
- Always include try/catch blocks
- Provide specific error messages
- Log errors for debugging

### 3. Performance
- Use appropriate timeouts
- Handle large datasets efficiently
- Provide progress feedback for long operations

### 4. User Experience
- Always include `refreshGraph: true`
- Provide meaningful success messages
- Handle edge cases gracefully

## 📚 Reference Examples

### Working Examples
- `graphmodeBaseMCP` - Basic graph operations (removeNode, removeEdge, getGraphState)
- `graphmodePubTatorMCP` - PubTator integration (needs `refreshGraph` update)

### API Endpoints
- `GET /api/graph/${conversationId}/state` - Get current graph state
- `POST /api/graph/${conversationId}/nodes` - Add nodes
- `POST /api/graph/${conversationId}/edges` - Add edges
- `DELETE /api/graph/${conversationId}/nodes/${nodeId}` - Remove node
- `DELETE /api/graph/${conversationId}/edges/${edgeId}` - Remove edge

## 🔄 Maintenance

### Regular Updates
- Keep MCP SDK version current
- Update dependencies regularly
- Test with new Graph Mode features

### Monitoring
- Check server logs for errors
- Monitor tool execution times
- Verify UI refresh functionality

---

## 📝 Quick Reference

### Essential Code Snippets

#### Database Context Schema
```typescript
const DatabaseContextSchema = z.object({
  conversationId: z.string().min(1, "conversationId is required"),
  artifactId: z.string().optional(),
  apiBaseUrl: z.string().url().optional(),
  accessToken: z.string().optional(),
});
```

#### Tool Response with Refresh
```typescript
return {
  content: [{
    type: "text",
    text: `Success message`
  }],
  refreshGraph: true
};
```

#### API Request Helper
```typescript
const result = await makeAPIRequest('/endpoint', context, {
  method: 'POST',
  body: JSON.stringify(data)
});
```

#### Error Handling
```typescript
try {
  // Tool logic
} catch (error) {
  return {
    content: [{
      type: "text",
      text: `Error: ${error.message}`
    }]
  };
}
```

This guide provides everything needed to create new Graph Mode MCPs that integrate seamlessly with the existing system and provide excellent user experience.
