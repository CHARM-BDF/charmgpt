import React, { useEffect, useState, useRef, KeyboardEvent, useCallback } from 'react';
import { FileEntry } from '@charm-mcp/shared';
import { APIStorageService } from '../../services/fileManagement/APIStorageService';
// @ts-ignore - Heroicons type definitions mismatch
import { DocumentIcon, DocumentTextIcon } from '@heroicons/react/24/outline';

interface FileReferencePopupProps {
  query: string;               // Current search query after @
  position: { x: number, y: number }; // Position to show popup
  onSelect: (file: FileEntry) => void; // Handle file selection
  onPreview: (file: FileEntry | null) => void; // Handle file preview
  onClose: () => void;        // Close popup
  projectId: string | null;    // Current project context
  storageService: APIStorageService;
}

export const FileReferencePopup: React.FC<FileReferencePopupProps> = ({
  query,
  position,
  onSelect,
  onPreview,
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
      setLoading(true);
      try {
        let allFiles: FileEntry[] = [];
        
        // If projectId exists, try to get project-specific files first
        if (projectId) {
          try {
            const projectFiles = await storageService.listFiles({
              tags: [`project:${projectId}`]
            });
            allFiles = projectFiles;
          } catch (error) {
            console.error('Error loading project files:', error);
          }
        }
        
        // Also load files with 'uploaded' or 'chat' tags (for files uploaded via paper clip)
        // This ensures files uploaded via UI are always available
        // Get files with 'uploaded' tag and files with 'chat' tag separately
        // since the backend requires ALL tags to match, we need to query separately
        try {
          const uploadedTagFiles = await storageService.listFiles({
            tags: ['uploaded']
          });
          const chatTagFiles = await storageService.listFiles({
            tags: ['chat']
          });
          // Merge both sets, avoiding duplicates by file ID
          const existingIds = new Set(allFiles.map(f => f.id));
          const allUploadedFiles = [...uploadedTagFiles, ...chatTagFiles];
          allUploadedFiles.forEach(file => {
            if (!existingIds.has(file.id)) {
              allFiles.push(file);
              existingIds.add(file.id); // Update set to prevent duplicates in same array
            }
          });
        } catch (error) {
          console.error('Error loading uploaded files:', error);
        }
        
        // If no files found with tags, try to get all files (fallback)
        if (allFiles.length === 0) {
          try {
            allFiles = await storageService.listFiles();
          } catch (error) {
            console.error('Error loading all files:', error);
          }
        }
        
        // Deduplicate by file ID (in case same file appears multiple times from different queries)
        const uniqueFilesById = new Map<string, FileEntry>();
        allFiles.forEach(file => {
          // Only keep files that have an ID (safety check)
          if (file.id && !uniqueFilesById.has(file.id)) {
            uniqueFilesById.set(file.id, file);
          }
        });
        
        // Convert back to array and filter/sort
        const uniqueFiles = Array.from(uniqueFilesById.values());
        const filteredFiles = uniqueFiles
          .filter(file => {
            // If query is empty, show all files. Otherwise filter by name.
            if (!query) return true;
            return file.name.toLowerCase().includes(query.toLowerCase());
          })
          .sort((a, b) => {
            // Prioritize files that start with the query
            if (!query) return a.name.localeCompare(b.name);
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

  // Update preview when selected index changes
  const lastSelectedIndexRef = useRef<number>(-1);
  
  useEffect(() => {
    // Only update if the selected index actually changed
    if (lastSelectedIndexRef.current === selectedIndex) return;
    
    // Only update preview if files are loaded and we have a valid selection
    if (files.length > 0 && selectedIndex >= 0 && selectedIndex < files.length) {
      lastSelectedIndexRef.current = selectedIndex;
      onPreview(files[selectedIndex]);
    } else if (files.length === 0 || selectedIndex < 0) {
      // Only clear preview if we actually have no files or invalid index
      if (lastSelectedIndexRef.current !== -1) {
        lastSelectedIndexRef.current = -1;
        onPreview(null);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIndex, files.length]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Only handle if popup is actually visible (has files)
    if (files.length === 0) return;
    
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        e.stopPropagation();
        setSelectedIndex(prev => {
          const newIndex = Math.min(prev + 1, files.length - 1);
          console.log('⌨️ ArrowDown: Moving to index', newIndex);
          return newIndex;
        });
        break;
      case 'ArrowUp':
        e.preventDefault();
        e.stopPropagation();
        setSelectedIndex(prev => {
          const newIndex = Math.max(prev - 1, 0);
          console.log('⌨️ ArrowUp: Moving to index', newIndex);
          return newIndex;
        });
        break;
      case 'Enter':
        e.preventDefault();
        e.stopPropagation();
        console.log('⌨️ Enter pressed in popup, selectedIndex:', selectedIndex, 'files.length:', files.length);
        if (files[selectedIndex]) {
          console.log('⌨️ Enter pressed, selecting file:', files[selectedIndex].name);
          onSelect(files[selectedIndex]);
          console.log('⌨️ onSelect called for Enter');
        } else {
          console.error('⌨️ ERROR: No file at selectedIndex', selectedIndex, 'files:', files);
        }
        break;
      case 'Escape':
        e.preventDefault();
        e.stopPropagation();
        onPreview(null);
        onClose();
        break;
    }
  }, [files, selectedIndex, onSelect, onPreview, onClose]);

  // Add keyboard event listener to document (like GraphReferencePopup does)
  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

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

  // Popup can work without projectId now - it will show all uploaded files

  return (
    <div
      ref={popupRef}
      className="w-full h-full"
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
              className={`px-4 py-2 cursor-pointer flex items-center gap-2 transition-colors ${
                index === selectedIndex
                  ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 font-medium'
                  : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
              }`}
              onClick={(e) => {
                console.log('🖱️ File clicked in popup:', file.name);
                e.preventDefault();
                e.stopPropagation();
                console.log('🖱️ Calling onSelect with file:', file.name);
                onSelect(file);
                console.log('🖱️ onSelect called, file:', file.name);
              }}
              onMouseEnter={() => {
                setSelectedIndex(index);
              }}
            >
              {file.mimeType?.includes('text') ? (
                <DocumentTextIcon className="w-5 h-5 text-gray-500 dark:text-gray-400 flex-shrink-0" />
              ) : (
                <DocumentIcon className="w-5 h-5 text-gray-500 dark:text-gray-400 flex-shrink-0" />
              )}
              <span className="truncate flex-1">{file.name}</span>
              {index === selectedIndex && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">Will insert: <span className="font-bold">@{file.name}</span></span>
                  <kbd className="hidden sm:inline-block px-2 py-0.5 text-xs bg-blue-200 dark:bg-blue-800 text-blue-800 dark:text-blue-200 rounded border border-blue-300 dark:border-blue-700">
                    Enter
                  </kbd>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}; 