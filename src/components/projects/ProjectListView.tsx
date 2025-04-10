import React, { useState } from 'react';
import { useProjectStore } from '../../store/projectStore';
// @ts-ignore - Heroicons type definitions mismatch
import { PlusIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { ProjectView } from './ProjectView';

interface ProjectListViewProps {
  onClose: () => void;
}

export const ProjectListView: React.FC<ProjectListViewProps> = ({ onClose }) => {
  const { projects, isLoading, error } = useProjectStore();
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  const selectedProject = selectedProjectId 
    ? projects.find(p => p.id === selectedProjectId)
    : null;

  if (selectedProject) {
    return (
      <ProjectView 
        project={selectedProject} 
        onBack={() => setSelectedProjectId(null)} 
      />
    );
  }

  return (
    <div className="fixed inset-0 bg-white dark:bg-gray-900 z-50">
      {/* Header */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-screen-2xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Projects</h1>
            <div className="flex items-center space-x-4">
              <button
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                onClick={() => {/* TODO: Add new project */}}
              >
                <PlusIcon className="h-5 w-5 mr-2" />
                New Project
              </button>
              <button
                onClick={onClose}
                className="p-2 rounded-md text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
              >
                <XMarkIcon className="h-6 w-6" />
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
        ) : projects.length === 0 ? (
          <div className="text-center text-gray-500 dark:text-gray-400">
            No projects yet. Create your first project!
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project) => (
              <div
                key={project.id}
                className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 cursor-pointer hover:shadow-md transition-shadow duration-200"
                onClick={() => setSelectedProjectId(project.id)}
              >
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">{project.name}</h3>
                <p className="mt-1 text-gray-500 dark:text-gray-400">{project.description}</p>
                <div className="mt-4 text-sm text-gray-500 dark:text-gray-400">
                  Last updated: {new Date(project.updatedAt).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}; 