import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { ChatMessages } from './ChatMessages';
import { ChatInput } from './ChatInput';
import { ArtifactWindow } from '../artifacts/ArtifactWindow';
import { ArtifactDrawer } from '../artifacts/ArtifactDrawer';
import { DarkModeToggle } from '../DarkModeToggle';
import { useChatStore } from '../../store/chatStore';
import { MCPStatusModal } from '../mcp/MCPStatusModal';
import { ModelSelector } from '../models/ModelSelector';
import { ConversationDrawer } from '../conversations/ConversationDrawer';
import BrainWaveCharmStatic from '../animations/BrainWaveCharmStatic';
import { useProjectStore } from '../../store/projectStore';
// @ts-ignore - Heroicons type definitions mismatch
import { ServerIcon, FolderOpenIcon, ListBulletIcon, TrashIcon, ArrowsRightLeftIcon, BoltIcon, ArrowPathIcon, SparklesIcon, RocketLaunchIcon, ForwardIcon, Cog8ToothIcon, PencilIcon } from '@heroicons/react/24/outline';
import { FileManager } from '../files/FileManager';
import { APIStorageService } from '../../services/fileManagement/APIStorageService';
import { useModeStore } from '../../store/modeStore';
import { ProjectDrawer } from '../projects/ProjectDrawer';
import { ProjectListView } from '../projects/ProjectListView';
import { ProjectView } from '../projects/ProjectView';
import { GrantReviewListView } from '../projects/GrantReviewListView';

// Add this new component for the editable conversation title
const ConversationTitle: React.FC = () => {
  const currentConversationId = useChatStore(state => state.currentConversationId);
  const conversations = useChatStore(state => state.conversations);
  const renameConversation = useChatStore(state => state.renameConversation);
  
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  
  const conversationName = currentConversationId && conversations[currentConversationId] 
    ? conversations[currentConversationId].metadata.name 
    : 'Untitled';
  
  const startEditing = () => {
    setEditName(conversationName);
    setIsEditing(true);
  };
  
  const saveEdit = () => {
    if (currentConversationId && editName.trim()) {
      renameConversation(currentConversationId, editName.trim());
    }
    setIsEditing(false);
  };
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      saveEdit();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
    }
  };
  
  if (isEditing) {
    return (
      <div className="relative">
        <input
          type="text"
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          onBlur={saveEdit}
          onKeyDown={handleKeyDown}
          className="text-lg font-normal px-2 py-0.5 border border-blue-400 dark:border-blue-600 rounded bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 outline-none"
          autoFocus
        />
      </div>
    );
  }
  
  return (
    <div className="flex items-center group">
      <span className="text-lg font-normal text-gray-600 dark:text-gray-400">
        {conversationName}
      </span>
      <button 
        onClick={startEditing}
        className="ml-1.5 opacity-0 group-hover:opacity-100 transition-opacity hover:text-blue-600 dark:hover:text-blue-400"
        title="Rename conversation"
      >
        <PencilIcon className="h-4 w-4 text-gray-400 dark:text-gray-500" />
      </button>
    </div>
  );
};

export const ChatInterface: React.FC = () => {
  const { messages, showArtifactWindow, clearChat, artifacts, toggleArtifactWindow, clearArtifacts, showList, setShowList, processMessage, isLoading, streamingEnabled, toggleStreaming } = useChatStore();
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [showFileManager, setShowFileManager] = useState(false);
  const [showProjectList, setShowProjectList] = useState(false);
  const [showProjectView, setShowProjectView] = useState(false);
  const [showGrantReviewList, setShowGrantReviewList] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const storageService = useMemo(() => new APIStorageService('/api/storage'), []);
  const { setMode, currentMode } = useModeStore();
  const { projects, selectedProjectId, selectProject } = useProjectStore();
  
  // Get current conversation ID only - avoid excessive re-renders from other conversation data
  const currentConversationId = useChatStore(state => state.currentConversationId);
  
  // Only look up the conversation data when we need it, avoiding circular dependencies
  const currentConversation = useMemo(() => {
    if (!currentConversationId) return null;
    return useChatStore.getState().conversations[currentConversationId];
  }, [currentConversationId]);
  
  // Get project ID from conversation metadata
  const conversationProjectId = useMemo(() => 
    currentConversation?.metadata?.projectId,
    [currentConversation]
  );
  
  // Get the project based on the conversation's projectId
  const conversationProject = useMemo(() => 
    conversationProjectId ? projects.find(p => p.id === conversationProjectId) : null,
    [projects, conversationProjectId]
  );

  // Effect to log artifact window visibility changes
  useEffect(() => {
    console.log('ChatInterface: showArtifactWindow changed to:', showArtifactWindow);
  }, [showArtifactWindow]);
  
  // Handle showing project view - ensure we select the project from the conversation
  const handleShowProjectView = useCallback(() => {
    if (conversationProjectId) {
      selectProject(conversationProjectId);
    }
    setShowProjectView(true);
  }, [conversationProjectId, selectProject]);

  return (
    <div className="flex flex-col h-screen bg-gray-200 dark:bg-gray-900">
      {/* Main Header */}
      <div className="bg-white/90 dark:bg-gray-800/90 border-b border-gray-200 dark:border-gray-700 shadow-sm backdrop-blur-sm">
        <div className="max-w-screen-2xl mx-auto px-4 py-3">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-4">
              <BrainWaveCharmStatic />
              {conversationProject && (
                <div className="flex items-center">
                  <button
                    onClick={handleShowProjectView}
                    className="text-lg font-medium text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                  >
                    {conversationProject.name}
                  </button>
                  
                  {/* Add slash and conversation name */}
                  {currentConversationId && (
                    <>
                      <span className="mx-2 text-gray-500 dark:text-gray-400">/</span>
                      <ConversationTitle />
                    </>
                  )}
                </div>
              )}
              
              {/* If no project but we have a conversation, just show the conversation title */}
              {!conversationProject && currentConversationId && (
                <ConversationTitle />
              )}
            </div>
            <div className="flex items-center space-x-6">
              {/* Settings Menu */}
              <div className="relative flex items-center space-x-4">
                {/* MCP Server Section - Always visible */}
                <div className="flex flex-col items-center whitespace-nowrap">
                  <button
                    onClick={() => setIsStatusModalOpen(true)}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
                    title="Server Status"
                  >
                    <ServerIcon className="w-5 h-5 text-gray-700 dark:text-gray-300" />
                  </button>
                  <span className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">MCP Server</span>
                </div>

                {/* Animated Container for Controls */}
                <div className={`flex items-center space-x-3 overflow-hidden transition-all duration-300 ease-in-out ${
                  showSettings ? 'w-[412px] opacity-100' : 'w-0 opacity-0'
                }`}>
                  {/* Model Selection with dividers */}
                  <div className="flex items-center px-3 border-x border-gray-200 dark:border-gray-700">
                    <ModelSelector />
                  </div>

                  {/* Files Section */}
                  <div className="flex flex-col items-center whitespace-nowrap">
                    <button
                      onClick={() => setShowFileManager(!showFileManager)}
                      className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
                      title="File Manager"
                    >
                      <FolderOpenIcon className="w-5 h-5 text-gray-700 dark:text-gray-300" />
                    </button>
                    <span className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">Files</span>
                  </div>

                  {/* Display Controls Section */}
                  <div className="flex flex-col items-center whitespace-nowrap">
                    <DarkModeToggle />
                    <span className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">Display</span>
                  </div>

                  {/* Chat Controls Section */}
                  <div className="flex flex-col items-center whitespace-nowrap">
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => setShowList(!showList)}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
                        title={showList ? "Hide List" : "Show List"}
                      >
                        <ListBulletIcon className="w-5 h-5 text-gray-700 dark:text-gray-300" />
                      </button>
                      <button
                        onClick={toggleArtifactWindow}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
                        title="Toggle Artifact Window"
                      >
                        <ArrowsRightLeftIcon className="w-5 h-5 text-gray-700 dark:text-gray-300" />
                      </button>
                      <button
                        onClick={clearChat}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
                        title="Clear chat history"
                      >
                        <TrashIcon className="w-5 h-5 text-gray-700 dark:text-gray-300" />
                      </button>
                    </div>
                    <span className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">Chat Controls</span>
                  </div>

                  {/* Streaming Controls Section */}
                  <div className="flex flex-col items-center whitespace-nowrap">
                    <button
                      onClick={toggleStreaming}
                      className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
                      title={streamingEnabled ? "Disable streaming" : "Enable streaming"}
                    >
                      <ForwardIcon 
                        className={`w-5 h-5 ${
                          streamingEnabled 
                            ? 'text-blue-600 dark:text-blue-400' 
                            : 'text-gray-700 dark:text-gray-300'
                        }`} 
                      />
                    </button>
                    <span className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">Streaming</span>
                  </div>
                </div>

                {/* Settings Toggle Button */}
                <button
                  onClick={() => setShowSettings(!showSettings)}
                  className={`p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-all duration-300 ${
                    showSettings ? 'rotate-180' : ''
                  }`}
                  title="Settings"
                >
                  <Cog8ToothIcon className="w-6 h-6 text-gray-700 dark:text-gray-300" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Drawer - Conditional based on mode */}
        {currentMode === 'grant' ? (
          <ProjectDrawer 
            storageService={storageService}
          />
        ) : (
          <ConversationDrawer 
            setShowProjectList={setShowProjectList}
            setShowProjectView={setShowProjectView}
            setShowGrantReviewList={setShowGrantReviewList}
          />
        )}

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
            <ChatInput storageService={storageService} />
          </div>
        </div>

        {/* Artifact Section */}
        {showArtifactWindow && <ArtifactWindow storageService={storageService} />}
      </div>

      {/* Artifact Drawer - Always mounted, visibility controlled by showList */}
      <ArtifactDrawer />

      <MCPStatusModal 
        isOpen={isStatusModalOpen}
        onClose={() => setIsStatusModalOpen(false)}
      />

      {showProjectList && (
        <ProjectListView 
          onClose={() => setShowProjectList(false)} 
          showProjectList={showProjectList}
        />
      )}

      {showProjectView && (selectedProjectId || conversationProjectId) && (
        <ProjectView 
          projectId={selectedProjectId || conversationProjectId as string}
          onBack={() => setShowProjectView(false)}
          onClose={() => setShowProjectView(false)}
        />
      )}

      {showGrantReviewList && (
        <GrantReviewListView 
          onClose={() => setShowGrantReviewList(false)}
          showGrantReviewList={showGrantReviewList}
        />
      )}
    </div>
  );
};
