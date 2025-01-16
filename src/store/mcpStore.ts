import { create } from 'zustand';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { MCPServer, MCPResource, MCPPrompt, MCPTool } from '../types/mcp';
import { z } from 'zod';

const responseSchema = z.object({});

interface ExtendedMCPServer extends MCPServer {
  client: Client;
}

interface MCPState {
  servers: Record<string, ExtendedMCPServer>;
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

      const toolsResponse = await client.request({ method: "tools/list", params: {} }, responseSchema);
      const resourcesResponse = await client.request({ method: "resources/list", params: {} }, responseSchema);
      const promptsResponse = await client.request({ method: "prompts/list", params: {} }, responseSchema);

      set((state) => ({
        servers: {
          ...state.servers,
          [name]: {
            name,
            tools: (toolsResponse as any).tools || [],
            resources: (resourcesResponse as any).resources || [],
            prompts: (promptsResponse as any).prompts || [],
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
      set((state) => {
        const { [name]: removed, ...rest } = state.servers;
        return {
          servers: rest,
          activeServer: state.activeServer === name ? null : state.activeServer
        };
      });
    }
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
    }, responseSchema);

    return (response as any).content[0].text;
  },

  listResources: async (serverName) => {
    const server = get().servers[serverName];
    if (!server?.client) throw new Error(`Server ${serverName} not connected`);

    const response = await server.client.request({
      method: "resources/list",
      params: {}
    }, responseSchema);
    return (response as any).resources || [];
  },

  readResource: async (serverName, uri) => {
    const server = get().servers[serverName];
    if (!server?.client) throw new Error(`Server ${serverName} not connected`);

    const response = await server.client.request({
      method: "resources/read",
      params: { uri }
    }, responseSchema);

    return (response as any).contents[0].text;
  },

  listPrompts: async (serverName) => {
    const server = get().servers[serverName];
    if (!server?.client) throw new Error(`Server ${serverName} not connected`);

    const response = await server.client.request({
      method: "prompts/list",
      params: {}
    }, responseSchema);
    return (response as any).prompts || [];
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
    }, responseSchema);

    return (response as any).messages[0].content.text;
  }
}));
