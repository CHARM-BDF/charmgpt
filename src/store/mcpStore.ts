import { create } from 'zustand';

export interface ServerTool {
    name: string;
    description?: string;
    inputSchema?: {
        type: string;
        properties?: Record<string, unknown>;
    };
}

export interface ServerStatus {
    name: string;
    isRunning: boolean;
    tools?: ServerTool[];
}

interface MCPStoreState {
    servers: ServerStatus[];
    lastChecked: Date | null;
    isLoading: boolean;
    fetchStatus: () => Promise<void>;
}

export const useMCPStore = create<MCPStoreState>((set) => ({
    servers: [],
    lastChecked: null,
    isLoading: false,
    fetchStatus: async () => {
        set({ isLoading: true });
        try {
            const response = await fetch('/api/server-status');
            const data = await response.json();
            set({ 
                servers: data.servers,
                lastChecked: new Date(),
                isLoading: false 
            });
        } catch (error) {
            console.error('Failed to fetch server status:', error);
            set({ isLoading: false });
        }
    }
}));
