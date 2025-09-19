import React, { useEffect, useState } from 'react';
import { Dialog } from '@headlessui/react';
import { useMCPStore } from '../../store/mcpStore';
import { ArrowPathIcon } from '@heroicons/react/24/outline';
import { Switch } from '@headlessui/react';
import { clearAllServerBlocks } from '../../utils/serverBlockUtils';

interface MCPStatusModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const MCPStatusModal: React.FC<MCPStatusModalProps> = ({ isOpen, onClose }) => {
    const { servers, lastChecked, isLoading, fetchStatus, toggleServerBlock, migrateLocalStorageKeys } = useMCPStore();
    
    // State to track enabled tools for each server
    const [enabledTools, setEnabledTools] = useState<Record<string, Record<string, boolean>>>({});

    useEffect(() => {
        if (isOpen) {
            fetchStatus();
        }
    }, [isOpen, fetchStatus]);

    // Initialize enabled tools when servers change
    useEffect(() => {
        const newEnabledTools: Record<string, Record<string, boolean>> = {};
        servers.forEach(server => {
            if (server.tools) {
                newEnabledTools[server.name] = {};
                server.tools.forEach(tool => {
                    // Initialize all tools as enabled by default
                    newEnabledTools[server.name][tool.name] = true;
                });
            }
        });
        setEnabledTools(newEnabledTools);
    }, [servers]);

    // Helper to get the current three-state value for server tools
    const getServerToolsState = (serverName: string, tools: any[], serverStatus: string) => {
        // If server is blocked, no tools are effectively enabled
        if (serverStatus === 'blocked') {
            return false;
        }
        const { enabled, total } = getToolCounts(serverName, tools);
        if (enabled === 0) return false;
        if (enabled === total) return true;
        return 'indeterminate';
    };

    const getStatusColor = (server: { isRunning: boolean; status: string }) => {
        if (!server.isRunning) return 'bg-red-500'; // Inactive
        return server.status === 'blocked' ? 'bg-blue-500' : 'bg-green-500'; // Blocked or Active
    };

    const getStatusText = (server: { isRunning: boolean; status: string }) => {
        if (!server.isRunning) return 'Not available';
        return server.status === 'blocked' ? 'Inactive' : 'Active';
    };

    const handleResetServerBlocks = () => {
        if (window.confirm('Are you sure you want to clear ALL server block settings? This cannot be undone.')) {
            clearAllServerBlocks();
            fetchStatus(); // Refresh the UI
        }
    };

    // Helper function to get tool counts for a server
    const getToolCounts = (serverName: string, tools: any[]) => {
        if (!enabledTools[serverName]) return { enabled: tools.length, total: tools.length };
        
        const enabled = tools.filter(tool => enabledTools[serverName][tool.name] !== false).length;
        return { enabled, total: tools.length };
    };

    // Helper function to toggle all tools for a server
    const toggleAllTools = (serverName: string, tools: any[]) => {
        const { enabled, total } = getToolCounts(serverName, tools);
        const newState = enabled < total; // If not all enabled, enable all; otherwise disable all
        
        setEnabledTools(prev => ({
            ...prev,
            [serverName]: {
                ...prev[serverName],
                ...Object.fromEntries(tools.map(tool => [tool.name, newState]))
            }
        }));
    };

    return (
        <Dialog
            open={isOpen}
            onClose={onClose}
            className="relative z-50"
        >
            <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
            
            <div className="fixed inset-0 flex items-center justify-center p-4">
                <Dialog.Panel className="mx-auto w-[900px] max-h-[80vh] rounded-lg bg-white p-6 shadow-xl" data-test="mcp-status-modal">
                    <div className="flex justify-between items-center mb-4">
                        <Dialog.Title className="text-lg font-medium">
                            MCP Server Status
                        </Dialog.Title>
                        <div className="flex items-center space-x-2">
                            <button
                                onClick={() => fetchStatus()}
                                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                                disabled={isLoading}
                                title="Refresh server status"
                            >
                                <ArrowPathIcon className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
                            </button>
                            <button
                                onClick={() => migrateLocalStorageKeys()}
                                className="px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                                title="Migrate server names to full technical names"
                            >
                                Fix Names
                            </button>
                            {/* Replace Reset All button with three-state checkbox */}
                            <div className="flex items-center space-x-2">
                                <input
                                    type="checkbox"
                                    checked={(() => {
                                        const runningServers = servers.filter(s => s.isRunning);
                                        const activeServers = runningServers.filter(s => s.status !== 'blocked');
                                        return activeServers.length === runningServers.length && runningServers.length > 0;
                                    })()}
                                    ref={(el) => {
                                        if (el) {
                                            const runningServers = servers.filter(s => s.isRunning);
                                            const activeServers = runningServers.filter(s => s.status !== 'blocked');
                                            el.indeterminate = activeServers.length > 0 && activeServers.length < runningServers.length;
                                        }
                                    }}
                                    onChange={(e) => {
                                        const runningServers = servers.filter(s => s.isRunning);
                                        const activeServers = runningServers.filter(s => s.status !== 'blocked');
                                        
                                        if (activeServers.length === runningServers.length) {
                                            // All servers active -> block all servers AND deselect all tools
                                            console.log('Top-level: Blocking all servers and clearing all tools');
                                            
                                            // First, clear all tool selections immediately
                                            setEnabledTools(prev => {
                                                const newState = { ...prev };
                                                servers.forEach(server => {
                                                    if (server.tools) {
                                                        console.log(`Clearing tools for server: ${server.name}`);
                                                        newState[server.name] = Object.fromEntries(
                                                            server.tools.map(tool => [tool.name, false])
                                                        );
                                                    }
                                                });
                                                return newState;
                                            });
                                            
                                            // Then block servers
                                            runningServers.forEach(server => {
                                                if (server.status !== 'blocked') {
                                                    console.log(`Blocking server: ${server.name}`);
                                                    toggleServerBlock(server.name);
                                                }
                                            });
                                        } else {
                                            // Some/all servers blocked -> activate all servers AND select all tools
                                            runningServers.forEach(server => {
                                                if (server.status === 'blocked') {
                                                    toggleServerBlock(server.name);
                                                }
                                            });
                                            // Enable all tool selections
                                            setEnabledTools(prev => {
                                                const newState = { ...prev };
                                                runningServers.forEach(server => {
                                                    if (server.tools) {
                                                        newState[server.name] = Object.fromEntries(
                                                            server.tools.map(tool => [tool.name, true])
                                                        );
                                                    }
                                                });
                                                return newState;
                                            });
                                        }
                                    }}
                                    className="w-4 h-4"
                                    title="Toggle all servers"
                                />
                                <span className="text-sm text-gray-600">
                                    {(() => {
                                        const runningServers = servers.filter(s => s.isRunning);
                                        const activeServers = runningServers.filter(s => s.status !== 'blocked');
                                        return `${activeServers.length} of ${runningServers.length} MCP`;
                                    })()}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="overflow-y-auto max-h-[calc(80vh-8rem)] space-y-3">
                        {servers.map(server => (
                            <div key={server.name} className="flex flex-col p-4 bg-gray-50 rounded-lg">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="font-medium">{server.name}</span>
                                    <div className="flex items-center space-x-4">
                                        <div className="flex items-center">
                                            <div 
                                                className={`w-3 h-3 rounded-full ${getStatusColor(server)}`}
                                            />
                                            <span className="ml-2 text-sm text-gray-600">
                                                {getStatusText(server)}
                                            </span>
                                        </div>
                                        
                                        {/* Replace Switch with three-state checkbox for tools */}
                                        {server.isRunning && server.tools && server.tools.length > 0 ? (
                                            <div className="flex items-center space-x-2">
                                                <input
                                                    type="checkbox"
                                                    checked={getServerToolsState(server.name, server.tools, server.status) === true}
                                                    ref={(el) => {
                                                        if (el && server.tools) {
                                                            const state = getServerToolsState(server.name, server.tools, server.status);
                                                            el.indeterminate = state === 'indeterminate';
                                                        }
                                                    }}
                                                    onChange={() => {
                                                        if (server.tools) {
                                                            // If server is blocked, unblock it first
                                                            if (server.status === 'blocked') {
                                                                toggleServerBlock(server.name);
                                                            }
                                                            toggleAllTools(server.name, server.tools);
                                                        }
                                                    }}
                                                    className="w-4 h-4"
                                                />
                                                <span className="text-sm text-gray-600">
                                                    {(() => {
                                                        const { enabled, total } = getToolCounts(server.name, server.tools);
                                                        return `${enabled} of ${total} tools`;
                                                    })()}
                                                </span>
                                            </div>
                                        ) : (
                                            <Switch
                                                data-test="mcp-server-button"
                                                checked={server.status !== 'blocked'}
                                                onChange={() => {
                                                    if (server.isRunning) {
                                                        console.log(`\n=== DEBUG: UI TOGGLE SERVER BLOCK ===`);
                                                        console.log(`Toggling block state for server "${server.name}"`);
                                                        console.log(`Current status: ${server.status}`);
                                                        console.log(`Will change to: ${server.status === 'blocked' ? 'active' : 'blocked'}`);
                                                        toggleServerBlock(server.name);
                                                        console.log(`=== END DEBUG: UI TOGGLE SERVER BLOCK ===\n`);
                                                    }
                                                }}
                                                disabled={!server.isRunning}
                                                className={`${
                                                    server.isRunning ? (
                                                        server.status === 'blocked' 
                                                            ? 'bg-blue-500' 
                                                            : 'bg-green-500'
                                                    ) : 'bg-gray-200'
                                                } relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2`}
                                            >
                                                <span
                                                    className={`${
                                                        server.status !== 'blocked' ? 'translate-x-4' : 'translate-x-1'
                                                    } inline-block h-3 w-3 transform rounded-full bg-white transition-transform`}
                                                />
                                            </Switch>
                                        )}
                                    </div>
                                </div>
                                
                                {server.isRunning && server.tools && server.tools.length > 0 && (
                                    <div className="mt-2 pl-4 border-l-2 border-gray-200">
                                        <div className="text-sm font-medium text-gray-500 mb-2">Tools:</div>
                                        <div className="space-y-2">
                                            {server.tools.map((tool, index) => (
                                                <div key={index} className="flex items-start space-x-3">
                                                    <input
                                                        type="checkbox"
                                                        checked={server.status !== 'blocked' && enabledTools[server.name]?.[tool.name] !== false}
                                                        onChange={(e) => {
                                                            // If checking a tool and server is blocked, unblock it first
                                                            if (e.target.checked && server.status === 'blocked') {
                                                                toggleServerBlock(server.name);
                                                            }
                                                            setEnabledTools(prev => ({
                                                                ...prev,
                                                                [server.name]: {
                                                                    ...prev[server.name],
                                                                    [tool.name]: e.target.checked
                                                                }
                                                            }));
                                                        }}
                                                    className="w-4 h-4 mt-0.5 flex-shrink-0"
                                                    />
                                                    <div className="flex-1 min-w-0">
                                                        <div className="font-medium text-gray-700 text-sm">{tool.name}</div>
                                                        {tool.description && (
                                                            <p className="text-gray-500 text-xs mt-0.5">{tool.description}</p>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}

                        {servers.length === 0 && !isLoading && (
                            <div className="text-center text-gray-500 py-4">
                                No servers configured
                            </div>
                        )}

                        {isLoading && (
                            <div className="text-center text-gray-500 py-4">
                                Loading server status...
                            </div>
                        )}
                    </div>

                    {lastChecked && (
                        <div className="mt-4 text-sm text-gray-500 text-right">
                            Last checked: {lastChecked.toLocaleTimeString()}
                        </div>
                    )}

                    <div className="mt-2 p-3 bg-blue-50 rounded-md text-sm text-blue-700">
                        <p className="font-medium">Note about server blocking:</p>
                        <p className="mt-1">
                            When servers are blocked, the system uses <span className="font-mono bg-blue-100 px-1 rounded">exact server names</span> for matching.
                            The server name shown above is the exact name used by the system.
                        </p>
                    </div>

                    <div className="mt-6 flex justify-end">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                        >
                            Close
                        </button>
                    </div>
                </Dialog.Panel>
            </div>
        </Dialog>
    );
}; 