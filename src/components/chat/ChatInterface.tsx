import React from 'react';
import { ChatMessages } from './ChatMessages';
import { ChatInput } from './ChatInput';
import { ArtifactWindow } from '../artifacts/ArtifactWindow';
import { ArtifactControls } from '../artifacts/ArtifactControls';
import { ArtifactDrawer } from '../artifacts/ArtifactDrawer';
import { MCPTools } from '../mcp/MCPTools';
import { MCPServerControl } from '../mcp/MCPServerControl';
import { DarkModeToggle } from '../DarkModeToggle';
import { useChatStore } from '../../store/chatStore';
import { useMCPStore } from '../../store/mcpStore';

export const ChatInterface: React.FC = () => {
  const { messages, showArtifactWindow, clearChat } = useChatStore();
  const { activeServer } = useMCPStore();

  return (
    <div className="flex flex-col h-screen bg-gray-200 dark:bg-gray-900">
      {/* Main Header */}
      <div className="bg-white/90 dark:bg-gray-800/90 border-b border-gray-200 dark:border-gray-700 shadow-sm backdrop-blur-sm">
        <div className="max-w-screen-2xl mx-auto px-4 py-3">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-4">
              <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">MCP Chat Interface</h1>
              <MCPServerControl />
            </div>
            <div className="flex items-center space-x-3">
              <DarkModeToggle />
              <button
                onClick={clearChat}
                className="px-3 py-1 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 rounded-md transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]"
                title="Clear chat history"
              >
                Clear Chat
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Artifact Controls - Always visible */}
      <ArtifactControls />

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Chat Section */}
        <div className={`${showArtifactWindow ? 'w-1/2' : 'w-full'} transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] flex flex-col`}>
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto">
              <div className="w-full max-w-3xl mx-auto px-4 py-6 space-y-6">
                <ChatMessages messages={messages} />
              </div>
            </div>
            <ChatInput />
            {activeServer && <MCPTools />}
          </div>
        </div>

        {/* Artifact Section */}
        {showArtifactWindow && <ArtifactWindow />}
      </div>

      {/* Artifact Drawer - Always mounted, visibility controlled by showList */}
      <ArtifactDrawer />
    </div>
  );
};
