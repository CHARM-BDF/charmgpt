import React, { useState, useEffect, useRef } from 'react';
import { FileEntry } from '../../types/fileManagement';
// @ts-ignore - Heroicons type definitions mismatch
import { FolderIcon, PlusIcon, DocumentTextIcon } from '@heroicons/react/24/outline';
import { useModeStore } from '../../store/modeStore';
import { useProjectStore, Project } from '../../store/projectStore';
import { useChatStore } from '../../store/chatStore';

interface ProjectDrawerProps {
  storageService: any; // We'll type this properly later
}

export const ProjectDrawer: React.FC<ProjectDrawerProps> = ({ storageService }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [showNewProjectDialog, setShowNewProjectDialog] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const drawerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const { currentMode } = useModeStore();
  const { projects, selectedProjectId, addProject, selectProject } = useProjectStore();
  const { startNewConversation } = useChatStore();

  // Don't render if not in grant mode
  if (currentMode !== 'grant') {
    return null;
  }

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
      description: ''  // Empty description for now
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

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !selectedProjectId) return;

    try {
      const content = await file.arrayBuffer();
      await storageService.createFile(new Uint8Array(content), {
        description: file.name,
        tags: [`project:${selectedProjectId}`],
        schema: {
          type: 'file',
          format: file.type || 'application/octet-stream'
        }
      });
      
      // Refresh file list
      loadFiles();
    } catch (error) {
      console.error('Error uploading file:', error);
    }
  };

  const handleFileDelete = async (fileId: string) => {
    if (!window.confirm('Are you sure you want to delete this file?')) {
      return;
    }

    try {
      await storageService.deleteFile(fileId);
      // Refresh file list
      loadFiles();
    } catch (error) {
      console.error('Error deleting file:', error);
    }
  };

  const handleFileRename = async (fileId: string, newName: string) => {
    try {
      const metadata = await storageService.getMetadata(fileId);
      metadata.description = newName;
      await storageService.updateMetadata(fileId, metadata);
      // Refresh file list
      loadFiles();
    } catch (error) {
      console.error('Error renaming file:', error);
    }
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
                       hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors
                       flex items-center gap-1"
              title="New Project"
            >
              <PlusIcon className="w-5 h-5" />
            </button>
          </div>
          
          {/* Project list */}
          <div className="space-y-2 mb-4">
            {projects.map(project => (
              <button
                key={project.id}
                onClick={() => selectProject(project.id)}
                className={`w-full flex items-center gap-2 p-2 rounded-lg transition-colors
                          ${selectedProjectId === project.id
                            ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300'
                            : 'hover:bg-gray-100 text-gray-700 dark:hover:bg-gray-700 dark:text-gray-300'}`}
              >
                <DocumentTextIcon className="w-5 h-5" />
                <span className="text-sm truncate">{project.name}</span>
              </button>
            ))}
          </div>
        </div>
        
        {/* Hint text when drawer is closed */}
        <div className={`absolute left-0 top-1/2 -translate-y-1/2 transition-opacity duration-300
                      ${isOpen ? 'opacity-0' : 'opacity-100'}`}>
          <div className="-rotate-90 whitespace-nowrap text-xs text-gray-400 dark:text-gray-500">
            Projects
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
    </>
  );
}; 