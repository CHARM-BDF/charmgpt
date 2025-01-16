import React from 'react';
import { useMCPStore } from '../../store/mcpStore';

export const MCPServerControl: React.FC = () => {
  const { servers, activeServer, connectServer, disconnectServer, setActiveServer } = useMCPStore();

  const handleAddServer = async () => {
    console.log('MCPServerControl: Attempting to connect to server...');
    try {
      // Connect to the TypeScript server file
      await connectServer('llm-chat-server', 'tsx', ['src/server/llm-server.ts']);
      console.log('MCPServerControl: Server connected successfully');
      // Set this server as active immediately after connection
      setActiveServer('llm-chat-server');
    } catch (error) {
      console.error('MCPServerControl: Failed to connect to server:', error);
    }
  };

  console.log('MCPServerControl: Current servers:', Object.keys(servers));
  console.log('MCPServerControl: Active server:', activeServer);

  return (
    <div className="border-b border-gray-200 p-4">
      <div className="flex items-center justify-between">
        <select
          value={activeServer || ''}
          onChange={(e) => setActiveServer(e.target.value || null)}
          className="rounded-lg border border-gray-300 px-3 py-2"
        >
          <option value="">Select Server</option>
          {Object.values(servers).map((server) => (
            <option key={server.name} value={server.name}>
              {server.name}
            </option>
          ))}
        </select>
        <button
          onClick={handleAddServer}
          className="bg-blue-500 text-white px-4 py-2 rounded-lg"
        >
          Add Server
        </button>
      </div>
    </div>
  );
};
