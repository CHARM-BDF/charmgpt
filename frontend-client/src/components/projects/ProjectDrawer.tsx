import React, { useState, useEffect, useRef } from 'react';
import { FileEntry } from '@charm-mcp/shared';

// @ts-ignore - Heroicons type definitions mismatch
import { FolderIcon, PlusIcon, DocumentTextIcon, BeakerIcon } from '@heroicons/react/24/outline';
import { useProjectStore } from '../../store/projectStore';
import { useChatStore } from '../../store/chatStore';
import { GrantReviewListView } from './GrantReviewListView';

interface ProjectDrawerProps {
  storageService: any; // We'll type this properly later
}

export const ProjectDrawer: React.FC<ProjectDrawerProps> = ({ storageService }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [showNewProjectDialog, setShowNewProjectDialog] = useState(false);
  const [showGrantReviewList, setShowGrantReviewList] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const drawerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const { projects, selectedProjectId, addProject, selectProject } = useProjectStore();
  const { startNewConversation } = useChatStore();

  // Filter projects to exclude grant reviews from the main project list
  const regularProjects = projects?.filter(project => project.type !== 'grant_review') || [];
  const grantReviewProjects = projects?.filter(project => project.type === 'grant_review') || [];

  // console.log('ProjectDrawer: All projects:', projects?.length || 0, 'projects');
  // console.log('ProjectDrawer: Regular projects:', regularProjects.length, 'projects');
  // console.log('ProjectDrawer: Grant review projects:', grantReviewProjects.length, 'projects');
  // console.log('ProjectDrawer: Project types:', projects?.map(p => ({ id: p.id, name: p.name, type: p.type })));

  // console.log('ProjectDrawer rendering, currentMode:', currentMode);

  // Track mouse position for drawer activation
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!drawerRef.current || !triggerRef.current) return;
      
      const triggerWidth = 20;
      if (e.clientX >= window.innerWidth - triggerWidth && !isOpen) {
        setIsOpen(true);
      } else if (e.clientX < window.innerWidth - 300 && isOpen && !drawerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    return () => document.removeEventListener('mousemove', handleMouseMove);
  }, [isOpen]);

  // Load project files when project is selected or when files are updated
  const loadFiles = async () => {
    if (!selectedProjectId) return;
    
    try {
      const projectFiles = await storageService.listFiles({
        tags: [`project:${selectedProjectId}`]
      });
      setFiles(projectFiles);
    } catch (error) {
      console.error('Error loading project files:', error);
    }
  };

  // Load files when project is selected
  useEffect(() => {
    loadFiles();
  }, [selectedProjectId]);

  // Set up polling for file updates
  useEffect(() => {
    if (!selectedProjectId) return;

    const pollInterval = setInterval(loadFiles, 2000); // Poll every 2 seconds

    return () => clearInterval(pollInterval);
  }, [selectedProjectId]);

  const handleCreateProject = () => {
    if (!newProjectName.trim()) return;
    
    addProject({
      name: newProjectName,
      description: '',  // Empty description for now
      type: 'project'  // Explicitly set type for regular projects
    });
    
    // Find the newly created project
    const newProject = projects.find(p => p.name === newProjectName);
    if (newProject) {
      selectProject(newProject.id);
      startNewConversation(); // Start a new chat for the project
    }
    
    setNewProjectName('');
    setShowNewProjectDialog(false);
  };

  return (
    <>
      {/* Trigger area */}
      <div
        ref={triggerRef}
        className="fixed right-0 top-[88px] w-5 h-[calc(100vh-96px)] z-40"
      />
      
      {/* Drawer */}
      <div
        ref={drawerRef}
        className={`fixed right-0 top-[88px] h-[calc(100vh-96px)] bg-white dark:bg-gray-800 shadow-lg 
                   transition-transform duration-300 ease-in-out z-50
                   ${isOpen ? 'translate-x-0' : 'translate-x-[95%]'}
                   border-l border-gray-200 dark:border-gray-700
                   rounded-tl-xl rounded-bl-xl
                   w-72`}
      >
        <div className="p-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Projects
            </h2>
            <button
              onClick={() => setShowNewProjectDialog(true)}
              className="p-1.5 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100
                       hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              title="New Project"
            >
              <PlusIcon className="w-5 h-5" />
            </button>
          </div>
          
          {/* Project type icons */}
          <div className="flex space-x-4 mb-4 px-2">
            {/* Regular Projects */}
            <div className="flex flex-col items-center">
              <button
                className={`p-1.5 rounded-lg transition-colors
                          hover:bg-gray-100 dark:hover:bg-gray-700`}
                title="Projects"
              >
                <FolderIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" /> 
              </button>
              <span className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">Projects</span>
            </div>

            {/* Grant Review */}
            <div className="flex flex-col items-center">
              <button
                onClick={() => setShowGrantReviewList(true)}
                className={`p-1.5 rounded-lg transition-colors
                          hover:bg-gray-100 dark:hover:bg-gray-700`}
                title="Grant Review Projects"
              >
                <BeakerIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </button>
              <span className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">Grant Review</span>
            </div>
          </div>
          
          {/* Project list */}
          <div className="space-y-2">
            {regularProjects.map(project => (
              <button
                key={project.id}
                onClick={() => selectProject(project.id)}
                className={`w-full flex items-center gap-2 p-2 rounded-lg transition-colors
                          ${selectedProjectId === project.id
                            ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300'
                            : 'hover:bg-gray-100 text-gray-700 dark:hover:bg-gray-700 dark:text-gray-300'}`}
              >
                <FolderIcon className="w-5 h-5" />
                <span className="text-sm truncate">{project.name}</span>
              </button>
            ))}
          </div>
        </div>
        
        {/* Hint text and icons when drawer is closed */}
        <div className={`absolute left-0 top-1/2 -translate-y-1/2 transition-opacity duration-300
                      ${isOpen ? 'opacity-0' : 'opacity-100'}`}>
          <div className="flex flex-col items-center space-y-6">
            {/* Projects Icon */}
            <div className="flex flex-col items-center">
              <FolderIcon className="w-5 h-5 text-gray-400 dark:text-gray-500" />
              <div className="-rotate-90 whitespace-nowrap text-xs text-gray-400 dark:text-gray-500 mt-2">
                Projects
              </div>
            </div>

            {/* Grant Review Icon */}
            <div className="flex flex-col items-center">
              <BeakerIcon className="w-5 h-5 text-gray-400 dark:text-gray-500" />
              <div className="-rotate-90 whitespace-nowrap text-xs text-gray-400 dark:text-gray-500 mt-2">
                Grant Review
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* New Project Dialog */}
      {showNewProjectDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-96">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              Create New Project
            </h3>
            <input
              type="text"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              placeholder="Project name"
              className="w-full p-2 border rounded-lg mb-4 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
              onKeyDown={(e) => e.key === 'Enter' && handleCreateProject()}
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowNewProjectDialog(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateProject}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Grant Review List View */}
      {showGrantReviewList && (
        <GrantReviewListView 
          onClose={() => setShowGrantReviewList(false)}
          showGrantReviewList={showGrantReviewList}
        />
      )}
    </>
  );
}; 