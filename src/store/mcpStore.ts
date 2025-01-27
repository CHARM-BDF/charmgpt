import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface ServerConfig {
  name: string;
  transport: 'stdio' | 'sse';
  command?: string;
  args?: string[];
  url?: string;
}

export interface ResourceInfo {
  name: string;
  uri: string;
  description?: string;
}

export interface ToolInfo {
  name: string;
  description?: string;
  parameters: Record<string, any>;
}

export interface PromptInfo {
  name: string;
  description?: string;
  parameters: Record<string, any>;
}

interface MCPServerState {
  servers: {
    [id: string]: {
      name: string;
      version: string;
      status: 'running' | 'stopped' | 'error';
      capabilities: {
        resources?: boolean;
        tools?: boolean;
        prompts?: boolean;
      };
      transport: 'stdio' | 'sse';
      config: {
        command?: string;
        args?: string[];
        url?: string;
      };
    };
  };
  activeServer: string | null;
  serverResponses: {
    [serverId: string]: {
      resources: ResourceInfo[];
      tools: ToolInfo[];
      prompts: PromptInfo[];
    };
  };
  installServer: (config: ServerConfig) => Promise<string>;
  removeServer: (id: string) => void;
  setActiveServer: (id: string | null) => void;
  updateServerStatus: (id: string, status: 'running' | 'stopped' | 'error') => void;
  updateServerCapabilities: (id: string, capabilities: MCPServerState['servers'][string]['capabilities']) => void;
  updateServerResponses: (
    id: string,
    responses: {
      resources?: ResourceInfo[];
      tools?: ToolInfo[];
      prompts?: PromptInfo[];
    }
  ) => void;
}

export const useMCPStore = create<MCPServerState>()(
  persist(
    (set, get) => ({
      servers: {},
      activeServer: null,
      serverResponses: {},

      installServer: async (config: ServerConfig) => {
        const id = `mcp-${Date.now()}`;
        // Check if server with same name exists
        const existingServer = Object.values(get().servers).find(
          server => server.name === config.name
        );
        if (existingServer) {
          throw new Error(`Server with name ${config.name} already exists`);
        }

        set((state) => ({
          servers: {
            ...state.servers,
            [id]: {
              name: config.name,
              version: '1.0.0', // Default version
              status: 'stopped',
              capabilities: {},
              transport: config.transport,
              config: {
                command: config.command,
                args: config.args,
                url: config.url,
              },
            },
          },
        }));
        return id;
      },

      removeServer: (id: string) => {
        const state = get();
        // Check if server exists
        if (!state.servers[id]) {
          throw new Error('Server not found');
        }
        // Don't allow removing running servers
        if (state.servers[id].status === 'running') {
          throw new Error('Cannot remove running server');
        }

        set((state) => {
          const { [id]: _, ...remainingServers } = state.servers;
          const { [id]: __, ...remainingResponses } = state.serverResponses;
          return {
            servers: remainingServers,
            serverResponses: remainingResponses,
            activeServer: state.activeServer === id ? null : state.activeServer,
          };
        });
      },

      setActiveServer: (id: string | null) => {
        // Validate server exists if id is provided
        if (id && !get().servers[id]) {
          throw new Error('Server not found');
        }
        set({ activeServer: id });
      },

      updateServerStatus: (id: string, status: 'running' | 'stopped' | 'error') => {
        const state = get();
        // Check if server exists
        if (!state.servers[id]) {
          throw new Error('Server not found');
        }
        // Clear responses when server stops or errors
        if (status !== 'running') {
          set((state) => {
            const { [id]: _, ...remainingResponses } = state.serverResponses;
            return { serverResponses: remainingResponses };
          });
        }

        set((state) => ({
          servers: {
            ...state.servers,
            [id]: {
              ...state.servers[id],
              status,
            },
          },
        }));
      },

      updateServerCapabilities: (id: string, capabilities: MCPServerState['servers'][string]['capabilities']) => {
        const state = get();
        // Check if server exists
        if (!state.servers[id]) {
          throw new Error('Server not found');
        }
        // Only allow updating capabilities of running servers
        if (state.servers[id].status !== 'running') {
          throw new Error('Can only update capabilities of running servers');
        }

        set((state) => ({
          servers: {
            ...state.servers,
            [id]: {
              ...state.servers[id],
              capabilities,
            },
          },
        }));
      },

      updateServerResponses: (
        id: string,
        responses: {
          resources?: ResourceInfo[];
          tools?: ToolInfo[];
          prompts?: PromptInfo[];
        }
      ) => {
        const state = get();
        // Check if server exists
        if (!state.servers[id]) {
          throw new Error('Server not found');
        }
        // Only allow updating responses of running servers
        if (state.servers[id].status !== 'running') {
          throw new Error('Can only update responses of running servers');
        }

        set((state) => ({
          serverResponses: {
            ...state.serverResponses,
            [id]: {
              resources: responses.resources || state.serverResponses[id]?.resources || [],
              tools: responses.tools || state.serverResponses[id]?.tools || [],
              prompts: responses.prompts || state.serverResponses[id]?.prompts || [],
            },
          },
        }));
      },
    }),
    {
      name: 'mcp-store',
    }
  )
);
