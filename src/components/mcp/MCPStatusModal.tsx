import React, { useEffect } from 'react';
import { Dialog } from '@headlessui/react';
import { useMCPStore } from '../../store/mcpStore';
import { ArrowPathIcon } from '@heroicons/react/24/outline';

interface MCPStatusModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const MCPStatusModal: React.FC<MCPStatusModalProps> = ({ isOpen, onClose }) => {
    const { servers, lastChecked, isLoading, fetchStatus } = useMCPStore();

    useEffect(() => {
        if (isOpen) {
            fetchStatus();
        }
    }, [isOpen, fetchStatus]);

    return (
        <Dialog
            open={isOpen}
            onClose={onClose}
            className="relative z-50"
        >
            <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
            
            <div className="fixed inset-0 flex items-center justify-center p-4">
                <Dialog.Panel className="mx-auto max-w-sm rounded-lg bg-white p-6 shadow-xl">
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

                    <div className="space-y-3">
                        {servers.map(server => (
                            <div key={server.name} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                                <span className="font-medium">{server.name}</span>
                                <div className="flex items-center">
                                    <div 
                                        className={`w-3 h-3 rounded-full ${
                                            server.isRunning ? 'bg-green-500' : 'bg-red-500'
                                        }`}
                                    />
                                    <span className="ml-2 text-sm text-gray-600">
                                        {server.isRunning ? 'Running' : 'Stopped'}
                                    </span>
                                </div>
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