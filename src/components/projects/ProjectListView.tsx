import React, { useEffect, useState } from 'react';
import { useProjectStore } from '../../store/projectStore';
// @ts-ignore - Heroicons type definitions mismatch
import { PlusIcon, XMarkIcon, ArrowLeftIcon, TrashIcon } from '@heroicons/react/24/outline';
import { ProjectView } from './ProjectView';

interface ProjectListViewProps {
  onClose: () => void;
  showProjectList: boolean;
}

export const ProjectListView: React.FC<ProjectListViewProps> = ({ onClose, showProjectList }) => {
  const { projects, isLoading, error, selectedProjectId, selectProject, addProject, deleteProject } = useProjectStore();
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  // Filter out grant review projects
  const regularProjects = projects
    .filter(p => p.type !== 'grant_review')
    // Sort by updatedAt timestamp, most recent first
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  useEffect(() => {
    if (showProjectList) {
      selectProject(null);
    }
  }, [showProjectList, selectProject]);

  const selectedProject = selectedProjectId 
    ? regularProjects.find(p => p.id === selectedProjectId)
    : null;

  const handleCreateProject = () => {
    console.log("ProjectListView: handleCreateProject called");
    const newProjectId = addProject({
      name: "New Project",
      description: "",
      type: 'project'
    });
    
    // Immediately select the new project
    console.log("ProjectListView: Created new project with ID:", newProjectId);
    console.log("ProjectListView: Selecting new project");
    selectProject(newProjectId);
    
    // Log projects after creation
    const { projects } = useProjectStore.getState();
    console.log("ProjectListView: All projects after creation:", 
      projects.map(p => ({ id: p.id, name: p.name, type: p.type }))
    );
  };

  const handleDeleteProject = (projectId: string) => {
    if (confirmDelete === projectId) {
      // User has confirmed, delete the project
      deleteProject(projectId);
      setConfirmDelete(null);
    } else {
      // First click, ask for confirmation
      setConfirmDelete(projectId);
    }
  };

  if (selectedProject) {
    return (
      <ProjectView 
        projectId={selectedProjectId!} 
        onBack={() => selectProject(null)} 
        onClose={onClose}
      />
    );
  }

  return (
    <div className="fixed inset-0 bg-white dark:bg-gray-900 z-50">
      {/* Header */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-screen-2xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-4">
              <button
                onClick={onClose}
                className="p-2 rounded-md text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <ArrowLeftIcon className="h-5 w-5" />
              </button>
              <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Research Projects</h1>
            </div>
            <div className="flex items-center space-x-4">
              <button
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                onClick={handleCreateProject}
              >
                <PlusIcon className="h-5 w-5 mr-2" />
                New Project
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-screen-2xl mx-auto px-4 py-6">
        {isLoading ? (
          <div className="text-center text-gray-500 dark:text-gray-400">Loading projects...</div>
        ) : error ? (
          <div className="text-center text-red-500">{error}</div>
        ) : regularProjects.length === 0 ? (
          <div className="text-center text-gray-500 dark:text-gray-400">
            No research projects yet. Create your first project!
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {regularProjects.map((project) => (
              <div
                key={project.id}
                className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 group relative"
              >
                {/* Delete Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteProject(project.id);
                  }}
                  className="absolute top-3 right-3 p-1.5 text-gray-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                  title={confirmDelete === project.id ? "Click again to confirm deletion" : "Delete project"}
                >
                  <TrashIcon className={`h-5 w-5 ${confirmDelete === project.id ? 'text-red-500 dark:text-red-400' : ''}`} />
                </button>
                
                {/* Project content - only trigger click if not on the delete button */}
                <div 
                  className="cursor-pointer"
                  onClick={() => selectProject(project.id)}
                >
                  <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 pr-8">{project.name}</h3>
                  <p className="mt-1 text-gray-500 dark:text-gray-400">{project.description}</p>
                  <div className="mt-4 text-sm text-gray-500 dark:text-gray-400">
                    Last updated: {new Date(project.updatedAt).toLocaleDateString()}
                  </div>
                  
                  {/* Confirmation message */}
                  {confirmDelete === project.id && (
                    <div className="mt-2 text-sm text-red-500 dark:text-red-400 font-medium">
                      Click the trash icon again to confirm deletion
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}; 