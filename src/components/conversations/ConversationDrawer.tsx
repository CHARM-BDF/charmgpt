import React, { useState, useEffect, useRef } from 'react';
import { useChatStore } from '../../store/chatStore';
import { useProjectStore } from '../../store/projectStore';
import { ConversationList } from './ConversationList';
// @ts-ignore - Heroicons type definitions mismatch
import { SparklesIcon, ChevronRightIcon, FolderIcon, ArrowsPointingOutIcon, BeakerIcon } from '@heroicons/react/24/outline';

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
  const drawerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const { startNewConversation, switchConversation, conversations } = useChatStore();
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
  
  console.log('ConversationDrawer: All projects:', projects?.length || 0);
  console.log('ConversationDrawer: Regular projects:', regularProjects.length);
  console.log('ConversationDrawer: Grant review projects:', grantReviewProjects.length);
  console.log('ConversationDrawer: Project types:', projects?.map(p => ({ id: p.id.substring(0, 6), name: p.name, type: p.type })));
  
  // Handle clicks outside the drawer to collapse it
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (drawerRef.current && !drawerRef.current.contains(e.target as Node) && isExpanded) {
        setIsExpanded(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isExpanded]);

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

  // Calculate the width class based on current state
  const widthClass = isExpanded ? 'w-72' : 'w-16';

  return (
    <>
      {/* Drawer */}
      <div
        ref={drawerRef}
        className={`fixed left-0 top-[88px] h-[calc(100vh-196px)] bg-white dark:bg-gray-800 shadow-lg 
                   transition-all duration-300 ease-in-out z-50
                   ${isVisible ? 'translate-x-0' : 'translate-x-[-100%]'}
                   border-r border-gray-200 dark:border-gray-700
                   rounded-tr-xl rounded-br-xl
                   ${widthClass} overflow-hidden`}
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
            <ArrowsPointingOutIcon className="w-6 h-6" />
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
          <div className="absolute inset-0 w-full bg-white dark:bg-gray-800 p-4 overflow-hidden">
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
                  New Conversation
                </h2>
              </div>
              <button
                onClick={handleNewConversation}
                className="p-1.5 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100
                         hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors
                         flex items-center gap-1"
                title="New Conversation"
              >
                <span className="w-6 h-6 flex items-center justify-center bg-gray-200 dark:bg-gray-600 rounded-full">
                  <span className="text-base font-semibold leading-none">+</span>
                </span>
              </button>
            </div>
            
            {/* Recent projects section */}
            <div className="mb-4">
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  Recent Projects
                </h3>
                {regularProjects.length > 0 && (
                  <button
                    onClick={navigateToProjects}
                    className="text-xs text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300"
                  >
                    View All
                  </button>
                )}
              </div>
              
              <div className="space-y-1 text-sm">
                {regularProjects.length > 0 ? (
                  regularProjects.map(project => (
                    <button
                      key={project.id}
                      onClick={() => openProject(project.id)}
                      className="w-full text-left px-3 py-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 
                               flex items-center gap-2 transition-colors"
                    >
                      <FolderIcon className="w-4 h-4 text-gray-400" />
                      <span className="truncate">{project.name}</span>
                    </button>
                  ))
                ) : (
                  <div className="text-gray-400 px-3 py-2 italic text-xs">
                    No projects yet. Create your first project.
                  </div>
                )}
              </div>
            </div>

            {/* Grant Review projects section */}
            <div className="mb-4">
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    Grant Reviews
                  </h3>
                  <button
                    onClick={() => {
                      const { addProject, projects } = useProjectStore.getState();
                      const projectName = "New Grant Review";
                      addProject({
                        name: projectName,
                        description: "",
                        type: 'grant_review',
                        grantMetadata: {
                          requiredDocuments: []
                        }
                      });
                      // Find the newly created project
                      const newProject = projects.find(p => p.name === projectName && p.type === 'grant_review');
                      if (newProject) {
                        useProjectStore.getState().selectProject(newProject.id);
                        setShowProjectView?.(true);
                        setIsExpanded(false);
                      }
                    }}
                    className="w-5 h-5 flex items-center justify-center bg-gray-200 dark:bg-gray-600 rounded-full
                             hover:bg-blue-500 dark:hover:bg-blue-600 transition-colors group"
                    title="New Grant Review"
                  >
                    <span className="text-sm font-semibold leading-none text-gray-600 dark:text-gray-300 group-hover:text-white">+</span>
                  </button>
                </div>
                {grantReviewProjects.length > 0 && (
                  <button
                    onClick={() => setShowGrantReviewList?.(true)}
                    className="text-xs text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300"
                  >
                    View All
                  </button>
                )}
              </div>
              
              <div className="space-y-1 text-sm">
                {grantReviewProjects.length > 0 ? (
                  grantReviewProjects.map(project => (
                    <button
                      key={project.id}
                      onClick={() => openProject(project.id)}
                      className="w-full text-left px-3 py-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 
                               flex items-center gap-2 transition-colors"
                    >
                      <img 
                        src="/logos/grantmode_icon.png" 
                        alt="Grant Review"
                        className="w-4 h-4 opacity-80" 
                      />
                      <span className="truncate">{project.name}</span>
                    </button>
                  ))
                ) : (
                  <div className="text-gray-400 px-3 py-2 italic text-xs">
                    No grant reviews yet.
                  </div>
                )}
              </div>
            </div>
            
            {/* Conversation list */}
            <div>
              <div className="mb-2 text-xs text-gray-500 dark:text-gray-400 px-1">
                Recent Conversations
              </div>
              <div className="h-[calc(100vh-420px)] overflow-y-auto pr-1">
                <ConversationList />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Invisible trigger area - keeping this for now, may remove later */}
      <div
        ref={triggerRef}
        className="fixed left-0 top-[88px] w-5 h-[calc(100vh-196px)] z-40"
      />
    </>
  );
}; 