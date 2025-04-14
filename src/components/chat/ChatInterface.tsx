import React, { useState, useMemo, useEffect } from 'react';
import { ChatMessages } from './ChatMessages';
import { ChatInput } from './ChatInput';
import { ArtifactWindow } from '../artifacts/ArtifactWindow';
import { ArtifactDrawer } from '../artifacts/ArtifactDrawer';
// import { MCPTools } from '../mcp/MCPTools';
// import { MCPServerControl } from '../mcp/MCPServerControl';
import { DarkModeToggle } from '../DarkModeToggle';
import { useChatStore } from '../../store/chatStore';
import { MCPStatusModal } from '../mcp/MCPStatusModal';
import { ModelSelector } from '../models/ModelSelector';
import { ConversationDrawer } from '../conversations/ConversationDrawer';
import BrainWaveCharmStatic from '../animations/BrainWaveCharmStatic';
import { useProjectStore } from '../../store/projectStore';
// @ts-ignore - Heroicons type definitions mismatch
import { ServerIcon, FolderOpenIcon, ListBulletIcon, TrashIcon, ArrowsRightLeftIcon, BoltIcon, ArrowPathIcon, SparklesIcon, RocketLaunchIcon, ForwardIcon, BeakerIcon, FolderIcon } from '@heroicons/react/24/outline';
// import { useMCPStore } from '../../store/mcpStore';
import { FileManager } from '../files/FileManager';
import { APIStorageService } from '../../services/fileManagement/APIStorageService';
import KnowledgeGraphTestButton from '../artifacts/KnowledgeGraphTestButton';
import { useModeStore } from '../../store/modeStore';
import { ProjectDrawer } from '../projects/ProjectDrawer';
import { ProjectListView } from '../projects/ProjectListView';
import { ProjectView } from '../projects/ProjectView';

export const ChatInterface: React.FC = () => {
  const { messages, showArtifactWindow, clearChat, artifacts, toggleArtifactWindow, clearArtifacts, showList, setShowList, processMessage, isLoading, streamingEnabled, toggleStreaming } = useChatStore();
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [showFileManager, setShowFileManager] = useState(false);
  const [showTestingTools, setShowTestingTools] = useState(false);
  const [showProjectList, setShowProjectList] = useState(false);
  const [showProjectView, setShowProjectView] = useState(false);
  const storageService = useMemo(() => new APIStorageService('/api/storage'), []);
  const { setMode, currentMode } = useModeStore();
  const { projects, selectedProjectId, selectProject } = useProjectStore();
  
  const selectedProject = useMemo(() => 
    selectedProjectId ? projects.find(p => p.id === selectedProjectId) : null,
    [projects, selectedProjectId]
  );

  // Effect to log artifact window visibility changes
  useEffect(() => {
    console.log('ChatInterface: showArtifactWindow changed to:', showArtifactWindow);
  }, [showArtifactWindow]);

  // Close testing tools dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      
      // Check if the click is on the testing tools button itself (which has its own handler)
      const isTestingButton = target.closest('button') && 
        target.closest('button')?.getAttribute('title') === 'Testing Tools';
      
      // Check if the click is inside the dropdown menu or any button
      const isInsideDropdown = target.closest('.testing-tools-dropdown');
      const isButton = target.tagName === 'BUTTON' || target.closest('button');
      
      // Only close if the click is outside both the container and dropdown AND not on any button
      if (!target.closest('.testing-tools-container') && !isTestingButton && !isInsideDropdown && !isButton) {
        setShowTestingTools(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Close testing tools dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      
      // Check if the click is on the testing tools button itself
      const isTestingButton = target.closest('button') && 
        target.closest('button')?.getAttribute('title') === 'Testing Tools';
      
      // Check if the click is inside the dropdown menu
      const isInsideDropdown = target.closest('.testing-tools-dropdown');
      
      // Only close if the click is outside both the button and dropdown
      if (!isTestingButton && !isInsideDropdown) {
        setShowTestingTools(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Simple click outside handler for testing tools dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // If testing tools dropdown is not shown, do nothing
      if (!showTestingTools) return;
      
      const target = event.target as HTMLElement;
      
      // Check if click is on the testing tools button
      const isOnButton = target.closest('button')?.getAttribute('title') === 'Testing Tools';
      
      // Check if click is inside the dropdown
      const isInDropdown = target.closest('.testing-tools-dropdown') !== null;
      
      // Only close if click is outside both the button and dropdown
      if (!isOnButton && !isInDropdown) {
        setShowTestingTools(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showTestingTools]);

  return (
    <div className="flex flex-col h-screen bg-gray-200 dark:bg-gray-900">
      {/* Main Header */}
      <div className="bg-white/90 dark:bg-gray-800/90 border-b border-gray-200 dark:border-gray-700 shadow-sm backdrop-blur-sm">
        <div className="max-w-screen-2xl mx-auto px-4 py-3">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-4">
              <BrainWaveCharmStatic />
              {selectedProject && (
                <button
                  onClick={() => setShowProjectView(true)}
                  className="text-lg font-medium text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                >
                  {selectedProject.name}
                </button>
              )}
              {/* <MCPServerControl /> */}
            </div>
            <div className="flex items-center space-x-6">
              {/* Mode Buttons */}
              <div className="flex space-x-4">
                {/* Grant Mode */}
                <div className="flex flex-col items-center">
                  <div className="flex items-center">
                    <button
                      onClick={() => setMode('grant')}
                      className={`p-1 rounded-full transition-colors ${
                        currentMode === 'grant' 
                          ? 'bg-blue-100 dark:bg-blue-900/30 hover:bg-blue-200 dark:hover:bg-blue-800/30' 
                          : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                      }`}
                      title="Grant Review Mode"
                    >
                      <img 
                        src="/logos/grantmode_icon.png" 
                        alt="Grant Mode" 
                        className="w-8 h-8"
                      />
                    </button>
                  </div>
                  <span className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">Grant Mode</span>
                </div>

                {/* Project List Mode */}
                <div className="flex flex-col items-center">
                  <div className="flex items-center">
                    <button
                      onClick={() => {
                        if (selectedProjectId) {
                          selectProject(null);
                        }
                        setShowProjectList(true);
                      }}
                      className={`p-1 rounded-full transition-colors ${
                        showProjectList 
                          ? 'bg-blue-100 dark:bg-blue-900/30 hover:bg-blue-200 dark:hover:bg-blue-800/30' 
                          : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                      }`}
                      title="Project List"
                    >
                      <FolderIcon className="w-8 h-8 text-gray-700 dark:text-gray-300" />
                    </button>
                  </div>
                  <span className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">Projects</span>
                </div>

                {/* Research Mode */}
                <div className="flex flex-col items-center">
                  <div className="flex items-center">
                    <button
                      onClick={() => setMode('research')}
                      className={`p-1 rounded-full transition-colors ${
                        currentMode === 'research' 
                          ? 'bg-blue-100 dark:bg-blue-900/30 hover:bg-blue-200 dark:hover:bg-blue-800/30' 
                          : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                      }`}
                      title="Research Mode"
                    >
                      <BeakerIcon className="w-8 h-8 text-gray-700 dark:text-gray-300" />
                    </button>
                  </div>
                  <span className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">Research Mode</span>
                </div>
              </div>

              {/* Divider */}
              <div className="w-px h-6 bg-gray-200 dark:bg-gray-700" />

              {/* Model Selection */}
              <ModelSelector />

              {/* Files Section */}
              <div className="flex flex-col items-center">
                <div className="flex items-center">
                  <button
                    onClick={() => setShowFileManager(!showFileManager)}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
                    title="File Manager"
                  >
                    <FolderOpenIcon className="w-5 h-5 text-gray-700 dark:text-gray-300" />
                  </button>
                </div>
                <span className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">Files</span>
              </div>

              {/* MCP Server Section */}
              <div className="flex flex-col items-center">
                <div className="flex items-center">
                  <button
                    onClick={() => setIsStatusModalOpen(true)}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
                    title="Server Status"
                  >
                    <ServerIcon className="w-5 h-5 text-gray-700 dark:text-gray-300" />
                  </button>
                </div>
                <span className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">MCP Server</span>
              </div>

              {/* Display Controls Section */}
              <div className="flex flex-col items-center">
                <div className="flex items-center space-x-3">
                  <DarkModeToggle />
                </div>
                <span className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">Display</span>
              </div>

              <div className="w-px h-6 bg-gray-200 dark:bg-gray-700" />
              
              {/* Chat Controls Section */}
              <div className="flex flex-col items-center">
                <div className="flex items-center space-x-3">
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

              <div className="w-px h-6 bg-gray-200 dark:bg-gray-700" />
              
              {/* Streaming Controls Section */}
              <div className="flex flex-col items-center">
                <div className="flex items-center space-x-3">
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
                </div>
                <span className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">Streaming</span>
              </div>

              <div className="w-px h-6 bg-gray-200 dark:bg-gray-700" />
              
              {/* Testing Tools Section */}
              <div className="flex flex-col items-center testing-tools-container">
                <div className="flex items-center space-x-3">
                  <div className="relative">
                    <button
                      className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
                      title="Testing Tools"
                      onClick={() => setShowTestingTools(!showTestingTools)}
                    >
                      <BeakerIcon className="w-5 h-5 text-gray-700 dark:text-gray-300" />
                    </button>
                    {showTestingTools && (
                      <div 
                        className="fixed top-20 right-4 w-64 bg-white dark:bg-gray-800 rounded-md shadow-lg border border-gray-200 dark:border-gray-700 z-[9999] testing-tools-dropdown"
                      >
                        <div className="p-3">
                          <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">Knowledge Graph Tests</h3>
                          <KnowledgeGraphTestButton />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <span className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">Testing</span>
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
            {/* {activeServer && <MCPTools serverId={activeServer} onToolSelect={() => {}} onResourceSelect={() => {}} onPromptSelect={() => {}} />} */}
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

      {showProjectView && selectedProjectId && (
        <ProjectView 
          projectId={selectedProjectId}
          onBack={() => setShowProjectView(false)}
          onClose={() => setShowProjectView(false)}
        />
      )}
    </div>
  );
};
