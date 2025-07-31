import React, { useEffect, useState, useRef, KeyboardEvent } from 'react';
import { FileEntry } from '@charm-mcp/shared';
import { APIStorageService } from '../../services/fileManagement/APIStorageService';
// @ts-ignore - Heroicons type definitions mismatch
import { DocumentIcon, DocumentTextIcon } from '@heroicons/react/24/outline';

interface FileReferencePopupProps {
  query: string;               // Current search query after @
  position: { x: number, y: number }; // Position to show popup
  onSelect: (file: FileEntry) => void; // Handle file selection
  onClose: () => void;        // Close popup
  projectId: string | null;    // Current project context
  storageService: APIStorageService;
}

export const FileReferencePopup: React.FC<FileReferencePopupProps> = ({
  query,
  position,
  onSelect,
  onClose,
  projectId,
  storageService
}) => {
  console.log('FileReferencePopup rendered with:', { query, position, projectId });
  
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const popupRef = useRef<HTMLDivElement>(null);

  // Load and filter files when query changes
  useEffect(() => {
    const searchFiles = async () => {
      if (!projectId) return;
      
      setLoading(true);
      try {
        const allFiles = await storageService.listFiles({
          tags: [`project:${projectId}`]
        });
        
        // Filter and sort files based on query
        const filteredFiles = allFiles
          .filter(file => file.name.toLowerCase().includes(query.toLowerCase()))
          .sort((a, b) => {
            // Prioritize files that start with the query
            const aStarts = a.name.toLowerCase().startsWith(query.toLowerCase());
            const bStarts = b.name.toLowerCase().startsWith(query.toLowerCase());
            if (aStarts && !bStarts) return -1;
            if (!aStarts && bStarts) return 1;
            return a.name.localeCompare(b.name);
          });

        setFiles(filteredFiles);
        setSelectedIndex(0); // Reset selection when files change
      } catch (error) {
        console.error('Error loading files:', error);
      } finally {
        setLoading(false);
      }
    };

    searchFiles();
  }, [query, projectId, storageService]);

  // Handle keyboard navigation
  const handleKeyDown = (e: KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, files.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (files[selectedIndex]) {
          onSelect(files[selectedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        onClose();
        break;
    }
  };

  // Close popup when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  // Adjust popup position to stay within viewport
  useEffect(() => {
    const adjustPosition = () => {
      if (!popupRef.current) return;
      
      const popup = popupRef.current;
      const rect = popup.getBoundingClientRect();
      const viewport = {
        width: window.innerWidth,
        height: window.innerHeight
      };

      // Ensure popup stays within viewport bounds
      if (rect.right > viewport.width) {
        popup.style.left = `${viewport.width - rect.width - 16}px`;
      }
      if (rect.bottom > viewport.height) {
        popup.style.top = `${viewport.height - rect.height - 16}px`;
      }
    };

    adjustPosition();
    window.addEventListener('resize', adjustPosition);
    return () => window.removeEventListener('resize', adjustPosition);
  }, [position]);

  if (!projectId) return null;

  return (
    <div
      ref={popupRef}
      className="w-full h-full"
      onKeyDown={handleKeyDown}
      tabIndex={-1}
    >
      {loading ? (
        <div className="p-4 text-gray-500 dark:text-gray-400 flex items-center gap-2">
          <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-500 border-t-transparent"></div>
          <span>Loading files...</span>
        </div>
      ) : files.length === 0 ? (
        <div className="p-4 text-gray-500 dark:text-gray-400">
          {query ? 'No matching files found' : 'No files available'}
        </div>
      ) : (
        <ul className="py-2">
          {files.map((file, index) => (
            <li
              key={file.id}
              className={`px-4 py-2 cursor-pointer flex items-center gap-2 ${
                index === selectedIndex
                  ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                  : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
              }`}
              onClick={() => onSelect(file)}
              onMouseEnter={() => setSelectedIndex(index)}
            >
              {file.mimeType?.includes('text') ? (
                <DocumentTextIcon className="w-5 h-5 text-gray-500 dark:text-gray-400 flex-shrink-0" />
              ) : (
                <DocumentIcon className="w-5 h-5 text-gray-500 dark:text-gray-400 flex-shrink-0" />
              )}
              <span className="truncate flex-1">{file.name}</span>
              {index === selectedIndex && (
                <kbd className="hidden sm:inline-block px-2 py-0.5 text-xs bg-gray-100 dark:bg-gray-700 rounded">
                  Enter
                </kbd>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}; 