import React, { useState, useEffect, useRef } from 'react';
import { FileEntry } from '../../types/fileManagement';
// @ts-ignore - Heroicons type definitions mismatch
import { FolderIcon, ArrowUpTrayIcon } from '@heroicons/react/24/outline';
import { useModeStore } from '../../store/modeStore';

interface ProjectDrawerProps {
  projectId: string;
  storageService: any; // We'll type this properly later
}

export const ProjectDrawer: React.FC<ProjectDrawerProps> = ({ projectId, storageService }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [files, setFiles] = useState<FileEntry[]>([]);
  const drawerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { currentMode } = useModeStore();

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

  // Load project files
  useEffect(() => {
    const loadFiles = async () => {
      try {
        const projectFiles = await storageService.listFiles({
          tags: [`project:${projectId}`]
        });
        setFiles(projectFiles);
      } catch (error) {
        console.error('Error loading project files:', error);
      }
    };
    loadFiles();
  }, [projectId, storageService]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const content = await file.arrayBuffer();
      await storageService.createFile(new Uint8Array(content), {
        description: file.name,
        tags: [`project:${projectId}`],
        schema: {
          type: 'file',
          format: file.type || 'application/octet-stream'
        }
      });
      
      // Refresh file list
      const projectFiles = await storageService.listFiles({
        tags: [`project:${projectId}`]
      });
      setFiles(projectFiles);
    } catch (error) {
      console.error('Error uploading file:', error);
    }
  };

  return (
    <>
      {/* Trigger area */}
      <div
        ref={triggerRef}
        className="fixed right-0 top-[88px] w-5 h-[calc(100vh-96px)] z-40"
      />
      
      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        onChange={handleFileUpload}
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
              Project Files
            </h2>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-1.5 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100
                       hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors
                       flex items-center gap-1"
              title="Upload File"
            >
              <ArrowUpTrayIcon className="w-5 h-5" />
            </button>
          </div>
          
          {/* File list */}
          <div className="h-[calc(100vh-224px)] overflow-y-auto">
            {files.map(file => (
              <div
                key={file.id}
                className="flex items-center gap-2 p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                <FolderIcon className="w-5 h-5 text-gray-400" />
                <span className="text-sm text-gray-700 dark:text-gray-300 truncate">
                  {file.name}
                </span>
              </div>
            ))}
          </div>
        </div>
        
        {/* Hint text when drawer is closed */}
        <div className={`absolute left-0 top-1/2 -translate-y-1/2 transition-opacity duration-300
                      ${isOpen ? 'opacity-0' : 'opacity-100'}`}>
          <div className="-rotate-90 whitespace-nowrap text-xs text-gray-400 dark:text-gray-500">
            Project Files
          </div>
        </div>
      </div>
    </>
  );
}; 