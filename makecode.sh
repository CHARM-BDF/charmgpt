#!/bin/bash

# Exit on error
set -e

# Check if project directory exists
if [ ! -d "src" ]; then
    echo "Error: src directory not found. Are you in the project root?"
    exit 1
fi

# Create MCP Store
cat > src/store/mcpStore.ts << 'EOL'
import { create } from 'zustand';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { MCPServer } from '../types/mcp';

interface MCPState {
  servers: Record<string, MCPServer>;
  activeServer: string | null;
  
  connectServer: (name: string, command: string, args: string[]) => Promise<void>;
  disconnectServer: (name: string) => Promise<void>;
  setActiveServer: (name: string | null) => void;
  executeTool: (serverName: string, toolName: string, args: any) => Promise<string>;
  listResources: (serverName: string) => Promise<MCPResource[]>;
  readResource: (serverName: string, uri: string) => Promise<string>;
  listPrompts: (serverName: string) => Promise<MCPPrompt[]>;
  getPrompt: (serverName: string, name: string, args?: Record<string, any>) => Promise<string>;
}

export const useMCPStore = create<MCPState>()((set, get) => ({
  servers: {},
  activeServer: null,

  connectServer: async (name, command, args) => {
    try {
      const transport = new StdioClientTransport({
        command,
        args
      });

      const client = new Client(
        {
          name: "chat-interface",
          version: "1.0.0"
        },
        {
          capabilities: {
            tools: {},
            resources: {},
            prompts: {}
          }
        }
      );

      await client.connect(transport);

      const tools = await client.request({ method: "tools/list" });
      const resources = await client.request({ method: "resources/list" });
      const prompts = await client.request({ method: "prompts/list" });

      set((state) => ({
        servers: {
          ...state.servers,
          [name]: {
            name,
            tools: tools.tools,
            resources: resources.resources,
            prompts: prompts.prompts,
            connected: true,
            client
          }
        }
      }));
    } catch (error) {
      console.error(`Failed to connect to MCP server ${name}:`, error);
      throw error;
    }
  },

  disconnectServer: async (name) => {
    const server = get().servers[name];
    if (server?.client) {
      await server.client.disconnect();
    }
    
    set((state) => {
      const { [name]: removed, ...rest } = state.servers;
      return {
        servers: rest,
        activeServer: state.activeServer === name ? null : state.activeServer
      };
    });
  },

  setActiveServer: (name) => set({ activeServer: name }),

  executeTool: async (serverName, toolName, args) => {
    const server = get().servers[serverName];
    if (!server?.client) throw new Error(`Server ${serverName} not connected`);

    const response = await server.client.request({
      method: "tools/call",
      params: {
        name: toolName,
        arguments: args
      }
    });

    return response.content[0].text;
  },

  listResources: async (serverName) => {
    const server = get().servers[serverName];
    if (!server?.client) throw new Error(`Server ${serverName} not connected`);

    const response = await server.client.request({
      method: "resources/list"
    });

    return response.resources;
  },

  readResource: async (serverName, uri) => {
    const server = get().servers[serverName];
    if (!server?.client) throw new Error(`Server ${serverName} not connected`);

    const response = await server.client.request({
      method: "resources/read",
      params: { uri }
    });

    return response.contents[0].text;
  },

  listPrompts: async (serverName) => {
    const server = get().servers[serverName];
    if (!server?.client) throw new Error(`Server ${serverName} not connected`);

    const response = await server.client.request({
      method: "prompts/list"
    });

    return response.prompts;
  },

  getPrompt: async (serverName, name, args) => {
    const server = get().servers[serverName];
    if (!server?.client) throw new Error(`Server ${serverName} not connected`);

    const response = await server.client.request({
      method: "prompts/get",
      params: {
        name,
        arguments: args
      }
    });

    return response.messages[0].content.text;
  }
}));
EOL

# Create Chat Components
cat > src/components/chat/ChatMessages.tsx << 'EOL'
import React from 'react';
import { Message } from '../../types/chat';
import { useChatStore } from '../../store/chatStore';

export const ChatMessages: React.FC<{ messages: Message[] }> = ({ messages }) => {
  const { selectArtifact } = useChatStore();
  
  return (
    <div className="flex-1 overflow-y-auto p-4">
      {messages.map((message) => (
        <div
          key={message.id}
          className={`flex ${message.role === 'assistant' ? 'justify-start' : 'justify-end'} mb-4`}
        >
          <div className={`max-w-3/4 rounded-lg p-4 ${
            message.role === 'assistant' 
              ? 'bg-white border border-gray-200' 
              : 'bg-blue-500 text-white'
          }`}>
            {message.content}
            {message.artifactId && (
              <button
                onClick={() => selectArtifact(message.artifactId)}
                className="mt-2 text-sm underline"
              >
                View Artifact
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};
EOL

cat > src/components/chat/ChatInput.tsx << 'EOL'
import React, { useState } from 'react';
import { useChatStore } from '../../store/chatStore';

export const ChatInput: React.FC = () => {
  const [input, setInput] = useState('');
  const { addMessage } = useChatStore();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    addMessage({
      role: 'user',
      content: input,
    });
    setInput('');
  };

  return (
    <form onSubmit={handleSubmit} className="p-4 border-t border-gray-200">
      <div className="flex space-x-4">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="flex-1 rounded-lg border border-gray-300 px-4 py-2"
          placeholder="Type a message..."
        />
        <button
          type="submit"
          className="bg-blue-500 text-white px-6 py-2 rounded-lg"
        >
          Send
        </button>
      </div>
    </form>
  );
};
EOL

# Create Artifact Components
cat > src/components/artifacts/ArtifactWindow.tsx << 'EOL'
import React from 'react';
import { useChatStore } from '../../store/chatStore';
import { ArtifactContent } from './ArtifactContent';

export const ArtifactWindow: React.FC = () => {
  const {
    artifacts,
    selectedArtifactId,
    selectArtifact,
    toggleArtifactWindow,
  } = useChatStore();

  const selectedArtifact = artifacts.find(a => a.id === selectedArtifactId);

  return (
    <div className="w-1/2 border-l border-gray-200 bg-white flex flex-col">
      <div className="p-4 border-b border-gray-200 flex justify-between items-center">
        <h2 className="text-lg font-semibold">Artifacts</h2>
        <button
          onClick={() => toggleArtifactWindow()}
          className="text-gray-500 hover:text-gray-700"
        >
          <span className="sr-only">Close</span>
          ×
        </button>
      </div>
      
      <div className="flex-1 flex">
        <div className="w-64 border-r border-gray-200 overflow-y-auto">
          {artifacts.map((artifact) => (
            <button
              key={artifact.id}
              onClick={() => selectArtifact(artifact.id)}
              className={`w-full p-4 text-left hover:bg-gray-50 ${
                selectedArtifactId === artifact.id ? 'bg-blue-50' : ''
              }`}
            >
              <div className="font-medium">{artifact.title}</div>
              <div className="text-sm text-gray-500">
                {artifact.timestamp.toLocaleTimeString()}
              </div>
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {selectedArtifact && (
            <ArtifactContent artifact={selectedArtifact} />
          )}
        </div>
      </div>
    </div>
  );
};
EOL

cat > src/components/artifacts/ArtifactContent.tsx << 'EOL'
import React from 'react';
import { Artifact } from '../../types/artifacts';

export const ArtifactContent: React.FC<{
  artifact: Artifact;
}> = ({ artifact }) => {
  const renderContent = () => {
    switch (artifact.type) {
      case 'code':
        return (
          <pre className="bg-gray-50 p-4 rounded-lg">
            <code>{artifact.content}</code>
          </pre>
        );
      case 'image/svg+xml':
        return <div dangerouslySetInnerHTML={{ __html: artifact.content }} />;
      case 'application/vnd.ant.mermaid':
        return <div className="mermaid">{artifact.content}</div>;
      default:
        return <div className="prose">{artifact.content}</div>;
    }
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="mb-4">
        <h3 className="text-lg font-medium">{artifact.title}</h3>
        <p className="text-sm text-gray-500">Type: {artifact.type}</p>
      </div>
      {renderContent()}
    </div>
  );
};
EOL

# Create MCP Components
cat > src/components/mcp/MCPTools.tsx << 'EOL'
import React from 'react';
import { useMCPStore } from '../../store/mcpStore';

export const MCPTools: React.FC = () => {
  const { servers, activeServer } = useMCPStore();
  const server = activeServer ? servers[activeServer] : null;

  if (!server) return null;

  return (
    <div className="border-t border-gray-200 p-4">
      <div className="mb-4">
        <h3 className="text-lg font-medium">Available Tools</h3>
        <div className="mt-2 space-y-2">
          {server.tools.map((tool) => (
            <div
              key={tool.name}
              className="p-2 bg-gray-50 rounded-lg"
            >
              <div className="font-medium">{tool.name}</div>
              <div className="text-sm text-gray-500">{tool.description}</div>
            </div>
          ))}
        </div>
      </div>

      {server.prompts.length > 0 && (
        <div className="mb-4">
          <h3 className="text-lg font-medium">Available Prompts</h3>
          <div className="mt-2 space-y-2">
            {server.prompts.map((prompt) => (
              <div
                key={prompt.name}
                className="p-2 bg-gray-50 rounded-lg"
              >
                <div className="font-medium">{prompt.name}</div>
                <div className="text-sm text-gray-500">{prompt.description}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
EOL

cat > src/components/mcp/MCPServerControl.tsx << 'EOL'
import React from 'react';
import { useMCPStore } from '../../store/mcpStore';

export const MCPServerControl: React.FC = () => {
  const { servers, activeServer, connectServer, disconnectServer, setActiveServer } = useMCPStore();

  const handleAddServer = async () => {
    // This is a simplified example - you'd want to get these values from a form
    await connectServer('filesystem', 'npx', ['-y', '@modelcontextprotocol/server-filesystem', '/']);
  };

  return (
    <div className="border-b border-gray-200 p-4">
      <div className="flex items-center justify-between">
        <select
          value={activeServer || ''}
          onChange={(e) => setActiveServer(e.target.value || null)}
          className="rounded-lg border border-gray-300 px-3 py-2"
        >
          <option value="">Select Server</option>
          {Object.values(servers).map((server) => (
            <option key={server.name} value={server.name}>
              {server.name}
            </option>
          ))}
        </select>
        <button
          onClick={handleAddServer}
          className="bg-blue-500 text-white px-4 py-2 rounded-lg"
        >
          Add Server
        </button>
      </div>
    </div>
  );
};
EOL

# Create tools directory content
cat > src/tools/webSearch.ts << 'EOL'
import { Tool } from '../types/mcp';

export const webSearchTool: Tool = {
  name: 'web-search',
  description: 'Search the web for information',
  execute: async (query: string) => {
    // Implement actual web search here
    return `Search results for: ${query}`;
  }
};
EOL

# Update App.tsx
cat > src/App.tsx << 'EOL'
import React from 'react';
import { ChatInterface } from './components/chat/ChatInterface';

function App() {
  return (
    <div className="h-screen">
      <ChatInterface />
    </div>
  );
}

export default App;
EOL

echo "Components have been split into their respective files! 🎉"
EOL