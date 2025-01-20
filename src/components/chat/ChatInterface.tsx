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
    <div className="flex h-screen bg-gray-100 dark:bg-gray-900">
      <div className={`${showArtifactWindow ? 'w-1/2' : 'w-full'} transition-all duration-300 flex flex-col`}>
        <MCPServerControl />
        <div className="flex justify-between items-center p-2 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <div className="flex items-center gap-2">
            <button
              onClick={toggleArtifactWindow}
              className="px-3 py-1 text-sm bg-blue-500 text-white hover:bg-blue-600 rounded flex items-center gap-2"
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
            <DarkModeToggle />
          </div>
          <button
            onClick={clearMessages}
            className="px-3 py-1 text-sm text-red-600 hover:text-red-800 hover:underline dark:text-red-400 dark:hover:text-red-300"
          >
            Clear Chat History
          </button>
          <button
            onClick={clearChat}
            className="px-3 py-1 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors duration-200"
            title="Clear chat history"
          >
            Clear Chat
          </button>
        </div>
        <div className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-gray-800">
          <ChatMessages messages={messages} />
          <div className="flex-shrink-0">
            <ChatInput />
            {activeServer && <MCPTools />}
          </div>
        </div>
      </div>
      {showArtifactWindow && <ArtifactWindow />}
    </div>
  );
};
