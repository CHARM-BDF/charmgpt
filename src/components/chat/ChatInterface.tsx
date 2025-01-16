import React from 'react';
import { ChatMessages } from './ChatMessages';
import { ChatInput } from './ChatInput';
import { ArtifactWindow } from '../artifacts/ArtifactWindow';
import { MCPServerControl } from '../mcp/MCPServerControl';
import { MCPTools } from '../mcp/MCPTools';
import { useChatStore } from '../../store/chatStore';
import { useMCPStore } from '../../store/mcpStore';

export const ChatInterface: React.FC = () => {
  const { messages, showArtifactWindow, clearMessages } = useChatStore();
  const { activeServer } = useMCPStore();

  return (
    <div className="flex h-screen bg-gray-100">
      <div className={`${showArtifactWindow ? 'w-1/2' : 'w-full'} transition-all duration-300 flex flex-col`}>
        <MCPServerControl />
        <div className="flex justify-end p-2">
          <button
            onClick={clearMessages}
            className="px-3 py-1 text-sm text-red-600 hover:text-red-800 hover:underline"
          >
            Clear Chat History
          </button>
        </div>
        <ChatMessages messages={messages} />
        <ChatInput />
        {activeServer && <MCPTools />}
      </div>
      {showArtifactWindow && <ArtifactWindow />}
    </div>
  );
};
