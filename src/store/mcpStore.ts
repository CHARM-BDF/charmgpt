import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { MCPServerState, MCPTool } from '../mcp/types';
import { GraphCommand } from '../types/knowledgeGraph';
import { useChatStore } from './chatStore';

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
