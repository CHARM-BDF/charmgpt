import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { MCPServerState, MCPTool } from '../mcp/types';
import { GraphCommand } from '../types/knowledgeGraph';
import { useChatStore } from './chatStore';

// Define a mapping for migration from shortened names to full technical names
const shortToFullNameMap: Record<string, string> = {
  'brave': 'brave-search',
  'string': 'string-db',
  'server': 'server-sequential-thinking',
  'medik': 'medik-mcp',
  'id': 'id-finder',
  'grant': 'grant-fetch',
  'aims': 'aims-review',
  'mondo': 'mondo-api',
  'cal2': 'cal2-mcp',
  'cal': 'cal-mcp',
  'finder': 'id-finder'
};

// Migrate localStorage entries from shortened names to full technical names
const migrateLocalStorage = () => {
  console.log('🔄 Starting localStorage migration for server block entries...');
  
  // Get all keys in localStorage that match the server-*-blocked pattern
  const serverBlockKeys = Object.keys(localStorage).filter(key => 
    key.startsWith('server-') && key.endsWith('-blocked')
  );
  
  console.log(`Found ${serverBlockKeys.length} server block entries in localStorage:`, serverBlockKeys);
  
  // For each key, check if it uses a shortened name
  let migratedCount = 0;
  serverBlockKeys.forEach(key => {
    // Extract the server name part: server-{name}-blocked
    const serverPart = key.replace('server-', '').replace('-blocked', '');
    
    // Check if this is a shortened name that needs migration
    if (shortToFullNameMap[serverPart]) {
      const fullName = shortToFullNameMap[serverPart];
      const newKey = `server-${fullName}-blocked`;
      const value = localStorage.getItem(key);
      
      console.log(`Migrating: ${key} → ${newKey} (value: ${value})`);
      
      // Set the new key with the same value
      localStorage.setItem(newKey, value!);
      
      // Remove the old key
      localStorage.removeItem(key);
      
      migratedCount++;
    }
  });
  
  console.log(`Migration complete. Migrated ${migratedCount} entries.`);
};

// Run migration on script load
migrateLocalStorage();

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
    handleGraphCommand: (command: GraphCommand) => Promise<boolean>;
    migrateLocalStorageKeys: () => void; // Added new function for manual migration
}

export const useMCPStore = create<MCPStoreState>()(
    persist(
        (set, get) => ({
            servers: [],
            lastChecked: null,
            isLoading: false,
            // Add a public function to trigger migration manually if needed
            migrateLocalStorageKeys: () => {
                migrateLocalStorage();
                // Refetch server status after migration
                get().fetchStatus();
            },
            fetchStatus: async () => {
                set({ isLoading: true });
                try {
                    console.log('\n=== DEBUG: fetchStatus START ===');
                    
                    // Get server status from API
                    const response = await fetch('/api/server-status');
                    const data = await response.json();
                    
                    console.log('Raw server data received from API:', JSON.stringify(data.servers));
                    console.log('Server count:', data.servers.length);
                    
                    // Fetch server names to ensure we're using exact names
                    const serverNamesResponse = await fetch('/api/server-names');
                    const serverNamesData = await serverNamesResponse.json();
                    
                    console.log('Server names from /api/server-names:', JSON.stringify(serverNamesData.serverNames));
                    console.log('Names count:', serverNamesData.serverNames?.length || 0);
                    
                    // Log any discrepancies
                    if (data.servers.length !== serverNamesData.serverNames?.length) {
                        console.log('⚠️ WARNING: Server count mismatch between /api/server-status and /api/server-names');
                        
                        // Find missing servers
                        const statusServerNames = data.servers.map((s: MCPServerState) => s.name);
                        const namesApiNames = serverNamesData.serverNames || [];
                        
                        const missingInStatus = namesApiNames.filter((name: string) => !statusServerNames.includes(name));
                        const missingInNames = statusServerNames.filter((name: string) => !namesApiNames.includes(name));
                        
                        if (missingInStatus.length > 0) {
                            console.log('Servers missing in status API but present in names API:', missingInStatus);
                        }
                        if (missingInNames.length > 0) {
                            console.log('Servers missing in names API but present in status API:', missingInNames);
                        }
                    }
                    
                    // Update servers with their status
                    const updatedServers = data.servers.map((server: MCPServerState) => {
                        // Get blocked status from localStorage using full technical name
                        const isBlocked = localStorage.getItem(`server-${server.name}-blocked`) === 'true';
                        const status = (!server.isRunning ? 'inactive' : 
                                       (isBlocked ? 'blocked' : 'active'));
                        
                        console.log(`Server "${server.name}": API status=${server.status}, localStorage blocked=${isBlocked}, final status=${status}`);
                        
                        return {
                            ...server,
                            status
                        };
                    });
                    
                    set({ 
                        servers: updatedServers,
                        lastChecked: new Date(),
                        isLoading: false 
                    });
                    
                    console.log('Server status updated');
                    console.log('=== END DEBUG: fetchStatus ===\n');
                } catch (error) {
                    console.error('Failed to fetch server status:', error);
                    set({ isLoading: false });
                }
            },
            toggleServerBlock: (serverName: string) => {
                console.log(`\n=== DEBUG: toggleServerBlock for "${serverName}" ===`);
                
                // Find the server by exact technical name
                const server = get().servers.find(s => s.name === serverName);
                
                if (!server) {
                    console.error(`Server not found with name: ${serverName}`);
                    return;
                }
                
                if (!server.isRunning) {
                    console.log(`Server "${serverName}" is not running, cannot toggle block state`);
                    return;
                }
                
                // Check current localStorage state
                const currentState = localStorage.getItem(`server-${serverName}-blocked`);
                console.log(`Current localStorage state for server-${serverName}-blocked: ${currentState}`);
                
                // Toggle block status
                const newBlockedState = currentState !== 'true';
                localStorage.setItem(`server-${serverName}-blocked`, String(newBlockedState));
                console.log(`Setting localStorage for server-${serverName}-blocked to: ${newBlockedState}`);
                
                set((state) => {
                    const updatedServers = state.servers.map(s => {
                        if (s.name === serverName && s.isRunning) {
                            const newStatus = newBlockedState ? 'blocked' as const : 'active' as const;
                            return {
                                ...s,
                                status: newStatus
                            };
                        }
                        return s;
                    });
                    
                    console.log(`Updated state for "${serverName}": status=${newBlockedState ? 'blocked' : 'active'}`);
                    return { servers: updatedServers };
                });
                
                // Call chatStore's method to update if available
                try {
                    console.log('Attempting to notify chat store of server block change');
                    // Access the chat store directly to avoid TypeScript issues
                    // @ts-ignore - bypassing TypeScript to call potential method
                    useChatStore.getState().updateBlockedServers?.();
                } catch (e) {
                    console.log('Error notifying chat store:', e);
                }
                
                console.log('=== END DEBUG: toggleServerBlock ===\n');
            },
            getBlockedServers: () => {
                const state = get();
                
                console.log('\n=== DEBUG: GET BLOCKED SERVERS ===');
                console.log('Current server data from state:');
                state.servers.forEach(server => {
                    console.log(`Server "${server.name}": status=${server.status}, isRunning=${server.isRunning}`);
                });
                
                // Get blocked servers from state - servers with status='blocked'
                const blockedServers = state.servers
                    .filter(server => server.status === 'blocked')
                    .map(server => server.name);
                
                console.log(`Filtered blocked servers (${blockedServers.length}):`, blockedServers);
                console.log('=== END DEBUG: GET BLOCKED SERVERS ===\n');
                
                return blockedServers;
            },
            handleGraphCommand: async (command: GraphCommand) => {
                const chatStore = useChatStore.getState();
                const targetArtifact = chatStore.getLatestGraphVersion(command.targetGraphId);
                
                if (!targetArtifact) {
                    console.error('MCP: Target graph not found', command.targetGraphId);
                    return false;
                }
                
                // Check if the artifact is a knowledge graph
                if (targetArtifact.type !== 'application/vnd.ant.knowledge-graph' && targetArtifact.type !== 'application/vnd.knowledge-graph') {
                    console.error('MCP: Target artifact is not a knowledge graph', targetArtifact);
                    return false;
                }
                
                try {
                    // Parse current graph data
                    const graphData = JSON.parse(targetArtifact.content);
                    
                    // Handler functions for different command types
                    switch (command.type) {
                        case 'groupByProperty': {
                            const { propertyName } = command.params;
                            
                            // Get unique values for the property
                            const propertyValues = new Set<string>();
                            graphData.nodes.forEach((node: any) => {
                                if (node[propertyName] !== undefined) {
                                    propertyValues.add(String(node[propertyName]));
                                }
                            });
                            
                            // Assign group numbers based on property values
                            const valueToGroup = Array.from(propertyValues).reduce((acc, val, index) => {
                                acc[val] = index + 1;
                                return acc;
                            }, {} as Record<string, number>);
                            
                            // Update nodes with group information
                            const updatedNodes = graphData.nodes.map((node: any) => ({
                                ...node,
                                group: node[propertyName] !== undefined ? 
                                    valueToGroup[String(node[propertyName])] : 0
                            }));
                            
                            const newArtifactId = chatStore.updateGraphArtifact(targetArtifact.id, {
                                nodes: updatedNodes,
                                commandDescription: `Group nodes by ${propertyName}`,
                                commandParams: { propertyName },
                                versionLabel: `Grouped by ${propertyName}`
                            });
                            
                            return !!newArtifactId;
                        }
                        
                        case 'filterNodes': {
                            const { predicate, value, customNodes, customLinks } = command.params;
                            
                            let updatedNodes, updatedLinks;
                            
                            // If customNodes and customLinks are provided, use them directly
                            if (customNodes && customLinks) {
                                updatedNodes = customNodes;
                                updatedLinks = customLinks;
                            } else {
                                // Otherwise filter nodes based on predicate
                                updatedNodes = graphData.nodes.filter((node: any) => 
                                    node[predicate] === value
                                );
                                
                                // Only keep links between remaining nodes
                                const nodeIds = new Set(updatedNodes.map((n: any) => n.id));
                                updatedLinks = graphData.links.filter((link: any) => 
                                    nodeIds.has(link.source) && nodeIds.has(link.target)
                                );
                            }
                            
                            const commandDescription = customNodes 
                                ? 'Filter by ID prefix'
                                : `Filter nodes where ${predicate} = ${value}`;
                                
                            const versionLabel = customNodes
                                ? 'Filtered View'
                                : `Filtered by ${predicate}`;
                            
                            const newArtifactId = chatStore.updateGraphArtifact(targetArtifact.id, {
                                nodes: updatedNodes,
                                links: updatedLinks,
                                commandDescription,
                                commandParams: command.params,
                                versionLabel
                            });
                            
                            return !!newArtifactId;
                        }
                        
                        case 'highlightNodes': {
                            const { nodeIds, color = '#ff0000' } = command.params;
                            
                            // Highlight specified nodes
                            const updatedNodes = graphData.nodes.map((node: any) => ({
                                ...node,
                                color: nodeIds.includes(node.id) ? color : node.color
                            }));
                            
                            const newArtifactId = chatStore.updateGraphArtifact(targetArtifact.id, {
                                nodes: updatedNodes,
                                commandDescription: `Highlight nodes`,
                                commandParams: { nodeIds, color },
                                versionLabel: `Highlighted ${nodeIds.length} nodes`
                            });
                            
                            return !!newArtifactId;
                        }
                        
                        case 'resetView': {
                            // Reset to original appearance but keep the same data
                            const updatedNodes = graphData.nodes.map((node: any) => ({
                                ...node,
                                color: undefined,
                                group: undefined
                            }));
                            
                            const newArtifactId = chatStore.updateGraphArtifact(targetArtifact.id, {
                                nodes: updatedNodes,
                                commandDescription: 'Reset view',
                                versionLabel: 'Reset view'
                            });
                            
                            return !!newArtifactId;
                        }
                        
                        // Add other command handlers as needed
                        
                        default:
                            console.warn(`MCP: Unhandled graph command type: ${command.type}`);
                            return false;
                    }
                } catch (error) {
                    console.error('MCP: Error handling graph command:', error);
                    return false;
                }
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
