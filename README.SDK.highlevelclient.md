# MCP High-Level Client Implementation Guide

This guide demonstrates how to implement a high-level MCP client with React, TypeScript, and Zustand for state management.

## Overview

The implementation consists of several key components:
- MCP Store for managing server connections and tool execution
- Server Control UI for connecting to MCP servers
- Tools Panel for displaying available tools
- Chat integration for executing tools based on LLM responses

## Core Components

### 1. MCP Store (`src/store/mcpStore.ts`)

The store manages MCP server connections and operations:

```typescript
interface MCPServer {
  name: string;
  tools: MCPTool[];
  resources: MCPResource[];
  prompts: MCPPrompt[];
  connected: boolean;
  client: Client;
}

interface MCPState {
  servers: Record<string, MCPServer>;
  activeServer: string | null;
  
  // Actions
  connectServer: (name: string, command: string, args: string[]) => Promise<void>;
  disconnectServer: (name: string) => Promise<void>;
  setActiveServer: (name: string | null) => void;
  executeTool: (serverName: string, toolName: string, args: Record<string, any>) => Promise<string>;
  getResource: (serverName: string, uri: string) => Promise<string>;
  getPrompt: (serverName: string, name: string, args: Record<string, any>) => Promise<string>;
}
```

### 2. MCP Types (`src/types/mcp.ts`)

Type definitions for MCP entities:

```typescript
export interface MCPTool {
  name: string;
  description?: string;
  inputSchema: {
    type: string;
    properties?: Record<string, unknown>;
    items?: unknown;
  };
}

export interface MCPResource {
  name: string;
  uri: string;
  description?: string;
  mimeType?: string;
}

export interface MCPPrompt {
  name: string;
  description?: string;
  arguments?: Array<{
    name: string;
    description?: string;
    required?: boolean;
  }>;
}
```

### 3. Server Control Component (`src/components/mcp/MCPServerControl.tsx`)

UI for managing server connections:

```typescript
export const MCPServerControl: React.FC = () => {
  const { servers, activeServer, connectServer, disconnectServer, setActiveServer } = useMCPStore();
  const [serverName, setServerName] = useState('');
  const [serverCommand, setServerCommand] = useState('');
  const [serverArgs, setServerArgs] = useState('');

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!serverName || !serverCommand) return;

    try {
      await connectServer(
        serverName,
        serverCommand,
        serverArgs.split(' ').filter(Boolean)
      );
      setActiveServer(serverName);
    } catch (error) {
      console.error('Failed to connect:', error);
    }
  };

  // ... render UI for server management
};
```

### 4. Tools Panel Component (`src/components/mcp/MCPTools.tsx`)

Display available tools from the active server:

```typescript
export const MCPTools: React.FC = () => {
  const { servers, activeServer } = useMCPStore();
  const activeServerData = activeServer ? servers[activeServer] : null;

  return (
    <div className="p-4">
      <h3>Available Tools</h3>
      <div className="space-y-4">
        {activeServerData?.tools.map((tool) => (
          <div key={tool.name}>
            <h4>{tool.name}</h4>
            {tool.description && <p>{tool.description}</p>}
            {tool.inputSchema && (
              <pre>{JSON.stringify(tool.inputSchema, null, 2)}</pre>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
```

### 5. Chat Integration

Integrate MCP with chat functionality:

```typescript
interface ChatState {
  // ... other chat state
  processMessage: async (content: string) => {
    const mcpStore = useMCPStore.getState();
    const { activeServer } = mcpStore;

    // Send to LLM with MCP context
    const response = await fetch('/api/chat', {
      method: 'POST',
      body: JSON.stringify({
        message: content,
        mcpContext: activeServer ? {
          serverName: activeServer,
          tools: mcpStore.servers[activeServer].tools,
          resources: mcpStore.servers[activeServer].resources,
          prompts: mcpStore.servers[activeServer].prompts,
        } : null,
      }),
    });

    // Handle tool calls from LLM response
    const parsed = parseXMLResponse(response.data);
    if (parsed.toolCalls && activeServer) {
      for (const toolCall of parsed.toolCalls) {
        const result = await mcpStore.executeTool(
          activeServer,
          toolCall.name,
          toolCall.arguments
        );
        // Add tool result to chat
      }
    }
  }
}
```

## Usage Example

1. Connect to an MCP server:
```typescript
await mcpStore.connectServer(
  "example-server",
  "node",
  ["server.js"]
);
```

2. Execute a tool:
```typescript
const result = await mcpStore.executeTool(
  "example-server",
  "list-files",
  { path: "/project" }
);
```

3. Access a resource:
```typescript
const content = await mcpStore.getResource(
  "example-server",
  "file:///example.txt"
);
```

4. Get a prompt:
```typescript
const prompt = await mcpStore.getPrompt(
  "example-server",
  "code-review",
  { code: "..." }
);
```

## Best Practices

1. **Error Handling**
   - Always wrap MCP operations in try-catch blocks
   - Provide meaningful error messages to users
   - Handle disconnections gracefully

2. **State Management**
   - Keep MCP state separate from application state
   - Use a centralized store for MCP operations
   - Cache server capabilities when possible

3. **UI/UX**
   - Show loading states during operations
   - Provide clear feedback for tool execution
   - Display tool descriptions and schemas

4. **Type Safety**
   - Define interfaces for all MCP entities
   - Validate responses against schemas
   - Use TypeScript's strict mode

## Next Steps

1. Add support for SSE transport
2. Implement resource viewer
3. Add prompt management UI
4. Improve error handling and recovery
5. Add authentication support
6. Implement caching for resources and prompts 