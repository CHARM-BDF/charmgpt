import React, { useEffect } from 'react';
import { Dialog } from '@headlessui/react';
import { useMCPStore } from '../../store/mcpStore';
import { ArrowPathIcon } from '@heroicons/react/24/outline';
import { Switch } from '@headlessui/react';

interface MCPStatusModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const MCPStatusModal: React.FC<MCPStatusModalProps> = ({ isOpen, onClose }) => {
    const { servers, lastChecked, isLoading, fetchStatus, toggleServerBlock } = useMCPStore();

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
        if (!server.isRunning) return 'Inactive';
        return server.status === 'blocked' ? 'Blocked' : 'Active';
    };

    return (
        <Dialog
            open={isOpen}
            onClose={onClose}
            className="relative z-50"
        >
            <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
            
            <div className="fixed inset-0 flex items-center justify-center p-4">
                <Dialog.Panel className="mx-auto w-[900px] max-h-[80vh] rounded-lg bg-white p-6 shadow-xl">
                    <div className="flex justify-between items-center mb-4">
                        <Dialog.Title className="text-lg font-medium">
                            MCP Server Status
                        </Dialog.Title>
                        <button
                            onClick={() => fetchStatus()}
                            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                            disabled={isLoading}
                        >
                            <ArrowPathIcon className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
                        </button>
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
                                            checked={server.status !== 'blocked'}
                                            onChange={() => server.isRunning && toggleServerBlock(server.name)}
                                            disabled={!server.isRunning}
                                            className={`${
                                                server.isRunning ? (
                                                    server.status === 'blocked' 
                                                        ? 'bg-blue-500' 
                                                        : 'bg-green-500'
                                                ) : 'bg-gray-200'
                                            } relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2`}
                                        >
                                            <span
                                                className={`${
                                                    server.status !== 'blocked' ? 'translate-x-6' : 'translate-x-1'
                                                } inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}
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