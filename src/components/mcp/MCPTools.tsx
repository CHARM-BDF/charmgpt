import React from 'react';
import { useMCPStore } from '../../store/mcpStore';

export const MCPTools: React.FC = () => {
  const { servers, activeServer } = useMCPStore();
  const server = activeServer ? servers[activeServer] : null;

  if (!server) return null;

  return (
    <div className="border-t border-gray-200 p-4">
      <div className="mb-4">
        <h3 className="text-lg font-medium">Available Tools</h3>
        <div className="mt-2 space-y-2">
          {server.tools.map((tool) => (
            <div
              key={tool.name}
              className="p-2 bg-gray-50 rounded-lg"
            >
              <div className="font-medium">{tool.name}</div>
              <div className="text-sm text-gray-500">{tool.description}</div>
            </div>
          ))}
        </div>
      </div>

      {server.prompts.length > 0 && (
        <div className="mb-4">
          <h3 className="text-lg font-medium">Available Prompts</h3>
          <div className="mt-2 space-y-2">
            {server.prompts.map((prompt) => (
              <div
                key={prompt.name}
                className="p-2 bg-gray-50 rounded-lg"
              >
                <div className="font-medium">{prompt.name}</div>
                <div className="text-sm text-gray-500">{prompt.description}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
