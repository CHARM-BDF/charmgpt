import React, { useState, useMemo } from 'react';
import { ChatMessages } from './ChatMessages';
import { ChatInput } from './ChatInput';
import { ArtifactWindow } from '../artifacts/ArtifactWindow';
import { ArtifactControls } from '../artifacts/ArtifactControls';
import { ArtifactDrawer } from '../artifacts/ArtifactDrawer';
// import { MCPTools } from '../mcp/MCPTools';
// import { MCPServerControl } from '../mcp/MCPServerControl';
import { DarkModeToggle } from '../DarkModeToggle';
import { useChatStore } from '../../store/chatStore';
import { MCPStatusModal } from '../mcp/MCPStatusModal';
import { ServerIcon, FolderOpenIcon } from '@heroicons/react/24/outline';
// import { useMCPStore } from '../../store/mcpStore';
import { FileManager } from '../files/FileManager';
import { APIStorageService } from '../../services/fileManagement/APIStorageService';

export const ChatInterface: React.FC = () => {
  const { messages, showArtifactWindow, clearChat } = useChatStore();
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [showFileManager, setShowFileManager] = useState(false);
  const storageService = useMemo(() => new APIStorageService(), []);
  // const { activeServer } = useMCPStore();

  return (
    <div className="flex flex-col h-screen bg-gray-200 dark:bg-gray-900">
      {/* Main Header */}
      <div className="bg-white/90 dark:bg-gray-800/90 border-b border-gray-200 dark:border-gray-700 shadow-sm backdrop-blur-sm">
        <div className="max-w-screen-2xl mx-auto px-4 py-3">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-4">
              <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">MCP Chat Interface</h1>
              {/* <MCPServerControl /> */}
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setShowFileManager(!showFileManager)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
                title="File Manager"
              >
                <FolderOpenIcon className="w-5 h-5 text-gray-700 dark:text-gray-300" />
              </button>
              <button
                onClick={() => setIsStatusModalOpen(true)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
                title="Server Status"
              >
                <ServerIcon className="w-5 h-5 text-gray-700 dark:text-gray-300" />
              </button>
              <DarkModeToggle />
              <button
                onClick={clearChat}
                className="px-3 py-1 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-900/20 rounded-md transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]"
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
        {/* File Manager Modal */}
        {showFileManager && (
          <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-start justify-center pt-16 z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl m-4 max-h-[80vh] overflow-y-auto">
              <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">File Manager</h2>
                <button
                  onClick={() => setShowFileManager(false)}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  <span className="sr-only">Close</span>
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <FileManager storageService={storageService} />
            </div>
          </div>
        )}

        {/* Chat Section */}
        <div className={`${showArtifactWindow ? 'w-1/2' : 'w-full'} transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] flex flex-col`}>
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto">
              <div className="w-full max-w-3xl mx-auto px-4 py-6 space-y-6">
                <ChatMessages messages={messages} />
              </div>
            </div>
            <ChatInput />
            {/* {activeServer && <MCPTools serverId={activeServer} onToolSelect={() => {}} onResourceSelect={() => {}} onPromptSelect={() => {}} />} */}
          </div>
        </div>

        {/* Artifact Section */}
        {showArtifactWindow && <ArtifactWindow />}
      </div>

      {/* Artifact Drawer - Always mounted, visibility controlled by showList */}
      <ArtifactDrawer />

      <MCPStatusModal 
        isOpen={isStatusModalOpen}
        onClose={() => setIsStatusModalOpen(false)}
      />
    </div>
  );
};
