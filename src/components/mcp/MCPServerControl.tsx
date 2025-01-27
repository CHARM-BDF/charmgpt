import React, { useState } from 'react';
import { useMCPStore } from '../../store/mcpStore';
import type { ServerConfig } from '../../store/mcpStore';

export const MCPServerControl: React.FC = () => {
    const { 
        servers, 
        activeServer, 
        installServer, 
        removeServer, 
        setActiveServer, 
        updateServerStatus 
    } = useMCPStore();
    const [isInstalling, setIsInstalling] = useState(false);
    const [isLoading, setIsLoading] = useState<string | null>(null);
    const [showInstallUI, setShowInstallUI] = useState(false);
    const [installConfig, setInstallConfig] = useState<ServerConfig>({
        name: '',
        transport: 'stdio',
        command: '',
    });

    const handleInstall = async () => {
        try {
            setIsInstalling(true);
            const id = await installServer(installConfig);
            setActiveServer(id);
            // Reset form
            setInstallConfig({
                name: '',
                transport: 'stdio',
                command: '',
            });
            // Hide the install UI after successful installation
            setShowInstallUI(false);
        } catch (error) {
            console.error('Failed to install server:', error);
        } finally {
            setIsInstalling(false);
        }
    };

    const handleStartServer = async (id: string) => {
        try {
            setIsLoading(id);
            updateServerStatus(id, 'running');
            // Note: In Phase 2, this will actually connect to the MCP server
            // and handle real server lifecycle
        } catch (error) {
            console.error('Failed to start server:', error);
            updateServerStatus(id, 'error');
        } finally {
            setIsLoading(null);
        }
    };

    const handleStopServer = async (id: string) => {
        try {
            setIsLoading(id);
            updateServerStatus(id, 'stopped');
            // Note: In Phase 2, this will actually disconnect from the MCP server
            // and handle real server lifecycle
        } catch (error) {
            console.error('Failed to stop server:', error);
            updateServerStatus(id, 'error');
        } finally {
            setIsLoading(null);
        }
    };

    return (
        <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow">
            <div className="mb-4">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">MCP Servers</h2>
                    <button
                        onClick={() => setShowInstallUI(!showInstallUI)}
                        className="px-3 py-1 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-md transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] dark:text-blue-400 dark:hover:text-blue-300 dark:hover:bg-blue-900/50"
                    >
                        {showInstallUI ? 'Hide Install' : 'Install New Server'}
                    </button>
                </div>
                
                {/* Server List */}
                <div className="space-y-2">
                    {Object.entries(servers).map(([id, server]) => (
                        <div
                            key={id}
                            className={`p-2 rounded ${
                                activeServer === id
                                    ? 'bg-blue-100 dark:bg-blue-900'
                                    : 'bg-gray-50 dark:bg-gray-700'
                                }`}
                        >
                            <div className="flex items-center justify-between">
                                <div>
                                    <span className="font-medium">{server.name}</span>
                                    <span className={`ml-2 px-2 py-1 text-xs rounded ${
                                        server.status === 'running'
                                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100'
                                            : server.status === 'error'
                                                ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100'
                                                : 'bg-gray-100 text-gray-800 dark:bg-gray-600 dark:text-gray-100'
                                        }`}>
                                        {server.status}
                                    </span>
                                </div>
                                <div className="space-x-2">
                                    {server.status === 'stopped' ? (
                                        <button
                                            onClick={() => handleStartServer(id)}
                                            disabled={isLoading === id}
                                            className="px-2 py-1 text-sm text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300 disabled:opacity-50"
                                        >
                                            {isLoading === id ? 'Starting...' : 'Start'}
                                        </button>
                                    ) : server.status === 'running' ? (
                                        <button
                                            onClick={() => handleStopServer(id)}
                                            disabled={isLoading === id}
                                            className="px-2 py-1 text-sm text-yellow-600 hover:text-yellow-800 dark:text-yellow-400 dark:hover:text-yellow-300 disabled:opacity-50"
                                        >
                                            {isLoading === id ? 'Stopping...' : 'Stop'}
                                        </button>
                                    ) : null}
                                    <button
                                        onClick={() => setActiveServer(id)}
                                        className="px-2 py-1 text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                                    >
                                        Select
                                    </button>
                                    <button
                                        onClick={() => removeServer(id)}
                                        className="px-2 py-1 text-sm text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                                    >
                                        Remove
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Install New Server Form */}
            {showInstallUI && (
                <div className="border-t pt-4 dark:border-gray-700">
                    <h3 className="text-md font-semibold mb-2 text-gray-900 dark:text-gray-100">Install New Server</h3>
                    <div className="space-y-3">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                Name
                                <input
                                    type="text"
                                    value={installConfig.name}
                                    onChange={(e) => setInstallConfig({ ...installConfig, name: e.target.value })}
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
                                    placeholder="Server name"
                                />
                            </label>
                        </div>
                        
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                Transport
                                <select
                                    value={installConfig.transport}
                                    onChange={(e) => setInstallConfig({ ...installConfig, transport: e.target.value as 'stdio' | 'sse' })}
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
                                >
                                    <option value="stdio">stdio</option>
                                    <option value="sse">SSE</option>
                                </select>
                            </label>
                        </div>

                        {installConfig.transport === 'stdio' ? (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Command
                                    <input
                                        type="text"
                                        value={installConfig.command}
                                        onChange={(e) => setInstallConfig({ ...installConfig, command: e.target.value })}
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
                                        placeholder="Command to start server"
                                    />
                                </label>
                            </div>
                        ) : (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                    URL
                                    <input
                                        type="text"
                                        value={installConfig.url || ''}
                                        onChange={(e) => setInstallConfig({ ...installConfig, url: e.target.value })}
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
                                        placeholder="Server URL"
                                    />
                                </label>
                            </div>
                        )}

                        <button
                            onClick={handleInstall}
                            disabled={isInstalling || !installConfig.name || (!installConfig.command && !installConfig.url)}
                            className="w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-blue-500 dark:hover:bg-blue-600"
                        >
                            {isInstalling ? 'Installing...' : 'Install Server'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}; 