import React, { useState, useEffect } from 'react';
import { FileEntry } from '../../types/fileManagement';
import { BaseStorageService } from '../../services/fileManagement/BaseStorageService';

interface FileManagerProps {
  storageService: BaseStorageService;
}

export const FileManager: React.FC<FileManagerProps> = ({ storageService }) => {
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [selectedFile, setSelectedFile] = useState<FileEntry | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    loadFiles();
  }, []);

  const loadFiles = async () => {
    try {
      const fileList = await storageService.listFiles();
      setFiles(fileList);
    } catch (error) {
      console.error('Error loading files:', error);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      // Read file as ArrayBuffer
      const arrayBuffer = await file.arrayBuffer();
      // Convert to Uint8Array for consistent handling
      const content = new Uint8Array(arrayBuffer);
      
      const metadata = {
        description: file.name,
        schema: {
          type: "json" as const,
          format: file.type || 'application/octet-stream',
          encoding: 'utf-8',
          sampleData: ''
        },
        origin: {
          type: 'upload' as const,
          timestamp: new Date()
        },
        tags: [],
        llmNotes: ''
      };

      await storageService.createFile(content, metadata);
      await loadFiles();
    } catch (error) {
      console.error('Error uploading file:', error);
    } finally {
      setIsUploading(false);
    }
  };

  const handleSearch = async () => {
    try {
      const results = await storageService.searchFiles({ text: searchQuery });
      setFiles(results);
    } catch (error) {
      console.error('Error searching files:', error);
    }
  };

  return (
    <div className="p-4">
      <div className="mb-4">
        <h1 className="text-2xl font-bold mb-4">File Manager</h1>
        
        {/* Upload Section */}
        <div className="mb-4">
          <input
            type="file"
            onChange={handleFileUpload}
            disabled={isUploading}
            className="block w-full text-sm text-gray-500 dark:text-gray-400
              file:mr-4 file:py-2 file:px-4
              file:rounded-md file:border-0
              file:text-sm file:font-semibold
              file:bg-blue-50 file:text-blue-700
              dark:file:bg-blue-900/20 dark:file:text-blue-300
              hover:file:bg-blue-100 dark:hover:file:bg-blue-900/30"
          />
          {isUploading && <span className="mt-2 text-gray-600 dark:text-gray-400">Uploading...</span>}
        </div>

        {/* Search Section */}
        <div className="mb-6 flex">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search files..."
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-l-md 
              bg-white dark:bg-gray-700 
              text-gray-900 dark:text-gray-100
              placeholder-gray-500 dark:placeholder-gray-400
              focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
          />
          <button
            onClick={handleSearch}
            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700
              text-white font-medium rounded-r-md transition-colors"
          >
            Search
          </button>
        </div>
      </div>

      {/* File List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {files.map((file) => (
          <div
            key={file.id}
            className={`border dark:border-gray-700 rounded-lg p-4 cursor-pointer
              ${selectedFile?.id === file.id 
                ? 'border-blue-500 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/20' 
                : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
              }
              transition-all duration-200`}
            onClick={() => setSelectedFile(file)}
          >
            <h3 className="font-medium text-gray-900 dark:text-gray-100">{file.name}</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{file.metadata.description}</p>
            <div className="mt-2 text-xs text-gray-500 dark:text-gray-500 space-y-1">
              <p>Size: {file.size} bytes</p>
              <p>Type: {file.mimeType}</p>
              <p>Created: {new Date(file.created).toLocaleString()}</p>
            </div>
          </div>
        ))}
      </div>

      {/* File Details Modal */}
      {selectedFile && (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl m-4 max-h-[90vh] flex flex-col">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                  {selectedFile.name}
                </h2>
                <button
                  onClick={() => setSelectedFile(null)}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  <span className="sr-only">Close</span>
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4">
              <div className="space-y-4">
                {/* File Info */}
                <div>
                  <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-2">File Information</h3>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-gray-600 dark:text-gray-400">Size: {selectedFile.size} bytes</p>
                      <p className="text-gray-600 dark:text-gray-400">Type: {selectedFile.mimeType}</p>
                      <p className="text-gray-600 dark:text-gray-400">Created: {new Date(selectedFile.created).toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-gray-600 dark:text-gray-400">Status: {selectedFile.status}</p>
                      <p className="text-gray-600 dark:text-gray-400">Owner: {selectedFile.owner}</p>
                      <p className="text-gray-600 dark:text-gray-400">Modified: {new Date(selectedFile.modified).toLocaleString()}</p>
                    </div>
                  </div>
                </div>

                {/* Metadata */}
                <div>
                  <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-2">Metadata</h3>
                  <pre className="bg-gray-50 dark:bg-gray-900 p-4 rounded-md overflow-auto text-sm text-gray-800 dark:text-gray-200 max-h-[40vh]">
                    {JSON.stringify(selectedFile.metadata, null, 2)}
                  </pre>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-gray-200 dark:border-gray-700">
              <div className="flex justify-end">
                <button
                  onClick={() => setSelectedFile(null)}
                  className="px-4 py-2 bg-gray-500 hover:bg-gray-600 dark:bg-gray-700 dark:hover:bg-gray-600
                    text-white font-medium rounded-md transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}; 