import React from 'react';
import { useMCPStore } from '../../store/mcpStore';

export const MCPServerControl: React.FC = () => {
  const { servers, activeServer, connectServer, disconnectServer, setActiveServer } = useMCPStore();

  const handleAddServer = async () => {
    // This is a simplified example - you'd want to get these values from a form
    await connectServer('filesystem', 'npx', ['-y', '@modelcontextprotocol/server-filesystem', '/']);
  };

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
