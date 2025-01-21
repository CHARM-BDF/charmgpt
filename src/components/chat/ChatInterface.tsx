import React from 'react';
import { ChatMessages } from './ChatMessages';
import { ChatInput } from './ChatInput';
import { ArtifactWindow } from '../artifacts/ArtifactWindow';
import { MCPServerControl } from '../mcp/MCPServerControl';
import { MCPTools } from '../mcp/MCPTools';
import { useChatStore } from '../../store/chatStore';
import { useMCPStore } from '../../store/mcpStore';
import { DarkModeToggle } from '../DarkModeToggle';

export const ChatInterface: React.FC = () => {
  const { messages, showArtifactWindow, toggleArtifactWindow, clearMessages, clearChat } = useChatStore();
  const { activeServer } = useMCPStore();

  return (
    <div className="flex flex-col h-screen bg-gradient-to-b from-white to-gray-50 dark:from-gray-800 dark:to-gray-900">
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

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Chat Section */}
        <div className={`${showArtifactWindow ? 'w-1/2' : 'w-full'} transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] flex flex-col`}>
          <div className="flex justify-between items-center p-2 border-b border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm">
            <div className="flex items-center gap-2">
              <button
                onClick={toggleArtifactWindow}
                className="px-3 py-1 text-sm bg-blue-500 text-white hover:bg-blue-600 rounded flex items-center gap-2 transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]"
              >
                {showArtifactWindow ? (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M4 3a1 1 0 011-1h10a1 1 0 011 1v14a1 1 0 01-1 1H5a1 1 0 01-1-1V3zm3 0v14h6V3H7z" clipRule="evenodd" />
                    </svg>
                    Hide Artifacts
                  </>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M4 4a1 1 0 011-1h10a1 1 0 011 1v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4zm4 0v12h4V4H8z" clipRule="evenodd" />
                    </svg>
                    Show Artifacts
                  </>
                )}
              </button>
            </div>
          </div>
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
    </div>
  );
};
