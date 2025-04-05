import React, { useState, useRef } from 'react';
import { FileEntry } from '../../types/fileManagement';
// @ts-ignore - Heroicons type definitions mismatch
import { FolderIcon, ArrowUpTrayIcon, ChevronDownIcon } from '@heroicons/react/24/outline';
import { useProjectStore } from '../../store/projectStore';

interface ProjectFilesTopDrawerProps {
  files: FileEntry[];
  selectedProjectId: string | null;
  onFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
}

export const ProjectFilesTopDrawer: React.FC<ProjectFilesTopDrawerProps> = ({
  files,
  selectedProjectId,
  onFileUpload,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { getProject } = useProjectStore();
  const selectedProject = selectedProjectId ? getProject(selectedProjectId) : null;

  return (
    <div className="fixed left-0 top-[88px] z-50">
      {/* Toggle button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border-b border-r border-gray-200 dark:border-gray-700 rounded-br-lg shadow-sm"
      >
        <span className="text-sm text-gray-700 dark:text-gray-300">
          Project Files{selectedProject ? ` - ${selectedProject.name}` : ''}
        </span>
        <ChevronDownIcon className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Drawer */}
      <div
        className={`absolute top-full left-0 w-72 bg-white dark:bg-gray-800 shadow-lg border border-gray-200 dark:border-gray-700 rounded-b-lg
                   transition-all duration-300 origin-top ${isOpen ? 'scale-y-100' : 'scale-y-0'}`}
      >
        <div className="p-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Files</h3>
            <button
              onClick={() => selectedProjectId && fileInputRef.current?.click()}
              className={`p-1.5 rounded-lg transition-colors
                       ${selectedProjectId 
                         ? 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700' 
                         : 'text-gray-400 dark:text-gray-600 cursor-not-allowed'}`}
              title={selectedProjectId ? "Upload File" : "Select a project to upload files"}
              disabled={!selectedProjectId}
            >
              <ArrowUpTrayIcon className="w-5 h-5" />
            </button>
          </div>

          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            onChange={onFileUpload}
          />

          <div className="space-y-1 max-h-60 overflow-y-auto">
            {files.map(file => (
              <div
                key={file.id}
                className="flex items-center gap-2 p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                <FolderIcon className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-700 dark:text-gray-300 truncate">
                  {file.name}
                </span>
              </div>
            ))}
            {files.length === 0 && (
              <div className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                No files uploaded yet
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 