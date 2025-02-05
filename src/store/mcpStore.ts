import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { MCPServerState, MCPTool } from '../mcp/types';

export interface ServerTool {
    name: string;
    description?: string;
    inputSchema?: {
        type: string;
        properties?: Record<string, unknown>;
    };
}

type ServerStatus = 'inactive' | 'active' | 'blocked';

interface MCPStoreState {
    servers: MCPServerState[];
    lastChecked: Date | null;
    isLoading: boolean;
    fetchStatus: () => Promise<void>;
    toggleServerBlock: (serverName: string) => void;
    getBlockedServers: () => string[];
}

export const useMCPStore = create<MCPStoreState>()(
    persist(
        (set, get) => ({
            servers: [],
            lastChecked: null,
            isLoading: false,
            fetchStatus: async () => {
                set({ isLoading: true });
                try {
                    const response = await fetch('/api/server-status');
                    const data = await response.json();
                    
                    // Convert server data to include status
                    const updatedServers = data.servers.map((server: MCPServerState) => ({
                        ...server,
                        // If server is not running, it's inactive
                        // If it's running, check localStorage for blocked status
                        status: (!server.isRunning ? 'inactive' : 
                                localStorage.getItem(`server-${server.name}-blocked`) === 'true' ? 
                                'blocked' : 'active') as ServerStatus
                    }));
                    
                    set({ 
                        servers: updatedServers,
                        lastChecked: new Date(),
                        isLoading: false 
                    });
                } catch (error) {
                    console.error('Failed to fetch server status:', error);
                    set({ isLoading: false });
                }
            },
            toggleServerBlock: (serverName: string) => {
                set((state) => {
                    const updatedServers = state.servers.map(server => {
                        if (server.name === serverName && server.isRunning) {
                            const newStatus = server.status === 'blocked' ? 'active' as const : 'blocked' as const;
                            // Persist the blocked status and explicitly remove if unblocked
                            if (newStatus === 'blocked') {
                                localStorage.setItem(`server-${server.name}-blocked`, 'true');
                            } else {
                                localStorage.removeItem(`server-${server.name}-blocked`);
                            }
                            
                            // Log the status change and localStorage state
                            console.log(`[Server Status Change] ${server.name}: ${server.status} -> ${newStatus}`);
                            console.log(`[LocalStorage] server-${server.name}-blocked: ${localStorage.getItem(`server-${server.name}-blocked`)}`);
                            
                            return {
                                ...server,
                                status: newStatus
                            };
                        }
                        return server;
                    });

                    // Log current state of all servers
                    console.log('\n=== Current Server States ===');
                    updatedServers.forEach(server => {
                        console.log(`${server.name}: ${server.status.toUpperCase()} (Running: ${server.isRunning}, Blocked: ${server.status === 'blocked'})`);
                    });
                    console.log('===========================\n');

                    return { servers: updatedServers };
                });
            },
            getBlockedServers: () => {
                const state = get();
                return state.servers
                    .filter(server => server.status === 'blocked')
                    .map(server => server.name);
            }
        }),
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
);
