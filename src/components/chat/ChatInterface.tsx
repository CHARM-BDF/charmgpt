import React from 'react';
import { ChatMessages } from './ChatMessages';
import { ChatInput } from './ChatInput';
import { ArtifactWindow } from '../artifacts/ArtifactWindow';
import { MCPServerControl } from '../mcp/MCPServerControl';
import { MCPTools } from '../mcp/MCPTools';
import { useChatStore } from '../../store/chatStore';
import { useMCPStore } from '../../store/mcpStore';

export const ChatInterface: React.FC = () => {
  const { messages, showArtifactWindow } = useChatStore();
  const { activeServer } = useMCPStore();

  return (
    <div className="flex h-screen bg-gray-100">
      <div className={`${showArtifactWindow ? 'w-1/2' : 'w-full'} transition-all duration-300 flex flex-col`}>
        <MCPServerControl />
        <ChatMessages messages={messages} />
        <ChatInput />
        {activeServer && <MCPTools />}
      </div>
      {showArtifactWindow && <ArtifactWindow />}
    </div>
  );
};
