import React from 'react';
import { Project } from '../../store/projectStore';
// @ts-ignore - Heroicons type definitions mismatch
import { ArrowLeftIcon, StarIcon, EllipsisHorizontalIcon, LockClosedIcon, BookOpenIcon, PlusIcon } from '@heroicons/react/24/outline';

interface ProjectViewProps {
  project: Project;
  onBack: () => void;
}

export const ProjectView: React.FC<ProjectViewProps> = ({ project, onBack }) => {
  return (
    <div className="fixed inset-0 bg-white dark:bg-gray-900 z-50 overflow-y-auto">
      {/* Header */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-screen-2xl mx-auto px-4 py-4">
          <div className="flex items-center space-x-4">
            <button
              onClick={onBack}
              className="p-2 rounded-md text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
            >
              <ArrowLeftIcon className="h-5 w-5" />
            </button>
            <span className="text-sm text-gray-500 dark:text-gray-400">All projects</span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-screen-2xl mx-auto px-4 py-6">
        <div className="flex">
          {/* Left Column - Main Content */}
          <div className="flex-1 pr-8">
            {/* Project Title Section */}
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-3">
                <h1 className="text-3xl font-semibold text-gray-900 dark:text-gray-100">
                  {project.name}
                </h1>
                <div className="flex items-center space-x-2">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200">
                    <LockClosedIcon className="h-3 w-3 mr-1" />
                    Private
                  </span>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <button className="p-2 text-gray-400 hover:text-gray-500 dark:hover:text-gray-300">
                  <StarIcon className="h-5 w-5" />
                </button>
                <button className="p-2 text-gray-400 hover:text-gray-500 dark:hover:text-gray-300">
                  <EllipsisHorizontalIcon className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Project Description */}
            <p className="mt-4 text-gray-600 dark:text-gray-300">
              {project.description}
            </p>

            {/* Conversations Section */}
            <div className="mt-8">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
                Conversations
              </h2>
              <div className="space-y-4">
                {/* Example conversation card - replace with actual data */}
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                    Grant Proposal Review App
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Last message 8 days ago
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Project Knowledge */}
          <div className="w-80">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="p-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                    Project knowledge
                  </h2>
                  <button className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300">
                    <PlusIcon className="h-5 w-5" />
                  </button>
                </div>
                
                {/* Project Instructions Section */}
                <div className="mt-4">
                  <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
                    <span>Set project instructions</span>
                    <span className="text-xs">Optional</span>
                  </div>
                  <button className="mt-2 w-full flex items-center justify-center px-4 py-6 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-gray-500 dark:text-gray-400 hover:border-gray-400 dark:hover:border-gray-500">
                    <BookOpenIcon className="h-8 w-8" />
                  </button>
                  <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 text-center">
                    No knowledge added yet. Add PDFs, documents, or other text to the project knowledge base that Claude will reference in every project conversation.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}; 