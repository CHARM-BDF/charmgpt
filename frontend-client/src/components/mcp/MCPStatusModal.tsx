import React, { useEffect } from 'react';
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

    useEffect(() => {
        if (isOpen) {
            fetchStatus();
        }
    }, [isOpen, fetchStatus]);

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
                            <button
                                onClick={handleResetServerBlocks}
                                className="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded-md transition-colors"
                                title="Clear all server block settings"
                            >
                                Reset All
                            </button>
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
                                    </div>
                                </div>
                                
                                {server.isRunning && server.tools && server.tools.length > 0 && (
                                    <div className="mt-2 pl-4 border-l-2 border-gray-200">
                                        <div className="text-sm font-medium text-gray-500 mb-1">Available Tools:</div>
                                        <div className="space-y-1">
                                            {server.tools.map((tool, index) => (
                                                <div key={index} className="text-sm">
                                                    <span className="font-medium text-gray-700">{tool.name}</span>
                                                    {tool.description && (
                                                        <p className="text-gray-500 text-xs mt-0.5">{tool.description}</p>
                                                    )}
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