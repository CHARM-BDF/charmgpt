# MCP Server Disabling Functionality

## Overview

This document explains how the MCP (Model Context Protocol) server status management system works, from UI interactions in the MCPStatusModal to how this impacts tool availability in the chat interface.

## System Components

1. **MCPStatusModal**: UI component for viewing and toggling server status
2. **mcpStore**: Zustand store for managing server state
3. **ChatInterface**: Component that sends chat requests with server status information
4. **chat.ts**: Server route that handles chat requests and filters available tools
5. **MCPService**: Service that provides tools based on server status

## Status Flow: From UI to API

### 1. MCPStatusModal Component

The modal displays each connected MCP server with a toggle switch for activation/deactivation:

- **Status Types**:
  - **Not available**: Server is not running (`isRunning: false`)
  - **Inactive**: Server is running but blocked (`isRunning: true, status: 'blocked'`)
  - **Active**: Server is running and available (`isRunning: true, status: 'active'`)

- **Toggle Functionality**:
  - When a user toggles a server's status, `toggleServerBlock(server.name)` is called from mcpStore
  - Only running servers can be toggled

```jsx
<Switch
  checked={server.status !== 'blocked'}
  onChange={() => server.isRunning && toggleServerBlock(server.name)}
  disabled={!server.isRunning}
  className={/* styling based on server status */}
/>
```

### 2. MCP Store State Management

The mcpStore (implemented with Zustand) manages server state:

- **State Structure**:
  ```typescript
  interface MCPStoreState {
    servers: MCPServerState[];
    lastChecked: Date | null;
    isLoading: boolean;
    fetchStatus: () => Promise<void>;
    toggleServerBlock: (serverName: string) => void;
    getBlockedServers: () => string[];
    // ... other methods
  }
  ```

- **Server Status Toggle**:
  ```typescript
  toggleServerBlock: (serverName: string) => {
    set((state) => {
      const updatedServers = state.servers.map(server => {
        if (server.name === serverName && server.isRunning) {
          const newStatus = server.status === 'blocked' ? 'active' : 'blocked';
          
          // Persist to localStorage
          if (newStatus === 'blocked') {
            localStorage.setItem(`server-${server.name}-blocked`, 'true');
          } else {
            localStorage.removeItem(`server-${server.name}-blocked`);
          }
          
          return {
            ...server,
            status: newStatus
          };
        }
        return server;
      });

      return { servers: updatedServers };
    });
  }
  ```

- **Retrieving Blocked Servers**:
  ```typescript
  getBlockedServers: () => {
    const state = get();
    return state.servers
      .filter(server => server.status === 'blocked')
      .map(server => server.name);
  }
  ```

- **Persistence**:
  - Server status is persisted in localStorage
  - Zustand's persist middleware maintains status between sessions:
  ```typescript
  persist(
    /* store implementation */,
    {
      name: 'mcp-storage',
      partialize: (state) => ({
        servers: state.servers.map(server => ({
          name: server.name,
          status: server.status
        }))
      })
    }
  )
  ```

### 3. Chat Interface Integration

When a user sends a message, the chat interface includes the blocked server information:

```typescript
// In ChatInterface's processMessage function
const response = await fetch(apiUrl, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    message: content,
    history: messageHistory,
    blockedServers: useMCPStore.getState().getBlockedServers(),
    pinnedGraph: pinnedGraph
  })
});
```

### 4. Server-Side Processing in chat.ts

The chat route receives the blocked servers list and uses it to filter available tools:

```typescript
// Extracting blocked servers from request
const { message, history, blockedServers = [], pinnedGraph } = req.body;

// Logging blocked servers info
console.log('\n=== BLOCKED SERVERS DEBUG ===');
console.log('Received blocked servers:', blockedServers);
console.log('Number of blocked servers:', blockedServers.length);
console.log('================================\n');

// Later, when getting available tools
let tools = [];
if (req.app.locals.mcpService) {
  sendStatusUpdate('Retrieving available MCP tools...');
  tools = await req.app.locals.mcpService.getAllAvailableTools(blockedServers);
}
```

### 5. MCPService Tool Filtering

The MCPService filters out tools from blocked servers:

```typescript
async getAllAvailableTools(blockedServers: string[] = []): Promise<AnthropicTool[]> {
  let mcpTools: AnthropicTool[] = [];
  
  // Clear previous tool mappings
  this.toolNameMapping.clear();
  
  // Iterate through all connected servers
  for (const [serverName, client] of this.mcpClients.entries()) {
    try {
      console.log(`\nServer: ${serverName}`);
      console.log(`Status: ${blockedServers.includes(serverName) ? 'BLOCKED' : 'AVAILABLE'}`);
      
      // Skip blocked servers
      if (blockedServers.includes(serverName)) {
        console.log('Skipping blocked server');
        continue;
      }

      // Get tools from this server and add to the collection
      const toolsResult = await client.listTools();
      
      if (toolsResult.tools) {
        // Process and add tools...
        mcpTools = mcpTools.concat(toolsWithPrefix);
      }
    } catch (error) {
      console.error(`Failed to get tools from server ${serverName}:`, error);
    }
  }
  
  return mcpTools;
}
```

## Tool Execution Flow

1. **LLM Tool Selection**:
   - The LLM can only see and use tools from non-blocked servers
   - When the LLM chooses to use a tool, it specifies the tool name

2. **Tool Execution**:
   - The chat route extracts the server and tool name:
   ```typescript
   const [serverName, toolName] = originalToolName.split(':');
   ```
   
   - The tool is executed on the specified server:
   ```typescript
   const toolResult = await mcpService.callTool(serverName, toolName, content.input);
   ```

3. **Result Processing**:
   - The tool result is processed and added to the conversation
   - Special artifacts (knowledge graphs, bibliography, etc.) are handled appropriately

## Complete Flow Summary

1. User opens MCPStatusModal to view server status
2. User toggles server status (active/inactive) using the switch
3. MCPStore updates the status and persists it to localStorage
4. When sending a chat message, client retrieves and includes blocked servers list
5. Chat API receives the blocked servers in the request
6. MCPService filters out tools from blocked servers
7. LLM only has access to tools from active servers
8. Chat response only includes results from tools on active servers

This system gives users control over which MCP servers can be used by the AI in chat sessions, allowing for selective enabling/disabling of capabilities. 