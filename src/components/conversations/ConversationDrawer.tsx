import React, { useState, useEffect, useRef } from 'react';
import { useChatStore } from '../../store/chatStore';
import { useProjectStore } from '../../store/projectStore';
import { ConversationList } from './ConversationList';
// @ts-ignore - Heroicons type definitions mismatch
import { SparklesIcon, ChevronRightIcon, FolderIcon, ArrowsPointingOutIcon, BeakerIcon, TrashIcon } from '@heroicons/react/24/outline';

interface ConversationDrawerProps {
  onShowProjects?: () => void;
  setShowProjectList?: (show: boolean) => void;
  setShowProjectView?: (show: boolean) => void;
  setShowGrantReviewList?: (show: boolean) => void;
}

export const ConversationDrawer: React.FC<ConversationDrawerProps> = ({ 
  onShowProjects,
  setShowProjectList,
  setShowProjectView,
  setShowGrantReviewList
}) => {
  const [isVisible, setIsVisible] = useState(true); // Always show at least the collapsed view
  const [isExpanded, setIsExpanded] = useState(false); // Track expanded/collapsed state
  const [isBulkEditMode, setIsBulkEditMode] = useState(false);
  const [selectedConversationIds, setSelectedConversationIds] = useState<Set<string>>(new Set());
  const drawerRef = useRef<HTMLDivElement>(null);
  const { startNewConversation, switchConversation, conversations, deleteConversation } = useChatStore();
  const { projects } = useProjectStore();
  
  // Get regular projects (not grant reviews)
  const regularProjects = projects
    ?.filter(p => p.type !== 'grant_review')
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 3) || [];
  
  // Get recent grant review projects
  const grantReviewProjects = projects
    ?.filter(p => p.type === 'grant_review')
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 3) || [];
  
  // console.log('ConversationDrawer: All projects:', projects?.length || 0);
  // console.log('ConversationDrawer: Regular projects:', regularProjects.length);
  // console.log('ConversationDrawer: Grant review projects:', grantReviewProjects.length);
  // console.log('ConversationDrawer: Project types:', projects?.map(p => ({ id: p.id.substring(0, 6), name: p.name, type: p.type })));
  
  // Handle keyboard events (Escape to collapse)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isExpanded) {
        setIsExpanded(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isExpanded]);

  const handleNewConversation = () => {
    const newId = startNewConversation();
    switchConversation(newId);
    useProjectStore.getState().selectProject(null);
    // Auto-collapse after creating a new conversation for a cleaner UI
    setIsExpanded(false);
  };

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  // Function to navigate to the projects view (for View All)
  const navigateToProjects = () => {
    if (setShowProjectList) {
      // Clear any selected project and show the list
      useProjectStore.getState().selectProject(null);
      setShowProjectList(true);
      // Auto-collapse after navigating to projects for a cleaner UI
      setIsExpanded(false);
    }
  };

  // Navigate to a specific project - now also shows the ProjectView
  const openProject = (projectId: string) => {
    useProjectStore.getState().selectProject(projectId);
    if (setShowProjectView) {
      setShowProjectView(true);
    }
    setIsExpanded(false);
  };

  const handleBulkDelete = () => {
    const count = selectedConversationIds.size;
    if (window.confirm(`Are you sure you want to delete ${count} conversation${count > 1 ? 's' : ''}?`)) {
      selectedConversationIds.forEach(id => deleteConversation(id));
      setSelectedConversationIds(new Set());
      setIsBulkEditMode(false);
    }
  };

  const handleConversationSelect = (id: string, selected: boolean) => {
    const newSelected = new Set(selectedConversationIds);
    if (selected) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
    }
    setSelectedConversationIds(newSelected);
  };

  // Calculate the width class based on current state
  const widthClass = isExpanded ? 'w-72' : 'w-16';

  return (
    <div
      ref={drawerRef}
      className={`relative h-full bg-white dark:bg-gray-800 shadow-lg 
                 transition-all duration-300 ease-in-out
                 border-r border-gray-200 dark:border-gray-700
                 rounded-tr-xl rounded-br-xl
                 ${widthClass} overflow-hidden flex-shrink-0`}
      aria-expanded={isExpanded}
    >
      {/* Icon-only sidebar view */}
      <div className={`h-full flex flex-col items-center py-6 space-y-8 ${isExpanded ? 'opacity-0' : 'opacity-100'} transition-opacity duration-200`}>
        {/* Expand button */}
        <button
          onClick={toggleExpanded}
          className="p-2.5 rounded-full text-gray-400 hover:text-gray-900 dark:text-gray-500 dark:hover:text-gray-100
                   hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
          title="Expand Sidebar"
          aria-label="Expand Sidebar"
        >
          <div className="flex -space-x-3">
            <ChevronRightIcon className="w-5 h-5" />
            <ChevronRightIcon className="w-5 h-5" />
          </div>
        </button>
        
        {/* New chat button */}
        <button
          onClick={handleNewConversation}
          className="p-2.5 rounded-full text-gray-400 hover:text-gray-900 dark:text-gray-500 dark:hover:text-gray-100
                   hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500
                   relative group"
          title="New Conversation"
          aria-label="New Conversation"
        >
          <div className="w-6 h-6 flex items-center justify-center bg-gray-200 dark:bg-gray-600 rounded-full
                        group-hover:bg-blue-500 dark:group-hover:bg-blue-600 transition-colors">
            <span className="text-sm font-semibold leading-none group-hover:text-white">+</span>
          </div>
          {/* Tooltip */}
          <span className="absolute left-full ml-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-100 whitespace-nowrap">
            New Conv
          </span>
        </button>
        
        {/* Projects button */}
        <button
          onClick={navigateToProjects}
          className="p-2.5 rounded-full text-gray-400 hover:text-gray-900 dark:text-gray-500 dark:hover:text-gray-100
                   hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500
                   relative group"
          title="Projects"
          aria-label="Show Projects"
        >
          <FolderIcon className="w-6 h-6 group-hover:text-blue-500 dark:group-hover:text-blue-400 transition-colors" />
          {/* Tooltip */}
          <span className="absolute left-full ml-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-100 whitespace-nowrap">
            Projects
          </span>
        </button>

        {/* Grant Review button */}
        <button
          onClick={() => {
            console.log('Grant Review button clicked');
            console.log('setShowGrantReviewList prop:', setShowGrantReviewList);
            setShowGrantReviewList?.(true);
            console.log('After calling setShowGrantReviewList(true)');
          }}
          className="p-2.5 rounded-full text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100
                   hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500
                   relative group"
          title="Grant Reviews"
          aria-label="Show Grant Reviews"
        >
          <img 
            src="/logos/grantmode_icon.png" 
            alt="Grant Review"
            className="w-8 h-8 opacity-80 group-hover:opacity-100 group-hover:[filter:invert(48%)_sepia(95%)_saturate(1000%)_hue-rotate(195deg)_brightness(102%)_contrast(101%)] transition-all" 
          />
          {/* Tooltip */}
          <span className="absolute left-full ml-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-100 whitespace-nowrap">
            Grant Reviews
          </span>
        </button>
      </div>

      {/* Expanded sidebar content */}
      {isExpanded && (
        <div className="absolute inset-y-0 left-0 right-0 bg-white dark:bg-gray-800 p-4 overflow-hidden">
          <div className="flex justify-end mb-2">
            <button
              onClick={toggleExpanded}
              className="p-1.5 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100
                       hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              title="Collapse"
            >
              <ChevronRightIcon className="w-5 h-5 rotate-180" />
            </button>
          </div>
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2">
              <SparklesIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Conversation
              </h2>
            </div>
            <button
              onClick={handleNewConversation}
              className="p-1.5 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100
                       hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors
                       flex items-center gap-1"
              title="New Conversation"
            >
              <span className="w-5 h-5 flex items-center justify-center bg-gray-200 dark:bg-gray-600 rounded-full">
                <span className="text-sm font-semibold leading-none">+</span>
              </span>
            </button>
          </div>
          
          {/* Projects section */}
          <div className="mb-4">
            <div className="flex justify-between items-center mb-2">
              <div 
                className="flex items-center gap-2 cursor-pointer group/title hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                onClick={navigateToProjects}
              >
                <FolderIcon className="w-5 h-5 text-gray-600 dark:text-gray-400 group-hover/title:text-blue-600 dark:group-hover/title:text-blue-400 transition-colors" />
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 group-hover/title:text-blue-600 dark:group-hover/title:text-blue-400 transition-colors">
                  Projects
                </h2>
              </div>
              <button
                onClick={() => {
                  console.log("ConversationDrawer: New Project button clicked");
                  // Get the addProject function
                  const { addProject } = useProjectStore.getState();
                  const projectName = "New Project";
                  
                  // Add the project and get the ID directly
                  console.log("ConversationDrawer: About to create new project:", projectName);
                  const newProjectId = addProject({
                    name: projectName,
                    description: "",
                    type: 'project'
                  });
                  console.log("ConversationDrawer: New project created with ID:", newProjectId);
                  
                  // Use the ID directly instead of searching
                  console.log("ConversationDrawer: Selecting project with ID:", newProjectId);
                  useProjectStore.getState().selectProject(newProjectId);
                  console.log("ConversationDrawer: Setting showProjectView to true");
                  setShowProjectView?.(true);
                  setIsExpanded(false);
                  
                  // Extra verification - log all projects after creation
                  const { projects, selectedProjectId } = useProjectStore.getState();
                  console.log("ConversationDrawer: All projects after creation:", 
                    projects.map(p => ({ id: p.id, name: p.name, type: p.type }))
                  );
                  console.log("ConversationDrawer: Currently selected project ID:", selectedProjectId);
                }}
                className="p-1.5 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100
                       hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors
                       flex items-center gap-1"
                title="New Project"
              >
                <span className="w-5 h-5 flex items-center justify-center bg-gray-200 dark:bg-gray-600 rounded-full">
                  <span className="text-sm font-semibold leading-none">+</span>
                </span>
              </button>
            </div>
          </div>
          
          {/* Grant Review section */}
          <div className="mb-4">
            <div className="flex justify-between items-center mb-2">
              <div 
                className="flex items-center gap-2 cursor-pointer group/title hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                onClick={() => setShowGrantReviewList?.(true)}
              >
                <img 
                  src="/logos/grantmode_icon.png" 
                  alt="Grant Review"
                  className="w-5 h-5 opacity-80 group-hover/title:opacity-100 group-hover/title:[filter:invert(48%)_sepia(95%)_saturate(1000%)_hue-rotate(195deg)_brightness(102%)_contrast(101%)] transition-all" 
                />
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 group-hover/title:text-blue-600 dark:group-hover/title:text-blue-400 transition-colors">
                  Grant Reviews
                </h2>
              </div>
              <button
                onClick={() => {
                  console.log("ConversationDrawer: New Grant Review button clicked");
                  // Get the addProject function
                  const { addProject } = useProjectStore.getState();
                  const projectName = "New Grant Review";
                  
                  // Add the project and get the ID directly
                  console.log("ConversationDrawer: About to create new grant review:", projectName);
                  const newProjectId = addProject({
                    name: projectName,
                    description: "",
                    type: 'grant_review',
                    grantMetadata: {
                      requiredDocuments: []
                    }
                  });
                  console.log("ConversationDrawer: New grant review created with ID:", newProjectId);
                  
                  // Use the ID directly instead of searching
                  console.log("ConversationDrawer: Selecting grant review with ID:", newProjectId);
                  useProjectStore.getState().selectProject(newProjectId);
                  console.log("ConversationDrawer: Setting showProjectView to true");
                  setShowProjectView?.(true);
                  setIsExpanded(false);
                  
                  // Extra verification - log all projects after creation
                  const { projects, selectedProjectId } = useProjectStore.getState();
                  console.log("ConversationDrawer: All projects after creation:", 
                    projects.map(p => ({ id: p.id, name: p.name, type: p.type }))
                  );
                  console.log("ConversationDrawer: Currently selected project ID:", selectedProjectId);
                }}
                className="p-1.5 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100
                       hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors
                       flex items-center gap-1"
                title="New Grant Review"
              >
                <span className="w-5 h-5 flex items-center justify-center bg-gray-200 dark:bg-gray-600 rounded-full">
                  <span className="text-sm font-semibold leading-none">+</span>
                </span>
              </button>
            </div>
          </div>
          
          {/* Conversation list */}
          <div className="mt-8">
            <div className="flex items-center gap-2 mb-2">
              <SparklesIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Conversations
              </h2>
            </div>
            
            {/* Bulk Edit Toggle */}
            <div className="flex items-center justify-between mb-3">
              <button
                onClick={() => {
                  setIsBulkEditMode(!isBulkEditMode);
                  setSelectedConversationIds(new Set());
                }}
                className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
              >
                {isBulkEditMode ? 'Cancel Bulk Edit' : 'Bulk Edit'}
              </button>
              
              {isBulkEditMode && selectedConversationIds.size > 0 && (
                <button
                  onClick={handleBulkDelete}
                  className="flex items-center gap-1 px-2 py-1 text-xs text-red-600 dark:text-red-400 
                           hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 
                           rounded transition-colors"
                >
                  <TrashIcon className="w-3 h-3" />
                  Delete ({selectedConversationIds.size})
                </button>
              )}
            </div>
            
            <div className="h-[calc(100vh-420px)] overflow-y-auto pr-1">
              <ConversationList 
                isBulkEditMode={isBulkEditMode}
                selectedConversationIds={selectedConversationIds}
                onConversationSelect={handleConversationSelect}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}; 